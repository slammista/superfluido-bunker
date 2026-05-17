export type Role = "master" | "membro" | "guest" | string;

export type ProductVariant = {
  id: string | number;
  variant_name: string;
  stock_quantity: number;
};

export type Product = {
  id: string | number;
  name: string;
  category: string | null;
  base_price_sell: number | null;
  base_price_cost: number | null;
  image_url?: string | null;
  description?: string | null;
  product_variants?: ProductVariant[];
};

export type CalendarEvent = {
  id: string | number;
  titolo: string;
  tipo_evento: string;
  data_evento: string;
  data_fine?: string | null;
  luogo?: string | null;
  note?: string | null;
  colore?: string | null;
  creato_da?: string;
};

export type Album = {
  id: string | number;
  nome_album: string;
  cover_image_url?: string | null;
  release_date?: string | null;
  stato?: string | null;
  link_spotify?: string | null;
  link_apple?: string | null;
  link_bandcamp?: string | null;
  spotify_album_id?: string | null;
  spotify_cover_url?: string | null;
};

export type Track = {
  id: string | number;
  album_id?: string | number;
  nome_traccia: string;
  fase: string | null;
  audio_file_url?: string | null;
  nota?: string | null;
  bpm?: number | null;
  tonalita?: string | null;
  album_progetti?: { id: string | number; nome_album: string } | null;
};

export type ArtistProfile = {
  id?: string | number;
  user_id: string;
  nome_arte: string | null;
  strumentazione: string | null;
  bio_breve: string | null;
  email_contatto: string | null;
  link_instagram: string | null;
  link_spotify: string | null;
  profile_picture_url?: string | null;
};

export type VaultFile = {
  id: string | number;
  nome_file: string;
  cartella: string;
  file_url: string;
  created_at?: string;
};

export type VaultFolder = {
  id: string | number;
  nome: string;
  creato_da?: string;
  created_at?: string;
};

export type KanbanTask = {
  id: string | number;
  titolo: string;
  descrizione?: string | null;
  assegnato_a?: string | null;
  stato: string;
  scadenza?: string | null;
  created_at?: string;
};
