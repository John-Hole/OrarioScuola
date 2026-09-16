# 📋 Task List & Roadmap di Sviluppo

Documento di pianificazione per le prossime iterazioni del progetto **Smart School Timetable**.

---

## 📌 1. Integrazione Funzione API
- [ ] **Endpoint & Backend/Serverless:**
  - Definire un endpoint API unificato (locale o serverless, es. Cloudflare Workers / Vercel Functions / backend Python) per esporre i dati orario.
  - Sostituire il caricamento statico esclusivo da file con chiamate API REST / JSON dinamiche.
- [ ] **Pipeline Gemini Vision:**
  - Automatizzare l'invocazione di `sync_timetable.py` tramite trigger API o webhook quando viene caricata una nuova circolare o immagine Spaggiari EDT.
  - Configurazione sicura della chiave `GEMINI_API_KEY` ed eventuale fallback offline con cache su IndexedDB/localStorage.
- [ ] **Gestione Errori & Retry:**
  - Fallback automatico su cache locale in caso di assenza di connessione o errore API.
  - Polling intelligente o notifiche di aggiornamento orario per gli utenti.

---

## 🏫 2. Sistemazione Gestione Classi
- [ ] **Supporto Multi-Classe Dinamico:**
  - Estendere la struttura dati per supportare l'intero istituto o tutte le classi disponibili (non solo la 4 BINF con mock limitato).
  - Creare una mappa JSON/database con file per classe (es. `data/classes/4_BINF.json`, `data/classes/4_AINF.json`, ecc.) o un indice unificato.
- [ ] **Interfaccia Selezione & Ricerca Classi:**
  - Gestione avanzata tramite modale 'Cambia Orario' con ricerca orari e autocompletamento.
- [ ] **Persistenza & Switch Istantaneo:**
  - Salvataggio classe preferita su `localStorage` e ricaricamento istantaneo dell'orario senza refresh completo della pagina.
  - Aggiornamento contestuale di timeline, griglia settimanale e widget.

---

## 🚪 3. Funzione Orario Aule
- [ ] **Struttura Dati Inversa per Aule:**
  - Generare automaticamente l'indice di occupazione aule a partire dagli orari delle classi (`scripts/sync_timetable.py` o helper JS).
- [ ] **Vista Dedicata "Orario Aule":**
  - Nuova vista (o tab nella navigazione/drawer) con selettore aula/laboratorio (es. *B 010 LAB RETI*, *C 170*, *B 115*).
  - Visualizzazione settimanale o giornaliera: quale classe e quale docente occupano l'aula per ogni ora.
- [ ] **Rilevatore Aule Libere:**
  - Funzionalità "Cerca Aule Libere Adesso" per trovare rapidamente spazi disponibili durante ore buche, assemblee o supplenze.

---

## 👨‍🏫 4. Funzione Orario Professori
- [ ] **Struttura Dati Inversa per Docenti:**
  - Mappatura completa Docente -> Orario settimanale (giorno, ora, classe, aula).
  - Corretta gestione delle **compresenze** (insegnante di teoria + ITP, es. Mancino + Righi).
- [ ] **Vista Dedicata "Orario Docenti":**
  - Voce di menu nel Drawer per accedere alla sezione Professori.
  - Ricerca rapida con completamento automatico del cognome del docente.
  - Tabella orario del docente con indicazione delle classi, aule e delle ore libere / di disposizione.
- [ ] **Indicatore "Dove si trova adesso?":**
  - Scheda rapida per visualizzare in tempo reale in quale aula/classe sta insegnando un docente nell'ora corrente.

---

## 📱 5. Sistemazione & Ottimizzazione Widget (Galaxy S24 / PWA)
- [ ] **Feed Multi-Classe per il Widget:**
  - Adattare `widget_data.json` per supportare parametri (es. `widget_data.json?classe=4BINF`) oppure generare file dedicati per classe/aula/docente.
- [ ] **Perfezionamento Stati & Transizioni:**
  - Verificare e rifinire le condizioni limite:
    - Prima delle lezioni (countdown preciso alla prima ora).
    - Durante le lezioni (tempo residuo, materia corrente, aula).
    - Cambio ora (avviso aula di destinazione per spostamento zaino).
    - Ricreazione (tempo rimanente al suono della seconda campana).
    - Uscita da scuola e anteprima del giorno successivo (salto del weekend dal venerdì pomeriggio al lunedì).
- [ ] **Integrazione KWGT / One UI & Lock Screen:**
  - Aggiornare e collaudare i template di stringhe e formule KWGT per One UI 6.x / Lock Screen / AOD su Galaxy S24.
  - Creare un mini-widget interno alla PWA per visualizzazione immediata anche da browser mobile.
