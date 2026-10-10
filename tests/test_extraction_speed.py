import time
import sys
from pathlib import Path

sys.path.insert(0, str(Path("scripts").resolve()))
from sync_timetable import load_env, extract_timetable_with_gemini
load_env()

img_path = Path("scripts/.cache/latest_4_BINF.png")
if not img_path.exists():
    print("Immagine non trovata in", img_path)
    sys.exit(1)

start = time.time()
print("Inizio estrazione visiva con gemini-3.5-flash-lite...")
data = extract_timetable_with_gemini(
    str(img_path),
    class_name="4 BINF",
    main_model="gemini-3.5-flash-lite",
    fallback_model="gemini-3.8-flash",
    scan_mode="single"
)
dur = time.time() - start
print(f"Estrazione completata in {dur:.2f} secondi!")
print("Classe:", data.get("classe"))
print("Data decorrenza:", data.get("data_decorrenza"))
print("Numero giorni:", len(data.get("giorni", [])))
for g in data.get("giorni", []):
    print(f" - {g.get('giorno')}: {len(g.get('lezioni', []))} ore")
