// Lacalut Chat Widget v2
// <script src="https://lacalut-australia.github.io/chat-widget/lacalut-chat.js" defer></script>

(function () {
  'use strict';

  var WORKER_URL = 'https://lacalut-chat.lacalut.workers.dev';
  var BRAND = '#cf102d';
  var STORE = 'https://lacalut.com.au';

  // ── Symptom intake chips ─────────────────────────────────────────────────────
  // Each maps to a Lacalut range + the Klaviyo oral_concern tag used for segmentation.
  var SYMPTOMS = [
    { icon: '🦷', label: 'Intensive\ngum care',      concern: 'Gum Care',             range: 'AKTIV',          url: STORE + '/products/lacalut-aktiv-toothpaste-75ml',   message: 'I want firmer-feeling, healthy-looking gums — what do you recommend?' },
    { icon: '🤢', label: 'Bad breath',                concern: 'Bad Breath',           range: 'FLORA',          url: STORE + '/products/lacalut-flora-toothpaste-75ml',      message: 'I want long-lasting fresh breath — what do you recommend?' },
    { icon: '😣', label: 'Sensitive\nteeth',          concern: 'Sensitive Teeth',      range: 'SENSITIVE',      url: STORE + '/products/lacalut-sensitive-toothpaste-75ml',                                 message: 'I have sensitive teeth — what product do you recommend?' },
    { icon: '✨', label: 'Weak or\nStained Teeth',    concern: 'Weak or Stained Teeth', range: 'WHITE & REPAIR', url: STORE + '/products/lacalut-white-repair-toothpaste-75ml',                              message: 'I have weak or stained teeth — what product do you recommend?' },
  ];

  // ── 10%-off discount flow ────────────────────────────────────────────────────
  var DISCOUNT_CODE = 'WELCOME10';

  // ── Live-chat persona ────────────────────────────────────────────────────────
  // Overridable via chat_config keys agent_name / agent_avatar.
  var AGENT_AVATAR = 'https://lacalut-australia.github.io/chat-widget/chat-avatar-lucy-v2.jpg?v=20261004-0131';
  var AGENT_NAME = 'Lucy';

  // ── Product recommendation cards ─────────────────────────────────────────────
  // Keywords are checked against the bot's reply (case-insensitive).
  // Order matters — more specific first (herbal before aktiv).
  var PRODUCTS = [
    {
      name: 'LACALUT Aktiv Herbal Toothpaste',
      keywords: ['aktiv herbal', 'herbal toothpaste', 'herbal formula'],
      url: STORE + '/products/lacalut-herbal-toothpaste-75ml',
      img: 'https://cdn.shopify.com/s/files/1/0635/3960/9651/files/11_Herbal_Images_14.png?v=1764801592',
    },
    {
      name: 'LACALUT Aktiv Toothpaste',
      keywords: ['aktiv', 'aktiv toothpaste', 'gum care toothpaste', 'advanced gum care', 'firm gums'],
      url: STORE + '/products/lacalut-aktiv-toothpaste-75ml',
      img: 'https://cdn.shopify.com/s/files/1/0635/3960/9651/files/11_Aktiv_Toothpaste_Images_2.png?v=1764814195',
    },
    {
      name: 'LACALUT Flora Toothpaste',
      keywords: ['flora', 'bad breath toothpaste', 'bad breath'],
      url: STORE + '/products/lacalut-flora-toothpaste-75ml',
      img: 'https://cdn.shopify.com/s/files/1/0635/3960/9651/files/Copy_of_11_Flora_Images_4.png?v=1769556440',
    },
    {
      name: 'LACALUT Aktiv Mouthwash',
      keywords: ['mouthwash', 'aktiv mouthwash', 'gum care mouthwash', 'gum mouthwash'],
      url: STORE + '/products/lacalut-aktiv-mouthwash-300ml',
      img: 'https://cdn.shopify.com/s/files/1/0635/3960/9651/files/11_Mouthwash_Images_3.png?v=1775528910',
    },
    {
      name: 'LACALUT Aktiv Toothbrush',
      keywords: ['toothbrush', 'aktiv toothbrush'],
      url: STORE + '/products/lacalut-aktiv-toothbrush',
      img: 'https://cdn.shopify.com/s/files/1/0635/3960/9651/files/11_Toothbrush_Images_5.png?v=1769558290',
    },
    {
      name: 'LACALUT Sample Pack',
      keywords: ['sample pack', 'sample', 'try first', 'starter pack'],
      url: STORE + '/products/lacalut-aktiv-toothpaste-75ml',
      img: 'https://cdn.shopify.com/s/files/1/0635/3960/9651/files/11_Bundle_Images_9c7a3968-1d3a-4e64-ab89-0135240ce861.png?v=1776211855',
    },
  ];

  // ── Session state ────────────────────────────────────────────────────────────
  var sessionId = sessionStorage.getItem('lc_sid');
  if (!sessionId) {
    sessionId = 'lc_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
    sessionStorage.setItem('lc_sid', sessionId);
  }

  var isOpen = false;
  var mode = 'home';
  var isBusy = false;
  var captureShown = false;
  var quickQAs = [];
  var unreadCount = 0;
  var config = {
    greeting: 'Hi! Ask me anything about our products, shipping, or orders.',
    suggested_questions: '["Which product is best for everyday gum care?","How long does shipping take?","What is your return policy?","Do you offer free shipping?","Where can I buy LACALUT in store?"]',
    brand_colour: BRAND,
    proactive_delay: '4500',
    teaser_enabled: 'true',
    teaser_answer: 'Yes 👍',
    teaser_rotate_ms: '4500',
    teaser_openers: '',
    agent_name: '',
    agent_avatar: '',
  };

  function agentName() { return config.agent_name || AGENT_NAME; }
  function agentAvatar() { return config.agent_avatar || AGENT_AVATAR; }

  // ── Rotating interactive openers ─────────────────────────────────────────────
  // Each opener is a mini conversation-starter: a message from the agent plus
  // tappable answers. `action:'discount'` runs the 10%-code flow, `reply` types a
  // scripted answer, `offer:true` follows the reply with a 10%-code CTA,
  // `link:{label,url}` follows the reply with a link card.
  // Overridable via chat_config.teaser_openers (JSON, same shape) — shared brain.
  var OPENERS = [
    { id: 'discount', q: null, // q filled page-aware via getPageTeaser()
      buttons: [
        { label: 'Yes please 🤞', action: 'discount' },
        { label: 'No thanks', reply: "No worries at all 😊 I'm right here if you have any questions — about products, shipping, orders, anything!" },
      ] },
    { id: 'win12', q: 'Want to WIN 12 months of LACALUT? 🏆',
      buttons: [
        { label: 'How do I enter?', reply: "Join our Smile Club — keep your smile streak going in the app and you're in the running to win a full year of LACALUT, on us 🏆", link: { label: 'Check out the Smile Club →', url: STORE + '/pages/smile-club' } },
        { label: 'Maybe later', reply: "All good 😊 The Smile Club will be here when you're ready. Anything I can help you with in the meantime?" },
      ] },
    { id: 'smileclub', q: 'Have you heard about our Smile Club? 💎',
      buttons: [
        { label: 'Tell me more', reply: "It's our free membership 💎\n\n🏷️ **10% off** your first order\n⭐ A **free travel product** at a 4-week smile streak\n🏆 A **WIN Smile of the Month** entry at 8 weeks\n💎 A **20% loyalty reward** at 12 weeks", link: { label: 'Join the Smile Club →', url: STORE + '/pages/smile-club' } },
        { label: 'No thanks', reply: "No worries 😊 Ask me anything about our products, shipping or orders any time!" },
      ] },
    { id: 'guarantee', q: "On the fence? New customers get our Love-It-Or-It's-FREE guarantee 🤝",
      buttons: [
        { label: 'How does it work?', reply: "Simple — switch to LACALUT, and if you don't feel the difference, we refund you AND you keep the order. That's how confident we are 😄", offer: true },
        { label: '😏 Prove it', reply: "Love the attitude 😄 Try any LACALUT — if you don't feel the difference, your money comes straight back and the product stays yours.", offer: true },
      ] },
    { id: 'rinse', q: 'Quick one 🤔 Do you rinse your mouth right after brushing?',
      buttons: [
        { label: 'Yes, always', reply: "Most people do! But rinsing straight away washes the good stuff off your teeth before it can finish working. Try spit-don't-rinse — your smile will thank you 😉" },
        { label: 'Never', reply: "Look at you — ahead of the curve 👏 Spit-don't-rinse lets the actives keep working long after you've put the brush down." },
      ] },
    { id: 'coffee', q: 'Do you brush before your morning coffee… or after? ☕',
      buttons: [
        { label: 'Before ☕', reply: "Perfect habit 👏 Brushing first gives your enamel a protective once-over before the coffee arrives — and your coffee tastes better without the minty clash 😄" },
        { label: 'After ☕', reply: "You're not alone! Enamel is a touch softer right after acidic drinks like coffee — give it about 30 minutes, or flip the order and brush first 😉" },
      ] },
    { id: 'enamel', q: 'Fun fact 🦷 Enamel is the hardest thing in your body — harder than bone. Want to know how to keep it strong?',
      buttons: [
        { label: 'Tell me!', reply: "It's all about minerals ✨ Our WHITE & REPAIR toothpaste has the highest hydroxyapatite in our range — it remineralises enamel while gently lifting stains." },
        { label: 'I knew that 😎', reply: "A dental trivia champion 😄 Here's one you might not know: LACALUT has been made in Germany since 1925. Anything I can help you with?" },
      ] },
    { id: 'brushage', q: 'Be honest 😅 How old is your toothbrush?',
      buttons: [
        { label: 'Under 3 months', reply: "Gold star ⭐ Fresh bristles clean best — swap every 3 months. Ours are micro-fine, so they get right along the gum line while staying gentle." },
        { label: 'No idea…', reply: "Ha — you're in good company 😄 Worn bristles just push things around instead of sweeping them away. Swap every 3 months; our micro-fine bristles are a lovely fresh start." },
      ] },
    { id: 'twomin', q: 'Pop quiz ⏱️ How long should the perfect brush take?',
      buttons: [
        { label: '2 minutes', reply: "Nailed it 👏 Two full minutes, twice a day. Most people tap out around 45 seconds — a song chorus is a handy timer 🎵" },
        { label: '45 seconds 😅', reply: "That's most of us, honestly 😄 The magic number is 2 full minutes — try humming a chorus while you brush. Your smile notices the difference." },
      ] },
    { id: 'stains', q: 'Coffee, tea or red wine — which stains teeth the most? ☕🍷',
      buttons: [
        { label: 'Coffee', reply: "Sneaky one — tea is actually one of the biggest culprits! They all do their bit though 😅 Our WHITE & REPAIR gently lifts stains while it remineralises enamel ✨" },
        { label: 'Red wine', reply: "Good guess — but plain old tea is one of the biggest culprits! Our WHITE & REPAIR gently lifts stains while it remineralises enamel ✨" },
      ] },
    { id: 'eightydays', q: "You'll spend about 80 DAYS of your life brushing your teeth 🪥 May as well love your toothpaste, right?",
      buttons: [
        { label: 'Fair point 😄', reply: "Right? 80 days deserves better than boring 😄 Fancy 10% off to find your new favourite?", offer: true },
        { label: '80 days?!', reply: "Two minutes, twice a day, for a lifetime — it adds up 🤯 May as well make every brush a good one. Want 10% off to upgrade yours?", offer: true },
      ] },
    { id: 'since1925', q: 'Pop quiz 🇩🇪 What year did LACALUT start making toothpaste in Germany?',
      buttons: [
        { label: '1970s?', reply: "Older — 1925! Almost 100 years of German oral care, and we're still obsessed with the details. Some things are worth doing properly 🇩🇪" },
        { label: 'Way older', reply: "Spot on — 1925! Almost a century of German oral care know-how in every tube 🇩🇪" },
      ] },
    { id: 'floss', q: '🧵 Truth time — when did you last floss?',
      buttons: [
        { label: 'This morning 😇', reply: "A rare unicorn 🦄 Keep it up — brushing only reaches about 60% of each tooth's surface, so flossing does the corners the brush can't." },
        { label: "Define 'last'… 😅", reply: "Honesty! Love it 😄 Here's the thing: brushing only reaches about 60% of each tooth. A quick floss gets the rest — your gums will feel the difference." },
      ] },
    { id: 'morningbreath', q: '🥱 Ever wondered why morning breath is a thing?',
      buttons: [
        { label: 'Go on…', reply: "While you sleep, saliva slows right down — and saliva is your mouth's rinse cycle. Less rinse, more pong 😅 Our FLORA range neutralises the sulphur compounds behind bad breath, right at the source." },
        { label: "I'd rather not know 😅", reply: "Fair 😄 Short version: sleep = less saliva = morning pong. FLORA sorts the compounds that cause it — fresh breath that actually lasts." },
      ] },
    { id: 'tongueprint', q: '👅 Your tongue print is as unique as your fingerprint. True or false?',
      buttons: [
        { label: 'True?!', reply: "100% true — no two tongue prints are alike 🤯 Bonus tip: giving your tongue a gentle brush is one of the easiest fresh-breath upgrades there is." },
        { label: 'No way', reply: "Way! Totally unique to you 🤯 And since we're on tongues — a gentle tongue brush is the most underrated fresh-breath trick going." },
      ] },
    { id: 'icecream', q: '🍦 Does biting into ice cream make you wince?',
      buttons: [
        { label: 'Every time 😖', reply: "You're not imagining it — that zing comes from tiny exposed channels in the tooth surface. Our SENSITIVE range seals them, so cold treats stop being a dare." },
        { label: 'Nope 😎', reply: "Lucky you 😄 Keep it that way — gentle brushing and a good paste keep that protective layer happy. Anything I can help you find?" },
      ] },
    { id: 'electric', q: '🪥⚡ Electric or manual toothbrush — which team are you?',
      buttons: [
        { label: 'Electric ⚡', reply: "Team gadget! Great choice — just let it glide, no scrubbing. And remember it's the toothpaste doing the chemistry: the brush is the delivery van 😄" },
        { label: 'Manual 🪥', reply: "Classic! Technique beats tech — soft bristles, gentle circles, two minutes. Pair it with a great paste and you're set 👌" },
      ] },
    { id: 'smilenotice', q: "😁 Studies say your smile is one of the FIRST things people notice about you. Feeling ready?",
      buttons: [
        { label: 'Always 😏', reply: "That's the energy 😄 Keep it dazzling — and if it ever needs a boost, our WHITE & REPAIR lifts stains while strengthening enamel ✨" },
        { label: 'Umm… 😅', reply: "You're one good routine away 😄 Two minutes twice a day, and WHITE & REPAIR gently lifts stains while it remineralises enamel. Want 10% off to get started?", offer: true },
      ] },
    { id: 'germaneng', q: '🇩🇪 German cars. German kitchens. German… toothpaste?',
      buttons: [
        { label: 'Wait, really?', reply: "Really 😄 LACALUT has been formulated and made in Germany since 1925 — same obsession with precision, applied to your smile." },
        { label: 'Naturally 😄', reply: "Exactly — precision where it matters most 😄 Made in Germany since 1925, and you can feel it from the first brush." },
      ] },
    { id: 'mwtiming', q: '🥤 Mouthwash: straight after brushing, or at another time?',
      buttons: [
        { label: 'Straight after', reply: "Most people do! But rinsing right after brushing can wash away the goodness your paste just left behind. Try mouthwash at a different time — after lunch is perfect 👌" },
        { label: 'Another time', reply: "Smart routine 👏 Keeping mouthwash away from brushing time lets both do their best work. After lunch is the sweet spot." },
      ] },
    { id: 'quizfirstpaste', q: '🏺 Pop quiz: when did humans FIRST use toothpaste?',
      buttons: [
        { label: 'Ancient Egypt', reply: "Nailed it 🏆 The Ancient Egyptians were mixing tooth cleaning pastes about 5,000 years ago — crushed minerals and herbs. It's come a long way since 😄" },
        { label: 'The 1800s', reply: "Way earlier! The Ancient Egyptians were cleaning their teeth with mineral pastes about 5,000 years ago 🏺 The 1800s just put it in a jar." },
        { label: 'The 1950s', reply: "Off by about 5,000 years 😄 The Ancient Egyptians got there first with crushed-mineral pastes. Fresh smiles are an old obsession 🏺" },
      ] },
    { id: 'quiztube', q: '🧴 When did toothpaste first come in a squeezable tube?',
      buttons: [
        { label: '1892', reply: "Spot on 🏆 A dentist called Dr Sheffield launched the first collapsible tube in 1892. Before that, everyone dipped their brush into a shared jar 😬" },
        { label: '1932', reply: "Earlier! 1892 — a dentist called Dr Sheffield. Before the tube, families dipped their brushes into one shared jar 😬 You're welcome for that image." },
        { label: '1969', reply: "Much earlier — 1892! Before Dr Sheffield's tube, everyone dipped their brush in a shared family jar 😬" },
      ] },
    { id: 'quizbristles', q: '🪥 What were the first toothbrush bristles made from?',
      buttons: [
        { label: 'Boar hair 🐗', reply: "Correct — and slightly gross 😄 Bristle brushes were invented in China around 500 years ago using boar hair. Nylon bristles only arrived in 1938. Progress!" },
        { label: 'Horse hair 🐴', reply: "Close! Horse hair had its moment, but the original bristle brush — invented in China ~500 years ago — used boar hair 🐗 Nylon saved us all in 1938." },
        { label: 'Plant fibres 🌿', reply: "Good guess — chew-sticks came first, but the first true bristle brush (China, ~500 years ago) used boar hair 🐗 Nylon took over in 1938." },
      ] },
    { id: 'quizamount', q: '🫛 How much toothpaste should you ACTUALLY use?',
      buttons: [
        { label: 'Pea-sized', reply: "Exactly right 🏆 A pea-sized dab is all an adult needs. That full-brush swoosh in the ads? Pure marketing 😄 Your tube should last months." },
        { label: 'Cover the brush', reply: "That's the ad-land swoosh 😄 Truth: a pea-sized dab is all you need. Looks less dramatic, works just as hard — and your tube lasts way longer." },
        { label: 'Half the tube 😅', reply: "Ha! Bold strategy 😄 A pea-sized dab is genuinely all you need — anything more is just extra foam." },
      ] },
    { id: 'quizshark', q: '🦈 Which animal never has to worry about its teeth?',
      buttons: [
        { label: 'Sharks', reply: "Correct 🏆 Shark enamel is naturally rich in fluoride — AND they regrow teeth their entire lives. Some sharks go through 30,000 teeth. We get one set, so look after it 😄" },
        { label: 'Crocodiles', reply: "Good guess — crocs do regrow teeth, but sharks win: fluoride-rich enamel AND up to 30,000 teeth in a lifetime 🦈 We get one set. Worth pampering." },
        { label: 'Horses', reply: "Nope — horses actually have famously high-maintenance teeth 😄 It's sharks: fluoride-rich enamel and endless replacements 🦈 We get one set. Treat it well." },
      ] },
    { id: 'quizcolour', q: "🎨 What's the world's most popular toothbrush colour?",
      buttons: [
        { label: 'Blue', reply: "Correct 🏆 Blue wins worldwide — apparently we find it 'cleaner looking'. No hard feelings, red is clearly the superior colour 😄🔴" },
        { label: 'Red', reply: "A person of taste 😄🔴 Sadly the world disagrees — blue is the most popular toothbrush colour on earth. Their loss." },
        { label: 'White', reply: "Sensible guess — but it's blue! Apparently blue 'feels cleaner' to most people. We remain loyal to red 😄🔴" },
      ] },
    { id: 'quizoldest', q: '🧐 Pop quiz: who sold the first commercial toothpaste?',
      buttons: [
        { label: 'Colgate', reply: "Correct — Colgate sold aromatic toothpaste in jars from 1873 🏺 We arrived in 1925 with German precision… and we'd argue we aged rather well 😄🇩🇪" },
        { label: 'LACALUT', reply: "Flattering! 😄 It was actually Colgate, in jars, from 1873. LACALUT joined in 1925 — fashionably late, impeccably German 🇩🇪" },
        { label: 'Some pharmacist?', reply: "Honestly, half of dental history IS 'some pharmacist' 😄 Officially it was Colgate in 1873 — jars, not tubes. LACALUT arrived in 1925 with German precision 🇩🇪" },
      ] },
    { id: 'quizsaliva', q: '🤤 How much saliva will you make in a lifetime?',
      buttons: [
        { label: 'A bathtub', reply: "Think bigger 😄 Around 25,000 LITRES — enough to fill two swimming pools 🏊 And it's your mouth's built-in rinse cycle, working around the clock." },
        { label: 'Two swimming pools', reply: "Correct — and slightly horrifying 🏆 About 25,000 litres over a lifetime. It's your mouth's natural rinse cycle, so keep it flowing 😄" },
        { label: "I don't want to know", reply: "Too late — two swimming pools' worth 🏊😅 On the bright side, saliva is your mouth's own rinse cycle. Nature's mouthwash!" },
      ] },
    { id: 'quizsnail', q: '🐌 Pop quiz: which animal has the MOST teeth?',
      buttons: [
        { label: 'Shark 🦈', reply: "Great guess — but it's the humble garden snail 🐌 Up to 14,000 microscopic teeth on a ribbon-like tongue. You have 32. Spoil them 😄" },
        { label: 'Crocodile 🐊', reply: "Nope — the garden snail 🐌 Around 14,000 tiny teeth! You get 32 for life, which is excellent news for your toothpaste budget 😄" },
        { label: 'A snail?!', reply: "You beauty — correct 🏆 Up to 14,000 microscopic teeth on a snail. Your 32 suddenly feel very manageable, right? 😄" },
      ] },
    { id: 'quiznarwhal', q: '🦄 True or false: the narwhal’s famous horn is actually a TOOTH?',
      buttons: [
        { label: 'True', reply: "Correct 🏆 That 3-metre 'unicorn horn' is one giant spiral tooth 🦄 Imagine the toothbrush. Yours are easier — two minutes, twice a day 😄" },
        { label: 'False', reply: "It's true! The narwhal's horn is one enormous spiral tooth — up to 3 metres long 🦄 Suddenly flossing doesn't seem so hard, does it? 😄" },
      ] },
    { id: 'quizwashington', q: '🪵 Were George Washington’s famous dentures really made of wood?',
      buttons: [
        { label: 'Of course', reply: "History's biggest dental myth 😄 They were actually ivory, metal and real teeth — never wood. Moral of the story: keep your originals 😉" },
        { label: 'Sounds fake', reply: "Sharp instincts 🏆 Total myth — they were ivory, metal and real teeth. Either way: look after your originals, replacements have never been fun 😄" },
      ] },
    { id: 'quizbirth', q: '👶 True or false: your teeth started forming BEFORE you were born?',
      buttons: [
        { label: 'True', reply: "Correct 🏆 Baby teeth start forming in the womb — you've literally been growing your smile since before day one. Worth looking after, right? 😄" },
        { label: 'False', reply: "True, actually! Baby teeth start forming before birth 👶 Your smile has been in the works since before day one — treat it like the long-term project it is 😄" },
      ] },
    { id: 'quizenamelregrow', q: '🦷 Can tooth enamel grow back once it’s gone?',
      buttons: [
        { label: 'Yes, it heals', reply: "Sadly no — enamel has no living cells, so it can't regrow 😮 The good news: minerals like hydroxyapatite help strengthen what you have. That's why it's the hero of our WHITE & REPAIR ✨" },
        { label: 'No, never', reply: "Correct 🏆 Enamel can't regrow — no living cells. Which is exactly why we're obsessed with hydroxyapatite: it helps remineralise and strengthen what you've got ✨" },
      ] },
    { id: 'quiztastebuds', q: '👅 Roughly how many taste buds are on your tongue right now?',
      buttons: [
        { label: 'About 100', reply: "Way more — around 10,000! 👅 And they refresh themselves every couple of weeks. A clean, fresh mouth keeps them doing their best work 😄" },
        { label: 'About 10,000', reply: "Spot on 🏆 Roughly 10,000 taste buds, replaced every two weeks or so. All the more reason to keep their home sparkling clean 😄" },
      ] },
    { id: 'quizrome', q: '🏛️ What did ancient Romans use as mouthwash?',
      buttons: [
        { label: 'Wine', reply: "If only 😄 Brace yourself… imported URINE. The ammonia 'cleaned'. We've come a VERY long way — our mouthwash is considerably more pleasant 😅" },
        { label: 'Salt water', reply: "Sensible guess — but no. Urine. Actual urine 😅 The ammonia did the 'cleaning'. Aren't you glad it's 2026? Our mouthwash tastes much better, promise." },
        { label: 'Do I want to know?', reply: "No. (It was urine 😅) The Romans prized the ammonia. Count your blessings — and maybe our FLORA mouthwash — every single day 😄" },
      ] },
    { id: 'quizbarber', q: '💈 Pop quiz: who pulled teeth in medieval times?',
      buttons: [
        { label: 'The barber', reply: "Correct 🏆 One chair for a haircut AND a tooth-pulling 💈😬 The red-and-white barber pole? Blood and bandages. Modern oral care is a gift — use it 😄" },
        { label: 'The blacksmith', reply: "Close enough to be scary — it was the barber 💈 Haircut, shave, tooth out, all one visit 😬 Two minutes of brushing suddenly feels like a luxury, right?" },
      ] },
    { id: 'quizcheese', q: '🧀 Which snack do dentists quietly love?',
      buttons: [
        { label: 'Cheese', reply: "Correct 🏆 Cheese helps balance the acids in your mouth after a meal — plus it's rich in calcium. Officially the most delicious oral-care tip we have 🧀😄" },
        { label: 'Apples', reply: "Good answer — crunchy fruit helps too! But cheese is the quiet champion 🧀 It balances meal-time acids and brings calcium along. Dessert justified 😄" },
        { label: 'Dark chocolate', reply: "We admire the optimism 😄 It's cheese 🧀 — it balances the acids after eating and carries calcium. Cheese board = self-care. You heard it here." },
      ] },
  ];

  // Resolve the live opener list from config, falling back to the defaults.
  function getOpeners() {
    var list = null;
    try { list = JSON.parse(config.teaser_openers); } catch (e) { list = null; }
    if (!Array.isArray(list) || !list.length) return OPENERS.slice();
    var out = list.filter(function (o) { return o && (o.q || o.id === 'discount') && Array.isArray(o.buttons) && o.buttons.length && o.active !== false; });
    return out.length ? out : OPENERS.slice();
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────
  var css = `
    #lc-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 60px; height: 60px; border-radius: 50%;
      background: var(--lc, #cf102d); border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.28);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s;
    }
    #lc-btn:hover { transform: scale(1.1); box-shadow: 0 6px 24px rgba(0,0,0,0.35); }
    #lc-btn svg { width: 28px; height: 28px; fill: #fff; }
    #lc-btn.lc-open .lc-icon-chat { display: none; }
    #lc-btn:not(.lc-open) .lc-icon-close { display: none; }
    #lc-btn.lc-pulse { animation: lc-ring 1.8s ease-out 3; }
    #lc-unread {
      position: absolute; top: -4px; right: -4px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #16a34a; border: 2px solid #fff;
      font-size: 10px; font-weight: 700; color: #fff;
      display: none; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #lc-btn.lc-has-unread #lc-unread { display: flex; }
    @keyframes lc-ring {
      0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(207,16,45,0.5); }
      35%  { transform: scale(1.1); box-shadow: 0 0 0 14px rgba(207,16,45,0); }
      70%  { transform: scale(1); }
      100% { box-shadow: 0 0 0 0 rgba(207,16,45,0); }
    }

    /* Proactive teaser — minimal live-chat card: avatar + message + "Lucy · now" */
    #lc-teaser {
      position: fixed; bottom: 96px; right: 24px; z-index: 99998;
      max-width: 330px; cursor: pointer;
      animation: lc-teaser-in 0.4s cubic-bezier(.34,1.2,.64,1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    @keyframes lc-teaser-in {
      from { transform: scale(0.85) translateY(14px); opacity: 0; }
      to   { transform: scale(1) translateY(0); opacity: 1; }
    }
    .lc-teaser-card {
      display: flex; gap: 11px; align-items: flex-start;
      background: #fff; border-radius: 16px; padding: 14px 16px;
      box-shadow: 0 6px 28px rgba(0,0,0,0.16), 0 1px 3px rgba(0,0,0,0.08);
      position: relative;
    }
    .lc-teaser-ava {
      width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
    }
    .lc-teaser-content { min-width: 0; }
    .lc-teaser-q {
      color: #111; font-size: 14.5px; font-weight: 500; line-height: 1.4;
      transition: opacity 0.25s; min-height: 20px;
    }
    .lc-teaser-q.lc-fade { opacity: 0; }
    .lc-teaser-meta { font-size: 12.5px; color: #9ca3af; margin-top: 4px; }
    .lc-teaser-meta b { color: #6b7280; font-weight: 600; }
    .lc-teaser-x {
      position: absolute; top: -9px; left: -9px;
      width: 22px; height: 22px; border-radius: 50%;
      background: #fff; border: 1px solid #e5e7eb; color: #9ca3af; cursor: pointer;
      font-size: 11px; line-height: 1; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
    }
    .lc-teaser-x:hover { color: #374151; }
    .lc-teaser-btns { display: flex; gap: 7px; margin-top: 9px; justify-content: flex-end; flex-wrap: wrap; }
    .lc-teaser-btn {
      background: var(--lc, #cf102d); color: #fff; border: none; border-radius: 16px;
      padding: 8px 15px; font-size: 13.5px; font-weight: 700; cursor: pointer;
      font-family: inherit; transition: transform 0.12s, box-shadow 0.15s;
      box-shadow: 0 2px 8px rgba(207,16,45,0.28); animation: lc-fadein 0.3s ease both;
    }
    .lc-teaser-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(207,16,45,0.38); }
    .lc-teaser-btn.lc-sec {
      background: #fff; color: #374151; border: 1.5px solid #e5e7eb; box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    .lc-teaser-btn.lc-sec:hover { border-color: #9ca3af; }
    #lc-teaser .lc-typing { padding: 2px 0; background: none; }

    /* Panel */
    #lc-panel {
      position: fixed; bottom: 100px; right: 24px; z-index: 99998;
      width: 380px; height: 580px; max-height: calc(100vh - 120px);
      background: #fff; border-radius: 20px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.2);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transform: scale(0.88) translateY(24px); opacity: 0; pointer-events: none;
      transition: transform 0.28s cubic-bezier(.34,1.2,.64,1), opacity 0.22s ease;
    }
    #lc-panel.lc-open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }
    @media (min-width: 441px) {
      #lc-panel { top: 20px; bottom: 20px; height: auto; max-height: none; }
    }

    /* Header */
    #lc-head {
      background: var(--lc, #cf102d); color: #fff;
      padding: 14px 16px; display: flex; align-items: center; gap: 10px; flex-shrink: 0;
    }
    .lc-back-btn {
      background: rgba(255,255,255,0.2); border: none; cursor: pointer; color: #fff;
      width: 32px; height: 32px; border-radius: 50%;
      display: none; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0; transition: background 0.15s;
    }
    .lc-back-btn:hover { background: rgba(255,255,255,0.35); }
    .lc-back-btn.lc-visible { display: flex; }
    .lc-avatar {
      width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center; font-size: 19px; flex-shrink: 0;
    }
    .lc-head-info { flex: 1; }
    .lc-head-name { font-weight: 700; font-size: 15px; }
    .lc-head-status { font-size: 12px; opacity: 0.85; display: flex; align-items: center; gap: 5px; margin-top: 1px; }
    .lc-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; flex-shrink: 0; }
    #lc-close { background: none; border: none; cursor: pointer; color: #fff; opacity: 0.8; font-size: 20px; line-height: 1; padding: 4px; flex-shrink: 0; }
    #lc-close:hover { opacity: 1; }

    /* Home screen */
    #lc-home { flex: 1; overflow-y: auto; padding: 18px 16px 12px; display: flex; flex-direction: column; }
    .lc-greeting-bubble {
      background: #f3f4f6; border-radius: 0 16px 16px 16px;
      padding: 13px 15px; font-size: 14px; line-height: 1.5; color: #111;
      margin-bottom: 18px; align-self: flex-start; max-width: 90%;
    }
    .lc-qa-label { font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 10px; }
    .lc-qa-list { display: flex; flex-direction: column; gap: 8px; }
    .lc-qa-btn {
      width: 100%; background: #fff; border: 1.5px solid #e5e7eb;
      border-radius: 12px; padding: 12px 16px; text-align: left;
      font-size: 14px; color: #111; cursor: pointer; line-height: 1.4;
      transition: border-color 0.15s, background 0.15s, color 0.15s; font-family: inherit;
    }
    .lc-qa-btn:hover { border-color: var(--lc, #cf102d); background: #fff5f5; color: var(--lc, #cf102d); }
    .lc-leave-details { margin-top: 16px; text-align: center; font-size: 13px; color: #9ca3af; }
    .lc-leave-details a { color: var(--lc, #cf102d); text-decoration: none; cursor: pointer; }
    .lc-leave-details a:hover { text-decoration: underline; }

    /* Symptom intake chips */
    .lc-symptom-label { font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: 0.06em; text-transform: uppercase; margin: 0 0 10px; }
    .lc-symptom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }
    .lc-symptom-btn {
      background: #fff; border: 1.5px solid #e5e7eb; border-radius: 12px;
      padding: 10px 12px; text-align: left; font-size: 13px; color: #374151;
      cursor: pointer; line-height: 1.35; font-family: inherit;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
      display: flex; flex-direction: row; align-items: center; gap: 8px;
    }
    .lc-symptom-btn:hover { border-color: var(--lc, #cf102d); background: #fff5f5; box-shadow: 0 2px 8px rgba(207,16,45,0.08); }
    .lc-symptom-icon { font-size: 20px; flex-shrink: 0; }
    .lc-symptom-text { font-weight: 600; color: #111; font-size: 13px; }

    /* Chat */
    #lc-chat { flex: 1; overflow-y: auto; padding: 14px 14px 8px; display: flex; flex-direction: column; gap: 10px; }
    .lc-msg { max-width: 84%; padding: 11px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
    .lc-msg-bot { background: #f3f4f6; color: #111; border-bottom-left-radius: 4px; align-self: flex-start; }
    .lc-msg-user { background: var(--lc, #cf102d); color: #fff; border-bottom-right-radius: 4px; align-self: flex-end; }
    /* Bot rows carry the agent's photo beside every bubble — real live-chat feel */
    .lc-bot-row { display: flex; gap: 7px; align-items: flex-end; align-self: flex-start; max-width: 92%; }
    .lc-bot-avatar {
      width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
      box-shadow: 0 1px 4px rgba(0,0,0,0.16); margin-bottom: 2px;
    }
    .lc-bot-row .lc-msg-bot { max-width: 100%; }
    .lc-suggestions, .lc-product-cards { margin-left: 35px; }
    .lc-typing { display: flex; gap: 4px; padding: 12px 16px; align-items: center; align-self: flex-start; background: #f3f4f6; border-radius: 16px; border-bottom-left-radius: 4px; }
    .lc-dot { width: 7px; height: 7px; border-radius: 50%; background: #9ca3af; animation: lc-bounce 1.2s infinite ease-in-out; }
    .lc-dot:nth-child(2) { animation-delay: 0.2s; }
    .lc-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes lc-bounce { 0%,80%,100%{transform:scale(0.75);opacity:0.5} 40%{transform:scale(1.1);opacity:1} }

    /* Suggestion chips */
    .lc-suggestions { display: flex; flex-wrap: wrap; gap: 6px; align-self: flex-start; max-width: 100%; animation: lc-fadein 0.2s ease; }
    .lc-chip {
      background: #fff; border: 1.5px solid #e5e7eb; border-radius: 20px;
      padding: 6px 13px; font-size: 13px; color: #374151; cursor: pointer;
      font-family: inherit; transition: border-color 0.15s, background 0.15s, color 0.15s;
      white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis;
    }
    .lc-chip:hover { border-color: var(--lc, #cf102d); background: #fff5f5; color: var(--lc, #cf102d); }

    /* Product cards */
    .lc-product-cards { display: flex; flex-direction: column; gap: 8px; align-self: stretch; animation: lc-fadein 0.2s ease; }
    .lc-product-card {
      display: flex; align-items: center; gap: 12px;
      background: #fff; border: 1.5px solid #e5e7eb; border-radius: 12px;
      padding: 10px 12px; text-decoration: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .lc-product-card:hover { border-color: var(--lc, #cf102d); box-shadow: 0 2px 12px rgba(207,16,45,0.1); }
    .lc-product-img { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #f9fafb; }
    .lc-product-info { flex: 1; min-width: 0; }
    .lc-product-name { font-size: 13px; font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lc-product-cta { font-size: 12px; color: var(--lc, #cf102d); margin-top: 2px; font-weight: 600; }

    @keyframes lc-fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

    /* Lead capture */
    .lc-capture-card {
      background: #f8fafc; border: 1.5px solid #e5e7eb; border-radius: 14px;
      padding: 14px; margin: 4px 0; align-self: stretch;
    }
    .lc-capture-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 10px; }
    .lc-capture-input {
      width: 100%; border: 1.5px solid #e5e7eb; border-radius: 8px;
      padding: 9px 12px; font-size: 13px; margin-bottom: 8px;
      box-sizing: border-box; font-family: inherit; outline: none; transition: border-color 0.15s;
    }
    .lc-capture-input:focus { border-color: var(--lc, #cf102d); }
    .lc-capture-btn {
      width: 100%; background: var(--lc, #cf102d); color: #fff;
      border: none; border-radius: 8px; padding: 10px;
      font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s;
    }
    .lc-capture-btn:hover { background: #a80d24; }
    .lc-capture-thanks { font-size: 13px; color: #16a34a; font-weight: 600; text-align: center; padding: 4px 0; }
    .lc-capture-microcopy { font-size: 11px; color: #9ca3af; font-style: italic; text-align: center; margin-top: 7px; }
    .lc-capture-dismiss { text-align: right; margin-bottom: 6px; }
    .lc-capture-dismiss button { background: none; border: none; font-size: 11px; color: #9ca3af; cursor: pointer; padding: 0; }
    .lc-capture-dismiss button:hover { color: #6b7280; }

    /* Full-width 10%-off button */
    .lc-discount-btn {
      width: 100%; display: flex; align-items: center; justify-content: center; gap: 9px;
      background: linear-gradient(135deg, #004a88 0%, #0a63b0 100%); color: #fff;
      border: none; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px;
      font-size: 15px; font-weight: 800; letter-spacing: 0.01em; cursor: pointer;
      font-family: inherit; box-shadow: 0 3px 12px rgba(0,74,136,0.28);
      transition: transform 0.15s, box-shadow 0.15s; animation: lc-pulse 2.4s ease-in-out infinite;
    }
    .lc-discount-btn:hover { transform: translateY(-1px); box-shadow: 0 5px 18px rgba(0,74,136,0.36); }
    .lc-discount-emoji { font-size: 19px; }
    @keyframes lc-pulse { 0%,100%{box-shadow:0 3px 12px rgba(0,74,136,0.28)} 50%{box-shadow:0 3px 20px rgba(0,74,136,0.5)} }

    /* Discount flow — concern buttons + code reveal (inside chat) */
    .lc-discount-choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-self: stretch; margin: 2px 0 4px; animation: lc-fadein 0.2s ease; }
    .lc-discount-choice {
      background: #fff; border: 1.5px solid #e5e7eb; border-radius: 12px;
      padding: 10px 12px; text-align: left; font-size: 13px; color: #111;
      cursor: pointer; line-height: 1.3; font-family: inherit; font-weight: 600;
      display: flex; align-items: center; gap: 8px; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    .lc-discount-choice:hover { border-color: #004a88; background: #f0f6fc; box-shadow: 0 2px 8px rgba(0,74,136,0.1); }
    .lc-code-reveal {
      align-self: stretch; background: #f0f6fc; border: 2px dashed #004a88; border-radius: 14px;
      padding: 16px; text-align: center; margin: 4px 0; animation: lc-fadein 0.25s ease;
    }
    .lc-code-value {
      font-size: 24px; font-weight: 800; letter-spacing: 0.08em; color: #004a88;
      font-family: 'Courier New', monospace; margin: 4px 0 10px; user-select: all;
    }
    .lc-code-copy {
      background: #004a88; color: #fff; border: none; border-radius: 8px;
      padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background 0.15s;
    }
    .lc-code-copy:hover { background: #003a6d; }
    .lc-code-shop {
      display: inline-block; margin-top: 10px; font-size: 13px; font-weight: 700;
      color: var(--lc, #cf102d); text-decoration: none;
    }
    .lc-code-shop:hover { text-decoration: underline; }

    /* Input row — light-blue highlight so customers know they can type */
    #lc-input-row { padding: 10px 12px 14px; border-top: 1px solid #dbeafe; background: #eaf3fb; display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
    #lc-input {
      flex: 1; border: 1.5px solid #bcd7f0; border-radius: 24px; background: #fff;
      padding: 10px 16px; font-size: 14px; outline: none; font-family: inherit;
      transition: border-color 0.15s; resize: none; max-height: 80px; line-height: 1.4;
    }
    #lc-input:focus { border-color: #004a88; }
    #lc-input::placeholder { color: #6b8bad; }
    #lc-send {
      width: 40px; height: 40px; border-radius: 50%; background: var(--lc, #cf102d);
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background 0.15s, transform 0.15s;
    }
    #lc-send:hover { background: #a80d24; transform: scale(1.05); }
    #lc-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    #lc-send svg { width: 17px; height: 17px; fill: #fff; }
    #lc-powered { text-align: center; font-size: 11px; color: #d1d5db; padding: 0 0 6px; flex-shrink: 0; }

    @media (max-width: 440px) {
      #lc-panel { width: calc(100vw - 20px); right: 10px; bottom: 80px; }
      #lc-btn { right: 10px; }
      #lc-teaser { right: 10px; width: calc(100vw - 84px); max-width: 268px; }
      #lc-btn { width: 44px; height: 44px; bottom: 18px; }
      #lc-btn svg { width: 20px; height: 20px; }
    }
  `;

  // ── Build DOM ────────────────────────────────────────────────────────────────
  function build() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var btn = el('button', { id: 'lc-btn', 'aria-label': 'Open chat' });
    btn.innerHTML =
      '<svg class="lc-icon-chat" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' +
      '<svg class="lc-icon-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' +
      '<span id="lc-unread" aria-label="New message"></span>';
    btn.onclick = toggle;
    document.body.appendChild(btn);

    var panel = el('div', { id: 'lc-panel', role: 'dialog', 'aria-label': 'Ask Lacalut' });
    panel.innerHTML =
      '<div id="lc-head">' +
        '<div class="lc-avatar"><img id="lc-head-ava" src="' + AGENT_AVATAR + '" alt="' + AGENT_NAME + ' from LACALUT" style="width:38px;height:38px;border-radius:50%;object-fit:cover;background:#fff;" /></div>' +
        '<div class="lc-head-info">' +
          '<div class="lc-head-name" id="lc-head-name">' + AGENT_NAME + ' · LACALUT</div>' +
          '<div class="lc-head-status"><span class="lc-status-dot"></span>Online now — replies in seconds</div>' +
        '</div>' +
        '<button class="lc-back-btn" id="lc-back" aria-label="Go back">←</button>' +
        '<button id="lc-close" aria-label="Close">&#10005;</button>' +
      '</div>' +
      '<div id="lc-home">' +
        '<div class="lc-bot-row" style="margin-bottom:18px"><img class="lc-bot-avatar" src="' + AGENT_AVATAR + '" alt="Lucy — LACALUT chat assistant" /><div class="lc-greeting-bubble" id="lc-greeting-text" style="margin-bottom:0">' + config.greeting + '</div></div>' +
        '<p class="lc-symptom-label">What brings you here today?</p>' +
        '<button id="lc-discount-btn" class="lc-discount-btn"><span class="lc-discount-emoji">🎁</span><span class="lc-discount-text">Get 10% Off Code</span></button>' +
        '<div class="lc-symptom-grid" id="lc-symptom-grid"></div>' +
        '<div id="lc-qas-section" style="display:none">' +
          '<p class="lc-qa-label" style="margin-top:14px">⚡ Instant Answers</p>' +
          '<div class="lc-qa-list" id="lc-qas-list"></div>' +
        '</div>' +
        '<div class="lc-qa-label">Quick Questions</div>' +
        '<div class="lc-qa-list" id="lc-qa-list"></div>' +
        '<div class="lc-leave-details">or <a onclick="lcShowHomeCapture()">leave your email for a personal reply</a></div>' +
      '</div>' +
      '<div id="lc-chat" style="display:none"></div>' +
      '<div id="lc-input-row">' +
        '<input id="lc-input" type="text" placeholder="Type your own question here…" autocomplete="off" />' +
        '<button id="lc-send" aria-label="Send" disabled>' +
          '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
        '</button>' +
      '</div>' +
      '<div id="lc-powered">Powered by Lacalut AI</div>';
    document.body.appendChild(panel);

    document.getElementById('lc-close').onclick = toggle;
    document.getElementById('lc-back').onclick = goHome;
    document.getElementById('lc-discount-btn').onclick = startDiscountFlow;

    var input = document.getElementById('lc-input');
    var sendBtn = document.getElementById('lc-send');
    input.addEventListener('input', function () { sendBtn.disabled = !this.value.trim(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !isBusy) { e.preventDefault(); send(); }
    });
    sendBtn.onclick = send;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  // ── Config ───────────────────────────────────────────────────────────────────
  function applyConfig() {
    document.documentElement.style.setProperty('--lc', config.brand_colour || BRAND);
    var greetingEl = document.getElementById('lc-greeting-text');
    if (greetingEl) greetingEl.textContent = config.greeting;

    var headName = document.getElementById('lc-head-name');
    if (headName) headName.textContent = agentName() + ' · LACALUT';
    var headAva = document.getElementById('lc-head-ava');
    if (headAva && headAva.src !== agentAvatar()) headAva.src = agentAvatar();

    var grid = document.getElementById('lc-symptom-grid');
    if (grid) {
      grid.innerHTML = '';
      SYMPTOMS.forEach(function (s) {
        var btn = document.createElement('button');
        btn.className = 'lc-symptom-btn';
        btn.innerHTML = '<span class="lc-symptom-icon">' + s.icon + '</span><span class="lc-symptom-text">' + s.label.replace('\n', '<br>') + '</span>';
        btn.onclick = function () { startChat(s.message); };
        grid.appendChild(btn);
      });
    }

    var list = document.getElementById('lc-qa-list');
    if (!list) return;
    list.innerHTML = '';
    try {
      JSON.parse(config.suggested_questions).slice(0, 6).forEach(function (q) {
        var btn = document.createElement('button');
        btn.className = 'lc-qa-btn';
        btn.textContent = q;
        btn.onclick = function () { startChat(q); };
        list.appendChild(btn);
      });
    } catch (e) {}
  }

  // ── Proactive trigger ────────────────────────────────────────────────────────
  function setupProactiveTrigger() {
    if (config.teaser_enabled === 'false' || config.teaser_enabled === false) return;
    var delay = parseInt(config.proactive_delay || '8000', 10);
    if (!delay || sessionStorage.getItem('lc_nudge_shown')) return;
    setTimeout(function () {
      if (isOpen || sessionStorage.getItem('lc_nudge_shown')) return;
      sessionStorage.setItem('lc_nudge_shown', '1');
      showNudge();
    }, delay);
  }

  var teaserRotateTimer, teaserAnswerTimer;

  // Page-aware opening hook — matches keywords in the URL to the most relevant offer.
  // Order matters: most specific (dentists) first, generic 10%-off last.
  function getPageTeaser() {
    var p = (location.pathname + ' ' + location.search).toLowerCase();
    function has() { for (var i = 0; i < arguments.length; i++) { if (p.indexOf(arguments[i]) > -1) return true; } return false; }
    if (has('dentist', 'for-professional', 'professionals', 'wholesale', 'clinic'))
      return { q: 'Want ongoing free samples for your clinic? 🦷', a: 'Yes please 👍', cta: 'Count me in ›' };
    if (has('flora', 'bad-breath', 'breath'))
      return { q: 'Want 10% off our bad-breath range? 🎁', a: 'Yes please 👍', cta: 'Get my code ›' };
    if (has('sensitive'))
      return { q: 'Want 10% off for sensitive teeth? 🎁', a: 'Yes please 👍', cta: 'Get my code ›' };
    if (has('white', 'repair', 'whiten', 'stain'))
      return { q: 'Want 10% off our whitening range? 🎁', a: 'Yes please 👍', cta: 'Get my code ›' };
    if (has('mouthwash', 'rinse'))
      return { q: 'Want 10% off our mouthwash? 🎁', a: 'Yes please 👍', cta: 'Get my code ›' };
    if (has('aktiv', 'herbal', 'gum', 'bleeding'))
      return { q: 'Want 10% off our gum-care range? 🎁', a: 'Yes please 👍', cta: 'Get my code ›' };
    return { q: 'Want a 10% off code? 🎁', a: 'Yes please 👍', cta: 'Get my code ›' };
  }

  // Which opener greets this visitor. The pointer lives in localStorage and
  // advances every time a teaser is shown, so repeat visitors keep seeing a
  // fresh opener — 10% off, quizzes, fun facts, Smile Club — recycled in turn.
  function nextOpener(openers) {
    var i = parseInt(localStorage.getItem('lc_opener_i') || '0', 10) || 0;
    var opener = openers[i % openers.length];
    try { localStorage.setItem('lc_opener_i', String((i + 1) % openers.length)); } catch (e) {}
    return opener;
  }

  function showNudge() {
    var teaser = document.createElement('div');
    teaser.id = 'lc-teaser';
    teaser.innerHTML =
      '<div class="lc-teaser-card">' +
        '<button class="lc-teaser-x" id="lc-teaser-x" aria-label="Dismiss">&#10005;</button>' +
        '<img class="lc-teaser-ava" src="' + agentAvatar() + '" alt="" />' +
        '<div class="lc-teaser-content">' +
          '<div class="lc-teaser-q" id="lc-teaser-q"></div>' +
          '<div class="lc-teaser-meta"><b>' + agentName() + '</b> · now</div>' +
        '</div>' +
      '</div>' +
      '<div class="lc-teaser-btns" id="lc-teaser-btns"></div>';

    document.getElementById('lc-teaser') && document.getElementById('lc-teaser').remove();
    document.body.appendChild(teaser);

    document.getElementById('lc-teaser-x').addEventListener('click', function (e) {
      e.stopPropagation();
      removeTeaser();
    });
    // Clicking anywhere else on the card just opens the chat.
    teaser.addEventListener('click', function () { removeTeaser(); toggle(); });
    // Pause rotation while the visitor is reading / hovering. On touch devices
    // the first tap pauses rotation for good — mid-answer vanishing is the
    // single most frustrating thing a teaser can do.
    teaser.addEventListener('mouseenter', function () { clearTimeout(teaserRotateTimer); });
    teaser.addEventListener('mouseleave', function () { scheduleTeaserRotate(); });
    teaser.addEventListener('touchstart', function () { clearTimeout(teaserRotateTimer); }, { passive: true });

    playOpener(nextOpener(getOpeners()));

    var btn = document.getElementById('lc-btn');
    btn.classList.add('lc-pulse');
    setTimeout(function () { btn.classList.remove('lc-pulse'); }, 6000);
  }

  // Types the opener into the teaser like a human: typing dots first, then the
  // message, then the tappable answer buttons.
  function playOpener(opener) {
    var qEl = document.getElementById('lc-teaser-q');
    var btnsEl = document.getElementById('lc-teaser-btns');
    if (!qEl || !btnsEl || !opener) return;

    var question = opener.q || getPageTeaser().q;
    qEl.classList.remove('lc-fade');
    btnsEl.innerHTML = '';
    qEl.innerHTML = '<div class="lc-typing" style="padding:2px 0;background:none"><div class="lc-dot"></div><div class="lc-dot"></div><div class="lc-dot"></div></div>';

    clearTimeout(teaserAnswerTimer);
    teaserAnswerTimer = setTimeout(function () {
      if (!document.getElementById('lc-teaser')) return;
      qEl.textContent = question;
      (opener.buttons || []).forEach(function (b, i) {
        var btn = document.createElement('button');
        btn.className = 'lc-teaser-btn' + (i > 0 ? ' lc-sec' : '');
        btn.textContent = b.label;
        btn.style.animationDelay = (0.15 + i * 0.12) + 's';
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          handleOpenerAnswer(opener, b);
        });
        btnsEl.appendChild(btn);
      });
      scheduleTeaserRotate();
    }, 1200);
  }

  function scheduleTeaserRotate() {
    var rotateMs = (parseInt(config.teaser_rotate_ms || '4500', 10) || 4500) * 5;
    clearTimeout(teaserRotateTimer);
    teaserRotateTimer = setTimeout(function () {
      var qEl = document.getElementById('lc-teaser-q');
      if (!qEl) return;
      qEl.classList.add('lc-fade');
      setTimeout(function () {
        if (!document.getElementById('lc-teaser')) return;
        playOpener(nextOpener(getOpeners()));
      }, 300);
    }, rotateMs);
  }

  // A teaser answer button was tapped — carry the conversation into the chat
  // panel: the visitor's answer as their bubble, then Mia's scripted reply.
  function handleOpenerAnswer(opener, btn) {
    removeTeaser();
    if (!isOpen) toggle();
    enterChatMode();

    if (btn.action === 'discount') { startDiscountFlow(); return; }

    appendMsg('user', btn.label);
    var typingEl = showTyping();
    setTimeout(function () {
      typingEl.remove();
      var botDiv = appendMsg('bot', '');
      typeMessage(botDiv, btn.reply || '', function () {
        if (btn.link && btn.link.url) {
          var chat = document.getElementById('lc-chat');
          var wrap = document.createElement('div');
          wrap.className = 'lc-product-cards';
          wrap.innerHTML =
            '<a class="lc-product-card" href="' + btn.link.url + '" target="_blank" rel="noopener" style="justify-content:center">' +
              '<div class="lc-product-cta" style="font-size:14px">' + btn.link.label + '</div>' +
            '</a>';
          chat.appendChild(wrap);
          chat.scrollTop = chat.scrollHeight;
        }
        if (btn.offer) {
          var chat2 = document.getElementById('lc-chat');
          var offerWrap = document.createElement('div');
          offerWrap.className = 'lc-suggestions';
          var offerBtn = document.createElement('button');
          offerBtn.className = 'lc-chip';
          offerBtn.textContent = '🎁 Get my 10% code';
          offerBtn.onclick = function () { offerWrap.remove(); startDiscountFlow(); };
          offerWrap.appendChild(offerBtn);
          chat2.appendChild(offerWrap);
          chat2.scrollTop = chat2.scrollHeight;
        }
        showProductCards(btn.reply || '');
      });
    }, 900);
  }

  function removeTeaser() {
    clearTimeout(teaserRotateTimer);
    clearTimeout(teaserAnswerTimer);
    var t = document.getElementById('lc-teaser');
    if (t) t.remove();
  }

  // ── Open / close ─────────────────────────────────────────────────────────────
  function setUnread(count) {
    unreadCount = count;
    var btn = document.getElementById('lc-btn');
    var badge = document.getElementById('lc-unread');
    if (!btn || !badge) return;
    if (count > 0 && !isOpen) {
      btn.classList.add('lc-has-unread');
      badge.textContent = count > 9 ? '9+' : count;
    } else {
      btn.classList.remove('lc-has-unread');
      badge.textContent = '';
    }
  }

  function toggle() {
    isOpen = !isOpen;
    document.getElementById('lc-panel').classList.toggle('lc-open', isOpen);
    document.getElementById('lc-btn').classList.toggle('lc-open', isOpen);
    removeTeaser();
    if (isOpen) {
      setUnread(0);
      setTimeout(function () { if (mode === 'home') document.getElementById('lc-input').focus(); }, 300);
    }
  }

  function goHome() {
    mode = 'home';
    document.getElementById('lc-home').style.display = 'flex';
    document.getElementById('lc-home').style.flexDirection = 'column';
    document.getElementById('lc-chat').style.display = 'none';
    document.getElementById('lc-back').classList.remove('lc-visible');
  }

  // ── Lead capture ─────────────────────────────────────────────────────────────
  window.lcShowHomeCapture = function () {
    if (document.getElementById('lc-home-capture')) return;
    var card = document.createElement('div');
    card.id = 'lc-home-capture';
    card.className = 'lc-capture-card';
    card.innerHTML =
      '<div class="lc-capture-dismiss"><button onclick="document.getElementById(\'lc-home-capture\').remove()">✕ Close</button></div>' +
      '<div class="lc-capture-title">Leave your details and we\'ll get back to you personally.</div>' +
      '<input class="lc-capture-input" id="lc-hcap-email" type="email" placeholder="Email address (optional)" />' +
      '<input class="lc-capture-input" id="lc-hcap-phone" type="tel" placeholder="Phone number (optional)" />' +
      '<button class="lc-capture-btn" onclick="lcSubmitCapture(\'lc-hcap-email\',\'lc-hcap-phone\',\'lc-home-capture\')">Save details</button>';
    document.getElementById('lc-home').appendChild(card);
    card.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('lc-hcap-email').focus();
  };

  window.lcSubmitCapture = function (emailId, phoneId, cardId) {
    var email = (document.getElementById(emailId).value || '').trim();
    var phone = (document.getElementById(phoneId).value || '').trim();
    if (!email && !phone) { document.getElementById(emailId).focus(); return; }
    document.getElementById(cardId).innerHTML = '<div class="lc-capture-thanks">Thanks! We\'ll be in touch soon.</div>';
    fetch(WORKER_URL + '/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, email: email, phone: phone }),
    }).catch(function () {});
  };

  // ── 10%-off discount flow ─────────────────────────────────────────────────────
  var discountChoice = null;

  function enterChatMode() {
    if (mode === 'home') {
      mode = 'chat';
      document.getElementById('lc-home').style.display = 'none';
      var chat = document.getElementById('lc-chat');
      chat.style.display = 'flex';
      chat.style.flexDirection = 'column';
      document.getElementById('lc-back').classList.add('lc-visible');
    }
  }

  function startDiscountFlow() {
    enterChatMode();
    appendMsg('bot', "Awesome — 10% off your first order! 🎁 Which product would you like your 10% off on?");
    var chat = document.getElementById('lc-chat');
    var grid = document.createElement('div');
    grid.className = 'lc-discount-choices';
    SYMPTOMS.forEach(function (s) {
      var b = document.createElement('button');
      b.className = 'lc-discount-choice';
      b.innerHTML = '<span class="lc-symptom-icon">' + s.icon + '</span><span>' + s.concern + '</span>';
      b.onclick = function () { pickDiscountConcern(s, grid); };
      grid.appendChild(b);
    });
    chat.appendChild(grid);
    chat.scrollTop = chat.scrollHeight;
  }

  function pickDiscountConcern(s, gridEl) {
    discountChoice = s;
    if (gridEl) gridEl.remove();
    appendMsg('user', s.concern);
    appendMsg('bot', "Great choice! Pop your email in below and I'll unlock your 10% code 👇");
    var chat = document.getElementById('lc-chat');
    var card = document.createElement('div');
    card.className = 'lc-capture-card';
    card.id = 'lc-discount-capture';
    card.innerHTML =
      '<div class="lc-capture-title">Your email</div>' +
      '<input class="lc-capture-input" id="lc-dcap-email" type="email" placeholder="you@email.com" autocomplete="email" />' +
      '<button class="lc-capture-btn" onclick="lcSubmitDiscountEmail()">UNLOCK MY 10% CODE</button>' +
      '<div class="lc-capture-microcopy">because I love a good deal</div>';
    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;
    var inp = document.getElementById('lc-dcap-email');
    inp.focus();
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); lcSubmitDiscountEmail(); } });
  }

  window.lcSubmitDiscountEmail = function () {
    var inp = document.getElementById('lc-dcap-email');
    var email = (inp.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      inp.style.borderColor = '#dc2626';
      inp.focus();
      return;
    }
    var card = document.getElementById('lc-discount-capture');
    if (card) card.innerHTML = '<div class="lc-capture-thanks">Unlocking your code…</div>';

    fetch(WORKER_URL + '/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, email: email, oral_concern: (discountChoice || {}).concern || '', source: 'discount-10' }),
    }).catch(function () {});

    revealDiscountCode();
  };

  function revealDiscountCode() {
    var card = document.getElementById('lc-discount-capture');
    var s = discountChoice || {};
    var html =
      '<div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:2px">🎉 Here\'s your code — 10% off your first order:</div>' +
      '<div class="lc-code-value" id="lc-code-value">' + DISCOUNT_CODE + '</div>' +
      '<button class="lc-code-copy" onclick="lcCopyCode()">Copy code</button>' +
      (s.url ? '<div><a class="lc-code-shop" href="' + s.url + '" target="_blank" rel="noopener">Shop ' + s.range + ' →</a></div>' : '') +
      '<div style="font-size:11px;color:#6b7280;margin-top:9px">Enter it at checkout. One use per customer.</div>';
    if (card) { card.className = 'lc-code-reveal'; card.innerHTML = html; }
    var chat = document.getElementById('lc-chat');
    chat.scrollTop = chat.scrollHeight;
  }

  window.lcCopyCode = function () {
    var v = document.getElementById('lc-code-value');
    var text = v ? v.textContent : DISCOUNT_CODE;
    var done = function () { var btn = document.querySelector('.lc-code-copy'); if (btn) { btn.textContent = 'Copied ✓'; setTimeout(function () { btn.textContent = 'Copy code'; }, 2000); } };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else {
      var r = document.createRange(); r.selectNode(v); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      try { document.execCommand('copy'); } catch (e) {}
      sel.removeAllRanges(); done();
    }
  };

  // ── Chat mode ────────────────────────────────────────────────────────────────
  function startChat(question) {
    if (mode === 'home') {
      mode = 'chat';
      document.getElementById('lc-home').style.display = 'none';
      document.getElementById('lc-chat').style.display = 'flex';
      document.getElementById('lc-chat').style.flexDirection = 'column';
      document.getElementById('lc-back').classList.add('lc-visible');
    }
    sendText(question);
  }

  function send() {
    var input = document.getElementById('lc-input');
    var text = (input.value || '').trim();
    if (!text || isBusy) return;
    input.value = '';
    document.getElementById('lc-send').disabled = true;
    startChat(text);
  }

  function sendText(text) {
    isBusy = true;
    appendMsg('user', text);
    var typingEl = showTyping();

    fetch(WORKER_URL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        typingEl.remove();
        var reply = d.reply || 'Sorry, something went wrong. Please try again.';
        var suggestions = d.suggestions || [];
        var botDiv = appendMsg('bot', '');
        typeMessage(botDiv, reply, function () {
          isBusy = false;
          document.getElementById('lc-send').disabled = !document.getElementById('lc-input').value.trim();
          if (d.escalate) {
            // Human requested / urgent — offer the SMS text-back handoff only.
            showSmsEscalation();
          } else {
            showSuggestions(suggestions);
            showProductCards(reply);
            maybeShowCapture();
          }
          if (!isOpen) setUnread(unreadCount + 1);
        });
      })
      .catch(function () {
        typingEl.remove();
        isBusy = false;
        appendMsg('bot', 'I\'m having trouble connecting right now. Please email hello@lacalut.com.au.');
      });
  }

  function renderBotText(div, text) {
    div.innerHTML = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  // ── Typewriter effect ────────────────────────────────────────────────────────
  function typeMessage(div, text, onComplete) {
    var chat = document.getElementById('lc-chat');
    // Skip animation for long replies — instant render
    if (text.length > 280) {
      renderBotText(div, text);
      chat.scrollTop = chat.scrollHeight;
      if (onComplete) onComplete();
      return;
    }
    var i = 0;
    (function next() {
      if (i < text.length) {
        i++;
        renderBotText(div, text.slice(0, i));
        chat.scrollTop = chat.scrollHeight;
        setTimeout(next, 18);
      } else if (onComplete) {
        onComplete();
      }
    })();
  }

  // ── Suggestion chips ─────────────────────────────────────────────────────────
  function showSuggestions(suggestions) {
    if (!suggestions || !suggestions.length) return;
    var chat = document.getElementById('lc-chat');
    var wrap = document.createElement('div');
    wrap.className = 'lc-suggestions';
    suggestions.forEach(function (s) {
      var chip = document.createElement('button');
      chip.className = 'lc-chip';
      chip.textContent = s;
      chip.onclick = function () { wrap.remove(); sendText(s); };
      wrap.appendChild(chip);
    });
    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
  }

  // ── Product cards ────────────────────────────────────────────────────────────
  function showProductCards(replyText) {
    var lower = replyText.toLowerCase();
    var matched = [];
    for (var i = 0; i < PRODUCTS.length && matched.length < 2; i++) {
      var p = PRODUCTS[i];
      if (p.keywords.some(function (kw) { return lower.indexOf(kw.toLowerCase()) !== -1; })) {
        matched.push(p);
      }
    }
    if (!matched.length) return;

    var chat = document.getElementById('lc-chat');
    var wrap = document.createElement('div');
    wrap.className = 'lc-product-cards';
    matched.forEach(function (p) {
      var a = document.createElement('a');
      a.className = 'lc-product-card';
      a.href = p.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML =
        '<img class="lc-product-img" src="' + p.img + '" alt="" loading="lazy" />' +
        '<div class="lc-product-info">' +
          '<div class="lc-product-name">' + p.name + '</div>' +
          '<div class="lc-product-cta">Shop Now →</div>' +
        '</div>';
      wrap.appendChild(a);
    });
    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
  }

  // ── Message helpers ──────────────────────────────────────────────────────────
  // Bot messages sit in a row beside the agent's photo, like a real live chat.
  function appendMsg(role, text) {
    var chat = document.getElementById('lc-chat');
    var div = document.createElement('div');
    div.className = 'lc-msg lc-msg-' + role;
    div.textContent = text;
    if (role === 'bot') {
      var row = document.createElement('div');
      row.className = 'lc-bot-row';
      row.innerHTML = '<img class="lc-bot-avatar" src="' + agentAvatar() + '" alt="Lucy — LACALUT chat assistant" />';
      row.appendChild(div);
      chat.appendChild(row);
    } else {
      chat.appendChild(div);
    }
    chat.scrollTop = chat.scrollHeight;
    return div;
  }

  function showTyping() {
    var chat = document.getElementById('lc-chat');
    var row = document.createElement('div');
    row.className = 'lc-bot-row';
    row.innerHTML =
      '<img class="lc-bot-avatar" src="' + agentAvatar() + '" alt="Lucy — LACALUT chat assistant" />' +
      '<div class="lc-typing"><div class="lc-dot"></div><div class="lc-dot"></div><div class="lc-dot"></div></div>';
    chat.appendChild(row);
    chat.scrollTop = chat.scrollHeight;
    return row;
  }

  function maybeShowCapture() {
    if (captureShown) return;
    captureShown = true;
    var chat = document.getElementById('lc-chat');
    var card = document.createElement('div');
    card.id = 'lc-chat-capture';
    card.className = 'lc-capture-card';
    card.innerHTML =
      '<div class="lc-capture-dismiss"><button onclick="document.getElementById(\'lc-chat-capture\').remove()">Dismiss</button></div>' +
      '<div class="lc-capture-title">Want a personal reply from our team?</div>' +
      '<input class="lc-capture-input" id="lc-ccap-email" type="email" placeholder="Email address (optional)" />' +
      '<input class="lc-capture-input" id="lc-ccap-phone" type="tel" placeholder="Phone number (optional)" />' +
      '<button class="lc-capture-btn" onclick="lcSubmitCapture(\'lc-ccap-email\',\'lc-ccap-phone\',\'lc-chat-capture\')">Save details</button>';
    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;
  }

  // ── SMS escalation (last resort: human requested / urgent) ───────────────────
  function showSmsEscalation() {
    if (document.getElementById('lc-sms-escalation')) return; // don't stack cards
    var chat = document.getElementById('lc-chat');
    var card = document.createElement('div');
    card.id = 'lc-sms-escalation';
    card.className = 'lc-capture-card';
    card.innerHTML =
      '<div class="lc-capture-dismiss"><button onclick="document.getElementById(\'lc-sms-escalation\').remove()">Dismiss</button></div>' +
      '<div class="lc-capture-title">Leave your mobile and we’ll text you the answer straight away.</div>' +
      '<input class="lc-capture-input" id="lc-scap-phone" type="tel" inputmode="tel" placeholder="Your mobile number" autocomplete="tel" />' +
      '<button class="lc-capture-btn" onclick="lcSubmitSmsEscalation()">Text me back</button>';
    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;
    var inp = document.getElementById('lc-scap-phone');
    if (inp) inp.focus();
  }

  window.lcSubmitSmsEscalation = function () {
    var inp = document.getElementById('lc-scap-phone');
    var phone = (inp.value || '').trim();
    if (phone.replace(/\D/g, '').length < 8) { inp.focus(); return; }
    var card = document.getElementById('lc-sms-escalation');
    if (card) card.innerHTML = '<div class="lc-capture-thanks">Thanks! We’ll text you the answer shortly 📱</div>';
    fetch(WORKER_URL + '/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, phone: phone, source: 'sms-escalation' }),
    }).catch(function () {});
  };

  // ── Quick Answers (instant, no AI) ──────────────────────────────────────────
  function renderQuickQASection() {
    var section = document.getElementById('lc-qas-section');
    var list = document.getElementById('lc-qas-list');
    if (!section || !list) return;
    list.innerHTML = '';
    if (!quickQAs.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    quickQAs.forEach(function (qa) {
      var btn = document.createElement('button');
      btn.className = 'lc-qa-btn';
      btn.textContent = qa.question;
      btn.onclick = function () { showInstantAnswer(qa); };
      list.appendChild(btn);
    });
  }

  function showInstantAnswer(qa) {
    if (mode === 'home') {
      mode = 'chat';
      document.getElementById('lc-home').style.display = 'none';
      document.getElementById('lc-chat').style.display = 'flex';
      document.getElementById('lc-chat').style.flexDirection = 'column';
      document.getElementById('lc-back').classList.add('lc-visible');
    }
    appendMsg('user', qa.question);
    var botDiv = appendMsg('bot', '');
    typeMessage(botDiv, qa.answer, function () {
      showProductCards(qa.answer);
      if (!captureShown) maybeShowCapture();
      if (!isOpen) setUnread(unreadCount + 1);
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    build();
    applyConfig();
    fetch(WORKER_URL + '/config')
      .then(function (r) { return r.json(); })
      .then(function (d) { config = Object.assign(config, d); applyConfig(); setupProactiveTrigger(); })
      .catch(function () { setupProactiveTrigger(); });
    fetch(WORKER_URL + '/quick-qas')
      .then(function (r) { return r.json(); })
      .then(function (data) { quickQAs = data || []; renderQuickQASection(); })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
