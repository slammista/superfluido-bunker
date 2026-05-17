"use client";

import {
  AlertTriangle,
  Archive,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Download,
  FileAudio,
  FolderOpen,
  Home,
  LayoutGrid,
  List,
  Loader2,
  LogOut,
  Package,
  Play,
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
  products: [],
  events: [],
  albums: [],
  tracks: [],
  profiles: [],
  vault: [],
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
        if (!mounted) return;
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
        setNotice(error instanceof Error ? error.message : "Supabase non configurato.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    boot();
    return () => { mounted = false; };
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
      products: (products.data ?? []) as Product[],
      events: (events.data ?? []) as CalendarEvent[],
      albums: (albums.data ?? []) as Album[],
      tracks: (tracks.data ?? []) as Track[],
      profiles: (profiles.data ?? []) as ArtistProfile[],
      vault: (vault.data ?? []) as VaultFile[],
    });
  }

  async function handleLogin(email: string, password: string) {
    setLoading(true);
    setNotice(null);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Login non riuscito.");
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

  const reload = () => loadWorkspace(user.id);

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
          <Inventory products={state.products} user={user} reload={reload} onError={setNotice} />
        </div>
        <div className={view === "calendar" ? "" : "hidden"}>
          <CalendarModule events={state.events} user={user} reload={reload} onError={setNotice} />
        </div>
        <div className={view === "projects" ? "" : "hidden"}>
          <Projects albums={state.albums} tracks={state.tracks} user={user} reload={reload} onError={setNotice} />
        </div>
        <div className={view === "press" ? "" : "hidden"}>
          <PressKit state={state} />
        </div>
        <div className={view === "profile" ? "" : "hidden"}>
          <Profiles profiles={state.profiles} user={user} reload={reload} onError={setNotice} />
        </div>
        <div className={view === "vault" ? "" : "hidden"}>
          <Vault files={state.vault} user={user} reload={reload} onError={setNotice} />
        </div>
      </section>
    </main>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

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
        <input className="field mt-2 rounded-md px-4 py-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="utente@superfluido.it" />
        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Password</label>
        <input className="field mt-2 rounded-md px-4 py-3" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />
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

// ─── Shared UI ────────────────────────────────────────────────────────────────

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
        active ? "bg-orange-500 text-black" : "text-white/62 hover:bg-white/8 hover:text-white"
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

function FormError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <p>{text}</p>
    </div>
  );
}

function ModuleHeader({
  title,
  text,
  icon: Icon,
  actions,
}: {
  title: string;
  text: string;
  icon: typeof Home;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-md border border-orange-400/30 bg-orange-500/14 text-orange-200">
          <Icon size={21} />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-white md:text-5xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/56">{text}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function Overview({ state, user, goTo }: { state: AppState; user: AppUser; goTo: (view: View) => void }) {
  const totalStock = state.products.reduce(
    (sum, p) => sum + (p.product_variants ?? []).reduce((s, v) => s + Number(v.stock_quantity ?? 0), 0),
    0,
  );
  const lowStock = state.products.filter((p) => (p.product_variants ?? []).some((v) => Number(v.stock_quantity) < 6));

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

// ─── Inventory ────────────────────────────────────────────────────────────────

function Inventory({
  products,
  user,
  reload,
  onError,
}: {
  products: Product[];
  user: AppUser;
  reload: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const filtered = products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase()));

  async function addDemoProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const data = new FormData(event.currentTarget);
    try {
      const supabase = getSupabase();
      const created = await supabase
        .from("products")
        .insert({
          name: String(data.get("name") ?? ""),
          category: String(data.get("category") ?? "Merch"),
          base_price_sell: Number(data.get("price") ?? 0),
          base_price_cost: 0,
        })
        .select()
        .single();
      if (created.error) throw created.error;
      await supabase.from("product_variants").insert({
        product_id: created.data.id,
        variant_name: "Default",
        stock_quantity: Number(data.get("stock") ?? 0),
      });
      event.currentTarget.reset();
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Errore nella creazione del prodotto.");
    }
  }

  return (
    <>
      <ModuleHeader title="Magazzino" text="Inventario merch, varianti e alert stock con lettura diretta dalle tabelle products e product_variants." icon={Warehouse} />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="glass rounded-md p-5">
          <div className="mb-5 flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3">
            <Search size={18} className="text-white/40" />
            <input className="w-full bg-transparent text-sm text-white outline-none" placeholder="Cerca prodotto, categoria o variante" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-white/35">Nessun prodotto in magazzino. Aggiungine uno con il form a destra.</p>
          ) : (
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
                    const stock = (product.product_variants ?? []).reduce((s, v) => s + Number(v.stock_quantity ?? 0), 0);
                    return (
                      <tr key={product.id} className="border-b border-white/7 text-white/78">
                        <td className="py-4 font-bold text-white">{product.name}</td>
                        <td className="py-4">{product.category ?? "Generale"}</td>
                        <td className="py-4">{(product.product_variants ?? []).map((v) => `${v.variant_name}: ${v.stock_quantity}`).join(" · ")}</td>
                        <td className="py-4 text-right font-mono">{formatEuro(product.base_price_sell)}</td>
                        <td className={`py-4 text-right font-mono font-black ${stock < 6 ? "text-red-300" : "text-emerald-300"}`}>{stock}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form onSubmit={addDemoProduct} className="glass rounded-md p-5">
          <p className="text-lg font-black text-white">Nuovo prodotto</p>
          <p className="mt-1 text-sm text-white/50">Creazione rapida su Supabase per merch e supporti fisici.</p>
          <Input name="name" label="Nome" required />
          <Input name="category" label="Categoria" defaultValue="Merch" />
          <Input name="price" label="Prezzo vendita" type="number" step="0.01" />
          <Input name="stock" label="Stock iniziale" type="number" defaultValue="0" />
          <FormError text={formError} />
          <ActionButton icon={Plus} text="Aggiungi" />
          <p className="mt-4 text-xs text-white/35">Operatore: {user.email}</p>
        </form>
      </div>
    </>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

type CalView = "grid" | "list" | "month";

function CalendarModule({
  events,
  user,
  reload,
  onError,
}: {
  events: CalendarEvent[];
  user: AppUser;
  reload: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [calView, setCalView] = useState<CalView>("grid");
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [formError, setFormError] = useState<string | null>(null);

  const MONTH_NAMES = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await getSupabase().from("eventi_calendario").insert({
        creato_da: user.id,
        titolo: form.get("title"),
        tipo_evento: form.get("type"),
        data_evento: `${form.get("date")}T${form.get("time") || "20:00"}:00+02:00`,
        luogo: form.get("place"),
        note: form.get("note"),
        membri_coinvolti: [],
        colore: form.get("color") || "#ff6b35",
      });
      if (error) throw error;
      event.currentTarget.reset();
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Errore nella creazione dell'evento.");
    }
  }

  async function deleteEvent(id: string | number) {
    try {
      const { error } = await getSupabase().from("eventi_calendario").delete().eq("id", id);
      if (error) throw error;
      await reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Errore nell'eliminazione dell'evento.");
    }
  }

  const sorted = [...events].sort((a, b) => new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime());

  const viewToggle = (
    <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] p-1">
      {([
        { id: "grid" as CalView, icon: LayoutGrid, label: "Griglia" },
        { id: "list" as CalView, icon: List, label: "Lista" },
        { id: "month" as CalView, icon: CalendarDays, label: "Mese" },
      ] as const).map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setCalView(id)}
          title={label}
          className={`inline-flex h-8 w-8 items-center justify-center rounded transition ${
            calView === id ? "bg-orange-500 text-black" : "text-white/50 hover:text-white"
          }`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );

  return (
    <>
      <ModuleHeader
        title="Calendario"
        text="Vista eventi condivisa per live, release, interviste e sessioni studio."
        icon={CalendarDays}
        actions={viewToggle}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="glass rounded-md p-5">
          {/* Month navigation (only in month view) */}
          {calView === "month" && (
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/60 hover:text-white"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="font-bold text-white">{MONTH_NAMES[calMonth]} {calYear}</p>
              <button
                onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/60 hover:text-white"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Grid view */}
          {calView === "grid" && (
            events.length === 0 ? (
              <p className="py-12 text-center text-sm text-white/35">Nessun evento. Aggiungi il primo con il form a destra.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {sorted.map((event) => (
                  <EventCard key={event.id} event={event} onDelete={() => deleteEvent(event.id)} />
                ))}
              </div>
            )
          )}

          {/* List view */}
          {calView === "list" && (
            events.length === 0 ? (
              <p className="py-12 text-center text-sm text-white/35">Nessun evento.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.14em] text-white/38">
                    <tr>
                      <th className="border-b border-white/10 pb-3">Data</th>
                      <th className="border-b border-white/10 pb-3">Tipo</th>
                      <th className="border-b border-white/10 pb-3">Titolo</th>
                      <th className="border-b border-white/10 pb-3">Luogo</th>
                      <th className="border-b border-white/10 pb-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((event) => (
                      <tr key={event.id} className="border-b border-white/7 text-white/75">
                        <td className="py-3 font-mono text-xs text-orange-200">{formatDate(event.data_evento)}</td>
                        <td className="py-3">{event.tipo_evento}</td>
                        <td className="py-3 font-bold text-white">{event.titolo}</td>
                        <td className="py-3">{event.luogo || "—"}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-400/25 text-red-300 hover:bg-red-500/10"
                            title="Elimina"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Month view */}
          {calView === "month" && (
            <MonthView events={events} month={calMonth} year={calYear} />
          )}
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
          <FormError text={formError} />
          <ActionButton icon={Plus} text="Registra data" />
        </form>
      </div>
    </>
  );
}

function EventCard({ event, onDelete }: { event: CalendarEvent; onDelete: () => void }) {
  return (
    <article className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-4 h-1 rounded-full" style={{ background: event.colore ?? "#ff6b35" }} />
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">{event.tipo_evento}</p>
      <h3 className="mt-2 text-xl font-black text-white">{event.titolo}</h3>
      <p className="mt-2 font-mono text-sm text-orange-200">{formatDate(event.data_evento)}</p>
      <p className="mt-1 text-sm text-white/55">{event.luogo || "Location non definita"}</p>
      <div className="mt-4 flex justify-end">
        <button
          onClick={onDelete}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-400/25 text-red-200 hover:bg-red-500/10"
          title="Elimina evento"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}

function MonthView({ events, month, year }: { events: CalendarEvent[]; month: number; year: number }) {
  const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const startOffset = (firstDayOfWeek + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (d: number) => today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;

  const eventsOnDay = (d: number) =>
    events.filter((e) => {
      const date = new Date(e.data_evento);
      return date.getMonth() === month && date.getFullYear() === year && date.getDate() === d;
    });

  return (
    <div>
      <div className="mb-1 grid grid-cols-7">
        {DAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-bold uppercase tracking-wider text-white/35">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div
            key={i}
            className={`min-h-[72px] rounded-md p-1.5 text-xs ${
              day ? "bg-white/[0.03] hover:bg-white/[0.06]" : ""
            } ${day && isToday(day) ? "ring-1 ring-orange-500/60" : ""}`}
          >
            {day && (
              <>
                <span className={`block text-right font-mono text-[11px] ${isToday(day) ? "font-bold text-orange-300" : "text-white/35"}`}>
                  {day}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {eventsOnDay(day).map((e) => (
                    <div
                      key={e.id}
                      className="truncate rounded px-1 py-0.5 text-[9px] font-bold text-black"
                      style={{ background: e.colore ?? "#ff6b35" }}
                      title={e.titolo}
                    >
                      {e.titolo}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Studio Hub ───────────────────────────────────────────────────────────────

type StudioView = "library" | "project";

const ALBUM_GRADIENTS = [
  "from-orange-600 to-red-900",
  "from-violet-600 to-purple-900",
  "from-sky-600 to-blue-900",
  "from-emerald-600 to-teal-900",
  "from-pink-600 to-rose-900",
  "from-amber-600 to-orange-900",
];

function albumGradient(name: string) {
  return ALBUM_GRADIENTS[(name.charCodeAt(0) ?? 0) % ALBUM_GRADIENTS.length];
}

function Projects({
  albums,
  tracks,
  user,
  reload,
  onError,
}: {
  albums: Album[];
  tracks: Track[];
  user: AppUser;
  reload: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [studioView, setStudioView] = useState<StudioView>("library");
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [uploadingTrack, setUploadingTrack] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const albumTracks = selectedAlbum
    ? tracks.filter(
        (t) =>
          String(t.album_id) === String(selectedAlbum.id) ||
          String(t.album_progetti?.id) === String(selectedAlbum.id),
      )
    : [];

  async function createAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await getSupabase().from("album_progetti").insert({
        creato_da: user.id,
        nome_album: form.get("album"),
      });
      if (error) throw error;
      event.currentTarget.reset();
      setShowNewAlbum(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Errore nella creazione dell'album.");
    }
  }

  async function deleteAlbum(album: Album) {
    try {
      const { error } = await getSupabase().from("album_progetti").delete().eq("id", album.id);
      if (error) throw error;
      await reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Errore nell'eliminazione dell'album.");
    }
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
        const filePath = `audio/${Date.now()}-${file.name}`;
        const { error: storageError } = await supabase.storage.from("superfluido_bucket").upload(filePath, file);
        if (storageError) throw storageError;
        const { data: urlData } = supabase.storage.from("superfluido_bucket").getPublicUrl(filePath);
        audio_file_url = urlData.publicUrl;
      }

      const { error } = await supabase.from("tracce_audio").insert({
        caricato_da: user.id,
        album_id: selectedAlbum?.id ?? null,
        nome_traccia: form.get("nome_traccia"),
        fase: form.get("fase"),
        audio_file_url,
      });
      if (error) throw error;
      event.currentTarget.reset();
      setShowAddTrack(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Errore nell'aggiunta della traccia.");
    } finally {
      setUploadingTrack(false);
    }
  }

  // ── Library view ──────────────────────────────────────────────────────────

  if (studioView === "library") {
    return (
      <>
        <ModuleHeader
          title="Studio Hub"
          text="Libreria album, tracce in produzione e upload audio direttamente su Supabase Storage."
          icon={Disc3}
          actions={
            <button
              onClick={() => setShowNewAlbum(!showNewAlbum)}
              className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2.5 text-xs font-black text-black transition hover:bg-orange-300"
            >
              <Plus size={15} />
              Nuovo album
            </button>
          }
        />

        {showNewAlbum && (
          <form onSubmit={createAlbum} className="glass mb-5 rounded-md p-5">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Input name="album" label="Nome album" required />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2.5 text-sm font-black text-black transition hover:bg-orange-300">
                  <Plus size={16} />
                  Crea
                </button>
                <button type="button" onClick={() => setShowNewAlbum(false)} className="rounded-md border border-white/15 px-4 py-2.5 text-sm text-white/60 hover:text-white">
                  Annulla
                </button>
              </div>
            </div>
            <FormError text={formError} />
          </form>
        )}

        <div className="glass rounded-md p-8">
          {albums.length === 0 ? (
            <div className="py-16 text-center">
              <Disc3 size={48} className="mx-auto mb-4 text-white/15" />
              <p className="text-lg font-bold text-white/40">Nessun album ancora</p>
              <p className="mt-2 text-sm text-white/28">Clicca &ldquo;Nuovo album&rdquo; per iniziare a organizzare le tue produzioni.</p>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-10 sm:justify-start sm:gap-12">
              {albums.map((album) => {
                const count = tracks.filter(
                  (t) => String(t.album_id) === String(album.id) || String(t.album_progetti?.id) === String(album.id),
                ).length;
                return (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    trackCount={count}
                    onClick={() => { setSelectedAlbum(album); setStudioView("project"); }}
                    onDelete={() => deleteAlbum(album)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Project detail view ───────────────────────────────────────────────────

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => { setStudioView("library"); setShowAddTrack(false); }}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white/60 hover:text-white"
        >
          <ChevronLeft size={16} />
          Libreria
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr] xl:grid-cols-[340px_1fr]">
        {/* Left: album info */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className={`aspect-square w-full max-w-[260px] rounded-2xl bg-gradient-to-br ${albumGradient(selectedAlbum?.nome_album ?? "")} mx-auto lg:mx-0`} />
          <h2 className="mt-6 text-3xl font-black tracking-tight text-white">{selectedAlbum?.nome_album}</h2>
          <p className="mt-1 text-sm text-white/50">SUPERFLUIDO</p>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-white/35">{albumTracks.length} tracce</p>
          <button
            onClick={() => setShowAddTrack(!showAddTrack)}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-white/70 transition hover:border-orange-400/30 hover:text-orange-200"
          >
            <Plus size={16} />
            Aggiungi traccia
          </button>

          {showAddTrack && (
            <form onSubmit={addTrack} className="glass mt-4 rounded-md p-4">
              <Input name="nome_traccia" label="Nome traccia" required />
              <Select name="fase" label="Fase" options={["Demo", "Mix", "Master"]} />
              <label className="mt-4 block">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">File audio</span>
                <input type="file" accept="audio/*" className="field mt-2 rounded-md px-3 py-2.5 text-sm" />
              </label>
              <FormError text={formError} />
              <button
                type="submit"
                disabled={uploadingTrack}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300 disabled:opacity-60"
              >
                {uploadingTrack ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                Carica
              </button>
            </form>
          )}
        </div>

        {/* Right: tracklist */}
        <div className="glass rounded-md overflow-hidden">
          {albumTracks.length === 0 ? (
            <div className="py-16 text-center">
              <FileAudio size={36} className="mx-auto mb-4 text-white/15" />
              <p className="text-sm text-white/35">Nessuna traccia in questo album.</p>
              <p className="mt-1 text-xs text-white/25">Usa il pulsante &ldquo;Aggiungi traccia&rdquo; per caricare il primo file.</p>
            </div>
          ) : (
            <ul>
              {albumTracks.map((track, index) => (
                <li
                  key={track.id}
                  className="border-b border-white/8 px-5 py-4 last:border-0 hover:bg-white/[0.025]"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-7 shrink-0 text-right font-mono text-sm text-white/25">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-white">{track.nome_traccia}</p>
                      {track.audio_file_url ? (
                        <audio className="mt-2 h-8 w-full" controls src={track.audio_file_url} />
                      ) : (
                        <p className="mt-0.5 text-xs text-white/30">Audio non caricato</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded border border-orange-400/25 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-orange-200">
                      {track.fase || "Demo"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function AlbumCard({
  album,
  trackCount,
  onClick,
  onDelete,
}: {
  album: Album;
  trackCount: number;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative text-left" style={{ maxWidth: 168 }}>
      <button onClick={onClick} className="block w-full text-left">
        <div className="relative">
          <div className={`h-36 w-36 rounded-2xl bg-gradient-to-br ${albumGradient(album.nome_album)} transition duration-200 group-hover:brightness-75`} />
          <div className="absolute -bottom-3 -right-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 opacity-0 shadow-lg transition duration-200 group-hover:opacity-100">
            <Play size={16} fill="black" className="ml-0.5 text-black" />
          </div>
        </div>
        <p className="mt-5 truncate text-sm font-bold text-white">{album.nome_album}</p>
        <p className="mt-0.5 text-xs text-white/45">{trackCount} {trackCount === 1 ? "traccia" : "tracce"}</p>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute -right-2 -top-2 hidden h-7 w-7 items-center justify-center rounded-full border border-red-400/30 bg-neutral-950 text-red-300 shadow hover:bg-red-500/15 group-hover:flex"
        title="Elimina album"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ─── AI Press Kit ─────────────────────────────────────────────────────────────

const MEMBERS = ["Eric Draven", "Martire", "gg.Proiettili", "NONe", "Slam aka Hysteriack", "Leony47", "Giord"];

const OUTPUT_TYPES = ["Press Kit completo", "Tech Rider", "Bio breve", "Caption social"] as const;
type OutputType = (typeof OUTPUT_TYPES)[number];

const DEFAULT_PROMPTS: Record<OutputType, string> = {
  "Press Kit completo": "Genera un press kit completo per il collettivo, includendo bio artistica, pitch editoriale, punti di forza e contatti booking.",
  "Tech Rider": "Genera un tech rider completo per il live, con stage plot testuale, lista equipment PA e monitor, hospitality e note tecniche per il service audio.",
  "Bio breve": "Scrivi una bio breve (max 150 parole) per uso booking e social, focalizzata sui membri presenti all'evento.",
  "Caption social": "Scrivi una caption per Instagram (max 280 caratteri) per promuovere l'evento o la release, con hashtag rilevanti e call to action.",
};

function PressKit({ state }: { state: AppState }) {
  const [outputType, setOutputType] = useState<OutputType>("Press Kit completo");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPTS["Press Kit completo"]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([...MEMBERS]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleMember(name: string) {
    setSelectedMembers((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name],
    );
  }

  function handleOutputTypeChange(type: OutputType) {
    setOutputType(type);
    setPrompt(DEFAULT_PROMPTS[type]);
  }

  const context = useMemo(
    () => ({
      tipoOutput: outputType,
      membriPresenti: selectedMembers,
      profiles: state.profiles,
      tracks: state.tracks.slice(0, 8),
      events: state.events.slice(0, 6),
      inventory: state.products.slice(0, 6),
    }),
    [state, outputType, selectedMembers],
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
      if (!response.ok) throw new Error(data.error || "Errore AI.");
      setAnswer(data.text);
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Errore durante la generazione.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ModuleHeader title="AI Press Kit" text="Generazione documenti via Groq con bio reale del collettivo e selezione membri per evento." icon={Bot} />
      <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
        <div className="space-y-4">
          {/* Output type */}
          <div className="glass rounded-md p-5">
            <p className="mb-3 text-sm font-black text-white">Tipo documento</p>
            <div className="grid grid-cols-2 gap-2">
              {OUTPUT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => handleOutputTypeChange(type)}
                  className={`rounded-md border px-3 py-2 text-xs font-bold text-left transition ${
                    outputType === type
                      ? "border-orange-400/60 bg-orange-500/15 text-orange-200"
                      : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Members selector */}
          <div className="glass rounded-md p-5">
            <p className="mb-3 text-sm font-black text-white">Membri presenti</p>
            <div className="space-y-2">
              {MEMBERS.map((member) => (
                <label key={member} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(member)}
                    onChange={() => toggleMember(member)}
                    className="h-4 w-4 accent-orange-500"
                  />
                  <span className="text-sm text-white/75">{member}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/35">{selectedMembers.length} di {MEMBERS.length} selezionati</p>
          </div>

          {/* Prompt */}
          <div className="glass rounded-md p-5">
            <Textarea label="Prompt operativo" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} />
            <button
              onClick={generate}
              disabled={loading}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300 disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Genera con Groq
            </button>
          </div>
        </div>

        <div className="glass min-h-[520px] rounded-md p-5">
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
            <p className="font-black text-white">Output AI</p>
            <Sparkles size={18} className="text-orange-300" />
          </div>
          {answer ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-white/75">{answer}</pre>
          ) : (
            <p className="text-sm text-white/25">{loading ? "Generazione in corso…" : "L'output apparirà qui."}</p>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

function Profiles({
  profiles,
  user,
  reload,
  onError,
}: {
  profiles: ArtistProfile[];
  user: AppUser;
  reload: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await getSupabase().from("profili_artisti").upsert({
        user_id: user.id,
        nome_arte: form.get("nome_arte"),
        strumentazione: form.get("strumentazione"),
        bio_breve: form.get("bio_breve"),
        email_contatto: form.get("email_contatto"),
        link_instagram: form.get("link_instagram"),
        link_spotify: form.get("link_spotify"),
      });
      if (error) throw error;
      await reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Errore nel salvataggio del profilo.");
    }
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
          {profiles.length === 0 ? (
            <div className="col-span-2 py-12 text-center text-sm text-white/35">
              Nessun profilo. Compila il form per aggiungere la tua scheda artista.
            </div>
          ) : (
            profiles.map((profile) => (
              <article key={profile.user_id} className="glass rounded-md p-5">
                <p className="text-2xl font-black text-white">{profile.nome_arte || "Profilo senza nome"}</p>
                <p className="mt-2 text-sm text-orange-200">{profile.strumentazione || "Setup non indicato"}</p>
                <p className="mt-4 text-sm leading-6 text-white/60">{profile.bio_breve || "Bio non ancora compilata."}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─── Vault ────────────────────────────────────────────────────────────────────

const VAULT_FOLDERS = ["Tutti", "Press", "Live", "Amministrazione", "Altro"] as const;
type VaultFolder = (typeof VAULT_FOLDERS)[number];

function Vault({
  files,
  user,
  reload,
  onError,
}: {
  files: VaultFile[];
  user: AppUser;
  reload: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [activeFolder, setActiveFolder] = useState<VaultFolder>("Tutti");
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = activeFolder === "Tutti" ? files : files.filter((f) => f.cartella === activeFolder);
  const folderCount = (folder: VaultFolder) =>
    folder === "Tutti" ? files.length : files.filter((f) => f.cartella === folder).length;

  async function deleteFile(file: VaultFile) {
    try {
      const { error } = await getSupabase().from("vault_documenti").delete().eq("id", file.id);
      if (error) throw error;
      await reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Errore nell'eliminazione del file.");
    }
  }

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setUploading(true);
    try {
      const form = new FormData(event.currentTarget);
      const fileInput = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
      const file = fileInput?.files?.[0];
      if (!file) return;

      const supabase = getSupabase();
      const filePath = `vault/${Date.now()}-${file.name}`;
      const { error: storageError } = await supabase.storage.from("superfluido_bucket").upload(filePath, file);
      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage.from("superfluido_bucket").getPublicUrl(filePath);
      const { error } = await supabase.from("vault_documenti").insert({
        nome_file: (form.get("nome_file") as string) || file.name,
        cartella: form.get("cartella") || activeFolder === "Tutti" ? "Altro" : activeFolder,
        file_url: urlData.publicUrl,
      });
      if (error) throw error;
      event.currentTarget.reset();
      setShowUpload(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Errore nel caricamento del file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <ModuleHeader
        title="Vault"
        text="Documenti, contratti, rider e asset organizzati per cartella."
        icon={Archive}
        actions={
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2.5 text-xs font-black text-black transition hover:bg-orange-300"
          >
            <UploadCloud size={15} />
            Carica file
          </button>
        }
      />

      {/* Upload form */}
      {showUpload && (
        <form onSubmit={uploadFile} className="glass mb-5 rounded-md p-5">
          <p className="mb-4 font-black text-white">Carica nuovo documento</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input name="nome_file" label="Nome file (opzionale)" />
            <Select name="cartella" label="Cartella" options={["Press", "Live", "Amministrazione", "Altro"]} />
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">File</span>
              <input type="file" required className="field mt-2 rounded-md px-3 py-2.5 text-sm" />
            </label>
          </div>
          <FormError text={formError} />
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-5 py-2.5 text-sm font-black text-black transition hover:bg-orange-300 disabled:opacity-60"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Carica
            </button>
            <button type="button" onClick={() => setShowUpload(false)} className="rounded-md border border-white/15 px-4 py-2.5 text-sm text-white/55 hover:text-white">
              Annulla
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
        {/* Left: folder nav */}
        <div className="glass h-fit rounded-md p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/30">Cartelle</p>
          {VAULT_FOLDERS.map((folder) => (
            <button
              key={folder}
              onClick={() => setActiveFolder(folder)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                activeFolder === folder
                  ? "bg-orange-500/15 font-bold text-orange-200"
                  : "text-white/50 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <span>{folder}</span>
              <span className="font-mono text-xs opacity-60">{folderCount(folder)}</span>
            </button>
          ))}
        </div>

        {/* Right: file table */}
        <div className="glass rounded-md overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Archive size={36} className="mx-auto mb-4 text-white/15" />
              <p className="text-sm text-white/35">
                {activeFolder === "Tutti" ? "Nessun file nel vault." : `Nessun file nella cartella "${activeFolder}".`}
              </p>
              <p className="mt-1 text-xs text-white/22">Usa &ldquo;Carica file&rdquo; in alto per aggiungere documenti.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-white/30">
                <tr>
                  <th className="border-b border-white/8 px-5 py-3">Nome file</th>
                  <th className="border-b border-white/8 px-5 py-3">Cartella</th>
                  <th className="border-b border-white/8 px-5 py-3">Data</th>
                  <th className="border-b border-white/8 px-5 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => (
                  <tr key={file.id} className="border-b border-white/[0.06] hover:bg-white/[0.025]">
                    <td className="px-5 py-3.5 font-bold text-white">{file.nome_file}</td>
                    <td className="px-5 py-3.5">
                      <span className="rounded border border-orange-400/20 px-2 py-0.5 text-xs font-mono text-orange-200">
                        {file.cartella || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-white/40">
                      {file.created_at ? new Date(file.created_at).toLocaleDateString("it-IT") : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10"
                        >
                          <Download size={13} />
                          Apri
                        </a>
                        <button
                          onClick={() => deleteFile(file)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-400/25 text-red-300 hover:bg-red-500/10"
                          title="Elimina"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

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

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatEuro(value: number | null) {
  if (value == null) return "-";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}
