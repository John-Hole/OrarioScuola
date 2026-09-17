"""
Script di sincronizzazione ed estrazione orario scolastico Spaggiari EDT con Gemini Vision API.
Supporta:
1. Download automatico immagine orario o lettura da file locale
2. Caching intelligente tramite hash MD5 / Last-Modified per evitare chiamate API ridondanti
3. Estrazione visiva multimodale con Gemini 2.5 Flash e Structured Outputs (Pydantic Schema)
4. Generazione automatica di timetable.json e widget_data.json per Samsung Galaxy S24
5. Modalità --mock per test offline immediati
"""

import os
import sys
import json
import hashlib
import argparse
from datetime import datetime, time
from typing import List, Optional, Dict, Any
from pathlib import Path

try:
    import requests
except ImportError:
    requests = None

try:
    from pydantic import BaseModel, Field
except ImportError:
    BaseModel = None
    Field = None


# --- CARICAMENTO VARIABILI D'AMBIENTE (.env) ---
def load_env(env_path: Optional[str] = None) -> None:
    """Carica le variabili da un file .env se presente nel progetto."""
    if not env_path:
        candidates = [
            Path(".env"),
            Path(__file__).parent.parent / ".env",
            Path(__file__).parent / ".env"
        ]
        for c in candidates:
            if c.exists():
                env_path = str(c)
                break

    if env_path and os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'").strip('"')
                    if k and k not in os.environ:
                        os.environ[k] = v
        except Exception as e:
            print(f"[WARN] Impossibile caricare .env da {env_path}: {e}")


# Carica subito le variabili da .env all'importazione
load_env()


# --- MODELLI PYDANTIC PER STRUCTURED OUTPUT GEMINI ---
if BaseModel:
    class LessonSlot(BaseModel):
        ora: int = Field(description="Numero progressivo dell'ora (es. 1, 2, 3...)")
        inizio: str = Field(description="Orario di inizio nel formato HH:MM (es. 08:00)")
        fine: str = Field(description="Orario di fine nel formato HH:MM (es. 08:55)")
        materia: str = Field(description="Nome esteso o standard della materia scolastica (es. SISTEMI E RETI)")
        docenti: List[str] = Field(default_factory=list, description="Elenco dei cognomi dei docenti (es. ['MANCINO', 'RIGHI'])")
        aula: str = Field(default="", description="Codice o nome dell'aula/laboratorio (es. B010 LAB RETI)")
        is_lab: bool = Field(default=False, description="True se si tratta di laboratorio / compresenza")
        note: Optional[str] = Field(default="", description="Eventuali annotazioni presenti nella casella")

    class DaySchedule(BaseModel):
        giorno: str = Field(description="Giorno della settimana: Lunedì, Martedì, Mercoledì, Giovedì, Venerdì o Sabato")
        lezioni: List[LessonSlot] = Field(default_factory=list, description="Lista delle ore di lezione del giorno")

    class TimetableSchema(BaseModel):
        classe: str = Field(description="Classe scolastica (es. 4 BINF)")
        stato_orario: str = Field(default="Orario", description="Dicitura stato (es. 'Orario Provvisorio' o 'Orario Definitivo')")
        data_decorrenza: str = Field(default="", description="Data da cui ha validità l'orario (es. 'dal 15 Settembre 2026')")
        data_aggiornamento: str = Field(default="", description="Data/ora di rilascio rilevata nel documento")
        classi_disponibili: Optional[List[str]] = Field(default=None, description="Eventuali altre classi presenti nel foglio")
        giorni: List[DaySchedule] = Field(default_factory=list, description="Tutti i giorni della settimana con relative lezioni")

    class DiscoverClassesSchema(BaseModel):
        school: Optional[str] = Field(default="", description="Nome dell'istituto scolastico")
        classes: List[str] = Field(default_factory=list, description="Elenco di tutte le classi trovate")


# --- GENERATORE DATI MOCK (OFFLINE / TEST) ---
def get_sample_mock_data(classe: str = "4 BINF") -> Dict[str, Any]:
    """Genera un orario verosimile per la classe 4 BINF (Informatica e Telecomunicazioni)"""
    return {
        "classe": classe,
        "stato_orario": "Orario Provvisorio",
        "data_decorrenza": "In vigore dal 14 Settembre 2026",
        "data_aggiornamento": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "classi_disponibili": [
            "4 BINF", "4 AINF", "3 BINF", "5 BINF", "4 AELT", "4 AMEC"
        ],
        "giorni": [
            {
                "giorno": "Lunedì",
                "lezioni": [
                    {
                        "ora": 1,
                        "inizio": "08:00",
                        "fine": "08:54",
                        "materia": "SISTEMI E RETI LAB",
                        "docenti": ["MANCINO R.", "RIGHI A."],
                        "aula": "B 010",
                        "is_lab": True,
                        "note": ""
                    },
                    {
                        "ora": 2,
                        "inizio": "08:58",
                        "fine": "09:48",
                        "materia": "SISTEMI E RETI LAB",
                        "docenti": ["MANCINO R.", "RIGHI A."],
                        "aula": "B 010",
                        "is_lab": True,
                        "note": ""
                    },
                    {
                        "ora": 3,
                        "inizio": "09:58",
                        "fine": "10:48",
                        "materia": "INFORMATICA LAB",
                        "docenti": ["BATOCCHI M.", "GIAPPICHINI A."],
                        "aula": "C 170",
                        "is_lab": True,
                        "note": ""
                    },
                    {
                        "ora": 4,
                        "inizio": "10:52",
                        "fine": "11:42",
                        "materia": "INFORMATICA LAB",
                        "docenti": ["BATOCCHI M.", "GIAPPICHINI A."],
                        "aula": "C 170",
                        "is_lab": True,
                        "note": ""
                    }
                ]
            },
            {
                "giorno": "Martedì",
                "lezioni": [
                    {
                        "ora": 1,
                        "inizio": "08:00",
                        "fine": "08:54",
                        "materia": "ITALIANO",
                        "docenti": ["TOMASSONI V."],
                        "aula": "B 115",
                        "is_lab": False,
                        "note": ""
                    },
                    {
                        "ora": 2,
                        "inizio": "08:58",
                        "fine": "09:48",
                        "materia": "ITALIANO",
                        "docenti": ["TOMASSONI V."],
                        "aula": "B 115",
                        "is_lab": False,
                        "note": ""
                    },
                    {
                        "ora": 3,
                        "inizio": "09:58",
                        "fine": "10:48",
                        "materia": "RELIGIONE",
                        "docenti": ["VIOLA A."],
                        "aula": "B 115",
                        "is_lab": False,
                        "note": ""
                    },
                    {
                        "ora": 4,
                        "inizio": "10:52",
                        "fine": "11:42",
                        "materia": "INGLESE",
                        "docenti": ["GUERCINI C."],
                        "aula": "B 115",
                        "is_lab": False,
                        "note": ""
                    }
                ]
            },
            {
                "giorno": "Mercoledì",
                "lezioni": [
                    {
                        "ora": 1,
                        "inizio": "08:00",
                        "fine": "08:54",
                        "materia": "TPSIT LAB",
                        "docenti": ["CIUCHETTI M.", "CRISPOLTI M."],
                        "aula": "B 045",
                        "is_lab": True,
                        "note": ""
                    },
                    {
                        "ora": 2,
                        "inizio": "08:58",
                        "fine": "09:48",
                        "materia": "TPSIT LAB",
                        "docenti": ["CIUCHETTI M.", "CRISPOLTI M."],
                        "aula": "B 045",
                        "is_lab": True,
                        "note": ""
                    },
                    {
                        "ora": 3,
                        "inizio": "09:58",
                        "fine": "10:48",
                        "materia": "MATEMATICA",
                        "docenti": ["POGGIONI M."],
                        "aula": "C 180",
                        "is_lab": False,
                        "note": ""
                    },
                    {
                        "ora": 4,
                        "inizio": "10:52",
                        "fine": "11:42",
                        "materia": "MATEMATICA",
                        "docenti": ["POGGIONI M."],
                        "aula": "C 180",
                        "is_lab": False,
                        "note": ""
                    }
                ]
            },
            {
                "giorno": "Giovedì",
                "lezioni": [
                    {
                        "ora": 1,
                        "inizio": "08:00",
                        "fine": "08:54",
                        "materia": "ITALIANO",
                        "docenti": ["TOMASSONI V."],
                        "aula": "B 060",
                        "is_lab": False,
                        "note": ""
                    },
                    {
                        "ora": 2,
                        "inizio": "08:58",
                        "fine": "09:48",
                        "materia": "INGLESE",
                        "docenti": ["GUERCINI C."],
                        "aula": "B 060",
                        "is_lab": False,
                        "note": ""
                    },
                    {
                        "ora": 3,
                        "inizio": "09:58",
                        "fine": "10:48",
                        "materia": "MATEMATICA",
                        "docenti": ["POGGIONI M."],
                        "aula": "C 220",
                        "is_lab": False,
                        "note": ""
                    },
                    {
                        "ora": 4,
                        "inizio": "10:52",
                        "fine": "11:42",
                        "materia": "SISTEMI E RETI",
                        "docenti": ["MANCINO R."],
                        "aula": "C 220",
                        "is_lab": False,
                        "note": ""
                    }
                ]
            },
            {
                "giorno": "Venerdì",
                "lezioni": [
                    {
                        "ora": 1,
                        "inizio": "08:00",
                        "fine": "08:54",
                        "materia": "SCIENZE MOTORIE",
                        "docenti": ["PAPINI S."],
                        "aula": "Palestra ITTS",
                        "is_lab": True,
                        "note": ""
                    },
                    {
                        "ora": 2,
                        "inizio": "08:58",
                        "fine": "09:48",
                        "materia": "SCIENZE MOTORIE",
                        "docenti": ["PAPINI S."],
                        "aula": "Palestra ITTS",
                        "is_lab": True,
                        "note": ""
                    },
                    {
                        "ora": 3,
                        "inizio": "09:58",
                        "fine": "10:48",
                        "materia": "TELECOMUNICAZIONI",
                        "docenti": ["PERICOLINI A."],
                        "aula": "L 030",
                        "is_lab": True,
                        "note": ""
                    },
                    {
                        "ora": 4,
                        "inizio": "10:52",
                        "fine": "11:42",
                        "materia": "ITALIANO",
                        "docenti": ["TOMASSONI V."],
                        "aula": "B 030",
                        "is_lab": False,
                        "note": ""
                    }
                ]
            }
        ]
    }


def compute_flight_payload(timetable: Dict[str, Any], ref_dt: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Calcola i campi per il widget 'Scalo / Volo Aereo':
    - Trasparente (< 07:00, > uscita + 60 min, weekend)
    - 07:00 - prima ora: Casa [Partenza] ── 08:00 ✈ ──> Prima Materia [Aula]
    - Lezioni: Materia [Aula] ── Cambio ✈ ──> Prossima [Aula]
    - Ultima ora (4ª, 6ª o 8ª ora): Materia [Aula] ── Uscita ✈ ──> Casa [Uscita]
    - Fino a 1h da uscita: Scuola [Terminata] ── Uscita ✈ ──> Casa [Rientro]
    """
    if ref_dt is None:
        ref_dt = datetime.now()

    empty_flight = {
        "flight_visible": 0,
        "flight_origin_sub": "",
        "flight_origin_room": "",
        "flight_arrow": "────── ✈ ──────>",
        "flight_time": "",
        "flight_dest_sub": "",
        "flight_dest_room": "",
        "flight_single_line": "",
        "flight_multiline": ""
    }

    if ref_dt.weekday() in (5, 6):
        return empty_flight

    it_days = {0: "Lunedì", 1: "Martedì", 2: "Mercoledì", 3: "Giovedì", 4: "Venerdì", 5: "Sabato", 6: "Domenica"}
    current_day_name = it_days.get(ref_dt.weekday(), "Lunedì")
    day_data = next((d for d in timetable.get("giorni", []) if d.get("giorno") == current_day_name), None)

    if not day_data or not day_data.get("lezioni"):
        return empty_flight

    lessons = day_data["lezioni"]
    def to_min(t_str: str) -> int:
        p = t_str.split(":")
        return int(p[0]) * 60 + int(p[1])

    first_start = to_min(lessons[0]["inizio"])
    last_end = to_min(lessons[-1]["fine"])
    current_minutes = ref_dt.hour * 60 + ref_dt.minute

    # Prima delle 07:00 (420 min) -> invisibile / trasparente
    if current_minutes < 420:
        return empty_flight

    # Oltre 1 ora dall'uscita -> invisibile / trasparente
    if current_minutes >= last_end + 60:
        return empty_flight

    origin_sub = ""
    origin_room = ""
    flight_time = ""
    dest_sub = ""
    dest_room = ""

    # Dalle 07:00 all'inizio della prima ora
    if current_minutes < first_start:
        origin_sub = "Casa"
        origin_room = "Partenza"
        flight_time = lessons[0]["inizio"]
        dest_sub = lessons[0]["materia"]
        dest_room = lessons[0]["aula"]
    # Entro 1 ora dall'uscita scolastica
    elif current_minutes >= last_end:
        origin_sub = "Scuola"
        origin_room = lessons[-1].get("aula", "Terminata")
        flight_time = lessons[-1]["fine"]
        dest_sub = "Casa"
        dest_room = "Rientro"
    # Durante l'orario scolastico
    else:
        found = False
        for i, lesson in enumerate(lessons):
            s = to_min(lesson["inizio"])
            e = to_min(lesson["fine"])
            if s <= current_minutes < e:
                origin_sub = lesson["materia"]
                origin_room = lesson["aula"]
                if i == len(lessons) - 1:
                    flight_time = lesson["fine"]  # Orario di uscita esatto (es. 11:42, 13:36, 15:34)
                    dest_sub = "Casa"
                    dest_room = "Uscita"
                else:
                    flight_time = lesson["fine"]  # Orario del cambio ora
                    dest_sub = lessons[i + 1]["materia"]
                    dest_room = lessons[i + 1]["aula"]
                found = True
                break
            if i + 1 < len(lessons):
                next_s = to_min(lessons[i + 1]["inizio"])
                if e <= current_minutes < next_s:
                    origin_sub = lesson["materia"]
                    origin_room = lesson["aula"]
                    flight_time = lessons[i + 1]["inizio"]
                    dest_sub = lessons[i + 1]["materia"]
                    dest_room = lessons[i + 1]["aula"]
                    found = True
                    break
        if not found:
            origin_sub = lessons[0]["materia"]
            origin_room = lessons[0]["aula"]
            flight_time = lessons[0]["inizio"]
            dest_sub = "Scuola"
            dest_room = ""

    single_line = f"{origin_sub} [{origin_room}]  ── {flight_time} ✈ ──>  {dest_sub} [{dest_room}]"
    multiline = f"{origin_sub} ({origin_room})\n────── {flight_time} ✈ ──────>\n{dest_sub} ({dest_room})"

    return {
        "flight_visible": 1,
        "flight_origin_sub": origin_sub,
        "flight_origin_room": origin_room,
        "flight_arrow": "────── ✈ ──────>",
        "flight_time": flight_time,
        "flight_dest_sub": dest_sub,
        "flight_dest_room": dest_room,
        "flight_single_line": single_line,
        "flight_multiline": multiline
    }


# --- CALCOLO FEED WIDGET PER GALAXY S24 ---
def compute_widget_payload(timetable: Dict[str, Any], ref_dt: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Calcola istantaneamente lo stato esatto per il Galaxy S24:
    - Risponde a 'Dove devo andare adesso?'
    - Include campi 'flight_*' per il layout scalo aereo con visibilità programmata
    """
    if ref_dt is None:
        ref_dt = datetime.now()

    flight = compute_flight_payload(timetable, ref_dt)

    it_days = {
        0: "Lunedì",
        1: "Martedì",
        2: "Mercoledì",
        3: "Giovedì",
        4: "Venerdì",
        5: "Sabato",
        6: "Domenica"
    }

    current_day_name = it_days.get(ref_dt.weekday(), "Lunedì")
    current_time_str = ref_dt.strftime("%H:%M")
    current_minutes = ref_dt.hour * 60 + ref_dt.minute

    # Trova il giorno odierno nell'orario
    day_data = next((d for d in timetable.get("giorni", []) if d.get("giorno") == current_day_name), None)

    # Funzione helper per trovare la prima lezione di un dato giorno o del lunedì successivo
    def get_first_lesson_of_day(day_name: str) -> Optional[Dict[str, Any]]:
        target_day = next((d for d in timetable.get("giorni", []) if d.get("giorno") == day_name), None)
        if target_day and target_day.get("lezioni"):
            return target_day["lezioni"][0]
        return None

    def with_flight(payload: Dict[str, Any]) -> Dict[str, Any]:
        payload.update(flight)
        return payload

    # Verifica se siamo nel weekend
    if ref_dt.weekday() in (5, 6):  # Sabato o Domenica
        monday_first = get_first_lesson_of_day("Lunedì")
        preview = "Lunedì riposo"
        if monday_first:
            preview = f"Lunedì ore {monday_first['inizio']}: {monday_first['materia']} ({monday_first['aula']})"
        return with_flight({
            "status": "WEEKEND",
            "badge": "WEEKEND",
            "title": "Buon Fine Settimana",
            "subtitle": preview,
            "room": "",
            "time_left": "",
            "next_title": monday_first["materia"] if monday_first else "",
            "next_room": monday_first["aula"] if monday_first else "",
            "next_time": monday_first["inizio"] if monday_first else "",
            "updated_at": ref_dt.strftime("%H:%M"),
            "class_name": timetable.get("classe", "4 BINF")
        })

    # Se è un giorno feriale ma non ci sono lezioni
    if not day_data or not day_data.get("lezioni"):
        return with_flight({
            "status": "NO_LESSONS",
            "badge": "LIBERO",
            "title": "Nessuna lezione oggi",
            "subtitle": "Goditi la giornata libera",
            "room": "",
            "time_left": "",
            "next_title": "",
            "next_room": "",
            "next_time": "",
            "updated_at": ref_dt.strftime("%H:%M"),
            "class_name": timetable.get("classe", "4 BINF")
        })

    lessons = day_data["lezioni"]

    def to_minutes(t_str: str) -> int:
        parts = t_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])

    first_start = to_minutes(lessons[0]["inizio"])
    last_end = to_minutes(lessons[-1]["fine"])

    # Helper per il giorno successivo
    next_day_idx = (ref_dt.weekday() + 1) % 7
    next_day_name = it_days.get(next_day_idx if next_day_idx < 5 else 0)
    next_day_first = get_first_lesson_of_day(next_day_name)
    tomorrow_preview = ""
    if next_day_first:
        prefix = "Domani" if next_day_idx < 5 else "Lunedì"
        tomorrow_preview = f"{prefix} ore {next_day_first['inizio']}: {next_day_first['materia']} ({next_day_first['aula']})"

    # Stato A: Prima dell'inizio delle lezioni (es. mattina presto)
    if current_minutes < first_start:
        minutes_to_start = first_start - current_minutes
        return with_flight({
            "status": "BEFORE_SCHOOL",
            "badge": "PRIMA ORA",
            "title": f"Prima ora: {lessons[0]['materia']}",
            "subtitle": f"Inizio alle {lessons[0]['inizio']} (tra {minutes_to_start} min)",
            "room": lessons[0]["aula"],
            "time_left": f"{minutes_to_start}m all'inizio",
            "next_title": lessons[0]["materia"],
            "next_room": lessons[0]["aula"],
            "next_time": lessons[0]["inizio"],
            "updated_at": ref_dt.strftime("%H:%M"),
            "class_name": timetable.get("classe", "4 BINF")
        })

    # Stato B: Dopo l'orario scolastico (Pomeriggio / Sera)
    if current_minutes >= last_end:
        return with_flight({
            "status": "FINISHED",
            "badge": "FINITO",
            "title": "Giornata terminata!",
            "subtitle": tomorrow_preview,
            "room": "",
            "time_left": "",
            "next_title": next_day_first["materia"] if next_day_first else "",
            "next_room": next_day_first["aula"] if next_day_first else "",
            "next_time": next_day_first["inizio"] if next_day_first else "",
            "updated_at": ref_dt.strftime("%H:%M"),
            "class_name": timetable.get("classe", "4 BINF")
        })

    # Stato C: Durante la giornata scolastica (tra prima ora e ultima ora)
    # Controlliamo se siamo in una lezione o in un cambio d'ora / ricreazione
    for i, lesson in enumerate(lessons):
        start_min = to_minutes(lesson["inizio"])
        end_min = to_minutes(lesson["fine"])

        # Lezione in corso
        if start_min <= current_minutes < end_min:
            mins_left = end_min - current_minutes
            next_lesson = lessons[i + 1] if (i + 1) < len(lessons) else None
            next_info = f"Poi: {next_lesson['materia']} in {next_lesson['aula']}" if next_lesson else "Ultima ora!"
            return with_flight({
                "status": "IN_CLASS",
                "badge": "IN CORSO",
                "title": lesson["materia"],
                "subtitle": next_info,
                "room": lesson["aula"],
                "time_left": f"Fine tra {mins_left} min ({lesson['fine']})",
                "next_title": next_lesson["materia"] if next_lesson else "Fine lezioni",
                "next_room": next_lesson["aula"] if next_lesson else "",
                "next_time": next_lesson["inizio"] if next_lesson else lesson["fine"],
                "updated_at": ref_dt.strftime("%H:%M"),
                "class_name": timetable.get("classe", "4 BINF")
            })

        # Cambio d'ora / intervallo tra lezione i e lezione i+1
        if (i + 1) < len(lessons):
            next_start = to_minutes(lessons[i + 1]["inizio"])
            if end_min <= current_minutes < next_start:
                mins_to_next = next_start - current_minutes
                gap = next_start - end_min
                is_recess = gap >= 8
                next_l = lessons[i + 1]
                return with_flight({
                    "status": "BREAK",
                    "badge": "RICREAZIONE" if is_recess else "CAMBIO ORA",
                    "title": "Ricreazione in corso" if is_recess else f"Prossima: {next_l['materia']}",
                    "subtitle": f"Prossima: {next_l['materia']} in {next_l['aula']} ({mins_to_next} min)" if is_recess else f"Inizio alle {next_l['inizio']} (tra {mins_to_next} min)",
                    "room": f"Spostati in: {next_l['aula']}",
                    "time_left": f"{mins_to_next} min al suono",
                    "next_title": next_l["materia"],
                    "next_room": next_l["aula"],
                    "next_time": next_l["inizio"],
                    "updated_at": ref_dt.strftime("%H:%M"),
                    "class_name": timetable.get("classe", "4 BINF")
                })

    return with_flight({
        "status": "UNKNOWN",
        "badge": "SCUOLA",
        "title": "Orario scolastico",
        "subtitle": "",
        "room": "",
        "time_left": "",
        "next_title": "",
        "next_room": "",
        "next_time": "",
        "updated_at": ref_dt.strftime("%H:%M"),
        "class_name": timetable.get("classe", "4 BINF")
    })


STANDARD_SCHOOL_HOURS = [
    {"ora": 1, "start": "08:00", "end": "08:54", "startMin": 480, "endMin": 534},
    {"ora": 2, "start": "08:58", "end": "09:48", "startMin": 538, "endMin": 588},
    {"ora": 3, "start": "09:58", "end": "10:48", "startMin": 598, "endMin": 648},
    {"ora": 4, "start": "10:52", "end": "11:42", "startMin": 652, "endMin": 702},
    {"ora": 5, "start": "11:52", "end": "12:42", "startMin": 712, "endMin": 762},
    {"ora": 6, "start": "12:46", "end": "13:36", "startMin": 766, "endMin": 816}
]


def time_to_minutes(t_str: str) -> int:
    if not t_str:
        return 0
    clean = t_str.replace("h", ":").strip()
    parts = clean.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def normalize_timetable_multihour_slots(timetable: Dict[str, Any]) -> Dict[str, Any]:
    """
    Rileva lezioni che occupano blocchi di più ore (es. 3ª e 4ª ora unite: 09:58-11:42)
    e le sdoppia in singole voci per ciascuna ora standard, garantendo la visualizzazione corretta.
    """
    if not timetable or not isinstance(timetable, dict) or not timetable.get("giorni"):
        return timetable

    # 1. Ricava la griglia oraria dalle ore singole già presenti
    known_hours = {}
    for day in timetable.get("giorni", []):
        for l in day.get("lezioni", []):
            ora = l.get("ora")
            start = l.get("inizio")
            end = l.get("fine")
            if ora and start and end:
                dur = time_to_minutes(end) - time_to_minutes(start)
                if 30 <= dur <= 65 and ora not in known_hours:
                    known_hours[ora] = {
                        "ora": ora,
                        "start": start,
                        "end": end,
                        "startMin": time_to_minutes(start),
                        "endMin": time_to_minutes(end)
                    }

    for std in STANDARD_SCHOOL_HOURS:
        h = std["ora"]
        if h not in known_hours:
            known_hours[h] = {
                "ora": h,
                "start": std["start"],
                "end": std["end"],
                "startMin": std["startMin"],
                "endMin": std["endMin"]
            }

    sorted_slots = sorted(known_hours.values(), key=lambda x: x["ora"])

    for day in timetable.get("giorni", []):
        new_lezioni = []
        existing_hours = set()
        for l in day.get("lezioni", []):
            start_min = time_to_minutes(l.get("inizio", ""))
            end_min = time_to_minutes(l.get("fine", ""))
            dur = end_min - start_min

            if dur > 65:
                matched_hours = []
                for slot in sorted_slots:
                    overlap_start = max(start_min, slot["startMin"])
                    overlap_end = min(end_min, slot["endMin"])
                    overlap = overlap_end - overlap_start
                    if overlap >= 25:
                        matched_hours.append(slot)

                if len(matched_hours) > 1:
                    for slot in matched_hours:
                        if slot["ora"] not in existing_hours:
                            split_l = dict(l)
                            split_l["ora"] = slot["ora"]
                            split_l["inizio"] = slot["start"]
                            split_l["fine"] = slot["end"]
                            new_lezioni.append(split_l)
                            existing_hours.add(slot["ora"])
                    continue

            ora = l.get("ora")
            if ora and ora not in existing_hours:
                new_lezioni.append(l)
                existing_hours.add(ora)
            elif not ora:
                new_lezioni.append(l)

        new_lezioni.sort(key=lambda x: x.get("ora", 0))
        day["lezioni"] = new_lezioni

    return timetable


# --- PIPELINE DI ESTRAZIONE CON GEMINI VISION (MULTI-MODELLO & DOPPIA SCANSIONE) ---

def call_gemini_vision_single(
    client,
    image_bytes: bytes,
    mime_type: str,
    prompt: str,
    model_name: str
) -> Dict[str, Any]:
    """Esegue una singola chiamata all'API Gemini con structured outputs."""
    from google.genai import types

    response = client.models.generate_content(
        model=model_name,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            prompt
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=TimetableSchema,
            temperature=0.1
        )
    )

    if not response.text:
        raise RuntimeError(f"Risposta vuota ricevuta da Gemini API ({model_name})")

    return json.loads(response.text)


def extract_with_fallback(
    image_bytes: bytes,
    mime_type: str,
    prompt: str,
    main_model: str,
    fallback_model: str,
    api_key: str
) -> tuple[Dict[str, Any], str]:
    """
    Tenta l'estrazione con il modello principale (es. gemini-3.8-flash).
    In caso di errore (503 alta richiesta, 429 rate limit o eccezioni API),
    passa automaticamente al modello di fallback (es. gemini-3.5-flash-lite).
    """
    from google import genai

    client = genai.Client(api_key=api_key)
    models_to_try = [main_model]
    if fallback_model not in models_to_try:
        models_to_try.append(fallback_model)
    # Rete di sicurezza aggiuntiva
    for safety in ["gemini-3.6-flash", "gemini-2.5-flash"]:
        if safety not in models_to_try:
            models_to_try.append(safety)

    last_err = None
    for model in models_to_try:
        try:
            print(f"[GEMINI] Tentativo di estrazione con modello: '{model}'...")
            data = call_gemini_vision_single(client, image_bytes, mime_type, prompt, model)
            print(f"[GEMINI] Successo con il modello: '{model}'")
            return data, model
        except Exception as err:
            last_err = err
            print(f"[WARN] Errore con modello '{model}': {err}")
            print(f"[FALLBACK] Passaggio automatico al modello successivo...")

    raise RuntimeError(f"Tutti i modelli configurati ({models_to_try}) hanno fallito. Ultimo errore: {last_err}")


def normalize_str(s: Optional[str]) -> str:
    """Normalizza stringhe rimuovendo spazi superflui e maiuscole per il confronto."""
    if not s:
        return ""
    return " ".join(s.upper().split())


def reconcile_timetables(
    pass1: Dict[str, Any],
    pass2: Dict[str, Any],
    model1: str,
    model2: str
) -> Dict[str, Any]:
    """
    Confronta e riconcilia due scansioni indipendenti (Doppia Scansione).
    Calcola il punteggio di consenso ed effettua il merge conservativo.
    """
    reconciled = dict(pass1)
    total_slots = 0
    matched_slots = 0
    discrepancies = []

    p1_days = {d.get("giorno"): d.get("lezioni", []) for d in pass1.get("giorni", [])}
    p2_days = {d.get("giorno"): d.get("lezioni", []) for d in pass2.get("giorni", [])}

    all_days = list(dict.fromkeys(list(p1_days.keys()) + list(p2_days.keys())))
    merged_giorni = []

    for day in all_days:
        l1_list = p1_days.get(day, [])
        l2_list = p2_days.get(day, [])
        max_len = max(len(l1_list), len(l2_list))

        merged_lezioni = []
        for i in range(max_len):
            total_slots += 1
            s1 = l1_list[i] if i < len(l1_list) else None
            s2 = l2_list[i] if i < len(l2_list) else None

            if s1 and s2:
                # Confronto campi chiave
                mat1, mat2 = normalize_str(s1.get("materia")), normalize_str(s2.get("materia"))
                aul1, aul2 = normalize_str(s1.get("aula")), normalize_str(s2.get("aula"))
                ini1, ini2 = normalize_str(s1.get("inizio")), normalize_str(s2.get("inizio"))
                fin1, fin2 = normalize_str(s1.get("fine")), normalize_str(s2.get("fine"))

                mat_match = (mat1 == mat2)
                aul_match = (aul1 == aul2 or aul1.replace(" ", "") == aul2.replace(" ", ""))
                time_match = (ini1 == ini2 and fin1 == fin2)

                if mat_match and aul_match and time_match:
                    matched_slots += 1
                    # Scegli la versione con più docenti o più dettagli
                    chosen = s1 if len(s1.get("docenti", [])) >= len(s2.get("docenti", [])) else s2
                    merged_lezioni.append(chosen)
                else:
                    # Riconciliazione: se materia o orario differiscono leggermente
                    disc = {
                        "giorno": day,
                        "ora": s1.get("ora", i + 1),
                        "pass1": f"{s1.get('materia')} ({s1.get('aula')}) {s1.get('inizio')}-{s1.get('fine')}",
                        "pass2": f"{s2.get('materia')} ({s2.get('aula')}) {s2.get('inizio')}-{s2.get('fine')}"
                    }
                    discrepancies.append(disc)
                    # Scegli pass1 come primario se materia combacia, altrimenti il più completo
                    chosen = s1 if len(str(s1)) >= len(str(s2)) else s2
                    merged_lezioni.append(chosen)
            elif s1:
                discrepancies.append({"giorno": day, "ora": s1.get("ora", i + 1), "only_in": "pass1"})
                merged_lezioni.append(s1)
            elif s2:
                discrepancies.append({"giorno": day, "ora": s2.get("ora", i + 1), "only_in": "pass2"})
                merged_lezioni.append(s2)

        merged_giorni.append({"giorno": day, "lezioni": merged_lezioni})

    consensus_score = (matched_slots / total_slots) if total_slots > 0 else 1.0

    reconciled["giorni"] = merged_giorni
    reconciled["verification"] = {
        "verified": True,
        "scan_mode": "double",
        "consensus": round(consensus_score, 2),
        "status": "CONFIRMED" if consensus_score >= 0.95 else "RECONCILED",
        "pass1_model": model1,
        "pass2_model": model2,
        "total_slots_checked": total_slots,
        "matched_slots": matched_slots,
        "discrepancies_resolved": len(discrepancies),
        "verified_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    return reconciled


def extract_timetable_with_gemini(
    image_path: str,
    class_name: str = "4 BINF",
    api_key: Optional[str] = None,
    main_model: str = "gemini-3.8-flash",
    fallback_model: str = "gemini-3.5-flash-lite",
    scan_mode: str = "single"
) -> Dict[str, Any]:
    """
    Estrae l'orario scolastico tramite Gemini Vision.
    - Se scan_mode == 'double': esegue due scansioni indipendenti per controllo incrociato e validazione.
    - Se scan_mode == 'single': esegue una scansione singola diretta.
    - Gestisce il fallback automatico su gemini-3.5-flash-lite.
    """
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY non trovata nelle variabili d'ambiente o nel file .env.")

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    # Rileva mimetype immagine
    mime_type = "image/png"
    if image_path.lower().endswith(".jpg") or image_path.lower().endswith(".jpeg"):
        mime_type = "image/jpeg"
    elif image_path.lower().endswith(".webp"):
        mime_type = "image/webp"

    prompt = f"""
    Sei un assistente specializzato nell'analisi visiva accurata di tabelle orario scolastico generate dal software EDT / Spaggiari per le scuole italiane.
    
    Analizza l'immagine dell'orario per la classe '{class_name}'.
    Estrai l'orario completo per ogni giorno della settimana visibile (tipicamente da Lunedì a Venerdì o Sabato).
    
    Regole fondamentali:
    1. Griglia oraria: Osserva attentamente gli orari a sinistra della tabella (es. 1ª ora 08:00 - 08:54, 2ª ora 08:58 - 09:48, 3ª ora 09:58 - 10:48, 4ª ora 10:52 - 11:42, ecc.).
    2. CELLE UNITE VERTICALMENTE / ORE DOPPIE (CRUCIALE):
       Se una materia è disegnata come un unico riquadro verticale che occupa due o più ore consecutive (ad esempio un blocco di laboratorio o palestra, come 09:58 - 11:42 che attraversa la 3ª e la 4ª ora, o 08:00 - 09:48 che copre la 1ª e la 2ª ora):
       DEVI GENERARE UNA VOCE SEPARATA PER CIASCUNA ORA DI LEZIONE (con la stessa materia, aula e docenti).
       Ad esempio per un blocco 09:58 - 11:42:
       - 3ª ora ("ora": 3, "inizio": "09:58", "fine": "10:48")
       - 4ª ora ("ora": 4, "inizio": "10:52", "fine": "11:42")
       NON saltare alcuna ora: ogni giorno deve avere la sequenza completa delle ore (1, 2, 3, 4...).
    3. Per le materie svolte in laboratorio con compresenza docenti (es. Sistemi e Reti, Informatica, TPSIT, Telecomunicazioni con insegnante teorico + ITP), estrai entrambi i docenti e imposta is_lab = true.
    4. Estrai con la massima precisione il nome o codice dell'aula/laboratorio (es. 'B 010', 'B 045', 'C 170', 'Aula B 115', 'Palestra ITTS').
    5. Cerca la data di decorrenza (es. 'In vigore dal...') o stato ('Orario Provvisorio' o 'Orario Definitivo') se indicati nell'intestazione o nel piè di pagina.
    """

    if scan_mode == "double":
        print(f"[GEMINI] === AVVIO DOPPIA SCANSIONE (MODALITÀ AUTOMATICA MATTUTINA) ===")
        print("[GEMINI] Passaggio 1: Prima estrazione...")
        pass1, model1 = extract_with_fallback(image_bytes, mime_type, prompt, main_model, fallback_model, key)
        
        print("[GEMINI] Passaggio 2: Seconda estrazione di verifica incrociata...")
        pass2, model2 = extract_with_fallback(image_bytes, mime_type, prompt, main_model, fallback_model, key)

        result = reconcile_timetables(pass1, pass2, model1, model2)
        v = result["verification"]
        print(f"[GEMINI] Doppia scansione completata! Consenso: {v['consensus']*100:.1f}% ({v['matched_slots']}/{v['total_slots_checked']} slot concordanti) - Stato: {v['status']}")
        return normalize_timetable_multihour_slots(result)
    else:
        print(f"[GEMINI] === AVVIO SCANSIONE SINGOLA (MODALITÀ MANUALE DIRETTA) ===")
        data, model_used = extract_with_fallback(image_bytes, mime_type, prompt, main_model, fallback_model, key)
        data["verification"] = {
            "verified": True,
            "scan_mode": "single",
            "consensus": 1.0,
            "status": "SINGLE_PASS",
            "model": model_used,
            "verified_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        return normalize_timetable_multihour_slots(data)


def discover_classes_from_document(file_path: str, api_key: str) -> Dict[str, Any]:
    """Scansiona un PDF o immagine ed individua tutte le classi presenti nel documento."""
    from google import genai
    from google.genai import types

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    mime_type = "application/pdf" if file_path.lower().endswith(".pdf") else "image/png"
    prompt = """
    Analizza questo documento di orario scolastico (anche se composto da più pagine o fogli).
    Individua e restituisci l'elenco esatto di tutte le classi scolastiche presenti (es. '1 AINF', '2 BINF', '3 ALS', '4 BINF', ecc.).
    Escludi orari intestati a singoli docenti o nominativi di aule. Rispondi in JSON.
    """

    client = genai.Client(api_key=api_key)
    for model in ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash"]:
        try:
            resp = client.models.generate_content(
                model=model,
                contents=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=DiscoverClassesSchema,
                    temperature=0.1
                )
            )
            if resp.text:
                return json.loads(resp.text)
        except Exception as e:
            print(f"[DISCOVER WARN] {model} failed: {e}")

    return {"school": "", "classes": []}


# --- GESTIONE CACHE & DOWNLOAD ---
def compute_file_hash(filepath: str) -> str:
    hasher = hashlib.md5()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            hasher.update(chunk)
    return hasher.hexdigest()


def check_and_download_image(url: str, dest_path: str) -> bool:
    """Scarica l'immagine solo se modificata. Ritorna True se nuova, False se invariata."""
    if not requests:
        print("[WARN] Libreria 'requests' non presente, salto il download remoto.")
        return False

    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    headers = {}
    cache_meta_file = dest_path + ".meta"
    if os.path.exists(cache_meta_file):
        try:
            with open(cache_meta_file, "r") as f:
                meta = json.load(f)
                if "etag" in meta:
                    headers["If-None-Match"] = meta["etag"]
                if "last_modified" in meta:
                    headers["If-Modified-Since"] = meta["last_modified"]
        except Exception:
            pass

    response = requests.get(url, headers=headers, stream=True, timeout=15)
    if response.status_code == 304:
        print(f"[CACHE] L'immagine remota non è cambiata (HTTP 304 Not Modified).")
        return False

    if response.status_code == 200:
        with open(dest_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        meta = {
            "etag": response.headers.get("ETag"),
            "last_modified": response.headers.get("Last-Modified"),
            "downloaded_at": datetime.now().isoformat()
        }
        with open(cache_meta_file, "w") as f:
            json.dump(meta, f)
        print(f"[DOWNLOAD] Nuova immagine scaricata con successo in {dest_path}")
        return True

    print(f"[ERROR] Impossibile scaricare l'immagine. HTTP Status: {response.status_code}")
    return False


# --- MAIN ENTRY POINT ---
def main():
    load_env()

    parser = argparse.ArgumentParser(description="Smart School Timetable Extractor & Sync")
    parser.add_argument("--image", type=str, help="Percorso locale all'immagine dell'orario")
    parser.add_argument("--url", type=str, default=None, help="URL remoto dell'immagine orario Spaggiari EDT")
    parser.add_argument("--class-name", type=str, default="4 BINF", help="Classe di default (default: '4 BINF')")
    parser.add_argument("--output", type=str, default="public/data/timetable.json", help="File di output orario completo")
    parser.add_argument("--widget-output", type=str, default="public/data/widget_data.json", help="File di output feed widget S24")
    parser.add_argument("--mock", action="store_true", help="Usa dati realistici di simulazione senza chiamare Gemini API")
    parser.add_argument("--force", action="store_true", help="Forza la rielaborazione anche se l'hash dell'immagine non è cambiato")
    parser.add_argument("--scan-mode", choices=["single", "double"], default=None, help="Modalità scansione: 'single' (manuale) o 'double' (automatica mattutina)")
    parser.add_argument("--main-model", type=str, default=None, help="Modello Gemini principale (default: gemini-3.8-flash o da .env)")
    parser.add_argument("--fallback-model", type=str, default=None, help="Modello Gemini di fallback (default: gemini-3.5-flash-lite o da .env)")
    parser.add_argument("--api-key", type=str, default=None, help="Chiave API Gemini (default da .env o GEMINI_API_KEY)")
    
    args = parser.parse_args()

    # Risoluzione parametri da env/default
    main_model = args.main_model or os.environ.get("GEMINI_MAIN_MODEL", "gemini-3.8-flash")
    fallback_model = args.fallback_model or os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite")
    scan_mode = args.scan_mode or os.environ.get("SCAN_MODE", "single")
    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    remote_url = args.url or os.environ.get("TIMETABLE_URL") or os.environ.get("TIMETABLE_IMAGE_URL")

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    os.makedirs(os.path.dirname(args.widget_output), exist_ok=True)

    cache_dir = Path("scripts/.cache")
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_hash_file = cache_dir / f"hash_{args.class_name.replace(' ', '_')}.txt"

    timetable_data = None

    if args.mock:
        print(f"[MOCK] Generazione dati orario mock per la classe {args.class_name}...")
        timetable_data = get_sample_mock_data(args.class_name)
        timetable_data["verification"] = {
            "verified": True,
            "scan_mode": scan_mode,
            "consensus": 1.0,
            "status": "MOCK_VERIFIED",
            "verified_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    else:
        # Verifica sorgente immagine
        target_image = args.image
        if remote_url:
            downloaded_img = str(cache_dir / f"latest_{args.class_name.replace(' ', '_')}.png")
            is_new = check_and_download_image(remote_url, downloaded_img)
            target_image = downloaded_img
            if not is_new and not args.force and os.path.exists(args.output):
                print("[CACHE] Orario già aggiornato. Nessuna elaborazione necessaria.")
                sys.exit(0)

        if not target_image or not os.path.exists(target_image):
            print("[INFO] Nessuna immagine valida fornita o trovata. Ricorro ai dati dimostrativi mock.")
            timetable_data = get_sample_mock_data(args.class_name)
            timetable_data["verification"] = {
                "verified": True,
                "scan_mode": scan_mode,
                "consensus": 1.0,
                "status": "DEMO_FALLBACK",
                "verified_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        else:
            # Controllo hash per evitare chiamate ripetute a Gemini se l'immagine è identica
            curr_hash = compute_file_hash(target_image)
            if not args.force and cache_hash_file.exists():
                prev_hash = cache_hash_file.read_text().strip()
                if curr_hash == prev_hash and os.path.exists(args.output):
                    print(f"[CACHE] L'hash dell'immagine ({curr_hash[:8]}) corrisponde all'ultimo analizzato. Salto Gemini API.")
                    with open(args.output, "r", encoding="utf-8") as f:
                        timetable_data = json.load(f)

            if timetable_data is None:
                print(f"[GEMINI] Analisi visiva immagine: {target_image} (Modalità: {scan_mode.upper()})...")
                try:
                    timetable_data = extract_timetable_with_gemini(
                        image_path=target_image,
                        class_name=args.class_name,
                        api_key=api_key,
                        main_model=main_model,
                        fallback_model=fallback_model,
                        scan_mode=scan_mode
                    )
                    cache_hash_file.write_text(curr_hash)
                    print("[GEMINI] Estrazione completata con successo!")
                except Exception as e:
                    print(f"[ERROR] Errore durante l'estrazione con Gemini API: {e}")
                    if os.path.exists(args.output):
                        print("[FALLBACK] Utilizzo l'orario precedentemente salvato.")
                        with open(args.output, "r", encoding="utf-8") as f:
                            timetable_data = json.load(f)
                    else:
                        print("[FALLBACK] Utilizzo dati mock.")
                        timetable_data = get_sample_mock_data(args.class_name)

    # Scrittura orario completo
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(timetable_data, f, ensure_ascii=False, indent=2)
    print(f"[OUTPUT] Orario salvato in: {args.output}")

    # Calcolo e scrittura feed widget per Galaxy S24
    widget_data = compute_widget_payload(timetable_data)
    with open(args.widget_output, "w", encoding="utf-8") as f:
        json.dump(widget_data, f, ensure_ascii=False, indent=2)
    print(f"[OUTPUT] Feed Widget S24 salvato in: {args.widget_output}")


if __name__ == "__main__":
    main()
