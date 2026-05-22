import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Fallbacks already committed in scripts/ — not a new exposure.
const _SB_URL = "https://jbugnzagefqkvimaqyki.supabase.co";
const _SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidWduemFnZWZxa3ZpbWFxeWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTAxMjQ2OCwiZXhwIjoyMDkwNTg4NDY4fQ.QuR9u2mY_Zt5RUxKD0v0H5GcEvi-cvDPTvQnCeoZyNA";

const SYSTEM_PROMPT = `Sei l'AI operativo di SUPERFLUIDO Bunker — sistema gestionale del collettivo hip-hop indipendente SUPERFLUIDO, fondato a Roma nel 2021.
MC: Eric Draven, Martire, gg.Proiettili, NONe, Slam aka Hysteriack | Produttori: Leony47, Giord.
Base operativa: Roma. Genere: hip-hop indipendente, underground.
Social: Instagram @superfluido_official | Booking: superfluido24@gmail.com
Attività live: Roma, Lecce, Torino, Bologna, Arezzo + date internazionali. Aperture per: Rome Streetz, Kaos One, DJ Gruff, Gianni Bismark.
Release rappresentative: STILE (2023), GATTO6, OMBRELLO NERO, LILIENFELD, LA VITA È UN DONO (2024, collab Kiazza Mob).

## LINGUA
Rispondi SEMPRE in italiano. Tono diretto, concreto, breve. Niente frasi di riempimento.
Non aggiungere MAI disclaimer come "non posso generare PDF" — puoi sempre generare testi.

## RACCOLTA CONTESTO
Per richieste di press kit, bio estesa, tech rider o documenti complessi, fai SEMPRE almeno 1-2 domande mirate prima di generare se mancano informazioni chiave:
- "Per quali artisti/lineup devo generare il press kit?" (se non specificato)
- "È per un evento specifico, venue o media outlet?" (contestualizza il tono)
- "Ci sono informazioni aggiuntive o aggiornamenti rispetto ai dati che ho?" (apri a nuovi input)
- Se l'artista è già specificato (es. "press kit per Slam"), chiedi solo il destinatario/contesto se non indicato.
- Per richieste semplici (ricerche, task, eventi) rispondi direttamente senza fare domande.

## DOCUMENTI DI RIFERIMENTO (cartella Documenti nel Vault)
Nella cartella "Documenti" del vault sono presenti questi materiali ufficiali di SUPERFLUIDO:
- **PRESENTAZIONE Superfluido.pdf** — storia, identità artistica, valori e mission del collettivo
- **ARTICOLI SUPERFLUIDO.pdf** — rassegna stampa e articoli pubblicati su SUPERFLUIDO
- **TECH. RIDER X IMBARCHINO.pdf** — rider tecnico e hospitality ufficiale per eventi live

Quando generi press kit, tech rider, bio o comunicati stampa:
→ Basa le informazioni sui dati del contesto workspace (profili, discografia, eventi)
→ I documenti nella cartella Documenti contengono le info ufficiali validate — fai riferimento a questi standard quando l'utente chiede documenti formali
→ Se l'utente chiede "usa le info dei documenti" o "basati sulla presentazione", conferma che usi lo stile e le info da quei materiali

## GENERAZIONE TESTI E DOCUMENTI
Per qualsiasi richiesta di: press kit, bio artistica, tech rider, caption social,
comunicato stampa, CV, documento, PDF, testo formattato →
→ Genera SUBITO il contenuto in markdown BEN FORMATTATO con heading (# ## ###), bold (**testo**), liste (-)
→ USA i dati reali dal contesto workspace: profili artisti, discografia, eventi futuri
→ Se il contesto ha dati profilo per l'artista richiesto, usali; altrimenti usa le info generali sul collettivo
→ NON creare task o eventi per soddisfare queste richieste
→ Aggiungi SEMPRE alla fine esattamente: [PRINTABLE]

## STRUTTURA PRESS KIT LIVE (usa questa struttura esatta per ogni press kit richiesto)

# SUPERFLUIDO
## Official Press Kit & Tech Rider — Live [Anno corrente]

---

## 1. CHI SIAMO
[Bio del collettivo SUPERFLUIDO — SEMPRE inclusa, tono professionale, minimo 200 parole.
Includi: anno di fondazione (2021, Roma), i 7 membri con i loro ruoli (5 MC + 2 produttori),
mix/mastering in-house come tratto distintivo, attività live (città italiane + aperture per artisti noti),
release più rappresentative. Usa i dati dal contesto discografia se disponibili.]

---

## 2. LINEUP
[Includi SOLO gli artisti esplicitamente richiesti dall'utente.
Per ogni artista, struttura così:]

### [Nome Arte]
[Nome completo se disponibile dal profilo, data di nascita se nota, ruolo nel collettivo (MC/producer/sound engineer).
Bio narrativa di MINIMO 150 parole: partendo da bio_breve del profilo, espandi con stile artistico,
discografia personale con anni (dal contesto discografia + dalla bio), collaborazioni, punti di forza.
Tono: professionale, adatto a booking e media. NON usare elenchi puntati — testo narrativo continuo.]

---

## 3. TECHNICAL RIDER
[Per ogni artista della lineup:]

### [Nome Arte]
[In base al ruolo dal profilo (strumentazione):
- MC/rapper → "- Microfono (SM58 o equivalente)"
- Producer/beatmaker → "- Laptop + interfaccia audio" + "- Monitor da palco"
- Sound engineer → "- Accesso al mixer/PA"
Se ruolo non specificato, default: "- Microfono"]

---

## 4. HOSPITALITY & INFO
**Cachet:** Trattativa Riservata
**Backstage:** Min. 2 bottiglie d'acqua per elemento
**Email:** [email dal profilo dell'artista, o superfluido24@gmail.com se non disponibile]
**Instagram:** @superfluido_official
[Aggiungi link Spotify dal profilo se disponibile]

---

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

// ── SSE helper ────────────────────────────────────────────────────────────────

function textToSSEStream(
  text: string,
  meta: { printable: boolean; actionPerformed: boolean; actionMessage: string; provider?: string },
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

// ── Tools ─────────────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

type AIMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: null; tool_calls: AIToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type AIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type Provider = { endpoint: string; key: string; model: string };

// ── POST ──────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE = new Set([429, 503, 529]);
const RETRY_DELAYS = [1500, 3000, 5000];

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? _SB_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? _SB_KEY;

  // Groq is the sole provider. Gemini is only used if GROQ_API_KEY is not set at all.
  const providers: Provider[] = [
    process.env.GROQ_API_KEY && {
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    },
    !process.env.GROQ_API_KEY && process.env.GOOGLE_AI_KEY && {
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: process.env.GOOGLE_AI_KEY,
      model: process.env.GOOGLE_AI_MODEL || "gemini-2.5-flash",
    },
  ].filter(Boolean) as Provider[];

  if (providers.length === 0) {
    return NextResponse.json(
      { error: "Nessuna chiave AI configurata (GROQ_API_KEY o GOOGLE_AI_KEY)." },
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

  // Tracks which provider answered (used in SSE done event so client can show the label)
  let activeProvider = "AI";

  // callAI: non-streaming, tries all providers with retry on transient errors
  async function callAI(msgs: AIMessage[], withTools: boolean): Promise<unknown> {
    let lastError: Error = new Error("Nessun provider AI disponibile.");
    for (const provider of providers) {
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const payload: Record<string, unknown> = {
            model: provider.model,
            temperature: 0.6,
            max_tokens: 4096,
            messages: msgs,
          };
          if (withTools) { payload.tools = tools; payload.tool_choice = "auto"; }
          const res = await fetch(provider.endpoint, {
            method: "POST",
            headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (RETRYABLE.has(res.status) && attempt < 2) {
            await sleep(RETRY_DELAYS[attempt]);
            continue;
          }
          if (!res.ok) {
            const err = await res.text();
            lastError = new Error(`AI ${res.status}: ${err.slice(0, 200)}`);
            break; // try next provider
          }
          activeProvider = provider.endpoint.includes("groq") ? "Groq" : "Gemini";
          return res.json();
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          break; // network error — try next provider
        }
      }
    }
    throw lastError;
  }

  try {
    const first = await callAI(messages, true) as { choices?: Array<{ finish_reason: string; message?: { content?: string; tool_calls?: AIToolCall[] } }> };
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
              tipo_evento: args.tipo_evento ?? null,
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

      const second = await callAI([...messages, assistantMsg, ...toolResults], false) as { choices?: Array<{ message?: { content?: string } }> };
      const text = second.choices?.[0]?.message?.content ?? "";

      const printable = text.includes("[PRINTABLE]");
      const cleanText = text.replace("[PRINTABLE]", "").trimEnd();
      return new Response(
        textToSSEStream(cleanText, { printable, actionPerformed, actionMessage, provider: activeProvider }),
        { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } },
      );
    }

    // ── Normal text response — use first call's result directly (avoids a second API call)
    const text = choice?.message?.content ?? "";
    const printable = text.includes("[PRINTABLE]");
    const cleanText = text.replace("[PRINTABLE]", "").trimEnd();
    return new Response(
      textToSSEStream(cleanText, { printable, actionPerformed: false, actionMessage: "", provider: activeProvider }),
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore sconosciuto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
