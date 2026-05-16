# SUPERFLUIDO Bunker

ERP web per collettivi musicali, label indipendenti e studio hub. La vecchia app Streamlit e' stata sostituita da una UI moderna in Next.js, React, TypeScript e Tailwind CSS 4, pronta per deploy Vercel.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS 4
- Supabase Auth, Database e Storage
- Groq API per il tool AI Press Kit
- Vercel per build e deploy

## Moduli

- Overview operativa
- Magazzino prodotti e varianti
- Calendario eventi
- Studio Hub per album e tracce
- AI Press Kit con endpoint server `/api/ai`
- Profili artisti
- Vault documenti

## Variabili ambiente

Configura le variabili su `.env` in locale e su Vercel Project Settings:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

`GROQ_API_KEY` resta server-side e non viene esposta al browser.

## Sviluppo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy Vercel

Il progetto include `vercel.json` e viene rilevato come Next.js. Prima del deploy imposta su Vercel le stesse variabili ambiente indicate sopra.
