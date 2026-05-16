import type { Album, ArtistProfile, CalendarEvent, Product, Track, VaultFile } from "./types";

export const sampleProducts: Product[] = [
  {
    id: "demo-tee",
    name: "SUPERFLUIDO Tee",
    category: "Merch",
    base_price_sell: 28,
    base_price_cost: 11,
    product_variants: [
      { id: "s", variant_name: "S", stock_quantity: 8 },
      { id: "m", variant_name: "M", stock_quantity: 14 },
      { id: "l", variant_name: "L", stock_quantity: 5 },
    ],
  },
  {
    id: "demo-vinyl",
    name: "Bunker Sessions Vol. 1",
    category: "Vinile",
    base_price_sell: 24,
    base_price_cost: 9,
    product_variants: [{ id: "black", variant_name: "Black", stock_quantity: 31 }],
  },
  {
    id: "demo-poster",
    name: "Poster Tour A2",
    category: "Print",
    base_price_sell: 12,
    base_price_cost: 3,
    product_variants: [{ id: "a2", variant_name: "A2", stock_quantity: 42 }],
  },
];

export const sampleEvents: CalendarEvent[] = [
  {
    id: "release",
    titolo: "Release listening session",
    tipo_evento: "Release",
    data_evento: new Date().toISOString(),
    luogo: "Bunker Room A",
    colore: "#ff6b35",
  },
  {
    id: "live",
    titolo: "Live set preview",
    tipo_evento: "Live",
    data_evento: new Date(Date.now() + 86400000 * 3).toISOString(),
    luogo: "Warehouse stage",
    colore: "#63e6be",
  },
  {
    id: "studio",
    titolo: "Mix revision",
    tipo_evento: "Sessione Studio",
    data_evento: new Date(Date.now() + 86400000 * 6).toISOString(),
    luogo: "Studio B",
    colore: "#74c0fc",
  },
];

export const sampleAlbums: Album[] = [
  { id: "a1", nome_album: "Bunker Takes" },
  { id: "a2", nome_album: "Night Export" },
];

export const sampleTracks: Track[] = [
  { id: "t1", nome_traccia: "Vetro Frequente", fase: "Mix", album_progetti: { id: "a1", nome_album: "Bunker Takes" } },
  { id: "t2", nome_traccia: "Linea Sud", fase: "Master", album_progetti: { id: "a1", nome_album: "Bunker Takes" } },
  { id: "t3", nome_traccia: "Offline Club", fase: "Demo", album_progetti: { id: "a2", nome_album: "Night Export" } },
];

export const sampleProfiles: ArtistProfile[] = [
  {
    user_id: "demo",
    nome_arte: "SUPERFLUIDO",
    strumentazione: "Live electronics, synth, voices",
    bio_breve: "Collettivo indipendente con focus su release ibride, studio sessions e performance.",
    email_contatto: "booking@superfluido.local",
    link_instagram: "",
    link_spotify: "",
  },
];

export const sampleVault: VaultFile[] = [
  { id: "v1", nome_file: "Stage plot.pdf", cartella: "Live", file_url: "#" },
  { id: "v2", nome_file: "Press photos.zip", cartella: "Press", file_url: "#" },
  { id: "v3", nome_file: "Contratto venue.docx", cartella: "Amministrazione", file_url: "#" },
];
