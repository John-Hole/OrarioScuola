import os
import sys
from pathlib import Path
from google import genai

key = os.environ.get("GEMINI_API_KEY")
if not key:
    for p in [Path(".env"), Path("../.env")]:
        if p.exists():
            for line in p.read_text(encoding="utf-8").splitlines():
                if line.startswith("GEMINI_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip("'\"")
                    break

if not key:
    print("ERRORE: GEMINI_API_KEY non trovata!")
    sys.exit(1)

client = genai.Client(api_key=key)

print("=== VERIFICA API GEMINI ===")

# Test 1: gemini-3.5-flash-lite (Modello Primario Richiesto)
print("\n1. Test Modello Primario: gemini-3.5-flash-lite...")
try:
    resp1 = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents="Rispondi con solo la parola OK se sei operativo."
    )
    print("   [SUCCESSO] Risposta da gemini-3.5-flash-lite:", resp1.text.strip())
except Exception as e:
    print("   [FALLITO] gemini-3.5-flash-lite:", e)

# Test 2: gemini-3.8-flash (Modello di Fallback Richiesto)
print("\n2. Test Modello Fallback: gemini-3.8-flash...")
import time
for attempt in range(1, 4):
    try:
        resp2 = client.models.generate_content(
            model="gemini-3.8-flash",
            contents="Rispondi con solo la parola OK se sei operativo."
        )
        print("   [SUCCESSO] Risposta da gemini-3.8-flash:", resp2.text.strip())
        break
    except Exception as e:
        if "503" in str(e) and attempt < 3:
            print(f"   [AVVISO - Tentativo {attempt}/3] gemini-3.8-flash picco 503 temporaneo, attesa 3s...")
            time.sleep(3)
        else:
            print(f"   [FALLITO al tentativo {attempt}] gemini-3.8-flash:", e)

print("\n=== FINE VERIFICA ===")
