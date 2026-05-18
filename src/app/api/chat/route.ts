import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Sei l'AI operativo di SUPERFLUIDO Bunker — il sistema gestionale del collettivo hip-hop indipendente SUPERFLUIDO.

Collettivo fondato a Roma nel 2021.
- MC: Eric Draven, Martire, gg.Proiettili, NONe, Slam aka Hysteriack
- Produttori: Leony47, Giord

Regole operative:
- Scrivi sempre in italiano. Tono diretto, concreto, operativo.
- Quando crei un task o un evento, conferma brevemente cosa hai fatto e i dettagli principali.
- Per cercare nel Vault: indica solo nome file e cartella (percorso) — non generare link URL.
- Per generare PDF o documenti formali: chiedi sempre conferma esplicita all'utente prima di procedere.
- Se l'utente chiede di "creare un evento" o "aggiungere al calendario" usa create_event.
- Se chiede di "aggiungere un task", "creare un todo", "ricordami di..." usa create_task.
- Se chiede dove si trova un file o cerca nel vault usa search_vault.
- Risposte brevi e dirette. Niente frasi di riempimento.`;

const tools = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Crea un nuovo task nel Kanban Board dell'app",
      parameters: {
        type: "object",
        properties: {
          titolo: { type: "string", description: "Titolo del task" },
          descrizione: { type: "string", description: "Descrizione opzionale del task" },
          stato: {
            type: "string",
            enum: ["Da Fare", "In Corso", "Completato"],
            description: "Stato iniziale del task, default 'Da Fare'",
          },
          scadenza: {
            type: "string",
            description: "Data di scadenza in formato ISO 8601 (es. 2026-05-25T18:00:00), opzionale",
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
      description: "Crea un nuovo evento nel calendario dell'app",
      parameters: {
        type: "object",
        properties: {
          titolo: { type: "string", description: "Titolo dell'evento" },
          tipo_evento: {
            type: "string",
            description: "Tipo evento: live, studio, riunione, release, altro",
          },
          data_evento: {
            type: "string",
            description: "Data e ora dell'evento in formato ISO 8601",
          },
          luogo: { type: "string", description: "Luogo dell'evento (opzionale)" },
          note: { type: "string", description: "Note aggiuntive (opzionale)" },
        },
        required: ["titolo", "data_evento"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_vault",
      description: "Cerca documenti nel Vault per nome file o parole chiave. Restituisce nome file e cartella.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Parole chiave da cercare tra i file del vault",
          },
        },
        required: ["query"],
      },
    },
  },
];

type GroqMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: null; tool_calls: GroqToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type GroqToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY non configurata." }, { status: 500 });
  }

  const body = (await request.json()) as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    context?: {
      vault?: Array<{ nome: string; cartella: string }>;
      tasks?: Array<{ titolo: string; stato: string; scadenza?: string | null }>;
      eventi?: Array<{ titolo: string; data: string; luogo?: string | null }>;
      album_in_lavorazione?: Array<{ nome: string }>;
    };
    userId?: string;
  };

  if (!body.messages?.length) {
    return NextResponse.json({ error: "Nessun messaggio." }, { status: 400 });
  }

  const contextStr = body.context
    ? `\n\nContesto attuale del workspace:\n${JSON.stringify(body.context, null, 2)}`
    : "";

  const groqMessages: GroqMessage[] = [
    { role: "system", content: SYSTEM_PROMPT + contextStr },
    ...body.messages,
  ];

  async function callGroq(messages: GroqMessage[], useTools: boolean) {
    const payload: Record<string, unknown> = {
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.65,
      max_tokens: 800,
      messages,
    };
    if (useTools) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq ${res.status}: ${err}`);
    }
    return res.json();
  }

  try {
    const first = await callGroq(groqMessages, true);
    const choice = first.choices?.[0];

    if (choice?.finish_reason === "tool_calls" && choice.message?.tool_calls?.length) {
      const supabase =
        supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

      const assistantMsg: GroqMessage = {
        role: "assistant",
        content: null,
        tool_calls: choice.message.tool_calls,
      };

      const toolResults: GroqMessage[] = [];
      let actionPerformed = false;
      let actionMessage = "";

      for (const call of choice.message.tool_calls as GroqToolCall[]) {
        let args: Record<string, string>;
        try {
          args = JSON.parse(call.function.arguments);
        } catch {
          args = {};
        }

        let result = "";

        if (call.function.name === "create_task") {
          if (!supabase) {
            result = "Errore: Supabase service key non configurata.";
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
              result = `Task "${args.titolo}" creato con stato "${args.stato ?? "Da Fare"}"${args.scadenza ? `, scadenza ${args.scadenza}` : ""}.`;
              actionPerformed = true;
              actionMessage = `Task "${args.titolo}" creato.`;
            }
          }
        } else if (call.function.name === "create_event") {
          if (!supabase) {
            result = "Errore: Supabase service key non configurata.";
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
              result = `Evento "${args.titolo}" creato per ${args.data_evento}${args.luogo ? ` a ${args.luogo}` : ""}.`;
              actionPerformed = true;
              actionMessage = `Evento "${args.titolo}" aggiunto al calendario.`;
            }
          }
        } else if (call.function.name === "search_vault") {
          const vaultFiles = body.context?.vault ?? [];
          const q = (args.query ?? "").toLowerCase();
          const matches = vaultFiles.filter(
            (f) =>
              f.nome.toLowerCase().includes(q) ||
              (f.cartella ?? "").toLowerCase().includes(q),
          );
          result =
            matches.length > 0
              ? matches
                  .map((f) => `"${f.nome}" — cartella: ${f.cartella || "root"}`)
                  .join("\n")
              : `Nessun file trovato per "${args.query}" nel Vault.`;
        }

        toolResults.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }

      const finalMessages: GroqMessage[] = [
        ...groqMessages,
        assistantMsg,
        ...toolResults,
      ];

      const second = await callGroq(finalMessages, false);
      const text = second.choices?.[0]?.message?.content ?? "";

      return NextResponse.json({ text, actionPerformed, actionMessage });
    }

    const text = choice?.message?.content ?? "";
    return NextResponse.json({ text, actionPerformed: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore sconosciuto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
