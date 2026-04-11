# 🎧 SUPERFLUIDO Bunker - Music Label ERP & Management Hub

SUPERFLUIDO Bunker è un gestionale web-based (ERP) full-stack progettato su misura per le esigenze di un collettivo musicale/etichetta indipendente. Centralizza la gestione del magazzino, l'organizzazione degli eventi live, l'archiviazione di progetti audio e la generazione automatizzata di Press Kit.

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
✨ Core Features
🔐 Role-Based Access Control (RBAC): Sistema di login con permessi differenziati (Master vs Membro) per proteggere le operazioni critiche di eliminazione dati.

🗓️ Calendario Sincronizzato: Integrazione con FullCalendar. Gestione avanzata dei fusi orari (Timezone Europea fissa) per evitare slittamenti di date tra server UTC e client locali. Doppia vista (Griglia mensile e Lista Promemoria).

📦 Gestione Magazzino (Merch): Sistema CRUD per inventario con gestione delle varianti (es. taglie). Calcolo automatico dei margini di profitto e alert dinamici per le scorte in esaurimento (sotto i 15 pezzi).

🎧 Studio Hub (Progetti Privati): Interfaccia stile "Spotify for Artists". Caricamento diretto di file audio su Supabase Storage, player audio nativo integrato e tracciamento della fase del brano (Beat, Provini, Mix, Master).

🤖 Press-Kit Generator: Motore basato su FPDF2 che compila dinamicamente un PDF professionale (Bio, Lineup, Tech Rider, Hospitality) incrociando i profili degli artisti selezionati dal database.

💅 Custom UI/UX: Override massiccio del CSS nativo di Streamlit per ottenere un'estetica "Dark Mode / Bunker", navbar con effetto glassmorphism, disattivazione dinamica dello zoom sulle immagini e layout responsive centrati tramite container flessibili.

🛠️ Tech Stack
Frontend: Python, Streamlit, Streamlit-Option-Menu, Streamlit-Calendar

Backend & Database: Supabase (PostgreSQL, Auth, Storage)

Data Visualization: Plotly, Pandas

Utility: FPDF2 (Generazione documenti), ZoneInfo (Gestione Timezone)
