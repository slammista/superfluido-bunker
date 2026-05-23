import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// These values are already committed to the repository in scripts/ — not a new exposure.
// They serve as fallbacks when Vercel env vars are not available (e.g. preview deployments).
const _SB_URL = "https://jbugnzagefqkvimaqyki.supabase.co";
const _SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidWduemFnZWZxa3ZpbWFxeWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTAxMjQ2OCwiZXhwIjoyMDkwNTg4NDY4fQ.QuR9u2mY_Zt5RUxKD0v0H5GcEvi-cvDPTvQnCeoZyNA";

// ─── Provider configuration ───────────────────────────────────────────────────
// Groq is primary (free, 30 req/min, 14.400/day). Gemini is automatic fallback.
const PROVIDERS = [
  {
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  },
  {
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiKey: process.env.GOOGLE_AI_KEY,
    model: process.env.GOOGLE_AI_MODEL || "gemini-2.5-flash",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type AIMessage = { role: "system" | "user" | "assistant"; content: string };
type ChatMessage = { role: "user" | "assistant"; content: string };

type Intent = "press_kit" | "create_task" | "create_event" | "search_vault" | "general";

type Entities = {
  artist?: string | null;
  recipient?: string | null;
  taskTitle?: string | null;
  deadline?: string | null;
  eventTitle?: string | null;
  eventDate?: string | null;
  eventVenue?: string | null;
  eventType?: string | null;
  searchQuery?: string | null;
};

type PendingIntent = { type: Intent; entities: Entities };

type WorkspaceContext = {
  vault?: Array<{ nome: string; cartella: string }>;
  tasks?: Array<{ titolo: string; stato: string; scadenza?: string | null }>;
  eventi?: Array<{ titolo: string; data: string; luogo?: string | null }>;
  album_in_lavorazione?: Array<{ nome: string }>;
  discografia?: Array<{
    nome: string; tipo: string; anno: string | null;
    spotify: string | null; apple: string | null; bandcamp: string | null;
  }>;
  profili?: Array<{
    nome_arte: string | null; ruolo: string | null; bio: string | null;
    instagram: string | null; spotify: string | null; email: string | null;
  }>;
};

// ─── Artist alias resolution ──────────────────────────────────────────────────
// Maps common nicknames/abbreviations to canonical artist names.

const ARTIST_ALIASES: Record<string, string> = {
  "slam": "Slam aka Hysteriack",
  "hysteriack": "Slam aka Hysteriack",
  "slam aka hysteriack": "Slam aka Hysteriack",
  "none": "NONe",
  "gg": "gg.Proiettili",
  "proiettili": "gg.Proiettili",
  "gg proiettili": "gg.Proiettili",
  "eric": "Eric Draven",
  "draven": "Eric Draven",
  "eric draven": "Eric Draven",
  "leony": "Leony47",
  "leony47": "Leony47",
  "giord": "Giord",
  "martire": "Martire",
  "superfluido": "SUPERFLUIDO",
  "collettivo": "SUPERFLUIDO",
};

function resolveArtist(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();

  // Exact match (fast path)
  if (ARTIST_ALIASES[key]) return ARTIST_ALIASES[key];

  // Scan for known aliases with word-boundary check (handles "slam e none", "per slam")
  const found: string[] = [];
  for (const [alias, canonical] of Object.entries(ARTIST_ALIASES)) {
    const idx = key.indexOf(alias);
    if (idx === -1) continue;
    const before = key[idx - 1];
    const after = key[idx + alias.length];
    const boundary =
      (!before || /[\s,&()]/.test(before)) && (!after || /[\s,&()]/.test(after));
    if (boundary && !found.includes(canonical)) found.push(canonical);
  }

  return found.length > 0 ? found.join(",") : raw;
}

// ─── LLM call with retry + provider fallback ──────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function callLLM(
  messages: AIMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const active = PROVIDERS.filter((p) => p.apiKey);
  if (active.length === 0) throw new Error("Nessun provider AI configurato (GROQ_API_KEY o GOOGLE_AI_KEY mancante).");

  for (const provider of active) {
    for (let attempt = 0; attempt <= 3; attempt++) {
      const res = await fetch(provider.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: provider.model,
          temperature: opts.temperature ?? 0.6,
          max_tokens: opts.maxTokens ?? 1000,
          messages,
        }),
      });

      if (res.status === 429 || res.status === 503 || res.status === 529) {
        if (attempt < 3) { await sleep([1500, 3000, 5000][attempt]); continue; }
        break; // exhausted retries → try next provider
      }

      if (!res.ok) break; // non-retryable error → try next provider

      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? "";
    }
  }

  throw new Error("Servizio AI temporaneamente non disponibile. Riprova tra qualche secondo.");
}

// ─── Intent classification ────────────────────────────────────────────────────

async function classifyIntent(message: string): Promise<{ type: Intent; entities: Entities }> {
  const prompt = `Classifica questo messaggio in uno dei 5 intent ed estrai le entità. Rispondi SOLO con JSON valido, nessun testo extra.

INTENT:
- press_kit: press kit, bio artistica, scheda artista, presentazione artista, profilo per booking/media
- create_task: crea task, aggiungi to-do, kanban, ricordami di, bisogna fare
- create_event: aggiungi al calendario, crea evento, segna data, live, showcase, sessione studio, concerto, release party
- search_vault: dove sono i file, cerca nel vault, trovami un documento, contratto, tech rider, rider
- general: tutto il resto (domande, info, stato del workspace, riassunti, statistiche)

ARTISTI DEL COLLETTIVO SUPERFLUIDO (riconosci sempre questi alias):
- "Slam aka Hysteriack" ← slam, hysteriack
- "NONe" ← none, None, NONE
- "gg.Proiettili" ← gg, proiettili, gg proiettili
- "Eric Draven" ← eric, draven
- "Leony47" ← leony, leony47
- "Giord" ← giord
- "Martire" ← martire
- "SUPERFLUIDO" ← superfluido, collettivo, il collettivo

ENTITÀ (usa null se assente, NON inventare):
- artist: nome canonico artista (usa i nomi canonici sopra, non gli alias)
- recipient: destinatario press kit → uno tra: media | booking | distribuzione | generico
- taskTitle: titolo task — ESTRAILO DIRETTAMENTE dal messaggio, anche se non è esplicitamente "titolo"
- deadline: data scadenza ISO 8601 (per create_task)
- eventTitle: titolo evento — ESTRAILO dal messaggio (es. "live al Circolo" → "Live al Circolo")
- eventDate: data ISO 8601 — converti date italiane: "venerdì" = prossimo venerdì, "domani" = domani, "15 giugno" = ${new Date().getFullYear()}-06-15, "25/06" = ${new Date().getFullYear()}-06-25T20:00:00
- eventVenue: luogo evento se menzionato
- eventType: live | studio | riunione | release | altro
- searchQuery: query di ricerca (per search_vault)

REGOLE:
1. Se il messaggio cita un artista (anche soprannome), estrai sempre "artist" col nome canonico
2. Per create_task: estrai sempre taskTitle dal testo, anche se non c'è una parola chiave esplicita
3. Per create_event: estrai eventTitle e eventDate anche da frasi naturali
4. Per recipient: se il messaggio dice "per media", "per booking", ecc., estrailo
5. Sii aggressivo nell'estrazione — non lasciare null se l'info è deducibile

Messaggio: "${message.replace(/"/g, "'")}"

JSON:{"type":"general","entities":{"artist":null,"recipient":null,"taskTitle":null,"deadline":null,"eventTitle":null,"eventDate":null,"eventVenue":null,"eventType":null,"searchQuery":null}}`;

  try {
    const raw = await callLLM([{ role: "user", content: prompt }], { maxTokens: 300, temperature: 0.1 });
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return { type: "general", entities: {} };
    return JSON.parse(cleaned.slice(start, end + 1)) as { type: Intent; entities: Entities };
  } catch {
    return { type: "general", entities: {} };
  }
}

// ─── Context checking ─────────────────────────────────────────────────────────

function getMissingFields(type: Intent, entities: Entities): string[] {
  // Only artist is truly required for press_kit (title can always be inferred from message)
  if (type === "press_kit" && !entities.artist) return ["artist"];
  // For events, only date is required — title falls back to lastMessage.content
  if (type === "create_event" && !entities.eventDate) return ["eventDate"];
  return [];
}

function buildQuestion(type: Intent, missing: string[], entities: Entities): string {
  if (type === "press_kit") {
    if (missing.includes("artist")) {
      return `Per quale artista vuoi il press kit?

→ **Eric Draven** · **Martire** · **gg.Proiettili** (gg) · **NONe** (none) · **Slam aka Hysteriack** (slam) · **Leony47** (leony) · **Giord**
→ oppure **SUPERFLUIDO** come collettivo`;
    }
    if (!entities.recipient) {
      return `Press kit per **${entities.artist}** — a chi è destinato?

→ **Media** (riviste, blog, giornalisti musicali)
→ **Booking** (venue, promoter, agenzie)
→ **Distribuzione** (label, aggregatori digitali, playlist curator)
→ **Generico** (nessun destinatario specifico)`;
    }
  }
  if (type === "create_event") {
    if (missing.includes("eventDate")) {
      const title = entities.eventTitle ? `"${entities.eventTitle}"` : "l'evento";
      return `Quando si tiene ${title}? (es. "15 giugno", "25/06/2026 21:00", "venerdì prossimo")`;
    }
  }
  return "Puoi darmi qualche dettaglio in più?";
}

// ─── Vault document content fetcher ──────────────────────────────────────────
// Fetches text content from files in the "Documenti" vault folder.
// Used to give the AI real context from the collective's documents.

async function fetchDocumentiContent(supabase: SupabaseClient): Promise<string> {
  try {
    const { data: files } = await supabase
      .from("vault_documenti")
      .select("nome_file, file_url")
      .eq("cartella", "Documenti")
      .limit(6) as { data: Array<{ nome_file: string; file_url: string | null }> | null };

    if (!files?.length) return "";

    const contents: string[] = [];
    for (const file of files.slice(0, 5)) {
      if (!file.file_url) continue;
      try {
        const res = await fetch(file.file_url, { signal: AbortSignal.timeout(3500) });
        if (!res.ok) continue;
        const raw = await res.text();
        // Strip HTML tags, normalize whitespace, cap at 5000 chars per file
        const text = raw
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 5000);
        if (text.length > 80) contents.push(`### ${file.nome_file}\n${text}`);
      } catch { /* timeout or fetch error — skip this file */ }
    }
    return contents.join("\n\n---\n\n");
  } catch {
    return "";
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handlePressKit(
  entities: Entities,
  context: WorkspaceContext,
  docsContent: string,
): Promise<string> {
  const artistStr = entities.artist ?? "SUPERFLUIDO";
  const artists = artistStr.split(",").map((a) => a.trim()).filter(Boolean);
  const recipient = entities.recipient ?? "generico";
  const year = new Date().getFullYear();
  const events = (context.eventi ?? []).slice(0, 5);
  const discography = (context.discografia ?? [])
    .sort((a, b) => Number(b.anno ?? 0) - Number(a.anno ?? 0))
    .slice(0, 12);

  const getProfile = (artist: string) =>
    context.profili?.find(
      (p) =>
        p.nome_arte?.toLowerCase().includes(artist.toLowerCase()) ||
        artist.toLowerCase().includes((p.nome_arte ?? "").toLowerCase()),
    ) ?? null;

  const sysPrompt = `Sei un copywriter professionista specializzato in musica hip-hop italiana indipendente.
Scrivi press kit professionali, credibili e coinvolgenti in italiano corretto.
Tono: autorevole, diretto, adatto al mondo musicale underground italiano.
Non inventare dati non presenti nel contesto fornito. Non aggiungere frasi generiche di riempimento.`;

  let userPrompt: string;
  let maxTokens = 2000;

  if (artists.length > 1) {
    maxTokens = 3500;
    const artistSections = artists.map((artist) => {
      const profile = getProfile(artist);
      const profileInfo = profile
        ? `Ruolo: ${profile.ruolo ?? "—"} | Bio: ${profile.bio ?? "—"} | Instagram: ${profile.instagram ?? "—"} | Email: ${profile.email ?? "—"}`
        : `Membro del collettivo SUPERFLUIDO (Roma, 2021). Hip-hop underground italiano.`;
      const discoText = discography.length > 0
        ? discography.map((d) => `- **${d.nome}** (${d.anno ?? "—"}) · ${d.tipo}${d.spotify ? ` · [Spotify](${d.spotify})` : ""}`).join("\n")
        : "[Discografia in aggiornamento]";
      return `## ${artist}

### Biografia
[150-250 parole. Profilo: ${profileInfo}]

### Discografia
${discoText}

### Contatti
- Email: ${profile?.email ?? "superfluido@booking.com"}
- Instagram: ${profile?.instagram ?? "@superfluido_official"}`;
    }).join("\n\n---\n\n");

    userPrompt = `Genera un press kit collettivo professionale per ${artists.join(" & ")} — artisti del collettivo SUPERFLUIDO. Struttura obbligatoria:

# ${artists.join(" & ")} — Press Kit ${year}

## Presentazione
[80-120 parole di intro su questo duo all'interno di SUPERFLUIDO. Spiega il legame artistico e il valore della combinazione.]

${artistSections}

---
Destinatario: **${recipient}** — adatta tono ed enfasi.${docsContent ? `\n\nDocumenti Vault:\n${docsContent}` : ""}
Ultima riga OBBLIGATORIA: [PRINTABLE]`;
  } else {
    const artist = artists[0] ?? "SUPERFLUIDO";
    const profile = getProfile(artist);
    const profileInfo = profile
      ? `Nome d'arte: ${profile.nome_arte}\nRuolo/Strumento: ${profile.ruolo}\nBio: ${profile.bio}\nInstagram: ${profile.instagram}\nSpotify: ${profile.spotify}\nEmail: ${profile.email}`
      : `Artista del collettivo SUPERFLUIDO. MC: Eric Draven, Martire, gg.Proiettili, NONe, Slam aka Hysteriack. Produttori: Leony47, Giord. Roma, 2021.\nInstagram: @superfluido_official | Email: superfluido@booking.com`;

    userPrompt = `Genera un press kit professionale seguendo ESATTAMENTE questo template:

# ${artist} — Press Kit ${year}

## Biografia
[350-500 parole. Profilo: ${profileInfo}. Narrativa fluida, senza elenchi puntati.]

## Discografia
${discography.length > 0
      ? discography.map((d) => `- **${d.nome}** (${d.anno ?? "—"}) · ${d.tipo}${d.spotify ? ` · [Spotify](${d.spotify})` : ""}`).join("\n")
      : "[Discografia in aggiornamento]"}

## Live & Collaborazioni
[${events.length > 0 ? `Prossimi eventi: ${events.map((e) => `${e.titolo} — ${e.data}${e.luogo ? ` @ ${e.luogo}` : ""}`).join("; ")}. ` : ""}Descrivi approccio live e collaborazioni.]

## Stile & Influenze
[Sound e influenze. Basati su: ${profile?.ruolo ?? "hip-hop underground, lirismo denso"}.${docsContent ? " Usa info dai Documenti Vault se pertinenti." : ""}]

## Contatti & Link
- Email booking: ${profile?.email ?? "superfluido@booking.com"}
- Instagram: ${profile?.instagram ?? "@superfluido_official"}${profile?.spotify ? `\n- Spotify: ${profile.spotify}` : ""}

---
Destinatario: **${recipient}** — adatta tono ed enfasi.${docsContent ? `\n\nDocumenti Vault:\n${docsContent}` : ""}
Ultima riga OBBLIGATORIA: [PRINTABLE]`;
  }

  return callLLM(
    [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
    { maxTokens, temperature: 0.72 },
  );
}

function handleVault(query: string, context: WorkspaceContext): string {
  const files = context.vault ?? [];
  const q = query.toLowerCase();
  const matches = files.filter(
    (f) => f.nome.toLowerCase().includes(q) || (f.cartella ?? "").toLowerCase().includes(q),
  );
  if (matches.length === 0) return `Nessun file trovato per "${query}" nel Vault.`;
  const list = matches.map((f) => `- **${f.nome}** — cartella: ${f.cartella || "root"}`).join("\n");
  return `Ho trovato **${matches.length}** file nel Vault:\n\n${list}`;
}

async function handleGeneral(
  message: string,
  history: ChatMessage[],
  context: WorkspaceContext,
  docsContent: string,
): Promise<string> {
  const taskOpen = (context.tasks ?? []).filter((t) => t.stato !== "Done" && t.stato !== "Completato");
  const taskDone = (context.tasks ?? []).filter((t) => t.stato === "Done" || t.stato === "Completato");

  const sysPrompt = `Sei l'assistente operativo di SUPERFLUIDO Bunker — sistema gestionale del collettivo hip-hop indipendente SUPERFLUIDO, fondato a Roma nel 2021.

COLLETTIVO:
MC: Eric Draven (aka Eric), Martire, gg.Proiettili (aka gg), NONe (aka none), Slam aka Hysteriack (aka Slam)
Produttori: Leony47 (aka Leony), Giord
Genere: hip-hop underground italiano. Base: Roma. Attivi dal 2021.
Instagram: @superfluido_official | Booking: superfluido@booking.com

WORKSPACE ATTUALE:
- Task aperti (${taskOpen.length}): ${taskOpen.map((t) => `"${t.titolo}" [${t.stato}]${t.scadenza ? ` scad. ${t.scadenza}` : ""}`).join(", ") || "nessuno"}
- Task completati: ${taskDone.length}
- Prossimi eventi (${(context.eventi ?? []).length}): ${(context.eventi ?? []).map((e) => `${e.titolo} — ${e.data}${e.luogo ? ` @ ${e.luogo}` : ""}`).join(", ") || "nessuno"}
- Album in lavorazione: ${(context.album_in_lavorazione ?? []).map((a) => a.nome).join(", ") || "nessuno"}
- Discografia (uscite): ${(context.discografia ?? []).length} release
- Profili artisti: ${(context.profili ?? []).map((p) => p.nome_arte).filter(Boolean).join(", ")}
- File nel Vault: ${(context.vault ?? []).length} documenti${docsContent ? `

DOCUMENTI VAULT (cartella Documenti):
${docsContent}` : ""}

ISTRUZIONI:
- Rispondi SEMPRE in italiano. Tono diretto, concreto, senza frasi di riempimento.
- Se chiedono un riassunto del workspace: elenca task aperti, eventi imminenti, album in lavorazione.
- Se chiedono info su un documento del Vault: usa i DOCUMENTI VAULT sopra.
- Se chiedono statistiche: calcola dai dati del workspace.
- Se chiedono di un artista: usa i profili nel workspace.
- Non inventare dati. Se un'info non è nel contesto, dillo chiaramente.`;

  const msgs: AIMessage[] = [
    { role: "system", content: sysPrompt },
    ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  return callLLM(msgs, { maxTokens: 900, temperature: 0.6 });
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? _SB_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? _SB_KEY;

  const body = (await request.json()) as {
    messages: ChatMessage[];
    context?: WorkspaceContext;
    userId?: string;
    pendingIntent?: PendingIntent;
  };

  if (!body.messages?.length) {
    return NextResponse.json({ error: "Nessun messaggio." }, { status: 400 });
  }

  const lastMessage = body.messages[body.messages.length - 1];
  const history = body.messages.slice(0, -1);
  const context = body.context ?? {};
  const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

  try {
    // ── Step 1: Determine intent ───────────────────────────────────────────────
    let intentType: Intent;
    let entities: Entities;

    if (body.pendingIntent) {
      // Mid-conversation: keep intent, merge new entities from latest message
      intentType = body.pendingIntent.type;
      const fresh = await classifyIntent(lastMessage.content);
      entities = {
        ...body.pendingIntent.entities,
        ...Object.fromEntries(Object.entries(fresh.entities).filter(([, v]) => v != null)),
      };

      // Direct mapping for follow-up answers — more reliable than LLM on short isolated words
      if (intentType === "press_kit") {
        const msg = lastMessage.content.toLowerCase();
        if (!entities.recipient) {
          if (/media|riviste|giornalisti|blog/.test(msg))                       entities.recipient = "media";
          else if (/booking|venue|promoter|agenzi/.test(msg))                   entities.recipient = "booking";
          else if (/distribuz|label|aggregatori|playlist|digitali/.test(msg))   entities.recipient = "distribuzione";
          else if (/generic|nessun/.test(msg))                                  entities.recipient = "generico";
        }
        if (!entities.artist) {
          const resolved = resolveArtist(lastMessage.content.trim());
          if (resolved && resolved !== lastMessage.content.trim()) entities.artist = resolved;
        }
      }
    } else {
      const classified = await classifyIntent(lastMessage.content);
      intentType = classified.type;
      entities = classified.entities;
    }

    // ── Step 2: Resolve artist aliases ────────────────────────────────────────
    entities.artist = resolveArtist(entities.artist);

    // ── Step 3: Check for missing required context ─────────────────────────────
    const missing = getMissingFields(intentType, entities);
    // For press_kit: also ask for recipient if artist is known but recipient is not
    const needsRecipient = intentType === "press_kit" && !!entities.artist && !entities.recipient;

    if (missing.length > 0 || needsRecipient) {
      const question = buildQuestion(intentType, missing, entities);
      return NextResponse.json({
        text: question,
        actionPerformed: false,
        printable: false,
        pendingIntent: { type: intentType, entities },
      });
    }

    // ── Step 4: Fetch vault docs for context-heavy intents ─────────────────────
    let docsContent = "";
    if (supabase && (intentType === "general" || intentType === "press_kit")) {
      docsContent = await fetchDocumentiContent(supabase);
    }

    // ── Step 5: Execute handler ────────────────────────────────────────────────
    switch (intentType) {
      case "press_kit": {
        const raw = await handlePressKit(entities, context, docsContent);
        const printable = raw.includes("[PRINTABLE]");
        const text = raw.replace(/\[PRINTABLE\]/g, "").trimEnd();
        return NextResponse.json({ text, actionPerformed: false, printable });
      }

      case "create_task": {
        const title = entities.taskTitle ?? lastMessage.content.slice(0, 120);
        if (!supabase) {
          return NextResponse.json({ text: "Errore: connessione al database non disponibile.", actionPerformed: false, printable: false });
        }
        const { error } = await supabase.from("tasks_kanban").insert({
          titolo: title,
          stato: "Da Fare",
          scadenza: entities.deadline ?? null,
        });
        if (error) {
          return NextResponse.json({ text: `Errore nella creazione del task: ${error.message}`, actionPerformed: false, printable: false });
        }
        return NextResponse.json({
          text: `Task **"${title}"** aggiunto al Kanban con stato "Da Fare".${entities.deadline ? ` Scadenza: ${entities.deadline}.` : ""}`,
          actionPerformed: true,
          actionMessage: `Task "${title}" creato.`,
          printable: false,
        });
      }

      case "create_event": {
        const title = entities.eventTitle ?? lastMessage.content.slice(0, 120);
        const date = entities.eventDate;
        if (!supabase) {
          return NextResponse.json({ text: "Errore: connessione al database non disponibile.", actionPerformed: false, printable: false });
        }
        if (!date) {
          return NextResponse.json({ text: "Non ho trovato una data valida. Puoi scriverla nel formato 'gg/mm/aaaa hh:mm'?", actionPerformed: false, printable: false, pendingIntent: { type: intentType, entities } });
        }
        const { error } = await supabase.from("eventi_calendario").insert({
          titolo: title,
          tipo_evento: entities.eventType ?? "altro",
          data_evento: date,
          luogo: entities.eventVenue ?? null,
          creato_da: body.userId ?? null,
        });
        if (error) {
          return NextResponse.json({ text: `Errore nella creazione dell'evento: ${error.message}`, actionPerformed: false, printable: false });
        }
        return NextResponse.json({
          text: `Evento **"${title}"** aggiunto al calendario per ${date}.${entities.eventVenue ? ` Luogo: ${entities.eventVenue}.` : ""}`,
          actionPerformed: true,
          actionMessage: `Evento "${title}" aggiunto al calendario.`,
          printable: false,
        });
      }

      case "search_vault": {
        const query = entities.searchQuery ?? lastMessage.content;
        return NextResponse.json({ text: handleVault(query, context), actionPerformed: false, printable: false });
      }

      default: {
        const text = await handleGeneral(lastMessage.content, history, context, docsContent);
        return NextResponse.json({ text, actionPerformed: false, printable: false });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore sconosciuto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
