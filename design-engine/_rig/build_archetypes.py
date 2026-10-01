# build_archetypes.py — convert extracted winner-ad layouts into layout-archetypes.js
# Pipeline: drop winner images in winner-ads/raw  ->  node extract_layouts.mjs  ->  python build_archetypes.py
# New extractions get an auto-slug; curate NAMES below to rename or exclude (absent key = auto-included).
import json, os, re

all_ = json.load(open('winner-ads/layouts/_all-layouts.json', encoding='utf-8'))

# curated names: first-6-digits-of-library-id -> (slug, display name). None = EXCLUDE (near-dupe/junk).
NAMES = {
 '105468': ('steps-price-stack', 'Steps + Price Stack'),
 '107617': ('bundle-basket-hero', 'Bundle Basket Hero'),
 '109441': ('howto-panel-diagram', 'How-To Panel Diagram'),
 '109478': ('bold-editorial-hook', 'Bold Editorial Hook'),
 '138330': ('angled-type-product-row', 'Angled Type + Product Row'),
 '139879': ('gradient-collage-promo', 'Gradient Collage Promo'),
 '148666': ('left-column-styled-hero', 'Left Column + Styled Product'),
 '159769': ('problem-crush-splash', 'Problem-Crush Splash Hero'),
 '168889': ('quote-testimonial-card', 'Quote Testimonial Card'),
 '176645': ('comic-strip-story', 'Comic-Strip Story'),
 '177572': None,  # near-dupe of comic-strip-story
 '179769': ('clean-stacked-clusters', 'Clean Stacked Clusters'),
 '196704': ('mechanism-infographic', 'Mechanism Infographic'),
 '197465': None,  # near-dupe of quantity-comparison-split
 '200713': ('postit-flatlay', 'Post-It Flat-Lay'),
 '247958': ('quantity-comparison-split', 'Buy X vs Get Y Split'),
 '252002': ('classic-offer-poster', 'Classic Offer Poster'),
 '334828': ('fanned-lineup-offer', 'Fanned Line-Up + Offer Stack'),
 '923659': ('comic-reveal-banner', 'Comic Reveal + Offer Banner'),
}

out = []
seen = set()
for j in all_:
    m = re.search(r'(\d{6})', j['id'])
    key = m.group(1) if m else j['id'][:6]
    cur = NAMES.get(key, 'auto')
    if cur is None: continue
    if cur == 'auto':
        slug = re.sub(r'[^a-z0-9]+', '-', (j.get('styleFamily','layout') + '-' + key)).strip('-')
        name = (j.get('styleFamily','Layout').replace('-', ' ').title() + ' ' + key)
    else:
        slug, name = cur
    if slug in seen: continue
    seen.add(slug)
    out.append({'id': slug, 'name': name,
        'source': 'meta-ad-library winner (long-running active ad)',
        'canvasRatio': j.get('canvasRatio'), 'styleFamily': j.get('styleFamily'),
        'gridDNA': j.get('gridDNA'), 'zones': j.get('zones'),
        'typeScale': j.get('typeScale'), 'colourBlocking': j.get('colourBlocking'),
        'hierarchy': j.get('hierarchy'), 'negativeSpace': j.get('negativeSpace'),
        'eyePath': j.get('eyePath'), 'whyItWins': j.get('whyItWins'),
        'productPresence': j.get('productPresence'), 'humanPresence': j.get('humanPresence'),
        'textDensity': j.get('textDensity')})

js = ('/* layout-archetypes.js — LAYOUT-ARCHETYPE LIBRARY (Phase 4 #3, built 01/10/2026)\n'
      '   Structural skeletons reverse-engineered from PROVEN long-running Meta winner ads.\n'
      '   Layouts are not copyrightable; all CONTENT (brand, product, copy, imagery) is ours.\n'
      '   Extractor: _rig/extract_layouts.mjs  ·  Raw winners: _rig/winner-ads/\n'
      '   To grow the library: drop new winner images in _rig/winner-ads/raw, run the extractor,\n'
      '   re-run _rig/build_archetypes.py. */\n'
      'window.LAYOUT_ARCHETYPES = ' + json.dumps(out, indent=1, ensure_ascii=False) + ';\n')
open('../layout-archetypes.js', 'w', encoding='utf-8').write(js)
print(len(out), 'archetypes -> layout-archetypes.js')
