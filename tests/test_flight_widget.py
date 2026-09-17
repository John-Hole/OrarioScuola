import unittest
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.sync_timetable import compute_widget_payload

MOCK_TIMETABLE = {
    "classe": "4 BINF",
    "giorni": [
        {
            "giorno": "Mercoled\u00ec",
            "lezioni": [
                {"ora": 1, "inizio": "08:00", "fine": "08:52", "materia": "TPSIT", "aula": "B 045", "docente": "Rossi"},
                {"ora": 2, "inizio": "08:52", "fine": "09:44", "materia": "SISTEMI", "aula": "Lab B 010", "docente": "Verdi"},
                {"ora": 3, "inizio": "09:54", "fine": "10:48", "materia": "INFORMATICA", "aula": "Lab B 012", "docente": "Bianchi"},
                {"ora": 4, "inizio": "10:48", "fine": "11:42", "materia": "INGLESE", "aula": "B 045", "docente": "Neri"}
            ]
        }
    ]
}

class TestFlightWidget(unittest.TestCase):
    def setUp(self):
        self.base_date = datetime(2026, 9, 16)  # Mercoledì

    def _test_time(self, h, m):
        dt = self.base_date.replace(hour=h, minute=m)
        return compute_widget_payload(MOCK_TIMETABLE, dt)

    def test_before_morning_cutoff(self):
        # Ore 06:30 (Prima delle 07:00) -> Trasparente
        p = self._test_time(6, 30)
        self.assertEqual(p["flight_visible"], 0)
        self.assertEqual(p["flight_single_line"], "")

    def test_morning_before_school(self):
        # Ore 07:15 (Dalle 07:00 all'inizio) -> Casa ── 08:00 ✈ ──> TPSIT [B 045]
        p = self._test_time(7, 15)
        self.assertEqual(p["flight_visible"], 1)
        self.assertEqual(p["flight_origin_sub"], "Casa")
        self.assertEqual(p["flight_time"], "08:00")
        self.assertEqual(p["flight_dest_sub"], "TPSIT")
        self.assertEqual(p["flight_dest_room"], "B 045")

    def test_during_first_lesson(self):
        # Ore 08:20 (Durante 1ª ora) -> TPSIT [B 045] ── 08:52 ✈ ──> SISTEMI [Lab B 010]
        p = self._test_time(8, 20)
        self.assertEqual(p["flight_visible"], 1)
        self.assertEqual(p["flight_origin_sub"], "TPSIT")
        self.assertEqual(p["flight_time"], "08:52")
        self.assertEqual(p["flight_dest_sub"], "SISTEMI")
        self.assertEqual(p["flight_dest_room"], "B 010")

    def test_during_change_of_hour(self):
        # Ore 08:52 (Cambio d'ora) -> SISTEMI
        p = self._test_time(8, 52)
        self.assertEqual(p["flight_visible"], 1)
        self.assertEqual(p["flight_origin_sub"], "SISTEMI")
        self.assertEqual(p["flight_time"], "09:44")

    def test_during_last_lesson(self):
        # Ore 11:00 (Durante ultima ora: INGLESE fino alle 11:42) -> INGLESE [B 045] ── 11:42 ✈ ──> Casa [Uscita]
        p = self._test_time(11, 0)
        self.assertEqual(p["flight_visible"], 1)
        self.assertEqual(p["flight_origin_sub"], "ING")
        self.assertEqual(p["flight_time"], "11:42")
        self.assertEqual(p["flight_dest_sub"], "Casa")
        self.assertEqual(p["flight_dest_room"], "Uscita")

    def test_within_one_hour_after_school(self):
        # Ore 12:15 (Entro 1 ora dall'uscita 11:42) -> Scuola [Terminata] ── 11:42 ✈ ──> Casa [Rientro]
        p = self._test_time(12, 15)
        self.assertEqual(p["flight_visible"], 1)
        self.assertEqual(p["flight_origin_sub"], "Scuola")
        self.assertEqual(p["flight_time"], "11:42")
        self.assertEqual(p["flight_dest_sub"], "Casa")

    def test_after_one_hour_post_school(self):
        # Ore 12:45 (> 1 ora dall'uscita 11:42) -> Trasparente / Invisibile
        p = self._test_time(12, 45)
        self.assertEqual(p["flight_visible"], 0)
        self.assertEqual(p["flight_single_line"], "")


if __name__ == "__main__":
    unittest.main()
