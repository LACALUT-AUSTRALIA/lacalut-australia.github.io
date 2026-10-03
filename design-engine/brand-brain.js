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
  productRule: "PRODUCT RULE (standing, always): show BOTH this SKU's mouthwash bottle AND its toothpaste tube together in the frame whenever the composition allows, correctly proportioned to each other and to the scene. If both genuinely cannot fit believably, show EITHER the mouthwash bottle OR the toothpaste tube — but NEVER zero product. The products stay a small, natural, accurate cameo (real packaging, white cap) — never a giant studio hero. When two product references are attached, use BOTH; only drop one when there is truly no room.",
  banned: "bleeding, gingivitis, periodontitis, gum disease, infection, inflamed, clinical, medicinal, heals, cures, treats (therapeutic), repairs gums, percentages, #1/No.1/best, WHO/TGA logos, timed results ('in X days/hours'), microbiome, bacteria/bacterial, pH-balance/pH-balancing, flora (as a biological/scientific term — fine only as the LACALUT FLORA product name), any invented scientific/biological mechanism-of-action language not printed on the real pack.",
  angles: {
    "aktiv": [
      "Mechanism — most toothpaste stops at your teeth; Aktiv works the gum-line",
      "Specialist vs generalist — a German pharmacy formula supermarket brands don't make",
      "Firm-gum FEEL — gums that feel firmer, fresher, cared-for every brush",
      "Neglected gums — your toothpaste has been ignoring your gums for years",
      "German heritage — 100 years obsessed with gums (differentiation, not nostalgia)"
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
    + '\nNEVER (hard compliance): ' + B.banned
    + (ang.length ? '\nPROVEN ANGLES for this range (pick or evolve ONE, never mash several): ' + ang.map((a,i)=>(i+1)+') '+a).join(' ') : '');
};
