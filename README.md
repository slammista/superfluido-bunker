# 🎧 SUPERFLUIDO Bunker - Music Label ERP & Management Hub

SUPERFLUIDO Bunker è un gestionale web-based (ERP) full-stack progettato su misura per le esigenze di un collettivo musicale/etichetta indipendente. Centralizza la gestione del magazzino, l'organizzazione degli eventi live, l'archiviazione di progetti audio e la generazione automatizzata di Press Kit.

---

## 📸 Sneak Peek

<div align="center">
  <img src="docs/home.png" alt="Home Dashboard" width="45%">
  &nbsp;
  <img src="docs/calendario.png" alt="Calendario Eventi" width="45%">
</div>
<br>
<div align="center">
  <img src="docs/progetti.png" alt="Studio Hub & Audio Player" width="31%">
  &nbsp;
  <img src="docs/inventario.png" alt="Gestione Magazzino" width="31%">
  &nbsp;
  <img src="docs/press-kit.png" alt="ALERT MAGAZZINO" width="31%">
</div>

---

## 🏗️ Architettura di Sistema

```mermaid
graph TD
    Client[Browser Web / Mobile] -->|HTTPS| Frontend(Streamlit Frontend - Python)
    
    subgraph Streamlit Cloud Environment
        Frontend
        PDFGen[Generatore PDF - FPDF2]
        DataViz[Dashboard DataViz - Plotly]
    end

    Frontend <-->|Supabase Python Client| BaaS[Supabase Backend]

    subgraph Supabase Cloud
        BaaS --> Auth[Autenticazione & Ruoli]
        BaaS --> DB[(PostgreSQL Database)]
        BaaS --> Storage[Storage Buckets]
    end

    DB -->|Tabelle Relazionali| Features
    Storage -->|Audio .wav/.mp3 & Immagini| Features

    subgraph Moduli Core
        Features --> C[🗓️ Calendario Condiviso]
        Features --> M[📦 Magazzino & Varianti]
        Features --> S[🎧 Studio Hub / Audio Player]
        Features --> V[🗃️ Vault Documenti]
    end

YOOOO! 🚀 Hai perfettamente ragione, colpa mia! Ti ho dato l'aggiornamento "tagliando" la testa al file. 

Ho corretto anche un piccolo refuso nel codice delle immagini (l'immagine `press-kit.png` aveva come testo alternativo "ALERT MAGAZZINO", l'ho sistemato in "Generatore Press Kit" per renderlo perfetto).

Ecco il **Master File definitivo, da cima a fondo**, che unisce la tua prima parte con tutta la ciccia ingegneristica. Clicca "Copia" qui sotto e sovrascrivi tutto il README. Sarà un capolavoro! 🔥

```markdown
# 🎧 SUPERFLUIDO Bunker - Music Label ERP & Management Hub

SUPERFLUIDO Bunker è un gestionale web-based (ERP) full-stack progettato su misura per le esigenze di un collettivo musicale/etichetta indipendente. Centralizza la gestione del magazzino, l'organizzazione degli eventi live, l'archiviazione di progetti audio e la generazione automatizzata di Press Kit.

---

## 📸 Sneak Peek

<div align="center">
  <img src="docs/home.png" alt="Home Dashboard" width="45%">
  &nbsp;
  <img src="docs/calendario.png" alt="Calendario Eventi" width="45%">
</div>
<br>
<div align="center">
  <img src="docs/progetti.png" alt="Studio Hub & Audio Player" width="31%">
  &nbsp;
  <img src="docs/inventario.png" alt="Gestione Magazzino" width="31%">
  &nbsp;
  <img src="docs/press-kit.png" alt="Generatore Press Kit" width="31%">
</div>

---

## 🏗️ Architettura di Sistema

```mermaid
graph TD
    Client[Browser Web / Mobile] -->|HTTPS| Frontend(Streamlit Frontend - Python)
    
    subgraph Streamlit Cloud Environment
        Frontend
        PDFGen[Generatore PDF - FPDF2]
        DataViz[Dashboard DataViz - Plotly]
    end

    Frontend <-->|Supabase Python Client| BaaS[Supabase Backend]

    subgraph Supabase Cloud
        BaaS --> Auth[Autenticazione & Ruoli]
        BaaS --> DB[(PostgreSQL Database)]
        BaaS --> Storage[Storage Buckets]
    end

    DB -->|Tabelle Relazionali| Features
    Storage -->|Audio .wav/.mp3 & Immagini| Features

    subgraph Moduli Core
        Features --> C[🗓️ Calendario Condiviso]
        Features --> M[📦 Magazzino & Varianti]
        Features --> S[🎧 Studio Hub / Audio Player]
        Features --> V[🗃️ Vault Documenti]
    end
```

---

## 📖 The Story: Concept & Value Proposition

La gestione di un collettivo musicale o di un'etichetta indipendente richiede solitamente un ecosistema frammentato: Google Drive per i file, WhatsApp per la comunicazione, Excel per il magazzino e piattaforme esterne (spesso costose o limitate, come *untitled.stream*) per l'ascolto dei provini.

**SUPERFLUIDO Bunker nasce per centralizzare tutto questo in un unico Hub privato e senza limiti.**
Il vero valore aggiunto del tool risiede nella sua natura ibrida: non è solo un gestionale, ma un vero e proprio ecosistema operativo. 
* **Cloud Audio Illimitato e Strutturato:** A differenza di servizi terzi con limiti di spazio o caricamento disordinato, lo *Studio Hub* permette di avere un proprio cloud personale su Supabase Storage. Ogni progetto (album/singolo) contiene le tracce organizzate per **fase di lavorazione** (*Beat, Provini, Mix, Master*). Questo permette a produttori e cantanti di avere sempre lo storico dell'evoluzione di una traccia in un unico posto.
* **Automazione per il Live:** Generare un Press-Kit o un Tech Rider richiede tempo. L'app integra un motore AI-based che, selezionando i membri presenti a un evento, compila un PDF ad hoc calcolando automaticamente le esigenze logistiche (es. *tot* bottiglie d'acqua in base ai membri) e recuperando le strumentazioni aggiornate di ciascun artista dal database.

---

## 🧠 Engineering & Problem Solving

Sviluppare un ERP su Streamlit ha richiesto di superare i limiti nativi del framework, progettato principalmente per dashboard di data science, per trasformarlo in una vera e propria Web App.

### 1. UI/UX Overriding & State Management
Per ottenere l'estetica "Dark Mode / Bunker" e un'esperienza utente fluida (simile a *Spotify for Artists*):
* **CSS Injection:** Ho effettuato un override chirurgico del CSS nativo di Streamlit. Ho rimosso l'header nativo, eliminato i padding eccessivi e forzato i layout centrali usando flexbox. 
* **Image Zoom Disable:** Per mantenere un aspetto professionale (es. nella pagina di Login), ho disabilitato il comportamento di default di Streamlit che permette l'espansione delle immagini, utilizzando regole CSS come `pointer-events: none` sui container delle immagini.
* **Session State:** Navigazione senza ricaricamento pagina gestita interamente tramite `st.session_state` e `streamlit-option-menu`, garantendo persistenza dei dati durante l'uso (es. tenendo in memoria un audio in riproduzione mentre si consulta un'altra vista del progetto).

### 2. Timezone Hell & Data Integrity
La gestione del calendario presentava un problema critico: i server Cloud (Supabase e Streamlit) operano in UTC, causando lo slittamento degli eventi serali (es. un live alle 22:30 a Roma) al giorno successivo a causa del fuso orario (+1/+2 ore).
* **Soluzione:** Ho implementato la libreria `zoneinfo` di Python per forzare l'hardcoding della timezone (`Europe/Rome`). Ogni stringa ISO recuperata dal database viene convertita esplicitamente prima del rendering su `FullCalendar`, garantendo precisione assoluta negli orari di inizio e fine evento.

### 3. Sicurezza, RBAC e Gestione Segreti
L'app gestisce dati sensibili, file privati e scorte di magazzino.
* **Role-Based Access Control:** Implementato un sistema di ruoli (Master vs Membro). Un membro può creare eventi o caricare tracce, ma solo il ruolo "Master" (o l'owner del record) ha l'autorizzazione per eseguire operazioni di `DELETE` sul database.
* **Secrets Management:** In fase di deploy su Streamlit Community Cloud, le chiavi API e gli URL del database sono stati rimossi dal codice sorgente (addio file `.env`) e migrati nel sistema blindato `st.secrets`, escludendo i file sensibili tramite `.gitignore`.

---

## ✨ Core Features Detail

* **🎧 Studio Hub (Progetti Privati):** Gestione cloud completa. Upload sicuro dei file .wav/.mp3 nel bucket Supabase, ascolto integrato tramite player nativo e metadatazione per fasi di sviluppo (Beat, Provini, Mix, Master). 
* **🤖 Press-Kit Generator & Vault:** Utilizzo di `FPDF2` per la generazione on-the-fly di documenti PDF. Il sistema incrocia le biografie e le schede tecniche degli artisti nel DB, genera il layout personalizzato e archivia una copia nel "Vault" cloud per il download futuro.
* **🗓️ Calendario Sincronizzato:** Implementazione di `streamlit-calendar` con CSS custom. Offre una classica visualizzazione a griglia mensile per la pianificazione e una comodissima **Vista Promemoria stile iPhone** per il check rapido degli impegni della settimana da mobile.
* **📦 Gestione Magazzino (Merch):** Modulo ERP per l'inventario. Gestisce prodotti, varianti multiple (es. taglie magliette) e calcola in tempo reale i margini di profitto (Prezzo Vendita - Costo Produzione). Include dashboard con Alert per le scorte in esaurimento.
* **👤 Gestione Profili:** Spazio personale dove ogni artista aggiorna la propria bio, i link social e la strumentazione live. Modificare un profilo qui aggiorna automaticamente i futuri Press-Kit generati.

---

## 🧪 Testing & Deploy

L'app ha superato diverse fasi di testing prima della release:
* **UI Responsiveness:** Test di adattabilità del CSS custom per schermi Desktop e Mobile (inclusa la centratura forzata del login box).
* **Boundary Testing (Auth):** Verifica dei limiti di sicurezza RBAC (tentativi di eliminazione incrociata tra account "membro").
* **Storage I/O:** Test di latenza e stabilità nell'upload/download di file audio pesanti verso Supabase Storage e generazione dinamica di link pubblici sicuri.
* **CI/CD:** Deploy continuo tramite repository GitHub collegato a Streamlit Cloud, con gestione automatica delle dipendenze via `requirements.txt`.

---

## 🛠️ Tech Stack Completo

* **Frontend:** Python 3, Streamlit, Streamlit-Option-Menu, Streamlit-Calendar
* **Backend & Database:** Supabase (PostgreSQL, Supabase Auth, Supabase Storage Buckets)
* **Data Visualization & Logic:** Plotly (Grafici di tendenza), Pandas (Manipolazione dati di magazzino)
* **Documenti & Utilities:** FPDF2 (PDF Engine), Python `zoneinfo` (Timezone management), `uuid` (Gestione identificativi univoci per i file cloud)
```    
