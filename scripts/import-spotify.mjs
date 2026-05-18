/**
 * Superfluido Discography Import — Deezer source
 * Spotify API requires Premium (policy change Nov 2024), using Deezer instead.
 *
 * Run: node scripts/import-spotify.mjs
 */

const SUPABASE_URL = "https://jbugnzagefqkvimaqyki.supabase.co";
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidWduemFnZWZxa3ZpbWFxeWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTAxMjQ2OCwiZXhwIjoyMDkwNTg4NDY4fQ.QuR9u2mY_Zt5RUxKD0v0H5GcEvi-cvDPTvQnCeoZyNA";

// Deezer artist IDs confirmed correct
const DEEZER_ARTISTS = [
  { id: 155779572, name: "SUPERFLUIDO" },
  { id: 14920489,  name: "Slam aka Hysteriack" },
  { id: 152314552, name: "gg.Proiettili" },
  { id: 146224872, name: "Leony47" },
  { id: 207248547, name: "NONe" },
  { id: 61543212,  name: "Eric Draven" },
  { id: 5163906,   name: "Martire" }, // note: Deezer profile mixed with another artist
];

const ARTIST_IDS = new Set(DEEZER_ARTISTS.map(a => a.id));

// ── Deezer helpers ───────────────────────────────────────────────────────────

async function fetchArtistAlbums(artistId) {
  const res = await fetch(`https://api.deezer.com/artist/${artistId}/albums?limit=100`);
  if (!res.ok) throw new Error(`Deezer error: ${res.statusText}`);
  const data = await res.json();
  return data.data ?? [];
}

// ── Supabase helpers ─────────────────────────────────────────────────────────

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function getExistingAlbums() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/album_progetti?select=id,nome_album,spotify_album_id,tipo_release`,
    { headers: sbHeaders }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase read: ${body}`);
  }
  return res.json();
}

async function insertAlbums(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/album_progetti`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes("does not exist") && body.includes("column")) {
      console.error("\n❌ Colonne mancanti nel DB. Esegui nel SQL Editor Supabase:\n");
      console.error(`ALTER TABLE album_progetti ADD COLUMN IF NOT EXISTS release_date      date;
ALTER TABLE album_progetti ADD COLUMN IF NOT EXISTS stato             text DEFAULT 'in_progress';
ALTER TABLE album_progetti ADD COLUMN IF NOT EXISTS link_spotify      text;
ALTER TABLE album_progetti ADD COLUMN IF NOT EXISTS link_apple        text;
ALTER TABLE album_progetti ADD COLUMN IF NOT EXISTS link_bandcamp     text;
ALTER TABLE album_progetti ADD COLUMN IF NOT EXISTS spotify_album_id  text;
ALTER TABLE album_progetti ADD COLUMN IF NOT EXISTS cover_image_url   text;
ALTER TABLE album_progetti ADD COLUMN IF NOT EXISTS tipo_release      text;\n`);
      process.exit(1);
    }
    throw new Error(`Supabase insert: ${body}`);
  }
}

async function updateTipoRelease(id, tipo_release) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/album_progetti?id=eq.${id}`,
    {
      method: "PATCH",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ tipo_release }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase update: ${body}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log("🎵 Superfluido — Import Discografia (Deezer)\n");

// 1. Fetch all existing albums from DB
const existing = await getExistingAlbums();
const existingTitles = new Set(existing.map((r) => r.nome_album?.toLowerCase().trim()));
const existingByDeezerId = new Map(
  existing
    .filter(r => r.spotify_album_id?.startsWith("deezer_"))
    .map(r => [r.spotify_album_id.replace("deezer_", ""), r])
);
console.log(`✓ ${existing.length} album già presenti nel DB\n`);

// 2. Collect all Deezer albums with type info
const rawAlbums = new Map(); // deezer_id → { album, tipo_release }

for (const artist of DEEZER_ARTISTS) {
  process.stdout.write(`  Fetching ${artist.name}...`);
  const albums = await fetchArtistAlbums(artist.id);
  let added = 0;
  for (const al of albums) {
    if (!rawAlbums.has(al.id)) {
      // Determine type: collaboration if the album's main artist is not one of ours
      const mainArtistId = al.artist?.id;
      const isCollab = mainArtistId && !ARTIST_IDS.has(mainArtistId);
      const tipo = isCollab ? "collab" : (al.record_type ?? "album");
      rawAlbums.set(al.id, { album: al, tipo_release: tipo });
      added++;
    }
  }
  console.log(` ${albums.length} trovati, ${added} unici`);
}

console.log(`\n  Totale unici Deezer: ${rawAlbums.size}`);

// 3. Split: new inserts vs. existing records needing tipo_release update
const toInsert = [];
const toUpdate = []; // { id, tipo_release }
let skipped = 0;

for (const [deezerAlbumId, { album: al, tipo_release }] of rawAlbums) {
  const titleLower = al.title?.toLowerCase().trim();
  const deezerKey = String(deezerAlbumId);

  // Check if already in DB by deezer ID
  const existingRecord = existingByDeezerId.get(deezerKey);
  if (existingRecord) {
    // Already imported — update tipo_release if missing
    if (!existingRecord.tipo_release) {
      toUpdate.push({ id: existingRecord.id, tipo_release });
    }
    skipped++;
    continue;
  }

  // Check by title (for records imported before deezer_ id tracking)
  if (existingTitles.has(titleLower)) {
    skipped++;
    continue;
  }

  const coverUrl = al.cover_xl ?? al.cover_big ?? al.cover ?? null;

  toInsert.push({
    nome_album:       al.title,
    release_date:     al.release_date ?? null,
    stato:            "released",
    link_bandcamp:    al.link ?? null,
    cover_image_url:  coverUrl,
    spotify_album_id: `deezer_${deezerAlbumId}`,
    tipo_release,
  });
}

console.log(`\n  ${skipped} già presenti → skip`);
console.log(`  ${toInsert.length} nuovi da inserire`);
console.log(`  ${toUpdate.length} da aggiornare con tipo_release\n`);

// 4. Insert new albums in batches
if (toInsert.length > 0) {
  const BATCH = 50;
  let done = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    await insertAlbums(toInsert.slice(i, i + BATCH));
    done += Math.min(BATCH, toInsert.length - i);
    process.stdout.write(`  Inseriti ${done}/${toInsert.length}...\r`);
  }
  console.log(`\n✅ ${done} nuovi album aggiunti.`);
} else {
  console.log("✓ Nessun nuovo album da inserire.");
}

// 5. Update tipo_release for existing records
if (toUpdate.length > 0) {
  console.log(`\n  Aggiornamento tipo_release per ${toUpdate.length} album esistenti...`);
  let updated = 0;
  for (const { id, tipo_release } of toUpdate) {
    await updateTipoRelease(id, tipo_release);
    updated++;
    process.stdout.write(`  Aggiornati ${updated}/${toUpdate.length}...\r`);
  }
  console.log(`\n✅ ${updated} album aggiornati con tipo_release.`);
} else {
  console.log("✓ tipo_release già presente su tutti i record Deezer.");
}

console.log("\n📊 Riepilogo tipi:");
const typeCount = {};
for (const [, { tipo_release }] of rawAlbums) {
  typeCount[tipo_release] = (typeCount[tipo_release] ?? 0) + 1;
}
for (const [tipo, count] of Object.entries(typeCount)) {
  console.log(`   ${tipo.padEnd(12)} ${count}`);
}

console.log("\nNote:");
console.log("  • 'collab' = album di altri artisti in cui i nostri compaiono");
console.log("  • Martire (5163906): profilo Deezer misto — alcuni album potrebbero essere di altri artisti");
console.log("  • Per aggiungere i link Spotify: vai su Distrib → apri il pannello → auto-compila\n");
