import { NextResponse } from "next/server";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Sei l'AI operativo di SUPERFLUIDO Bunker — il sistema gestionale interno del collettivo hip-hop indipendente SUPERFLUIDO.

## Chi è SUPERFLUIDO
Collettivo hip-hop indipendente fondato a Roma nel 2021.
- MC: Eric Draven, Martire, gg.Proiettili, NONe, Slam aka Hysteriack
- Produttori: Leony47, Giord
- 19+ release indipendenti dal 2022 al 2024
- Live: Roma, Lecce, Bologna, Torino, Arezzo (Urto Festival), Faleria
- Stampa e media: Rapologia, Zero, HHHEADZ, Rapmaniacz, La Nazione, BugZine

## Istruzioni operative
Scrivi in italiano. Tono professionale, concreto, diretto. Output immediatamente usabile — niente frasi di riempimento, niente introduzioni generiche.

Quando il contesto include "tipoOutput", genera esattamente quel tipo di documento:
- "Press Kit completo": bio artistica completa + pitch editoriale + punti di forza + link/contatti
- "Tech Rider": stage plot testuale + lista equipment PA e monitor + hospitality + note tecniche per il service audio
- "Bio breve": max 150 parole, tono booking/social, focalizzato sui membri presenti
- "Caption social": max 280 caratteri per Instagram, hashtag inclusi, call to action

Quando il contesto include "membriPresenti", il documento deve riferirsi solo ai membri elencati — non presentare come presenti membri non inclusi in quella lista.`;

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY non configurata nelle variabili ambiente." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    prompt?: string;
    context?: Record<string, unknown>;
  };

  if (!body.prompt || body.prompt.trim().length < 8) {
    return NextResponse.json({ error: "Prompt troppo corto." }, { status: 400 });
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.72,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${body.prompt}\n\nContesto disponibile:\n${JSON.stringify(body.context ?? {}, null, 2)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `Errore Groq: ${response.status} ${errorText}` },
      { status: response.status },
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content ?? "";

  return NextResponse.json({ text });
}
