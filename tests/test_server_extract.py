import json
import threading
import time
import requests
from http.server import HTTPServer
import sys
from pathlib import Path

# Add scripts directory
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from server import TimetableRequestHandler

def run_test():
    port = 8899
    server = HTTPServer(("127.0.0.1", port), TimetableRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.5)

    base_url = f"http://127.0.0.1:{port}"
    print(f"Testing server on {base_url}...")

    # Test static volta_classes.json
    res_classes = requests.get(f"{base_url}/data/volta_classes.json")
    assert res_classes.status_code == 200, f"Expected 200, got {res_classes.status_code}"
    classes_data = res_classes.json()
    assert len(classes_data) == 64, f"Expected 64 classes, got {len(classes_data)}"
    print("[OK] data/volta_classes.json correctly served with 64 classes")

    # Test static timetable.json (4 BINF)
    res_tt = requests.get(f"{base_url}/data/timetable.json")
    assert res_tt.status_code == 200
    tt_data = res_tt.json()
    assert tt_data.get("classe") == "4 BINF"
    print("[OK] data/timetable.json correctly served with 4 BINF timetable")

    # Test POST /api/extract with a Volta class URL
    sample_url = "https://cspace.spaggiari.eu/pub/PGIT0005/orario/classi/edc0000026p00001s3fffffffffffffff_4_ainf_ac.png"
    payload = {
        "imageUrl": sample_url,
        "targetClass": "4 AINF"
    }
    res_extract = requests.post(f"{base_url}/api/extract", json=payload, timeout=60)
    assert res_extract.status_code == 200, f"Extract failed with {res_extract.status_code}: {res_extract.text}"
    extract_json = res_extract.json()
    assert extract_json.get("success") is True, f"Extract did not succeed: {extract_json}"
    extracted_tt = extract_json.get("timetable")
    assert extracted_tt is not None, "Missing timetable in response"
    assert "giorni" in extracted_tt, "Missing giorni in timetable"
    print(f"[OK] /api/extract successfully processed {payload['targetClass']}!")

    server.shutdown()
    print("All server tests passed!")

if __name__ == "__main__":
    run_test()
