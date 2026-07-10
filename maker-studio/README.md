# Maker Studio AI

Your personal, self-hosted all-in-one digital product studio — a full replica of the
"Digital Maker AI"-style workflow that runs **entirely on your own computer**.
No account, no subscription, no server. Your data and API keys never leave your browser.

## What's inside

| Tool | What it does |
|---|---|
| 💬 Chat | Chat with ChatGPT, Claude or Gemini right in the app (with your API key), plus one-click launchers for NotebookLM, Google AI Studio, Antigravity, Nano Banana, Horizons and Google Stitch |
| 📦 Product Maker | Full digital-product blueprints: titles, outline, pricing, sales copy |
| ✨ Prompt Maker | Turns a rough idea into a professional, first-try prompt |
| 🔍 Product Research | Trending product ideas with demand signals + validation checklist |
| 🎯 Competitor Analyzer | Teardown of any competitor: offer, pricing, angles, gaps to exploit |
| 🏪 Store Finder | Smart search shortcuts (Shopify dorks, Etsy, Myip.ms) + stores to study |
| 🎭 Faceless Finder | **Live YouTube integration** — search real channels with real subscriber/view counts, analyze any channel's formula |
| 🖼️ Image Maker | Generates images in-app (Gemini "Nano Banana" or OpenAI) or builds perfect image prompts |
| 🎬 Video Maker | Complete video packages: hooks, script, shot list, Veo/Sora prompts |
| 📚 Ad Library | Deep links into Meta / TikTok / Google ad libraries + AI ad angles |
| 🌐 Website Maker | Builds a real one-page website — live preview + download. Works even without any API key |
| 🕘 History | Everything you generate, saved locally, viewable & copyable |
| 🎓 Tutorial | Step-by-step in-app guide, including how to get every key |

Weekly usage meters (AI Chat 5, Prompts 3, Replication 1, Competitor 1) reset every
Monday exactly like the original free plan — or flip to **Unlimited** in Settings,
because this copy is yours.

## How to run it (step by step)

1. Download/copy the `maker-studio` folder to your computer.
2. Open the folder and **double-click `index.html`** — it opens in your browser. That's it.
   - Tip: bookmark it, or drag `index.html` onto your browser icon.
   - If your browser is strict about local files, run a tiny local server instead:
     open a terminal in the folder and run `python -m http.server 8080`,
     then visit `http://localhost:8080`.
3. Click **⚙️ Settings** (bottom-left) and set your name.
4. *(Optional but recommended)* add an AI key so tools generate results in-app:
   - **Gemini** (free tier, also unlocks image generation): https://aistudio.google.com/apikey
   - **Claude**: https://console.anthropic.com/settings/keys
   - **ChatGPT**: https://platform.openai.com/api-keys
5. *(Optional)* connect YouTube for the Faceless Finder — free key:
   Google Cloud Console → new project → enable **YouTube Data API v3** → Credentials →
   Create API key. Full walkthrough is on the in-app **Tutorial** page, step 3.
6. No keys at all? Every tool still works in **prompt mode**: it writes the expert
   prompt for you with one-click copy, and the Website Maker builds a real site
   from its built-in template.

## Privacy

Everything (history, chats, usage counters, API keys) lives in your browser's
localStorage on your machine. The only network calls the app ever makes are your
own direct requests to the AI provider / YouTube API you configured.
