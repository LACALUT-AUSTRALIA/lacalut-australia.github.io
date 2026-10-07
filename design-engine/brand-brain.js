/* ═══ BRAND BRAIN — the persistent LACALUT knowledge base injected into EVERY generation.
   One source of truth for trust lines, tone, banned claims and the per-SKU angle matrix.
   Loaded by index.html; brandBrainInjection() compacts it into the prompt.
   COSMETIC-ONLY (AICIS) — every angle here is pre-cleared. Edit this file, redeploy, done. ═══ */
window.BRAND_BRAIN = {
  trust: [
    "Made in Germany", "German pharmacy quality", "Since 1925 — 100+ years of German oral care",
    "Trusted in 60+ countries", "German-engineered formula", "Pharmacy-grade care"
  ],
  tone: "Premium German engineering meets warm Aussie plain-talk. Confident specialist, never shouty pharmacy-discount. Cosmetic FEEL language only (feels firmer / fresher / cared-for) — never medical outcomes.",
  implication: "IMPLICATION DOCTRINE (how on-image text evokes gum health, cosmetically): MOMENT TARGETING is the master mechanic — the CLAIM never carries the condition, the MOMENT does the targeting. Build the creative around ONE scene only the in-group recognises, paired with a dead-simple cosmetic claim; the viewer self-selects, the ad never connects the dots. On-image skeleton: [MOMENT LINE] + [green claim e.g. 'German Engineering For Gums. Since 1925.'] + CTA. Moment-hook bank (pick ONE, pair with its visual): 'Your toothbrush should stay the colour you bought it.' (clean white-bristle brush hero) | 'Apples shouldn't keep score.' (crisp bitten apple — CLEAN bite, never any mark) | 'Pink in the sink is a scene nobody films.' (empty white sink, running tap) | 'The morning rinse check. You know the one.' | 'Three rounds a day. This is their corner.' (tube+bottle as the cornerman's kit). Second weapon, THE FLIP, for claim/benefit lines: describe the GOOD state via a metaphor whose opposite is the unspoken problem ('Gums that look like they've never been in a fight — calm, pink, unbothered', 'Gums with a clean record'). Shield words: 'looks/feels' before every outcome word — 'FEELS firm' yes, 'firms gums' never. 'Healthy Pink' is an owned brand code — capitalise and reuse it. HARD LINES: max ONE wink per creative, everything else squeaky green; NEVER 'for [damaged state]' in any costume ('for beat-up gums', 'been in a brawl' = therapeutic purpose) — point the fight at the LIFE ('gums that go through a lot'), never at damage; NEVER second-person condition questions ('Do your gums look beaten up?'); no blood/pink-tinge imagery ever. Overall impression stays appearance/feel — visceral comes from the moment, never stacked winks.",
  productRule: "PRODUCT RULE (standing, always): show BOTH this SKU's mouthwash bottle AND its toothpaste tube together in the frame whenever the composition allows, correctly proportioned to each other and to the scene. If both genuinely cannot fit believably, show EITHER the mouthwash bottle OR the toothpaste tube — but NEVER zero product. The products stay a small, natural, accurate cameo (real packaging, white cap) — never a giant studio hero. When two product references are attached, use BOTH; only drop one when there is truly no room.",
  banned: "bleeding, gingivitis, periodontitis, gum disease, infection, inflamed, clinical, medicinal, heals, cures, treats (therapeutic), repairs gums, percentages, #1/No.1/best, WHO/TGA logos, timed results ('in X days/hours'), microbiome, bacteria/bacterial, pH-balance/pH-balancing, flora (as a biological/scientific term — fine only as the LACALUT FLORA product name), any invented scientific/biological mechanism-of-action language not printed on the real pack.",
  angles: {
    "aktiv": [
      "Mechanism — most toothpaste stops at your teeth; Aktiv works the gum-line",
      "Specialist vs generalist — a German pharmacy formula supermarket brands don't make",
      "Firm-gum FEEL — gums that feel firmer, fresher, cared-for every brush",
      "Neglected gums — your toothpaste has been ignoring your gums for years",
      "German heritage — 100 years obsessed with gums (differentiation, not nostalgia)",
      "Healthy Pink — own the colour as the aspiration ('the healthiest-looking pink in the room')",
      "The FLIP — gums that look like they've never been in a fight: calm, pink, unbothered",
      "The MOMENT — one scene only the in-group recognises ('Your toothbrush should stay the colour you bought it' / 'Apples shouldn't keep score') + a simple green claim"
    ],
    "aktiv-herbal": [
      "Strongest astringent + botanical taste — serious gum care that tastes like herbs, not hospital",
      "Nature meets German engineering — botanical herbs in a pharmacy-grade formula",
      "Taste-swap dare — swap your minty paste for 14 days, taste the difference",
      "Grown-up gum care — the serious formula for people who want more than mint"
    ],
    "flora": [
      "Fresh-breath confidence — beats garlic, onion and coffee breath moments",
      "Social close-talk moments — first dates, meetings, mornings",
      "Neutralise, don't mask — targets the source of odour, not just perfume over it",
      "The 12-hour fresh feel — morning brush that lasts to the evening"
    ],
    "sensitive": [
      "Cold-drink wince — ice water, ice cream, iced coffee without the flinch-feel",
      "The ice test — dare the cold once your teeth feel shielded",
      "Comfort-first daily care — gentle German formula for teeth that feel twinge-prone",
      "Money-back challenge — 14-day dare, keep it free if you don't feel it"
    ],
    "white-repair": [
      "Coffee-stain lift — polished, brighter-looking enamel without harsh abrasion",
      "Hydroxyapatite hero — the enamel mineral, highest in the range",
      "Polished-smooth FEEL — teeth that feel glass-smooth after every brush",
      "German enamel care — engineering, not bleach"
    ],
    "white": [
      "Coffee-stain lift — polished, brighter-looking enamel without harsh abrasion",
      "Hydroxyapatite hero — the enamel mineral, highest in the range",
      "Polished-smooth FEEL — teeth that feel glass-smooth after every brush"
    ],
    "multi": [
      "Whatever your smile needs — one German range, five specialist formulas",
      "Find your formula — range chooser (gums / breath / sensitivity / whitening)",
      "The German pharmacy shelf — the whole specialist line-up in one shot"
    ]
  }
};
window.brandBrainInjection = function(sku){
  const B = window.BRAND_BRAIN; if(!B) return '';
  const ang = (B.angles[sku] || B.angles[(sku==='herbal')?'aktiv-herbal':sku] || []).slice(0,5);
  return '\n\nBRAND BRAIN (persistent LACALUT knowledge — always true):'
    + '\nTRUST LINES (only ever use these): ' + B.trust.join(' · ')
    + '\nTONE: ' + B.tone
    + (B.productRule ? '\n' + B.productRule : '')
    + (B.implication ? '\n' + B.implication : '')
    + '\nNEVER (hard compliance): ' + B.banned
    + (ang.length ? '\nPROVEN ANGLES for this range (pick or evolve ONE, never mash several): ' + ang.map((a,i)=>(i+1)+') '+a).join(' ') : '');
};
