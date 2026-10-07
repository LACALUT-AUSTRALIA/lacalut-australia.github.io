# -*- coding: utf-8 -*-
# Classify every ad for AICIS cosmetic-only compliance:
#   cleared    = on the approved compliant launch list (cleared_names.json) or an explicit compliant/cosmetic rebuild
#   flagged    = name/title/body hits a breach pattern (disease claim, therapeutic, before/after, competitor comparison)
#   unscreened = nothing detected
# Deterministic — safe to rerun in full on every refresh.
import json, re, os, unicodedata

SP = os.environ.get("MON_DIR") or os.path.dirname(os.path.abspath(__file__))

ads = json.load(open(os.path.join(SP, "ads_all.json"), encoding="utf-8"))
texts = json.load(open(os.path.join(SP, "ad_texts.json"), encoding="utf-8")) if os.path.exists(os.path.join(SP, "ad_texts.json")) else {}
cleared_raw = json.load(open(os.path.join(SP, "cleared_names.json"), encoding="utf-8"))

def norm(s):
    s = s.replace("Â·", "·").replace("â€“", "–").replace("â€”", "—").replace("â€™", "'")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if ord(ch) < 128)
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

cleared = {norm(n) for n in cleared_raw}
cleared |= {re.sub(r"\(.*?\)", "", c).strip() for c in list(cleared)}

# MANUAL BREACH LIST (flagged_names.json) — human review beats the automated copy scan.
# Each entry {"match": "<normalised name substring>", "why": "..."} flags every ad whose
# normalised name contains the substring, EVEN IF the name claims "(compliant)" or the
# copy scan found nothing (image/audio-level breaches the text scan can't see).
_fp = os.path.join(SP, "flagged_names.json")
flagged_manual = json.load(open(_fp, encoding="utf-8")) if os.path.exists(_fp) else []

def manual_flag(nm):
    for f in flagged_manual:
        if f["match"] in nm:
            return f["why"]
    return None

FLAG_PATTERNS = [
    (r"gum disease|gingivit|periodont|tooth loss|disease", "disease claim"),
    (r"bleed", "bleeding gums = therapeutic"),
    (r"\breced", "receding gums = therapeutic"),
    (r"infect|inflam|plaque bacteria kill", "therapeutic"),
    (r"\bheal(s|ing)?\b|\btreat(s|ment)?\b|\bcure", "treat/heal/cure"),
    (r"clinical(ly)?[ -]?(proven|standard|grade)|dentist[ -]recommended", "clinical/authority claim"),
    (r"week\s*1\s*vs\s*week\s*2|before\s*(/|and|&)?\s*after|\bin\s*\d+\s*(days|weeks)\b", "before/after result"),
    (r"colgate|sensodyne|oral[- ]?b|comparison", "competitor comparison"),
    (r"stops? (the )?(gum )?(decline|damage)|tighten(s|ing)? gums", "therapeutic efficacy"),
]

out = {}
counts = {"cleared": 0, "flagged": 0, "unscreened": 0}
for a in ads:
    nm = norm(a["name"])
    # manual human-review flags FIRST — they override the cleared list and name tags
    mf = manual_flag(nm)
    if mf:
        out[a["id"]] = {"c": "flagged", "why": mf}
        counts["flagged"] += 1
        continue
    # explicit compliant/cosmetic rebuilds are cleared by name
    if nm in cleared or re.sub(r"\(.*?\)", "", nm).strip() in cleared:
        out[a["id"]] = {"c": "cleared", "why": "approved winners list 03/10"}
        counts["cleared"] += 1
        continue
    text = (a["name"] + " " + texts.get(a["id"], "")).lower()
    hits = []
    for pat, label in FLAG_PATTERNS:
        if re.search(pat, text):
            hits.append(label)
    if hits and re.search(r"compliant|cosmetic", a["name"], re.I):
        out[a["id"]] = {"c": "cleared", "why": "compliant rebuild (name-tagged)"}
        counts["cleared"] += 1
    elif hits:
        out[a["id"]] = {"c": "flagged", "why": "; ".join(dict.fromkeys(hits))}
        counts["flagged"] += 1
    else:
        out[a["id"]] = {"c": "unscreened", "why": ""}
        counts["unscreened"] += 1

json.dump(out, open(os.path.join(SP, "compliance.json"), "w", encoding="utf-8"), ensure_ascii=False)
print(counts)
