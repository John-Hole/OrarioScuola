import re
import json
from pathlib import Path

res_path = Path("C:/Users/giova/.gemini/antigravity/brain/6ad6fe9f-82cf-4056-9bcd-185c01414807/.system_generated/steps/40/content.md")
gri_path = Path("C:/Users/giova/.gemini/antigravity/brain/6ad6fe9f-82cf-4056-9bcd-185c01414807/.system_generated/steps/52/content.md")

res_text = res_path.read_text(encoding="utf-8")
gri_text = gri_path.read_text(encoding="utf-8")

# Parse resources
# new Ressource ("grClasse","1 AC","c0000047");
res_pattern = re.compile(r'new\s+Ressource\s*\(\s*"grClasse"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)')
classes = {}
for m in res_pattern.finditer(res_text):
    name, code = m.groups()
    if code != "vide":
        classes[code] = {
            "name": name,
            "code": code
        }

# Parse grilles
# new Grille ("edc0000047p00001s3fffffffffffffff_1_ac_ac","grClasse","classi/edc0000047p00001s3fffffffffffffff_1_ac_ac.png",listeRenvois);
gri_pattern = re.compile(r'new\s+Grille\s*\(\s*"([^"]+)"\s*,\s*"grClasse"\s*,\s*"([^"]+)"')
for m in gri_pattern.finditer(gri_text):
    key, file_path = m.groups()
    code_match = re.search(r'(c\d+)', key)
    if code_match:
        c = code_match.group(1)
        if c in classes:
            classes[c]["file"] = file_path
            classes[c]["url"] = "https://cspace.spaggiari.eu/pub/PGIT0005/orario/" + file_path

# Add year helper
result = []
for c, item in classes.items():
    name = item["name"]
    year = 0
    if name[0].isdigit():
        year = int(name[0])
    item["year"] = year
    result.append(item)

# Sort by year and name
result.sort(key=lambda x: (x["year"], x["name"]))

out_path = Path("public/data/volta_classes.json")
out_path.parent.mkdir(parents=True, exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"Success! {len(result)} Volta classes written to {out_path}")
