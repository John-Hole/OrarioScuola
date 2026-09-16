"""
Test di verifica per le logiche temporali e la generazione del feed widget Galaxy S24.
Allineato all'orario provvisorio ufficiale della 4 BINF dal 14 Settembre 2026.
"""

import unittest
from datetime import datetime
import sys
from pathlib import Path

# Aggiungi scripts al sys.path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from sync_timetable import get_sample_mock_data, compute_widget_payload, TimetableSchema, normalize_timetable_multihour_slots

class TestTimetableEngine(unittest.TestCase):
    def setUp(self):
        self.mock_data = get_sample_mock_data("4 BINF")

    def test_pydantic_schema_validation(self):
        """Verifica che la struttura dei dati sia conforme allo schema Pydantic di Gemini"""
        schema_obj = TimetableSchema(**self.mock_data)
        self.assertEqual(schema_obj.classe, "4 BINF")
        self.assertTrue(len(schema_obj.giorni) >= 5)

    def test_state_in_class(self):
        """Lunedì alle 08:30 -> Lezione in corso (SISTEMI E RETI LAB)"""
        # 2026-09-14 era Lunedì
        sim_dt = datetime(2026, 9, 14, 8, 30)
        res = compute_widget_payload(self.mock_data, sim_dt)
        
        self.assertEqual(res["status"], "IN_CLASS")
        self.assertEqual(res["badge"], "IN CORSO")
        self.assertIn("SISTEMI E RETI", res["title"])
        self.assertIn("B 010", res["room"])
        self.assertIn("24 min", res["time_left"])

    def test_state_break(self):
        """Lunedì alle 09:52 -> Ricreazione / Intervallo (tra slot 2 fine 09:48 e slot 3 inizio 09:58)"""
        sim_dt = datetime(2026, 9, 14, 9, 52)
        res = compute_widget_payload(self.mock_data, sim_dt)
        
        self.assertEqual(res["status"], "BREAK")
        self.assertEqual(res["badge"], "RICREAZIONE")
        self.assertIn("INFORMATICA", res["subtitle"])
        self.assertIn("C 170", res["room"])

    def test_state_cambio_ora(self):
        """Lunedì alle 08:56 -> Cambio d'ora ordinario (tra slot 1 fine 08:54 e slot 2 inizio 08:58)"""
        sim_dt = datetime(2026, 9, 14, 8, 56)
        res = compute_widget_payload(self.mock_data, sim_dt)
        
        self.assertEqual(res["status"], "BREAK")
        self.assertEqual(res["badge"], "CAMBIO ORA")
        self.assertIn("SISTEMI E RETI", res["title"])

    def test_state_after_school(self):
        """Lunedì alle 12:15 -> Giornata terminata alle 11:42, anteprima Martedì prima ora"""
        sim_dt = datetime(2026, 9, 14, 12, 15)
        res = compute_widget_payload(self.mock_data, sim_dt)
        
        self.assertEqual(res["status"], "FINISHED")
        self.assertEqual(res["badge"], "FINITO")
        self.assertIn("Domani", res["subtitle"])
        self.assertIn("ITALIANO", res["subtitle"])

    def test_state_weekend(self):
        """Domenica alle 11:00 -> Weekend, anteprima Lunedì prima ora"""
        sim_dt = datetime(2026, 9, 20, 11, 0)
        res = compute_widget_payload(self.mock_data, sim_dt)
        
        self.assertEqual(res["status"], "WEEKEND")
        self.assertEqual(res["badge"], "WEEKEND")
        self.assertIn("Lunedì ore 08:00", res["subtitle"])

    def test_reconcile_identical_scans(self):
        """Due scansioni identiche producono un consenso del 100% con stato CONFIRMED"""
        from sync_timetable import reconcile_timetables
        pass1 = get_sample_mock_data("4 BINF")
        pass2 = get_sample_mock_data("4 BINF")

        reconciled = reconcile_timetables(pass1, pass2, "gemini-3.8-flash", "gemini-3.8-flash")
        v = reconciled.get("verification", {})
        self.assertTrue(v.get("verified"))
        self.assertEqual(v.get("scan_mode"), "double")
        self.assertEqual(v.get("consensus"), 1.0)
        self.assertEqual(v.get("status"), "CONFIRMED")

    def test_reconcile_with_minor_differences(self):
        """Due scansioni con piccole discrepanze (es. spazi aula) vengono riconciliate correttamente"""
        from sync_timetable import reconcile_timetables
        import copy
        pass1 = get_sample_mock_data("4 BINF")
        pass2 = copy.deepcopy(pass1)
        # Modifica aula con spazio differente
        pass2["giorni"][0]["lezioni"][0]["aula"] = "B010"

        reconciled = reconcile_timetables(pass1, pass2, "gemini-3.8-flash", "gemini-3.5-flash-lite")
        v = reconciled.get("verification", {})
        self.assertTrue(v.get("verified"))
        self.assertEqual(v.get("scan_mode"), "double")
        self.assertGreaterEqual(v.get("consensus"), 0.95)

    def test_six_hour_schedule_widget_and_breaks(self):
        """Verifica la compatibilità completa con orario a 6 ore e doppia ricreazione (09:48-09:58 e 11:42-11:52)"""
        six_hour_timetable = {
            "classe": "3 CINF",
            "giorni": [
                {
                    "giorno": "Lunedì",
                    "lezioni": [
                        {"ora": 1, "inizio": "08:00", "fine": "08:54", "materia": "INGLESE", "aula": "B 040"},
                        {"ora": 2, "inizio": "08:58", "fine": "09:48", "materia": "INFORMATICA", "aula": "C 160"},
                        {"ora": 3, "inizio": "09:58", "fine": "10:48", "materia": "INFORMATICA LAB", "aula": "C 170"},
                        {"ora": 4, "inizio": "10:52", "fine": "11:42", "materia": "TPSIT LAB", "aula": "B 045"},
                        {"ora": 5, "inizio": "11:52", "fine": "12:42", "materia": "TPSIT", "aula": "B 040"},
                        {"ora": 6, "inizio": "12:46", "fine": "13:36", "materia": "TELECOMUNICAZIONI", "aula": "B 040"}
                    ]
                }
            ]
        }

        # 1. Durante la 2ª ricreazione (11:45)
        dt_break2 = datetime(2026, 9, 14, 11, 45)
        res_b2 = compute_widget_payload(six_hour_timetable, dt_break2)
        self.assertEqual(res_b2["status"], "BREAK")
        self.assertEqual(res_b2["badge"], "RICREAZIONE")
        self.assertIn("TPSIT", res_b2["subtitle"])

        # 2. Durante la 6ª ora (13:00)
        dt_h6 = datetime(2026, 9, 14, 13, 0)
        res_h6 = compute_widget_payload(six_hour_timetable, dt_h6)
        self.assertEqual(res_h6["status"], "IN_CLASS")
        self.assertIn("TELECOMUNICAZIONI", res_h6["title"])
        self.assertIn("Fine tra 36 min", res_h6["time_left"])

        # 3. Dopo la fine delle 6 ore (13:40)
        dt_after = datetime(2026, 9, 14, 13, 40)
        res_after = compute_widget_payload(six_hour_timetable, dt_after)
        self.assertEqual(res_after["status"], "FINISHED")

    def test_normalize_multihour_slots(self):
        """Verifica lo sdoppiamento di lezioni che coprono 2 ore (es. TPSIT LAB 09:58-11:42)"""
        raw_timetable = {
            "classe": "4 CINF** (art. con 4 DGR)",
            "giorni": [
                {
                    "giorno": "Mercoledì",
                    "lezioni": [
                        {"ora": 1, "inizio": "08:00", "fine": "08:54", "materia": "ITALIANO", "aula": "C 140"},
                        {"ora": 2, "inizio": "08:58", "fine": "09:48", "materia": "RELIGIONE", "aula": "C 140"},
                        {"ora": 3, "inizio": "09:58", "fine": "11:42", "materia": "TPSIT LAB.", "aula": "B 045", "is_lab": True}
                    ]
                }
            ]
        }

        normalized = normalize_timetable_multihour_slots(raw_timetable)
        mercoledi_lezioni = normalized["giorni"][0]["lezioni"]

        self.assertEqual(len(mercoledi_lezioni), 4)
        h3 = next(l for l in mercoledi_lezioni if l["ora"] == 3)
        h4 = next(l for l in mercoledi_lezioni if l["ora"] == 4)

        self.assertEqual(h3["materia"], "TPSIT LAB.")
        self.assertEqual(h3["inizio"], "09:58")
        self.assertEqual(h3["fine"], "10:48")
        self.assertEqual(h3["aula"], "B 045")
        self.assertTrue(h3["is_lab"])

        self.assertEqual(h4["materia"], "TPSIT LAB.")
        self.assertEqual(h4["inizio"], "10:52")
        self.assertEqual(h4["fine"], "11:42")
        self.assertEqual(h4["aula"], "B 045")
        self.assertTrue(h4["is_lab"])

if __name__ == "__main__":
    unittest.main()
