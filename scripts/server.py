"""
server.py - Server di sviluppo e backend locale per OrarioScuola.
Caratteristiche:
1. Serve i file statici della cartella public/
2. Espone l'endpoint REST /api/sync per triggerare la scansione Gemini con modalità singola/doppia
3. Gestisce CORS e risposte JSON immediate
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT_DIR = Path(__file__).parent.parent
PUBLIC_DIR = ROOT_DIR / "public"
SCRIPTS_DIR = ROOT_DIR / "scripts"

class TimetableRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/sync" or parsed.path == "/api/sync/":
            self.handle_sync_request()
        else:
            self.send_error(404, "Endpoint non trovato")

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/sync" or parsed.path == "/api/sync/":
            self.handle_sync_request()
        else:
            super().do_GET()

    def handle_sync_request(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = {}
        if content_length > 0:
            try:
                body = self.rfile.read(content_length).decode("utf-8")
                post_data = json.loads(body)
            except Exception:
                post_data = {}

        # Parametri da query o body
        query_params = parse_qs(urlparse(self.path).query)
        scan_mode = post_data.get("mode") or query_params.get("mode", ["single"])[0]
        class_name = post_data.get("class_name") or query_params.get("class", ["4 BINF"])[0]
        force = post_data.get("force", False)

        print(f"\n[SERVER] Richiesta di sincronizzazione ricevuta per classe '{class_name}' (Modalità: {scan_mode.upper()})...")

        # Invocazione di sync_timetable.py
        cmd = [
            sys.executable,
            str(SCRIPTS_DIR / "sync_timetable.py"),
            "--class-name", class_name,
            "--scan-mode", scan_mode
        ]
        if force:
            cmd.append("--force")

        try:
            result = subprocess.run(cmd, cwd=str(ROOT_DIR), capture_output=True, text=True, timeout=60)
            print(result.stdout)
            if result.stderr:
                print(f"[SERVER STDERR] {result.stderr}")

            # Ricarica il file timetable.json aggiornato
            timetable_file = PUBLIC_DIR / "data" / "timetable.json"
            timetable_data = None
            if timetable_file.exists():
                with open(timetable_file, "r", encoding="utf-8") as f:
                    timetable_data = json.load(f)

            response_payload = {
                "status": "success" if result.returncode == 0 else "warning",
                "scan_mode": scan_mode,
                "class_name": class_name,
                "message": "Sincronizzazione completata con successo" if result.returncode == 0 else "Sincronizzazione eseguita con avvisi",
                "timetable": timetable_data
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(response_payload, ensure_ascii=False).encode("utf-8"))

        except Exception as e:
            print(f"[SERVER ERROR] Errore durante la sincronizzazione: {e}")
            err_payload = {
                "status": "error",
                "message": f"Errore server: {str(e)}"
            }
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(err_payload).encode("utf-8"))


def run_server(port: int = 8080):
    # Supporto UTF-8 stdout su Windows
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    server_address = ("", port)
    httpd = HTTPServer(server_address, TimetableRequestHandler)
    print("=" * 60)
    print(f"[SERVER] OrarioScuola Server attivo su: http://localhost:{port}")
    print(f"[SERVER] Endpoint Sincronizzazione Live: http://localhost:{port}/api/sync")
    print(f"[SERVER] Cartella servita: {PUBLIC_DIR}")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArresto del server...")
        httpd.server_close()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    run_server(port)
