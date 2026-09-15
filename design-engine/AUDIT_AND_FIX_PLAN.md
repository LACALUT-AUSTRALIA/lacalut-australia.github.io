# Design Engine — Image Audit & Fix Plan
_Owner: Desi · Engine Coder session. Created 15/09/2026. Continue from here after /clear._

## Context
Audited all **147** generated images in the gallery (IndexedDB `lacalut_de` → store `gens`), per SKU.
Coverage: Aktiv 57 · Multi 25 · White&Repair 25 · Flora 18 · Sensitive 12 · **Aktiv Herbal 10 (thinnest)**.

## Already fixed this session (do NOT redo — all committed)
- SKU Angle Lock (no cross-SKU angle bleed) · Before/After teeth-whitening guard on non-whitening SKUs
- Per-SKU Formula Elements (editable Brand Guide section + prompt lock: herbs=Herbal only, zinc=Flora, etc.)
- Chat brain made SKU-neutral (was hardcoded to Aktiv gum-care) · Chat slim single-line header (bigger bubble text)
- Badge shape consistency (same shape within an image) · Multi-SKU form selector + explicit form-lock (no mixed tube/box, no tube hallucination)
- Contrast both-ways (no white-on-pale) · Title Case sub-headers · two-colour headline/sub · named-enemy hooks (W&R/Flora/Sensitive)
- Save/load Presets feature

## HOLES FOUND (to fix next) — prioritised

### P1 🔴 SKU-TAB LOCK GUARDRAIL (Quan's request — highest leverage, CODE)
Problem: images/formulas end up under the wrong SKU tab (e.g. a Flora card in the Aktiv tab; Aktiv Original rendered with herbs "X herb extracts").
Fix in code (index.html / engine.js):
- When a SKU tab is active, generation is HARD-LOCKED to that SKU: kit, brand guide, formula elements, product refs, AND the saved `rec.sku` all derive from the active tab. No path to produce another formula while on a SKU tab.
- `runGenerate` (single-SKU branch): assert `rec.sku === curSku`; never let curSku drift from the visible tab.
- Fix `renderGallery(sku)` so each tab shows ONLY that SKU's cards (verify idbBySku filter; a Flora card must not appear under Aktiv).
- Investigate: programmatic curSku sets (automation) may have mislabeled saves — ensure pickSku is the only way to change SKU, or that gen reads the active tab, not a stale var.

### P2 🔴 COMPLIANCE SWEEP of existing images (generation lane, but flag)
Old cards have BANNED therapeutic text baked in — real breaches:
- Aktiv Herbal: "Reduces Bleeding", "Soothes Irritation" (both on GLOBAL_BAN)
- "healthy gums" / disease-adjacent wording on some Herbal cards
Action: identify offenders (visual), DELETE or regenerate with current compliant brain. These must not go live.

### P3 🟡 Old cross-SKU-bleed cards remain (code fixed, images not)
- Sensitive chat: "gums feel super firm + major stain lift" (Aktiv + W&R on Sensitive)
- Aktiv Original: "X herb extracts" + herbs (Herbal bleed)
- Flora: an old whitening Before/After ("Month 1 stains → Month 6 brighter smile")
Action: delete/regenerate these specific old cards (code now prevents new ones).

### P4 🟡 Coverage gaps (generation lane)
- Aktiv Herbal thin (10, mostly Exploded Reveal) — needs Benefit First, Trust/Proof, Lifestyle, Chat, Problem-vs-Solution.
- Sensitive thin (12, mostly Chat) — needs more Sales/format diversity.
- Build a balanced SKU × strategy × format matrix so every SKU has even coverage.

### P5 🟡 Product reference angles (data)
Several SKUs show "Only 1 angle — fidelity may drop". Upload 2–3 packshot angles per SKU (Main/Angle/Detail) for better product fidelity.

### P6 🟢 Low priority
- Garbled tube fine-print / doubled wordmark — accepted for FB feed, skip.
- Text-overlay architecture: engine currently BAKES headline text; Quan's stated direction is AI-imagery + editable text overlay layer (Facy building). Bigger architectural decision — revisit later.

## Next action after /clear
Start with **P1 (SKU-tab lock guardrail)** — it's code, my lane, and the root guardrail Quan asked for. Then P2/P3 cleanup (coordinate with a generation session — this Code session owns code only, per [[feedback_design_engine_code_owner_session]]).
