#!/usr/bin/env python3
"""Rebuild BOARD.md from the header of every features/*/SIGNOFF.md.

Run from the repository root:  python3 scripts/make_board.py
(If the repo has no scripts/ folder yet, copy this file there.)
Status lives only in each SIGNOFF.md header. BOARD.md is generated; never edit it by hand.
"""
import pathlib, re, sys

ORDER = ["Ready", "Building", "Testing", "Done"]
root = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")

def header(path):
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.S)
    out = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                out[k.strip()] = v.strip()
    return out

rows = {s: [] for s in ORDER}
unknown = []
for f in sorted((root / "features").glob("*/SIGNOFF.md")):
    h = header(f)
    item = (h.get("id", f.parent.name.split("-")[0]), h.get("name", f.parent.name), h.get("updated", ""), f.parent.name)
    status = h.get("status", "")
    (rows[status] if status in rows else unknown).append(item)

lines = ["# Board", "", "Generated from the header of each `features/*/SIGNOFF.md`. Do not edit by hand.", ""]
for s in ORDER:
    lines.append(f"## {s}")
    if rows[s]:
        for i, name, upd, folder in rows[s]:
            lines.append(f"- {i} {name} (updated {upd}) - `features/{folder}/`")
    else:
        lines.append("- none")
    lines.append("")
if unknown:
    lines.append("## Needs a valid status")
    for i, name, upd, folder in unknown:
        lines.append(f"- {i} {name} - `features/{folder}/`")
    lines.append("")
(root / "BOARD.md").write_text("\n".join(lines), encoding="utf-8")
print("BOARD.md updated")
