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
      say:'gum care, firms and tightens the gum line, "Bleeding Stops. Gums Feel Firm Again."',
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
      say:'for sensitive teeth, soothes sensitivity, calms cold twinges',
      ban:['pain relief','pain-free cure','therapeutic'] },
    'white-repair': { name:'White & Repair', dot:'#8a8f98', accent:'#CF102D',
      palette:'TOOTHPASTE = bright white + red headline pill #CF102D; MOUTHWASH = silver/platinum grey; navy #004A88 headers',
      props:'white enamel stones, subtle diamond/sparkle, bright clean light, water splash',
      voice:'clinical whitening, never bleach-luxury',
      say:'removes surface stains, supports natural whiteness, protects and repairs enamel',
      ban:['peroxide','bleach'] }
  };
  const GLOBAL_BAN = ['gingivitis','periodontitis','gum disease','halitosis','reverses the condition','graphic bleeding gums close-up'];

  const MODES = {
    'social':  { label:'Social Post', dims:'1080×1350', ar:'4:5 portrait' },
    'ad':      { label:'Meta Ad',     dims:'900×1600',  ar:'9:16 vertical' },
    'listing': { label:'Listing',     dims:'1080×1080', ar:'1:1 square' }
  };

  /* ═══ EDITABLE BRAND GUIDES (per-SKU pools) ═══ */
  const DEFAULT_GUIDES = {
   'aktiv':{ colours:'Dominant brand red #CF102D + navy #004A88 + soft light-blue #DDEBF7 backgrounds with #4C97C9 icon circles',
     backgrounds:['clean bright white studio background, soft shadow, minimal premium look','deep navy-blue gradient with subtle molecular hex pattern and soft glow','bold LACALUT red gradient fading to dark maroon, faint hex texture, premium','soft light-blue clinical backdrop, water splash, white hydroxyapatite/mineral rocks','dark maroon-to-red radial gradient, dramatic clinical mood, particle sparkle','airy white-to-pale-blue gradient, fresh clinical feel, reflective floor'],
     usps:['Firms & tightens the gum line','Kills the bacteria behind gum problems','12h long-lasting protection'],
     headlines:['Bleeding Stops. Gums Feel Firm Again.','Stops Gum Bleeding Fast','Firm, Healthy Gums'],
     subheadlines:['Clinical Formula for Tight & Strong Gums','Notice Results From Day One','The German Standard of Gum Care'],
     benefits:['Tightens Gum Tissue','Strengthens Gums','Closes Gum Pockets','Reduces Irritating Plaque','12h Protection'],
     trust:['Made in Germany','Pharmacy Grade','100+ Years Expertise','Clinically Tested','Dermatologically Tested'] },
   'aktiv-herbal':{ colours:'Herbal green #2E7D46 / #7CB342 dominant, red #CF102D on logo & result pill only, navy #004A88 headers',
     backgrounds:['clean white studio background, soft natural shadow','deep forest-green gradient with botanical silhouettes and soft light','lush botanical scene, fresh herbs and green leaves, natural daylight','soft sage-green gradient with dew and leaf accents','dark green-to-emerald gradient, premium herbal mood'],
     usps:['9 valuable natural herbs','Natural gum care with clinical results'],
     headlines:['Nature’s Answer to Firm, Healthy Gums','Stops Gum Bleeding — Naturally'],
     subheadlines:['9 Medicinal Herbs · German Formula','Aromatherapy Brushing Experience'],
     benefits:['Soothes Irritation','Reduces Bleeding','Tightens Gums','9 Herb Extracts'],
     trust:['9 Natural Herbs','Made in Germany','Pharmacy Grade','Dermatologically Tested'] },
   'flora':{ colours:'TOOTHPASTE navy #004A88 + citrus-yellow; MOUTHWASH fresh green #2E9E5B; red #CF102D on logo/pill only',
     backgrounds:['clean white studio background, minimal fresh look','deep navy-blue gradient with water ripples and hex pattern','fresh green gradient (mouthwash) with mint leaves and splash','bright citrus-fresh scene, lemon and ice accents, airy','cool blue-to-teal gradient, crisp hygienic mood'],
     usps:['Eliminates bad breath at the source','Balances the oral microbiome','Works within 48 hours'],
     headlines:['Fresh Breath That Lasts','Clean Breath in Just 3 Days'],
     subheadlines:['Eliminates Odour at the Source','Probiotic Fresh-Breath Formula'],
     benefits:['Fights Bad Breath','Balances Oral Flora','Long-Lasting Freshness','Gentle Daily Care'],
     trust:['Made in Germany','Pharmacy Grade','12h Long-Lasting','Clinically Tested'] },
   'sensitive':{ colours:'Teal #008490 / #0E6C7D dominant, red #CF102D on logo/pill only, navy #004A88 headers',
     backgrounds:['clean white studio background, soft calm shadow','soft teal-to-white gradient, gentle calm mood','deep teal gradient with subtle enamel/mineral texture','airy pale-blue and teal scene with ice and feather accents','dark teal radial gradient, premium clinical calm'],
     usps:['For sensitive teeth','Soothes cold & hot twinges','Gentle daily care'],
     headlines:['Enjoy Cold & Hot Again','From Sensitivity to Comfort'],
     subheadlines:['Gentle Care for Sensitive Teeth','Calms Everyday Sensitivity'],
     benefits:['Soothes Sensitivity','Builds a Protective Barrier','Extra-Gentle Cleaning','Long-Lasting Comfort'],
     trust:['Made in Germany','Pharmacy Grade','Dermatologically Tested','Gentle Formula'] },
   'white-repair':{ colours:'TOOTHPASTE bright white + red headline pill #CF102D; MOUTHWASH silver/platinum grey; navy #004A88 headers',
     backgrounds:['clean bright white studio background, sparkle highlights','silver/platinum gradient, clinical premium sheen','deep navy gradient with diamond sparkle and enamel stones','soft white-to-silver gradient, bright airy whitening feel','cool grey studio with reflective floor and light burst'],
     usps:['Removes surface stains','Protects & repairs enamel','No peroxide'],
     headlines:['Whiter, Stronger Teeth','Your Journey to White, Healthy Teeth'],
     subheadlines:['Gentle Whitening & Enamel Protection','Visible Results in 6 Months'],
     benefits:['Removes Surface Stains','Supports Natural Whiteness','Repairs & Protects Enamel','No Peroxide'],
     trust:['Made in Germany','Pharmacy Grade','Enamel-Safe','No Peroxide','Clinically Tested'] }
  };
  const GUIDE_SECTIONS = [['backgrounds','Background Styles (colour + scene — engine varies these)'],['usps','USPs'],['headlines','Main Headlines'],['subheadlines','Subheadlines'],['benefits','Benefits'],['trust','Trust Elements']];

  function getGuide(sku){
    try { const saved = global.localStorage && localStorage.getItem('de_guide_'+sku); if(saved){ return JSON.parse(saved); } } catch(e){}
    const d = DEFAULT_GUIDES[sku] || {};
    const toObj = a => (a||[]).map(t=>({text:t,on:true}));
    return { colours:d.colours||'', backgrounds:toObj(d.backgrounds), usps:toObj(d.usps), headlines:toObj(d.headlines), subheadlines:toObj(d.subheadlines), benefits:toObj(d.benefits), trust:toObj(d.trust) };
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

  /* ═══ PROMPT BUILD (DOM-free) ═══ */
  function buildPrompt(opts){
    const sku = opts.sku, mode = opts.mode || 'social', brain = opts.brain;
    const brief = (opts.brief || '').trim();
    const advNeg = opts.advNeg !== false;
    const useProd = opts.useProd;
    const s = SKUS[sku], m = MODES[mode], g = getGuide(sku);
    const bans = [...GLOBAL_BAN, ...s.ban];
    const salesLike = brain && ['Sales','Social Proof','Story'].includes(brain.cat);

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
    if(advNeg) p += `STRICT COMPLIANCE — never show or write any of these words/claims: ${bans.join(', ')}. `;
    p += `ALL overlay/design text — headline, labels, badges, captions — must be in ENGLISH (Australian English) ONLY; never German, never bilingual. (The product's own printed packaging text stays unchanged.) Keep it clean and uncluttered — no extra call-to-action stickers or badges unless specified. `;
    if(useProd){
      p += `Product packaging LARGE and dominant — lower ~55% as the clear hero. Prefer "Clinical Formula", never "Mineral Formula". `;
    } else {
      p += `Do NOT show any product packaging or tube. Brand the image with the LACALUT logo only (small, top-centre or a corner). `;
    }
    p += `${m.ar} aspect ratio, high-end premium finish, crisp legible typography, no spelling errors on any text.`;
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

    const pRefs=(opts.productImgs||[]).map(dataUrlToInlinePart).filter(Boolean).slice(0,3);
    const sRefs=(opts.styleImgs||[]).map(dataUrlToInlinePart).filter(Boolean).slice(0,3);
    let instr='';
    if(pRefs.length){
      const base=`The FIRST ${pRefs.length} reference image(s) show the EXACT LACALUT product — treat them ONLY as the source of truth for the product's branding: real packaging shape, label layout, colours, logo and exact wording. Keep every label word and logo accurate and legible; never invent, garble, mistranslate or alter the product text. `;
      const angle=`You have creative freedom over the product's ANGLE and composition — choose a fresh, dynamic, flattering hero angle (standing upright, three-quarter turn, tilted, or lying on a surface); it need NOT match the reference photo's angle. `;
      if(render==='exact') instr+=base+`Reproduce the product exactly as photographed — flat and unchanged. `;
      else if(render==='graphical') instr+=base+angle+`Render the product as a clean, glossy premium 3D CGI product render — dimensional form, studio lighting, crisp reflections, graphic-design ad aesthetic. `;
      else instr+=base+angle+`Render the product as a hyper-realistic photographic 3D studio product shot — realistic lighting, soft shadows, gentle reflections, depth and dimension, sitting believably in the scene. `;
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
    const useProd = (typeof opts.useProd==='boolean') ? opts.useProd : brainUsesProduct(brain);
    const prompt = buildPrompt({ sku, mode, brain, brief:opts.brief, advNeg:opts.advNeg, useProd });
    const aspectRatio = ((MODES[mode] && MODES[mode].ar) || '4:5').split(' ')[0];

    const url = await callGemini({
      prompt,
      productImgs: useProd ? (opts.productImgs||[]).filter(Boolean) : [],
      styleImgs:   useProd ? (opts.styleImgs||[]).filter(Boolean) : [],
      render, model: opts.model, apiKey: opts.apiKey, aspectRatio
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
    const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+apiKey,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ contents:[{role:'user',parts:[{text}, part, ...refs]}], generationConfig:{responseModalities:['TEXT','IMAGE']} }) });
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

  global.LacalutEngine = {
    BRAINS, SKUS, MODES, GLOBAL_BAN, DEFAULT_GUIDES, GUIDE_SECTIONS,
    getGuide, pickStr, pickRand,
    resolveBrain, brainUsesProduct, pickBrainForCategories,
    buildPrompt, callGemini, generateImage, editImage, dataUrlToInlinePart,
    sanitizeCopy, sanitizeHashtags, hasBannedTerm
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.LacalutEngine;

})(typeof window !== 'undefined' ? window : globalThis);
