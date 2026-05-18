/**
 * Superfluido — Cross-reference catalog
 * Sources: Apple Music (iTunes API, free/no-auth) + Bandcamp scrape
 * Actions:
 *   1. Show what's in Bandcamp but NOT in DB
 *   2. Update link_apple for albums already in DB
 *   3. Import missing albums (dry-run by default, pass --import to actually insert)
 *
 * Run:
 *   node scripts/cross-reference.mjs           (dry-run, shows gaps)
 *   node scripts/cross-reference.mjs --import  (inserts missing + updates links)
 */

const DRY_RUN = !process.argv.includes("--import");
const SUPABASE_URL = "https://jbugnzagefqkvimaqyki.supabase.co";
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidWduemFnZWZxa3ZpbWFxeWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTAxMjQ2OCwiZXhwIjoyMDkwNTg4NDY4fQ.QuR9u2mY_Zt5RUxKD0v0H5GcEvi-cvDPTvQnCeoZyNA";

const APPLE_ARTISTS = [
  { id: "1626710348", name: "SUPERFLUIDO" },
  { id: "1390375104", name: "Slam aka Hysteriack" },
  { id: "1562859432", name: "gg.Proiettili" },
  { id: "1614434922", name: "NONe" },
  { id: "1492306873", name: "Martire" },
  { id: "1464476561", name: "Eric Draven" },
  { id: "1586775975", name: "Leony47" },
];

const BANDCAMP_URL = "https://superfluido.bandcamp.com/music";

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

// ── Normalize title for fuzzy matching ────────────────────────────────────────
function norm(s) {
  return (s ?? "")
    .toLowerCase().trim()
    .replace(/[àáâãä]/g, "a").replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i").replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// Strips Apple Music suffixes (" - EP", " - Single", "(feat. ...)", "[...]") for matching
function normForMatch(s) {
  return norm(
    (s ?? "")
      .replace(/\s*-\s*(ep|single|album|compilation|lp|mixtape)\s*$/i, "")
      .replace(/\s*\(feat\..*?\)/gi, "")
      .replace(/\s*\[.*?\]/g, "")
  );
}

// ── Apple Music (iTunes Search API, free, no auth) ────────────────────────────
async function fetchAppleArtistAlbums(artistId, artistName) {
  await new Promise(r => setTimeout(r, 300)); // gentle rate limiting
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=200&sort=recent`
  );
  if (!res.ok) throw new Error(`iTunes error for ${artistName}: ${res.statusText}`);
  const data = await res.json();

  // First result is the artist itself; rest are albums
  return (data.results ?? [])
    .filter(r => r.wrapperType === "collection")
    .map(r => ({
      apple_id:     String(r.collectionId),
      title:        r.collectionName,
      release_date: r.releaseDate?.slice(0, 10) ?? null,
      cover_url:    (r.artworkUrl100 ?? "").replace("100x100", "600x600"),
      link_apple:   r.collectionViewUrl?.replace(/\?.*/, "") ?? null,
      tipo_release: { Album: "album", Single: "single", "EP": "ep", Compilation: "compilation" }[r.collectionType] ?? "album",
      artist:       artistName,
    }));
}

// ── Bandcamp scrape ───────────────────────────────────────────────────────────
async function fetchBandcampAlbums() {
  const res = await fetch(BANDCAMP_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; catalog-check)" },
  });
  if (!res.ok) throw new Error(`Bandcamp error: ${res.statusText}`);
  const html = await res.text();

  const albums = [];
  // Each item: <li data-item-id="album-NNN" ...> ... <a href="/album/slug"> ... <p class="title">TITLE<br>... </p>
  // Use a regex that captures the block for each album item
  const blockRe = /data-item-id="album-\d+"[\s\S]*?<\/li>/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const block = m[0];
    const href  = block.match(/href="(\/album\/[^"]+)"/)?.[1];
    const titleBlock = block.match(/<p class="title">([\s\S]*?)<\/p>/)?.[1] ?? "";
    // Title is text before <br>
    const title  = titleBlock.split(/<br\s*\/?>/i)[0].replace(/<[^>]+>/g, "").trim();
    const artist = titleBlock.match(/<span class="artist-override">([\s\S]*?)<\/span>/)?.[1]
      ?.replace(/<[^>]+>/g, "").trim() ?? "SUPERFLUIDO";

    if (title && href) {
      albums.push({
        title,
        artist,
        link_bandcamp: `https://superfluido.bandcamp.com${href}`,
      });
    }
  }
  return albums;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function getDbAlbums() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/album_progetti?select=id,nome_album,link_apple,link_bandcamp,spotify_album_id,tipo_release,stato`,
    { headers: sbHeaders }
  );
  if (!res.ok) throw new Error(`Supabase: ${await res.text()}`);
  return res.json();
}

async function insertAlbums(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/album_progetti`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Insert failed: ${await res.text()}`);
}

async function patchAlbum(id, fields) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/album_progetti?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...sbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`Patch failed: ${await res.text()}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("🔍 Superfluido — Catalog Cross-Reference\n");
if (DRY_RUN) console.log("   (dry-run — passa --import per applicare le modifiche)\n");

// 1. Fetch DB
const dbAlbums = await getDbAlbums();
const dbByNorm = new Map(dbAlbums.map(a => [normForMatch(a.nome_album), a]));
console.log(`✓ DB: ${dbAlbums.length} album\n`);

// 2. Fetch Apple Music
console.log("🍎 Fetching Apple Music...");
const appleMap = new Map(); // apple_id → album
for (const artist of APPLE_ARTISTS) {
  process.stdout.write(`   ${artist.name}...`);
  const albums = await fetchAppleArtistAlbums(artist.id, artist.name);
  let added = 0;
  for (const al of albums) {
    if (!appleMap.has(al.apple_id)) { appleMap.set(al.apple_id, al); added++; }
  }
  console.log(` ${albums.length} trovati, ${added} unici`);
}
console.log(`   Totale unici Apple Music: ${appleMap.size}\n`);

// 3. Fetch Bandcamp
console.log("🎸 Fetching Bandcamp...");
const bcAlbums = await fetchBandcampAlbums();
console.log(`   Trovati: ${bcAlbums.length} release su ${BANDCAMP_URL}\n`);

// ── Analysis ──────────────────────────────────────────────────────────────────

// 4a. Apple Music: find matches (update link_apple) and missing (insert)
const appleToUpdate = []; // { id, link_apple }
const appleToInsert = []; // new rows
const appleAlreadyLinked = [];

for (const [, al] of appleMap) {
  const dbMatch = dbByNorm.get(normForMatch(al.title));
  if (dbMatch) {
    if (!dbMatch.link_apple && al.link_apple) {
      appleToUpdate.push({ id: dbMatch.id, link_apple: al.link_apple, tipo_release: al.tipo_release });
    } else {
      appleAlreadyLinked.push(al.title);
    }
  } else {
    appleToInsert.push({
      nome_album:      al.title,
      release_date:    al.release_date,
      stato:           "released",
      tipo_release:    al.tipo_release,
      link_apple:      al.link_apple,
      cover_image_url: al.cover_url,
      spotify_album_id: `apple_${al.apple_id}`,
    });
  }
}

// 4b. Bandcamp: find missing and existing-without-link
const bcToUpdate  = [];
const bcToInsert  = [];
const bcAlreadyLinked = [];

for (const al of bcAlbums) {
  const dbMatch = dbByNorm.get(normForMatch(al.title));
  if (dbMatch) {
    const hasDeezerLink = dbMatch.link_bandcamp?.startsWith("https://www.deezer.com") ||
                          dbMatch.link_bandcamp?.startsWith("https://deezer.com");
    if (!dbMatch.link_bandcamp || hasDeezerLink) {
      bcToUpdate.push({ id: dbMatch.id, link_bandcamp: al.link_bandcamp });
    } else {
      bcAlreadyLinked.push(al.title);
    }
  } else {
    // Check if already in appleToInsert (same title)
    const alreadyQueued = appleToInsert.find(r => normForMatch(r.nome_album) === normForMatch(al.title));
    if (alreadyQueued) {
      alreadyQueued.link_bandcamp = al.link_bandcamp; // enrich with BC link
    } else {
      bcToInsert.push({
        nome_album:   al.title,
        stato:        "released",
        link_bandcamp: al.link_bandcamp,
      });
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════");
console.log("📊 REPORT\n");

console.log(`✅ ${appleAlreadyLinked.length} album già collegati ad Apple Music`);
console.log(`🔗 ${appleToUpdate.length} album nel DB → aggiungo link_apple`);
console.log(`🆕 ${appleToInsert.length} album su Apple Music NON in DB → da importare\n`);

console.log(`✅ ${bcAlreadyLinked.length} album già con link Bandcamp`);
console.log(`🔗 ${bcToUpdate.length} album nel DB → aggiungo/aggiorno link_bandcamp`);
console.log(`🆕 ${bcToInsert.length} album su Bandcamp NON in DB → da importare\n`);

if (appleToInsert.length > 0) {
  console.log("── Apple Music: mancanti dal DB ──");
  for (const r of appleToInsert) console.log(`   [${r.tipo_release}] ${r.nome_album} (${r.release_date?.slice(0, 4) ?? "?"})`);
  console.log();
}

if (bcToInsert.length > 0) {
  console.log("── Bandcamp: mancanti dal DB ──");
  for (const r of bcToInsert) console.log(`   ${r.nome_album}`);
  console.log();
}

// ── Cross-check: in DB but not on Bandcamp ────────────────────────────────────
const bcNorms = new Set(bcAlbums.map(a => normForMatch(a.title)));
const appleNorms = new Set([...appleMap.values()].map(a => normForMatch(a.title)));

const inDbNotBc = dbAlbums.filter(a =>
  a.stato === "released" &&
  !bcNorms.has(normForMatch(a.nome_album)) &&
  !appleNorms.has(normForMatch(a.nome_album))
);
if (inDbNotBc.length > 0) {
  console.log(`── ${inDbNotBc.length} album nel DB non trovati né su Bandcamp né su Apple Music ──`);
  console.log("   (potrebbero essere uscite solo Deezer, nomi leggermente diversi, o da verificare)");
  for (const a of inDbNotBc) console.log(`   ${a.nome_album}`);
  console.log();
}

if (DRY_RUN) {
  console.log("═══════════════════════════════════════════════");
  console.log("Dry-run completato. Per applicare: node scripts/cross-reference.mjs --import");
  process.exit(0);
}

// ── Apply changes ─────────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════");
console.log("⚙️  Applicazione modifiche...\n");

// Update link_apple
let updA = 0;
for (const { id, link_apple, tipo_release } of appleToUpdate) {
  const fields = { link_apple };
  // Also update tipo_release if currently null (Apple Music types are more accurate)
  const existing = dbAlbums.find(a => a.id === id);
  if (!existing?.tipo_release) fields.tipo_release = tipo_release;
  await patchAlbum(id, fields);
  updA++;
  process.stdout.write(`  Apple links: ${updA}/${appleToUpdate.length}\r`);
}
if (updA) console.log(`\n✅ ${updA} album aggiornati con link_apple`);

// Update link_bandcamp (actual Bandcamp links, replacing Deezer links)
let updB = 0;
for (const { id, link_bandcamp } of bcToUpdate) {
  await patchAlbum(id, { link_bandcamp });
  updB++;
  process.stdout.write(`  Bandcamp links: ${updB}/${bcToUpdate.length}\r`);
}
if (updB) console.log(`\n✅ ${updB} album aggiornati con link_bandcamp`);

// Insert missing from Apple Music
if (appleToInsert.length > 0) {
  await insertAlbums(appleToInsert);
  console.log(`✅ ${appleToInsert.length} nuovi album da Apple Music`);
}

// Insert missing from Bandcamp only
if (bcToInsert.length > 0) {
  await insertAlbums(bcToInsert);
  console.log(`✅ ${bcToInsert.length} nuovi album da Bandcamp`);
}

const totalNew = appleToInsert.length + bcToInsert.length;
const totalUpdated = updA + updB;
console.log(`\n🏁 Fatto: ${totalNew} nuovi importati, ${totalUpdated} link aggiornati.`);
