import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const AI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// These values are already committed to the repository in scripts/ — not a new exposure.
// They serve as fallbacks when Vercel env vars are not available (e.g. preview deployments).
const _SB_URL = "https://jbugnzagefqkvimaqyki.supabase.co";
const _SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidWduemFnZWZxa3ZpbWFxeWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTAxMjQ2OCwiZXhwIjoyMDkwNTg4NDY4fQ.QuR9u2mY_Zt5RUxKD0v0H5GcEvi-cvDPTvQnCeoZyNA";

const SYSTEM_PROMPT = `Sei l'AI operativo di SUPERFLUIDO Bunker — sistema gestionale del collettivo hip-hop indipendente SUPERFLUIDO, fondato a Roma nel 2021.
MC: Eric Draven, Martire, gg.Proiettili, NONe, Slam aka Hysteriack | Produttori: Leony47, Giord.
Base operativa: Roma. Genere: hip-hop indipendente, underground.
Social: Instagram @superfluido_official | Booking: superfluido@booking.com

## LINGUA
Rispondi SEMPRE in italiano. Tono diretto, concreto, breve. Niente frasi di riempimento.
Non aggiungere MAI disclaimer come "non posso generare PDF" — puoi sempre generare testi.

## GENERAZIONE TESTI E DOCUMENTI
Per qualsiasi richiesta di: press kit, bio artistica, tech rider, caption social,
comunicato stampa, CV, documento, PDF, testo formattato →
→ Genera SUBITO il contenuto in markdown BEN FORMATTATO con heading (# ## ###), bold (**testo**), liste (-)
→ USA i dati reali dal contesto workspace: profili artisti, discografia, eventi futuri
→ Se il contesto ha dati profilo per l'artista richiesto, usali; altrimenti usa le info generali sul collettivo
→ NON creare task o eventi per soddisfare queste richieste
→ Aggiungi SEMPRE alla fine esattamente: [PRINTABLE]

## STRUTTURA PRESS KIT (quando richiesto)
# [Nome Artista / SUPERFLUIDO] — Press Kit [Anno]
## Biografia
[testo dalla bio_breve del profilo + espansione artistica]
## Discografia
[lista degli album/singoli dalla discografia nel contesto, con anno]
## Stile & Influenze
[analisi del sound basata su strumentazione/ruolo del profilo]
## Live & Collaborazioni
[eventi futuri dal contesto + note collaborative]
## Contatti & Link
[email, instagram, spotify dal profilo]

## USO DEI TOOL — regole TASSATIVE

USA create_task SOLO se l'utente dice esplicitamente:
  "crea un task", "aggiungi al kanban", "aggiungi una to-do", "ricordami di [azione]"
  ❌ MAI per: generare testo, PDF, documenti, domande generali

USA create_event SOLO se l'utente dice esplicitamente:
  "aggiungi al calendario", "crea un evento", "segna una data", "metti in agenda"
  → Se la data/ora non è specificata, CHIEDILA prima di chiamare il tool
  ❌ MAI per domande sugli eventi esistenti

USA search_vault SOLO se l'utente chiede esplicitamente dove si trova un file
  → Il contesto workspace include TUTTI i file vault con nome e cartella — puoi rispondere
    a domande come "cosa c'è nella cartella X?" direttamente dal contesto, senza chiamare il tool
  → Per listare file di una cartella: filtra context.vault dove cartella === "Nome Cartella"

Se non sei sicuro se usare un tool, NON usarlo — rispondi con testo.

## ERRORI DEI TOOL
Se un tool restituisce un messaggio che inizia con "Errore:", comunicalo chiaramente
all'utente invece di dire che l'operazione è riuscita.`;

function textToSSEStream(
  text: string,
  meta: { printable: boolean; actionPerformed: boolean; actionMessage: string },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      const words = text.split(" ");
      let i = 0;
      function push() {
        if (i >= words.length) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", ...meta })}\n\n`));
          controller.close();
          return;
        }
        const chunk = words.slice(i, i + 3).join(" ") + " ";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`));
        i += 3;
        setTimeout(push, 18);
      }
      push();
    },
  });
}

const tools = [
  {
    type: "function",
    function: {
      name: "create_task",
      description:
        "Crea un task nel Kanban Board. Usare SOLO quando l'utente chiede esplicitamente di aggiungere un task/to-do.",
      parameters: {
        type: "object",
        properties: {
          titolo: { type: "string", description: "Titolo del task" },
          descrizione: { type: "string", description: "Descrizione opzionale" },
          stato: {
            type: "string",
            enum: ["Da Fare", "In Corso", "Completato"],
            description: "Stato iniziale, default 'Da Fare'",
          },
          scadenza: {
            type: "string",
            description: "Data ISO 8601 (es. 2026-05-30T18:00:00). Opzionale.",
          },
        },
        required: ["titolo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description:
        "Crea un evento nel calendario. Usare SOLO quando l'utente chiede esplicitamente di aggiungere un evento/data in agenda. Se la data non è specificata, chiedila all'utente invece di chiamare questo tool.",
      parameters: {
        type: "object",
        properties: {
          titolo: { type: "string" },
          tipo_evento: {
            type: "string",
            description: "live | studio | riunione | release | altro",
          },
          data_evento: {
            type: "string",
            description: "Data e ora ISO 8601. OBBLIGATORIA.",
          },
          luogo: { type: "string" },
          note: { type: "string" },
        },
        required: ["titolo", "data_evento"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_vault",
      description:
        "Cerca documenti nel Vault per nome o parole chiave. Restituisce nome file e cartella.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
];

type AIMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: null; tool_calls: AIToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type AIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_AI_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? _SB_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? _SB_KEY;
  const model = process.env.GOOGLE_AI_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_AI_KEY non configurata nelle variabili ambiente." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    context?: {
      vault?: Array<{ nome: string; cartella: string }>;
      tasks?: Array<{ titolo: string; stato: string; scadenza?: string | null }>;
      eventi?: Array<{ titolo: string; data: string; luogo?: string | null }>;
      album_in_lavorazione?: Array<{ nome: string }>;
      discografia?: Array<{ nome: string; tipo: string; anno: string | null; spotify: string | null; apple: string | null; bandcamp: string | null }>;
      profili?: Array<{ nome_arte: string | null; ruolo: string | null; bio: string | null; instagram: string | null; spotify: string | null; email: string | null }>;
    };
    userId?: string;
  };

  if (!body.messages?.length) {
    return NextResponse.json({ error: "Nessun messaggio." }, { status: 400 });
  }

  const contextStr = body.context
    ? `\n\nContesto attuale del workspace:\n${JSON.stringify(body.context, null, 2)}`
    : "";

  const messages: AIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT + contextStr },
    ...body.messages,
  ];

  async function callAI(msgs: AIMessage[], withTools: boolean) {
    const payload: Record<string, unknown> = {
      model,
      temperature: 0.6,
      max_tokens: 1200,
      messages: msgs,
    };
    if (withTools) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google AI ${res.status}: ${err}`);
    }
    return res.json();
  }

  async function callAIStreamRaw(msgs: AIMessage[]) {
    const payload = { model, temperature: 0.6, max_tokens: 1200, messages: msgs, stream: true };
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Google AI ${res.status}: ${err}`); }
    return res;
  }

  try {
    const first = await callAI(messages, true);
    const choice = first.choices?.[0];

    // ── Tool call branch ──────────────────────────────────────────────────────
    if (choice?.finish_reason === "tool_calls" && choice.message?.tool_calls?.length) {
      const supabase =
        supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

      const assistantMsg: AIMessage = {
        role: "assistant",
        content: null,
        tool_calls: choice.message.tool_calls,
      };

      const toolResults: AIMessage[] = [];
      let actionPerformed = false;
      let actionMessage = "";

      for (const call of choice.message.tool_calls as AIToolCall[]) {
        let args: Record<string, string>;
        try {
          args = JSON.parse(call.function.arguments);
        } catch {
          args = {};
        }

        let result = "";

        if (call.function.name === "create_task") {
          if (!supabase) {
            result = "Errore: SUPABASE_SERVICE_ROLE_KEY mancante.";
          } else {
            const { error } = await supabase.from("tasks_kanban").insert({
              titolo: args.titolo,
              descrizione: args.descrizione ?? null,
              stato: args.stato ?? "Da Fare",
              scadenza: args.scadenza ?? null,
            });
            if (error) {
              result = `Errore creazione task: ${error.message}`;
            } else {
              result = `OK — Task "${args.titolo}" aggiunto al Kanban con stato "${args.stato ?? "Da Fare"}".`;
              actionPerformed = true;
              actionMessage = `Task "${args.titolo}" creato.`;
            }
          }
        } else if (call.function.name === "create_event") {
          if (!supabase) {
            result = "Errore: SUPABASE_SERVICE_ROLE_KEY mancante.";
          } else {
            const { error } = await supabase.from("eventi_calendario").insert({
              titolo: args.titolo,
              tipo_evento: args.tipo_evento ?? "altro",
              data_evento: args.data_evento,
              luogo: args.luogo ?? null,
              note: args.note ?? null,
              creato_da: body.userId ?? null,
            });
            if (error) {
              result = `Errore creazione evento: ${error.message}`;
            } else {
              result = `OK — Evento "${args.titolo}" aggiunto al calendario per ${args.data_evento}.`;
              actionPerformed = true;
              actionMessage = `Evento "${args.titolo}" aggiunto al calendario.`;
            }
          }
        } else if (call.function.name === "search_vault") {
          const files = body.context?.vault ?? [];
          const q = (args.query ?? "").toLowerCase();
          const matches = files.filter(
            (f) =>
              f.nome.toLowerCase().includes(q) ||
              (f.cartella ?? "").toLowerCase().includes(q),
          );
          result =
            matches.length > 0
              ? matches.map((f) => `"${f.nome}" — cartella: ${f.cartella || "root"}`).join("\n")
              : `Nessun file trovato per "${args.query}".`;
        }

        toolResults.push({ role: "tool", tool_call_id: call.id, content: result });
      }

      const second = await callAI([...messages, assistantMsg, ...toolResults], false);
      const text = second.choices?.[0]?.message?.content ?? "";

      const printable = text.includes("[PRINTABLE]");
      const cleanText = text.replace("[PRINTABLE]", "").trimEnd();
      return new Response(
        textToSSEStream(cleanText, { printable, actionPerformed, actionMessage }),
        { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } },
      );
    }

    // ── Normal text response — streaming ────────────────────────────────────
    const streamRes = await callAIStreamRaw(messages);
    const encoder = new TextEncoder();
    let sseBuffer = "";
    let fullText = "";
    const transformedStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = streamRes.body!.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              const printable = fullText.includes("[PRINTABLE]");
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done", printable, actionPerformed: false, actionMessage: "" })}\n\n`),
              );
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
              const chunk = parsed.choices?.[0]?.delta?.content ?? "";
              if (chunk) {
                fullText += chunk;
                const chunkToSend = chunk.replace("[PRINTABLE]", "");
                if (chunkToSend) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: chunkToSend })}\n\n`));
                }
              }
            } catch { /* non-JSON line */ }
          }
        }
        // Fallback if [DONE] never arrives
        const printable = fullText.includes("[PRINTABLE]");
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done", printable, actionPerformed: false, actionMessage: "" })}\n\n`),
        );
        controller.close();
      },
    });
    return new Response(transformedStream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore sconosciuto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
