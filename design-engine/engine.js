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
      say:'natural gum care, 9 medicinal herbs, gums that feel cared-for naturally',
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
      say:'removes surface stains, supports natural whiteness, enamel-kind German formula',
      ban:['peroxide','bleach'] }
  };
  const GLOBAL_BAN = ['gingivitis','periodontitis','gum disease','halitosis','reverses the condition','graphic bleeding gums close-up',
    'bleeding','reduces bleeding','stops bleeding','stops gum bleeding','gum bleeding',
    'soothes','soothes irritation','irritation','inflammation','reduces inflammation','anti-inflammatory',
    'heals','calms','closes gum pockets','kills bacteria','kills the bacteria','clinically proven','clinically tested','clinical trial','gum health','oral health','dental health','healthy tissue','healthy gums','dentist approved','dentist recommended'];

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
     formula:['white salt-mineral rock clusters','angular hydroxyapatite crystal shards','clear enamel crystals','clean water splash (NO herbs — herbs belong to Aktiv Herbal only)'],
     usps:['Firms & cares for the gum line','Intensive German deep-clean formula','12-hour lasting fresh feel','Astringent firm-gum feel','A noticeably deep-clean feel, every brush','Daily intensive gum care','The German standard in gum care','Trusted German pharmacy heritage'],
     headlines:['Gums That Feel Firm & Cared-For','Intensive German Gum Care','Firm, Fresh, Cared-For Gums','The German Standard in Gum Care','Give Your Gums the German Way','Strong-Feeling Gums, Every Day','Your Gums Deserve German Care','Firm-Gum Feel, Day After Day','Serious About Your Gum Line','The Daily Upgrade for Your Gums','German Gum Care Since 1925','Care for Your Gums the German Way'],
     subheadlines:['Intensive Formula for a Firm Gum Feel','Notice the Difference From Day One','The German Standard of Gum Care','Astringent Care for a Cared-For Gumline','Daily Intensive Gum Care','Firm, Fresh and Cared-For','German Pharmacy Heritage Since 1925','For Gums That Feel Strong','The Intensive Gum-Care Ritual','Premium German Oral Care'],
     benefits:['Firm Gumline Feel','Cared-For Gums','Astringent Firm Feel','Removes Plaque','Fresh for 12 Hours','German Gum-Care Formula','Deep-Clean Feel','Daily Intensive Care','Strong-Feeling Gumline','Fresh Confident Mouth','Pharmacy-Grade Care','Trusted German Formula'],
     trust:['Made in Germany','Pharmacy Grade','100+ Years Expertise','German Pharmacy Heritage','Since 1925'] },
   'aktiv-herbal':{ colours:'Herbal green #2E7D46 / #7CB342 dominant, red #CF102D on logo & result pill only, navy #004A88 headers',
     backgrounds:['clean white studio background, soft natural shadow','deep forest-green gradient with botanical silhouettes and soft light','lush botanical scene, fresh herbs and green leaves, natural daylight','soft sage-green gradient with dew and leaf accents','dark green-to-emerald gradient, premium herbal mood','sunlit herb-garden flat-lay with sage, chamomile and mint','deep emerald studio with glowing botanical particles and dew','fresh eucalyptus-and-mint arrangement on a pale stone surface','moody enchanted-forest backdrop with god-rays and floating leaves','bright botanical white scene with scattered fresh herbs and water dew','green marble surface with herbal sprigs and soft daylight','macro dewy leaf texture with the product emerging, natural glow'],
     formula:['white mineral base with the 9 medicinal herbs','fresh sage, chamomile and myrrh sprigs','green botanical leaves','soft water dew'],
     usps:['9 valuable natural herbs','Natural gum care, German formula','Astringent herbal firm-gum feel','Herbal freshness, German quality','Botanical daily gum care','Nature meets German pharmacy care','Fresh herbal clean feel'],
     headlines:['Nature’s Answer to Firm, Fresh Gums','9 Herbs · German Gum Care','Natural Gum Care, German Made','Firm-Feeling Gums, Naturally','The Herbal Way to German Gum Care','Where Nature Meets German Care','9 Herbs for a Firmer Gum Feel','Botanical Care, German Precision','Naturally Firm, Naturally Fresh','Your Gums, the Natural Way','German Herbal Gum Care','Fresh From Nature, Made in Germany'],
     subheadlines:['9 Medicinal Herbs · German Formula','Aromatherapy Brushing Experience','Nature Meets German Gum Care','A Botanical Firm-Gum Ritual','Herbal Freshness, German Quality','9 Herbs, One German Formula','Naturally Fresh, Daily','The Herbal Gum-Care Ritual','Botanical Care Since 1925'],
     benefits:['Fresh Herbal Comfort','Firm Gumline Feel','Astringent Firm Feel','9 Herb Extracts','Natural German Gum Care','Fresh Botanical Clean','Herbal Fresh Feel','Cared-For Gums, Naturally','Daily Botanical Care','Gentle Herbal Formula','9 Powerful Herbs','Naturally Fresh Breath'],
     trust:['9 Natural Herbs','Made in Germany','Pharmacy Grade','German Pharmacy Heritage','Since 1925','Naturally Derived Herbs'] },
   'flora':{ colours:'TOOTHPASTE navy #004A88 + citrus-yellow; MOUTHWASH fresh green #2E9E5B; red #CF102D on logo/pill only',
     backgrounds:['clean white studio background, minimal fresh look','deep navy-blue gradient with water ripples and hex pattern','fresh green gradient (mouthwash) with mint leaves and splash','bright citrus-fresh scene, lemon and ice accents, airy','cool blue-to-teal gradient, crisp hygienic mood','splashing water crown with mint leaves frozen mid-air','icy blue backdrop with frost crystals and cold vapour','sunlit citrus flat-lay with lemon, lime and fresh mint','dark teal studio with a single bright mint-green light beam','fresh dewy mint leaves macro with the product emerging','clean spa-blue gradient with soft bubbles and reflections'],
     formula:['silver-grey zinc-gluconate granules','white mineral powder','fresh lemon peel twists','mint leaves','light water splash'],
     usps:['Tackles bad breath at the source','For lasting fresh breath','Supports a fresh, balanced mouth feel','All-day breath confidence','Clean, fresh mouth feel','Gentle daily freshness','German fresh-breath formula'],
     headlines:['Beat Garlic & Onion Breath','Goodbye Morning Breath','Coffee Breath, Handled','Onion, Garlic, Coffee — Out','End Morning Dragon-Breath','Fresh Breath That Lasts','All-Day Fresh Breath','Say Goodbye to Bad Breath','Confidence in Every Breath','German Freshness, All Day','Breath So Fresh You’ll Notice','Fresh From the First Rinse','Own the Room With Fresh Breath','The Fresh-Breath Upgrade','Fresh Mouth, Full Confidence','Kiss Bad Breath Goodbye'],
     subheadlines:['Freshness at the Source','Fresh-Breath Formula','A Fresher Mouth Feel, Daily','German Freshness Since 1925','Clean, Confident, Fresh','For Breath That Lasts','The Daily Fresh-Breath Ritual','Premium German Fresh Care'],
     benefits:['Fights Bad Breath','Fresh, Balanced Mouth Feel','Long-Lasting Freshness','Gentle Daily Care','Clean, Confident Breath','All-Day Fresh Feel','Fresh From First Use','Cool Mint Freshness','German Fresh-Breath Care','Everyday Breath Confidence','Fresh Clean Finish'],
     trust:['Made in Germany','Pharmacy Grade','12h Fresh Feel','German Pharmacy Heritage','Since 1925'] },
   'sensitive':{ colours:'Teal #008490 / #0E6C7D dominant, red #CF102D on logo/pill only, navy #004A88 headers',
     backgrounds:['clean white studio background, soft gentle shadow','soft teal-to-white gradient, gentle mood','deep teal gradient with subtle enamel/mineral texture','airy pale-blue and teal scene with ice and feather accents','dark teal radial gradient, premium serene feel','soft-focus feather resting on still water, gentle light','frosted teal glass with cold vapour and soft glow','pale mint-and-white minimalist scene with a single ice crystal','serene spa-teal backdrop with smooth pebbles and water','macro enamel-white mineral surface with soft teal light','gentle gradient from icy blue to warm cream, comforting mood'],
     formula:['pale blue-teal soothing crystals','white mineral salt','cool ice shards','calm blue-teal light'],
     usps:['For sensitive teeth','Comfort for cold & hot twinges','Gentle daily care','Extra-gentle everyday cleaning','Builds a protective feel','German gentle-care formula','Comfort you can feel'],
     headlines:['Enjoy Ice Cream Again','No More Cold-Drink Twinges','That Ice-Cream Zing? Gone','Hot Coffee, Cold Ice — No Wince','Cold Air, No Wince','Enjoy Cold & Hot Again','Comfort for Sensitive Teeth','Everyday Comfort, German Made','Gentle Care, Real Comfort','From Twinges to Comfort','Say Yes to Cold Drinks Again','Gentle on Teeth, Serious on Care','Comfort in Every Brush','The Gentle German Choice','Enjoy Every Bite Again','Sensitive Teeth, Meet Comfort'],
     subheadlines:['Gentle Care for Sensitive Teeth','Gentle Everyday Comfort','A Protective Everyday Feel','German Gentle-Care Formula','Comfort That Lasts','For Teeth That Need Extra Care','The Gentle Daily Ritual','Premium German Comfort Care'],
     benefits:['Comfort for Sensitive Teeth','Protective Everyday Feel','Extra-Gentle Cleaning','Long-Lasting Comfort','Gentle Daily Care','Kind to Sensitive Teeth','Everyday Comfort Feel','Protective Everyday Care','Gentle German Formula','Comfort From First Use','Cold & Hot Comfort'],
     trust:['Made in Germany','Pharmacy Grade','Gentle Formula','German Pharmacy Heritage','Since 1925'] },
   'white-repair':{ colours:'TOOTHPASTE bright white + red headline pill #CF102D; MOUTHWASH silver/platinum grey; navy #004A88 headers',
     backgrounds:['clean bright white studio background, sparkle highlights','silver/platinum gradient, premium sheen','deep navy gradient with diamond sparkle and enamel stones','soft white-to-silver gradient, bright airy whitening feel','cool grey studio with reflective floor and light burst','bright white surface with a single dazzling light flare','crystal-and-diamond arrangement catching bright light','polished marble surface with soft sparkle and clean reflections','dark charcoal studio with a bright white beam on the product','macro enamel-white mineral texture with sparkle particles','frosted silver gradient with subtle shimmer and clean shadow'],
     formula:['white hydroxyapatite pearls','clear ice / enamel cubes','subtle diamond sparkle','bright white mineral powder'],
     usps:['Removes surface stains','Enamel-kind gentle whitening','No peroxide','Gentle daily whitening','Reveals natural whiteness','Enamel-safe whitening','German whitening care'],
     headlines:['Coffee, Tea & Wine Stains — Gone','Beat Coffee & Tea Stains','Wave Goodbye To Yellow Teeth','Your Coffee Habit, Erased','Undo Years Of Surface Stains','Stains From Coffee, Tea & Wine — Lifted','Whiter, Stronger-Feeling Teeth','A Brighter, Whiter Smile','Gentle Whitening, German Made','Remove Stains, Reveal White','Your Whiter Smile Starts Here','Brighten Without the Bleach','Say Goodbye to Surface Stains','The Gentle Road to White','Whiter Teeth, Happy Enamel','Reveal Your Natural White','Bright Smile, German Care'],
     subheadlines:['Gentle Whitening & Enamel Protection','Whiter Smile, Enamel-Safe','Brighten Without Bleach','No-Peroxide Whitening Care','For a Naturally Whiter Smile','Gentle Daily Whitening','The Enamel-Safe Whitening Ritual','Premium German Whitening'],
     benefits:['Removes Surface Stains','Supports Natural Whiteness','Enamel-Kind Care','No Peroxide','Gentle Daily Whitening','Brighter Smile Feel','Strong-Enamel Feel','Whiter From First Use','Enamel-Safe Formula','Bright Confident Smile','German Whitening Care'],
     trust:['Made in Germany','Pharmacy Grade','Enamel-Safe','No Peroxide','Since 1925'] }
  };
  const GUIDE_SECTIONS = [['backgrounds','Background Styles (colour + scene — engine varies these)'],['formula','Formula Elements (signature ingredients — ALWAYS applied, EXCLUSIVE to this SKU: never another formula’s elements)'],['usps','USPs'],['headlines','Main Headlines'],['subheadlines','Subheadlines'],['benefits','Benefits'],['trust','Trust Elements']];

  // Pool sanitiser — saved localStorage guides can carry legacy fabricated/unverifiable cues
  // (Dermatologically Tested, Loved by Millions, 60+ Countries) and therapeutic wording; every
  // guide is scrubbed ON READ so old saved guides can never feed a breach into a prompt.
  const GUIDE_DROP = /dermatologically|clinically|loved by millions|trusted in \d+\+? countries|\b\d+ ?billion|dentist (approved|recommended)/i;
  const GUIDE_FIX = [[/german treatment/gi,'German way'],[/long-lasting protection/gi,'lasting fresh feel'],[/\bprotection\b/gi,'fresh feel'],[/anti-plaque/gi,'deep-clean'],[/removes plaque/gi,'a deep-clean feel']];
  function sanitizeGuide(g){
    for(const k of ['usps','headlines','subheadlines','benefits','trust']){
      if(!Array.isArray(g[k])) continue;
      g[k] = g[k].filter(x=>!GUIDE_DROP.test(x&&x.text||''));
      for(const x of g[k]) for(const [re,rep] of GUIDE_FIX) x.text = String(x.text||'').replace(re,rep);
    }
    return g;
  }
  function getGuide(sku){
    const d = DEFAULT_GUIDES[sku] || {};
    const toObj = a => (a||[]).map(t=>({text:t,on:true}));
    try { const saved = global.localStorage && localStorage.getItem('de_guide_'+sku); if(saved){ const g=JSON.parse(saved); if(!g.formula || !g.formula.length){ g.formula = toObj(d.formula); } return sanitizeGuide(g); } } catch(e){}
    return sanitizeGuide({ colours:d.colours||'', backgrounds:toObj(d.backgrounds), formula:toObj(d.formula), usps:toObj(d.usps), headlines:toObj(d.headlines), subheadlines:toObj(d.subheadlines), benefits:toObj(d.benefits), trust:toObj(d.trust) });
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
    if(brain && brain.id==='before-after' && sku!=='white-repair'){
      p += `BEFORE/AFTER FOCUS (mandatory): ${s.name} is NOT a whitening product — the before→after transformation must show ${s.name}'s OWN benefit improving (${s.say}). Do NOT show whiter teeth, any tooth-shade change, a "Month 1 vs Month 6" teeth comparison, stains, or the words "whitening" or "stains". For fresh breath, use a freshness cue (a low→high freshness meter, or dull → fresh minty burst); for gum care, a dull→firm cared-for gum cue; for sensitivity, a discomfort→comfort cue. `;
    }
    if(isUGC){
      p += `UGC PHOTO — a real, believable everyday PERSON (matching the Art-director note) is the CLEAR SUBJECT, authentically holding or using the LACALUT product in a genuine phone-camera photo: natural imperfect lighting, a real home or bathroom setting, candid unposed feel. The PERSON MUST be clearly visible and prominent — NEVER a product-only, hand-only or studio-hero shot. The product is held or placed naturally in the scene (not a big floating hero), its real packaging accurate and the CAP ALWAYS WHITE (never red, navy or coloured). CRITICAL SCALE: the tube is its TRUE real-world size — a normal ~75ml toothpaste tube (about the length of a hand), correctly proportioned to the person's hand, fingers and face; NEVER enlarged, oversized or giant. Any on-image caption stays in a casual, native, lowercase style (like a viral social-post caption), NOT a formal studio ad headline — BUT it is rendered LARGE, bold and instantly readable on a mobile screen, never tiny. `;
      const ugcLens = ["a front-camera selfie held at arm's length","a candid over-the-shoulder phone shot","a relaxed waist-up handheld shot","a casual straight-on shelf/vanity phone shot (no mirror anywhere in frame)"][Math.floor(Math.random()*4)];
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
    p += `PACKAGING FINE-PRINT: keep any small printed body or claims text on the product packaging in the product\u0027s ORIGINAL GERMAN and render it small and softly out of focus so it is NOT legible; never reproduce the pack fine print as legible English health, disease or treatment claims (e.g. never show readable words like bleeding, gingivitis, periodontitis in English). `; p += `TEXT CONTRAST (mandatory — the single most important design rule): all overlay text must be high-contrast and instantly legible. On any red, dark or saturated background the text MUST be white/light; on any white, light, pale or pastel background the text MUST be navy/dark. NEVER white or light text on a light/pale background (e.g. no white on light blue), and NEVER navy/dark text on a red or dark background. `; if(!isUGC){ p += `TITLE CASE (mandatory): the MAIN HEADLINE and the SUB-HEADLINE must BOTH be written in Title Case — capitalise the first letter of every significant word (e.g. "German Pharmacy Whitening That Lifts Everyday Stains"). Never sentence case, never all-lowercase for the sub-headline. `; p += `HEADLINE vs SUB-HEADLINE COLOUR (mandatory): render the main headline and the sub-headline in two DIFFERENT but complementary on-brand colours — never both in the same flat colour. e.g. a white headline with a brand-red #CF102D or light-accent sub-headline, or a navy #004A88 headline with a brand-red sub. Both must stay high-contrast against the background; the slight colour shift separates the two lines and makes the copy pop and feel more clickable. `; p += `BADGE & ICON SYSTEM (mandatory): give benefit and trust badges a small relevant icon (e.g. sparkle for stain-lift, a tooth, a tooth for a clean feel, a droplet for freshness, a medal or ribbon for German heritage / "since 1925") — icons crisp and consistent line-weight, never plain unstyled text labels. ICON COLOUR (hard rule): every badge/feature icon MUST be rendered in a DIFFERENT colour from its own label text — e.g. a brand-red #CF102D icon beside navy #004A88 text, never icon and text the same flat colour — so the icon reads as a distinct visual element and never blends into the words. SHAPE CONSISTENCY (hard rule): within THIS single image EVERY benefit/feature badge MUST be the exact SAME shape as the others — all identical rounded pills, OR all identical rectangles, OR all identical squares — NEVER mix different badge shapes in one image (mixed shapes look unprofessional and cheap). All trust badges likewise share one uniform shape. Pick ONE badge shape for the set; the shape MAY differ between separate images for variety, but must be uniform inside any one image. `; p += `BADGE CONTRAST (non-negotiable — the #1 design rule): light or white badge text ALWAYS sits on a DARK, deep or saturated fill (navy #004A88, brand red #CF102D, deep teal or charcoal) — NEVER on a light, pale or pastel fill (e.g. never white text on light blue). Dark text (navy or charcoal) sits ONLY on a white or light fill. When unsure, darken the badge background until the text reads instantly. `; } p += `HEADLINE LEGIBILITY (mandatory): wherever the headline sits over a busy, bright or light area, add a subtle darkened gradient, scrim or soft shadow directly behind the headline text so it stays high-contrast and instantly readable — never let a bright background or light flare wash out the headline. `; p += `PLAIN LANGUAGE: keep copy simple and everyday (this is a Facebook ad, not a science paper) - avoid medical or scientific jargon and never print obscure or scary-sounding ingredient names such as "aluminium lactate"; reference any formula plainly, e.g. "a special German gum-care formula". `; p += `${m.ar} aspect ratio, high-end premium finish, crisp legible typography, no spelling errors on any text.`;
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
    p += `AD, NOT A POST (hard rule): this is a PAID Meta direct-response ad for cold traffic — it must stop the scroll AND sell: customer-first hook, one clear cosmetic feel-benefit payoff, and a clear CTA pill; NEVER an organic-social layout and NEVER 'save/share/follow/comment' language. CTA PILL (mandatory): exactly ONE clear button-style CTA pill in a brand colour (e.g. 'Shop Now') always appears — never omit it, never more than one. `;
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
    p += `PACKAGING FINE-PRINT: keep any small printed body or claims text on the product packaging in the product\u0027s ORIGINAL GERMAN and render it small and softly out of focus so it is NOT legible; never reproduce the pack fine print as legible English health, disease or treatment claims (e.g. never show readable words like bleeding, gingivitis, periodontitis in English). `; p += `TEXT CONTRAST (mandatory — the single most important design rule): all overlay text must be high-contrast and instantly legible. On any red, dark or saturated background the text MUST be white/light; on any white, light, pale or pastel background the text MUST be navy/dark. NEVER white or light text on a light/pale background (e.g. no white on light blue), and NEVER navy/dark text on a red or dark background. `; p += `TITLE CASE (mandatory): the MAIN HEADLINE and the SUB-HEADLINE must BOTH be written in Title Case — capitalise the first letter of every significant word (e.g. "German Pharmacy Whitening That Lifts Everyday Stains"). Never sentence case, never all-lowercase for the sub-headline. `; p += `HEADLINE vs SUB-HEADLINE COLOUR (mandatory): render the main headline and the sub-headline in two DIFFERENT but complementary on-brand colours — never both in the same flat colour. e.g. a white headline with a brand-red #CF102D or light-accent sub-headline, or a navy #004A88 headline with a brand-red sub. Both must stay high-contrast against the background; the slight colour shift separates the two lines and makes the copy pop and feel more clickable. `; p += `BADGE & ICON SYSTEM (mandatory): give benefit and trust badges a small relevant icon (e.g. sparkle for stain-lift, a tooth, a shield for protection, a globe for "trusted in X countries", a medal or ribbon for heritage / "since 1925") — icons crisp and consistent line-weight, never plain unstyled text labels. ICON COLOUR (hard rule): every badge/feature icon MUST be rendered in a DIFFERENT colour from its own label text — e.g. a brand-red #CF102D icon beside navy #004A88 text, never icon and text the same flat colour — so the icon reads as a distinct visual element and never blends into the words. SHAPE CONSISTENCY (hard rule): within THIS single image EVERY benefit/feature badge MUST be the exact SAME shape as the others — all identical rounded pills, OR all identical rectangles, OR all identical squares — NEVER mix different badge shapes in one image (mixed shapes look unprofessional and cheap). All trust badges likewise share one uniform shape. Pick ONE badge shape for the set; the shape MAY differ between separate images for variety, but must be uniform inside any one image. `; p += `BADGE CONTRAST (non-negotiable — the #1 design rule): light or white badge text ALWAYS sits on a DARK, deep or saturated fill (navy #004A88, brand red #CF102D, deep teal or charcoal) — NEVER on a light, pale or pastel fill (e.g. never white text on light blue). Dark text (navy or charcoal) sits ONLY on a white or light fill. When unsure, darken the badge background until the text reads instantly. `; p += `HEADLINE LEGIBILITY (mandatory): wherever the headline sits over a busy, bright or light area, add a subtle darkened gradient, scrim or soft shadow directly behind the headline text so it stays high-contrast and instantly readable — never let a bright background or light flare wash out the headline. `; p += `PLAIN LANGUAGE: keep copy simple and everyday (this is a Facebook ad, not a science paper) - avoid medical or scientific jargon and never print obscure or scary-sounding ingredient names such as "aluminium lactate"; reference any formula plainly, e.g. "a special German gum-care formula". `; p += `${m.ar} aspect ratio, high-end premium finish, crisp legible typography, no spelling errors on any text.`;
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
- Keep icon'd badges (globe = countries, medal/ribbon = heritage, shield = protection, sparkle = stain-lift). Every badge in the image MUST be the SAME shape as the others — uniform pills OR uniform rectangles OR uniform squares, NEVER a mix of shapes in one image. Every badge/feature icon MUST be a DIFFERENT colour from its own label text (e.g. red icon + navy text) — never the same flat colour, so the icon stays a distinct element. Never flatten to plain unstyled text.
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

  /* ═══════════════════════════════════════════════════════════════════
     VIDEO MODULE — animate a static (or the SKU packshot) into a 5–8s
     marketing clip. IMAGE-TO-VIDEO. Default engine: Veo 3 Fast on the
     SAME Gemini key the image engine already uses. Swap to fal.ai
     (Seedance / Kling) by changing VIDEO_MODEL — every brand + compliance
     lock from buildPrompt() is mirrored into buildVideoPrompt() below.
     ═══════════════════════════════════════════════════════════════════ */
  // Each model earns its place with ONE job the others can't do (no overlap):
  //  • VEO3 (full) — THE engine (Quan 23/09: best quality no matter the cost; Fast retired from the UI, entry kept only so old cards keep their label)
  //  • FAL_SEEDANCE — CHEAPEST: throwaway tests + volume B-roll
  //  • FAL_KLING — best real physical MOTION: hyper-motion, splash, levitation
  //  • VEO3 — TOP hero quality for the final cinematic ad
  const VIDEO_MODELS = {
    VEO3_FAST:    { route:'gemini', id:'veo-3.1-fast-generate-preview', label:'Veo 3.1 Fast', usdPerSec:0.15, audio:true,  aspects:['16:9','9:16'],  job:'RETIRED 23/09 (kept only so old cards keep their label) — never offered in the UI', retired:true },
    FAL_SEEDANCE: { route:'fal',    id:'fal-ai/bytedance/seedance/v1/lite/image-to-video', label:'Seedance 1.0 (fal.ai)', usdPerSec:0.06, audio:false, aspects:['1:1','16:9','9:16'], job:'Cheapest — quick tests + volume B-roll' },
    FAL_KLING:    { route:'fal',    id:'fal-ai/kling-video/v2/master/image-to-video',      label:'Kling 2.x (fal.ai)',   usdPerSec:0.18, audio:false, aspects:['1:1','16:9','9:16'], job:'Best physical motion — hyper-motion, splash, levitation' },
    VEO3:         { route:'gemini', id:'veo-3.1-generate-preview',  label:'Veo 3.1',    usdPerSec:0.40, audio:true,  aspects:['16:9','9:16'],       job:'Top hero quality — the final cinematic ad' }
  };
  // ── SINGLE SWAPPABLE CONSTANT — change this one value to switch engines ──
  let VIDEO_MODEL = 'VEO3';   // Quan 23/09: BEST engine always — Fast retired, quality over cost
  const VIDEO_ASPECTS   = { '1:1':'Feed 1:1 (square)', '9:16':'Reels / Stories 9:16', '16:9':'YouTube 16:9' };
  const VIDEO_DURATIONS = [6, 8];   // seconds — Veo 3 Fast supports 4/6/8; default 8

  /* ═══ VIDEO STYLE PRESETS — the "Higgsfield Motion" variety pack ═══
     Each preset = a distinct look/feel + the BEST engine for it + a motion
     brief that overrides the generic MOTION DIRECTION line in buildVideoPrompt.
     'model' is the recommended engine key (user can still override in the UI). */
  const VIDEO_STYLES = {
    lofi_native:    { label:'📱 Lo-Fi Native (proven default)', model:'VEO3', emoji:'📱',
      desc:'Handheld phone-shot feel — 42% of top-spend ads look like this.',
      motion:'MOTION & LOOK: authentic lo-fi smartphone footage — natural imperfect handheld movement, real-world lighting (bathroom, kitchen, daylight), native social-feed feel, NEVER glossy studio polish. A visual change or cut-feel every 2–3 seconds; a pattern interrupt (snap zoom, angle change) at least every 4 seconds. Looks like a real person filmed it, scroll-native, not an ad.' },
    polished_hybrid:{ label:'💎 Polished Hybrid', model:'VEO3', emoji:'💎',
      desc:'Clean studio product beats + lo-fi inserts — the Hismile blend.',
      motion:'MOTION & LOOK: hybrid pacing — crisp clean studio product beats (macro texture, controlled light, premium grade) intercut with quick lo-fi real-world insert moments. A visual change every 2–3 seconds; never a static hold longer than 4 seconds. Polished where the product shines, human where trust is built.' },
    product_motion: { label:'✨ Product Motion (Premium)', model:'VEO3', emoji:'✨',
      desc:'Smooth luxe camera on the hero — the safe premium default.',
      motion:'MOTION: a slow, luxurious cinematic camera move on the product hero — a gentle push-in or slow lateral glide (NEVER a circling orbit; the front label faces camera the whole time), soft studio light shimmer sliding across the pack, a delicate depth-of-field rack focus, subtle floating dust/particles. Elegant, controlled, high-end — never fast or chaotic.' },
    hyper_motion:   { label:'⚡ Hyper Motion', model:'FAL_KLING', emoji:'⚡',
      desc:'Fast, punchy, energetic — Higgsfield-style hype cut.',
      motion:'MOTION: high-energy hyper-motion — fast dynamic camera whips and speed-ramps through the scene, snap-zooms that stop short of the pack, kinetic energy and punchy accents in the environment. The pack itself stays STATIC, front-on, sharp and un-warped throughout — the energy comes from the camera and the world, never from the pack moving or flying.' },
    slow_reveal:    { label:'🎬 Slow Cinematic Reveal', model:'VEO3', emoji:'🎬',
      desc:'Elegant slow build — light blooms, product emerges.',
      motion:'MOTION: a slow cinematic reveal — the product emerges from soft shadow or light bloom, a gentle dolly-in with drifting light rays and a shallow depth of field pulling focus onto the pack. Calm, premium, aspirational pacing.' },
    liquid_splash:  { label:'💧 Liquid / Splash', model:'FAL_KLING', emoji:'💧',
      desc:'Water, gel and ingredient splash around the pack.',
      motion:'MOTION: dynamic liquid motion with a VISIBLE SOURCE — a clean pour arcs down from above or a tap stream runs beside the pack, slow-motion droplets suspended mid-air catching the light, a fresh clean burst landing NEAR the pack (never onto it). Every liquid has an obvious real source — no sourceless scenic water. The pack stays dry, crisp and central.' },
    float_levitate: { label:'🪐 Float / Levitation', model:'FAL_KLING', emoji:'🪐',
      desc:'Surreal floating elements around a grounded pack.',
      motion:'MOTION: surreal weightlessness AROUND a grounded hero — the pack stands static and front-on while formula elements and soft geometric accents float and drift dreamily through the air NEAR it (never wrapping or enveloping it, never lifting the pack), gentle parallax on the background. Premium and hypnotic — the world levitates, the product never does.' },
    kinetic_type:   { label:'🔤 Kinetic Typography', model:'VEO3', emoji:'🔤',
      desc:'Bold animated headline text, graphic ad feel.',
      motion:'MOTION: bold kinetic typography — the on-image English headline and sub animate in with punchy, graphic-design timing (slide, scale, snap) synced to a subtle product move; clean colour-blocked motion-graphics feel. Text stays perfectly legible, correctly spelled and never garbled.' },
    retro_nostalgia:{ label:'📼 Retro / Nostalgia', model:'FAL_SEEDANCE', emoji:'📼',
      desc:'90s / VHS throwback grade and motion.',
      motion:'MOTION: a retro nostalgic feel — soft VHS/film grain, gentle light leaks and a warm vintage colour grade, slow analogue camera drift on the product. Stylised and characterful, but the pack and any text stay clean and readable.' },
    cinematic_ad:   { label:'🎥 Cinematic Ad', model:'VEO3', emoji:'🎥',
      desc:'Dramatic story-grade hero moment (top quality).',
      motion:'MOTION: a dramatic cinematic ad moment — moody directional lighting, a smooth crafted camera move (crane, slow track or dolly), rich colour grade and a strong hero beat on the product. Film-grade, premium and emotive; motion smooth and deliberate.' }
  };
  function videoStyle(id){ return VIDEO_STYLES[id] || null; }

  function videoModel(key){ return VIDEO_MODELS[key||VIDEO_MODEL] || VIDEO_MODELS.VEO3; }
  function getVideoModel(){ return VIDEO_MODEL; }
  function setVideoModel(key){ if(VIDEO_MODELS[key]) VIDEO_MODEL = key; return VIDEO_MODEL; }

  // Credit / spend estimate — shown BEFORE any API call (hard spend gate).
  function videoCostEstimate(opts){
    const m = videoModel(opts && opts.model);
    const seconds = Math.max(1, (opts && opts.seconds) || 8);
    const usd = +(m.usdPerSec * seconds).toFixed(2);
    return { model:m.label, modelKey:(opts&&opts.model)||VIDEO_MODEL, seconds, usdPerSec:m.usdPerSec, usd, audio:m.audio };
  }

  // QC checklist — the auto-flag list the UI ticks off after a clip returns.
  // Items 6–11 = the NHB "Video Ads That Convert" six-point pass/fail (pacing beats production).
  function videoQCChecklist(){
    return [
      'Pack stays crisp & sharp — real German tube, no blur, no English therapeutic text',
      'No mirror / reflection bug (inverted readable text)',
      'No banned ingredient or ion label on screen (only fluoride / hydroxyapatite)',
      'On-screen text is not garbled',
      'Product form stays consistent with the SKU',
      'Hook survives the first frame — no logo open, no slow build',
      'Attention resets every 4–8 seconds (visual + audio + curiosity together)',
      'Visual, audio and written hooks all present in the opening moment',
      'An open loop is set early and resolves at the proof beat',
      'Ending does a job — clear direct CTA, not just a stop',
      'CTA points to the right destination'
    ];
  }

  function blobToDataUrl(blob){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>rej(fr.error); fr.readAsDataURL(blob); }); }
  function base64ToBlob(b64,mime){ const bin=atob(b64); const u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i); return new Blob([u8],{type:mime||'video/mp4'}); }

  /* ═══ VIDEO PROMPT BUILD (DOM-free) — mirrors buildPrompt's brand + compliance locks ═══ */
  function buildVideoPrompt(opts){
    const sku = opts.sku, brain = opts.brain;
    const brief = (opts.brief||'').trim();
    const advNeg = opts.advNeg !== false;
    const seconds = opts.seconds || 8;
    const ar = opts.aspectRatio || '9:16';
    const s = SKUS[sku] || SKUS['aktiv'];
    const g = getGuide(sku);
    const bans = [...GLOBAL_BAN, ...s.ban];
    const fx = (g.formula||[]).filter(x=>x.on!==false).map(x=>x.text);

    let p = `Animate the SUPPLIED still image into a ${seconds}-second premium social-media MARKETING VIDEO for LACALUT ${s.name} (German pharmacy oral-care brand). Tone: ${s.voice}. `;
    const packless = opts.hasPack===false;
    p += packless
      ? `IMAGE-TO-VIDEO — the supplied frame is the hero: keep its exact composition, setting, person and any on-image text as the anchor. Add tasteful MOTION only; do NOT redraw, restyle or reinvent anything already in the frame. `
      : `IMAGE-TO-VIDEO — the supplied frame is the hero: keep its exact composition, product, packaging, colours, logo and any on-image text as the anchor. Add tasteful MOTION only; do NOT redraw, restyle, relabel or reinvent anything already in the frame. `;
    const st = videoStyle(opts.style);
    p += (st ? st.motion : 'MOTION: a subtle premium camera move (slow push-in / gentle parallax / smooth orbit or dolly), soft light shimmer, delicate floating formula particles or a slow water/ingredient drift, and a gentle product hero reveal. Keep motion smooth and controlled — no fast whip pans, no chaotic morphing, no warping of the product or text.') + ' ';
    p += `STRICT brand colours — ${g.colours||s.palette}. `;
    if(brain) p += `CREATIVE STRATEGY — "${brain.name}". `;
    if(brief) p += `Art-director motion note (priority): ${brief}. `;
    if(packless) p += `NO PRODUCT IN THIS SCENE (hard rule): this scene contains NO toothpaste tube, box, bottle or branded product — and NONE may appear, be revealed, held up or materialise at any point; the product lives in OTHER scenes of this ad only. `;
    else p += `PRODUCT FIDELITY (mandatory, every frame): the real GERMAN packaging stays razor-sharp and identical throughout — exact tube/box shape, label layout, logo and printed wording; the CAP is ALWAYS WHITE. NEVER blur, melt, warp, duplicate or re-letter the pack; NEVER fabricate an English tube or English health text; NEVER flip the pack so any text becomes a mirrored/reversed reflection. `;
    p += `SKU ANGLE LOCK: this clip is EXCLUSIVELY for LACALUT ${s.name}; every visual and any on-screen word is about THIS product's own benefit only — ${s.say}. Never borrow another LACALUT product's angle (no whitening unless White & Repair, no gum-firmness unless a gum product, no cold-twinge comfort unless Sensitive, no fresh-breath unless Flora). `;
    if(fx.length && !packless) p += `SIGNATURE FORMULA ELEMENTS (only if formula/ingredient props move in-frame): use ONLY ${fx.join(', ')} for ${s.name}; never another formula's elements (no herbs unless Aktiv Herbal, no silver zinc granules unless Flora, no blue soothing crystals unless Sensitive, no diamond/pearl minerals unless White & Repair). `;
    p += `COSMETIC-ONLY COMPLIANCE (non-negotiable): LACALUT is a cosmetic, not a medicine. NO therapeutic or disease claims, NO "treat", "cure" or "clinically proven", NO statistics or percentages on screen. The ONLY active ingredients that may ever be named are "fluoride" and "hydroxyapatite" — NEVER strontium, potassium, aluminium lactate, bisabolol, chlorhexidine, zinc, or any ion label (e.g. Sr2+, K+). `;
    if(advNeg) p += `NEVER show or write any of these words/claims anywhere in the video: ${bans.join(', ')}. `;
    p += `Any on-screen text is ENGLISH (Australian English) only, minimal, correctly spelled and never garbled; keep the product's own printed German packaging text unchanged and softly out of focus. German heritage descriptors (Crème Paste / Mund-Elixier) are allowed, but "toothpaste" / "mouthwash" stay the plain English words. `;
    p += `${ar} aspect ratio, ${seconds} seconds, high-end premium finish, smooth natural motion, no flicker, no artefacts.`;
    return p;
  }

  /* ═══ VEO 3 CALL (Gemini predictLongRunning + poll) — image-to-video ═══ */
  async function callVeoVideo(opts){
    const apiKey = opts.apiKey || (global.localStorage && localStorage.getItem('lc_gemini_key')) || '';
    if(!apiKey) throw new Error('No Gemini API key');
    const m = videoModel(opts.model);
    const seconds = opts.seconds || 8;
    const ar = opts.aspectRatio || '9:16';
    const onProg = opts.onProgress || function(){};
    const imgPart = dataUrlToInlinePart(opts.imgDataUrl);
    // no image = text-to-video (used by the safety-retry ladder's final rung)
    const instance = imgPart
      ? { prompt: opts.prompt, image:{ bytesBase64Encoded: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType } }
      : { prompt: opts.prompt };
    const parameters = { aspectRatio: ar, durationSeconds: seconds, sampleCount:1 };
    if(imgPart) parameters.personGeneration='allow_adult';   // t2v rejects allow_adult — only valid for image-to-video
    const base = 'https://generativelanguage.googleapis.com/v1beta/';
    const start = await fetch(base+'models/'+m.id+':predictLongRunning?key='+apiKey,
      { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ instances:[instance], parameters }) });
    const sd = await start.json();
    if(!start.ok) throw new Error(sd.error?.message || ('HTTP '+start.status));
    const opName = sd.name; if(!opName) throw new Error('Veo did not return an operation id');
    let done=null, tries=0;
    while(tries < 60){
      await new Promise(r=>setTimeout(r, 10000)); tries++;
      onProg('⏳ rendering video… '+(tries*10)+'s');
      const pr = await fetch(base+opName+'?key='+apiKey);
      const pj = await pr.json();
      if(!pr.ok) throw new Error(pj.error?.message || ('poll HTTP '+pr.status));
      if(pj.done){ done=pj; break; }
    }
    if(!done) throw new Error('Video timed out (still rendering after 10 min).');
    if(done.error) throw new Error(done.error.message || 'Video generation failed');
    const resp = done.response || {};
    const samples = resp.generateVideoResponse?.generatedSamples
                 || resp.generateVideoResponse?.generatedVideos
                 || resp.generatedVideos || [];
    const first = samples[0] || {};
    const inline = first.video?.bytesBase64Encoded || first.bytesBase64Encoded;
    if(inline) return opts.asBlob ? base64ToBlob(inline,'video/mp4') : 'data:video/mp4;base64,'+inline;
    const uri = first.video?.uri || first.video?.videoUri || first.uri;
    if(!uri) throw new Error('No video returned by Veo');
    const dl = await fetch(uri + (uri.indexOf('?')>=0?'&':'?') + 'key=' + apiKey);
    if(!dl.ok) throw new Error('Could not download the rendered video (HTTP '+dl.status+')');
    const blob = await dl.blob();
    return opts.asBlob ? blob : await blobToDataUrl(blob);
  }

  /* ═══ FAL.AI CALL (Seedance / Kling) — swappable alt engine ═══ */
  async function callFalVideo(opts){
    const key = opts.falKey || (global.localStorage && localStorage.getItem('lc_fal_key')) || '';
    if(!key) throw new Error('No fal.ai API key — add one to use Seedance / Kling');
    const m = videoModel(opts.model);
    const onProg = opts.onProgress || function(){};
    const body = { prompt: opts.prompt, image_url: opts.imgDataUrl, aspect_ratio: opts.aspectRatio||'9:16', duration: String(opts.seconds||8) };
    const submit = await fetch('https://queue.fal.run/'+m.id,
      { method:'POST', headers:{'Authorization':'Key '+key,'Content-Type':'application/json'}, body:JSON.stringify(body) });
    const sj = await submit.json();
    if(!submit.ok) throw new Error(sj.detail||sj.error||('fal HTTP '+submit.status));
    const statusUrl = sj.status_url, respUrl = sj.response_url;
    let tries=0, out=null;
    while(tries < 60){
      await new Promise(r=>setTimeout(r, 8000)); tries++;
      onProg('⏳ rendering video… '+(tries*8)+'s');
      const st = await fetch(statusUrl, { headers:{'Authorization':'Key '+key} });
      const stj = await st.json();
      if(stj.status==='COMPLETED'){ const rr = await fetch(respUrl, { headers:{'Authorization':'Key '+key} }); out = await rr.json(); break; }
      if(stj.status==='FAILED') throw new Error('fal generation failed');
    }
    if(!out) throw new Error('Video timed out.');
    const url = out.video?.url || out.video_url || out.videos?.[0]?.url;
    if(!url) throw new Error('No video URL from fal');
    const blob = await (await fetch(url)).blob();
    return opts.asBlob ? blob : await blobToDataUrl(blob);
  }

  /* ═══ ONE-UP LOOP (video motion brief) ═══ */
  async function oneUpVideoPrompt(opts){
    const basePrompt = (opts.basePrompt||'').trim();
    const apiKey = opts.apiKey || (global.localStorage && localStorage.getItem('lc_gemini_key')) || '';
    const model = opts.textModel || 'gemini-2.5-flash';
    const rounds = opts.rounds || 3;
    if(!apiKey || !basePrompt) return basePrompt;
    const meta =
`You are the best performance-video ART DIRECTOR alive for LACALUT, a premium 100-year German pharmacy oral-care brand. Turn this image-to-video motion brief into a THUMB-STOPPING ${opts.seconds||8}s social clip brief. Run an internal one-up loop (at least ${rounds} rounds), each round more cinematic, premium and scroll-stopping than the last, then output ONLY the pinnacle.

HARD RULES you must keep from the base brief, never trade away for drama:
- IMAGE-TO-VIDEO: the supplied still is the anchor — keep its exact product, packaging, colours, logo and on-image text; add MOTION only, never redraw or relabel. The pack stays razor-sharp every frame, real GERMAN packaging, white cap; never blur/warp/mirror the pack or its text, never fabricate an English tube or English health text.
- Motion stays smooth and controlled — no chaotic morphing, no warping product or type.
- PACK MOTION LOCK: the pack NEVER flips, spins, turns over or rotates away from camera — the printed front label faces camera the entire clip (subtle tilt max); keep the pack's real tall slim proportions; move the camera or environment for dynamism, never the pack itself.
- CHARACTER LOCK: if the base brief describes a person, keep EXACTLY that person — never swap, restyle or introduce a different actor.
- WORLD LOCK: if the base brief names the ad's single location/set, keep EXACTLY that location — same surfaces, lighting mood and palette; add drama through camera and action, never by moving the scene somewhere else.
- STYLE LOCK: keep the base brief's VISUAL LOOK exactly — a lo-fi handheld phone-shot look STAYS lo-fi (your "one-up" makes it a better lo-fi shot, more authentic and scroll-native); never upgrade it to cinematic studio polish.
- AUDIO: quiet ambience and subtle sound effects only — NO music (one continuous soundtrack is added in post) and zero human vocal sounds of any kind (no speech, singing, whispering, humming, male or female voices, background chatter).
- MIRROR LOCK: no mirrored, reversed or doubled lettering anywhere, including reflections.
- COSMETIC-ONLY: no therapeutic/disease claims, no "treat/cure/clinically proven", no stats/percentages. Only "fluoride" and "hydroxyapatite" may be named — never strontium, potassium, aluminium lactate, bisabolol, chlorhexidine, zinc or any ion label.
- Keep the SKU angle lock and any banned-word constraints from the base brief.
- Any on-screen text: Australian English only, minimal, correctly spelled, never garbled.
- CONTENT LOCK: NEVER add any action, object, prop, person or shot the base brief does not contain — no brushing, no drinking, no new products, no cutaways, nothing materialising; one-up the CRAFT (light, timing, camera feel), never the content.
- Keep the exact aspect ratio and duration.

Return ONLY valid JSON: {"prompt":"<final pinnacle motion brief, fully self-contained>"}.

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
      const bans = (opts.bans && opts.bans.length) ? opts.bans.join(', ') : '';
      let tail = '';
      if(bans && !/never show or write|compliance/i.test(refined)) tail += ` NEVER show or write any of these words/claims: ${bans}.`;
      if(opts.aspectRatio && refined.indexOf(opts.aspectRatio)===-1) tail += ` ${opts.aspectRatio} aspect ratio, ${opts.seconds||8} seconds.`;
      return refined + tail;
    }catch(e){ return basePrompt; }
  }

  /* ═══ HIGH-LEVEL: one marketing clip from a card image (or packshot) ═══ */
  async function generateVideo(opts){
    // Model resolution order: explicit opts.model → the style's recommended model → global default.
    const st = videoStyle(opts.style);
    const modelKey = opts.model || (st && st.model) || VIDEO_MODEL;
    const m = videoModel(modelKey);
    let prompt = buildVideoPrompt({ sku:opts.sku, brain:opts.brain, brief:opts.brief, advNeg:opts.advNeg, seconds:opts.seconds, aspectRatio:opts.aspectRatio, style:opts.style });
    if(opts.oneUp){
      const bans = opts.advNeg!==false ? [...GLOBAL_BAN, ...((SKUS[opts.sku]||{}).ban||[])] : [];
      prompt = await oneUpVideoPrompt({ basePrompt:prompt, bans, aspectRatio:opts.aspectRatio, seconds:opts.seconds, apiKey:opts.apiKey });
    }
    const call = m.route==='fal' ? callFalVideo : callVeoVideo;
    const video = await call({ prompt, imgDataUrl:opts.imgDataUrl, model:modelKey, seconds:opts.seconds, aspectRatio:opts.aspectRatio, apiKey:opts.apiKey, falKey:opts.falKey, onProgress:opts.onProgress, asBlob:opts.asBlob });
    return { video, prompt, model:m.label, modelKey, style:opts.style||null, seconds:opts.seconds||8, aspectRatio:opts.aspectRatio||'9:16', cost:videoCostEstimate({model:modelKey,seconds:opts.seconds}), qc:videoQCChecklist() };
  }

  /* ═══════════════════════════════════════════════════════════════════
     STORYBOARD PIPELINE — 15–32s ads from scratch (Video Generator mode).
     Gemini text writes an N-scene script → user approves (compliance-
     gated, editable) → scenes render sequentially on Veo (native VO
     audio) → clips stitch client-side (ffmpeg injected by the UI).
     ═══════════════════════════════════════════════════════════════════ */
  /* Archetypes rebuilt 23/09/2026 from conversion research (Motion Creative Benchmarks
     2026 · Hismile teardown · TikTok Creative Codes · Meta lift studies). Ranked:
     1–3 are the volume engines, 4–6 proven diversifiers, 7 trust rotation. */
  const VIDEO_TYPES = {
    pas:       { label:'🎯 Problem→Solve',     style:'lofi_native',     narrative:'a PROBLEM-AGITATE-SOLVE cold-traffic ad (the proven DTC workhorse): open on the specific everyday pain so the viewer self-identifies (~60% of runtime on the problem, product appears only after), agitate the social/confidence cost (cosmetic framing only), then the product reveal with its mechanism in one plain sentence, a proof beat, and an offer/CTA close' },
    demo:      { label:'🔬 Demo / Anatomy',    style:'polished_hybrid', narrative:'a DEMO-MECHANISM ad (the #1 oral-care format — Hismile runs it at scale): open on an extreme product-in-action macro (tube squeeze, paste texture, foam, rinse swirl — never gross clinical imagery), SHOW what it does rather than say it, a mechanism beat with on-screen ingredient labels (fluoride / hydroxyapatite ONLY), the result state, then pack + CTA' },
    vs:        { label:'⚖️ Old Way vs New',    style:'polished_hybrid', narrative:'an OLD-WAY-vs-NEW-WAY comparison: side-by-side or split-screen framing of "ordinary toothpaste" (NEVER a named competitor brand) against this product, 3 rapid comparison beats (texture, ingredient, feel), a clear winner beat with benefit overlays, social-proof line + CTA' },
    transform: { label:'✨ Transformation',    style:'lofi_native',     narrative:'a TRANSFORMATION story: open on the confident after-state as a pattern interrupt, hard cut to the relatable before (coffee cup, hiding a smile), a routine montage showing the switch, the how (product + mechanism line), honest cosmetic result framing (never a guaranteed-result claim) + CTA' },
    mashup:    { label:'🔥 Social-Proof Mashup', style:'lofi_native',   narrative:'a fast-cut SOCIAL-PROOF MASHUP: rapid multi-setting montage feel ("everyone is switching"), a chain of 2–4 second micro-moments each landing ONE captioned benefit, different settings/angles per beat, a bold social-proof caption + product hero (NEVER an invented numeric rating or star score), then CTA — high energy, one idea per cut' },
    founder:   { label:'🇩🇪 Brand Story',      style:'cinematic_ad',    narrative:'a BRAND STORY trust ad told through narration over cinematic product and heritage imagery (NO people on camera): why this German pharmacy formula exists, ONE credible differentiator (German pharmacy heritage since 1925), premium product beats and formula macro moments, closing on the pack + CTA — sincere, no hype' }
  };

  // VO-safe sanitise: replace DISEASE NOUNS only. Never blind-replace verbs like
  // "treats" — spoken copy uses them innocently ("cold treats" = ice cream), and the
  // generation prompt already bans therapeutic verbs. Survivors get flagged instead.
  const VO_REPLACEMENTS = [
    [/periodontal disease/gi,'gum health issues'],[/periodontitis/gi,'gum health issues'],
    [/gingivitis/gi,'gum problems'],[/gum disease/gi,'gum problems'],[/halitosis/gi,'bad breath']
  ];
  function sanitizeCopyVO(t){ if(!t) return t; let out=String(t); for(const [re,rep] of VO_REPLACEMENTS) out=out.replace(re,rep);
    return out.replace(/([a-z])([A-Z])/g,'$1 $2'); }   // un-jam model joins like "AktivAvailable" → "Aktiv Available"
  // Sanitise every written line of a storyboard; flag any scene whose copy
  // still carries a banned disease/therapeutic term (UI blocks approval).
  function sanitizeStoryboard(sb){
    if(!sb) return sb;
    sb.hook = sanitizeCopyVO(sb.hook||''); sb.cta = sanitizeCopyVO(sb.cta||''); sb.world = sanitizeCopyVO(sb.world||'');
    (sb.scenes||[]).forEach(sc=>{
      sc.vo = sanitizeCopyVO(sc.vo||''); sc.text = sanitizeCopyVO(sc.text||'');
      sc.visual = sanitizeCopyVO(sc.visual||''); sc.motion = sc.motion||'';
      // "around the pack" is the mandated-reword phrase (never orbit the pack). The model keeps
      // writing it for benign spatial framing ("spaciousness around the pack") and self-repair
      // is unreliable on it — deterministically swap to "near the pack". A REAL orbit keeps its
      // "orbit/circles/spins" verb, so the lint's orbit branch still catches those.
      const nearSwap = t => t.replace(/\baround the (pack|tube|box|product|bottle)\b/gi, 'near the $1');
      sc.visual = nearSwap(sc.visual); sc.motion = nearSwap(sc.motion);
      sc.flagged = hasBannedTerm(sc.vo)||hasBannedTerm(sc.text)||hasBannedTerm(sc.visual);
    });
    sb.flagged = hasBannedTerm(sb.hook)||hasBannedTerm(sb.cta)||(sb.scenes||[]).some(s=>s.flagged);
    return sb;
  }

  /* ═══ STORYBOARD LINT — deterministic scan for the known render-killers,
     run BEFORE any money is spent. Violations loop back to Gemini for a
     targeted free rewrite; whatever survives is shown in the approval modal. ═══ */
  const SB_LINT_RULES = [
    { re:/\b(pearls?|beads?|capsules?|tablets?|pills?)\b/i, f:['visual','motion','text'], msg:'white round objects — Veo safety filter reads them as pills and silently returns nothing; use angular crystal shards / mineral streams instead' },
    { re:/(?<!no )(?<!without a )mirrors?\b(?![- ]free)|\bvanity\b/i, f:['visual','motion'], msg:'mirror shot — reflections mangle the pack and the person; restage without a mirror' },
    { re:/\b(fingers?|fingertips?)\b/i, f:['visual','motion'], msg:'finger action — a hand may only steady the pack; fingers never touch mouth or gums' },
    { re:/\btongue\b/i, f:['visual','motion'], msg:'tongue shot — uncanny; use a facial expression instead' },
    { re:/(close-?up|CU|ECU|macro|tight shot|extreme)[^.]{0,50}\b(face|mouth|lips|teeth|gums?)\b|\b(face|mouth|lips|teeth|gums?)\b[^.]{0,50}(close-?up|CU|ECU|macro|tight shot)/i, f:['visual','motion'], msg:'facial/mouth close-up — nothing tighter than a chest-up mid-shot on a person' },
    { re:/\b(uhm|umm|hmm|mmm|sighs?|gasps?|whispers?|hums|humming|says|speaks|sings|singing|chatter|murmur)\b/i, f:['visual','motion'], msg:'human vocal sound written into a scene — scenes are voice-free (narrator is added in post)' },
    { re:/\b(pack|tube|box)('s)? (side|back|rear)\b|\b(side|back|rear) (face |panel )?of the (pack|tube|box)\b|reveal\w*[^.]{0,30}\b(back|side|rear|german)\b[^.]{0,18}\b(text|label|wording|printed)\b/i, f:['visual','motion'], msg:'side/back pack text reveal — side text is German and stays unreadable; front label only' },
    { re:/\b(pack|tube|box|product)\b[^.]{0,60}\b(rotat\w+|spins?|spinning|flips?|flipping|turns? (over|around))\b|\b(rotat\w+|spins?|spinning|flips?|flipping)\b[^.]{0,60}\b(pack|tube|box|product)\b/i, f:['visual','motion'], msg:'pack rotation — the pack never rotates; move the camera instead' },
    { re:/\b(effective(ly)?|firms(?! (&|and) cares)|firming|firmness|strengthens?|supports?|protect(s|ion|ive|ed)?|prevents?|fights?|combats?|repairs?|treat(s|ments?)?|cures?|heals?|regenerat\w*|clinical(ly)?|proven|health(y|ier)?(?![- ]look))\b/i, f:['vo','text'], msg:'efficacy/therapeutic wording — cosmetic feel-language only ("feels firm", "cared-for")' },
    { re:/\b(powder|vial|syringe|dropper)\b/i, f:['visual','motion'], msg:'powder/vial imagery — the safety filter reads white powder + glassware as drugs; use settling crystal shards with no hands instead' },
    { re:/\b(orbit\w*|circl(?:es|ing)|360)\b[^.,;]{0,40}\b(pack|tube|box|product)\b|\b(pack|tube|box|product)\b[^.,;]{0,40}\b(orbit\w*|360|circl(?:es|ing))\b|\baround the (pack|tube|box|product)\b/i, f:['visual','motion'], msg:'camera or elements circling "around" the pack — the camera never orbits (exposes the German side/back text) and formula elements move NEAR the pack, never around/wrapping it; reword to "near the pack" with a static front-on camera' },
    { re:/\b(zoom|push)[^.]{0,25}\b(into|onto|toward)\b[^.]{0,20}\b(face|her face|his face|eyes|mouth|gaze|expression)\b/i, f:['visual','motion'], msg:'camera pushing into the face — nothing tighter than a chest-up framing on a person' },
    { re:/fade to black/i, f:['visual','motion'], msg:'fade-to-black — the final beat holds bright on the pack + CTA; never waste the close' },
    { re:/\bhands?\b(?!-drawn|-craft|made)[^.,;]{0,45}\b(mouth|lips|chin|jaw\w*|cheeks?|gums?|face|temple)\b|\b(mouth|lips|chin|jaw\w*|cheeks?|gums?|face|temple)\b[^.,;]{0,45}\bhands?\b(?!-drawn|-craft|made)/i, f:['visual','motion'], msg:'hand touching the mouth/face/jaw — hand-to-face contact renders badly; convey the feeling with expression only, hands may only steady the pack' },
    { re:/\b(snap zoom|zoom(s|ing)?|push(es|ing)?)\b[^.]{0,70}\b(label|pack text|wording|logo)\b/i, f:['visual','motion'], msg:'camera zooming onto the label — mid-motion text zooms warp the lettering; keep camera moves on the pack slow and gentle, the still guarantees label fidelity' },
    { re:/\b(snap zoom|zoom(s|ing)?|push(es|ing)?)\b[^.]{0,40}\b(face|eyes|mouth|lips|teeth)\b/i, f:['visual','motion'], msg:'camera zooming onto the face/eyes — nothing tighter than a chest-up framing on a person' },
    { re:/\b(gel|glow|mist|aura|energy|effect|particles?)\b[^.]{0,45}\b(face|skin|cheeks?)\b|\b(face|skin)\b[^.]{0,45}\b(gel|glow|mist|aura|energy|effect)\b/i, f:['visual','motion'], msg:'visual effect overlaying a person\'s face/skin — renders as smeared or melted skin; keep effects away from people' },
    { re:/\b(aura|energy|halo|glow(s|ing)?|shimmer\w*)\b[^.,;]{0,40}\b(pack|tube|box|product|paste)\b|\b(pack|tube|box|product)\b[^.,;]{0,40}\b(aura|energy|halo)\b|\benvelop\w+/i, f:['visual','motion'], msg:'energy/aura/glow enveloping the pack — the banned halo effect; crystals may move NEAR the pack but never wrap or envelop it' },
    { re:/\b(pack|tube|box|product)\b[^.,;]{0,40}(?<!not )(?<!never )(?<!n't )(?<!no longer )\b(glides?|gliding|slides?|sliding|floats?|floating|drifts?|transitions?|moves? (in|into|across)|bursts? (in|into)|pops? (in|into)|flies|flying)\b/i, f:['visual','motion'], msg:'the pack moving itself (glide/slide/float/fly-in) — the pack is ALWAYS static and already in place; the camera or environment moves, never the pack' },
    { re:/\b(waterfall|cascad\w+)\b|\b(water|liquid|stream|droplets?|drips?)\b[^.]{0,55}\b(wall|rock|stone|panel|backdrop|shelf|shelves)\b|\b(wall|rock|stone|panel)\b[^.]{0,40}\b(water|stream|drips?|trickl\w+)\b/i, f:['visual','motion'], msg:'sourceless/decorative water — water may ONLY appear from a running tap or in a clear drinking glass; scenic water (down walls/rocks, hidden basins) renders fake and auto-tanks QC' },
    { re:/\b(music(al)?|melody|jingle|soundtrack|flourish|orchestral|crescendo|score swells?)\b/i, f:['visual','motion'], msg:'music written into a scene — scenes render MUSIC-FREE (one bed is added at stitch); diegetic SFX (click, tap running) are fine, musical sounds are not' },
    { re:/\b(for|gives?|provides?|delivers?|leaves?)\b[^.]{0,30}\bfirm\w*\b[^.]{0,15}\bgums\b/i, f:['vo','text'], msg:'implies a physical firming RESULT — cosmetic feel-language only: say "gums that FEEL firm and cared-for"' },
    { re:/\b(close-?up|CU|ECU|macro|tight shot)\b[^.]{0,80}\b(hands?|fingers?|knuckles?)\b(?!\s*(towels?|soaps?|creams?|washes?|sanitiser|sanitizer|rails?|dryers?|bags?|cloths?|mirrors?))|\bhands?\b[^.]{0,20}\bfills? the frame\b/i, f:['visual','motion'], msg:'hand close-up — hands are the worst AI subject; hands appear only inside mid-shots, never as the subject of a frame' },
    { re:/\b(hands?|she|he|her|his)\b[^.]{0,20}\b(holds?|holding|lifts?|lifting|raises?|raising|presents?|presenting|picks? up|carr(y|ies|ying))\b(?!\s+steady)[^.]{0,25}\b(pack|tube|box|bottle|product)\b(?![^.]{0,25}\b(steady|in place|on the (counter|surface|slab|bench|table)|standing|down)\b)|\b(pack|tube|box|bottle)\b[^.]{0,20}\b(in|into) (her|his|one|a) hand\b/i, f:['visual','motion'], msg:'pack held/lifted in a hand — a hand-held pack drifts toward the lens and garbles the label (the 24/09 S1 fault); the pack always STANDS on a surface (a hand may press or steady it while it stays standing; the CAMERA may hold steady on it)' },
    { re:/\b(icon|badge|sticker|emoji|UI (element|chrome)|graphic (overlay|element)|highlight (circle|ring)|circle highlight|arrow overlay|progress bar)\b/i, f:['visual','motion'], msg:'graphic/UI element written into the scene — design-engine image vocabulary; video scenes contain only real physical objects and light, all graphics are added in post' },
    { re:/\b(grips?|gripping|tightens?|tightening|clench\w*|squeez\w*|white-?knuckl\w*)\b/i, f:['visual','motion'], msg:'gripping/clenching hand mechanics — tension is shown in the FACE (expression), never in hand choreography' },
    { re:/\b(alumini?um( |-)?lactate|strontium|potassium( |-)?(nitrate|chloride)?|chlorhexidine|bisabolol|zinc( |-)?(gluconate|lactate)?|lactate|sr2\+?|titanium dioxide)\b/i, f:['vo','text'], msg:'forbidden ingredient name — ONLY fluoride and hydroxyapatite may ever be named; say "a special German gum-care formula" instead' },
    // "gives gums firmness" = outcome claim; "give you gums that FEEL firm" = mandated feel-language — only fire when no FEEL sits between gums and firm (r3 false-positive fix)
    { re:/\b(gives?|giving|provides?|delivers?|restores?|brings?|helps? keeps?|keeps?|keeping|makes?|making|leaves?)\b[^.]{0,25}\bgums?\b(?![^.]{0,25}\bfeel\w*\b)[^.]{0,25}\b(firm\w*|strength|strong)\b/i, f:['vo','text'], msg:'physical firming-outcome claim — cosmetic feel-language only: "gums that FEEL firm"' },
    { re:/\b\d(\.\d)?\s*[/]\s*5\b|\bstar[- ]?rated\b|review stars?|rating overlay/i, f:['visual','motion','text','vo'], msg:'invented rating or review overlay — never fabricate social proof; real review data is added in post from Judge.me only' },
    { re:/\b(water|liquid|stream|droplets?|drips?|pours?|pouring)\b[^.]{0,55}\b(crystals?(?![- ]clear)|shards?|minerals?)\b|\b(crystals?(?![- ]clear)|shards?)\b[^.]{0,40}\b(water|stream|drips?)\b/i, f:['visual','motion'], msg:'water interacting with crystals/minerals — the rejected rock-water fault; water exists ONLY as tap-into-sink or a drinking glass' },
    { re:/\b(pack|tube|box|product|it)\b[^.]{0,25}\btowards? the (camera|lens|viewer)\b/i, f:['visual','motion'], msg:'pack presented/thrust toward the camera — moving the pack at the lens warps the label; the pack stays where it is, the camera does the work' },
    { re:/\b(push(es|ing)?[- ]?in|zoom(s|ing)?[- ]?in)\b (on|at) [^.]{0,18}\b(face|gaze|eyes|expression|smile)\b/i, f:['visual','motion'], msg:'camera pushing in on the face/gaze — nothing tighter than a chest-up framing on a person' },
    { re:/\b(pulsing|pulsating|throbbing|gritty|granular|lumpy|grainy|speckle\w*)\b/i, f:['visual','motion'], msg:'unappetising/organic texture word — paste and product always look smooth, creamy and appealing; nothing pulses or throbs' },
    { re:/\b(visual (representation|metaphor)|represent(s|ing)? (care|confidence|freshness|comfort|trust|health|strength|protection|vulnerability|enamel|gums?)|abstract (concept|arrangement|swirl))\b/i, f:['visual','motion'], msg:'abstract concept written as a visual — scenes show real, concrete, nameable objects only' },
    { re:/\b(paste|foam|ribbon)\b[^.]{0,45}\b(in|into|inside|within)\b[^.]{0,25}\b(glass|cup|mug|tumbler)\b|\b(glass|cup|mug|tumbler)\b[^.]{0,30}\b(of|filled with|holding)\b[^.]{0,20}\b(paste|foam)\b/i, f:['visual','motion'], msg:'paste/foam inside a drinking glass — paste only ever sits dispensed on a clean surface; a glass holds clear water only (24/09 fault)' },
    { re:/\b(unseen|invisible|off-?screen|hidden) (hands?|tap|source)\b|by an unseen hand/i, f:['visual','motion'], msg:'unseen hand/tap — objects acting with no visible agent read as haunted; show the hand or the tap in frame, or restage without the action' },
    { re:/held by [^.]{0,25}out of (the )?frame|hands?,? (just )?out of (the )?frame[^.]{0,20}(hold|grip|tube|pack)/i, f:['visual','motion'], msg:'product held by an out-of-frame hand — reads as a floating tube; show the hand in frame or rest the pack on a surface' },
    { re:/\b(toothbrush|brush)\b[^.]{0,35}\b(mouth|lips|teeth|face)\b|\b(brush(es|ing)?)\b[^.]{0,20}\b(her|his) teeth\b/i, f:['visual','motion'], msg:'brushing / brush-at-mouth action — object-to-face renders mangled; imply the routine with a before/after expression, never the act' },
    // sq:true — test with QUOTED spans stripped first: kinetic/caption styles legitimately quote
    // on-screen text ("caption 'GUMS THAT FEEL FIRM' slides in") and quoted words are captions,
    // not depicted anatomy (r1 sweep false-positive class, 24/09).
    { sq:true, re:/\b(gums(?! care)|gum ?line|gum tissue|anatomical\w*[^.]{0,30}\bgums?\b)/i, f:['visual','motion'], msg:'gums visually depicted — gums are NEVER shown on screen (uncanny); they live in the voiceover and captions only' },
    { re:/\b(lasers?|laser-\w+|robots?|robotic\w*|mechanical arm|drone)\b/i, f:['visual','motion'], msg:'sci-fi/robotic prop — renders weird and fights the heritage/home story; use light, glass and real objects instead' },
    { re:/\b(crystals?|shards?)\b[^.]{0,22}\b(embedded|within|inside|in (the )?(paste|ribbon)|on (the )?paste)\b|\b(embedded|studded|infused|speckled|mixed|integrated)\b[^.]{0,30}\b(crystals?|shards?)\b|\b(paste|toothpaste)\b[^.]{0,60}\b(embedded|studded|infused|speckled) /i, f:['visual','motion'], msg:'crystals inside/on the paste — paste is always pure, smooth, glossy white; formula elements live NEAR the product, never in the paste' },
    { re:/\b(water|tap|stream)\b[^.]{0,40}\b(continuously|keeps? running|still (running|present|flowing)|left running|runs? throughout)\b/i, f:['visual','motion'], msg:'tap left running through the scene — wasteful and distracting; a tap runs briefly WHILE being used, then is off' },
    { re:/(opens? )?(tight(er)?|close) on [^.]{0,15}\bhands?\b/i, f:['visual','motion'], msg:'framing tight on a hand — hands are never the subject of a frame; hands appear only inside mid-shots' },
    { re:/\b(rins\w+|gargl\w+|spits?|spitting|mouthful)\b|\bswish\w*[^.]{0,20}\b(mouth|water|liquid)\b|\bmouth[^.]{0,20}swish\w*\b/i, f:['visual','motion'], msg:'rinsing/swishing/mouth-liquid action — liquid at or in the mouth renders horribly; show the fresh feeling with expression only' },
    { re:/\b(dental|dentist(s|'s)?) (tray|trays|tool\w*|instrument\w*|chair|mirror|probe)\b|\bclinic(al)? (tray|table|bench)|petri dish(es)?|beakers?|test tubes?\b/i, f:['visual','motion'], msg:'clinical/dental prop — medical imagery breaches the cosmetic positioning; use everyday home objects only' },
    { re:/\b(sips?|sipping|drinks?(?! glass)|drinking(?! glass))\b|\b(brings?|raises?|lifts?)\b[^.]{0,35}\b(glass|cup|mug|bottle|tumbler)\b|\b(glass|cup|mug|tumbler)\b[^.]{0,25}\bto (her|his) (lips|mouth)\b/i, f:['visual','motion'], msg:'drinking / object raised to the face — objects merging with a face render badly; the glass stays on the counter or held at chest height, never at the lips' },
    { re:/\breach\w*[^.]{0,25}\boff-?(camera|screen|frame)\b|\breach\w* (for|toward|towards) something\b/i, f:['visual','motion'], msg:'a hand reaching for nothing/off-camera — ghost-hand actions render as mutated hands; every hand action targets a named visible object' },
    { re:/\b(zoom\w*|push\w*|close-?up|CU|ECU|macro)\b[^.]{0,50}\b(plant|pot|towel|mug|cup|glass|tumbler|window|prop|shelf|toothbrush|bristles?)\b/i, f:['visual','motion'], msg:'camera feature on a PROP — every beat must serve the product story; cut the prop beat and give the time to the problem or the pack' },
    { re:/\b(twirls?|twirling|spins? (the|a|her|his)|fiddl\w+|juggl\w+|tosses|tossing|flips? (the|a)|swirls? (the|a))\b/i, f:['visual','motion'], msg:'complex hand-object choreography — AI mangles fine hand actions; ONE simple hand action max per scene (pick up, put down, hold, turn tap)' },
    { re:/\b(tap|faucet|water)\b[^.]{0,60}\b(by itself|on its own|then stops|starts and stops|stops on its own)\b/i, f:['visual','motion'], msg:'tap/water starting or stopping by itself — water only runs while a hand visibly operates the tap' },
    { re:/\b(?<!feels )(?<!feel )firm(?!s (&|and) cares)\w*[^.]{0,28}?gums?\b/i, f:['vo','text'], msg:'bare firming-result phrase ("firm gums") — feel-language only: "gums that FEEL firm"' },
    { re:/\b(snap[- ]?zoom|zoom(s|ing)?|close-?up|CU|ECU|macro|crash zoom)\b[^.]{0,45}\b(pack|tube|box|product)\b|\b(pack|tube|box|product)\b[^.]{0,45}\b(snap[- ]?zoom|close-?up|CU|ECU|macro)\b/i, f:['visual','motion'], msg:'zoom/close-up on the pack — the pack stays UNDER A THIRD of the frame, straight-on and static (zooms warp the label lettering); hold the camera steady instead' }
  ];
  // Look-conditional traps — fantasy VFX elements are fine in polished/cinematic looks but
  // scream "AI ad" inside a lo-fi handheld world (the navy-wall/shard-stream failure, 23/09).
  const SB_LOFI_RULES = [
    { re:/\b(crystals?(?![- ]clear)|shards?|minerals?|salt[- ]?mineral\w*|rock clusters?|ribbons? of light|particles?|shimmer\w*|glow(ing)? panels?|light panels?|levitat\w+|floating elements?)\b/i, f:['visual','motion'], msg:'fantasy VFX element in a LO-FI ad — lo-fi realism means real everyday objects only; formula VFX belongs to polished/cinematic looks' },
    { re:/\b(studio|architectural|matte (navy|black|dark) walls?|colour-?blocked|color-?blocked|seamless backdrop|minimalist shelv\w+|branded wall|set design)\b/i, f:['visual','motion'], msg:'designed-set wording in a LO-FI ad — the world must be a real everyday location (home bathroom, kitchen, bedroom) in natural light' }
  ];
  // Baked-text traps — Veo garbles any words it has to draw (the typo class that binned the
  // 24/09 PAS renders). All on-screen wording lives in the "text" caption field (overlaid in
  // post); only the kinetic_type look, whose whole language is typography, is exempt.
  const SB_BAKED_TEXT_RULES = [
    { re:/\b(on-?screen (text|labels?|words?|titles?)|(captions?|text|labels?|words?|letter(s|ing)|typography|titles?) (appears?|animates?|materiali[sz]es?|fades? in|slides? in|pops? (in|up)|floats? in|glows? in)|animated (text|labels?|typography|lettering)|glowing (text|labels?|letters?)|title card|ingredient labels?)\b/i, f:['visual','motion'], msg:'baked text/labels written into the scene — Veo garbles any words it draws (the 24/09 typo fault); ALL on-screen wording lives ONLY in the "text" caption field, added in post' }
  ];
  const SB_WORLD_RULES = [
    { re:/(?<!no )(?<!without a )mirrors?\b(?![- ]free)|\bvanity\b/i, msg:'mirror/vanity in the WORLD — reflections mangle renders; frame the set so no mirror is ever in shot' },
    { re:/\b(pearls?|beads?|pills?)\b/i, msg:'round white objects in the WORLD — Veo safety filter reads them as pills' },
    { re:/\b(powder|vials?)\b/i, msg:'powder/vial in the WORLD — safety filter reads it as drug imagery' },
    { re:/\b(waterfall|fountain|cascad\w+|water (feature|stream|wall)|hidden basin)\b|\bwater\b[^.]{0,45}\b(wall|rock|stone|panel)\b/i, msg:'decorative water feature in the WORLD — the rock-water fault; water exists only as a tap or a drinking glass' }
  ];
  const SB_LOFI_WORLD_RULES = [
    { re:/\b(studio|architectural|matte (navy|black|dark) walls?|glow(ing)? panels?|light panels?|seamless backdrop|minimalist shelv\w+|branded wall|colour-?blocked|color-?blocked|diagonal blocks?|set design|crystals?|shards?|mineral)\b/i, msg:'designed set / VFX prop in the WORLD of a LO-FI ad — must be a real everyday Australian location (home bathroom framed mirror-free, kitchen, bedroom) in natural light' }
  ];
  const SB_ONE_WORLD_RE = /(bathroom[\s\S]{0,110}kitchen|kitchen[\s\S]{0,110}bathroom|bedroom[\s\S]{0,110}(kitchen|bathroom)|(kitchen|bathroom)[\s\S]{0,110}bedroom|adjacent (kitchen|bathroom|bedroom|room|corner|space)|two (rooms|locations|settings|spaces))/i;
  function lintStoryboard(sb, styleId, typeId){
    const out=[];
    const lofi = String(styleId||'')==='lofi_native';
    const contrastType = typeId==='vs'||typeId==='transform'||typeId==='mashup';
    if(!contrastType){ const m=String(sb.world||'').match(SB_ONE_WORLD_RE); if(m) out.push('WORLD: "'+m[0]+'" — TWO locations in the world — this ad format is ONE location only; pick a single room and stage every scene inside it'); }
    if(/lacalut|aktiv|lakalut/i.test(String(sb.hook||''))) out.push('HOOK: mentions the brand — the hook opens on the PROBLEM, never the brand or product name');
    const kinetic = String(styleId||'')==='kinetic_type';
    const rules = [...(lofi ? [...SB_LINT_RULES, ...SB_LOFI_RULES] : SB_LINT_RULES), ...(kinetic ? [] : SB_BAKED_TEXT_RULES)];
    const stripQuoted = t => String(t||'').replace(/'[^']{0,140}'|"[^"]{0,140}"|‘[^’]{0,140}’|“[^”]{0,140}”/g,' ');
    (sb.scenes||[]).forEach((sc,i)=>{
      // For caption-aware (sq) traps also remove the scene's OWN caption wording from the field —
      // apostrophes inside prose ("pack's") break naive quote-pairing (r3 false-positive fix).
      const capRe = String(sc.text||'').trim().length>3 ? new RegExp(String(sc.text).trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi') : null;
      for(const r of rules) for(const f of r.f){
        let src = String(sc[f]||'');
        if(r.sq){ if(capRe) src = src.replace(capRe,' '); src = stripQuoted(src); }
        const m=src.match(r.re);
        if(m) out.push('Scene '+(i+1)+' '+f.toUpperCase()+': "'+m[0]+'" — '+r.msg);
      }
      if(!String(sc.text||'').trim()) out.push('Scene '+(i+1)+': missing on-screen caption — SOUND-OFF law: every scene carries a short bold 3-7 word caption; the ad must fully work muted');
      const handHits=(String(sc.visual||'')+' '+String(sc.motion||'')).match(/\b(picks? up|sets? down|places?|reach(es|ing)?|dispens\w+|appl(y|ies|ying)|grabs?|lifts?|puts? down|lowers?)\b/gi)||[];
      // one action re-described ("dispenses… as she dispenses") is ONE action — count distinct verb stems
      const handActs=[...new Set(handHits.map(a=>a.toLowerCase().replace(/(ing|ied|ies|ed|es|s)\b/,'').replace(/e\b/,'').replace(/\s+(up|down)$/,'')))];
      if(String(sc.motion||'').trim().length<60) out.push('Scene '+(i+1)+' MOTION: too thin ('+String(sc.motion||'').trim().length+' chars) — 8 seconds needs 2-3 distinct visual beats (angle change, action, cut-feel), never one static hold');
      if(handActs.length>=3) out.push('Scene '+(i+1)+': '+handActs.length+' hand actions ('+handActs.slice(0,4).join(', ')+') — max ONE simple hand action per scene; cut the choreography');
      const w=String(sc.vo||'').trim().split(/\s+/).filter(Boolean).length;
      if(w>20) out.push('Scene '+(i+1)+' VO: '+w+' words — max 18 for an 8s scene; trim it');
      // Scenes render as ISOLATED clips — any reference to another scene is meaningless to the
      // renderer and drags in cross-scene drift (the exact bug hand-fixed on 24/09).
      const xref=(String(sc.visual||'')+' '+String(sc.motion||'')).match(/\b(previous|prior|last|earlier|next|opening|first) scene\b|\bscene \d\b|\bcontinu(ing|es?) from\b|\bas before\b|\bsame as (the )?(previous|last)\b|\(?the ['‘"]?(before|after)['’"]? (beat|state|shot|moment|version)\)?/i);
      if(xref) out.push('Scene '+(i+1)+': "'+xref[0]+'" — cross-scene reference; every scene renders independently and must describe its shot fully from scratch, never point at another scene');
      // State-change words in a VISUAL imply a prior state the isolated renderer can't see
      // ("the paste NOW swirling", "NOW filled" — the 24/09 hand-fixed fault). Motion may use
      // "now" for within-scene sequencing, so this fires on the visual field only.
      const stch=String(sc.visual||'').match(/\b(now|no longer|once again|has (become|changed|transformed))\b/i);
      if(stch) out.push('Scene '+(i+1)+' VISUAL: "'+stch[0]+'" — state-change wording implies a previous state; each scene is an isolated clip — describe what IS in shot absolutely, from scratch');
    });
    // Repeated distinctive word across the ad's spoken/written copy (house rule: never the same
    // distinctive word twice in one creative — 3+ uses reads as copy on autopilot).
    {
      const copy=[sb.hook,sb.cta,...(sb.scenes||[]).flatMap(s=>[s.vo,s.text])].join(' ').toLowerCase();
      // 4+ letters, not 6+ — "firm ×4" and "care ×4" sailed under the old 6-letter floor (24/09).
      // STOP = function words + mandated/brand vocabulary that legitimately repeats (feel-language, SKU names).
      const STOP=new Set(['lacalut','gums','online','toothpaste','german','germany','feeling','little','really','everyday','routine','morning','because','should','always','never','their','there','about','would','could','something','coffee',
        'that','this','your','with','from','into','then','them','they','have','will','more','when','what','over','only','just','like','very','some','each','most','than','been','while','where','after','before','under','every','once','back','down','same','also','here','onto','near','upon','into','does','doesn','don','were','it',
        'feel','feels','felt','aktiv','flora','herbal','sensitive','teeth','mouth','oral']);
      const freq={}; for(const wd of (copy.match(/[a-z][a-z-]{3,}/g)||[])) if(!STOP.has(wd)) freq[wd]=(freq[wd]||0)+1;
      const rep=Object.entries(freq).filter(([,n])=>n>=3).map(([wd,n])=>wd+' ×'+n);
      if(rep.length) out.push('COPY: repeated distinctive word'+(rep.length>1?'s':'')+' — '+rep.join(', ')+' — a distinctive word appears at most TWICE across the whole ad; REWRITE the extra uses with different wording (e.g. for cared-for: looked-after, pampered, at their best, given real attention)');
    }
    for(const r of SB_LINT_RULES){ if(r.f.indexOf('vo')>=0||r.f.indexOf('text')>=0){
      const h=String(sb.hook||'').match(r.re); if(h) out.push('HOOK: "'+h[0]+'" — '+r.msg);
      const c=String(sb.cta||'').match(r.re);  if(c) out.push('CTA: "'+c[0]+'" — '+r.msg);
    }}
    const wRules = lofi ? [...SB_WORLD_RULES, ...SB_LOFI_WORLD_RULES] : SB_WORLD_RULES;
    // Strip NEGATED clauses first — "devoid of mirrors, powders or vials" is compliance language,
    // not a violation (r3 false-positive fix). A negation claims absence up to the clause boundary.
    const worldSrc = String(sb.world||'').replace(/\b(no|without|devoid of|free of|never any?|never)\b[^.;]{0,80}/gi,' ');
    for(const r of wRules){ const m=worldSrc.match(r.re); if(m) out.push('WORLD: "'+m[0]+'" — '+r.msg); }
    return out;
  }

  async function generateStoryboard(opts){
    const apiKey = opts.apiKey || (global.localStorage && localStorage.getItem('lc_gemini_key')) || '';
    if(!apiKey) throw new Error('No Gemini API key');
    const model = opts.textModel || 'gemini-2.5-flash';
    const sku = opts.sku||'aktiv', s = SKUS[sku]||SKUS['aktiv'], g = getGuide(sku);
    const type = VIDEO_TYPES[opts.type]||VIDEO_TYPES.pas;
    const st = videoStyle(opts.style)||videoStyle(type.style);
    const nScenes = Math.max(2, Math.min(5, Math.round((opts.seconds||32)/8)));
    const bans = [...GLOBAL_BAN, ...s.ban];
    const brief = (opts.brief||'').trim();
    const fx = (g.formula||[]).filter(x=>x.on!==false).map(x=>x.text);
    const meta =
`You are a world-class performance-video creative director for LACALUT ${s.name} (premium 100-year German pharmacy oral-care brand, tone: ${s.voice}). Write a ${nScenes*8}-second Australian social-media video AD as EXACTLY ${nScenes} scenes of 8 seconds each.

ONE-UP LOOP (run internally BEFORE you answer — never show the drafts):
1. Write the full script v1. 2. One-up it: v2 must have a more thumb-stopping hook, more product-anchored scenes and a stronger build to the pack than v1. Then v3 > v2. Do at least 3 rounds. 3. Each round ask: "Is scene 1 impossible to scroll past? Is EVERY scene unmistakably about ${s.name}? Does the story climax on the pack? Does EVERY scene's VISUAL literally SHOW what its VO line is SAYING at that moment — feeling-copy shown as the character's chest-up payoff expression, mechanism-copy shown as the mechanism macro, problem-copy shown as the problem moment? (VO about gums over yet another product shot = the ad does not sell — restage the visual to match the words; gums/teeth/mouth interiors themselves are never shown.)" 4. Output ONLY the pinnacle version.

AD FORMAT: ${type.narrative}.
VISUAL LOOK (every scene): ${st?st.motion:''}
${brief?`CLIENT BRIEF (highest priority): ${brief}.`:`ANGLE SEED (no client brief given — build the ad around this proven angle): "${pickRand(g.headlines,1)[0]||s.say}".`}

BRAND GUIDE for ${s.name} — two layers:
HARD LOCKS (never bend): brand colours ${g.colours||s.palette} own every scene's light, accents and grade; the real GERMAN pack with WHITE cap; only ${s.name}'s own formula elements and benefit angle.
CREATIVE FREEDOM (video thrives on it): ${String(opts.style||type.style)==='lofi_native'
  ? `the world MUST be a REAL everyday Australian location a phone video would actually be shot in — a home bathroom (framed so no mirror is ever in shot), kitchen or bedroom, natural daylight, lived-in and believable. NO designed sets, NO studio, NO branded/coloured feature walls, NO glowing panels, NO decorative props, NO fantasy elements — lo-fi realism is the whole point. Brand colours appear only naturally (the pack, a towel, a mug).`
  : `you are NOT limited to studio setups — invent ONE bold cinematic world for the WHOLE ad (dramatic scale and unexpected moments welcome), as long as it lives inside the locked palette and stays premium.`} Every scene is staged INSIDE that one world. Use these as INSPIRATION, not a cage: product truths like ${pickRand(g.usps,3).join(' · ')||s.say}; trust cues like ${pickRand(g.trust,2).join(' · ')||'Made in Germany'}.
- WATER LAW (hard rule): water may ONLY appear from a real everyday source — a running tap or a clear drinking glass. NEVER scenic/decorative water: streams down walls or rocks, waterfalls, fountains, hidden basins, floating water. Sourceless water renders fake and auto-fails QC. AND water and the formula crystals/minerals NEVER appear in the SAME scene — not touching, not side by side, not bridged by a camera move ("pans from the water to the crystal" is banned); a scene shows EITHER water (tap/glass) OR crystals, never both.

COSMETIC-ONLY COMPLIANCE (non-negotiable — LACALUT is a cosmetic, not a medicine):
- NO therapeutic or disease claims. NEVER use: ${bans.join(', ')}. NEVER "treat", "cure", "clinically proven", statistics or percentages.
- The ONLY ingredients that may ever be named are "fluoride" and "hydroxyapatite" — NEVER strontium, potassium, aluminium lactate, bisabolol, chlorhexidine, zinc, or any ion label (Sr2+, K+).
- This product's ONLY allowed benefit angle: ${s.say}. Never borrow another LACALUT product's angle.
- All copy in plain Australian English, everyday language, cosmetic feel-benefits only. NEVER the words "healthy", "health", "heal" in any hook, caption, VO or CTA — say "feels cared-for" / "at their best" instead.

CRAFT RULES (built from what is PROVEN to convert — Motion 2026 benchmarks, TikTok Creative Codes, Meta lift studies):
- PRODUCT LOCK (hard rule): the ONLY product or object that may ever be a scene's subject is the LACALUT ${s.name} pack itself (the real GERMAN pack with its WHITE cap — a TOOTHPASTE TUBE/BOX unless the reference is a mouthwash bottle) or its SIGNATURE FORMULA ELEMENTS: ${fx.join(', ')||'clean water and minerals'}. NEVER build a scene around a toothbrush, a different product, generic props or stock objects. Every scene must be unmistakably about ${s.name} or its benefit.
- PACK MOTION LOCK (hard rule): the pack NEVER flips, spins, turns over or rotates away from camera — its printed front label FACES CAMERA the entire time it is on screen (a subtle tilt of a few degrees is the maximum). If you want dynamism, move the CAMERA or the environment around the pack instead. NEVER write motion like "rotates to show the label", "spins into frame", "360-degree turn" — AI video mangles the logo the moment the pack rotates. PACK SCALE (hard rule): the pack NEVER fills more than a THIRD of the frame — no pack close-ups, macros or snap-zooms onto it; a steady straight-on framing under a third of frame is what keeps the label lettering perfect.
- CHARACTER LOCK (hard rule): at most ONE person appears in the whole ad. Invent that ONE person once and describe them in rich detail in the "character" field (age, ethnicity, hair colour+style, outfit, distinguishing look). EVERY scene that shows a person shows EXACTLY that person — same face, same hair, same outfit, same age. A different actor appearing between scenes destroys the ad. Scenes may also show no person at all.
- WORLD LOCK (hard rule — the #1 congruence rule): this ad happens in EXACTLY ONE location/set. Invent it once and describe it in rich concrete detail in the "world" field: the place, its surfaces and props, the lighting setup, colour palette and time of day. EVERY scene is staged inside THAT world — what changes between scenes is the CAMERA (angle, distance, macro vs wide) and the ACTION, never the location, lighting mood or palette. A background or setting change between scenes destroys the ad: the scenes must read as ONE continuous film shot on ONE set, never separate clips taped together. Each scene's "visual" must explicitly name where in the world the camera is. ONLY exception: an ad type whose format demands a contrast beat (Old Way vs New, Transformation before/after) may add ONE deliberate second setting — introduced once, reused for every one of its beats, both settings described in "world".
- CONTINUITY: each scene's opening beat visually echoes the previous scene's closing beat — same palette, same light, same world.
- SCENE INDEPENDENCE (hard rule): every scene is rendered as its own isolated clip by a generator that cannot see any other scene — each scene's "visual" and "motion" must describe the shot COMPLETELY from scratch and may NEVER reference another scene ("from the previous scene", "continuing the zoom", "as before", "same as scene 1", "the 'after' beat" are all forbidden — restate the content instead). A scene's "visual" also never uses state-change words ("now", "no longer", "once again", "has become") — they imply a previous state the renderer cannot see; describe what IS in shot, absolutely.
- NO COPY AUTOPILOT: never use the same distinctive word three or more times across the ad's hook, captions, VO and CTA — vary the wording (e.g. "cared-for" once or twice, never in every line). Short words count too: "firm", "care", "fresh" obey the same max-twice rule. Before you output, COUNT every distinctive word across hook+captions+VO+CTA; rewrite any third use. Rotation palette: firm → resilient / at their best / comfortable; care/cared-for → looked-after / pampered / given real attention; fresh → clean-feeling / revitalised.
${String(opts.style||type.style)==='kinetic_type' ? '' : `- ON-SCREEN TEXT LOCK (hard rule): the ONLY on-screen wording in the whole ad is each scene's "text" caption field (overlaid in post). NEVER write text, words, labels, titles or typography appearing INSIDE a scene's "visual" or "motion" — no "labels appear", no animated ingredient names, no glowing words: the video engine garbles any text it has to draw.
`}- PASTE PLACEMENT (hard rule): paste and foam only ever sit dispensed on a clean surface — NEVER in, into or inside a glass, cup or tumbler; a glass only ever holds clear still water.
- BENEFIT-PAYOFF BEAT (hard rule — sells the feeling, not the tube): whenever the VO/captions promise how gums or the mouth FEEL, at least ONE scene (ideally the second-to-last or final) must SHOW the human payoff — the ad's ONE character at chest-up framing with a genuinely warm, relaxed, confident closed-or-soft smile, radiating "my mouth feels amazing", with the pack visible under a third of the frame. An ad that is 100% product/formula shots while the copy talks about people's gums does NOT convert and is a FAIL. (Gums, teeth and mouth interiors are still NEVER shown — the smile and expression carry the feeling.)
- AI-WEAKNESS AVOIDANCE (hard rules — these shots ALWAYS render badly): NEVER write mirror-reflection shots (reflections mangle the pack and the person); NEVER extreme face close-ups filling the frame (uncanny valley) — nothing tighter than a chest-up mid-shot on a person, no mouth-only or teeth-macro framing, NEVER a tongue; keep hands minimal and simple — at most ONE hand visible in frame at any moment (two hands double the AI's failure rate), at most ONE simple hand action per scene (pick up, put down, hold, turn a tap), never twirling/fiddling/tossing objects, never fine finger actions and never touches the mouth, jaw, chin, cheek or any part of the face; NEVER overlay visual effects (gels, mists, glows, particles) on a person's face or skin — effects live in the environment, away from people; the product is lit naturally, never wrapped, enveloped or surrounded by a glow/halo/energy effect — crystals and streams move NEAR the pack, never around or onto it — always write the words "near the pack", never the phrase "around the pack".
- VEO SAFETY FILTER (hard rule — breaching it silently kills the render and wastes the day's quota): NEVER write white pearls, spheres, beads, droplets-as-pearls or ANY small round white objects (the video engine's safety filter reads them as pills and returns nothing). ${String(opts.style||type.style)==='lofi_native' ? 'In this LO-FI look there are NO substitute VFX either — no crystal shards, mineral streams, ribbons of light or particles; use real everyday objects and the pack itself only.' : 'Use angular mineral CRYSTAL SHARDS, flowing mineral streams or ribbons of light instead.'}
- VOICE-FREE SCENES (hard rule): never write human vocal sounds into any scene's visual or motion ('uhm', sighs, gasps, humming, whispering, chatter) — scenes are voice-free; the narrator is recorded separately in post.
- PACK TEXT: never reveal, read or glide to the pack's SIDE or BACK text (it is German and must stay unreadable) — the front label facing camera is the only pack face ever shown.
- PASTE & TAPS: paste is only ever dispensed by the character's hand (never extrudes by itself), and a tap only runs in the moment a hand uses it — never left running through a scene. Never show brushing or a brush near the mouth.
- PACK STAYS GROUNDED (hard rule): the pack is NEVER held aloft, lifted, carried or presented in a hand — it always STANDS on a surface; a hand may press, steady or dispense from it while it stays standing. A hand-held pack drifts toward the lens and garbles the label.
- NO GRAPHICS IN SCENES (hard rule): scenes contain only real physical objects and light — never icons, badges, highlight circles, arrows, UI elements or any graphic overlay (all graphics and text are added in post).
- PASTE APPEARANCE: whenever toothpaste itself is shown it looks smooth, creamy, glossy and appealing — never gritty, granular, lumpy, or pulsing/animated as if alive.
- FEEL-LANGUAGE ONLY: every benefit is sensory ("feels firm", "feels clean", "cared-for") — never physiological verbs (firms, strengthens, repairs, protects) and never "effective" or "results".
- HOOK RULES (scene 1, the first 3 seconds decide everything): NEVER open on the logo, the brand name or a pack hero — open on the problem, a bold claim, a confession, a contrast or a pattern interrupt. Scene 1's "text" caption must carry the payoff promise on its own (most viewers watch MUTED). Put a strong visual interrupt in the first second.
- RE-HOOK RHYTHM (a hook buys 3 seconds, not 30 — the ad must re-earn attention): every scene boundary fires a TRIPLE RESET in the same moment — a VISUAL reset (new angle, object or motion), an AUDIO reset (a SOUND EFFECT or deliberate beat of silence — write it into "motion"; never music, music is one continuous bed added in post), and a CURIOSITY reset (a new open question the viewer wants answered). Inside a scene, something must change every 4–8 seconds.
- OPEN LOOP, CLOSE LATE: scene 1 opens a curiosity question ("how is that possible?") that is deliberately NOT answered until the PROOF beat in the second-to-last scene. Revealing the answer early kills the reason to keep watching. The FINAL scene closes with a clear direct CTA — never a loop-back ending (that is for organic, not paid).
- SOUND-OFF DESIGN (mandatory): 70–85% of viewers watch muted. EVERY scene's "text" is REQUIRED — a short bold caption (3–7 words) carrying that scene's message; the ad must fully work with the sound off. VO is a layer on top, never the carrier.
- Each scene's "vo" is the EXACT spoken voiceover line — max 18 words, natural spoken Australian English, fits comfortably in 8 seconds.
- "voice" describes ONE consistent voiceover artist (gender, age, accent, pace) reused in every scene — always UPBEAT and smiling: warm, uplifting, energised delivery with dynamic intonation, never flat or monotone.
- "styleAnchor" is ONE sentence describing the shared visual style (lighting, grade, mood) that every scene repeats verbatim — it MUST embody the VISUAL LOOK given above (a lo-fi handheld look stays lo-fi in the anchor and every scene; never drift toward studio polish the look didn't ask for).
- "world" is 2–3 sentences describing the ONE location/set in concrete physical detail — reused verbatim by every scene (plus the single contrast setting if the format demands one). The world must NEVER contain a mirror, vanity mirror or large reflective glass (reflections mangle AI renders — a bathroom set is framed so no mirror is ever in shot), and never white round objects, powders or vials.
- "visual" describes what we see; "motion" the camera/subject movement — write motion with a visual change every 2–3 seconds, never a static hold over 4 seconds (pacing is where retention dies).
- Final scene ends on the product + call to action. The real GERMAN pack with its WHITE cap is the only product ever shown.
- SENSITIVITY GUARD: never claim to reduce/treat sensitivity or present remineralisation as therapy — always comfort/feel language.

Return ONLY valid JSON:
{"hook":"...","cta":"...","voice":"...","character":"...","world":"...","styleAnchor":"...","scenes":[{"n":1,"seconds":8,"visual":"...","motion":"...","vo":"...","text":""}]}`;
    let lastErr;
    for(let attempt=0; attempt<2; attempt++){
      try{
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+apiKey,
          { method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ contents:[{role:'user',parts:[{text:meta}]}], generationConfig:{ responseMimeType:'application/json', temperature:1.0 } }) });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error?.message||('HTTP '+res.status));
        const txt = (data.candidates?.[0]?.content?.parts||[]).map(p=>p.text).filter(Boolean).join('').replace(/```json|```/g,'').trim();
        let sb = JSON.parse(txt);
        if(!sb || !Array.isArray(sb.scenes) || sb.scenes.length<2) throw new Error('Storyboard came back malformed');
        sb.scenes = sb.scenes.slice(0,5).map((sc,i)=>({ n:i+1, seconds:8, visual:String(sc.visual||''), motion:String(sc.motion||''), vo:String(sc.vo||''), text:String(sc.text||'') }));
        sb = sanitizeStoryboard(sb);
        // TYPE + LOOK CONFORMANCE AUDIT — does the script actually read as the chosen ad type, in the chosen look?
        try{
          const auditMeta = `AUDIT this LACALUT video-ad storyboard for FORMAT CONFORMANCE.

CHOSEN AD TYPE — the storyboard must follow this structure: ${type.narrative}

CHOSEN VISUAL LOOK — every scene's visual/motion wording and the styleAnchor must read as: ${st?st.motion:'(no specific look)'}

TYPE CHECKLIST (structural musts): Problem-Agitate-Solve = ~60% of runtime on the problem, product appears only after; Demo = the product physically IN ACTION in macro; Old-vs-New = BOTH sides actually shown in contrast; Transformation = an explicit BEFORE beat and AFTER beat (no before/after = fail, restructure); Social-Proof Mashup = rapid micro-beats each landing ONE captioned benefit; Brand Story = no people on camera, heritage narrative. Scene 1's MOTION must contain a literal visual interrupt inside its first second (snap cut, fast reveal, sharp move) — a passive hold is a hook fail; BENEFIT-PAYOFF: if the VO/captions promise how gums/the mouth FEEL, at least one scene must show the character's chest-up confident-smile payoff beat (an all-product ad with feeling-copy is a fail — restage one scene, never showing gums/teeth/mouth interiors); ALSO: the character wears THE SAME outfit in every scene AND on both sides of any split/contrast (an outfit change between sides is a fail); every scene has 2-3 distinct visual beats (a single static hold for 8s is a pacing fail) but never more than 3 shots;  paste never dispenses itself; the WORLD must be physically concrete, and for contrast formats it must describe BOTH settings in detail.

ALSO judge VO-VISUAL CONGRUENCE scene by scene: each scene's visual must SHOW what that scene's VO is SAYING (feeling-copy → the character's chest-up payoff expression; mechanism-copy → the mechanism macro; problem-copy → the problem moment). A scene whose VO talks about how gums feel while the visual is just another product shot is a CONGRUENCE FAIL — restage that visual (never showing gums/teeth/mouth interiors; the smile and expression carry the feeling).

Judge two things:
1. TYPE: does each scene serve that narrative structure? (e.g. a Problem-Agitate-Solve ad spends ~60% of runtime on the problem, product appears only after; a demo ad SHOWS the mechanism; a comparison has clear old-vs-new beats.)
2. LOOK: does the literal WORDING of every visual/motion line + the styleAnchor speak that look's language? A lo-fi handheld look must say handheld/candid/real-world-light/phone-shot in the scene text — words like "cinematic", "elegant", "premium studio", "dramatic lighting" mean the look has drifted.
3. WORLD: does the WORLD itself belong to the look? A lo-fi look's world must be a REAL everyday location (home bathroom framed mirror-free, kitchen, bedroom, natural light) — a designed set, studio, branded/coloured feature walls, glowing panels, decorative water features or fantasy props (crystals, mineral streams) are a LOOK FAIL: rewrite the world to a real location and restage every scene inside it.

If FULLY conformant, return the JSON unchanged. Otherwise return corrected JSON — rewrite only what breaks conformance; keep the world, character, VO meaning and schema identical. Never introduce: mirrors, pearls/beads/powder, finger/tongue/hand-to-face contact, pack motion or label zooms, framing tighter than chest-up, VO over 18 words, non-cosmetic wording, text/labels/typography drawn inside a scene's visual or motion, state-change words ("now", "no longer") in a visual, cross-scene references, or paste/foam in a glass.

Return ONLY valid JSON, exact same schema:
${JSON.stringify({hook:sb.hook,cta:sb.cta,voice:sb.voice,character:sb.character||'',world:sb.world||'',styleAnchor:sb.styleAnchor,scenes:sb.scenes.map(sc=>({n:sc.n,seconds:8,visual:sc.visual,motion:sc.motion,vo:sc.vo,text:sc.text}))})}`;
          const ar = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+apiKey,
            { method:'POST', headers:{'Content-Type':'application/json'},
              body:JSON.stringify({ contents:[{role:'user',parts:[{text:auditMeta}]}], generationConfig:{ responseMimeType:'application/json', temperature:0.3 } }) });
          const ad = await ar.json();
          if(ar.ok){
            const at = (ad.candidates?.[0]?.content?.parts||[]).map(p=>p.text).filter(Boolean).join('').replace(/```json|```/g,'').trim();
            const ax = JSON.parse(at);
            if(ax && Array.isArray(ax.scenes) && ax.scenes.length===sb.scenes.length){
              ax.scenes = ax.scenes.map((sc,i)=>({ n:i+1, seconds:8, visual:String(sc.visual||''), motion:String(sc.motion||''), vo:String(sc.vo||''), text:String(sc.text||'') }));
              sb = sanitizeStoryboard(ax);
            }
          }
        }catch(e){ /* audit is best-effort — lint repair still runs below */ }
        // SELF-REPAIR LOOP — text is free; fix lint violations BEFORE the human ever reads the script
        // (3 rounds, not 2 — r8 showed repetition/VFX faults regularly surviving two passes)
        for(let round=0; round<3; round++){
          const issues = lintStoryboard(sb, opts.style||type.style, opts.type||'pas');
          if(!issues.length) break;
          try{
            const fixMeta = `You wrote this LACALUT video-ad storyboard JSON. A hard production lint found these violations:\n- ${issues.join('\n- ')}\n\nRewrite the storyboard fixing ONLY those violations — keep every other word, the world, the character, the hook, the structure and the JSON schema identical. The rules behind them: no white pearls/beads/round objects and no powders/vials (safety filter reads them as pills/drugs — use angular crystal shards or mineral streams); no mirrors or vanities anywhere, including the world description (reframe the set so no mirror exists); no finger actions, tongue shots or hands touching the mouth/face; nothing tighter than a chest-up mid-shot on a person; the camera never zooms onto the label, never close-ups/snap-zooms the pack (pack stays under a third of the frame, straight-on, static) and never circles the pack; no human vocal sounds written into scenes; never reveal the pack's side/back text; the pack never rotates (move the camera); no fade-to-black (hold bright on pack + CTA); at most ONE simple hand action per scene, never twirling/gripping/clenching or fiddling with objects; hands never in close-up and never the subject of a frame; the world is ONE single room (never bathroom+kitchen or any second space); never drinking or raising a glass to the lips; hands only reach for named visible objects; the camera never features a prop (plant/towel/mug); the hook opens on the problem, never the brand name; taps never start/stop by themselves — a hand operates them; never the bare phrase "firm gums" — always "gums that FEEL firm"; never "treatment"/"protects"/"supports"/"firmness" or any physical-outcome wording (feel-language only); never invented ratings or star overlays; water and the formula crystals/minerals never appear in the SAME scene (not touching, not side by side, not bridged by a camera pan — a scene shows EITHER water OR crystals); the pack never moves toward the camera; paste always smooth and creamy, never granular or pulsing; formula crystals NEVER sit in, on or inside the paste (near the product only); water ONLY from a tap or drinking glass, never scenic water down walls/rocks; no music words in scenes (music is added at stitch); in a LO-FI look no VFX elements (crystals/shards/streams/particles) and the world is a real everyday home location; each VO max 18 words; cosmetic feel-language only (say "feels firm" / "cared-for", never firms/effective/repairs); every scene describes its shot fully from scratch and never references another scene ("from the previous scene", "continuing", "as before", "the 'after' beat" — restate the content instead); a scene's visual never uses state-change words ("now", "no longer", "once again", "has become") — describe what IS in shot absolutely; never write text, words, labels or typography appearing inside a scene's visual/motion (the engine garbles drawn words) — on-screen wording lives ONLY in the "text" caption field; paste/foam never goes in a glass (a glass holds clear water only — paste sits dispensed on a clean surface); never use the same distinctive word 3+ times across the ad's copy — short words like "firm"/"care" count too — COUNT each named overused word's occurrences across hook+captions+VO+CTA and rewrite every use beyond the second (palette: firm → resilient/at their best/comfortable; care → looked-after/pampered/given real attention; fresh → clean-feeling/revitalised); never "healthy"/"health" in any copy (cosmetic feel-language only); EVERY scene has a short bold 3-7 word on-screen caption in "text" (sound-off law — the ad must fully work muted).\n\nReturn ONLY the corrected JSON, exact same schema:\n${JSON.stringify({hook:sb.hook,cta:sb.cta,voice:sb.voice,character:sb.character||'',world:sb.world||'',styleAnchor:sb.styleAnchor,scenes:sb.scenes.map(sc=>({n:sc.n,seconds:8,visual:sc.visual,motion:sc.motion,vo:sc.vo,text:sc.text}))})}`;
            const fr = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+apiKey,
              { method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({ contents:[{role:'user',parts:[{text:fixMeta}]}], generationConfig:{ responseMimeType:'application/json', temperature:0.4 } }) });
            const fd = await fr.json();
            if(!fr.ok) break;
            const ft = (fd.candidates?.[0]?.content?.parts||[]).map(p=>p.text).filter(Boolean).join('').replace(/```json|```/g,'').trim();
            const fx = JSON.parse(ft);
            if(!fx || !Array.isArray(fx.scenes) || fx.scenes.length!==sb.scenes.length) break;
            fx.scenes = fx.scenes.map((sc,i)=>({ n:i+1, seconds:8, visual:String(sc.visual||''), motion:String(sc.motion||''), vo:String(sc.vo||''), text:String(sc.text||'') }));
            sb = sanitizeStoryboard(fx);
          }catch(e){ break; }
        }
        sb.lint = lintStoryboard(sb, opts.style||type.style, opts.type||'pas');   // whatever survived repair — surfaced amber in the approval modal
        return sb;
      }catch(e){ lastErr=e; }
    }
    throw new Error('Could not write the script: '+(lastErr?lastErr.message:'unknown'));
  }

  /* ═══ SCENE PROMPT — buildVideoPrompt + continuity + exact VO lock ═══ */
  function buildScenePrompt(opts){
    const sb = opts.storyboard, sc = opts.scene, i = opts.index, total = opts.total;
    const hasPack = /(pack|tube|box|bottle|product|lacalut)/i.test((sc.visual||'')+' '+(sc.motion||''));
    let p = buildVideoPrompt({ sku:opts.sku, style:opts.style, aspectRatio:opts.aspectRatio, seconds:8, advNeg:true, hasPack,
      brief: sc.visual + '. ' + sc.motion });
    p += ` SCENE ${i+1} of ${total} of ONE continuous ad. SHARED STYLE (identical in every scene of this ad): ${sb.styleAnchor}. `;
    p += sb.world ? `WORLD LOCK: the entire ad happens inside EXACTLY this one location (identical in every scene): ${sb.world} — same set, same surfaces, same lighting mood, same palette; only the camera and the action change between scenes; NEVER drift to a different location or background. ` : '';
    p += sb.character ? `CHARACTER LOCK: any person on screen is EXACTLY this person (identical in every scene): ${sb.character} — same face, hair, outfit; never a different actor. ` : '';
    p += `AUDIO (mandatory): quiet ambient room tone and subtle SOUND EFFECTS only — NO MUSIC of any kind (each scene composing its own music destroys the ad at the joins; one continuous soundtrack is mixed over the finished ad in post) and ABSOLUTELY NO human vocal sounds of ANY kind: no spoken words, no voiceover, no narration, no talking, no singing, no whispering, no humming, no male voice, no female voice, no background chatter or crowd murmur (one consistent narrator is recorded separately and mixed in post). Open the scene on a subtle sound-effect cue landing together with the visual change. `;
    p += sc.text ? `ON-SCREEN CAPTION (exact wording, mandatory): "${sc.text}" — rendered as a LARGE, bold, high-contrast caption instantly readable on a muted phone screen; correctly spelled, never garbled. ` : `NO on-screen text in this scene. `;
    p += `PACK MOTION LOCK: while the pack is on screen its printed front label stays FACING CAMERA, perfectly legible and pixel-stable — NEVER flip, spin, turn over or rotate the pack (a subtle tilt of a few degrees is the maximum); never warp, redraw, re-letter, mirror or reverse the label during motion; keep the pack's real tall slim proportions unchanged in every frame; the pack stays at its opening-frame SIZE — the camera never pushes so close that the label fills the frame. `;
    p += `LIQUID PHYSICS: any water or liquid has a visible natural source and obeys gravity — never emerging from rocks, crystals or objects; no small white beads, pearls or droplet-strings may form. `;
    p += `BRIEF FIDELITY (hard rule): render ONLY what this scene's brief describes — NEVER invent extra shots, cutaways, inserts, new objects, props, products, people or locations the brief does not name; nothing may materialise out of thin air (no ice, cubes, crystals or objects appearing in hands); an object may only enter frame carried by a visible hand or revealed by the camera move. `;
    p += `NO UI OVERLAYS: never render a phone camera interface, recording indicator, timestamp, watermark, subtitles or any UI chrome — the frame is clean footage. `;
    p += `MIRROR LOCK: no mirrors and no reflective surface showing a readable reflection anywhere in the scene. `;
    p += `HANDS: at most ONE hand visible in frame at any moment, relaxed and simple — fingers never grip tightly, never interact with another hand, never merge with objects. `;
    return p;
  }

  function storyboardCostEstimate(opts){
    const m = videoModel(opts.model||'VEO3');
    const scenes = Math.max(1, opts.scenes||3);
    const perSceneUsd = +(m.usdPerSec*8).toFixed(2);
    return { scenes, perSceneUsd, usd:+(perSceneUsd*scenes).toFixed(2), model:(opts.model||'VEO3'), label:m.label, usdPerSec:m.usdPerSec };
  }

  /* ═══ SEQUENTIAL RENDER — one scene, then the whole board ═══ */
  /* Two-step scene render (the Higgsfield-fidelity fix): Veo treats its input image as
     the literal FIRST FRAME — feeding it a bare packshot + a different scene brief makes
     it redraw (and mangle) the pack. So: STEP 1 pin fidelity by generating the scene's
     opening STILL with the image engine (packshot refs = source of truth, caption baked
     in, text accurate); STEP 2 hand Veo that finished still and ask for MOTION only. */
  async function renderScene(opts){
    const sc = opts.scene, sb = opts.storyboard;
    const s = SKUS[opts.sku]||SKUS['aktiv'];
    const g = getGuide(opts.sku);
    const onProg = opts.onProgress||function(){};
    // STEP 1 — scene still, pack-accurate (multiple packshot refs = tube AND box when saved).
    // Packshot refs go ONLY to scenes whose script actually shows the pack — feeding them to a
    // pack-free scene makes the image model paint the tube in uninvited (redrawn = garbled label).
    // v2 PACKSHOT COMPOSITING (24/09/2026 — the S3-class drift fix): generating scene + pack in
    // ONE pass makes the studio packshot refs fight the world/continuity refs — the world drifts
    // toward generic studio and the person mutates. v2 splits the job: PASS A renders the scene
    // as a product-free BASE PLATE anchored on the WORLD STILL (scene 1's frame) + the previous
    // scene's still; PASS B inserts the EXACT packshot into that finished plate via editImage,
    // which is ordered to keep every other pixel identical. Pack fidelity and world fidelity
    // stop competing. Any PASS failure falls back to the proven v1 single-pass.
    const sceneWantsPack = /(pack|tube|box|bottle|product|lacalut)/i.test((sc.visual||'')+' '+(sc.motion||''));
    const packRefs = (opts.refImgs && opts.refImgs.length ? opts.refImgs : [opts.refImgDataUrl]).filter(Boolean).slice(0,3);
    const refs = sceneWantsPack ? packRefs : [];
    // World-anchor first, then previous still (deduped) — re-anchoring every scene to scene 1's
    // frame stops drift accumulating down the chain.
    const anchors = [opts.worldStill, opts.prevStill].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).slice(0,2);
    let still = refs[0]||null, stillOk = false;
    try{
      onProg('🖼️ composing scene still…');
      const vlook = videoStyle(opts.style);
      let sp = `Opening FRAME of a video ad scene for LACALUT ${s.name} (German pharmacy oral-care brand). `;
      sp += vlook ? `VISUAL LOOK (hard rule — this defines the entire frame and OVERRIDES any default polish): ${vlook.motion} If this look is lo-fi/handheld, the frame must read as a candid smartphone photo a real person took — natural imperfect framing, real-world light — NOT a glossy studio ad. ` : '';
      sp += `SCENE: ${sc.visual}. SHARED STYLE: ${sb.styleAnchor}. STRICT brand colours — ${g.colours||s.palette}. `;
      sp += (sb && sb.world) ? `WORLD LOCK (the #1 rule of this ad): every scene of this ad is shot inside EXACTLY this one location — ${sb.world} — same set, same surfaces and props, same lighting setup, same colour palette, same time of day; compose THIS scene's brief within that world (change only the camera angle/distance and the action), NEVER a different or generic background. ` : '';
      sp += anchors.length ? `CONTINUITY REFERENCE (hard rule): the ${anchors.length===2?'TWO style-reference images are earlier frames':'style-reference image is an earlier frame'} of this SAME ad${anchors.length===2?' — the FIRST is scene 1 (the ad\'s world anchor), the SECOND is the previous scene':''} — match ${anchors.length===2?'their':'its'} exact location, surfaces, props, lighting, colour grade and world so every scene cuts together seamlessly as one continuous film; do not copy ${anchors.length===2?'their':'its'} composition, stage this scene's own brief inside the identical world. ` : '';
      sp += sc.text ? `ON-SCREEN CAPTION (exact wording, mandatory): "${sc.text}" — LARGE, bold, clean sans-serif, high-contrast, instantly readable on a phone, EVERY word correctly spelled (render fewer words perfectly rather than more words garbled). ` : `No on-screen text. `;
      sp += `TEXT LOCK: besides that caption and the product's own real label, there is NO other text anywhere in the scene — no invented signage, posters, panels, banners or decorative words. MIRROR LOCK: every piece of text reads in correct left-to-right orientation — NEVER mirrored, reversed, doubled or reflected lettering (mirror and reflection shots must not flip any text). `;
      sp += (sb && sb.character) ? `CHARACTER LOCK: if a person appears, it is EXACTLY this person (identical in every scene of this ad): ${sb.character} — same face, hair, outfit and age; NEVER a different actor. ` : '';
      sp += `HUMAN REALISM: any person must be indistinguishable from a real filmed human — natural skin with visible texture and pores, natural asymmetric expression, genuine relaxed smile, real eye depth; never plastic-smooth skin, never uncanny, never overly perfect teeth. `;
      sp += `EFFECTS REALISM: fluids and particles behave physically — water splashes with true liquid dynamics (never jelly-like or plastic), no generic glow halos around the product; light and reflections integrate naturally. `;
      sp += `PRODUCT FORM LOCK: one consistent form for the whole ad — show the TUBE (or the bottle for a mouthwash) as the on-screen product in every scene; the BOX may appear only if this scene's brief explicitly calls for it, and never replaces or alternates with the tube between scenes. If the product appears: reproduce the reference packshot EXACTLY — real German packaging, exact label text and layout, WHITE cap; keep the pack's REAL PROPORTIONS from the reference (a tall, slim toothpaste tube — never shortened, widened, squat or stubby); front label FACING CAMERA; never invent, garble, translate or re-letter pack text. GERMAN PACK LOCK (legal requirement): all small descriptive pack text stays in GERMAN exactly as the reference AND softly out of focus / too small to read — NEVER render legible ENGLISH words on the pack (especially health words like "protects", "bleeding", "gums", "periodontitis", "inflammation", "prevents"); only the LACALUT wordmark and variant name may read clearly. `;
      sp += sceneWantsPack ? '' : `NO PRODUCT IN THIS SCENE (hard rule): this scene's script does NOT include the pack — the LACALUT tube/box must NOT appear anywhere in this frame; no toothpaste product at all, only the scene as described. `;
      sp += `STRICT COMPLIANCE — never show or write: ${[...GLOBAL_BAN, ...s.ban].join(', ')}. `;
      sp += `PACK SCALE (hard rule — big packs garble): the pack occupies NO MORE than about 30% of the frame's height, standing upright with the label straight-on to camera (no tilt) — a modest, believable product presence, NEVER a label-filling macro; the smaller and straighter the pack, the sharper its text survives. `;
      sp += `WATER/LIQUID PHYSICS: any water or liquid must have a visible, natural source (a tap, a pour from above, a splash landing) and obey gravity — water NEVER emerges from rocks, crystals or objects. `;
      sp += `${opts.aspectRatio||'9:16'} aspect ratio, photoreal, faithful to the VISUAL LOOK above (candid phone-shot realism when the look is lo-fi; polished finish only when the look asks for it), composed with headroom for motion.`;
      if(sceneWantsPack && packRefs.length){
        // PASS A — product-free base plate (world/person fidelity)
        const spPlate = sp + `BASE PLATE (hard rule for THIS render): stage the scene exactly as described but WITHOUT the LACALUT pack or any toothpaste product anywhere in the frame — the real product photo is composited in afterwards; leave its resting spot clear, naturally lit and in focus.`;
        const plate = await callGemini({ prompt:spPlate, productImgs:[], styleImgs:anchors,
          render:'photoreal', model:'gemini-3-pro-image-preview', apiKey:opts.apiKey, aspectRatio:opts.aspectRatio });
        try{
          // PASS B — insert the EXACT packshot into the finished plate (pack fidelity)
          onProg('📦 compositing the real packshot…');
          still = await editImage({ imgDataUrl:plate, refImgs:packRefs, sku:opts.sku, apiKey:opts.apiKey,
            model:'gemini-3-pro-image-preview', aspectRatio:opts.aspectRatio,
            instruction:`INSERT the LACALUT ${s.name} product from the reference packshot into this scene — ${sc.visual}. It stands upright with its front label facing camera dead-on, keeping the reference pack's EXACT physical format and proportions (tube, box or bottle exactly as photographed — never morph one format into another), real GERMAN label, WHITE cap, occupying no more than 30% of the frame height, lit by the scene's existing light with a soft natural contact shadow grounding it on the surface. Place it fully CLEAR of any on-screen caption text — the pack and the caption must never overlap and the caption stays fully readable. Reproduce the reference label EXACTLY — never re-letter, translate, enlarge or garble it; small German pack text stays soft and unreadable` });
        }catch(e2){
          onProg('📦 compositing failed — v1 single-pass fallback…');
          still = await callGemini({ prompt:sp, productImgs:packRefs, styleImgs:anchors,
            render:'photoreal', model:'gemini-3-pro-image-preview', apiKey:opts.apiKey, aspectRatio:opts.aspectRatio });
        }
      } else {
        still = await callGemini({ prompt:sp, productImgs:refs, styleImgs:anchors,
          render:'photoreal', model:'gemini-3-pro-image-preview', apiKey:opts.apiKey, aspectRatio:opts.aspectRatio });
      }
      stillOk = true;
    }catch(e){ /* fall back to animating the raw packshot rather than failing the scene */ }
    // STEP 2 — animate the still (motion only)
    let prompt = buildScenePrompt(opts);
    if(stillOk) prompt += ' The supplied image IS the finished opening frame of this scene — composition, product and caption are final; add MOTION only, never redraw or re-letter anything.';
    if(opts.oneUp && !opts.scene){   // one-up ONLY for single-image animate flow — an approved storyboard scene is already the locked creative
      const bans = [...GLOBAL_BAN, ...((SKUS[opts.sku]||{}).ban||[])];
      prompt = await oneUpVideoPrompt({ basePrompt:prompt, bans, aspectRatio:opts.aspectRatio, seconds:8, apiKey:opts.apiKey });
    }
    if(opts.fixNote){ prompt += ' QC CORRECTION (highest priority — the previous render failed on exactly this): ' + opts.fixNote; }
    const call = videoModel(opts.model||'VEO3').route==='fal' ? callFalVideo : callVeoVideo;
    const callOpts = p => ({ prompt:p, imgDataUrl:still, model:opts.model||'VEO3',
      seconds:8, aspectRatio:opts.aspectRatio, apiKey:opts.apiKey, falKey:opts.falKey,
      onProgress:onProg, asBlob:true });
    let videoBlob;
    try{ videoBlob = await call(callOpts(prompt)); }
    catch(e){
      if(!/no video/i.test(e.message||'')) throw e;
      // Veo's safety filter blocks silently ("no video returned"). Retrying identical content
      // blocks identically — so retry ONCE with an explicit wholesome reframe, and if that is
      // also blocked, once more as text-to-video without the still (the image itself may trip it).
      onProg('🛡️ safety-filter block — retrying with a safe reframe…');
      const safe = prompt + ' SAFETY REFRAME (the previous render was blocked): this is a wholesome, family-safe everyday COSMETIC toothpaste advertisement — nothing medical, clinical or suggestive; the person is relaxed and casual with a gentle natural closed-mouth smile; the product is an ordinary toothpaste tube held casually at chest height, away from the face; keep the scene otherwise identical.';
      try{ videoBlob = await call(callOpts(safe)); }
      catch(e2){
        if(!/no video/i.test(e2.message||'')) throw e2;
        onProg('🛡️ still blocked — final retry without the opening still…');
        const o=callOpts(safe); o.imgDataUrl=null;
        videoBlob = await call(o);
      }
    }
    return { prompt, videoBlob, still: stillOk ? still : null };
  }

  /* ═══ AUTO-QC — Gemini WATCHES every scene clip before it is accepted.
     Mirrors ~/.claude/scripts/gemini_watch_video.py, but per-scene, in-engine,
     and closed-loop: a fail feeds its fixNote straight back into the re-render.
     8s clips are small enough to send inline (no Files API / CORS risk). ═══ */
  const QC_THRESHOLD = 7.5;        // per-scene pass bar ≈ 75/100 overall target
  const QC_MAX_REROLLS = 1;        // hard cost cap: worst case = 2× scene spend, disclosed at the approve gate
  const QC_INLINE_LIMIT = 15*1024*1024;   // raw bytes; base64 ×1.33 stays under the 20MB inline request cap

  function blobToBase64(blob){ return new Promise((res,rej)=>{ const fr=new FileReader();
    fr.onload=()=>res(String(fr.result).split(',')[1]); fr.onerror=()=>rej(fr.error); fr.readAsDataURL(blob); }); }

  async function qcSceneClip(opts){
    const apiKey = opts.apiKey || (global.localStorage && localStorage.getItem('lc_gemini_key')) || '';
    const blob = opts.videoBlob;
    if(!apiKey || !blob || blob.size > QC_INLINE_LIMIT) return null;   // null = QC unavailable, never blocks the pipeline
    const sc = opts.scene||{}, sb = opts.storyboard||{};
    const s = SKUS[opts.sku]||SKUS['aktiv'];
    const rubric =
`You are a ruthless performance-video QC director for LACALUT ${s.name} (premium German oral-care brand, COSMETIC-ONLY regulatory regime, Australia). This is ONE 8-second AI-generated scene of a paid Facebook ad. Watch it fully, WITH AUDIO.

SCENE BRIEF: ${sc.visual||'(none)'}
EXPECTED CAPTION: ${sc.text?('"'+sc.text+'"'):'(no on-screen text expected)'}
${sb.character?('CHARACTER LOCK: '+sb.character):''}
${sb.world?('WORLD LOCK — the scene MUST take place inside exactly this location: '+sb.world):''}

Score against every item:
1. PACK — real GERMAN pack, WHITE cap, front label facing camera, razor-sharp, real tall-slim proportions; never warped, melted, re-lettered, duplicated, flipped or rotated away; NO legible English health words on the pack.
2. TEXT — caption matches the expected wording, correctly spelled, not garbled; NO mirrored/reversed/doubled lettering anywhere (including reflections); no invented signage.
3. HUMANS — indistinguishable from a real filmed person: no uncanny faces, teeth or hands, no plastic skin, no morphing; if a character lock is given, it is EXACTLY that person.
4. MOTION — smooth and controlled; no morphing, warping, flicker or artefacts.
5. EFFECTS — fluids behave physically; NO glow/halo around the product.
6. AUDIO — ambience and music ONLY; ANY human vocal sound (speech, singing, humming, chatter) is a fail.
7. LEGAL — NO therapeutic or disease words visible or audible (treat, cure, clinically proven, gingivitis, periodontitis, plaque, statistics/percentages) in any VO, caption, overlay or invented graphic; only "fluoride" and "hydroxyapatite" may be named. EXEMPTION: the REAL German pack's own printed label text (e.g. "Parodontose-Schutz", "Festigt das Zahnfleisch") is pre-approved packaging and NEVER a legal issue — never fail or deduct for words printed on the physical pack itself.
8. WORLD — if a WORLD LOCK is given above, the scene visibly takes place inside THAT exact location (same set, surfaces, lighting mood, palette); a different or generic background is a major fail.

Be harsh: a real premium brand would only run this at 8+/10.
HARD CAPS (non-negotiable): if the pack's label text is garbled, invented, pseudo-lettered or degrades during motion at ANY moment, the score is capped at 4. If small white beads, pearls or droplet-strings appear anywhere, the score is capped at 5. If water emerges from an object with no natural source, the score is capped at 6.

Return ONLY valid JSON:
{"score": <0-10 overall, one decimal>, "legalFail": <true if ANY item-7 breach>, "issues": ["<max 5, most damaging first, each with a timestamp>"], "fixNote": "<ONE imperative sentence telling the video generator what to do differently on a re-render, targeting the single most damaging issue>"}`;
    try{
      const b64 = await blobToBase64(blob);
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+(opts.model||'gemini-2.5-flash')+':generateContent?key='+apiKey,
        { method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ contents:[{role:'user',parts:[{inlineData:{mimeType:'video/mp4',data:b64}},{text:rubric}]}],
            generationConfig:{ responseMimeType:'application/json', temperature:0.2 } }) });
      const data = await res.json();
      if(!res.ok) return null;
      const txt = (data.candidates?.[0]?.content?.parts||[]).map(p=>p.text).filter(Boolean).join('').replace(/```json|```/g,'').trim();
      const q = JSON.parse(txt);
      if(typeof q.score !== 'number') return null;
      return { score:Math.max(0,Math.min(10,q.score)), legalFail:!!q.legalFail,
               issues:Array.isArray(q.issues)?q.issues.slice(0,5).map(String):[], fixNote:String(q.fixNote||'') };
    }catch(e){ return null; }
  }

  /* Render a scene, QC it, and auto-reroll on fail — the QC verdict's fixNote
     is injected into the retry prompt so the second attempt targets the exact
     failure instead of rolling the same dice twice. Keeps the BEST attempt. */
  async function renderSceneQC(opts){
    const onProg = opts.onProgress||function(){};
    const threshold = opts.qcThreshold!=null ? opts.qcThreshold : QC_THRESHOLD;
    const maxRerolls = opts.qcMaxRerolls!=null ? opts.qcMaxRerolls : QC_MAX_REROLLS;
    let best = null, fixNote = null, attempts = 0;
    for(let a=0; a<=maxRerolls; a++){
      attempts++;
      const r = await renderScene({ ...opts, fixNote });
      onProg('🔍 QC-watching the clip…');
      const qc = await qcSceneClip({ videoBlob:r.videoBlob, scene:opts.scene, storyboard:opts.storyboard,
        sku:opts.sku, apiKey:opts.apiKey });
      const cand = { ...r, qc, attempts };
      if(!qc){ best = best||cand; break; }                    // QC unavailable — accept, never block
      // non-legal beats legal; then higher score wins
      if(!best || (best.qc && ((best.qc.legalFail && !qc.legalFail) || (best.qc.legalFail===qc.legalFail && qc.score>best.qc.score)))) best = cand;
      if(!qc.legalFail && qc.score >= threshold) break;       // passed — done
      if(a < maxRerolls){ fixNote = qc.fixNote || (qc.issues[0]||''); onProg('♻️ QC '+qc.score.toFixed(1)+'/10'+(qc.legalFail?' LEGAL FAIL':'')+' → auto re-roll…'); }
    }
    best.attempts = attempts;
    return best;
  }

  /* Final-ad QC — the stitched video through the same watcher, full-ad rubric. */
  async function qcFinalVideo(opts){
    const blob = opts.videoBlob;
    if(!blob || blob.size > QC_INLINE_LIMIT) return null;
    const sb = opts.storyboard||{};
    return qcSceneClip({ ...opts, scene:{ visual:'FULL '+((opts.totalSeconds||24))+'s ad — all scenes stitched with the single TTS narrator mixed over the top. ALSO judge: CONGRUENCE (the #1 check — do ALL scenes share ONE location, ONE person and ONE lighting/grade so it reads as a single continuous film? If it feels like separate clips taped together, cap the score at 6 and say so); is the narrator ONE consistent voice; do scene joins cut cleanly; does the ad work sound-off; does it end on pack + CTA ("'+(sb.cta||'')+'")', text:'' } });
  }

  async function renderStoryboard(opts){
    const sb = opts.storyboard, total = sb.scenes.length;
    const onScene = opts.onScene || function(){};
    const out = { scenes:[], cost:storyboardCostEstimate({scenes:total, model:opts.model}), qc:videoQCChecklist(), failedAt:null };
    let prevStill = null;   // each scene's finished still anchors the next — hard world continuity
    let worldStill = null;  // scene 1's still = the ad's WORLD ANCHOR; every later scene re-anchors
                            // to it so drift never accumulates down the still chain
    for(let i=0;i<total;i++){
      const sc = sb.scenes[i];
      try{
        onScene(i, total, '🎬 scene '+(i+1)+'/'+total+' starting…');
        const doQC = opts.qc !== false;
        const fn = doQC ? renderSceneQC : renderScene;
        const r = await fn({ sku:opts.sku, storyboard:sb, scene:sc, index:i, total,
          style:opts.style, model:opts.model, aspectRatio:opts.aspectRatio, refImgDataUrl:opts.refImgDataUrl, refImgs:opts.refImgs,
          apiKey:opts.apiKey, falKey:opts.falKey, oneUp:opts.oneUp, prevStill, worldStill,
          qcThreshold:opts.qcThreshold, qcMaxRerolls:opts.qcMaxRerolls,
          onProgress:m=>onScene(i,total,'scene '+(i+1)+'/'+total+' · '+m) });
        out.scenes.push({ ...sc, prompt:r.prompt, videoBlob:r.videoBlob, still:r.still||null, qc:r.qc||null, attempts:r.attempts||1 });
        prevStill = r.still || prevStill;
        if(!worldStill && r.still) worldStill = r.still;
      }catch(e){
        out.failedAt = i; out.error = e.message;
        return out;   // partial — paid scenes are never lost; UI offers a retry from scene i
      }
    }
    return out;
  }

  /* ═══ NARRATOR TTS — one consistent voice for the whole ad (Gemini TTS, same key).
     Veo generates each scene's audio independently, so per-scene spoken VO drifts
     between voices/accents. Scenes now render speech-free; ONE narrator reads every
     line via TTS and is mixed over the stitched video. ═══ */
  function pcmToWavBlob(b64, rate){ const bin=atob(b64); const n=bin.length;
    const buf=new ArrayBuffer(44+n); const dv=new DataView(buf);
    const ws=(o,str)=>{ for(let i=0;i<str.length;i++) dv.setUint8(o+i,str.charCodeAt(i)); };
    ws(0,'RIFF'); dv.setUint32(4,36+n,true); ws(8,'WAVE'); ws(12,'fmt '); dv.setUint32(16,16,true);
    dv.setUint16(20,1,true); dv.setUint16(22,1,true); dv.setUint32(24,rate,true); dv.setUint32(28,rate*2,true);
    dv.setUint16(32,2,true); dv.setUint16(34,16,true); ws(36,'data'); dv.setUint32(40,n,true);
    for(let i=0;i<n;i++) dv.setUint8(44+i,bin.charCodeAt(i));
    return new Blob([buf],{type:'audio/wav'}); }
  async function ttsLine(opts){
    const apiKey = opts.apiKey || (global.localStorage && localStorage.getItem('lc_gemini_key')) || '';
    if(!apiKey) throw new Error('No Gemini API key');
    const model = opts.model || 'gemini-2.5-flash-preview-tts';
    const desc = opts.voiceDesc || 'a warm Australian female voice, natural pace';
    const voiceName = /(\bmale\b|\bman\b|\bbloke\b|\bguy\b)/i.test(desc) && !/female|woman/i.test(desc) ? 'Puck' : 'Kore';
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+apiKey,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ contents:[{parts:[{text:`Speak as ${desc}. Australian English pronunciation. Delivery: bright, warm, UPLIFTING and smiling — energised with dynamic intonation, like sharing great news with a friend; never flat, never monotone. Read this ad line:\n${opts.text}`}]}],
          generationConfig:{ responseModalities:['AUDIO'], speechConfig:{ voiceConfig:{ prebuiltVoiceConfig:{ voiceName } } } } }) });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error?.message||('TTS HTTP '+res.status));
    const part = data.candidates?.[0]?.content?.parts?.find(p=>p.inlineData);
    if(!part) throw new Error('No audio returned');
    const rate = parseInt((/rate=(\d+)/.exec(part.inlineData.mimeType||'')||[])[1]||'24000');
    return pcmToWavBlob(part.inlineData.data, rate);
  }

  /* ═══ STITCH — concat N same-codec mp4s; optionally mix a per-scene narrator VO track ═══ */
  async function stitchScenes(ffmpeg, blobs, opts){
    opts = opts||{};
    const reencodeOnFail = opts.reencodeOnFail !== false;
    const names = [];
    for(let i=0;i<blobs.length;i++){ const n='s'+i+'.mp4'; names.push(n);
      await ffmpeg.writeFile(n, new Uint8Array(await blobs[i].arrayBuffer())); }
    await ffmpeg.writeFile('list.txt', new TextEncoder().encode(names.map(n=>"file '"+n+"'").join('\n')));
    let code = await ffmpeg.exec(['-f','concat','-safe','0','-i','list.txt','-c','copy','out.mp4']);
    if(code!==0 && reencodeOnFail){
      code = await ffmpeg.exec(['-f','concat','-safe','0','-i','list.txt','-c:v','libx264','-preset','ultrafast','-crf','23','-c:a','aac','-movflags','+faststart','out.mp4']);
    }
    if(code!==0) throw new Error('Stitch failed (ffmpeg exit '+code+')');
    let final='out.mp4';
    const vo=(opts.voBlobs||[]).filter(Boolean);
    // MUSIC LOCK — one continuous soundtrack for the whole ad (scenes render music-free;
    // per-scene Veo music is roulette, exactly like the voices were)
    let hasMusic=false;
    if(opts.musicBlob){ try{ await ffmpeg.writeFile('music.wav', new Uint8Array(await opts.musicBlob.arrayBuffer())); hasMusic=true; }catch(e){} }
    if(vo.length===blobs.length){
      try{
        const secs=String(opts.secondsPerScene||8);
        for(let i=0;i<vo.length;i++){
          await ffmpeg.writeFile('v'+i+'.wav', new Uint8Array(await vo[i].arrayBuffer()));
          await ffmpeg.exec(['-i','v'+i+'.wav','-af','apad','-t',secs,'p'+i+'.wav']);   // pad each line to its exact 8s scene slot
        }
        const ins=[]; vo.forEach((_,i)=>{ ins.push('-i','p'+i+'.wav'); });
        await ffmpeg.exec([...ins,'-filter_complex', vo.map((_,i)=>'['+i+':a]').join('')+'concat=n='+vo.length+':v=0:a=1[vo]','-map','[vo]','vo.wav']);
        let mc=1;
        if(hasMusic){   // ambience ducked hard + one music bed + narrator on top
          mc = await ffmpeg.exec(['-i','out.mp4','-i','vo.wav','-i','music.wav','-filter_complex','[0:a]volume=0.10[amb];[2:a]volume=0.35[mus];[amb][mus][1:a]amix=inputs=3:duration=first:normalize=0[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','final.mp4']);
        }
        if(mc!==0) mc = await ffmpeg.exec(['-i','out.mp4','-i','vo.wav','-filter_complex','[0:a]volume=0.12[bg];[bg][1:a]amix=inputs=2:duration=first:normalize=0[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','final.mp4']);   // bg ducked hard — stray Veo voices must never compete with the narrator
        if(mc!==0) mc = await ffmpeg.exec(['-i','out.mp4','-i','vo.wav','-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','final.mp4']);   // no ambience track — VO only
        if(mc===0) final='final.mp4';
      }catch(e){ /* narrator mix failed — ship the plain stitch rather than nothing */ }
    } else if(hasMusic){
      try{   // no narrator — still lay the one continuous bed under the ambience
        const mc = await ffmpeg.exec(['-i','out.mp4','-i','music.wav','-filter_complex','[0:a]volume=0.15[amb];[1:a]volume=0.35[mus];[amb][mus]amix=inputs=2:duration=first:normalize=0[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','final.mp4']);
        if(mc===0) final='final.mp4';
      }catch(e){}
    }
    const data = await ffmpeg.readFile(final);
    try{ for(const n of names) await ffmpeg.deleteFile(n); await ffmpeg.deleteFile('list.txt'); await ffmpeg.deleteFile('out.mp4'); if(final!=='out.mp4') await ffmpeg.deleteFile('final.mp4'); }catch(e){}
    return new Blob([data.buffer||data], {type:'video/mp4'});
  }

  global.LacalutEngine = {
    BRAINS, SKUS, MODES, GLOBAL_BAN, DEFAULT_GUIDES, GUIDE_SECTIONS,
    getGuide, pickStr, pickRand,
    resolveBrain, brainUsesProduct, pickBrainForCategories,
    buildPrompt, buildMultiPrompt, callGemini, generateImage, editImage, dataUrlToInlinePart,
    oneUpImagePrompt,
    sanitizeCopy, sanitizeHashtags, hasBannedTerm,
    VIDEO_MODELS, VIDEO_ASPECTS, VIDEO_DURATIONS, VIDEO_STYLES, VIDEO_TYPES,
    videoModel, videoStyle, getVideoModel, setVideoModel, videoCostEstimate, videoQCChecklist,
    buildVideoPrompt, callVeoVideo, callFalVideo, oneUpVideoPrompt, generateVideo,
    sanitizeStoryboard, generateStoryboard, lintStoryboard, buildScenePrompt, storyboardCostEstimate,
    renderScene, renderStoryboard, stitchScenes, ttsLine,
    qcSceneClip, renderSceneQC, qcFinalVideo, QC_THRESHOLD, QC_MAX_REROLLS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.LacalutEngine;

})(typeof window !== 'undefined' ? window : globalThis);
