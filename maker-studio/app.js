/* ================================================================
   Maker Studio AI — your personal all-in-one digital product studio
   Runs 100% on your own computer. No account, no server, no tracking.
   ================================================================ */

// ---------------- State ----------------
const LIMITS = { chat: 5, prompts: 3, replication: 1, competitor: 1 };
const METER_LABELS = { chat: 'AI Chat', prompts: 'Prompts', replication: 'Replication', competitor: 'Competitor' };

const DEFAULT_STATE = {
  name: 'jasmin',
  plan: 'free',
  provider: 'auto',
  keys: { anthropic: '', openai: '', gemini: '', youtube: '' },
  usage: { week: '', counts: { chat: 0, prompts: 0, replication: 0, competitor: 0 } },
  history: [],
  chats: []
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem('makerStudio');
    if (raw) {
      const s = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_STATE),
        ...s,
        keys: { ...DEFAULT_STATE.keys, ...(s.keys || {}) },
        usage: { week: (s.usage && s.usage.week) || '', counts: { ...DEFAULT_STATE.usage.counts, ...((s.usage && s.usage.counts) || {}) } }
      };
    }
  } catch (e) { /* corrupted state -> start fresh */ }
  return structuredClone(DEFAULT_STATE);
}
function saveState() { localStorage.setItem('makerStudio', JSON.stringify(state)); }

// Monday-based week key, so usage resets every Monday like the original
function weekKey() {
  const d = new Date();
  const shift = (d.getDay() + 6) % 7; // days since Monday
  d.setDate(d.getDate() - shift);
  return d.toISOString().slice(0, 10);
}
function ensureWeek() {
  const wk = weekKey();
  if (state.usage.week !== wk) {
    state.usage = { week: wk, counts: { chat: 0, prompts: 0, replication: 0, competitor: 0 } };
    saveState();
  }
}
function creditsLeft(cat) {
  if (state.plan === 'unlimited') return Infinity;
  ensureWeek();
  return LIMITS[cat] - state.usage.counts[cat];
}
function useCredit(cat) {
  ensureWeek();
  state.usage.counts[cat]++;
  saveState();
  renderUsage();
}

// ---------------- Small utilities ----------------
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function $(sel) { return document.querySelector(sel); }
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2600);
}
function copyText(text, msg) {
  navigator.clipboard.writeText(text).then(
    () => toast(msg || 'Copied to clipboard ✓'),
    () => toast('Could not copy — select the text manually')
  );
}
function fmtNum(n) {
  n = Number(n || 0);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
// tiny markdown-ish renderer (headings, bold, bullets) with full escaping first
function mdLite(text) {
  let h = esc(text);
  h = h.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  h = h.replace(/^[-•] (.*)$/gm, '&nbsp;•&nbsp;$1');
  return h;
}
function saveHistory(tool, title, content, extra) {
  state.history.unshift({ id: Date.now() + '' + Math.floor(Math.random() * 999), tool, title, content, extra: extra || null, date: new Date().toISOString() });
  if (state.history.length > 200) state.history.length = 200;
  saveState();
}

// ---------------- AI provider layer ----------------
function activeProvider() {
  const k = state.keys;
  if (state.provider !== 'auto') return k[state.provider] ? state.provider : null;
  if (k.anthropic) return 'anthropic';
  if (k.openai) return 'openai';
  if (k.gemini) return 'gemini';
  return null;
}
function providerName(p) { return { anthropic: 'Claude', openai: 'ChatGPT', gemini: 'Gemini' }[p] || p; }
function hasAI() { return !!activeProvider(); }

const MODELS = {
  anthropic: ['claude-sonnet-5', 'claude-sonnet-4-5', 'claude-3-7-sonnet-latest'],
  openai: ['gpt-4o-mini', 'gpt-4o'],
  // "-latest" aliases track whatever Google currently serves; the rest are
  // fallbacks for when a model is retired, overloaded (503) or out of free
  // quota (429) — the lite models usually have the most free capacity
  gemini: ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.0-flash'],
  geminiImage: ['gemini-3.1-flash-image', 'gemini-2.5-flash-image', 'nano-banana-pro-preview']
};

async function aiChat(messages, system) {
  const p = activeProvider();
  if (!p) throw new Error('NO_KEY');
  if (p === 'anthropic') return anthropicChat(messages, system);
  if (p === 'openai') return openaiChat(messages, system);
  return geminiChat(messages, system);
}
async function aiGenerate(prompt, system) {
  return aiChat([{ role: 'user', content: prompt }], system);
}

async function anthropicChat(messages, system) {
  let lastErr;
  for (const model of MODELS.anthropic) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': state.keys.anthropic,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model, max_tokens: 4000, system: system || undefined, messages })
    });
    if (res.ok) {
      const j = await res.json();
      return (j.content || []).map(b => b.text || '').join('');
    }
    const err = await res.text();
    lastErr = new Error('Claude error ' + res.status + ': ' + err.slice(0, 300));
    if (res.status !== 404 && !/model/i.test(err)) break; // only retry on unknown-model
  }
  throw lastErr;
}

async function openaiChat(messages, system) {
  let lastErr;
  const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
  for (const model of MODELS.openai) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + state.keys.openai },
      body: JSON.stringify({ model, messages: msgs, max_tokens: 4000 })
    });
    if (res.ok) {
      const j = await res.json();
      return j.choices[0].message.content;
    }
    const err = await res.text();
    lastErr = new Error('ChatGPT error ' + res.status + ': ' + err.slice(0, 300));
    if (res.status !== 404) break;
  }
  throw lastErr;
}

async function geminiChat(messages, system) {
  let lastErr;
  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  for (const model of MODELS.gemini) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': state.keys.gemini },
      body: JSON.stringify({
        contents,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined
      })
    });
    if (res.ok) {
      const j = await res.json();
      return (((j.candidates || [])[0] || {}).content?.parts || []).map(p => p.text || '').join('');
    }
    const err = await res.text();
    lastErr = new Error('Gemini error ' + res.status + ': ' + err.slice(0, 300));
    // retired model (404), free-quota exhausted (429) or overloaded (503):
    // the next model in the list may still work
    if (![404, 429, 503].includes(res.status)) break;
  }
  throw lastErr;
}

// image generation: Gemini image model ("Nano Banana") or OpenAI images
async function aiImage(prompt) {
  if (state.keys.gemini) {
    let lastErr;
    for (const model of MODELS.geminiImage) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': state.keys.gemini },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (res.ok) {
        const j = await res.json();
        const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
        for (const p of parts) {
          if (p.inlineData && p.inlineData.data) return 'data:' + (p.inlineData.mimeType || 'image/png') + ';base64,' + p.inlineData.data;
        }
        throw new Error('Gemini returned no image — try rewording the description.');
      }
      const err = await res.text();
      lastErr = new Error('Gemini image error ' + res.status + ': ' + err.slice(0, 300));
      if (![404, 429, 503].includes(res.status)) break;
    }
    if (state.keys.openai) { /* fall through to OpenAI below */ } else throw lastErr;
  }
  if (state.keys.openai) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + state.keys.openai },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024' })
    });
    if (!res.ok) throw new Error('OpenAI image error ' + res.status + ': ' + (await res.text()).slice(0, 300));
    const j = await res.json();
    return 'data:image/png;base64,' + j.data[0].b64_json;
  }
  throw new Error('NO_KEY');
}

// ---------------- YouTube Data API layer ----------------
function hasYT() { return !!state.keys.youtube; }
async function yt(endpoint, params) {
  const q = new URLSearchParams({ ...params, key: state.keys.youtube });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${q}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error('YouTube API error ' + res.status + ': ' + err.slice(0, 300));
  }
  return res.json();
}
// accepts channel URL, @handle, channel ID, or video URL and resolves to a channel ID
async function resolveChannelId(input) {
  input = input.trim();
  let m = input.match(/(UC[\w-]{20,})/);
  if (m) return m[1];
  m = input.match(/@([\w.\-]+)/);
  if (m) {
    const j = await yt('channels', { part: 'id', forHandle: '@' + m[1] });
    if (j.items && j.items.length) return j.items[0].id;
    throw new Error('No channel found for handle @' + m[1]);
  }
  m = input.match(/(?:youtu\.be\/|watch\?v=|shorts\/)([\w-]{6,})/);
  if (m) {
    const j = await yt('videos', { part: 'snippet', id: m[1] });
    if (j.items && j.items.length) return j.items[0].snippet.channelId;
    throw new Error('Video not found');
  }
  // fall back to a channel search by name
  const j = await yt('search', { part: 'snippet', q: input, type: 'channel', maxResults: 1 });
  if (j.items && j.items.length) return j.items[0].snippet.channelId;
  throw new Error('Could not find a channel matching "' + input + '"');
}

// ---------------- Chat tool cards ----------------
const CHAT_TOOLS = [
  { id: 'chatgpt', name: 'ChatGPT', desc: 'Advanced conversational AI.', color: '#10a37f', letter: 'G', api: 'openai', url: 'https://chatgpt.com' },
  { id: 'claude', name: 'Claude', desc: "Anthropic's flagship AI.", color: '#d97757', letter: 'C', api: 'anthropic', url: 'https://claude.ai' },
  { id: 'gemini', name: 'Gemini', desc: "Google's powerful multimodal AI.", color: '#4f8cff', letter: 'G', api: 'gemini', url: 'https://gemini.google.com' },
  { id: 'notebooklm', name: 'NotebookLM', desc: 'AI-powered research assistant.', color: '#111', letter: 'N', api: null, url: 'https://notebooklm.google.com' },
  { id: 'aistudio', name: 'Google AI Studio', desc: 'App and website builder by Google.', color: '#1a73e8', letter: 'A', api: null, url: 'https://aistudio.google.com' },
  { id: 'antigravity', name: 'Google Antigravity', desc: "Google's app builder.", color: '#7b1fa2', letter: 'A', api: null, url: 'https://antigravity.google' },
  { id: 'nanobanana', name: 'Nano Banana', desc: 'AI-powered image generator.', color: '#f9ab00', letter: 'B', api: null, url: 'https://gemini.google.com' },
  { id: 'horizons', name: 'Horizons', desc: "Hostinger's AI app builder.", color: '#673de6', letter: 'H', api: null, url: 'https://www.hostinger.com/horizons' },
  { id: 'stitch', name: 'Google Stitch', desc: 'AI-powered app design tool.', color: '#0f9d58', letter: 'S', api: null, url: 'https://stitch.withgoogle.com' }
];

// ---------------- Generator tool definitions ----------------
const TOOLS = {
  'product-maker': {
    title: 'Product Maker', icon: '📦', usage: 'chat',
    intro: 'Create a complete <b>digital product blueprint</b> — title, outline, content plan, pricing and sales copy — ready to build and sell.',
    fields: [
      { id: 'type', label: 'Product type', type: 'select', options: ['eBook', 'Online course', 'Notion template', 'Digital planner / printable', 'Prompt pack', 'Spreadsheet / tracker', 'Checklist / toolkit'] },
      { id: 'niche', label: 'Niche or topic', type: 'text', ph: 'e.g. budgeting for young families, AI side hustles, dog training' },
      { id: 'audience', label: 'Who is it for?', type: 'text', ph: 'e.g. busy mums, beginner freelancers, college students' },
      { id: 'extra', label: 'Anything else? (optional)', type: 'text', ph: 'e.g. keep it beginner friendly, price under $20' }
    ],
    prompt: v => `You are an expert digital product creator. Create a complete, ready-to-build blueprint for a ${v.type} in the niche "${v.niche}" aimed at ${v.audience || 'a general audience'}. ${v.extra ? 'Extra requirements: ' + v.extra + '.' : ''}

Include, with clear headings:
1. Three title options (pick the best and say why)
2. One-sentence promise / hook
3. Full chapter-by-chapter or module-by-module outline with 2-3 bullet points each
4. A bonus item to increase perceived value
5. Recommended price and why
6. Short sales-page copy (headline, 3 benefit bullets, call to action)
7. First 3 steps to build it this week`
  },

  'prompt-maker': {
    title: 'Prompt Maker', icon: '✨', usage: 'prompts',
    intro: 'Turn a rough idea into a <b>professional, detailed prompt</b> that gets great results on the first try in ChatGPT, Claude or Gemini.',
    fields: [
      { id: 'goal', label: 'What do you want the AI to do?', type: 'textarea', ph: 'e.g. write an ebook chapter about meal prepping / design a logo / plan my TikTok content for a month' },
      { id: 'target', label: 'Which AI will you use it in?', type: 'select', options: ['Any', 'ChatGPT', 'Claude', 'Gemini', 'Image AI (Nano Banana / Midjourney)', 'Video AI (Veo / Sora)'] },
      { id: 'tone', label: 'Style / tone (optional)', type: 'text', ph: 'e.g. friendly, professional, luxury, playful' }
    ],
    prompt: v => `You are a world-class prompt engineer. Write ONE polished, copy-paste-ready prompt (not advice about prompts) that accomplishes this goal: "${v.goal}". Target AI: ${v.target}. ${v.tone ? 'Desired tone: ' + v.tone + '.' : ''}

The prompt you write must include: a role for the AI, full context, precise instructions, output format, constraints, and one example of the expected output style. Return ONLY the finished prompt inside a code block, followed by a 2-line tip on how to use it.`
  },

  'product-research': {
    title: 'Product Research', icon: '🔍', usage: 'chat',
    intro: 'Find <b>trending, in-demand product ideas</b> in any niche, with demand signals and validation steps before you build anything.',
    fields: [
      { id: 'niche', label: 'Niche or interest', type: 'text', ph: 'e.g. fitness, pets, personal finance, home organisation' },
      { id: 'platform', label: 'Where will you sell?', type: 'select', options: ['Digital products (Gumroad / Etsy digital)', 'Etsy (physical or printable)', 'Shopify / dropshipping', 'Amazon KDP', 'TikTok Shop', 'My own website'] },
      { id: 'budget', label: 'Budget / constraints (optional)', type: 'text', ph: 'e.g. no upfront cost, must be beginner friendly' }
    ],
    prompt: v => `You are a product research analyst for online sellers. Find 10 promising product ideas in the "${v.niche}" niche to sell via ${v.platform}. ${v.budget ? 'Constraints: ' + v.budget + '.' : ''}

For each idea give: name, one-line description, why demand exists right now (trend/search/social signal to check), target buyer, rough price point, difficulty (easy/medium/hard), and a 1-line differentiation angle. Then rank the top 3 and give a 5-step validation checklist the seller can do for free this week.`,
    links: [
      ['Google Trends', 'https://trends.google.com/trends/'],
      ['TikTok Creative Center', 'https://ads.tiktok.com/business/creativecenter/pc/en'],
      ['Etsy search', 'https://www.etsy.com/'],
      ['Exploding Topics', 'https://explodingtopics.com/']
    ]
  },

  'competitor-analyzer': {
    title: 'Competitor Analyzer', icon: '🎯', usage: 'competitor',
    intro: 'Break down <b>what a competitor is doing right</b> — their offer, pricing, marketing angles — and exactly how to differentiate.',
    fields: [
      { id: 'who', label: 'Competitor (URL, store or brand name)', type: 'text', ph: 'e.g. https://someshop.com or "The Budget Mom"' },
      { id: 'niche', label: 'Your niche / what you sell', type: 'text', ph: 'e.g. printable budget planners' },
      { id: 'focus', label: 'What do you want to learn? (optional)', type: 'text', ph: 'e.g. their pricing strategy, their best sellers, their ads' }
    ],
    prompt: v => `You are a competitive intelligence analyst for small online businesses. Analyze the competitor "${v.who}" from the perspective of someone selling ${v.niche}. ${v.focus ? 'Focus especially on: ' + v.focus + '.' : ''}

Provide, with clear headings:
1. What they sell and their likely best-sellers
2. Their positioning and who they target
3. Pricing strategy analysis
4. Marketing channels and angles they appear to use
5. Strengths to learn from
6. Weaknesses and gaps you can exploit
7. A concrete 5-point differentiation plan
If you don't have direct knowledge of them, reason from what businesses like this typically do and clearly say so, and list what the user should check manually on their site (with exactly what to look for).`
  },

  'store-finder': {
    title: 'Store Finder', icon: '🏪', usage: 'chat',
    intro: 'Find <b>successful stores in your niche</b> to study — using smart search shortcuts plus AI suggestions of stores worth analyzing.',
    fields: [
      { id: 'niche', label: 'Niche', type: 'text', ph: 'e.g. pet accessories, home gym, kids toys' },
      { id: 'platform', label: 'Store type', type: 'select', options: ['Shopify stores', 'Etsy shops', 'Any online store'] }
    ],
    prompt: v => `You are an e-commerce researcher. List 8 well-known, successful ${v.platform} in the "${v.niche}" niche that a beginner should study. For each: store name, what they sell, what makes them successful (offer, branding, marketing), and one specific thing to copy. If you're unsure a store still exists, say so. Finish with a checklist of 6 things to look at when studying any store in this niche.`,
    linksFn: v => [
      ['Google: Shopify stores in this niche', 'https://www.google.com/search?q=' + encodeURIComponent(`site:myshopify.com ${v.niche}`)],
      ['Google: "powered by shopify" + niche', 'https://www.google.com/search?q=' + encodeURIComponent(`"powered by shopify" ${v.niche}`)],
      ['Etsy search for this niche', 'https://www.etsy.com/search?q=' + encodeURIComponent(v.niche)],
      ['Myip.ms Shopify directory', 'https://myip.ms/browse/sites/1/ownerID/376714']
    ]
  },

  'image-maker': {
    title: 'Image Maker', icon: '🖼️', usage: 'chat',
    intro: 'Generate <b>on-brand images</b> for products, thumbnails, ads and social posts. With a Gemini or OpenAI key it creates the image right here; otherwise it builds you a perfect image prompt.',
    fields: [
      { id: 'desc', label: 'Describe the image', type: 'textarea', ph: 'e.g. a cozy flat-lay of a pastel budget planner on a desk with coffee and flowers, soft morning light' },
      { id: 'style', label: 'Style', type: 'select', options: ['Photorealistic', 'Clean product photo', '3D render', 'Flat illustration', 'Watercolor', 'Cinematic', 'Minimalist'] },
      { id: 'usefor', label: 'What is it for? (optional)', type: 'text', ph: 'e.g. Etsy listing photo, YouTube thumbnail, Instagram ad' }
    ],
    special: 'image'
  },

  'video-maker': {
    title: 'Video Maker', icon: '🎬', usage: 'chat',
    intro: 'Create <b>complete video packages</b>: script, scene-by-scene shot list, caption text and an AI-video prompt for Veo or Sora — perfect for faceless channels.',
    fields: [
      { id: 'topic', label: 'Video topic', type: 'text', ph: 'e.g. 5 AI side hustles you can start this weekend' },
      { id: 'platform', label: 'Platform', type: 'select', options: ['YouTube (long-form)', 'YouTube Shorts', 'TikTok', 'Instagram Reels'] },
      { id: 'style', label: 'Video style', type: 'select', options: ['Faceless voiceover + stock footage', 'AI-generated video (Veo/Sora)', 'Screen recording / tutorial', 'Slideshow with music'] },
      { id: 'length', label: 'Target length', type: 'select', options: ['30 seconds', '60 seconds', '3-5 minutes', '8-12 minutes'] }
    ],
    prompt: v => `You are a viral video producer. Create a complete production package for a ${v.length} ${v.platform} video: "${v.topic}", made in the style "${v.style}".

Include with headings:
1. Three hook options for the first 3 seconds (pick the strongest)
2. Full word-for-word script with timestamps
3. Scene-by-scene shot list (what's on screen for each line)
4. Text overlays / captions to add
5. If AI-generated video: a ready-to-paste prompt for Veo or Sora for each scene
6. Title options + description + hashtags optimised for the platform
7. A call to action that fits the topic`,
    links: [
      ['Google Veo (in Gemini)', 'https://gemini.google.com'],
      ['CapCut (free editor)', 'https://www.capcut.com/'],
      ['Pexels free stock video', 'https://www.pexels.com/videos/']
    ]
  },

  'ad-library': {
    title: 'Ad Library', icon: '📚', usage: 'chat',
    intro: 'Research <b>real ads that are running right now</b> in the official ad libraries, and generate winning ad angles for your own product.',
    fields: [
      { id: 'kw', label: 'Brand or keyword to research', type: 'text', ph: 'e.g. dog bed, budget planner, competitor brand name' },
      { id: 'product', label: 'Your product (for AI ad angles, optional)', type: 'text', ph: 'e.g. my printable meal planner for busy parents' }
    ],
    prompt: v => `You are a direct-response ad strategist. ${v.product ? `My product: ${v.product}.` : ''} I'm researching ads about "${v.kw}".

Give me:
1. The 5 most common winning ad angles used in this niche and why they work
2. Three complete ad scripts for my product (hook, body, CTA) in different angles: problem/solution, social proof, and curiosity
3. What to look for when I browse the Meta Ad Library and TikTok ads for "${v.kw}" (signs an ad is actually winning)
4. Three headline + primary-text combos ready to paste into an ad`,
    linksFn: v => [
      ['Meta (Facebook) Ad Library', 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=' + encodeURIComponent(v.kw || '')],
      ['TikTok Creative Center — Top Ads', 'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en'],
      ['Google Ads Transparency Center', 'https://adstransparency.google.com/?query=' + encodeURIComponent(v.kw || '')]
    ]
  },

  'website-maker': {
    title: 'Website Maker', icon: '🌐', usage: 'replication',
    intro: 'Build a <b>complete one-page website</b> for your product or store. With an AI key it designs a custom site; without one it still builds a clean site from a professional template. Preview it live and download the file.',
    fields: [
      { id: 'name', label: 'Business / product name', type: 'text', ph: 'e.g. The Calm Budget Co.' },
      { id: 'what', label: 'What do you sell / offer?', type: 'textarea', ph: 'e.g. printable budget planners that help young families save their first $5,000' },
      { id: 'colors', label: 'Colours / vibe', type: 'text', ph: 'e.g. soft pastel pink and cream, calm and friendly' },
      { id: 'cta', label: 'Main call to action', type: 'text', ph: 'e.g. Buy the planner — $12, Join the waitlist, Book a call' }
    ],
    special: 'website'
  },

  'faceless-finder': { title: 'Faceless Finder', icon: '🎭', usage: 'chat', special: 'faceless' }
};

// ---------------- Router ----------------
const ROUTE_TITLES = {
  chat: 'AI Chat', history: 'History', tutorial: 'Tutorial',
  'product-maker': 'Product Maker', 'prompt-maker': 'Prompt Maker', 'product-research': 'Product Research',
  'competitor-analyzer': 'Competitor Analyzer', 'store-finder': 'Store Finder', 'faceless-finder': 'Faceless Finder',
  'image-maker': 'Image Maker', 'video-maker': 'Video Maker', 'ad-library': 'Ad Library', 'website-maker': 'Website Maker'
};

function route() {
  const hash = location.hash.replace(/^#\//, '') || 'chat';
  const [page, arg] = hash.split('/');
  document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.route === page));
  $('#pageTitle').textContent = ROUTE_TITLES[page] || 'Maker Studio';
  toggleSidebar(false);
  const view = $('#view');
  view.scrollTop = 0;

  if (page === 'chat' && arg) return renderChatSession(arg);
  if (page === 'chat') return renderChatHome();
  if (page === 'history') return renderHistory();
  if (page === 'tutorial') return renderTutorial();
  if (TOOLS[page]) {
    if (TOOLS[page].special === 'faceless') return renderFaceless();
    return renderToolPage(page);
  }
  location.hash = '#/chat';
}
window.addEventListener('hashchange', route);

// ---------------- Sidebar widgets ----------------
function renderUsage() {
  ensureWeek();
  const box = $('#usageMeters');
  const upBtn = document.querySelector('.upgrade-btn');
  if (state.plan === 'unlimited') {
    $('#planLabel').textContent = 'Unlimited Plan';
    if (upBtn) upBtn.textContent = 'MANAGE';
    box.innerHTML = '<div class="usage-note" style="text-align:left">No limits — generate as much as you like. 🎉</div>';
  } else {
    $('#planLabel').textContent = 'Free Plan Usage';
    if (upBtn) upBtn.textContent = 'UPGRADE';
    box.innerHTML = Object.keys(LIMITS).map(cat => {
      const used = state.usage.counts[cat], max = LIMITS[cat];
      const pct = Math.min(100, (used / max) * 100);
      return `<div class="meter">
        <div class="m-row"><b>${METER_LABELS[cat]}</b><span>${used}/${max}</span></div>
        <div class="m-bar"><div class="m-fill ${used >= max ? 'full' : ''}" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }
  $('#footPlan').textContent = state.plan === 'unlimited' ? 'Unlimited Plan' : 'Free Plan';
  $('#footName').textContent = state.name || 'You';
  $('#avatarInitial').textContent = (state.name || 'Y')[0].toUpperCase();
}

function renderRecent() {
  const box = $('#recentChats');
  if (!state.chats.length) { box.innerHTML = '<div class="recent-empty">No chats yet — start one from the Chat page.</div>'; return; }
  box.innerHTML = state.chats.slice(0, 8).map(c =>
    `<div class="recent-item" onclick="location.hash='#/chat/${c.id}'">💬 <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.title)}</span>
     <span class="rc-x" onclick="event.stopPropagation();deleteChat('${c.id}')">✕</span></div>`
  ).join('');
}
function deleteChat(id) {
  state.chats = state.chats.filter(c => c.id !== id);
  saveState(); renderRecent();
  if (location.hash === '#/chat/' + id) location.hash = '#/chat';
  toast('Chat deleted');
}

function renderKeyStatus() {
  const el = $('#keyStatus');
  const p = activeProvider();
  const bits = [];
  if (p) bits.push('AI: ' + providerName(p));
  if (hasYT()) bits.push('YouTube ✓');
  if (bits.length) { el.textContent = bits.join(' · '); el.classList.add('ok'); }
  else { el.textContent = 'No API key — prompt mode'; el.classList.remove('ok'); }
}

// ---------------- Chat pages ----------------
function renderChatHome() {
  const view = $('#view');
  view.innerHTML = `<div class="page">
    <p class="page-intro">Pick an AI to chat with. <b>ChatGPT, Claude and Gemini</b> open a chat right here inside the app when you've added their API key in Settings — otherwise they open in a new tab. The other tools always open their official site.</p>
    <div class="card-grid">
      ${CHAT_TOOLS.map(t => `
        <div class="tool-card">
          <div class="tc-logo" style="background:${t.color}">${t.letter}</div>
          <h3>${t.name}</h3>
          <p>${t.desc}</p>
          <button class="btn primary small" onclick="selectChatTool('${t.id}')">Select Tool</button>
        </div>`).join('')}
    </div>
  </div>`;
}

function selectChatTool(id) {
  const t = CHAT_TOOLS.find(x => x.id === id);
  if (t.api && state.keys[t.api]) {
    const chat = { id: Date.now().toString(36), title: 'New chat — ' + t.name, provider: t.api, messages: [] };
    state.chats.unshift(chat);
    saveState(); renderRecent();
    location.hash = '#/chat/' + chat.id;
  } else if (t.api) {
    if (confirm(t.name + ' can chat right inside this app if you add its API key in Settings.\n\nPress OK to open Settings, or Cancel to just open ' + t.name + ' in a new tab.')) {
      openSettings('keys');
    } else {
      window.open(t.url, '_blank');
    }
  } else {
    window.open(t.url, '_blank');
    toast('Opening ' + t.name + ' in a new tab');
  }
}

function renderChatSession(id) {
  const chat = state.chats.find(c => c.id === id);
  if (!chat) { location.hash = '#/chat'; return; }
  const view = $('#view');
  view.innerHTML = `<div class="chat-shell">
    <div class="chat-provider-tag">Chatting with <b>${providerName(chat.provider)}</b> — messages count toward your weekly AI Chat limit. <a href="#/chat" style="color:var(--accent2)">← all AI tools</a></div>
    <div class="chat-msgs" id="chatMsgs">
      ${chat.messages.length ? chat.messages.map(m => `<div class="msg ${m.role === 'user' ? 'user' : 'ai'}">${mdLite(m.content)}</div>`).join('') : '<div class="recent-empty" style="padding:20px 4px">Say hello — ask anything, or paste a prompt from the Prompt Maker.</div>'}
    </div>
    <div class="chat-input-row">
      <textarea id="chatInput" placeholder="Type your message… (Enter to send, Shift+Enter for a new line)"></textarea>
      <button class="btn primary" id="chatSend">Send</button>
    </div>
  </div>`;
  const input = $('#chatInput');
  const send = () => sendChatMessage(id);
  $('#chatSend').onclick = send;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  const msgs = $('#chatMsgs'); msgs.scrollTop = msgs.scrollHeight;
  input.focus();
}

async function sendChatMessage(id) {
  const chat = state.chats.find(c => c.id === id);
  const input = $('#chatInput');
  const text = input.value.trim();
  if (!text || !chat) return;
  if (creditsLeft('chat') <= 0) { toast('Weekly AI Chat limit reached — resets Monday (or switch to Unlimited in Settings).'); return; }
  if (!state.keys[chat.provider]) { toast('Add your ' + providerName(chat.provider) + ' API key in Settings first.'); openSettings('keys'); return; }

  chat.messages.push({ role: 'user', content: text });
  if (chat.messages.length === 1) chat.title = text.slice(0, 42) + (text.length > 42 ? '…' : '');
  saveState(); renderRecent();
  input.value = '';
  const msgs = $('#chatMsgs');
  msgs.insertAdjacentHTML('beforeend', `<div class="msg user">${mdLite(text)}</div><div class="msg ai" id="pendingMsg"><span class="spinner"></span></div>`);
  msgs.scrollTop = msgs.scrollHeight;
  $('#chatSend').disabled = true;

  try {
    const saved = state.provider; state.provider = chat.provider; // pin to this chat's provider
    let reply;
    try { reply = await aiChat(chat.messages, 'You are a helpful, expert assistant inside Maker Studio, an app for building digital products and online businesses. Be practical and concrete.'); }
    finally { state.provider = saved; }
    chat.messages.push({ role: 'assistant', content: reply });
    useCredit('chat');
    saveState();
    const pend = $('#pendingMsg'); if (pend) { pend.innerHTML = mdLite(reply); pend.removeAttribute('id'); }
  } catch (e) {
    const pend = $('#pendingMsg'); if (pend) { pend.classList.add('err'); pend.innerHTML = esc(prettyError(e)); pend.removeAttribute('id'); }
  }
  const btn = $('#chatSend'); if (btn) btn.disabled = false;
  msgs.scrollTop = msgs.scrollHeight;
}

function prettyError(e) {
  const m = String(e && e.message || e);
  if (m === 'NO_KEY') return 'No API key set — open Settings and add one.';
  if (/401|403|invalid|authentication/i.test(m)) return 'The API key was rejected — double-check it in Settings. (' + m.slice(0, 120) + ')';
  if (/429|rate|quota|billing|credit/i.test(m)) return 'The AI provider says you are out of quota or rate-limited. Check your provider account. (' + m.slice(0, 120) + ')';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Could not reach the AI provider — check your internet connection.';
  return m.slice(0, 300);
}

// ---------------- Generic tool pages ----------------
function renderToolPage(toolId) {
  const t = TOOLS[toolId];
  const view = $('#view');
  const modeNote = hasAI()
    ? `<div class="notice">✅ <b>AI mode</b> — results are generated right here using ${providerName(activeProvider())}.</div>`
    : `<div class="notice warn">🔑 <b>Prompt mode</b> — no API key yet, so this tool will build you a perfect expert prompt to paste into free ChatGPT, Claude or Gemini. Add a key in <a href="javascript:openSettings('keys')">Settings</a> to generate results directly in the app.</div>`;

  view.innerHTML = `<div class="page">
    <p class="page-intro">${t.intro}</p>
    ${modeNote}
    <div class="form-card">
      ${t.fields.map(f => renderField(f)).join('')}
      <div class="btn-row">
        <button class="btn primary" id="runBtn" onclick="runTool('${toolId}')">${t.special === 'image' ? '🖼️ Generate Image' : t.special === 'website' ? '🌐 Build My Website' : '✨ Generate'}</button>
        ${t.usage !== 'chat' || state.plan !== 'unlimited' ? `<span style="font-size:12px;color:var(--muted);align-self:center">Uses 1 ${METER_LABELS[t.usage]} credit${state.plan === 'unlimited' ? ' (unlimited)' : ''}</span>` : ''}
      </div>
    </div>
    <div id="toolResult"></div>
  </div>`;
}

function renderField(f) {
  if (f.type === 'select') {
    return `<label>${f.label}<select id="f_${f.id}">${f.options.map(o => `<option>${esc(o)}</option>`).join('')}</select></label>`;
  }
  if (f.type === 'textarea') {
    return `<label>${f.label}<textarea id="f_${f.id}" placeholder="${esc(f.ph || '')}"></textarea></label>`;
  }
  return `<label>${f.label}<input type="text" id="f_${f.id}" placeholder="${esc(f.ph || '')}"></label>`;
}
function fieldValues(t) {
  const v = {};
  t.fields.forEach(f => v[f.id] = ($('#f_' + f.id) || {}).value?.trim() || '');
  return v;
}
function quickLinksHTML(t, v) {
  const links = t.linksFn ? t.linksFn(v) : t.links;
  if (!links) return '';
  return `<div class="quick-links">${links.map(([label, url]) => `<a class="btn small" href="${esc(url)}" target="_blank" rel="noopener">↗ ${esc(label)}</a>`).join('')}</div>`;
}

async function runTool(toolId) {
  const t = TOOLS[toolId];
  const v = fieldValues(t);
  const required = t.fields.find(f => !f.label.includes('optional') && !v[f.id] && f.type !== 'select');
  if (required) { toast('Please fill in: ' + required.label.replace(/\(.*\)/, '').trim()); return; }

  const out = $('#toolResult');

  if (t.special === 'image') return runImageMaker(v, out);
  if (t.special === 'website') return runWebsiteMaker(v, out);

  const prompt = t.prompt(v);

  // No key → prompt mode: hand them the expert prompt + where to paste it
  if (!hasAI()) {
    out.innerHTML = `<div class="result-wrap">
      <div class="result-head"><h3>📋 Your expert prompt is ready — paste it into any free AI</h3>
        <button class="btn small primary" onclick="copyLastPrompt()">Copy Prompt</button></div>
      <div class="result-box" id="promptBox">${esc(prompt)}</div>
      <div class="quick-links">
        <a class="btn small" href="https://chatgpt.com" target="_blank" rel="noopener">↗ Open ChatGPT</a>
        <a class="btn small" href="https://claude.ai" target="_blank" rel="noopener">↗ Open Claude</a>
        <a class="btn small" href="https://gemini.google.com" target="_blank" rel="noopener">↗ Open Gemini</a>
      </div>
      ${quickLinksHTML(t, v)}
    </div>`;
    window._lastPrompt = prompt;
    saveHistory(toolId, t.title + ' prompt: ' + (v.niche || v.goal || v.kw || v.topic || v.who || '').slice(0, 40), prompt);
    return;
  }

  if (creditsLeft(t.usage) <= 0) {
    toast(`Weekly ${METER_LABELS[t.usage]} limit reached — resets Monday, or switch to Unlimited in Settings.`);
    return;
  }

  out.innerHTML = `<div class="loading-line"><span class="spinner"></span> ${providerName(activeProvider())} is working on it…</div>`;
  $('#runBtn').disabled = true;
  try {
    const text = await aiGenerate(prompt, 'You are an expert assistant inside Maker Studio, an app for building digital products and online businesses. Be specific, practical and complete. Use clear headings.');
    useCredit(t.usage);
    const title = t.title + ': ' + (v.niche || v.goal || v.kw || v.topic || v.who || v.type || 'result').slice(0, 40);
    saveHistory(toolId, title, text);
    out.innerHTML = `<div class="result-wrap">
      <div class="result-head"><h3>${t.icon} Result</h3>
        <button class="btn small primary" onclick="copyResultText()">Copy</button></div>
      <div class="result-box" id="resultBox">${mdLite(text)}</div>
      ${quickLinksHTML(t, v)}
    </div>`;
    window._lastResult = text;
  } catch (e) {
    out.innerHTML = `<div class="notice warn">⚠️ ${esc(prettyError(e))}</div>`;
  }
  const btn = $('#runBtn'); if (btn) btn.disabled = false;
}
function copyLastPrompt() { copyText(window._lastPrompt || '', 'Prompt copied — paste it into ChatGPT, Claude or Gemini ✓'); }
function copyResultText() { copyText(window._lastResult || '', 'Result copied ✓'); }

// ---------------- Image maker ----------------
async function runImageMaker(v, out) {
  const fullPrompt = `${v.desc}. Style: ${v.style}.${v.usefor ? ' Intended use: ' + v.usefor + '.' : ''} High quality, well-composed, no text unless asked.`;
  const canImage = state.keys.gemini || state.keys.openai;

  if (!canImage) {
    out.innerHTML = `<div class="result-wrap">
      <div class="result-head"><h3>📋 Your image prompt is ready</h3>
        <button class="btn small primary" onclick="copyLastPrompt()">Copy Prompt</button></div>
      <div class="result-box">${esc(fullPrompt)}</div>
      <div class="notice" style="margin-top:12px">Paste this into <b>Nano Banana</b> (inside Gemini), ChatGPT, or any image AI. To generate images directly inside this app, add a <b>Gemini</b> or <b>OpenAI</b> key in Settings — Gemini's key has a free tier.</div>
      <div class="quick-links">
        <a class="btn small" href="https://gemini.google.com" target="_blank" rel="noopener">↗ Open Gemini (Nano Banana)</a>
        <a class="btn small" href="https://aistudio.google.com" target="_blank" rel="noopener">↗ Open Google AI Studio</a>
      </div>
    </div>`;
    window._lastPrompt = fullPrompt;
    saveHistory('image-maker', 'Image prompt: ' + v.desc.slice(0, 40), fullPrompt);
    return;
  }

  if (creditsLeft('chat') <= 0) { toast('Weekly limit reached — resets Monday, or go Unlimited in Settings.'); return; }
  out.innerHTML = `<div class="loading-line"><span class="spinner"></span> Generating your image… (10–30 seconds)</div>`;
  $('#runBtn').disabled = true;
  try {
    const dataUrl = await aiImage(fullPrompt);
    useCredit('chat');
    saveHistory('image-maker', 'Image: ' + v.desc.slice(0, 40), fullPrompt, { image: true });
    out.innerHTML = `<div class="result-wrap">
      <div class="result-head"><h3>🖼️ Your image</h3>
        <a class="btn small primary" href="${dataUrl}" download="maker-studio-image.png">⬇ Download</a></div>
      <img class="img-result" src="${dataUrl}" alt="Generated image">
    </div>`;
  } catch (e) {
    out.innerHTML = `<div class="notice warn">⚠️ ${esc(prettyError(e))}</div>`;
  }
  const btn = $('#runBtn'); if (btn) btn.disabled = false;
}

// ---------------- Website maker ----------------
async function runWebsiteMaker(v, out) {
  let html;
  if (hasAI()) {
    if (creditsLeft('replication') <= 0) { toast('Weekly Replication limit reached — resets Monday, or go Unlimited in Settings.'); return; }
    out.innerHTML = `<div class="loading-line"><span class="spinner"></span> ${providerName(activeProvider())} is designing your website… (up to a minute)</div>`;
    $('#runBtn').disabled = true;
    try {
      const raw = await aiGenerate(
        `Create a complete, beautiful, single-file HTML landing page (all CSS inline in a <style> tag, no external files, no JavaScript required) for this business:
Name: ${v.name}
What they sell/offer: ${v.what}
Colours/vibe: ${v.colors || 'modern, clean'}
Main call to action: ${v.cta || 'Get started'}
Requirements: hero section with headline + CTA button, 3 benefit cards, an about/how-it-works section, a testimonial placeholder, a final CTA section, footer. Mobile responsive. Tasteful, modern design that matches the requested vibe. Return ONLY the raw HTML document, starting with <!DOCTYPE html>, with no explanation and no markdown fences.`,
        'You are a senior web designer. Output only raw HTML.');
      html = raw.replace(/^```html?\s*/i, '').replace(/```\s*$/, '').trim();
      if (!/<html/i.test(html)) throw new Error('The AI did not return a valid page — try again.');
      useCredit('replication');
    } catch (e) {
      out.innerHTML = `<div class="notice warn">⚠️ ${esc(prettyError(e))}</div>`;
      $('#runBtn').disabled = false;
      return;
    }
    $('#runBtn').disabled = false;
  } else {
    html = localSiteTemplate(v); // no key needed — built-in template
  }

  window._lastSite = html;
  const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  saveHistory('website-maker', 'Website: ' + v.name, html);
  out.innerHTML = `<div class="result-wrap">
    <div class="result-head"><h3>🌐 Your website is ready</h3>
      <a class="btn small primary" href="${blobUrl}" download="${esc((v.name || 'my-site').toLowerCase().replace(/[^a-z0-9]+/g, '-'))}.html">⬇ Download HTML</a>
      <a class="btn small" href="${blobUrl}" target="_blank" rel="noopener">↗ Open full size</a>
      <button class="btn small" onclick="copyText(window._lastSite,'Website HTML copied ✓')">Copy HTML</button></div>
    <iframe class="site-preview" src="${blobUrl}" title="Website preview"></iframe>
    <div class="notice" style="margin-top:12px"><b>To put it online free:</b> upload the downloaded file to <a href="https://app.netlify.com/drop" target="_blank" rel="noopener">Netlify Drop</a> (drag &amp; drop, no account needed to try) — or use it as the brief for Hostinger Horizons / Google AI Studio.</div>
  </div>`;
  if (!hasAI()) out.insertAdjacentHTML('afterbegin', `<div class="notice">Built with the offline template (no API key). Add an AI key in Settings for a fully custom design.</div>`);
}

function localSiteTemplate(v) {
  const name = esc(v.name || 'My Business');
  const what = esc(v.what || 'Something wonderful.');
  const cta = esc(v.cta || 'Get Started');
  const vibe = (v.colors || '').toLowerCase();
  let a = '#7c5cff', b = '#4f8cff', bg = '#0f1018', card = '#181a26', tx = '#eef0f8';
  if (/pink|pastel|blush/.test(vibe)) { a = '#f472b6'; b = '#c084fc'; bg = '#fff7fa'; card = '#ffffff'; tx = '#3b3341'; }
  else if (/green|nature|earth/.test(vibe)) { a = '#34d399'; b = '#10b981'; bg = '#f6fdf9'; card = '#ffffff'; tx = '#1f3d31'; }
  else if (/warm|orange|sun/.test(vibe)) { a = '#fb923c'; b = '#f59e0b'; bg = '#fffaf4'; card = '#ffffff'; tx = '#452b12'; }
  else if (/light|white|clean|minimal/.test(vibe)) { a = '#6366f1'; b = '#8b5cf6'; bg = '#fafafc'; card = '#ffffff'; tx = '#26283a'; }
  const light = card === '#ffffff';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;background:${bg};color:${tx};line-height:1.6}
.wrap{max-width:1000px;margin:0 auto;padding:0 22px}
header{padding:18px 0}nav{display:flex;justify-content:space-between;align-items:center}
.logo{font-weight:800;font-size:20px;background:linear-gradient(135deg,${a},${b});-webkit-background-clip:text;background-clip:text;color:transparent}
.hero{text-align:center;padding:90px 0 70px}
.hero h1{font-size:clamp(30px,5vw,52px);line-height:1.15;margin-bottom:18px}
.hero p{font-size:18px;opacity:.8;max-width:620px;margin:0 auto 30px}
.cta{display:inline-block;background:linear-gradient(135deg,${a},${b});color:#fff;text-decoration:none;font-weight:700;padding:15px 34px;border-radius:12px;box-shadow:0 10px 30px ${a}55}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;padding:30px 0 70px}
.card{background:${card};border:1px solid ${light ? '#eee4f2' : '#262a3d'};border-radius:16px;padding:26px;box-shadow:0 6px 24px rgba(0,0,0,.06)}
.card h3{margin-bottom:8px}.card p{font-size:14.5px;opacity:.75}
.sec{padding:60px 0;text-align:center}.sec h2{font-size:30px;margin-bottom:12px}.sec p{max-width:640px;margin:0 auto;opacity:.8}
.quote{font-style:italic;font-size:19px;max-width:560px;margin:26px auto 8px}
footer{padding:34px 0;text-align:center;font-size:13px;opacity:.6;border-top:1px solid ${light ? '#eee' : '#262a3d'};margin-top:40px}
</style></head><body>
<header class="wrap"><nav><span class="logo">${name}</span><a class="cta" style="padding:10px 20px;font-size:14px" href="#get">${cta}</a></nav></header>
<section class="hero wrap"><h1>${name}</h1><p>${what}</p><a class="cta" href="#get">${cta} →</a></section>
<section class="cards wrap">
<div class="card"><h3>✨ Made for you</h3><p>${what}</p></div>
<div class="card"><h3>⚡ Instant access</h3><p>Get everything the moment you join — no waiting, no complicated setup.</p></div>
<div class="card"><h3>💛 Loved by customers</h3><p>Join a growing community of happy customers who took the first step.</p></div>
</section>
<section class="sec wrap"><h2>How it works</h2><p>1. Click ${cta}. &nbsp; 2. Get instant access. &nbsp; 3. See the results for yourself.</p>
<p class="quote">“Exactly what I needed — simple, beautiful and it just works.”</p><p style="font-size:13px;opacity:.6">— A happy customer</p></section>
<section class="sec wrap" id="get"><h2>Ready to start?</h2><p style="margin-bottom:26px">${what}</p><a class="cta" href="#">${cta}</a></section>
<footer class="wrap">© ${new Date().getFullYear()} ${name}. All rights reserved.</footer>
</body></html>`;
}

// ---------------- Faceless Finder (with real YouTube data) ----------------
function renderFaceless() {
  const view = $('#view');
  const ytNote = hasYT()
    ? `<div class="notice">✅ <b>YouTube connected</b> — searches use live data from the official YouTube API.</div>`
    : `<div class="notice warn">🔗 <b>Connect YouTube for live data.</b> Add a free YouTube Data API key in <a href="javascript:openSettings('keys')">Settings</a> and this tool searches <b>real channels with live subscriber &amp; view counts</b>. (How to get the key: see the <a href="#/tutorial">Tutorial</a>, step 3.) Without it you still get AI niche research below.</div>`;

  view.innerHTML = `<div class="page">
    <p class="page-intro">Find and study <b>faceless channels</b> — channels that earn views without showing a face. Search real channels by niche, or paste any channel to analyze what makes it work.</p>
    ${ytNote}

    <div class="form-card">
      <h3 style="font-size:15px;margin-bottom:14px">🔎 Find channels in a niche</h3>
      <label>Niche or topic
        <input type="text" id="ff_niche" placeholder="e.g. space facts, luxury lifestyle, AI news, relaxing music, finance tips">
      </label>
      <div class="btn-row">
        <button class="btn primary" onclick="facelessSearch()">${hasYT() ? '🔴 Search real YouTube channels' : '✨ Research this niche with AI'}</button>
        <a class="btn" id="ffYtLink" href="#" target="_blank" rel="noopener" onclick="this.href='https://www.youtube.com/results?search_query='+encodeURIComponent(document.getElementById('ff_niche').value)">↗ Search on YouTube.com</a>
      </div>
    </div>

    <div class="form-card">
      <h3 style="font-size:15px;margin-bottom:14px">📊 Analyze a specific channel</h3>
      <label>Channel link, @handle, channel ID, or a video link from the channel
        <input type="text" id="ff_channel" placeholder="e.g. https://www.youtube.com/@somechannel or UCLI_f0zfE2Q9EWoJe_cAwRw">
      </label>
      <div class="btn-row">
        <button class="btn primary" onclick="facelessAnalyze()" ${hasYT() ? '' : 'disabled title="Needs the YouTube API key — see Settings"'}>📈 Analyze channel</button>
        ${hasYT() ? '' : '<span style="font-size:12px;color:var(--muted);align-self:center">Requires the free YouTube API key (Settings → YouTube Connection)</span>'}
      </div>
    </div>

    <div id="toolResult"></div>
  </div>`;
}

async function facelessSearch() {
  const niche = $('#ff_niche').value.trim();
  if (!niche) { toast('Type a niche first'); return; }
  const out = $('#toolResult');

  if (hasYT()) {
    out.innerHTML = `<div class="loading-line"><span class="spinner"></span> Searching YouTube for "${esc(niche)}" channels…</div>`;
    try {
      const search = await yt('search', { part: 'snippet', q: niche + ' faceless OR compilation OR facts OR narration', type: 'channel', maxResults: '10' });
      const ids = (search.items || []).map(i => i.snippet.channelId).join(',');
      if (!ids) { out.innerHTML = '<div class="notice warn">No channels found — try different words.</div>'; return; }
      const chans = await yt('channels', { part: 'snippet,statistics', id: ids });
      const items = (chans.items || []).sort((a, b) => (b.statistics.subscriberCount || 0) - (a.statistics.subscriberCount || 0));
      out.innerHTML = `<div class="result-wrap"><div class="result-head"><h3>🔴 Live results from YouTube — "${esc(niche)}"</h3></div>
        <div class="card-grid">${items.map(c => `
          <div class="tool-card">
            <div class="tc-logo" style="background:#c00">▶</div>
            <h3>${esc(c.snippet.title)}</h3>
            <p>${esc((c.snippet.description || '').slice(0, 110))}${(c.snippet.description || '').length > 110 ? '…' : ''}</p>
            <p style="color:var(--text);font-size:13px"><b>${fmtNum(c.statistics.subscriberCount)}</b> subs · <b>${fmtNum(c.statistics.viewCount)}</b> views · ${fmtNum(c.statistics.videoCount)} videos</p>
            <div class="btn-row">
              <a class="btn small" href="https://www.youtube.com/channel/${c.id}" target="_blank" rel="noopener">↗ Visit</a>
              <button class="btn small primary" onclick="document.getElementById('ff_channel').value='${c.id}';facelessAnalyze()">Analyze</button>
            </div>
          </div>`).join('')}</div></div>`;
      saveHistory('faceless-finder', 'Channel search: ' + niche, items.map(c => `${c.snippet.title} — ${fmtNum(c.statistics.subscriberCount)} subs — youtube.com/channel/${c.id}`).join('\n'));
    } catch (e) {
      out.innerHTML = `<div class="notice warn">⚠️ ${esc(prettyError(e))}</div>`;
    }
    return;
  }

  // AI / prompt fallback
  const prompt = `You are a faceless-channel strategist. For the niche "${niche}", list 8 faceless YouTube channel concepts. For each: channel name idea, exact content format (e.g. voiceover + stock footage, AI images slideshow, screen recordings), 3 example video titles, tools needed (free options first), monetisation path, and difficulty. Then rank the top 3 for a beginner and outline the first 5 videos to make for #1.`;
  if (hasAI()) {
    if (creditsLeft('chat') <= 0) { toast('Weekly limit reached — resets Monday, or go Unlimited in Settings.'); return; }
    out.innerHTML = `<div class="loading-line"><span class="spinner"></span> Researching faceless niches…</div>`;
    try {
      const text = await aiGenerate(prompt, 'You are an expert on faceless content channels. Be specific and practical.');
      useCredit('chat');
      saveHistory('faceless-finder', 'Faceless niche research: ' + niche, text);
      window._lastResult = text;
      out.innerHTML = `<div class="result-wrap"><div class="result-head"><h3>🎭 Faceless channel research</h3>
        <button class="btn small primary" onclick="copyResultText()">Copy</button></div>
        <div class="result-box">${mdLite(text)}</div></div>`;
    } catch (e) { out.innerHTML = `<div class="notice warn">⚠️ ${esc(prettyError(e))}</div>`; }
  } else {
    window._lastPrompt = prompt;
    saveHistory('faceless-finder', 'Faceless prompt: ' + niche, prompt);
    out.innerHTML = `<div class="result-wrap"><div class="result-head"><h3>📋 Your research prompt is ready</h3>
      <button class="btn small primary" onclick="copyLastPrompt()">Copy Prompt</button></div>
      <div class="result-box">${esc(prompt)}</div>
      <div class="quick-links">
        <a class="btn small" href="https://chatgpt.com" target="_blank" rel="noopener">↗ Open ChatGPT</a>
        <a class="btn small" href="https://claude.ai" target="_blank" rel="noopener">↗ Open Claude</a>
        <a class="btn small" href="https://gemini.google.com" target="_blank" rel="noopener">↗ Open Gemini</a>
      </div></div>`;
  }
}

async function facelessAnalyze() {
  const input = $('#ff_channel').value.trim();
  if (!input) { toast('Paste a channel link or ID first'); return; }
  if (!hasYT()) { toast('Add your YouTube API key in Settings first'); openSettings('keys'); return; }
  const out = $('#toolResult');
  out.innerHTML = `<div class="loading-line"><span class="spinner"></span> Pulling live channel data from YouTube…</div>`;
  try {
    const chId = await resolveChannelId(input);
    const cj = await yt('channels', { part: 'snippet,statistics,contentDetails', id: chId });
    const c = (cj.items || [])[0];
    if (!c) throw new Error('Channel not found');
    const uploads = c.contentDetails.relatedPlaylists.uploads;
    const pj = await yt('playlistItems', { part: 'contentDetails,snippet', playlistId: uploads, maxResults: '12' });
    const vidIds = (pj.items || []).map(i => i.contentDetails.videoId).join(',');
    const vj = vidIds ? await yt('videos', { part: 'snippet,statistics', id: vidIds }) : { items: [] };
    const vids = vj.items || [];

    const totalViews = vids.reduce((s, v0) => s + Number(v0.statistics.viewCount || 0), 0);
    const avgViews = vids.length ? Math.round(totalViews / vids.length) : 0;
    const dates = (pj.items || []).map(i => new Date(i.contentDetails.videoPublishedAt || i.snippet.publishedAt)).sort((a, b) => a - b);
    let perWeek = '—';
    if (dates.length > 1) {
      const spanDays = (dates[dates.length - 1] - dates[0]) / 864e5;
      if (spanDays > 0) perWeek = ((dates.length - 1) / (spanDays / 7)).toFixed(1);
    }

    const statsText =
      `Channel: ${c.snippet.title}
Subscribers: ${fmtNum(c.statistics.subscriberCount)} | Total views: ${fmtNum(c.statistics.viewCount)} | Videos: ${fmtNum(c.statistics.videoCount)}
Recent uploads/week: ${perWeek} | Avg views (last ${vids.length}): ${fmtNum(avgViews)}
Recent videos:
${vids.map(v0 => `- "${v0.snippet.title}" — ${fmtNum(v0.statistics.viewCount)} views`).join('\n')}`;

    let aiBlock = '';
    if (hasAI() && creditsLeft('chat') > 0) {
      try {
        const analysis = await aiGenerate(
          `Here is live data for a YouTube channel:\n\n${statsText}\n\nAnalyze it for someone who wants to build a similar (possibly faceless) channel: 1) What's their content formula (topics, title patterns, hooks)? 2) What performs best and why? 3) Posting cadence verdict. 4) A concrete plan to replicate the winning pattern with a differentiation twist — first 5 video ideas with titles. Be specific.`,
          'You are a YouTube growth strategist.');
        useCredit('chat');
        aiBlock = `<div class="result-head" style="margin-top:18px"><h3>🧠 AI breakdown</h3><button class="btn small primary" onclick="copyResultText()">Copy</button></div><div class="result-box">${mdLite(analysis)}</div>`;
        window._lastResult = analysis;
        saveHistory('faceless-finder', 'Channel analysis: ' + c.snippet.title, statsText + '\n\n--- AI BREAKDOWN ---\n' + analysis);
      } catch (e) { aiBlock = `<div class="notice warn" style="margin-top:14px">AI breakdown failed: ${esc(prettyError(e))}</div>`; }
    } else {
      saveHistory('faceless-finder', 'Channel analysis: ' + c.snippet.title, statsText);
      if (!hasAI()) aiBlock = `<div class="notice" style="margin-top:14px">Add an AI key in Settings to also get an automatic strategy breakdown of this data.</div>`;
    }

    out.innerHTML = `<div class="result-wrap">
      <div class="result-head"><h3>📈 ${esc(c.snippet.title)} — live stats</h3>
        <a class="btn small" href="https://www.youtube.com/channel/${c.id}" target="_blank" rel="noopener">↗ Open channel</a></div>
      <div class="card-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        <div class="tool-card"><p>Subscribers</p><h3>${fmtNum(c.statistics.subscriberCount)}</h3></div>
        <div class="tool-card"><p>Total views</p><h3>${fmtNum(c.statistics.viewCount)}</h3></div>
        <div class="tool-card"><p>Videos</p><h3>${fmtNum(c.statistics.videoCount)}</h3></div>
        <div class="tool-card"><p>Uploads / week</p><h3>${perWeek}</h3></div>
        <div class="tool-card"><p>Avg recent views</p><h3>${fmtNum(avgViews)}</h3></div>
      </div>
      <div class="result-head" style="margin-top:18px"><h3>Latest videos</h3></div>
      <div class="result-box">${vids.map(v0 => `▶ ${esc(v0.snippet.title)} — <b>${fmtNum(v0.statistics.viewCount)}</b> views`).join('<br>')}</div>
      ${aiBlock}
    </div>`;
  } catch (e) {
    out.innerHTML = `<div class="notice warn">⚠️ ${esc(prettyError(e))}</div>`;
  }
}

// ---------------- History ----------------
const TOOL_ICONS = { 'product-maker': '📦', 'prompt-maker': '✨', 'product-research': '🔍', 'competitor-analyzer': '🎯', 'store-finder': '🏪', 'faceless-finder': '🎭', 'image-maker': '🖼️', 'video-maker': '🎬', 'ad-library': '📚', 'website-maker': '🌐', chat: '💬' };

function renderHistory() {
  const view = $('#view');
  if (!state.history.length) {
    view.innerHTML = `<div class="page"><p class="page-intro">Everything you generate is saved here automatically, on your own computer.</p>
      <div class="notice">Nothing here yet — go make something! Try the <a href="#/product-maker">Product Maker</a>.</div></div>`;
    return;
  }
  view.innerHTML = `<div class="page">
    <p class="page-intro">Everything you've generated, newest first. Click any item to view and copy it. <button class="btn small danger" style="margin-left:8px" onclick="clearHistory()">Clear all</button></p>
    ${state.history.map(h => `
      <div class="hist-item" onclick="openViewer('${h.id}')">
        <span class="h-ic">${TOOL_ICONS[h.tool] || '📄'}</span>
        <div class="h-main"><strong>${esc(h.title)}</strong><span>${new Date(h.date).toLocaleString()}</span></div>
        <button class="h-del" onclick="event.stopPropagation();deleteHistory('${h.id}')" title="Delete">🗑</button>
      </div>`).join('')}
  </div>`;
}
function deleteHistory(id) { state.history = state.history.filter(h => h.id !== id); saveState(); renderHistory(); toast('Deleted'); }
function clearHistory() { if (confirm('Delete ALL history items? This cannot be undone.')) { state.history = []; saveState(); renderHistory(); toast('History cleared'); } }

function openViewer(id) {
  const h = state.history.find(x => x.id === id);
  if (!h) return;
  window._viewerContent = h.content;
  $('#viewerTitle').textContent = h.title;
  $('#viewerBody').innerHTML = mdLite(h.content);
  $('#viewerModal').classList.add('open');
}
function closeViewer() { $('#viewerModal').classList.remove('open'); }
function copyViewer() { copyText(window._viewerContent || '', 'Copied ✓'); }

// ---------------- Tutorial ----------------
function renderTutorial() {
  $('#view').innerHTML = `<div class="page">
  <p class="page-intro">Welcome to <b>Maker Studio AI</b> — your personal copy of an all-in-one digital product studio. It runs entirely on your computer: no account, no subscription, and your data never leaves your browser. Here's how to use it, step by step.</p>

  <div class="tut-step"><h3><span class="step-num">1</span> Get around the app</h3>
    <p>Everything lives in the left sidebar. The <b>Tools</b> section has 11 tools; <b>History</b> keeps everything you generate; the usage panel shows your weekly credits (they reset every Monday, just like the original app — or switch to <b>Unlimited</b> in Settings, since this copy is all yours). Your recent AI chats appear at the bottom of the sidebar.</p></div>

  <div class="tut-step"><h3><span class="step-num">2</span> Add an AI key (recommended, 2 minutes)</h3>
    <p>Without any key, every tool still works in <b>prompt mode</b>: it writes you a perfect expert prompt with one-click copy, and you paste it into free ChatGPT / Claude / Gemini. With a key, results appear <b>directly inside the app</b>. Add keys in <b>Settings (⚙️ bottom-left)</b>:</p>
    <ul>
      <li><b>Gemini (easiest, has a free tier):</b> go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>, sign in with Google, click <b>Create API key</b>, copy it into Settings. This also unlocks in-app <b>image generation</b> (Nano Banana).</li>
      <li><b>Claude:</b> <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> → API keys (pay-as-you-go).</li>
      <li><b>ChatGPT:</b> <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a> (pay-as-you-go).</li>
    </ul></div>

  <div class="tut-step"><h3><span class="step-num">3</span> Connect YouTube (for the Faceless Finder)</h3>
    <p>This gives the Faceless Finder <b>live, real YouTube data</b> — real channels, real subscriber and view counts. The key is free (10,000 units/day, plenty):</p>
    <ol>
      <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> and sign in with your Google account.</li>
      <li>Create a project (top bar → project picker → <b>New project</b> → name it anything → Create).</li>
      <li>Search for <b>“YouTube Data API v3”</b> in the top search bar, open it, click <b>Enable</b>.</li>
      <li>Go to <b>APIs &amp; Services → Credentials → + Create credentials → API key</b>, and copy the key.</li>
      <li>Paste it in <b>Settings → YouTube Connection</b> here in the app. Done.</li>
    </ol></div>

  <div class="tut-step"><h3><span class="step-num">4</span> The Chat page</h3>
    <p>Pick an AI card. <b>ChatGPT, Claude and Gemini</b> chat right inside the app when their key is added (chats are saved to <b>Recent Chats</b>). The other cards — NotebookLM, Google AI Studio, Antigravity, Nano Banana, Horizons, Stitch — open the official tool in a new tab.</p></div>

  <div class="tut-step"><h3><span class="step-num">5</span> The maker tools — a typical workflow</h3>
    <ol>
      <li><b>🔍 Product Research</b> — find what's in demand in your niche.</li>
      <li><b>🎯 Competitor Analyzer</b> — break down who's already winning (uses your weekly Competitor credit).</li>
      <li><b>📦 Product Maker</b> — turn the idea into a full product blueprint.</li>
      <li><b>✨ Prompt Maker</b> — build perfect prompts for any AI (uses Prompts credits).</li>
      <li><b>🖼️ Image Maker / 🎬 Video Maker</b> — create visuals and full video scripts (great for faceless channels).</li>
      <li><b>🏪 Store Finder / 📚 Ad Library</b> — study real stores and real running ads with one-click research links.</li>
      <li><b>🌐 Website Maker</b> — build a real one-page site, preview it live, download the file (uses your Replication credit).</li>
      <li><b>🎭 Faceless Finder</b> — search real YouTube channels and analyze any channel's formula.</li>
    </ol></div>

  <div class="tut-step"><h3><span class="step-num">6</span> Video guides you saved</h3>
    <p>The videos you bookmarked for this project:</p>
    <ul>
      <li><a href="https://youtu.be/dMTim2JwlM8" target="_blank" rel="noopener">▶ Tutorial video 1 (youtu.be/dMTim2JwlM8)</a></li>
      <li><a href="https://youtu.be/C-H-zpWLhI8" target="_blank" rel="noopener">▶ Tutorial video 2 (youtu.be/C-H-zpWLhI8)</a></li>
      <li><a href="https://youtu.be/ZLW0WfyXjQg" target="_blank" rel="noopener">▶ Tutorial video 3 (youtu.be/ZLW0WfyXjQg)</a></li>
      <li><a href="https://www.youtube.com/channel/UCLI_f0zfE2Q9EWoJe_cAwRw" target="_blank" rel="noopener">▶ The channel you saved</a> — tip: paste this channel into the <a href="#/faceless-finder">Faceless Finder</a> to analyze it!</li>
    </ul></div>

  <div class="tut-step"><h3><span class="step-num">7</span> Your data &amp; privacy</h3>
    <p>Everything — history, chats, usage and API keys — is stored in your browser's local storage on your own computer. Nothing is uploaded anywhere except your direct calls to the AI/YouTube providers. Clearing your browser data will erase it, and you can wipe it any time in Settings → Danger zone.</p></div>
  </div>`;
}

// ---------------- Settings ----------------
function openSettings(section) {
  $('#setName').value = state.name || '';
  $('#setPlan').value = state.plan;
  $('#setKeyAnthropic').value = state.keys.anthropic || '';
  $('#setKeyOpenai').value = state.keys.openai || '';
  $('#setKeyGemini').value = state.keys.gemini || '';
  $('#setKeyYoutube').value = state.keys.youtube || '';
  $('#setProvider').value = state.provider;
  $('#settingsModal').classList.add('open');
  if (section === 'keys') $('#keysSection').scrollIntoView();
  if (section === 'plan') $('#planSection').scrollIntoView();
}
function closeSettings() { $('#settingsModal').classList.remove('open'); }
function saveSettings() {
  state.name = $('#setName').value.trim() || 'You';
  state.plan = $('#setPlan').value;
  state.keys.anthropic = $('#setKeyAnthropic').value.trim();
  state.keys.openai = $('#setKeyOpenai').value.trim();
  state.keys.gemini = $('#setKeyGemini').value.trim();
  state.keys.youtube = $('#setKeyYoutube').value.trim();
  state.provider = $('#setProvider').value;
  saveState();
  renderUsage(); renderKeyStatus();
  closeSettings();
  toast('Settings saved ✓');
  route(); // re-render current page so mode notices update
}
function clearAllData() {
  if (confirm('This wipes EVERYTHING: history, chats, usage and API keys. Continue?')) {
    localStorage.removeItem('makerStudio');
    state = structuredClone(DEFAULT_STATE);
    saveState();
    renderUsage(); renderRecent(); renderKeyStatus();
    closeSettings();
    location.hash = '#/chat';
    route();
    toast('All data cleared');
  }
}
function signOut() {
  toast("This is your personal copy — there's no account to sign out of. 😊");
}

// ---------------- Sidebar toggle (mobile) ----------------
function toggleSidebar(open) {
  $('#sidebar').classList.toggle('open', !!open);
  $('#sideOverlay').classList.toggle('show', !!open);
}

// close modals on backdrop click / Escape
document.querySelectorAll('.modal-wrap').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-wrap.open').forEach(m => m.classList.remove('open')); });

// ---------------- Boot ----------------
ensureWeek();
renderUsage();
renderRecent();
renderKeyStatus();
route();
