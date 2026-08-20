# LACALUT Scalable-Lite Design Engine — BUILD SPEC

Owner: Desi. Built by: Claude Code. Consumers: Soshi (social), Facy (FB ads).
Goal: light, cheaper in-house clone of scalable.so — clean product image + brief → on-brand creative.

## Decisions locked
- Model: **Gemini 2.5 Flash Image (nano-banana)** — real product image as reference per call.
- Reference = **few-shot curation**, not training: 2–4 hand-picked refs per job, not bulk.
- Roster = **5 SKU tabs**: Aktiv · Aktiv Herbal · Flora · Sensitive · White & Repair.
- Palette keyed by **variant × product line** (Flora flips navy↔green; White flips white↔silver).
- v1 image-types (Option B, social first): **Social Posts** → then Ad Creatives → Listing Images.
- Cut-over: pull social onto engine first; keep Scalable for premium heroes until parity.

## Architecture (reuse existing repo)
- Location: new page `design-engine/` in `lacalut-australia.github.io`.
- Reuse `facebook-image-ads/` → 5-tab SKU shell + brand brains + 🔑 Keys.
- Reuse `social-content-calendar/` → Gemini image-gen + 2 reference libraries (Option A).
- New: image-type selector + product-image upload + brand-guide injection + QC score.

## RULES layer status
- ✅ 5 brand guides written → `C:\Users\conta\LACALUT Style Library\00-brand-kits\<sku>\brand-guide.md`
- ⏳ Reference library: 181 candidates staged; gold set to be curated (Desi picks → Quan approves).

## FEATURE LOG (from Quan's Scalable screenshots)
### F1 — Brand Kits page
- Scalable ref: `scalable.so/brand-kits` — "lock visual identity so every image stays cohesive/on-brand/premium".
- Our version: a Brand Kits screen listing the 5 SKU kits (each = its brand-guide.md), status Ready, edit-in-place.
- Note: Scalable groups by product (Mouthwash kit=1, Aktiv Original kit=5); we group by the 5 SKU tabs.

### F2 — "What will you create today?" (image-type menu)
- Scalable ref: 7 types — Listing Images, Main Images, A+ Content, Ad Creatives, Social Posts, Translations, Variations.
- Our v1: Social Posts, Ad Creatives, Listing Images (rest = v2). Plus Image-audit scoring (v2).

### F3 — Products dashboard ("home")
- Scalable ref: `scalable.so` home — left nav (Products, Brand Kits, Strategy: Ask/Guardrails); per-product card = thumbnail + Conversion Drivers/Product Features/Conversion Blockers counts + "View Insights" + generated-thumbnail strip + "X generated / main / gallery" + **Listing score** + "Generate Images".
- Header stats: images generated · last generated · products covered · ROI line ("8-person studio / hours / $ saved").
- Add product: Import from Amazon / Add manually (Shopify/Walmart/marketplaces).
- Our version: SKU list = the 5 kits; per-SKU card shows generated count + our QC score + "Generate". Add-product = pull from Shopify (not Amazon).
- ⚠️ COMPLIANCE: Scalable scraped Amazon titles carry "Treats Gingivitis" / "Gum Disease 3 Pack" — our engine must NEVER inherit disease-claim titles. Strip to "gum care".

### F4 — Generation Studio ⭐ (the core engine screen)
Scalable ref: `.../studio/.../main-image`. Left = Generation settings, right = output grid.

**Left panel — Generation settings:**
- UPLOAD PRODUCT PHOTOS: multi-slot (3 shown), per-photo ON/OFF toggle + thumbs-up, "X/Y ACTIVE", "+ More slots". These are the REAL product references fed to the model.
- SELECT THE STRATEGY (max 8): the style/template chips — **this IS our template catalogue**:
  Scalable Original · TOS Compliant · Hang Tags · Trust/Benefits Badges · Exploded Reveal ·
  Premium Platform · Benefit First · Detail Hero · Color & Contrast Pop · Packaging Hero ·
  Trust/Proof On Pack · Kit/All Included · Open/Revealed State · In-Use State · Quantity/Multi-Pack ·
  Ingredient/Contents Reveal · Scale/Size Reference · Lifestyle Context · Emotional Proposition ·
  Freshness/Quality Reveal · Outcome Transformation.
- QTY (1/2/3) · FORMAT (dropdown: Squared 1:1, +4:5/9:16 for us) · RESOLUTION (1K/2K).
- MODEL toggle: OpenAI vs Gemini → we default **Gemini** (cheap).
- Generate button → fills output grid.

**Right panel — output grid:** generated variants each labelled by strategy (TOS, Hang Tags, Platform, Lifestyle…) + the Original. Download per image.

Our v1 build = this screen, wired to: active SKU brand-guide + selected strategy template(s) + uploaded product photo(s) → Gemini → grid → Desi QC score.
Reference library (staged gold set) supplies 1–2 style refs per chosen strategy.

### F5 — Image-type switcher (studio mode dropdown)
Scalable ref: top-of-studio "Main Images ▼" dropdown swaps the whole mode. Options:
Listing Images · Main Images · A+ Content · Seamless · A+ Content · Sections · Ad Creatives ·
Social Posts · Translations ↗ · Variations ↗.
- Switching mode changes the available strategy chips + output format/spec.
- Our v1 modes: **Social Posts · Ad Creatives · Listing Images** (A+/Translations/Variations = v2).
- "Global Instructions" link (top-right) = per-mode standing instructions → maps to our brand-guide injection.

### F6 — Advanced settings + reference-photo rating
- Per uploaded product photo: **👍/👎 rating** + ON/OFF (thumbs-down keeps it but down-weights). We mirror: rate which refs the model leans on.
- Strategy list collapses to 8 + "**+15 more**" expander (full 21 already in F4).
- "**ADVANCED SETTINGS**" collapsible panel — 3 toggles: **Additional Instructions** · **Own Direction** · **Negative Prompt** (negative prompt = our compliance guardrail: ban "gingivitis/periodontitis/halitosis/bleeding gums" tokens by default).
- Model toggle confirmed: OpenAI ↔ **Google/Gemini** (Gemini = our default).
- Helper: "Select at least one strategy to generate."
- ⚠️ COMPLIANCE (seen live): Aktiv Herbal outputs rendered "FOR GINGIVITIS", "STOPS GUM BLEEDING", product name "Gingivitis Toothpaste". Our engine's brand-guide + a QC gate MUST strip all gingivitis/gum-disease claims before any output ships.

### F7 — Semantic upload slots + output favouriting
- Upload slots are ROLE-labelled: **Main · Angle · Detail** (+ More slots). We mirror: named ref roles so the model knows front vs angle vs macro.
- "💡 **How to make product appear accurate**" helper link (guidance on faithful product reproduction) → we add our own "real packshot, never redraw" tip.
- Output variant can be **❤️ favourited** (red heart + red border = selected/keeper). We mirror: Desi marks keepers → feeds the QC/gold loop.
- Resolution supports **2K** (not just 1K).
- ⚠️ COMPLIANCE (seen live): Flora original = "Halitosis Toothpaste… Reverses The Condition of Severe Bad Breath" — disease claim. Engine must never reproduce "halitosis/reverses the condition". Use "bad breath / fresh breath".

### F8 — Listing/Gallery mode (multi-slot + editor + copy)
Scalable ref: `.../listing`, "Gallery Image Slot". Adds 4 new capabilities:
1. **Multi-slot gallery** — numbered slots `01–08 +` across the top (a full listing set) + "**Generate all slots**" + "**Export**". Each slot (PT01, PT02…) = a DISTINCT image concept with its own style (e.g. PT01 "Stops Gum Bleeding", PT02 "Heals Gums at the Source" via T/clean). Format "Gallery 1:1" @ 1254×1254.
2. **SELECT THE STYLE** (not strategy here) — pick a saved brand-kit **Style** from a dropdown + "**+ CREATE NEW**" + saved-style bookmark + "Switch to legacy style references". This IS our brand-kit-as-style selector.
3. **EDIT COPY** (versioned, V1) — edit the on-image headline/claims per slot. ← critical control point for compliance (strip disease claims HERE).
4. **Inline image editor** (right toolbar): enhance · pen-edit · move · erase · text (T) · remove-text · magic-edit · crop · resize · HD/upscale. Fix a generated image without re-rolling.
- Extras: "**Liked only**" filter · "CONTENT STRATEGY" + "CONTENT BRIEF" tabs · per-generate **credit cost** shown (⚡6).
- ⚠️ COMPLIANCE (seen live): this listing rendered "STOPS GUM BLEEDING FAST", "PROTECTS AGAINST BLEEDING GUMS AND PERIODONTITIS", "PREVENTS GUM INFLAMMATION" — periodontitis ON-image. Our Edit-Copy + QC gate MUST strip these before export.

### F9 — Product-photo intake modal (onboarding)
Scalable ref: "To start… upload photos of your product." Gate before first generation.
- Upload grid up to **9 slots** (2–3 min, "add up to 9 for best accuracy"). Formats JPEG/PNG/WebP · 4MB.
- "**Add my Amazon main image**" shortcut → for us = **pull packshots from Shopify/Drive** (we have the real German packshots already).
- Guidance panel "**What great photos look like**": sharp/high-quality · clean contrasting bg · one product only · multiple angles. Example set: Front · Back · Open-angled · Detail · In-hand-for-scale · Worn · In-use. "Same product, same light, only the angle changes."
- Skip / Continue to Studio.
- Our version: intake modal seeded from our existing `_product-packshots/` bank per SKU; enforce the quality checklist.

### F10 — Fidelity warning + per-output prompt edit
- Coach-mark "**Product looks off? We only had your main listing image to work from. See how to fix this →**" — fires when too few reference angles uploaded → product fidelity drops. Reinforces F9 (2–3+ angles). For us: warn if only 1 packshot loaded for a SKU.
- Per-output "**Prompt**" edit (view/tweak the exact generation prompt behind a variant) + re-roll.
- Before/after slots can carry a ▶ reveal; output footer shows model · ratio · text-count (e.g. 5/5) · style · date.

### F11 — Agentic Data / Strategy layer (from public site crawl)
Scalable's real pipeline: Enter product → **Agentic Data Workflow** → Brand Kit → Generate → Export.
- Agentic Data (reads up to 500 reviews): **Product Features** (ranked), **Review Insights** (traced to source review + reliability score), **Conversion Drivers** (pre/post-purchase motivators). = the "conversion blockers/drivers" seen on the dashboard.
- Brand Kit stores: display/body fonts · mood board refs · **brand voice tone** (Playful/Bold/Punchy/Direct) · HEX palette. (Our brand-guide already covers this.)
- Our version: seed Strategy from LACALUT reviews + product-enrichment (v2); v1 can hardcode the proven angles per SKU.

### Canonical output dimensions (use these exact specs)
| Type | Dimensions | v1? |
|---|---|---|
| Social post | 1080×1350 (4:5) | ✅ |
| Meta ad | 900×1600 (9:16) | ✅ |
| Amazon/listing | 1080×1080 (1:1) | ✅ |
| Shopify banner | 1600×900 / 2100×900 | v2 |
| PPC ad | 1280×720 | v2 |
| A+ content | 1472×3600 | v2 |

Pricing ref: Scalable Free = 300 credits / 90 days (why we self-host on Gemini instead).

## SPEC STATUS: COMPLETE (F1–F11). Ready to build v1 Social Posts engine.
