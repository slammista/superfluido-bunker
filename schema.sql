-- SUPERFLUIDO Bunker — Schema SQL
-- Esegui questo script nel SQL Editor del tuo progetto Supabase.
-- È idempotente: puoi rieseguirlo anche se alcune tabelle/policy esistono già.
-- Dashboard > SQL Editor > New query > Incolla tutto > Run

-- =========================================================
-- TABELLE (CREATE IF NOT EXISTS — sicuro se già presenti)
-- =========================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id   uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'membro'
);

CREATE TABLE IF NOT EXISTS products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  category         text,
  base_price_sell  numeric,
  base_price_cost  numeric,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid REFERENCES products ON DELETE CASCADE,
  variant_name   text NOT NULL,
  stock_quantity integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS eventi_calendario (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creato_da        uuid REFERENCES auth.users,
  titolo           text NOT NULL,
  tipo_evento      text,
  data_evento      timestamptz,
  data_fine        timestamptz,
  luogo            text,
  note             text,
  colore           text DEFAULT '#ff6b35',
  membri_coinvolti text[] DEFAULT '{}',
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS album_progetti (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creato_da       uuid REFERENCES auth.users,
  nome_album      text NOT NULL,
  cover_image_url text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tracce_audio (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caricato_da    uuid REFERENCES auth.users,
  album_id       uuid REFERENCES album_progetti ON DELETE SET NULL,
  nome_traccia   text NOT NULL,
  fase           text DEFAULT 'Demo',
  audio_file_url text,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profili_artisti (
  user_id             uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nome_arte           text,
  strumentazione      text,
  bio_breve           text,
  email_contatto      text,
  link_instagram      text,
  link_spotify        text,
  profile_picture_url text,
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vault_documenti (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_file  text NOT NULL,
  cartella   text,
  file_url   text,
  created_at timestamptz DEFAULT now()
);

-- =========================================================
-- ROW LEVEL SECURITY
-- (ENABLE è no-op se già abilitato — nessun errore)
-- =========================================================

ALTER TABLE user_roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventi_calendario ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_progetti    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracce_audio      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profili_artisti   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_documenti   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_cartelle    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks_kanban      ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- POLICY (DROP IF EXISTS prima di creare — idempotente)
-- =========================================================

DROP POLICY IF EXISTS "auth_all" ON user_roles;
DROP POLICY IF EXISTS "auth_all" ON products;
DROP POLICY IF EXISTS "auth_all" ON product_variants;
DROP POLICY IF EXISTS "auth_all" ON eventi_calendario;
DROP POLICY IF EXISTS "auth_all" ON album_progetti;
DROP POLICY IF EXISTS "auth_all" ON tracce_audio;
DROP POLICY IF EXISTS "auth_all" ON profili_artisti;
DROP POLICY IF EXISTS "auth_all" ON vault_documenti;
DROP POLICY IF EXISTS "auth_all" ON vault_cartelle;
DROP POLICY IF EXISTS "auth_all" ON tasks_kanban;

CREATE POLICY "auth_all" ON user_roles        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON products          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON product_variants  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON eventi_calendario FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON album_progetti    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON tracce_audio      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON profili_artisti   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON vault_documenti   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON vault_cartelle    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON tasks_kanban      FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- VERIFICA FINALE (eseguila dopo per confermare)
-- =========================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
--
-- Deve restituire 10 righe:
-- album_progetti, eventi_calendario, product_variants,
-- products, profili_artisti, tasks_kanban, tracce_audio,
-- user_roles, vault_cartelle, vault_documenti

-- =========================================================
-- NUOVE COLONNE (ALTER TABLE ADD COLUMN IF NOT EXISTS — idempotente)
-- Da eseguire nel SQL Editor Supabase dopo aver rieseguito tutto lo schema
-- =========================================================

ALTER TABLE products     ADD COLUMN IF NOT EXISTS image_url   text;
ALTER TABLE products     ADD COLUMN IF NOT EXISTS description  text;
ALTER TABLE tracce_audio ADD COLUMN IF NOT EXISTS nota         text;
ALTER TABLE tracce_audio ADD COLUMN IF NOT EXISTS bpm          integer;
ALTER TABLE tracce_audio ADD COLUMN IF NOT EXISTS tonalita     text;

-- =========================================================
-- STORAGE BUCKET
-- =========================================================
-- Bucket esistente: superfluido_bucket (cartelle vault/ e audio/ dentro)
-- Assicurarsi che sia Public: ON nel dashboard Supabase.
