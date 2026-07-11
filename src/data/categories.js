// Topic clusters. Each category is a "pillar": a hub page that owns a subject
// and links out to the supporting reviews, roundups and guides beneath it.
// This silo structure is what builds topical authority for SEO and gives AI
// engines a clean entity map to reason about.
//
// Fields:
//   slug        URL segment (also the folder articles live under)
//   name        Display name
//   emoji       Lightweight visual marker (no external image request)
//   tagline     One-line summary shown on cards
//   headline    H1 for the hub page
//   summary     The "short answer" / executive summary for the hub (1–3 sentences)
//   intro       Opening prose for the hub page (plain text, one paragraph)
//   description Meta description (<=160 chars ideally)
//   faqs        Question/answer pairs -> rendered + FAQPage schema
//   featured    Ordered slugs of articles to surface first on the hub (optional)

export const categories = [
  {
    slug: 'robot-vacuums',
    name: 'Robot Vacuums',
    emoji: '🤖',
    tagline: 'Hands-free floors, tested for real homes.',
    headline: 'Robot Vacuums: Reviews & Buying Advice',
    summary:
      'The best robot vacuum for most homes balances strong suction, reliable ' +
      'navigation and a hassle-free app. Self-emptying models cost more but ' +
      'remove the chore most people abandon their robot over.',
    intro:
      'A robot vacuum only earns its place if it cleans well and quietly gets ' +
      'on with it. We test navigation, suction on carpet and hard floors, how ' +
      'well each model handles pet hair and cables, and how much day-to-day ' +
      'maintenance it really demands — then tell you which one fits your home.',
    description:
      'Independent robot vacuum reviews and buying advice. Real-home testing on ' +
      'suction, navigation, pet hair and maintenance — find the right one for you.',
    faqs: [
      {
        q: 'Are robot vacuums worth it?',
        a: 'For most homes, yes. A good robot vacuum keeps floors consistently ' +
          'clean between deeper cleans, and self-emptying models need attention ' +
          'only every few weeks. They struggle with deep-pile carpet and heavy ' +
          'clutter, so they complement rather than fully replace an upright.'
      },
      {
        q: 'Do robot vacuums work with pet hair?',
        a: 'The better ones do. Look for strong suction (measured in Pa), a ' +
          'rubber or hybrid brush that resists tangling, and a larger bin or ' +
          'self-emptying base so it does not clog mid-clean.'
      },
      {
        q: 'How much should I spend on a robot vacuum?',
        a: 'Capable vacuum-only robots start around £200. Reliable LiDAR ' +
          'navigation and self-emptying bases typically begin near £400, and ' +
          'robots that also mop well sit higher again. Spend for navigation and ' +
          'maintenance features, not headline suction numbers alone.'
      }
    ]
  },
  {
    slug: 'home-security',
    name: 'Home Security',
    emoji: '🔒',
    tagline: 'Cameras, doorbells and alarms that actually protect.',
    headline: 'Home Security: Cameras, Doorbells & Systems',
    summary:
      'The right home security setup depends on whether you rent or own and how ' +
      'much you will pay monthly. Wire-free cameras and video doorbells cover ' +
      'most needs; avoid systems that lock essential features behind a fee.',
    intro:
      'Home security should give you real peace of mind, not a subscription ' +
      'trap. We look at video quality day and night, how fast alerts arrive, ' +
      'what genuinely requires a monthly plan, and how each brand handles your ' +
      'footage and privacy — so you can protect your home on your terms.',
    description:
      'Home security camera, video doorbell and alarm reviews. Tested for video ' +
      'quality, alerts, subscription value and privacy. Find the right system.',
    faqs: [
      {
        q: 'Do home security cameras need a subscription?',
        a: 'Not always. Many cameras record locally to a microSD card or hub ' +
          'for free, while cloud storage, person detection and longer history ' +
          'usually need a plan. Check what works without a subscription before ' +
          'you buy — it varies a lot by brand.'
      },
      {
        q: 'Are wired or wireless security cameras better?',
        a: 'Wireless (battery) cameras are easiest to fit and ideal for renters, ' +
          'but need recharging. Wired cameras never run out of power and record ' +
          'continuously, at the cost of a more involved install.'
      }
    ]
  },
  {
    slug: 'wifi-networking',
    name: 'WiFi & Networking',
    emoji: '📶',
    tagline: 'Fast, reliable coverage in every room.',
    headline: 'Home WiFi & Networking: Mesh, Routers & More',
    summary:
      'For most homes, a mesh WiFi system beats a single router by covering ' +
      'dead zones with a consistent signal. Match the system to your broadband ' +
      'speed and home size rather than paying for headline WiFi 7 numbers.',
    intro:
      'Nothing undermines a smart home faster than patchy WiFi. We test mesh ' +
      'systems and routers for real-world range, how well they hold speed at ' +
      'distance, how simple setup is, and whether they keep working without a ' +
      'cloud account — so every room stays connected.',
    description:
      'Mesh WiFi and router reviews and advice. Tested for range, real-world ' +
      'speed and setup. Fix WiFi dead zones and pick the right system for you.',
    faqs: [
      {
        q: 'Do I need mesh WiFi or a single router?',
        a: 'If you have dead zones, multiple floors, or a home larger than a ' +
          'small flat, mesh WiFi usually delivers a more consistent signal than ' +
          'a single router. For a compact space, a good standalone router is ' +
          'often enough and cheaper.'
      },
      {
        q: 'Is WiFi 7 worth it?',
        a: 'Only if your devices and broadband can use it. Most homes are better ' +
          'served putting money toward coverage and reliability than toward the ' +
          'newest WiFi standard, which few devices currently take advantage of.'
      }
    ]
  },
  {
    slug: 'climate-air',
    name: 'Climate & Air Quality',
    emoji: '🌡️',
    tagline: 'Comfortable, healthy air — and lower bills.',
    headline: 'Climate & Air Quality: Thermostats, Purifiers & More',
    summary:
      'Smart thermostats can cut heating costs when matched to your system and ' +
      'habits, while air purifiers help most with allergens and odours. Size ' +
      'and filter cost matter more than smart features on their own.',
    intro:
      'The air in your home affects your comfort, your health and your energy ' +
      'bills. We test smart thermostats, air purifiers and monitors for genuine ' +
      'savings and cleaner air — and flag the ongoing costs, like filters, that ' +
      'the box never mentions.',
    description:
      'Smart thermostat and air purifier reviews. Tested for energy savings, ' +
      'clean-air performance and running costs. Breathe easier and spend less.',
    faqs: [
      {
        q: 'Do smart thermostats really save money?',
        a: 'They can, mainly by heating your home only when needed and letting ' +
          'you fine-tune schedules remotely. Savings depend on your current ' +
          'habits and heating system — the biggest gains come from homes that ' +
          'previously heated on a fixed timer or not at all.'
      },
      {
        q: 'What size air purifier do I need?',
        a: 'Match the purifier’s rated room size (or CADR) to the room you want ' +
          'to clean, then size up slightly so it runs quietly on a lower setting ' +
          'rather than flat out. Factor in replacement filter cost over a year.'
      }
    ]
  },
  {
    slug: 'smart-lighting',
    name: 'Smart Lighting',
    emoji: '💡',
    tagline: 'The easiest upgrade in the smart home.',
    headline: 'Smart Lighting: Bulbs, Switches & Strips',
    summary:
      'Smart lighting is the simplest way to start a smart home. Bulbs are ' +
      'easiest for renters; smart switches suit whole rooms and homeowners. ' +
      'Decide between a hub-based ecosystem and simpler WiFi bulbs early.',
    intro:
      'Lighting is where most people begin — and it is genuinely one of the ' +
      'most useful upgrades. We test smart bulbs, switches and light strips for ' +
      'colour quality, reliability, response speed and how well they play with ' +
      'the assistant you already use.',
    description:
      'Smart bulb, switch and light strip reviews. Tested for colour, ' +
      'reliability and ecosystem fit. The easiest way to start your smart home.',
    faqs: [
      {
        q: 'Do smart bulbs need a hub?',
        a: 'Some do, some do not. Hub-based systems (like Zigbee bulbs) tend to ' +
          'be faster and more reliable at scale, while WiFi bulbs work straight ' +
          'from the box but can strain your network in large numbers.'
      },
      {
        q: 'Are smart bulbs or smart switches better?',
        a: 'Smart bulbs are ideal for renters and individual lamps. Smart ' +
          'switches control every bulb on a circuit and keep working with normal ' +
          'wall switches, which suits whole rooms and homeowners.'
      }
    ]
  },
  {
    slug: 'smart-speakers',
    name: 'Smart Speakers & Displays',
    emoji: '🔊',
    tagline: 'The voice at the centre of your home.',
    headline: 'Smart Speakers & Displays: The Hub of Your Home',
    summary:
      'Your smart speaker choice usually comes down to the assistant you prefer ' +
      'and the devices you own. Displays add visual answers and video calls; ' +
      'consider privacy controls and sound quality alongside features.',
    intro:
      'A smart speaker or display is the control centre for everything else. We ' +
      'compare assistants, sound quality, how well each hub controls other ' +
      'devices, and — importantly — the privacy controls each one gives you ' +
      'over what it hears.',
    description:
      'Smart speaker and display reviews. Compare assistants, sound, smart-home ' +
      'control and privacy. Pick the right hub for your home and ecosystem.',
    faqs: [
      {
        q: 'Which smart assistant is best?',
        a: 'It depends on your devices. Match the assistant to the ecosystem you ' +
          'already use — your phone, your other smart devices and the services ' +
          'you rely on — rather than to headline features, since all the major ' +
          'assistants handle everyday tasks well.'
      },
      {
        q: 'Are smart speakers a privacy risk?',
        a: 'They listen for a wake word and only stream audio after it, but the ' +
          'exact controls vary. Look for a physical mute switch, the option to ' +
          'delete recordings automatically, and clear settings over how your ' +
          'voice data is used.'
      }
    ]
  }
];

export const getCategory = (slug) => categories.find((c) => c.slug === slug);

export default categories;
