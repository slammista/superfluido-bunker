# SUPERFLUIDO BUNKER — Briefing tecnico per Claude Code
> Ultimo aggiornamento: maggio 2026  
> Stato: frontend deployato su Vercel, backend Supabase non funzionante

---

## Contesto

App Next.js (App Router) + Supabase + Groq, deploy su Vercel.  
Il frontend gira correttamente. Tutte le operazioni di scrittura su Supabase (crea evento, crea album, aggiungi traccia, aggiungi prodotto, salva profilo, carica vault) **non fanno nulla** senza mostrare errori.

Questo briefing contiene la diagnosi completa, le correzioni da applicare e i file già pronti da sostituire.

---

## Diagnosi — 4 cause radice trovate

### 1. CHECK CONSTRAINT violati → INSERT silenziosamente rigettati da Supabase

| Tabella | Constraint attuale nel DB | Valore inviato dal codice | Risultato |
|---|---|---|---|
| `products` | `Vestiario, Supporto Fisico, Tele, Altro` | `"Merch"` (hardcoded nel form) | INSERT rifiutato |
| `tracce_audio` | `Beat, Provini, Mix, Master` | `"Demo"` (opzione nel Select) | INSERT rifiutato |

**Fix:** eseguire `supabase_fix.sql` (blocchi 1 e 2) per allargare i constraint senza toccare i dati esistenti.

### 2. RLS senza policy → ogni operazione ritorna 0 righe senza errore visibile

Row Level Security è abilitato su tutte le tabelle ma nessuna policy autorizza gli utenti autenticati. Supabase restituisce risposta vuota (non un errore), quindi il codice prosegue come se tutto fosse andato bene.

**Fix:** eseguire `supabase_fix.sql` (blocco 3) per creare le policy.

### 3. Nessun error handling nel codice frontend

Tutte le funzioni di scrittura (`createEvent`, `createAlbum`, `addTrack`, `addDemoProduct`, `saveProfile`, `uploadFile`) non controllano mai `error` dalla risposta Supabase. Il flusso prosegue silenziosamente anche in caso di fallimento.

**Fix:** sostituire `src/components/superfluido-app.tsx` con il file corretto già pronto.

### 4. `vault_documenti` insert senza `caricato_da`

Il codice originale non passa `caricato_da: user.id` nell'insert su `vault_documenti`. Il campo è nullable quindi non rompe, ma i file non hanno owner. Corretto nel file nuovo.

---

## Operazioni da eseguire — in questo ordine

### Step 1 — Supabase SQL Editor

Aprire il progetto Supabase → **SQL Editor** → eseguire il file `supabase_fix.sql` **blocco per blocco**:

- **Blocco 1** — Allarga constraint `products.category` (aggiunge Merch, Vinile, Print, Accessori)
- **Blocco 2** — Allarga constraint `tracce_audio.fase` (aggiunge Demo)
- **Blocco 3** — Crea RLS policy per tutte le tabelle applicative
- **Blocco 4** — Crea bucket storage `audio` e `vault` (solo se non esistono già — verificare prima su Storage nel dashboard)

> ⚠️ Zero DROP. Zero perdita dati. Solo ALTER TABLE e INSERT ON CONFLICT DO NOTHING.

### Step 2 — Sostituire il componente principale

```bash
cp superfluido-app.tsx src/components/superfluido-app.tsx
```

Il file nuovo contiene:
- Error handling su ogni operazione Supabase (toast visibile con messaggio d'errore reale)
- Toast di successo/errore (componente `Toast` in basso a destra, auto-dismiss 4s)
- `PRODUCT_CATEGORIES` allineate al constraint DB aggiornato
- `TRACK_PHASES` allineate al constraint DB (`Beat, Provini, Demo, Mix, Master`)
- `loading` state su ogni pulsante (spinner durante il salvataggio)
- Stato vuoto esplicito ("Nessun evento in calendario") invece di tabelle vuote
- `caricato_da: user.id` aggiunto all'insert di `vault_documenti`
- `album_progetti` ora ordinati per `created_at DESC`

### Step 3 — Verifica variabili ambiente su Vercel

Aprire Vercel → progetto `superfluido-bunker` → **Settings → Environment Variables**.  
Verificare che siano presenti e non vuote:

```
NEXT_PUBLIC_SUPABASE_URL      = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
GROQ_API_KEY                  = gsk_...
GROQ_MODEL                    = llama-3.3-70b-versatile
```

Se mancano o sono vuote → aggiungerle e fare **Redeploy** (senza nuovi commit).

### Step 4 — Deploy

```bash
git add src/components/superfluido-app.tsx
git commit -m "fix: error handling, constraint alignment, RLS-ready"
git push origin main
```

Vercel fa il deploy automaticamente al push su `main`.

---

## Struttura file rilevante

```
src/
  app/
    api/ai/route.ts          ← OK, non toccare
    globals.css
    layout.tsx
    page.tsx
  components/
    superfluido-app.tsx      ← SOSTITUIRE con il file nuovo
  lib/
    sample-data.ts           ← OK, non toccare
    supabase.ts              ← OK, non toccare
    types.ts                 ← OK, non toccare
```

---

## Cosa NON fare

- Non modificare `supabase.ts` — il client è corretto
- Non modificare `types.ts` — i tipi sono allineati allo schema
- Non eseguire DROP su nessuna tabella — ci sono dati reali
- Non ricreare il progetto Supabase da zero
- Non aggiungere nuove dipendenze npm — non serve nulla di nuovo

---

## Come verificare che funzioni

Dopo il deploy:

1. Login con le credenziali esistenti
2. Vai su **Calendario** → compila il form → clicca "Registra data"  
   → deve apparire toast verde "Evento registrato." e l'evento nella lista
3. Vai su **Studio Hub** → scrivi un nome album → clicca "Crea album"  
   → deve apparire toast verde "Album creato." e l'album nella lista
4. Se appare un toast rosso con messaggio → copiare il testo e controllare le policy RLS su Supabase

---

## Tabelle Supabase presenti (schema `public`)

Tutte esistono già — nessuna va creata:

| Tabella | Scopo |
|---|---|
| `user_roles` | ruolo per email (master / membro / affiliato) |
| `products` + `product_variants` | magazzino merch |
| `eventi_calendario` | calendario condiviso |
| `album_progetti` | album/workspace studio |
| `tracce_audio` | tracce con upload audio |
| `profili_artisti` | anagrafica artisti |
| `vault_documenti` | documenti/contratti |
| `vault_cartelle` | cartelle vault (non ancora usato nel frontend) |
| `tasks_kanban` | task board (non ancora nel frontend) |

---

## Stack completo

- Next.js 15 App Router — TypeScript
- Tailwind CSS 4
- Supabase Auth + Database + Storage (anon key, client-side)
- Groq API (llama-3.3-70b-versatile) — server-side only via `/api/ai`
- Vercel deploy (auto da push su `main`)
- Lucide React per le icone
