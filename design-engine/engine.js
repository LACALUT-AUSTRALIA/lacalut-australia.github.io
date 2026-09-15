/* ═══════════════════════════════════════════════════════════════════════
   LACALUT DESIGN ENGINE — shared, DOM-free module.
   Single source of truth for brand kits, prompt building, Gemini image gen
   and AICIS compliance. Consumed by BOTH design-engine/index.html and
   social-content-calendar/index.html.

   Depends on: strategies.js (window.STRATEGY_BRAINS) loaded BEFORE this file.
   Exposes:    window.LacalutEngine
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const BRAINS = global.STRATEGY_BRAINS || [];

  /* ═══ BRAND KITS (RULES layer) ═══ */
  const SKUS = {
    'aktiv': { name:'Aktiv', dot:'#CF102D', accent:'#CF102D',
      palette:'brand red #CF102D + navy #004A88 + soft light-blue #DDEBF7 backgrounds and #4C97C9 icon circles (use all three)',
      props:'white hydroxyapatite mineral, salt-mineral rock clusters, clean water splash, subtle navy molecular hex pattern',
      voice:'clinical, German pharmacy-grade, trustworthy',
      say:'intensive gum care, firms and cares for the gum line, "Gums That Feel Firm & Cared-For"',
      ban:['gingivitis','periodontitis','gum disease'] },
    'aktiv-herbal': { name:'Aktiv Herbal', dot:'#2E7D46', accent:'#2E7D46',
      palette:'herbal green #2E7D46 / #7CB342 dominant, brand red #CF102D on logo + result pill only, navy #004A88 headers',
      props:'fresh herbs and botanicals (sage, chamomile, myrrh), green leaves, natural stems, soft daylight, water dew',
      voice:'natural yet clinical, botanical',
      say:'natural gum care, 9 medicinal herbs, supports gum health',
      ban:['gingivitis','periodontitis','gum disease'] },
    'flora': { name:'Flora', dot:'#2E9E5B', accent:'#004A88',
      palette:'TOOTHPASTE = navy #004A88 + citrus-yellow; MOUTHWASH = fresh green #2E9E5B; red #CF102D on logo/pill only',
      props:'mint leaves, citrus/lemon, fresh water splash, ice crystals',
      voice:'fresh, confident, clean',
      say:'eliminates bad breath at the source, fresh breath, balances oral microbiome',
      ban:['halitosis','reverses the condition','0% alcohol','alcohol-free'] },
    'sensitive': { name:'Sensitive', dot:'#008490', accent:'#008490',
      palette:'teal #008490 / #0E6C7D dominant, red #CF102D on logo/pill only, navy #004A88 headers',
      props:'feather (gentleness), cold water and ice, white minerals, calm blue-teal light',
      voice:'gentle, calm, clinical',
      say:'for sensitive teeth, gentle everyday comfort, for cold & hot twinges',
      ban:['pain relief','pain-free cure','therapeutic'] },
    'white-repair': { name:'White & Repair', dot:'#8a8f98', accent:'#CF102D',
      palette:'TOOTHPASTE = bright white + red headline pill #CF102D; MOUTHWASH = silver/platinum grey; navy #004A88 headers',
      props:'white enamel stones, subtle diamond/sparkle, bright clean light, water splash',
      voice:'clinical whitening, never bleach-luxury',
      say:'removes surface stains, supports natural whiteness, protects and repairs enamel',
      ban:['peroxide','bleach'] }
  };
  const GLOBAL_BAN = ['gingivitis','periodontitis','gum disease','halitosis','reverses the condition','graphic bleeding gums close-up',
    'bleeding','reduces bleeding','stops bleeding','stops gum bleeding','gum bleeding',
    'soothes','soothes irritation','irritation','inflammation','reduces inflammation','anti-inflammatory',
    'heals','calms','closes gum pockets','kills bacteria','kills the bacteria'];

  const MODES = {
    'social':  { label:'Feed 4:5',      dims:'1080×1350', ar:'4:5 portrait' },
    'ad':      { label:'Reels / Story', dims:'1080×1920', ar:'9:16 vertical' },
    'listing': { label:'Square 1:1',    dims:'1080×1080', ar:'1:1 square' },
    'pmax':    { label:'PMax Landscape',dims:'1200×628',  ar:'16:9 landscape' }
  };

  /* ═══ EDITABLE BRAND GUIDES (per-SKU pools) ═══ */
  const DEFAULT_GUIDES = {
   'aktiv':{ colours:'Dominant brand red #CF102D + navy #004A88 + soft light-blue #DDEBF7 backgrounds with #4C97C9 icon circles',
     backgrounds:['clean bright white studio background, soft shadow, minimal premium look','deep navy-blue gradient with subtle molecular hex pattern and soft glow','bold LACALUT red gradient fading to dark maroon, faint hex texture, premium','soft light-blue backdrop, water splash, white mineral rocks','dark maroon-to-red radial gradient, dramatic mood, particle sparkle','airy white-to-pale-blue gradient, fresh feel, reflective floor','premium charcoal-to-navy gradient with red rim-light and floating mineral particles','pharmacy-white scene with a soft blue gel swirl and clean reflections','geometric navy-and-red split background with bold diagonal blocks','macro water-droplet surface catching red and blue light, hero product emerging','frosted glass panel with soft studio glow and a subtle brand-red accent line','dark cinematic spotlight on a red-velvet surface, luxe pharmacy mood'],
     formula:['white salt-mineral rock clusters','white hydroxyapatite mineral pearls','clear enamel crystals','clean water splash (NO herbs — herbs belong to Aktiv Herbal only)'],
     usps:['Firms & cares for the gum line','Intensive anti-plaque German formula','12h long-lasting protection','Astringent firm-gum feel','Removes plaque for a deep-clean feel','Daily intensive gum care','The German standard in gum care','Trusted German pharmacy heritage'],
     headlines:['Gums That Feel Firm & Cared-For','Intensive German Gum Care','Firm, Fresh, Cared-For Gums','The German Standard in Gum Care','Give Your Gums the German Treatment','Strong-Feeling Gums, Every Day','Your Gums Deserve German Care','Firm-Gum Feel, Day After Day','Serious About Your Gum Line','The Daily Upgrade for Your Gums','German Gum Care Since 1925','Care for Your Gums the German Way'],
     subheadlines:['Intensive Formula for a Firm Gum Feel','Notice the Difference From Day One','The German Standard of Gum Care','Astringent Care for a Cared-For Gumline','Daily Intensive Gum Care','Firm, Fresh and Cared-For','German Pharmacy Heritage Since 1925','For Gums That Feel Strong','The Intensive Gum-Care Ritual','Premium German Oral Care'],
     benefits:['Firm Gumline Feel','Cared-For Gums','Astringent Firm Feel','Removes Plaque','Fresh for 12 Hours','German Gum-Care Formula','Deep-Clean Feel','Daily Intensive Care','Strong-Feeling Gumline','Fresh Confident Mouth','Pharmacy-Grade Care','Trusted German Formula'],
     trust:['Made in Germany','Pharmacy Grade','100+ Years Expertise','Dermatologically Tested','Trusted in 60+ Countries','German Pharmacy Heritage','Since 1925','Loved by Millions'] },
   'aktiv-herbal':{ colours:'Herbal green #2E7D46 / #7CB342 dominant, red #CF102D on logo & result pill only, navy #004A88 headers',
     backgrounds:['clean white studio background, soft natural shadow','deep forest-green gradient with botanical silhouettes and soft light','lush botanical scene, fresh herbs and green leaves, natural daylight','soft sage-green gradient with dew and leaf accents','dark green-to-emerald gradient, premium herbal mood','sunlit herb-garden flat-lay with sage, chamomile and mint','deep emerald studio with glowing botanical particles and dew','fresh eucalyptus-and-mint arrangement on a pale stone surface','moody enchanted-forest backdrop with god-rays and floating leaves','bright botanical white scene with scattered fresh herbs and water dew','green marble surface with herbal sprigs and soft daylight','macro dewy leaf texture with the product emerging, natural glow'],
     formula:['white mineral base with the 9 medicinal herbs','fresh sage, chamomile and myrrh sprigs','green botanical leaves','soft water dew'],
     usps:['9 valuable natural herbs','Natural gum care, German formula','Astringent herbal firm-gum feel','Herbal freshness, German quality','Botanical daily gum care','Nature meets German pharmacy care','Fresh herbal clean feel'],
     headlines:['Nature’s Answer to Firm, Fresh Gums','9 Herbs · German Gum Care','Natural Gum Care, German Made','Firm-Feeling Gums, Naturally','The Herbal Way to German Gum Care','Where Nature Meets German Care','9 Herbs for a Firmer Gum Feel','Botanical Care, German Precision','Naturally Firm, Naturally Fresh','Your Gums, the Natural Way','German Herbal Gum Care','Fresh From Nature, Made in Germany'],
     subheadlines:['9 Medicinal Herbs · German Formula','Aromatherapy Brushing Experience','Nature Meets German Gum Care','A Botanical Firm-Gum Ritual','Herbal Freshness, German Quality','9 Herbs, One German Formula','Naturally Fresh, Daily','The Herbal Gum-Care Ritual','Botanical Care Since 1925'],
     benefits:['Fresh Herbal Comfort','Firm Gumline Feel','Astringent Firm Feel','9 Herb Extracts','Natural German Gum Care','Fresh Botanical Clean','Herbal Fresh Feel','Cared-For Gums, Naturally','Daily Botanical Care','Gentle Herbal Formula','9 Powerful Herbs','Naturally Fresh Breath'],
     trust:['9 Natural Herbs','Made in Germany','Pharmacy Grade','Dermatologically Tested','Trusted in 60+ Countries','German Pharmacy Heritage','Since 1925','Naturally Derived Herbs'] },
   'flora':{ colours:'TOOTHPASTE navy #004A88 + citrus-yellow; MOUTHWASH fresh green #2E9E5B; red #CF102D on logo/pill only',
     backgrounds:['clean white studio background, minimal fresh look','deep navy-blue gradient with water ripples and hex pattern','fresh green gradient (mouthwash) with mint leaves and splash','bright citrus-fresh scene, lemon and ice accents, airy','cool blue-to-teal gradient, crisp hygienic mood','splashing water crown with mint leaves frozen mid-air','icy blue backdrop with frost crystals and cold vapour','sunlit citrus flat-lay with lemon, lime and fresh mint','dark teal studio with a single bright mint-green light beam','fresh dewy mint leaves macro with the product emerging','clean spa-blue gradient with soft bubbles and reflections'],
     formula:['silver-grey zinc-gluconate granules','white mineral powder','fresh lemon peel twists','mint leaves','light water splash'],
     usps:['Tackles bad breath at the source','For lasting fresh breath','Supports a fresh, balanced mouth feel','All-day breath confidence','Clean, fresh mouth feel','Gentle daily freshness','German fresh-breath formula'],
     headlines:['Beat Garlic & Onion Breath','Goodbye Morning Breath','Coffee Breath, Handled','Onion, Garlic, Coffee — Out','End Morning Dragon-Breath','Fresh Breath That Lasts','All-Day Fresh Breath','Say Goodbye to Bad Breath','Confidence in Every Breath','German Freshness, All Day','Breath So Fresh You’ll Notice','Fresh From the First Rinse','Own the Room With Fresh Breath','The Fresh-Breath Upgrade','Fresh Mouth, Full Confidence','Kiss Bad Breath Goodbye'],
     subheadlines:['Freshness at the Source','Fresh-Breath Formula','A Fresher Mouth Feel, Daily','German Freshness Since 1925','Clean, Confident, Fresh','For Breath That Lasts','The Daily Fresh-Breath Ritual','Premium German Fresh Care'],
     benefits:['Fights Bad Breath','Fresh, Balanced Mouth Feel','Long-Lasting Freshness','Gentle Daily Care','Clean, Confident Breath','All-Day Fresh Feel','Fresh From First Use','Cool Mint Freshness','German Fresh-Breath Care','Everyday Breath Confidence','Fresh Clean Finish'],
     trust:['Made in Germany','Pharmacy Grade','12h Fresh Feel','Dermatologically Tested','Trusted in 60+ Countries','German Pharmacy Heritage','Since 1925'] },
   'sensitive':{ colours:'Teal #008490 / #0E6C7D dominant, red #CF102D on logo/pill only, navy #004A88 headers',
     backgrounds:['clean white studio background, soft gentle shadow','soft teal-to-white gradient, gentle mood','deep teal gradient with subtle enamel/mineral texture','airy pale-blue and teal scene with ice and feather accents','dark teal radial gradient, premium serene feel','soft-focus feather resting on still water, gentle light','frosted teal glass with cold vapour and soft glow','pale mint-and-white minimalist scene with a single ice crystal','serene spa-teal backdrop with smooth pebbles and water','macro enamel-white mineral surface with soft teal light','gentle gradient from icy blue to warm cream, comforting mood'],
     formula:['pale blue-teal soothing crystals','white mineral salt','cool ice shards','calm blue-teal light'],
     usps:['For sensitive teeth','Comfort for cold & hot twinges','Gentle daily care','Extra-gentle everyday cleaning','Builds a protective feel','German gentle-care formula','Comfort you can feel'],
     headlines:['Enjoy Ice Cream Again','No More Cold-Drink Twinges','That Ice-Cream Zing? Gone','Hot Coffee, Cold Ice — No Wince','Cold Air, No Wince','Enjoy Cold & Hot Again','Comfort for Sensitive Teeth','Everyday Comfort, German Made','Gentle Care, Real Comfort','From Twinges to Comfort','Say Yes to Cold Drinks Again','Gentle on Teeth, Serious on Care','Comfort in Every Brush','The Gentle German Choice','Enjoy Every Bite Again','Sensitive Teeth, Meet Comfort'],
     subheadlines:['Gentle Care for Sensitive Teeth','Gentle Everyday Comfort','A Protective Everyday Feel','German Gentle-Care Formula','Comfort That Lasts','For Teeth That Need Extra Care','The Gentle Daily Ritual','Premium German Comfort Care'],
     benefits:['Comfort for Sensitive Teeth','Builds a Protective Barrier','Extra-Gentle Cleaning','Long-Lasting Comfort','Gentle Daily Care','Kind to Sensitive Teeth','Everyday Comfort Feel','Protective Everyday Care','Gentle German Formula','Comfort From First Use','Cold & Hot Comfort'],
     trust:['Made in Germany','Pharmacy Grade','Dermatologically Tested','Gentle Formula','Trusted in 60+ Countries','German Pharmacy Heritage','Since 1925'] },
   'white-repair':{ colours:'TOOTHPASTE bright white + red headline pill #CF102D; MOUTHWASH silver/platinum grey; navy #004A88 headers',
     backgrounds:['clean bright white studio background, sparkle highlights','silver/platinum gradient, premium sheen','deep navy gradient with diamond sparkle and enamel stones','soft white-to-silver gradient, bright airy whitening feel','cool grey studio with reflective floor and light burst','bright white surface with a single dazzling light flare','crystal-and-diamond arrangement catching bright light','polished marble surface with soft sparkle and clean reflections','dark charcoal studio with a bright white beam on the product','macro enamel-white mineral texture with sparkle particles','frosted silver gradient with subtle shimmer and clean shadow'],
     formula:['white hydroxyapatite pearls','clear ice / enamel cubes','subtle diamond sparkle','bright white mineral powder'],
     usps:['Removes surface stains','Protects & strengthens enamel','No peroxide','Gentle daily whitening','Reveals natural whiteness','Enamel-safe whitening','German whitening care'],
     headlines:['Coffee, Tea & Wine Stains — Gone','Beat Coffee & Tea Stains','Wave Goodbye To Yellow Teeth','Your Coffee Habit, Erased','Undo Years Of Surface Stains','Stains From Coffee, Tea & Wine — Lifted','Whiter, Stronger-Feeling Teeth','A Brighter, Whiter Smile','Gentle Whitening, German Made','Remove Stains, Reveal White','Your Whiter Smile Starts Here','Brighten Without the Bleach','Say Goodbye to Surface Stains','The Gentle Road to White','Whiter Teeth, Happy Enamel','Reveal Your Natural White','Bright Smile, German Care'],
     subheadlines:['Gentle Whitening & Enamel Protection','Whiter Smile, Enamel-Safe','Brighten Without Bleach','No-Peroxide Whitening Care','For a Naturally Whiter Smile','Gentle Daily Whitening','The Enamel-Safe Whitening Ritual','Premium German Whitening'],
     benefits:['Removes Surface Stains','Supports Natural Whiteness','Enamel-Protecting Care','No Peroxide','Gentle Daily Whitening','Brighter Smile Feel','Strengthens Enamel Feel','Whiter From First Use','Enamel-Safe Formula','Bright Confident Smile','German Whitening Care'],
     trust:['Made in Germany','Pharmacy Grade','Enamel-Safe','No Peroxide','Dermatologically Tested','Trusted in 60+ Countries','Since 1925'] }
  };
  const GUIDE_SECTIONS = [['backgrounds','Background Styles (colour + scene — engine varies these)'],['formula','Formula Elements (signature ingredients — ALWAYS applied, EXCLUSIVE to this SKU: never another formula’s elements)'],['usps','USPs'],['headlines','Main Headlines'],['subheadlines','Subheadlines'],['benefits','Benefits'],['trust','Trust Elements']];

  function getGuide(sku){
    const d = DEFAULT_GUIDES[sku] || {};
    const toObj = a => (a||[]).map(t=>({text:t,on:true}));
    try { const saved = global.localStorage && localStorage.getItem('de_guide_'+sku); if(saved){ const g=JSON.parse(saved); if(!g.formula || !g.formula.length){ g.formula = toObj(d.formula); } return g; } } catch(e){}
    return { colours:d.colours||'', backgrounds:toObj(d.backgrounds), formula:toObj(d.formula), usps:toObj(d.usps), headlines:toObj(d.headlines), subheadlines:toObj(d.subheadlines), benefits:toObj(d.benefits), trust:toObj(d.trust) };
  }

  /* ═══ SAMPLERS ═══ */
  function pickStr(str){ const a=(str||'').split(';').map(x=>x.trim()).filter(Boolean); return a.length? a[Math.floor(Math.random()*a.length)] : ''; }
  function pickRand(list,n){ const on=(list||[]).filter(x=>x.on!==false).map(x=>x.text); const out=[]; while(on.length&&out.length<n) out.push(on.splice(Math.floor(Math.random()*on.length),1)[0]); return out; }

  /* ═══ BRAIN RESOLUTION ═══ */
  function resolveBrain(brainId){
    if(brainId==='mixed' || !brainId) return BRAINS[Math.floor(Math.random()*BRAINS.length)] || null;
    return BRAINS.find(b=>b.id===brainId) || null;
  }
  function brainUsesProduct(brain){
    if(!brain) return true;
    if(brain.product==='none') return false;
    if(brain.product==='required') return true;
    if(['Sales','Social Proof','Story'].includes(brain.cat)) return true;
    return Math.random()<0.3; // 'optional' content brains: mostly clean, ~30% get a product cameo
  }
  // Pick a random brain whose category is in `cats`. Optional preferIds bias
  // (if any of those brain ids exist in the pool, pick from them ~65% of the time).
  function pickBrainForCategories(cats, preferIds){
    const pool = BRAINS.filter(b => cats.includes(b.cat));
    if(!pool.length) return BRAINS[Math.floor(Math.random()*BRAINS.length)] || null;
    if(preferIds && preferIds.length){
      const pref = pool.filter(b => preferIds.includes(b.id));
      if(pref.length && Math.random()<0.65) return pref[Math.floor(Math.random()*pref.length)];
    }
    return pool[Math.floor(Math.random()*pool.length)];
  }

  /* ═══ VARIATION ENGINE — forces every render (even same strategy) to look distinct ═══
     A random composition/camera "lens" + colour mood is injected each generation so the
     engine (and the One-Up Loop) can't converge on one obvious hero shot. */
  const VARIATION_LENSES = [
    'extreme macro close-up filling the frame with product detail and texture, shallow depth of field',
    'wide cinematic environmental shot with the product smaller inside a vast dramatic scene',
    'top-down flat-lay composition seen from directly above',
    'dramatic low hero angle looking up so the product towers heroically',
    'off-centre editorial layout with the product to one side and bold negative space for the headline',
    'surreal floating / levitating product with elements orbiting around it',
    'split / diptych composition of two contrasting halves',
    'forced-perspective shot with the product bursting toward the camera, strong motion energy',
    'symmetrical centred hero on a plinth or pedestal under a luxe spotlight',
    'diagonal dutch-angle dynamic composition',
    'poster / collage layout with several framed panels',
    'product emerging from a splash or burst in the lower third with huge type filling the top',
    'three-quarter turntable studio angle with a long soft reflection',
    'over-the-shoulder in-scene framing as if caught in a real moment'
  ];
  const VARIATION_MOODS = [
    'bright high-key airy lighting','dark moody low-key with a single dramatic light',
    'bold saturated punchy colour grade','soft pastel premium palette',
    'high-contrast graphic poster style','warm golden natural light',
    'cool clean clinical light','cinematic teal-and-warm colour grade'
  ];
  function pickVariationLens(){ return VARIATION_LENSES[Math.floor(Math.random()*VARIATION_LENSES.length)]; }
  function pickVariationMood(){ return VARIATION_MOODS[Math.floor(Math.random()*VARIATION_MOODS.length)]; }

  /* ═══ PROMPT BUILD (DOM-free) ═══ */
  function buildPrompt(opts){
    const sku = opts.sku, mode = opts.mode || 'social', brain = opts.brain;
    const brief = (opts.brief || '').trim();
    const advNeg = opts.advNeg !== false;
    const useProd = opts.useProd;
    const s = SKUS[sku], m = MODES[mode], g = getGuide(sku);
    const bans = [...GLOBAL_BAN, ...s.ban];
    const salesLike = brain && ['Sales','Social Proof','Story'].includes(brain.cat);
    const isUGC = brain && brain.cat === 'UGC';
    const isChat = brain && /chat|text message/i.test(brain.name);

    // ═══ CHAT / TEXT MESSAGE — dedicated FLAT full-bleed messaging-screen screenshot ═══
    // Bypasses ALL the generic headline/variation/photoreal/badge scaffolding, which was
    // turning this into a photoreal phone-on-a-podium in a studio scene with a headline banner.
    if(isChat){
      let cp = `Create a FLAT 2D SCREENSHOT of a mobile phone MESSAGING app (iMessage / WhatsApp style) for LACALUT ${s.name} (German pharmacy oral-care brand) — exactly as if someone took a screenshot ON their phone and posted it to Facebook. `;
      cp += `THE ENTIRE 4:5 IMAGE IS THE PHONE SCREEN ITSELF, full-bleed edge to edge. It is a flat on-screen UI screenshot, NOT a photograph of a phone. ABSOLUTELY NO physical phone device, NO phone body, bezel or frame, NO hand holding a phone, NO desk, table, podium or pedestal, NO 3D scene, NO studio background, NO teal/coloured backdrop, NO drop shadow around a device — the chat interface fills 100% of the canvas. `;
      cp += `LAYOUT, top to bottom: (1) a slim phone STATUS BAR — time at top-left, signal/wifi/battery icons at top-right; (2) a chat HEADER BAR with a back chevron on the left, a small round contact avatar and a first-name contact label (e.g. "Alex", "Sam", "Jess") centred — this is what signals it is a phone screen; (3) the CONVERSATION as a vertical stack of rounded chat bubbles filling the rest of the screen — GREY received bubbles aligned LEFT, BLUE sent bubbles aligned RIGHT, small timestamps; (4) a slim message-input bar at the very bottom. `;
      cp += `TYPOGRAPHY (most important rule): the chat bubble text must be VERY LARGE — like a phone with the accessibility "Larger Text" setting turned right up — big, bold and effortless to read even in a small Facebook feed thumbnail on a mobile. Err on the side of TOO big. CONCRETE SIZE TARGET (do not miss this): each line of bubble text should be roughly 1/14 to 1/11 of the total image height tall — as large as a mobile banner headline — with only ~3 to 6 words per line so the words stay huge; a viewer must read every word on a phone-sized feed thumbnail WITHOUT zooming. If in doubt, make the text bigger and the bubbles fewer. `;
      cp += `Keep the conversation SHORT — only about 4 to 6 bubbles total — and each bubble to one short line or two, so every bubble can be rendered large; do NOT cram in many small messages. The bubbles and their text should fill most of the screen width. `;
      cp += `Text is high-contrast: dark text on grey received bubbles, white text on blue sent bubbles. `;
      if(brain) brain.dims.forEach(([d,pool])=>{ const v=pickStr(pool); if(v) cp += `${d} — ${v}. `; });
      if(brief) cp += `Art-director note (priority): ${brief}. `;
      if(opts.headline) cp += `The conversation should naturally get across THIS message/topic — "${opts.headline}" — woven into the texts, never as an overlay headline. `;
      cp += `Include exactly ONE inline PHOTO-MESSAGE bubble showing the real LACALUT ${s.name} product (from the reference image) — like a friend texted a pic. Keep this photo SMALL — no more than about a quarter to a third of the screen height — so it never dominates or shrinks the text; the text bubbles are the hero, not the photo. White cap, real German packaging accurate; NOT a big studio hero. `;
      cp += `NO external headline, NO title banner, NO benefit badges, NO trust chips, NO logo watermark, NO call-to-action sticker — the whole message lives INSIDE the chat bubbles. `;
      cp += `CLAIM LOCK (mandatory): the benefits mentioned in the chat must be ONLY about ${s.name}'s real job — ${s.say}. Do NOT borrow another LACALUT product's benefit — never mention whitening, "stain lift" or brightening unless this IS White & Repair; never "fresh breath" or bad-breath unless this IS Flora; never herbal/botanical unless this IS Aktiv Herbal. `;
      if(advNeg) cp += `STRICT COMPLIANCE — never show or write any of these words/claims: ${bans.join(', ')}. `;
      cp += `All chat text in ENGLISH (Australian English), casual and natural like real friends texting. Keep the product's own printed packaging text unchanged. `;
      cp += `${m.ar} aspect ratio, clean flat messaging-app UI, crisp legible typography, no spelling errors on any text.`;
      return cp;
    }

    let p = `Professional graphic-designed ${m.label} for LACALUT ${s.name} (German pharmacy oral-care brand). Tone: ${s.voice}. `;
    p += `STRICT brand colours — ${g.colours||s.palette}. `;
    if(brain){
      p += `CREATIVE STRATEGY — "${brain.name}": `;
      brain.dims.forEach(([d,pool])=>{ const v=pickStr(pool); if(v) p += `${d} — ${v}. `; });
    }
    if(salesLike){
      const head=pickRand(g.headlines,1)[0]; if(head) p += `Headline (exact wording): "${head}". `;
      const bens=pickRand(g.benefits,3); if(bens.length) p += `Benefit badges: ${bens.join('; ')}. `;
      const trust=pickRand(g.trust,2); if(trust.length) p += `Trust badges: ${trust.join('; ')}. `;
      const bg=pickRand(g.backgrounds,1)[0]; if(bg) p += `Background scene: ${bg}. `;
    }
    if(brief) p += `Art-director note (priority): ${brief}. `;
    if(opts.headline) p += `TOPIC LOCK (highest priority): the MAIN on-image headline and all overlay text must convey THIS exact message/topic — "${opts.headline}". Do NOT substitute a different tip, fact or headline; everything written on the image must be consistent with it. `;
    if(advNeg) p += `STRICT COMPLIANCE — never show or write any of these words/claims: ${bans.join(', ')}. `;
    p += `ALL overlay/design text — headline, labels, badges, captions — must be in ENGLISH (Australian English) ONLY; never German, never bilingual. (The product's own printed packaging text stays unchanged.) Keep it clean and uncluttered — no extra call-to-action stickers or badges unless specified. `;
    p += `COPY RELEVANCE: every headline, caption and overlay line must be specifically about ORAL CARE — gums, teeth, toothpaste, fresh breath, or the whitening/repair benefit — never a vague generic line like "German pharmacy care" on its own; always tie it to the actual product (e.g. "German pharmacy-grade gum care"). `;
    p += `SKU ANGLE LOCK (mandatory — the foundation rule): this creative is EXCLUSIVELY for LACALUT ${s.name}. Every headline, sub-headline, benefit, transformation, badge and visual MUST be about THIS product's own benefit only — ${s.say}. NEVER borrow another LACALUT product's angle or claim: do NOT show or write teeth-whitening, "whiter smile", stain-removal or before/after whitening UNLESS this is the White & Repair whitening product; do NOT show gum-firmness or plaque unless this is a gum-care product; do NOT show sensitivity/cold-twinge comfort unless this is the Sensitive product; do NOT show fresh-breath messaging unless this is the Flora fresh-breath product. Match the angle to ${s.name} and nothing else. `;
    { const fx=(g.formula||[]).filter(x=>x.on!==false).map(x=>x.text);
      if(fx.length && !isUGC) p += `SIGNATURE FORMULA ELEMENTS (mandatory whenever the design shows ANY ingredient, mineral, botanical, powder, formula-spill prop, cutaway tube or formula backdrop): use ONLY these elements for ${s.name} — ${fx.join(', ')}. NEVER show another formula's signature elements: no herbs / chamomile / sage / botanicals unless this is Aktiv Herbal; no silver zinc granules unless this is Flora; no blue soothing crystals unless this is Sensitive; no diamond/pearl whitening minerals unless this is White & Repair. If the layout uses no ingredient or formula props, do not force them in. `; }
    if(isUGC){
      p += `UGC PHOTO — a real, believable everyday PERSON (matching the Art-director note) is the CLEAR SUBJECT, authentically holding or using the LACALUT product in a genuine phone-camera photo: natural imperfect lighting, a real home or bathroom setting, candid unposed feel. The PERSON MUST be clearly visible and prominent — NEVER a product-only, hand-only or studio-hero shot. The product is held or placed naturally in the scene (not a big floating hero), its real packaging accurate and the CAP ALWAYS WHITE (never red, navy or coloured). CRITICAL SCALE: the tube is its TRUE real-world size — a normal ~75ml toothpaste tube (about the length of a hand), correctly proportioned to the person's hand, fingers and face; NEVER enlarged, oversized or giant. Any on-image caption stays in a casual, native, lowercase style (like a viral social-post caption), NOT a formal studio ad headline — BUT it is rendered LARGE, bold and instantly readable on a mobile screen, never tiny. `;
      const ugcLens = ["a front-camera selfie held at arm's length","a candid over-the-shoulder phone shot","a natural bathroom-mirror selfie","a relaxed waist-up handheld shot"][Math.floor(Math.random()*4)];
      p += `VARIATION: frame it as ${ugcLens}; ${pickVariationMood()}. Keep it authentically UGC — never a studio product composition. `;
      p += `TYPOGRAPHY SIZE (mandatory): the caption text is LARGE and bold — big enough to read instantly on a small mobile screen — just in a casual native style rather than a formal headline. Text sells the creative as much as the image. `;
    } else {
      if(useProd){
        p += `Product packaging LARGE and dominant — lower ~55% as the clear hero. Prefer "Clinical Formula", never "Mineral Formula". `;
        p += `CRITICAL PRODUCT FIDELITY: the tube/bottle CAP is ALWAYS WHITE — never red, navy, blue, green or any coloured cap. Reproduce the real packaging exactly, white cap included. `;
      } else {
        p += `Do NOT show any product packaging or tube. Brand the image with the LACALUT logo only (small, top-centre or a corner). `;
      }
      p += `VARIATION (make THIS render visually DISTINCT from other ads of the same concept): compose it as a ${pickVariationLens()}; ${pickVariationMood()}. Choose a fresh, unexpected composition — do NOT default to the obvious centred-hero-on-a-glowing-backdrop look. `;
      p += `TYPOGRAPHY SIZE (mandatory): render the MAIN HEADLINE as the single biggest element on the canvas — huge, bold and dominant — and the SUBHEADLINE clearly extra-large too, so both read instantly on a small mobile screen. Prioritise large, legible headline/subheadline type over decorative detail. `;
    }
    p += `PACKAGING FINE-PRINT: keep any small printed body or claims text on the product packaging in the product\u0027s ORIGINAL GERMAN and render it small and softly out of focus so it is NOT legible; never reproduce the pack fine print as legible English health, disease or treatment claims (e.g. never show readable words like bleeding, gingivitis, periodontitis in English). `; p += `TEXT CONTRAST (mandatory — the single most important design rule): all overlay text must be high-contrast and instantly legible. On any red, dark or saturated background the text MUST be white/light; on any white, light, pale or pastel background the text MUST be navy/dark. NEVER white or light text on a light/pale background (e.g. no white on light blue), and NEVER navy/dark text on a red or dark background. `; p += `TITLE CASE (mandatory): the MAIN HEADLINE and the SUB-HEADLINE must BOTH be written in Title Case — capitalise the first letter of every significant word (e.g. "German Pharmacy Whitening That Lifts Everyday Stains"). Never sentence case, never all-lowercase for the sub-headline. `; p += `HEADLINE vs SUB-HEADLINE COLOUR (mandatory): render the main headline and the sub-headline in two DIFFERENT but complementary on-brand colours — never both in the same flat colour. e.g. a white headline with a brand-red #CF102D or light-accent sub-headline, or a navy #004A88 headline with a brand-red sub. Both must stay high-contrast against the background; the slight colour shift separates the two lines and makes the copy pop and feel more clickable. `; p += `BADGE & ICON SYSTEM (mandatory): give benefit and trust badges a small relevant icon (e.g. sparkle for stain-lift, a tooth, a shield for protection, a globe for "trusted in X countries", a medal or ribbon for heritage / "since 1925") — icons crisp and consistent line-weight, never plain unstyled text labels. SHAPE CONSISTENCY (hard rule): within THIS single image EVERY benefit/feature badge MUST be the exact SAME shape as the others — all identical rounded pills, OR all identical rectangles, OR all identical squares — NEVER mix different badge shapes in one image (mixed shapes look unprofessional and cheap). All trust badges likewise share one uniform shape. Pick ONE badge shape for the set; the shape MAY differ between separate images for variety, but must be uniform inside any one image. `; p += `BADGE CONTRAST (non-negotiable — the #1 design rule): light or white badge text ALWAYS sits on a DARK, deep or saturated fill (navy #004A88, brand red #CF102D, deep teal or charcoal) — NEVER on a light, pale or pastel fill (e.g. never white text on light blue). Dark text (navy or charcoal) sits ONLY on a white or light fill. When unsure, darken the badge background until the text reads instantly. `; p += `HEADLINE LEGIBILITY (mandatory): wherever the headline sits over a busy, bright or light area, add a subtle darkened gradient, scrim or soft shadow directly behind the headline text so it stays high-contrast and instantly readable — never let a bright background or light flare wash out the headline. `; p += `PLAIN LANGUAGE: keep copy simple and everyday (this is a Facebook ad, not a science paper) - avoid medical or scientific jargon and never print obscure or scary-sounding ingredient names such as "aluminium lactate"; reference any formula plainly, e.g. "a special German gum-care formula". `; p += `${m.ar} aspect ratio, high-end premium finish, crisp legible typography, no spelling errors on any text.`;
    return p;
  }

  /* ═══ MULTI-SKU PROMPT BUILD (range / family / campaign shot) ═══ */
  function buildMultiPrompt(opts){
    const mode = opts.mode || 'social', brain = opts.brain;
    const brief = (opts.brief || '').trim();
    const advNeg = opts.advNeg !== false;
    const names = opts.skuNames || [];
    const form = (opts.form || '').trim();
    const m = MODES[mode];
    const bans = [...new Set([...GLOBAL_BAN, ...(opts.bans || [])])];
    let p = `Professional graphic-designed ${m.label} for LACALUT (premium German pharmacy oral-care brand) featuring MULTIPLE products together — ${names.length} products: ${names.join(', ')}. `;
    p += `STRICT brand colours — dominant LACALUT red #CF102D + navy #004A88, clean premium palette (each product may keep its own accent). `;
    p += `Arrange all ${names.length} products together as ONE cohesive premium hero composition — a "range line-up" / family shot: every product clearly visible, evenly balanced and distinct, none obscured or merged. `;
    if(brain){
      p += `CREATIVE STRATEGY — "${brain.name}": `;
      brain.dims.forEach(([d,pool])=>{ const v=pickStr(pool); if(v) p += `${d} — ${v}. `; });
    }
    if(brief) p += `Art-director note (HIGHEST priority — follow it exactly): ${brief}. `;
    if(opts.headline) p += `TOPIC LOCK (highest priority): the main on-image headline and all overlay text must convey THIS exact message — "${opts.headline}". `;
    if(advNeg) p += `STRICT COMPLIANCE — never show or write any of these words/claims: ${bans.join(', ')}. `;
    p += `ALL overlay/design text — headline, labels, badges — must be in ENGLISH (Australian English) ONLY; never German, never bilingual. (Each product's own printed packaging text stays unchanged.) `;
    p += `The products are LARGE and dominant as the clear hero of the composition. Prefer "Clinical Formula", never "Mineral Formula". `;
    p += `CRITICAL PRODUCT FIDELITY: every tube/bottle CAP is ALWAYS WHITE — never red, navy, blue, green or any coloured cap. Reproduce the real packaging exactly, white caps included. `;
    p += `CONSISTENT PRODUCT FORM (mandatory, non-negotiable): render ALL ${names.length} products as ${form||'ONE single form (all tubes OR all boxes — never mixed)'}${form?` — show EVERY product as ${form} and NOTHING else (do NOT draw tubes if these are boxes, do NOT draw boxes if these are tubes, do NOT add a mouthwash bottle unless these ARE bottles)`:''}. Identical form for every product, matching the reference photos exactly. NEVER mix forms in one image; even if a supplied reference photo shows a box AND a tube together, render ONLY the ${form||'chosen'} form. Keep it uniform so the range reads as one clean, cohesive set. `;
    p += `COPY RELEVANCE: every headline and overlay line must be specifically about ORAL CARE — gums, teeth, toothpaste or fresh breath — never a vague generic line like "German pharmacy care" on its own; tie it to the actual products (e.g. "German pharmacy-grade oral care"). `;
    p += `VARIATION (make THIS render visually DISTINCT from other range shots): compose it as a ${pickVariationLens()}; ${pickVariationMood()}. Choose a fresh, unexpected arrangement — do NOT default to a flat line-up on a plain backdrop. `;
    p += `TYPOGRAPHY SIZE (mandatory): render the MAIN HEADLINE as the single biggest element on the canvas — huge, bold and dominant — and the SUBHEADLINE clearly extra-large too, so both read instantly on a small mobile screen. Prioritise large, legible headline/subheadline type over decorative detail. `;
    p += `PACKAGING FINE-PRINT: keep any small printed body or claims text on the product packaging in the product\u0027s ORIGINAL GERMAN and render it small and softly out of focus so it is NOT legible; never reproduce the pack fine print as legible English health, disease or treatment claims (e.g. never show readable words like bleeding, gingivitis, periodontitis in English). `; p += `TEXT CONTRAST (mandatory — the single most important design rule): all overlay text must be high-contrast and instantly legible. On any red, dark or saturated background the text MUST be white/light; on any white, light, pale or pastel background the text MUST be navy/dark. NEVER white or light text on a light/pale background (e.g. no white on light blue), and NEVER navy/dark text on a red or dark background. `; p += `TITLE CASE (mandatory): the MAIN HEADLINE and the SUB-HEADLINE must BOTH be written in Title Case — capitalise the first letter of every significant word (e.g. "German Pharmacy Whitening That Lifts Everyday Stains"). Never sentence case, never all-lowercase for the sub-headline. `; p += `HEADLINE vs SUB-HEADLINE COLOUR (mandatory): render the main headline and the sub-headline in two DIFFERENT but complementary on-brand colours — never both in the same flat colour. e.g. a white headline with a brand-red #CF102D or light-accent sub-headline, or a navy #004A88 headline with a brand-red sub. Both must stay high-contrast against the background; the slight colour shift separates the two lines and makes the copy pop and feel more clickable. `; p += `BADGE & ICON SYSTEM (mandatory): give benefit and trust badges a small relevant icon (e.g. sparkle for stain-lift, a tooth, a shield for protection, a globe for "trusted in X countries", a medal or ribbon for heritage / "since 1925") — icons crisp and consistent line-weight, never plain unstyled text labels. SHAPE CONSISTENCY (hard rule): within THIS single image EVERY benefit/feature badge MUST be the exact SAME shape as the others — all identical rounded pills, OR all identical rectangles, OR all identical squares — NEVER mix different badge shapes in one image (mixed shapes look unprofessional and cheap). All trust badges likewise share one uniform shape. Pick ONE badge shape for the set; the shape MAY differ between separate images for variety, but must be uniform inside any one image. `; p += `BADGE CONTRAST (non-negotiable — the #1 design rule): light or white badge text ALWAYS sits on a DARK, deep or saturated fill (navy #004A88, brand red #CF102D, deep teal or charcoal) — NEVER on a light, pale or pastel fill (e.g. never white text on light blue). Dark text (navy or charcoal) sits ONLY on a white or light fill. When unsure, darken the badge background until the text reads instantly. `; p += `HEADLINE LEGIBILITY (mandatory): wherever the headline sits over a busy, bright or light area, add a subtle darkened gradient, scrim or soft shadow directly behind the headline text so it stays high-contrast and instantly readable — never let a bright background or light flare wash out the headline. `; p += `PLAIN LANGUAGE: keep copy simple and everyday (this is a Facebook ad, not a science paper) - avoid medical or scientific jargon and never print obscure or scary-sounding ingredient names such as "aluminium lactate"; reference any formula plainly, e.g. "a special German gum-care formula". `; p += `${m.ar} aspect ratio, high-end premium finish, crisp legible typography, no spelling errors on any text.`;
    return p;
  }

  /* ═══ GEMINI CALL (DOM-free) ═══ */
  function dataUrlToInlinePart(d){ const m=/^data:([^;]+);base64,(.*)$/.exec(d||''); return m?{inlineData:{mimeType:m[1],data:m[2]}}:null; }

  async function callGemini(opts){
    const prompt = opts.prompt;
    const apiKey = opts.apiKey || (global.localStorage && localStorage.getItem('lc_gemini_key')) || '';
    const model  = opts.model  || (global.localStorage && localStorage.getItem('de_model')) || 'gemini-2.5-flash-image';
    const render = opts.render || 'photoreal';
    if(!apiKey) throw new Error('No Gemini API key');

    const pRefs=(opts.productImgs||[]).map(dataUrlToInlinePart).filter(Boolean).slice(0,6);
    const sRefs=(opts.styleImgs||[]).map(dataUrlToInlinePart).filter(Boolean).slice(0,3);
    const pLabels=opts.productLabels||null;
    let instr='';
    if(pRefs.length){
      const base=(pLabels && pLabels.length>1)
        ? `The FIRST ${pRefs.length} reference images are ${pRefs.length} DIFFERENT LACALUT products, in this exact left-to-right order: ${pLabels.slice(0,pRefs.length).map((n,i)=>`${i+1}) ${n}`).join(', ')}. Treat each image ONLY as the source of truth for THAT product's real packaging shape, label layout, colours, logo and exact wording. Keep every product visually DISTINCT and every label word and logo accurate and legible; never invent, garble, mistranslate, merge or swap the products' text. `
        : `The FIRST ${pRefs.length} reference image(s) show the EXACT LACALUT product — treat them ONLY as the source of truth for the product's branding: real packaging shape, label layout, colours, logo and exact wording. Keep every label word and logo accurate and legible; never invent, garble, mistranslate or alter the product text. `;
      if(opts.chatShot){
        instr+=base+`Place the product ONLY as a small, flat, slightly-compressed PHOTO inside a chat message bubble — exactly like a JPEG a friend texted you (an MMS). Keep the packaging, label, logo and wording accurate and legible, white cap. Do NOT render it as a large 3D studio hero, do NOT give it a new background, scene, podium or dramatic lighting — it is just a small inline photo within a flat messaging-screen screenshot. `;
      } else {
        const angle=`You have creative freedom over the product's ANGLE and composition — choose a fresh, dynamic, flattering hero angle (standing upright, three-quarter turn, tilted, or lying on a surface); it need NOT match the reference photo's angle. `;
        if(render==='exact') instr+=base+`Reproduce the product exactly as photographed — flat and unchanged. `;
        else if(render==='graphical') instr+=base+angle+`Render the product as a clean, glossy premium 3D CGI product render — dimensional form, studio lighting, crisp reflections, graphic-design ad aesthetic. `;
        else instr+=base+angle+`Render the product as a hyper-realistic photographic 3D studio product shot — realistic lighting, soft shadows, gentle reflections, depth and dimension, sitting believably in the scene. `;
      }
    }
    if(sRefs.length) instr+=`The NEXT ${sRefs.length} reference image(s) show the DESIGN STYLE to emulate — match their layout, typography, colour-blocking and composition, but do NOT copy their product, logos or wording. `;
    const parts=[{text:(instr?instr+'Now create the following: ':'')+prompt}, ...pRefs, ...sRefs];
    // Aspect ratio: gemini-3 pro image supports imageConfig.aspectRatio natively (4:5, 9:16, 1:1…).
    // Nano (2.5-flash-image) ignores it — relies on the prompt text instead — so only send it to Pro to avoid a 400.
    const gcfg = { responseModalities:['TEXT','IMAGE'] };
    if (opts.aspectRatio && /gemini-3/.test(model)) gcfg.imageConfig = { aspectRatio: opts.aspectRatio };
    const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+apiKey,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ contents:[{role:'user',parts}], generationConfig: gcfg }) });
    const data=await res.json();
    if(!res.ok) throw new Error(data.error?.message||'HTTP '+res.status);
    const part=data.candidates?.[0]?.content?.parts?.find(p=>p.inlineData);
    if(!part?.inlineData?.data) throw new Error('No image returned — try a more specific brief.');
    return 'data:'+(part.inlineData.mimeType||'image/png')+';base64,'+part.inlineData.data;
  }

  /* ═══ HIGH-LEVEL: one designed image from a brain ═══ */
  async function generateImage(opts){
    const sku  = opts.sku || 'aktiv';
    const mode = opts.mode || 'social';
    let render = opts.render || 'photoreal';
    if(render==='mixed') render = Math.random()<0.5 ? 'photoreal' : 'graphical';

    const brain = opts.brain || resolveBrain(opts.brainId);
    const isChat = brain && /chat|text message/i.test(brain.name);
    const wantsProduct = /\b(box|tube|pack|packshot|packaging|product|bottle)\b/i.test(opts.brief||''); const useProd = isChat ? true : ((typeof opts.useProd==='boolean') ? opts.useProd : ((brain && brain.product==='none') ? false : true));
    const prompt = buildPrompt({ sku, mode, brain, brief:opts.brief, headline:opts.headline, advNeg:opts.advNeg, useProd });
    const aspectRatio = ((MODES[mode] && MODES[mode].ar) || '4:5').split(' ')[0];

    const url = await callGemini({
      prompt,
      productImgs: useProd ? (opts.productImgs||[]).filter(Boolean) : [],
      styleImgs:   useProd ? (opts.styleImgs||[]).filter(Boolean) : [],
      render, model: opts.model, apiKey: opts.apiKey, aspectRatio, chatShot: isChat
    });
    const finish = render==='graphical'?'CGI':render==='exact'?'flat':'photoreal';
    const label = (brain?brain.name:'Hero') + (useProd?' · '+finish:' · logo-only');
    return { url, label, brain, useProd, render, prompt };
  }

  /* ═══ IMAGE-TO-IMAGE EDIT ═══ */
  async function editImage(opts){
    const apiKey = opts.apiKey || (global.localStorage && localStorage.getItem('lc_gemini_key')) || '';
    const model  = opts.model  || (global.localStorage && localStorage.getItem('de_model')) || 'gemini-2.5-flash-image';
    const sku = opts.sku || 'aktiv';
    const part = dataUrlToInlinePart(opts.imgDataUrl); if(!part) throw new Error('bad image');
    const refs = (opts.refImgs||[]).map(dataUrlToInlinePart).filter(Boolean).slice(0,4);
    const bans=[...GLOBAL_BAN, ...(SKUS[sku]?.ban||[])];
    let text=`Edit the FIRST attached image. Apply ONLY this change: ${opts.instruction}. `;
    if(refs.length){
      text+=`The ${refs.length} image(s) AFTER the first are REFERENCE photos of the EXACT real product(s), used ONLY as the source of truth for each product's branding: real packaging shape, label layout, colours, logo and exact wording; never invent, garble or alter the product text. Match each product to the correct position described in the instruction. `
        +`CRITICAL: keep each replaced product in the SAME position, orientation, upright/standing angle, scale, perspective and lighting as in the ORIGINAL first image. Do NOT copy the reference photo's orientation, angle, lighting or background — if a tube stands vertical in the original, it must stay vertical; the reference only supplies the label artwork. `;
    }
    text+=`Keep the ENTIRE rest of the image pixel-identical — same layout, background, other elements and all overlay text. Do not restyle or regenerate anything else. `
      +`Never add any of these words/claims: ${bans.join(', ')}.`;
    const gcfg={responseModalities:['TEXT','IMAGE']};
    // Variation: a distinct seed (+ temperature) per call makes Qty>1 return DIFFERENT rolls
    // instead of identical clones. Without these the edit is near-deterministic.
    if(opts.seed!=null) gcfg.seed=opts.seed;
    if(opts.temperature!=null) gcfg.temperature=opts.temperature;
    if(opts.aspectRatio && /gemini-3/.test(model)){ gcfg.imageConfig={aspectRatio:opts.aspectRatio};
      text+=` Output the final image in a ${opts.aspectRatio} aspect ratio (fill the frame; add clean matching background around the product if needed — never squash or stretch it).`; }
    const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+apiKey,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ contents:[{role:'user',parts:[{text}, part, ...refs]}], generationConfig:gcfg }) });
    const data=await res.json();
    if(!res.ok) throw new Error(data.error?.message||'HTTP '+res.status);
    const p=data.candidates?.[0]?.content?.parts?.find(x=>x.inlineData);
    if(!p?.inlineData?.data) throw new Error('No edited image returned.');
    return 'data:'+(p.inlineData.mimeType||'image/png')+';base64,'+p.inlineData.data;
  }

  /* ═══════════════════════════════════════════════════════════════════
     AICIS COMPLIANCE SANITISER
     Belt-and-braces guard on any COPY (captions, hooks, hashtags) before
     it is stored or pushed. Rewrites therapeutic/disease terms into
     cosmetic language so a non-compliant Claude output (or legacy stored
     copy) can never reach a live post.
     ═══════════════════════════════════════════════════════════════════ */
  // Phrase → cosmetic replacement. Order matters (longest/most-specific first).
  const COPY_REPLACEMENTS = [
    [/periodontal disease/gi, 'gum health issues'],
    [/periodontitis/gi,       'gum health issues'],
    [/gingivitis/gi,          'gum problems'],
    [/gum disease/gi,         'gum problems'],
    [/halitosis/gi,           'bad breath'],
    [/\btreats?\b/gi,         'supports'],
    [/\bcures?\b/gi,          'supports'],
    [/\bheals?\b/gi,          'soothes'],
    [/\breverses?\b/gi,       'helps improve']
  ];
  // Hashtags that must never appear → safe swaps (deduped after).
  const HASHTAG_SWAPS = {
    gingivitis:'gumcare', periodontitis:'gumhealth', periodontaldisease:'gumhealth',
    periodontal:'gumhealth', gumdisease:'gumcare', halitosis:'freshbreath',
    curegumdisease:'gumcare', treatgingivitis:'gumcare'
  };

  function sanitizeCopy(text){
    if(!text) return text;
    let out = String(text);
    for(const [re, rep] of COPY_REPLACEMENTS) out = out.replace(re, rep);
    return out;
  }

  // Accepts a string ("#a #b") or an array (["a","b"]) → returns SAME type, sanitised + deduped.
  function sanitizeHashtags(tags){
    const wasArray = Array.isArray(tags);
    let list = wasArray ? tags.slice() : String(tags||'').split(/\s+/);
    const seen = new Set(); const out = [];
    for(let t of list){
      if(!t) continue;
      let bare = t.replace(/^#/, '').toLowerCase().replace(/[^a-z0-9]/g,'');
      if(!bare) continue;
      if(HASHTAG_SWAPS[bare]) bare = HASHTAG_SWAPS[bare];
      if(seen.has(bare)) continue;
      seen.add(bare);
      out.push(wasArray ? bare : '#'+bare);
    }
    return wasArray ? out : out.join(' ');
  }

  // Returns true if copy still contains any banned disease/therapeutic term
  // AFTER sanitising (should always be false — used for QC assertions/tests).
  function hasBannedTerm(text){
    const t = String(text||'').toLowerCase();
    return /gingivitis|periodontitis|periodontal disease|gum disease|halitosis/.test(t);
  }

  /* ═══ ONE-UP LOOP (image prompt) — the "Copy Brain" one-up rule, applied to the IMAGE PROMPT ═══
     Takes the assembled base prompt and runs an internal draft → one-up → one-up → … → pinnacle
     refinement through a Gemini TEXT model, so EVERY strategy toggle ships a genuinely
     scroll-stopping, over-the-top brief instead of a plain one. Never throws — on any failure it
     returns the original base prompt unchanged, so an image is always produced. */
  async function oneUpImagePrompt(opts){
    const basePrompt = (opts.basePrompt||'').trim();
    const apiKey = opts.apiKey || (global.localStorage && localStorage.getItem('lc_gemini_key')) || '';
    const model  = opts.textModel || 'gemini-2.5-flash';
    const rounds = opts.rounds || 4;
    if(!apiKey || !basePrompt) return basePrompt;
    const meta =
`You are the single best Meta / Facebook / Instagram ADS ART DIRECTOR and image-prompt engineer alive, working for LACALUT — a premium 100-year German pharmacy oral-care brand. Your one job: turn a competent image brief into a THUMB-STOPPING, scroll-stopping, over-the-top HERO visual that no one can scroll past. Boring, plain, safe or generic = total failure.

Follow this ONE-UP LOOP internally before you answer:
1. Write draft v1 from the base brief.
2. Then one-up it: v2 must be MORE scroll-stopping than v1. Then v3 > v2. Then v4 > v3. Do at least ${rounds} rounds.
3. Each round, ask yourself: "Can I make this more visually arresting, more cinematic, more premium, more surprising, more emotionally charged, higher production value?" Push composition, scale, lighting, drama, colour, contrast, depth, implied motion, and the hero moment harder every time.
4. Only stop at the ZENITH / PINNACLE — when it genuinely cannot get better without breaking a hard rule.
5. Output ONLY that final pinnacle brief. Never show the drafts or your reasoning.

DIVERGENCE (critical): this is ONE of many ads for this strategy — it MUST look clearly DIFFERENT from the others. Build the pinnacle AROUND the specific composition/camera lens and colour mood named in the base brief's VARIATION directive; do not override them with the obvious centred-hero look. A distinct, unexpected execution beats a generic "perfect" one — never collapse every render to the same single best idea.

HARD RULES — the final brief MUST keep every one of these from the base brief, never trade them away for drama:
- The REAL product packaging: exact shape, label layout, brand colours, logo and exact printed wording. Never invent, garble, translate or alter product text. Keep which product(s) appear. The product CAP is ALWAYS WHITE — never red, navy, blue or any coloured cap.
- CONSISTENT PRODUCT FORM: if multiple different products appear, they MUST all be the same format — all tubes/bottles OR all boxes, never a mix of tubes and boxes in one image.
- COPY RELEVANCE: every headline, caption and overlay line must be specifically about oral care — gums, teeth, toothpaste, fresh breath or the whitening/repair benefit. Never a vague generic line like "German pharmacy care" on its own; always tie it to the actual product.
- If the base brief is a UGC PHOTO, keep a real, clearly-visible everyday PERSON as the subject holding or using the product at its true real-world size — never collapse it to a product-only, hand-only or studio-hero shot, and never oversize the product. Keep any on-image text a LARGE, bold, casual native caption (big enough to read on mobile) — casual in style, not a formal studio headline, but never tiny.
- ALL compliance / banned-word constraints. LACALUT is a COSMETIC, not a medicine. Cosmetic benefits ONLY (fresh breath, clean feel, firm/cared-for gum FEEL, removes plaque, removes stains, German quality, whiter smile). NEVER add, keep, imply or amplify any therapeutic / disease / gum-condition claim — specifically NEVER write "reduces/stops bleeding", "soothes", "soothes irritation", "reduces inflammation", "heals", "calms", "closes gum pockets", "kills bacteria/gum disease", "gingivitis", "periodontitis", "clinically proven", any statistic or percentage, any fake review/testimonial, or any competitor name. If the base brief contains such a claim, REMOVE it or rewrite it as a cosmetic feel-benefit — do not carry it into the final brief.
- Every overlay/design text word in Australian English ONLY, minimal and correctly spelled.
- The exact aspect ratio and the product-hero / logo instruction from the base brief.
- Keep the MAIN HEADLINE the single biggest element on the canvas and the SUBHEADLINE extra-large — both must read instantly on a small mobile screen. Never shrink the headline for the sake of a dramatic scene.
- TITLE CASE: keep BOTH the main headline and the sub-headline in Title Case (capitalise every significant word); never rewrite either into sentence case or all-lowercase.
- HEADLINE vs SUB COLOUR: render the headline and sub-headline in two DIFFERENT complementary on-brand colours (never the same flat colour) — both still high-contrast against the background — so the two lines separate and pop.
- Keep icon'd badges (globe = countries, medal/ribbon = heritage, shield = protection, sparkle = stain-lift). Every badge in the image MUST be the SAME shape as the others — uniform pills OR uniform rectangles OR uniform squares, NEVER a mix of shapes in one image. Never flatten to plain unstyled text.
- CONTRAST IS THE #1 RULE: light/white badge or overlay text ONLY on a dark/deep/saturated fill (navy, brand red, deep teal, charcoal); dark/navy text ONLY on white/light fills. NEVER white text on a light or pastel fill (no white on light blue). Keep a darkened scrim/shadow behind any headline over a bright or busy area.
- Unmistakably LACALUT and on-brand: over-the-top in CRAFT and art direction, never off-brand chaos.

Return ONLY valid JSON: {"prompt":"<the final pinnacle image prompt, fully self-contained>"}.

BASE BRIEF:
"""
${basePrompt}
"""`;
    try{
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+apiKey,
        { method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ contents:[{role:'user',parts:[{text:meta}]}], generationConfig:{ responseMimeType:'application/json', temperature:1.0 } }) });
      const data = await res.json();
      if(!res.ok) return basePrompt;
      let txt = (data.candidates?.[0]?.content?.parts||[]).map(p=>p.text).filter(Boolean).join('').replace(/```json|```/g,'').trim();
      let obj; try{ obj = JSON.parse(txt); }catch(e){ return basePrompt; }
      let refined = (obj && obj.prompt) ? String(obj.prompt).trim() : '';
      if(!refined || refined.length < 40) return basePrompt;
      // Safety belt — guarantee the non-negotiables survived the rewrite, re-append any that got dropped.
      const bans = (opts.bans && opts.bans.length) ? opts.bans.join(', ') : '';
      let tail = '';
      if(bans && !/never show or write|compliance/i.test(refined)) tail += ` STRICT COMPLIANCE — never show or write any of these words/claims: ${bans}.`;
      if(!/australian english|english only|english \(/i.test(refined)) tail += ` ALL overlay/design text in ENGLISH (Australian English) ONLY; minimal and correctly spelled.`;
      if(opts.aspectRatio && refined.indexOf(opts.aspectRatio)===-1) tail += ` ${opts.aspectRatio} aspect ratio.`;
      return refined + tail;
    }catch(e){ return basePrompt; }
  }

  global.LacalutEngine = {
    BRAINS, SKUS, MODES, GLOBAL_BAN, DEFAULT_GUIDES, GUIDE_SECTIONS,
    getGuide, pickStr, pickRand,
    resolveBrain, brainUsesProduct, pickBrainForCategories,
    buildPrompt, buildMultiPrompt, callGemini, generateImage, editImage, dataUrlToInlinePart,
    oneUpImagePrompt,
    sanitizeCopy, sanitizeHashtags, hasBannedTerm
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.LacalutEngine;

})(typeof window !== 'undefined' ? window : globalThis);
