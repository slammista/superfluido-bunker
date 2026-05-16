import { NextResponse } from "next/server";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

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
      max_tokens: 1100,
      messages: [
        {
          role: "system",
          content:
            "Sei l'AI operativo di SUPERFLUIDO Bunker. Scrivi in italiano, con tono professionale, concreto e utile per una label indipendente. Produci output pronto da usare per press kit, comunicati, pitch, bio artista e piani operativi.",
        },
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
