"use client";

import {
  AlertTriangle,
  Archive,
  Bot,
  CalendarDays,
  ChevronRight,
  Disc3,
  Download,
  FileAudio,
  FolderOpen,
  Home,
  Loader2,
  LogOut,
  Package,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  Warehouse,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { sampleAlbums, sampleEvents, sampleProducts, sampleProfiles, sampleTracks, sampleVault } from "@/lib/sample-data";
import type { Album, ArtistProfile, CalendarEvent, Product, Role, Track, VaultFile } from "@/lib/types";

type View = "home" | "inventory" | "calendar" | "projects" | "press" | "profile" | "vault";

type AppUser = {
  id: string;
  email: string;
  role: Role;
};

type AppState = {
  products: Product[];
  events: CalendarEvent[];
  albums: Album[];
  tracks: Track[];
  profiles: ArtistProfile[];
  vault: VaultFile[];
};

const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: "home", label: "Overview", icon: Home },
  { id: "inventory", label: "Magazzino", icon: Package },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "projects", label: "Studio Hub", icon: Disc3 },
  { id: "press", label: "AI Press Kit", icon: Bot },
  { id: "profile", label: "Profili", icon: UserRound },
  { id: "vault", label: "Vault", icon: FolderOpen },
];

const emptyState: AppState = {
  products: sampleProducts,
  events: sampleEvents,
  albums: sampleAlbums,
  tracks: sampleTracks,
  profiles: sampleProfiles,
  vault: sampleVault,
};

export function SuperfluidoApp() {
  const [view, setView] = useState<View>("home");
  const [user, setUser] = useState<AppUser | null>(null);
  const [state, setState] = useState<AppState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        if (data.session?.user) {
          const role = await fetchRole(data.session.user.id);
          const appUser = {
            id: data.session.user.id,
            email: data.session.user.email ?? "utente@superfluido.it",
            role: role ?? "membro",
          };
          setUser(appUser);
          await loadWorkspace(appUser.id);
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Supabase non configurato. Uso dati demo.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    boot();
    return () => {
      mounted = false;
    };
  }, []);

  async function fetchRole(userId: string) {
    const supabase = getSupabase();
    const { data } = await supabase.from("user_roles").select("role").eq("id", userId).maybeSingle();
    return data?.role as Role | undefined;
  }

  async function loadWorkspace(userId: string) {
    const supabase = getSupabase();

    const [products, events, albums, tracks, profiles, vault] = await Promise.all([
      supabase.from("products").select("*, product_variants(*)"),
      supabase.from("eventi_calendario").select("*").order("data_evento"),
      supabase.from("album_progetti").select("*").eq("creato_da", userId),
      supabase.from("tracce_audio").select("*, album_progetti(id, nome_album)").eq("caricato_da", userId),
      supabase.from("profili_artisti").select("*"),
      supabase.from("vault_documenti").select("*").order("created_at", { ascending: false }),
    ]);

    setState({
      products: products.data?.length ? (products.data as Product[]) : sampleProducts,
      events: events.data?.length ? (events.data as CalendarEvent[]) : sampleEvents,
      albums: albums.data?.length ? (albums.data as Album[]) : sampleAlbums,
      tracks: tracks.data?.length ? (tracks.data as Track[]) : sampleTracks,
      profiles: profiles.data?.length ? (profiles.data as ArtistProfile[]) : sampleProfiles,
      vault: vault.data?.length ? (vault.data as VaultFile[]) : sampleVault,
    });
  }

  async function handleLogin(email: string, password: string) {
    setLoading(true);
    setNotice(null);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      if (!data.user) {
        throw new Error("Login non riuscito.");
      }
      const role = await fetchRole(data.user.id);
      const appUser = { id: data.user.id, email: data.user.email ?? email, role: role ?? "membro" };
      setUser(appUser);
      await loadWorkspace(appUser.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Errore durante il login.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await getSupabase().auth.signOut();
    } finally {
      setUser(null);
      setState(emptyState);
      setView("home");
    }
  }

  if (!user) {
    return <LoginScreen loading={loading} notice={notice} onLogin={handleLogin} />;
  }

  return (
    <main className="min-h-screen">
      <div className="fixed inset-0 -z-10 opacity-35">
        <Image src="/assets/background_main.png" alt="" fill priority className="object-cover" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/55 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <button className="flex items-center gap-3 text-left" onClick={() => setView("home")}>
            <span className="relative block h-10 w-10 overflow-hidden rounded-md border border-white/10 bg-white/5">
              <Image src="/assets/logo_login.png" alt="SUPERFLUIDO" fill className="object-contain p-1" />
            </span>
            <span>
              <span className="block text-sm font-black tracking-[0.18em] text-white">SUPERFLUIDO</span>
              <span className="block text-xs text-white/48">Bunker Operating System</span>
            </span>
          </button>

          <nav className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/[0.035] p-1 xl:flex">
            {navItems.map((item) => (
              <NavButton key={item.id} active={view === item.id} item={item} onClick={() => setView(item.id)} />
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-white">{user.email}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-orange-300">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.045] text-white/70 transition hover:border-orange-400/50 hover:text-orange-200"
              title="Esci"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 xl:hidden">
          {navItems.map((item) => (
            <NavButton key={item.id} active={view === item.id} item={item} onClick={() => setView(item.id)} compact />
          ))}
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 lg:py-8">
        {notice ? <Notice text={notice} /> : null}

        <div className={view === "home" ? "" : "hidden"}>
          <Overview state={state} user={user} goTo={setView} />
        </div>
        <div className={view === "inventory" ? "" : "hidden"}>
          <Inventory products={state.products} user={user} reload={() => loadWorkspace(user.id)} />
        </div>
        <div className={view === "calendar" ? "" : "hidden"}>
          <CalendarModule events={state.events} user={user} reload={() => loadWorkspace(user.id)} />
        </div>
        <div className={view === "projects" ? "" : "hidden"}>
          <Projects albums={state.albums} tracks={state.tracks} user={user} reload={() => loadWorkspace(user.id)} />
        </div>
        <div className={view === "press" ? "" : "hidden"}>
          <PressKit state={state} />
        </div>
        <div className={view === "profile" ? "" : "hidden"}>
          <Profiles profiles={state.profiles} user={user} reload={() => loadWorkspace(user.id)} />
        </div>
        <div className={view === "vault" ? "" : "hidden"}>
          <Vault files={state.vault} user={user} reload={() => loadWorkspace(user.id)} />
        </div>
      </section>
    </main>
  );
}

function LoginScreen({
  loading,
  notice,
  onLogin,
}: {
  loading: boolean;
  notice: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin(email, password);
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="fixed inset-0 -z-10 opacity-45">
        <Image src="/assets/background_main.png" alt="" fill priority className="object-cover" />
      </div>
      <form onSubmit={submit} className="glass w-full max-w-md rounded-md p-7">
        <div className="mx-auto mb-8 h-28 w-52">
          <Image src="/assets/logo_login.png" alt="SUPERFLUIDO" width={420} height={220} className="h-full w-full object-contain" priority />
        </div>
        <h1 className="text-center text-2xl font-black tracking-tight text-white">Bunker Login</h1>
        <p className="mt-2 text-center text-sm text-white/55">Accesso operativo a magazzino, studio, calendario e AI press kit.</p>

        {notice ? <Notice text={notice} /> : null}

        <label className="mt-6 block text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Email</label>
        <input className="field mt-2 rounded-md px-4 py-3" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="utente@superfluido.it" />

        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Password</label>
        <input className="field mt-2 rounded-md px-4 py-3" value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" />

        <button
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
          Entra
        </button>
      </form>
    </main>
  );
}

function NavButton({
  item,
  active,
  compact,
  onClick,
}: {
  item: { label: string; icon: typeof Home };
  active: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-bold transition ${
        active
          ? "bg-orange-500 text-black"
          : "text-white/62 hover:bg-white/8 hover:text-white"
      } ${compact ? "border border-white/10 bg-white/[0.04]" : ""}`}
    >
      <Icon size={15} />
      {item.label}
    </button>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="my-4 flex items-start gap-3 rounded-md border border-orange-400/25 bg-orange-500/10 p-4 text-sm text-orange-100">
      <AlertTriangle className="mt-0.5 shrink-0" size={18} />
      <p>{text}</p>
    </div>
  );
}

function ModuleHeader({ title, text, icon: Icon }: { title: string; text: string; icon: typeof Home }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-md border border-orange-400/30 bg-orange-500/14 text-orange-200">
          <Icon size={21} />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-white md:text-5xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/56">{text}</p>
      </div>
    </div>
  );
}

function Overview({ state, user, goTo }: { state: AppState; user: AppUser; goTo: (view: View) => void }) {
  const totalStock = state.products.reduce(
    (sum, product) => sum + (product.product_variants ?? []).reduce((variantSum, variant) => variantSum + Number(variant.stock_quantity ?? 0), 0),
    0,
  );
  const lowStock = state.products.filter((product) => (product.product_variants ?? []).some((variant) => Number(variant.stock_quantity) < 6));

  return (
    <>
      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass overflow-hidden rounded-md p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-orange-300">Control room</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight text-white md:text-7xl">
            SUPERFLUIDO Bunker
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/62">
            Dashboard operativa per studio, release, eventi, merch e press kit. Collegata a Supabase e pronta per Vercel.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => goTo("press")} className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300">
              <Sparkles size={18} />
              Genera Press Kit
            </button>
            <button onClick={() => goTo("projects")} className="inline-flex items-center gap-2 rounded-md border border-white/12 bg-white/[0.055] px-4 py-3 text-sm font-bold text-white transition hover:border-white/25">
              <FileAudio size={18} />
              Apri Studio Hub
            </button>
          </div>
        </div>

        <div className="glass rounded-md p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Sessione</p>
          <p className="mt-3 text-xl font-black text-white">{user.email}</p>
          <p className="text-sm text-orange-200">{user.role}</p>
          <div className="mt-8 space-y-3">
            {[
              ["Magazzino", `${totalStock} pezzi`],
              ["Eventi", `${state.events.length} in calendario`],
              ["Tracce", `${state.tracks.length} in lavorazione`],
              ["Vault", `${state.vault.length} documenti`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-white/8 pb-3">
                <span className="text-sm text-white/54">{label}</span>
                <span className="font-mono text-sm text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="metric-grid mt-5 grid gap-4">
        <Metric title="Stock totale" value={totalStock.toString()} tone="orange" />
        <Metric title="Alert stock" value={lowStock.length.toString()} tone="red" />
        <Metric title="Release assets" value={state.tracks.length.toString()} tone="blue" />
        <Metric title="Profili artisti" value={state.profiles.length.toString()} tone="green" />
      </section>
    </>
  );
}

function Metric({ title, value, tone }: { title: string; value: string; tone: "orange" | "red" | "blue" | "green" }) {
  const tones = {
    orange: "text-orange-200 bg-orange-500/12 border-orange-400/25",
    red: "text-red-200 bg-red-500/10 border-red-400/25",
    blue: "text-sky-200 bg-sky-500/10 border-sky-400/25",
    green: "text-emerald-200 bg-emerald-500/10 border-emerald-400/25",
  };
  return (
    <div className={`rounded-md border p-5 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-65">{title}</p>
      <p className="mt-3 font-mono text-4xl font-black">{value}</p>
    </div>
  );
}

function Inventory({ products, user, reload }: { products: Product[]; user: AppUser; reload: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const filtered = products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase()));

  async function addDemoProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "");
    const category = String(data.get("category") ?? "Merch");
    const stock = Number(data.get("stock") ?? 0);

    const supabase = getSupabase();
    const created = await supabase.from("products").insert({
      name,
      category,
      base_price_sell: Number(data.get("price") ?? 0),
      base_price_cost: 0,
    }).select().single();

    if (created.data) {
      await supabase.from("product_variants").insert({
        product_id: created.data.id,
        variant_name: "Default",
        stock_quantity: stock,
      });
      await reload();
    }
  }

  return (
    <>
      <ModuleHeader title="Magazzino" text="Inventario merch, varianti e alert stock con lettura diretta dalle tabelle products e product_variants." icon={Warehouse} />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="glass rounded-md p-5">
          <div className="mb-5 flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3">
            <Search size={18} className="text-white/40" />
            <input className="w-full bg-transparent text-sm text-white outline-none" placeholder="Cerca prodotto, categoria o variante" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-white/38">
                <tr>
                  <th className="border-b border-white/10 py-3">Prodotto</th>
                  <th className="border-b border-white/10 py-3">Categoria</th>
                  <th className="border-b border-white/10 py-3">Varianti</th>
                  <th className="border-b border-white/10 py-3 text-right">Prezzo</th>
                  <th className="border-b border-white/10 py-3 text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const stock = (product.product_variants ?? []).reduce((sum, item) => sum + Number(item.stock_quantity ?? 0), 0);
                  return (
                    <tr key={product.id} className="border-b border-white/7 text-white/78">
                      <td className="py-4 font-bold text-white">{product.name}</td>
                      <td className="py-4">{product.category ?? "Generale"}</td>
                      <td className="py-4">{(product.product_variants ?? []).map((variant) => `${variant.variant_name}: ${variant.stock_quantity}`).join(" · ")}</td>
                      <td className="py-4 text-right font-mono">{formatEuro(product.base_price_sell)}</td>
                      <td className={`py-4 text-right font-mono font-black ${stock < 6 ? "text-red-300" : "text-emerald-300"}`}>{stock}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={addDemoProduct} className="glass rounded-md p-5">
          <p className="text-lg font-black text-white">Nuovo prodotto</p>
          <p className="mt-1 text-sm text-white/50">Creazione rapida su Supabase per merch e supporti fisici.</p>
          <Input name="name" label="Nome" required />
          <Input name="category" label="Categoria" defaultValue="Merch" />
          <Input name="price" label="Prezzo vendita" type="number" step="0.01" />
          <Input name="stock" label="Stock iniziale" type="number" defaultValue="0" />
          <ActionButton icon={Plus} text="Aggiungi" />
          <p className="mt-4 text-xs text-white/35">Operatore: {user.email}</p>
        </form>
      </div>
    </>
  );
}

function CalendarModule({ events, user, reload }: { events: CalendarEvent[]; user: AppUser; reload: () => Promise<void> }) {
  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = `${form.get("date")}T${form.get("time") || "20:00"}:00+02:00`;
    await getSupabase().from("eventi_calendario").insert({
      creato_da: user.id,
      titolo: form.get("title"),
      tipo_evento: form.get("type"),
      data_evento: date,
      luogo: form.get("place"),
      note: form.get("note"),
      membri_coinvolti: [],
      colore: form.get("color") || "#ff6b35",
    });
    event.currentTarget.reset();
    await reload();
  }

  async function deleteEvent(id: string | number) {
    await getSupabase().from("eventi_calendario").delete().eq("id", id);
    await reload();
  }

  return (
    <>
      <ModuleHeader title="Calendario" text="Vista eventi condivisa per live, release, interviste e sessioni studio." icon={CalendarDays} />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="glass rounded-md p-5">
          <div className="grid gap-3 md:grid-cols-2">
            {events.map((event) => (
              <article key={event.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-4 h-1 rounded-full" style={{ background: event.colore ?? "#ff6b35" }} />
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">{event.tipo_evento}</p>
                <h3 className="mt-2 text-xl font-black text-white">{event.titolo}</h3>
                <p className="mt-2 font-mono text-sm text-orange-200">{formatDate(event.data_evento)}</p>
                <p className="mt-1 text-sm text-white/55">{event.luogo || "Location non definita"}</p>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-400/25 text-red-200 hover:bg-red-500/10"
                    title="Elimina evento"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <form onSubmit={createEvent} className="glass rounded-md p-5">
          <p className="text-lg font-black text-white">Nuovo evento</p>
          <Input name="title" label="Titolo" required />
          <Select name="type" label="Tipo" options={["Live", "Intervista", "Sessione Studio", "Release"]} />
          <Input name="date" label="Data" type="date" required />
          <Input name="time" label="Ora" type="time" defaultValue="20:00" />
          <Input name="place" label="Luogo" />
          <Input name="color" label="Colore" type="color" defaultValue="#ff6b35" />
          <Textarea name="note" label="Note" />
          <ActionButton icon={Plus} text="Registra data" />
        </form>
      </div>
    </>
  );
}

function Projects({ albums, tracks, user, reload }: { albums: Album[]; tracks: Track[]; user: AppUser; reload: () => Promise<void> }) {
  const [uploadingTrack, setUploadingTrack] = useState(false);

  async function createAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await getSupabase().from("album_progetti").insert({
      creato_da: user.id,
      nome_album: form.get("album"),
    });
    event.currentTarget.reset();
    await reload();
  }

  async function addTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadingTrack(true);
    try {
      const form = new FormData(event.currentTarget);
      const fileInput = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
      const file = fileInput?.files?.[0];

      const supabase = getSupabase();
      let audio_file_url: string | null = null;

      if (file) {
        const filePath = `${Date.now()}-${file.name}`;
        const { error: storageError } = await supabase.storage.from("audio").upload(filePath, file);
        if (!storageError) {
          const { data: urlData } = supabase.storage.from("audio").getPublicUrl(filePath);
          audio_file_url = urlData.publicUrl;
        }
      }

      await supabase.from("tracce_audio").insert({
        caricato_da: user.id,
        album_id: form.get("album_id") || null,
        nome_traccia: form.get("nome_traccia"),
        fase: form.get("fase"),
        audio_file_url,
      });
      event.currentTarget.reset();
      await reload();
    } finally {
      setUploadingTrack(false);
    }
  }

  return (
    <>
      <ModuleHeader title="Studio Hub" text="Album, tracce, fasi di produzione e player per gli asset audio caricati su Supabase Storage." icon={Disc3} />
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-5">
          <form onSubmit={createAlbum} className="glass rounded-md p-5">
            <p className="text-lg font-black text-white">Album workspace</p>
            <Input name="album" label="Nome album" required />
            <ActionButton icon={Plus} text="Crea album" />
            <div className="mt-6 space-y-3">
              {albums.map((album) => (
                <div key={album.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                  <p className="font-bold text-white">{album.nome_album}</p>
                </div>
              ))}
            </div>
          </form>

          <form onSubmit={addTrack} className="glass rounded-md p-5">
            <p className="text-lg font-black text-white">Aggiungi traccia</p>
            <Input name="nome_traccia" label="Nome traccia" required />
            <Select name="fase" label="Fase" options={["Demo", "Mix", "Master"]} />
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Album</span>
              <select name="album_id" className="field mt-2 rounded-md px-3 py-2.5 text-sm">
                <option value="" className="bg-neutral-950">Nessun album</option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id} className="bg-neutral-950">{album.nome_album}</option>
                ))}
              </select>
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">File audio</span>
              <input type="file" accept="audio/*" className="field mt-2 rounded-md px-3 py-2.5 text-sm" />
            </label>
            <button disabled={uploadingTrack} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300 disabled:opacity-60">
              {uploadingTrack ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
              Aggiungi traccia
            </button>
          </form>
        </div>

        <div className="glass rounded-md p-5">
          <div className="grid gap-4 md:grid-cols-2">
            {tracks.map((track) => (
              <article key={track.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-200">{track.fase || "Demo"}</p>
                    <h3 className="mt-2 text-xl font-black text-white">{track.nome_traccia}</h3>
                    <p className="mt-1 text-sm text-white/45">{track.album_progetti?.nome_album || "Album non assegnato"}</p>
                  </div>
                  <FileAudio className="text-white/25" />
                </div>
                {track.audio_file_url ? <audio className="mt-4 w-full" controls src={track.audio_file_url} /> : <div className="mt-4 h-10 rounded-md border border-dashed border-white/12 text-center text-xs leading-10 text-white/35">Audio non caricato</div>}
              </article>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function PressKit({ state }: { state: AppState }) {
  const [prompt, setPrompt] = useState("Genera un press kit sintetico per la prossima release, includendo bio, pitch editoriale, punti forza e caption social.");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const context = useMemo(
    () => ({
      profiles: state.profiles,
      tracks: state.tracks.slice(0, 8),
      events: state.events.slice(0, 6),
      inventory: state.products.slice(0, 6),
    }),
    [state],
  );

  async function generate() {
    setLoading(true);
    setAnswer("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Errore AI.");
      }
      setAnswer(data.text);
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Errore durante la generazione.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ModuleHeader title="AI Press Kit" text="Generazione reale via Groq, compatibile con il formato OpenAI Chat Completions e isolata lato server." icon={Bot} />
      <div className="grid gap-5 lg:grid-cols-[430px_1fr]">
        <div className="glass rounded-md p-5">
          <Textarea label="Prompt operativo" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={9} />
          <button onClick={generate} disabled={loading} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300 disabled:opacity-60">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            Genera con Groq
          </button>
          <div className="mt-5 rounded-md border border-white/10 bg-black/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Contesto inviato</p>
            <p className="mt-2 text-sm text-white/58">{state.profiles.length} profili, {state.tracks.length} tracce, {state.events.length} eventi.</p>
          </div>
        </div>

        <div className="glass min-h-[520px] rounded-md p-5">
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
            <p className="font-black text-white">Output AI</p>
            <Sparkles size={18} className="text-orange-300" />
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-white/75">{answer || "L'output generato apparira qui."}</pre>
        </div>
      </div>
    </>
  );
}

function Profiles({ profiles, user, reload }: { profiles: ArtistProfile[]; user: AppUser; reload: () => Promise<void> }) {
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await getSupabase().from("profili_artisti").upsert({
      user_id: user.id,
      nome_arte: form.get("nome_arte"),
      strumentazione: form.get("strumentazione"),
      bio_breve: form.get("bio_breve"),
      email_contatto: form.get("email_contatto"),
      link_instagram: form.get("link_instagram"),
      link_spotify: form.get("link_spotify"),
    });
    await reload();
  }

  return (
    <>
      <ModuleHeader title="Profili" text="Anagrafiche artistiche usate da press kit, booking e materiali pubblici." icon={UserRound} />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form onSubmit={saveProfile} className="glass rounded-md p-5">
          <Input name="nome_arte" label="Nome arte" required />
          <Input name="strumentazione" label="Strumentazione" />
          <Input name="email_contatto" label="Email contatto" type="email" />
          <Input name="link_instagram" label="Instagram" />
          <Input name="link_spotify" label="Spotify" />
          <Textarea name="bio_breve" label="Bio breve" />
          <ActionButton icon={Download} text="Salva profilo" />
        </form>
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((profile) => (
            <article key={profile.user_id} className="glass rounded-md p-5">
              <p className="text-2xl font-black text-white">{profile.nome_arte || "Profilo senza nome"}</p>
              <p className="mt-2 text-sm text-orange-200">{profile.strumentazione || "Setup non indicato"}</p>
              <p className="mt-4 text-sm leading-6 text-white/60">{profile.bio_breve || "Bio non ancora compilata."}</p>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

function Vault({ files, user, reload }: { files: VaultFile[]; user: AppUser; reload: () => Promise<void> }) {
  const [uploading, setUploading] = useState(false);

  async function deleteFile(file: VaultFile) {
    await getSupabase().from("vault_documenti").delete().eq("id", file.id);
    await reload();
  }

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    try {
      const form = new FormData(event.currentTarget);
      const fileInput = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
      const file = fileInput?.files?.[0];
      if (!file) return;

      const supabase = getSupabase();
      const filePath = `${Date.now()}-${file.name}`;
      const { error: storageError } = await supabase.storage.from("vault").upload(filePath, file);
      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage.from("vault").getPublicUrl(filePath);
      await supabase.from("vault_documenti").insert({
        nome_file: (form.get("nome_file") as string) || file.name,
        cartella: form.get("cartella"),
        file_url: urlData.publicUrl,
      });
      event.currentTarget.reset();
      await reload();
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <ModuleHeader title="Vault" text="Documenti, contratti e asset organizzati per cartelle." icon={Archive} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="glass rounded-md p-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => (
              <article key={file.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-200">{file.cartella}</p>
                <h3 className="mt-2 font-black text-white">{file.nome_file}</h3>
                <div className="mt-5 flex gap-2">
                  <a href={file.file_url} className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-white/8 px-3 py-2 text-xs font-bold text-white hover:bg-white/12">
                    <Download size={15} />
                    Apri
                  </a>
                  {user.role === "master" ? (
                    <button onClick={() => deleteFile(file)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-400/25 text-red-200 hover:bg-red-500/10">
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        <form onSubmit={uploadFile} className="glass rounded-md p-5">
          <p className="text-lg font-black text-white">Carica documento</p>
          <p className="mt-1 text-sm text-white/50">Upload su Supabase Storage bucket "vault".</p>
          <Input name="nome_file" label="Nome file (opzionale)" />
          <Select name="cartella" label="Cartella" options={["Press", "Live", "Amministrazione", "Altro"]} />
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">File</span>
            <input type="file" required className="field mt-2 rounded-md px-3 py-2.5 text-sm" />
          </label>
          <button disabled={uploading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300 disabled:opacity-60">
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            Carica
          </button>
        </form>
      </div>
    </>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, className, ...inputProps } = props;
  return (
    <label className="mt-4 block">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{label}</span>
      <input className={`field mt-2 rounded-md px-3 py-2.5 text-sm ${className ?? ""}`} {...inputProps} />
    </label>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const { label, className, ...textareaProps } = props;
  return (
    <label className="mt-4 block">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{label}</span>
      <textarea className={`field mt-2 min-h-28 rounded-md px-3 py-2.5 text-sm ${className ?? ""}`} {...textareaProps} />
    </label>
  );
}

function Select({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <label className="mt-4 block">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{label}</span>
      <select name={name} className="field mt-2 rounded-md px-3 py-2.5 text-sm">
        {options.map((option) => (
          <option key={option} value={option} className="bg-neutral-950">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({ icon: Icon, text }: { icon: typeof Plus; text: string }) {
  return (
    <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300">
      <Icon size={18} />
      {text}
    </button>
  );
}

function formatEuro(value: number | null) {
  if (value == null) {
    return "-";
  }
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}
