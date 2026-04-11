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
