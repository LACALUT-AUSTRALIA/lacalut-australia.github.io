/* Rebuild the 41 social-era STRATEGY_BRAINS to Meta-ad-grade direct response (24/09/2026).
   Keeps the 22 already rebuilt overnight untouched. chat-text-message keeps its crafted dims
   and only gains an adapted conversion-law dim. Writes a new strategies.js.
   Run: node gen_brains.js */
'use strict';
const fs = require('fs'), path = require('path');
global.window = globalThis;
const FILE = path.join(__dirname, '..', 'strategies.js');
require(FILE);
const B = global.STRATEGY_BRAINS;

const COL = ['Colour / mood (HIGH CONTRAST — text always instantly legible)',
  'premium navy #004A88 background with WHITE headline and a red #CF102D accent; bold LACALUT red background with WHITE text; clinical white background with navy headline + red accent — never dark text on red, never light text on pale'];
const NATCOL = ['Colour / mood (photoreal scene — overlays HIGH CONTRAST)',
  'natural photoreal scene lighting; any text overlay sits on a soft dark scrim or a clean light zone so it is always HIGH CONTRAST and instantly legible on a phone — never thin type over busy detail'];
const LAW = ['Meta-ad conversion law (this is a PAID Facebook ad, never an organic post)',
  "this creative must SELL to a cold scroller: a customer-centric hook about THEIR feeling/moment (never brand-first), ONE clear benefit payoff in cosmetic feel-language, and a clear CTA pill in a brand colour (e.g. 'Shop Now' / 'Find Yours' / 'Get Yours Today') — NEVER 'save this', 'share', 'follow for more', 'comment below', 'vote' or any engagement-bait; never ask for interaction the ad cannot deliver"];
const LOCK = ['Compliance (cosmetic-only, SKU angle lock)',
  "stick to THIS product's OWN benefit per the SKU angle lock (whitening/stain-lift ONLY for White & Repair, fresh breath ONLY for Flora, gum-care feel ONLY for Aktiv & Aktiv Herbal, gentle comfort ONLY for Sensitive); never borrow another product's angle; no disease words, no percentages or statistics, never 'clinically proven/tested' or 'dermatologically tested', no physiological outcome verbs (strengthens / protects / repairs / firms as a result) — cosmetic feel-language only ('feels firm', 'feels fresh', 'cared-for'); only 'fluoride' and 'hydroxyapatite' may ever be named as ingredients"];

const seasonal = (hook, scene, payoff) => [
  ['Seasonal hook (the customer\'s moment, never brand-first)', hook],
  ['Layout', scene + ' — the REAL German pack (front label, white cap, true proportions) sits hero in the lower third with ONE benefit badge + CTA pill; seasonal props stay behind/beside the pack, never covering it; headline XL top'],
  ['Colour / mood (HIGH CONTRAST — text always instantly legible)', 'seasonal palette allowed but brand red #CF102D owns the logo + CTA pill and every line of text stays high-contrast (white on deep tones, navy on light) — never faint festive script over busy texture'],
  ['Payoff', payoff],
  LOCK, LAW];

const REW = {
'benefit-first': [
  ['Hook (the felt outcome IS the headline)', "open with a HUGE promise headline written as the CUSTOMER's felt outcome — 'Gums That Feel Firm & Cared-For' / 'Fresh That Lasts Past 3pm' — their feeling, their day, never the brand name first"],
  ['Layout', 'XL headline top ~40%; the REAL pack hero in the bottom third (front label, white cap, true tall-slim proportions); MAX three feel-benefit pills beside the pack; ONE CTA pill'],
  COL,
  ['Payoff', 'one plain sub-line gives the reason to believe — the German pharmacy formula and, if an ingredient is named, ONLY fluoride or hydroxyapatite — in everyday words, no jargon'],
  LOCK, LAW],
'trust-proof': [
  ['Hook (heritage as the reason to believe)', "a trust-led headline the customer feels — 'The Toothpaste German Pharmacies Have Trusted Since 1925' / 'Made In Germany. Felt Every Morning.' — heritage in service of THEIR confidence, never a brag"],
  ['Trust cues (REAL ones only)', "ONLY verifiable cues: 'Made in Germany', 'Since 1925', 'German pharmacy-grade' — as clean minimal badges; NEVER invented seals, certification marks, test claims ('Clinically/Dermatologically Tested'), sales counts, star ratings, or any authority logo (no WHO, TGA, dental association, flags-as-endorsement)"],
  ['Layout', 'pack centre hero with 2-3 badge cues arced above or stacked beside; XL headline top; CTA pill bottom'],
  COL,
  ['Payoff', 'one line ties the heritage to the daily feel-benefit — a century of German care, felt in your own morning routine'],
  LAW],
'before-after': [
  ['Hook (a felt shift, never a clinical result)', "BEFORE = the relatable everyday annoyance moment (hiding a smile in photos, cupping a hand at 3pm); AFTER = the confident feel — always cosmetic feel-framing, NEVER measurable or guaranteed results, medical imagery, tooth-shade charts or timelines; a stain-lift visual is allowed ONLY when the product is White & Repair"],
  ['Split style', 'clean vertical 50/50 with an arrow or diagonal seam; the pack stands on the AFTER side with the CTA pill; each side gets a 2-4 word caption chip'],
  ['Colour coding (HIGH CONTRAST)', 'muted/grey-red problem side → bright brand-blue/white solution side; every caption chip high-contrast; brand red on logo + CTA only'],
  ['Payoff', "the AFTER caption is the feel-benefit ('walks into the meeting fresh', 'smiles for the photo') — the product is what changed"],
  LOCK, LAW],
'problem-vs-solution': [
  ['Hook (their problem in their words)', "open on the problem as the customer would text it to a friend — 'Toothpaste That Quits By Lunch?' — self-identification first, product second; NEVER name or depict a competitor brand, only 'ordinary toothpaste'"],
  ['Layout', "two-panel or top/bottom contrast: 'ordinary' side muted and generic (blank unbranded tube), LACALUT side bright with the REAL pack + ONE benefit chip + CTA pill"],
  COL,
  ['Payoff', 'one sentence says what the German formula does differently in feel-language — the switch is the story'],
  LOCK, LAW],
'science-ingredient': [
  ['Hook (the ingredient story in plain words)', "curiosity headline about what's inside — 'The German Mineral Your Gums Will Notice' — ONLY fluoride and hydroxyapatite may ever be named; no other actives, ions, or lab jargon, no molecular diagrams, no lab-coat authority figures"],
  ['Layout', 'macro of angular mineral crystal shards or a clean mineral stream NEAR the pack (never wrapping it, never white pearls/beads/powders/vials); pack lower third; ingredient name as a bold chip; CTA pill'],
  COL,
  ['Payoff', 'one plain line connects the ingredient to the feel-benefit — what it is, then what mornings feel like with it'],
  LOCK, LAW],
'lifestyle': [
  ['Hook (a morning they recognise)', "one real Australian daily moment — the 6:45 bathroom rush, the first coffee, the school run — captioned with a short customer-centric line about how their mouth FEELS through it"],
  ['Scene & person', 'ONE person max (the exact person set in the Brief box, else a natural everyday Australian adult), chest-up framing, genuine relaxed expression, real lived-in home; no studio sets, no perfect-teeth macro, no mouth close-ups'],
  ['Product moment', 'the REAL pack sits naturally in scene (vanity, counter, held casually at chest height) at true scale with the white cap — never a floating render pasted on'],
  NATCOL,
  ['Payoff', 'the caption lands ONE feel-benefit inside the moment; small logo; CTA pill in a clean corner'],
  LOCK, LAW],
'exploded-reveal': [
  ['Hook (what is actually in the tube)', "curiosity headline — 'Inside The German Tube' — an exploded/levitating arrangement of the formula's SIGNATURE ELEMENTS as angular crystal shards, mineral streams and clean water accents (NEVER white pearls, beads, spheres, powders or vials)"],
  ['Layout', 'pack standing hero centre; formula elements exploded in an arc NEAR the pack — close but never wrapping, enveloping or touching it; each element may carry a tiny plain-word label (fluoride / hydroxyapatite ONLY); CTA pill'],
  COL,
  ['Payoff', 'a one-line sum-up: everything in the tube exists so your gums FEEL cared-for — plain words, no chemistry lecture'],
  LOCK, LAW],
'premium-platform': [
  ['Hook (quiet premium confidence)', "short premium claim in elegant type — 'German Enamel Zahncreme' (toothpastes only) / 'The Premium German Standard' — minimal words, maximum poise"],
  ['Layout (locked platform standard)', 'the REAL pack standing on a clean premium platform/pedestal in brand palette, soft studio shadow, generous negative space; nothing else competes; small benefit line + CTA pill beneath'],
  COL,
  ['Payoff', 'one refined line of feel-benefit — premium restraint sells the quality'],
  LOCK, LAW],
'packaging-hero': [
  ['Hook (let the pack carry it)', 'a bold minimal headline over a confident straight-on pack presentation — the German design IS the visual interest'],
  ['Layout', 'the REAL pack front-on, perfectly reproduced (label, white cap, true proportions), scaled large but never a label-filling macro; XL headline above; ONE benefit chip; CTA pill'],
  COL,
  ['Payoff', 'sub-line gives the single feel-benefit and the Made-in-Germany cue'],
  LOCK, LAW],
'emotional': [
  ['Hook (the feeling, huge)', "an emotive two-to-four word headline about the feeling — 'That Fresh-Start Feeling' / 'Smile Like You Mean It' — the emotion is the product's result in their life"],
  ['Image', 'ONE person radiating the feeling (chest-up, genuine asymmetric smile, real skin texture — never mouth-only macro, never uncanny perfection) in warm natural light'],
  NATCOL,
  ['Payoff', 'one soft line ties the feeling to the product feel-benefit; the REAL pack small in a lower corner; CTA pill'],
  LOCK, LAW],
'christmas-festive': seasonal(
  "the customer's Christmas-morning confidence — 'Fresh For Every Family Photo' / 'The Stocking Filler They'll Actually Use' — gifting and togetherness, never 'the gift of health'",
  'a cosy festive scene (tree bokeh, warm candlelight, ribbon) with premium restraint',
  'the line sells the seasonal reason to buy NOW — a considered German gift or the fresh feel for the season of close conversations'),
'valentine-s-day': seasonal(
  "close-up confidence — 'Date-Night Fresh' / 'Get Close With Confidence' — the romance moment where a cared-for mouth matters most",
  'an elegant romantic scene (soft rose/red tones, candle warmth) kept premium, no kissing close-ups or mouth macros',
  'the payoff sells confidence at close range as a feel-benefit — fresh, cared-for, ready'),
'new-year-resolution': seasonal(
  "the routine upgrade they were already planning — 'New Year. Upgraded Routine.' / 'The Easiest Resolution You'll Keep'",
  'a clean fresh-start scene (crisp light, tidy vanity, morning energy)',
  'position the switch as the one resolution that takes 2 minutes twice a day — feel the difference all year'),
'mother-s-day': seasonal(
  "a considered gift for the woman who looks after everyone — 'For The Mum Who Deserves German Care'",
  'a warm gift-styled scene (soft florals, tissue paper, morning light)',
  'sell the pack (or bundle) as a premium thoughtful gift plus everyday self-care she will actually use'),
'father-s-day': seasonal(
  "a no-fuss upgrade for dad — 'Dad's Routine, The German Way' — practical, premium, zero pampering clichés",
  'a masculine-neutral scene (timber, navy tones, morning bench)',
  'sell it as the practical premium gift — the daily thing he uses, made noticeably better'),
'back-to-school': seasonal(
  "the family routine reset — 'School Mornings, Sorted' — the customer is the parent rebuilding the morning line-up",
  'a bright organised family-bathroom scene (kids\' brushes in a cup, packed lunchboxes energy) — check the SKU age rating and only feature a family/kids framing for SKUs approved for children',
  'sell the term-time stock-up: one less thing to think about every school morning'),
'chinese-new-year': seasonal(
  "a fresh start for the new year — 'Start The Year Fresh' — prosperity-red celebration that happens to match the brand",
  'an elegant red-and-gold festive scene, lanterns as soft bokeh, premium restraint (no cultural caricature)',
  'the payoff ties the fresh-start tradition to a fresh cared-for feel every morning of the year'),
'easter': seasonal(
  "the post-chocolate rescue — 'After The Egg Hunt…' — playful acknowledgement of the sugar weekend",
  'a light pastel scene with subtle egg/spring props kept behind the pack',
  'sell the fresh-clean feel that follows the indulgence — playful, never preachy or medical'),
'halloween': seasonal(
  "lolly-night without the morning-after mouth — 'Scary Amounts Of Lollies. One Fresh Fix.' — playful, never gory or disease-scary",
  'a fun premium halloween scene (deep navy night, subtle pumpkin accent) — brand colours still lead',
  'the treat-night fresh feel is the payoff; humour sells it, the pack solves it'),
'eofy-black-friday': seasonal(
  "the smart-buyer stock-up moment — 'The German Upgrade, On Sale' — value framed as cost PER DAY (about 10c a day), NEVER per-brush, and only state an offer the brief confirms is real",
  'a bold offer layout: XL offer headline, pack hero, honest offer chip (no fake countdowns, no invented was-prices)',
  'sell stocking up while it lasts — real urgency only, bundle value framing welcome'),
'dental-health-week-world-oral-health-day': seasonal(
  "the week everyone talks about their routine — 'The Week Your Routine Levels Up' — ride the awareness moment WITHOUT any health-org logos, endorsements or medical claims",
  'a clean editorial-style awareness layout in brand colours',
  'the payoff invites the routine upgrade in cosmetic feel-language only — awareness moment, cosmetic message'),
'australia-day': seasonal(
  "the Aussie summer long-weekend — 'BBQ. Beach. Fresh.' — sun, salt and staying fresh through it",
  'a bright Aussie summer scene (green-and-gold accents, sunlight, outdoor energy)',
  'sell summer-day freshness that keeps up with the long weekend'),
'afl-grand-final': seasonal(
  "game-day confidence — 'Big Final Energy' — the season's biggest day framed GENERICALLY: never league or team names, logos, trademarks, real players or team colour kits",
  'a generic game-day living-room or backyard scene (snacks, jerseys kept unbranded/neutral)',
  'fresh through four quarters of yelling — the payoff is social confidence on the loudest day of the year'),
'sports-event-flex': seasonal(
  "any big-match moment — 'Match-Day Fresh' — a flexible generic sports frame: no leagues, teams, athletes, logos or event trademarks ever",
  'an energetic neutral sports-viewing scene (scarves and snacks, no identifiable branding)',
  'the payoff is turning up fresh and confident for the big one, whatever the code'),
'melbourne-cup': seasonal(
  "race-day polish — 'Race-Day Ready' — the dressed-up social day framed generically: no event names beyond generic race-day, no betting references",
  'an elegant race-day scene (fascinator hints, champagne-light tones, premium styling)',
  'sell close-conversation confidence for the most social day on the calendar'),
'pop-culture-news-jack': seasonal(
  "topical-format energy with ZERO borrowed IP — invent an ORIGINAL playful cultural moment ('Everyone's Switching To German…') — never copyrighted characters, celebrities, film/TV properties, memes-of-the-week or real news photos",
  'a bold headline-driven topical layout that feels current without referencing anything ownable',
  'the payoff turns the invented moment into the product switch — timely energy, evergreen safety'),
'testimonial-review-spotlight': [
  ['Hook (a real voice, spotlit)', "build the card around ONE REAL customer review supplied in the Brief box (from the Judge.me pool) — the exact words; NEVER invent, embellish, trim into a different meaning, or fabricate names, dates, locations or star counts; if the Brief supplies NO real review, build the card around the product's feel-benefit as a bold headline instead — no quote, no stars"],
  ['Layout', 'XL pull-quote (the supplied review) with clean quotation marks; reviewer first name + initial ONLY as supplied; star row ONLY as supplied; the REAL pack lower third + CTA pill'],
  COL,
  ['Payoff', "a one-line bridge under the quote ('Feel it yourself.') that turns their words into the viewer's next step"],
  LOCK, LAW],
'scarcity-restock-alert': [
  ['Hook (honest urgency only)', "'Back In Stock' / 'Selling Fast' framing ONLY when the Brief confirms it is actually true — NEVER fake countdowns, invented limited numbers, or false sell-out claims; the urgency is real demand for a real product"],
  ['Layout', 'bold alert-style banner headline; pack hero; one line of social-momentum copy in plain words; CTA pill with urgency verb (\'Grab Yours\')'],
  COL,
  ['Payoff', 'the reason it sells out is the feel-benefit — say it in one line so the urgency has substance'],
  LOCK, LAW],
'founder-heritage-story': [
  ['Hook (a true origin, told simply)', "the real story angle: born in German pharmacies, refined for a century — told in one warm headline; NEVER invented founder quotes, fake portraits, fabricated dates or milestones beyond the true 1925 heritage"],
  ['Layout', 'heritage-editorial layout: muted premium tones, a subtle vintage texture or apothecary cue, the modern REAL pack as the story\'s present day; CTA pill'],
  COL,
  ['Payoff', 'one line lands why a century matters TO THEM: a formula this old survives because it feels like it works every single morning'],
  LOCK, LAW],
'b2b-partner-trade': [
  ['Hook (the stockist\'s business case)', "speak to the pharmacy owner/buyer — 'The German Oral-Care Range Your Customers Ask For' — their shelf, their margin story, in plain terms; NEVER invented sales figures, sell-through stats or ranging claims"],
  ['Layout', 'clean trade-professional layout: the range lineup (real packs), a short 3-chip case (German heritage · premium price point · DTC-proven demand), CTA pill \'Become a Stockist\''],
  COL,
  ['Payoff', 'one line on partnership ease — wholesale direct, fast reorder, supported brand'],
  ['Compliance', 'cosmetic positioning even in trade copy; no therapeutic claims to retailers either; no invented figures — the brief supplies any numbers'],
  LAW],
'bold-headliner': [
  ['Headline (one compliant punch line dominating the frame)', "GUMS THAT FEEL FIRM · GERMAN GUM CARE · THE 3PM FRESH TEST · ABOUT 10c A DAY · FRESH PAST LUNCH · THE GERMAN ONE — pick or write ONE in this feel-language register; never outcome verbs (firmer/stronger/protects), never disease words, never invented stats"],
  ['Type treatment', 'giant condensed sans filling ~60% of the frame; heavyweight stacked caps; one word in brand red, the rest white or navy; type is the hero'],
  ['Composition', 'headline top two-thirds + REAL pack hero bottom third; or type left, pack right — pack always under a third of frame, front label true'],
  COL,
  ['Payoff', 'one small sub-line resolves the headline into the feel-benefit + CTA pill'],
  LOCK, LAW],
'fear-hook': [
  ['Hook (social stakes, never medical fear)', "loss-framed COSMETIC stakes — the close conversation, the group photo, the first date: 'Hoping They Don't Notice?' — NEVER disease fear, bleeding imagery, decay visuals, dentist-chair dread or health-consequence threats"],
  ['Layout', 'a tense relatable social micro-moment (person chest-up, hand-NOT-touching-face), dark-to-light layout that resolves onto the pack + CTA pill'],
  NATCOL,
  ['Payoff', 'the relief is the product: one line flips the fear into the cared-for feel'],
  LOCK, LAW],
'listicle': [
  ['Hook (a numbered promise)', "'3 Things Your Gums Wish You Knew' / '4 Signs It's Time To Switch' — the number promises fast value; every point is cosmetic feel-language, no stats, no medical facts"],
  ['Layout', 'XL numbered list card: 3-4 crisp one-line points with bold number chips; the REAL pack + CTA pill resolve the list bottom third'],
  COL,
  ['Payoff', 'the final list item (or a closing band) turns the list into the switch — the product is the conclusion, not an afterthought'],
  LOCK, LAW],
'press-editorial': [
  ['Hook (editorial aesthetic, zero fabrication)', "a magazine-style benefit story headline — serif elegance, editorial layout — but NEVER a real masthead, invented publication name presented as real, fake journalist bylines, invented quotes or 'As Seen In' claims"],
  ['Layout', 'clean editorial spread: serif headline, a short standfirst line, premium product photography of the REAL pack, generous white space; CTA pill styled as a subtle button'],
  COL,
  ['Payoff', 'the standfirst tells the feel-benefit story in one elegant sentence — reads like coverage, sells like an ad'],
  LOCK, LAW],
'post-it-note': [
  ['Note message (compliant reminder-tone pool)', "handwritten-style note copy: 'stop rinsing after brushing' · 'your 3pm breath called' · 'switch to the German one' · 'buy the good toothpaste this time' — friendly reminders in feel-language, never outcome promises or medical advice"],
  ['Note style', 'yellow sticky note with handwritten marker; torn-paper note pinned; lined index card taped — one note, one message, huge legible handwriting'],
  ['Composition', 'note stuck on real tiles, a benchtop or the fridge (NEVER a mirror), the REAL pack beside or beneath it at true scale; CTA pill in a corner'],
  NATCOL,
  ['Payoff', 'the note IS the hook; a small printed line under it lands the feel-benefit and the CTA'],
  LOCK, LAW],
'review-screenshot': [
  ['Source (REAL reviews only — hard rule)', "the screenshot recreates ONE REAL review supplied in the Brief box (Judge.me pool) — exact words, name-as-supplied, star count ONLY as supplied; NEVER invent or alter review text, names, dates, avatars or ratings; no review in the brief → use the benefit-headline fallback instead of a fake screenshot"],
  ['Style', 'realistic review-card UI (clean type, subtle stars, verified-look layout WITHOUT the word \'verified\' unless the platform badge is real), faint device-screenshot framing — believable, not deceptive'],
  ['Composition', 'screenshot card centred; the REAL pack peeks from the lower edge or corner; CTA pill beneath'],
  COL,
  ['Payoff', "one line under the card: 'Thousands feel the difference — your turn.' only if the brief supports the scale claim; otherwise 'Feel it yourself.'"],
  LOCK, LAW],
'social-proof-wall': [
  ['Source (REAL reviews only — hard rule)', 'a wall of 3-5 SHORT REAL review snippets supplied in the Brief box — never invented, never padded to fill the grid; only as many cards as real reviews supplied'],
  ['Layout', 'staggered quote-card wall (varying sizes, clean shadows); the REAL pack sits hero centre or bottom with the CTA pill; each card: snippet + first name/initial as supplied'],
  COL,
  ['Payoff', 'a single banner line frames the wall — everyone keeps saying the same thing: it FEELS different'],
  LOCK, LAW],
'ugc-selfie': [
  ['Person (set in the BRIEF box)', 'the exact person is set in the Brief box — age, gender, look, vibe — or if the Brief is blank, a natural everyday Australian adult; real skin texture, genuine expression, never uncanny or model-perfect'],
  ['Shot', 'front-camera selfie at arm\'s length, slightly off-centre casual framing, real phone-camera look: natural imperfect lighting, faint grain, zero studio polish; everyday bathroom or bedroom (framed so NO mirror is in shot)'],
  ['Product moment', 'holding the REAL tube casually at chest height near the smile — true scale, white cap, label true; never a pasted-on render'],
  ['Caption / overlay (native vibe, nothing fabricated)', "a short handwritten-style native caption ('3 weeks in 👀' / 'my new staple') — NEVER a fabricated named quote, star rating, before/after claim or stat; the caption is vibe, not testimony"],
  NATCOL,
  LOCK, LAW],
'ugc-holding-product': [
  ['Person (set in the BRIEF box)', 'the exact person from the Brief box, else a natural everyday Australian adult; chest-up, relaxed genuine expression, real skin texture'],
  ['Shot', 'casual phone-photo framing of them holding the REAL pack up to camera at chest height — slightly imperfect angle, natural indoor light, authentic not staged; no mirror anywhere in frame'],
  ['Product', 'the pack is label-forward and true (white cap, real German packaging) but held naturally — fingers may partially overlap edges like a real photo'],
  ['Caption / overlay', "one native-style line in casual voice ('the one everyone kept recommending') — no invented quotes, ratings or stats; small CTA pill low corner"],
  NATCOL,
  LOCK, LAW],
'ugc-shelfie': [
  ['Shot (the believable bathroom shelf)', 'a real-life bathroom shelf/vanity flat-lay or straight-on \'shelfie\' — the REAL pack sitting among believable neutral everyday items (plain towels, a candle, unbranded bottles); NO competitor brands legible, no clutter chaos, lived-in but tidy'],
  ['Authenticity cues', 'natural window light, slight phone-camera imperfection, real shadows; the pack is the only branded hero and reads instantly'],
  ['Caption / overlay', "a short native line ('earned its shelf spot') top or bottom on a soft scrim; CTA pill small in a corner"],
  NATCOL,
  ['Payoff', 'the shelf placement IS the proof — it belongs in real routines; one line lands the feel-benefit'],
  LOCK, LAW],
};

// chat-text-message: preserve crafted dims, append an ADAPTED conversion law
const CHAT_LAW = ['Meta-ad conversion law (adapted for the chat format)',
  "the conversation itself must SELL to a cold scroller: the benefit lines live in the bubbles and the CLOSING bubble carries the purchase intent ('ok ordering now' / 'send me the link'); still ZERO engagement-bait anywhere; a small subtle CTA pill may sit at the very bottom edge ONLY if it doesn't break the screenshot illusion"];

let rewritten = 0;
for (const b of B) {
  if (REW[b.id]) { b.dims = REW[b.id]; rewritten++; }
  else if (b.id === 'chat-text-message' && !b.dims.some(d => /conversion law/i.test(d[0]))) { b.dims.push(CHAT_LAW); rewritten++; }
}
if (rewritten !== 41) { console.error('EXPECTED 41 rewrites, got ' + rewritten); process.exit(1); }

// banned-copy scan across the whole file (product names excluded)
const out = 'window.STRATEGY_BRAINS = ' + JSON.stringify(B) + ';\n';
// affirmative-use scan: 'clinically/dermatologically' legitimately appear inside prohibition
// text ("never 'clinically proven'") — only flag them when NOT preceded by a negation nearby
const hardBanned = /1 billion|periodontit|gingivit|gum disease|\bfirmer gums\b|verified buyer/i;
let hit = out.match(hardBanned);
if (!hit) for (const m of out.matchAll(/.{120}(clinically|dermatologically|strengthens|gift of health)/gi))
  if (!/never|no |not |NEVER/.test(m[0])) { hit = [m[1] + ' (affirmative)']; break; }
if (hit) { console.error('BANNED COPY SURVIVED: ' + hit[0]); process.exit(1); }
fs.copyFileSync(FILE, FILE.replace('.js', '.pre-rebuild-2409.bak.js'));
fs.writeFileSync(FILE, out);
console.log('DONE — ' + rewritten + ' brains rewritten, ' + B.length + ' total, banned-scan clean, backup saved');
