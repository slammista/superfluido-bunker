"use client";

import {
  AlertTriangle,
  Archive,
  Bot,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Disc3,
  Download,
  FileAudio,
  FolderOpen,
  Home,
  Loader2,
  LogOut,
  MoreHorizontal,
  Music,
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
  X,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { sampleAlbums, sampleEvents, sampleProducts, sampleProfiles, sampleTracks, sampleVault } from "@/lib/sample-data";
import type { Album, ArtistProfile, CalendarEvent, KanbanTask, Product, Role, Track, VaultFile, VaultFolder } from "@/lib/types";

type View = "home" | "inventory" | "calendar" | "projects" | "press" | "profile" | "vault" | "kanban";

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
  folders: VaultFolder[];
  tasks: KanbanTask[];
};

// Notifica con tipo: error | success
type Toast = { text: string; kind: "error" | "success" };

const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: "home", label: "Overview", icon: Home },
  { id: "inventory", label: "Magazzino", icon: Package },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "projects", label: "Studio Hub", icon: Disc3 },
  { id: "press", label: "AI Press Kit", icon: Bot },
  { id: "profile", label: "Profili", icon: UserRound },
  { id: "vault", label: "Vault", icon: FolderOpen },
  { id: "kanban", label: "Task Board", icon: ClipboardList },
];

// Categorie prodotto allineate al CHECK constraint del DB
const PRODUCT_CATEGORIES = ["Vestiario", "Supporto Fisico", "Merch", "Vinile", "Print", "Accessori", "Tele", "Altro"] as const;

// Fasi traccia allineate al CHECK constraint del DB
const TRACK_PHASES = ["Beat", "Provini", "Demo", "Mix", "Master"] as const;

// FIX 1: emptyState usa array vuoti
const emptyState: AppState = {
  products: [],
  events: [],
  albums: [],
  tracks: [],
  profiles: [],
  vault: [],
  folders: [],
  tasks: [],
};

// FIX 1: sampleState con i sample data, usato solo nel catch del boot()
const sampleState: AppState = {
  products: sampleProducts,
  events: sampleEvents,
  albums: sampleAlbums,
  tracks: sampleTracks,
  profiles: sampleProfiles,
  vault: sampleVault,
  folders: [],
  tasks: [],
};

export function SuperfluidoApp() {
  const [view, setView] = useState<View>("home");
  const [user, setUser] = useState<AppUser | null>(null);
  const [state, setState] = useState<AppState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  function showToast(text: string, kind: "error" | "success" = "error") {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 4000);
  }

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
        // FIX 1: usa sampleState nel catch
        if (mounted) {
          setNotice(error instanceof Error ? error.message : "Supabase non configurato. Uso dati demo.");
          setState(sampleState);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    boot();

    // FIX 1: onAuthStateChange listener
    const supabase = getSupabase();
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (mounted) {
          setUser(null);
          setState(emptyState);
          setView("home");
        }
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // FIX 1 + FIX 2: fetchRole wrappato in try-catch
  async function fetchRole(userId: string): Promise<Role | undefined> {
    try {
      const supabase = getSupabase();
      const { data } = await supabase.from("user_roles").select("role").eq("id", userId).maybeSingle();
      return data?.role as Role | undefined;
    } catch {
      return undefined;
    }
  }

  // FIX 1: loadWorkspace senza fallback a sample data, senza filtro caricato_da sulle tracce
  async function loadWorkspace(userId: string) {
    const supabase = getSupabase();

    const [products, events, albums, tracks, profiles, vault, folders, tasks] = await Promise.all([
      supabase.from("products").select("*, product_variants(*)"),
      supabase.from("eventi_calendario").select("*").order("data_evento"),
      supabase.from("album_progetti").select("*").order("created_at", { ascending: false }),
      supabase.from("tracce_audio").select("*, album_progetti(id, nome_album)"),
      supabase.from("profili_artisti").select("*"),
      supabase.from("vault_documenti").select("*").order("created_at", { ascending: false }),
      supabase.from("vault_cartelle").select("*").order("created_at"),
      supabase.from("tasks_kanban").select("*").order("created_at"),
    ]);

    // Suppress unused variable warning
    void userId;

    setState({
      products: (products.data ?? []) as Product[],
      events: (events.data ?? []) as CalendarEvent[],
      albums: (albums.data ?? []) as Album[],
      tracks: (tracks.data ?? []) as Track[],
      profiles: (profiles.data ?? []) as ArtistProfile[],
      vault: (vault.data ?? []) as VaultFile[],
      folders: (folders.data ?? []) as VaultFolder[],
      tasks: (tasks.data ?? []) as KanbanTask[],
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

  // FIX 2: handleSignup
  async function handleSignup(email: string, password: string) {
    setLoading(true);
    setNotice(null);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Registrazione non riuscita.");

      // Inserisci in user_roles con ruolo membro
      await supabase.from("user_roles").insert({ id: data.user.id, role: "membro" });

      if (data.session) {
        // Auto-login se la sessione è disponibile
        const role = await fetchRole(data.user.id);
        const appUser = { id: data.user.id, email: data.user.email ?? email, role: role ?? "membro" };
        setUser(appUser);
        await loadWorkspace(appUser.id);
      } else {
        setNotice("Account creato! Controlla la tua email.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Errore durante la registrazione.");
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
    // FIX 2: passa onSignup a LoginScreen
    return <LoginScreen loading={loading} notice={notice} onLogin={handleLogin} onSignup={handleSignup} />;
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

      {/* Toast globale */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-md border px-4 py-3 text-sm font-semibold shadow-xl transition ${
            toast.kind === "success"
              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
              : "border-red-400/30 bg-red-500/15 text-red-100"
          }`}
        >
          {toast.kind === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.text}
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      <section className="mx-auto max-w-7xl px-4 py-6 lg:py-8">
        {notice ? <Notice text={notice} /> : null}

        <div className={view === "home" ? "" : "hidden"}>
          <Overview state={state} user={user} goTo={setView} />
        </div>
        <div className={view === "inventory" ? "" : "hidden"}>
          <Inventory products={state.products} user={user} reload={() => loadWorkspace(user.id)} onToast={showToast} />
        </div>
        <div className={view === "calendar" ? "" : "hidden"}>
          <CalendarModule events={state.events} user={user} reload={() => loadWorkspace(user.id)} onToast={showToast} />
        </div>
        <div className={view === "projects" ? "" : "hidden"}>
          <Projects albums={state.albums} tracks={state.tracks} user={user} reload={() => loadWorkspace(user.id)} onToast={showToast} />
        </div>
        <div className={view === "press" ? "" : "hidden"}>
          {/* FIX 5: passa user e onToast a PressKit */}
          <PressKit state={state} user={user} onToast={showToast} />
        </div>
        <div className={view === "profile" ? "" : "hidden"}>
          <Profiles profiles={state.profiles} user={user} reload={() => loadWorkspace(user.id)} onToast={showToast} />
        </div>
        <div className={view === "vault" ? "" : "hidden"}>
          <Vault files={state.vault} folders={state.folders} user={user} reload={() => loadWorkspace(user.id)} onToast={showToast} />
        </div>
        <div className={view === "kanban" ? "" : "hidden"}>
          <KanbanBoard tasks={state.tasks} user={user} reload={() => loadWorkspace(user.id)} onToast={showToast} />
        </div>
      </section>
    </main>
  );
}

// FIX 2: LoginScreen con toggle login/signup
function LoginScreen({
  loading,
  notice,
  onLogin,
  onSignup,
}: {
  loading: boolean;
  notice: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "login") {
      await onLogin(email, password);
    } else {
      await onSignup(email, password);
    }
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
        <h1 className="text-center text-2xl font-black tracking-tight text-white">
          {mode === "login" ? "Bunker Login" : "Crea Account"}
        </h1>
        <p className="mt-2 text-center text-sm text-white/55">
          {mode === "login"
            ? "Accesso operativo a magazzino, studio, calendario e AI press kit."
            : "Crea il tuo account per accedere al Bunker."}
        </p>

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
          {mode === "login" ? "Entra" : "Crea Account"}
        </button>

        <div className="mt-5 text-center">
          {mode === "login" ? (
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="text-sm text-white/50 transition hover:text-orange-300"
            >
              Non hai un account? <span className="font-bold text-orange-400">Registrati</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-sm text-white/50 transition hover:text-orange-300"
            >
              Hai già un account? <span className="font-bold text-orange-400">Accedi</span>
            </button>
          )}
        </div>
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

// FIX 4: ModuleHeader con prop opzionale actions
function ModuleHeader({ title, text, icon: Icon, actions }: { title: string; text: string; icon: typeof Home; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-md border border-orange-400/30 bg-orange-500/14 text-orange-200">
          <Icon size={21} />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-white md:text-5xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/56">{text}</p>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
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

function Inventory({ products, user, reload, onToast }: { products: Product[]; user: AppUser; reload: () => Promise<void>; onToast: (text: string, kind?: "error" | "success") => void }) {
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const filtered = products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase()));

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      const category = String(data.get("category") ?? "Altro");
      const stock = Number(data.get("stock") ?? 0);

      if (!name) {
        onToast("Inserisci un nome per il prodotto.");
        return;
      }

      const supabase = getSupabase();
      const { data: created, error } = await supabase
        .from("products")
        .insert({ name, category, base_price_sell: Number(data.get("price") ?? 0), base_price_cost: 0 })
        .select()
        .single();

      if (error) {
        onToast(`Errore prodotto: ${error.message}`);
        return;
      }

      const { error: variantError } = await supabase.from("product_variants").insert({
        product_id: created.id,
        variant_name: "Default",
        stock_quantity: stock,
      });

      if (variantError) {
        onToast(`Prodotto creato ma errore variante: ${variantError.message}`);
      } else {
        onToast("Prodotto aggiunto.", "success");
        (event.target as HTMLFormElement).reset();
      }
      await reload();
    } finally {
      setSaving(false);
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

        <form onSubmit={addProduct} className="glass rounded-md p-5">
          <p className="text-lg font-black text-white">Nuovo prodotto</p>
          <p className="mt-1 text-sm text-white/50">Creazione rapida su Supabase per merch e supporti fisici.</p>
          <Input name="name" label="Nome" required />
          <Select name="category" label="Categoria" options={PRODUCT_CATEGORIES} />
          <Input name="price" label="Prezzo vendita" type="number" step="0.01" />
          <Input name="stock" label="Stock iniziale" type="number" defaultValue="0" />
          <ActionButton icon={Plus} text="Aggiungi" loading={saving} />
          <p className="mt-4 text-xs text-white/35">Operatore: {user.email}</p>
        </form>
      </div>
    </>
  );
}

// FIX 3: CalendarModule con vista mensile
function CalendarModule({ events, user, reload, onToast }: { events: CalendarEvent[]; user: AppUser; reload: () => Promise<void>; onToast: (text: string, kind?: "error" | "success") => void }) {
  const [saving, setSaving] = useState(false);
  const [calView, setCalView] = useState<"list" | "month">("list");
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const [popoverEvent, setPopoverEvent] = useState<CalendarEvent | null>(null);

  const MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  const GIORNI_HEADER = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  function prevMonth() {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  }

  // Griglia 6x7, partendo da Lunedì
  const monthCells = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    // getDay() 0=Dom, ma vogliamo partire da Lun (1)
    let startDow = firstDay.getDay(); // 0=Dom
    // Converti: Dom=0 -> 6, Lun=1->0, ..., Sab=6->5
    startDow = startDow === 0 ? 6 : startDow - 1;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: { day: number; inMonth: boolean }[] = [];

    // Giorni del mese precedente
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      cells.push({ day: prevMonthDays - i, inMonth: false });
    }
    // Giorni del mese corrente
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, inMonth: true });
    }
    // Giorni del mese successivo per completare a 42
    let nextDay = 1;
    while (cells.length < 42) {
      cells.push({ day: nextDay++, inMonth: false });
    }
    return cells;
  }, [calYear, calMonth]);

  function getEventsForDay(day: number): CalendarEvent[] {
    return events.filter((ev) => {
      const d = new Date(ev.data_evento);
      return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day;
    });
  }

  function isToday(day: number): boolean {
    const today = new Date();
    return today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const title = String(form.get("title") ?? "").trim();
      const date = form.get("date");
      const time = form.get("time") || "20:00";

      if (!title || !date) {
        onToast("Titolo e data sono obbligatori.");
        return;
      }

      const data_evento = `${date}T${time}:00+02:00`;

      const { error } = await getSupabase().from("eventi_calendario").insert({
        creato_da: user.id,
        titolo: title,
        tipo_evento: form.get("type"),
        data_evento,
        luogo: form.get("place") || null,
        note: form.get("note") || null,
        membri_coinvolti: [],
        colore: form.get("color") || "#ff6b35",
      });

      if (error) {
        onToast(`Errore evento: ${error.message}`);
        return;
      }

      onToast("Evento registrato.", "success");
      (event.target as HTMLFormElement).reset();
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string | number) {
    const { error } = await getSupabase().from("eventi_calendario").delete().eq("id", id);
    if (error) {
      onToast(`Errore eliminazione: ${error.message}`);
      return;
    }
    onToast("Evento eliminato.", "success");
    setPopoverEvent(null);
    await reload();
  }

  return (
    <>
      <ModuleHeader title="Calendario" text="Vista eventi condivisa per live, release, interviste e sessioni studio." icon={CalendarDays} />

      {/* Toggle Lista / Mensile */}
      <div className="mb-5 flex items-center gap-2">
        <button
          onClick={() => setCalView("list")}
          className={`rounded-md px-4 py-2 text-sm font-bold transition ${calView === "list" ? "bg-orange-500 text-black" : "border border-white/10 bg-white/[0.04] text-white/60 hover:text-white"}`}
        >
          Lista
        </button>
        <button
          onClick={() => setCalView("month")}
          className={`rounded-md px-4 py-2 text-sm font-bold transition ${calView === "month" ? "bg-orange-500 text-black" : "border border-white/10 bg-white/[0.04] text-white/60 hover:text-white"}`}
        >
          Mensile
        </button>
      </div>

      {calView === "month" ? (
        <div className="glass mb-5 rounded-md p-5">
          {/* Navigazione mese */}
          <div className="mb-4 flex items-center justify-between">
            <button onClick={prevMonth} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white/60 hover:text-white">
              <ChevronLeft size={18} />
            </button>
            <p className="font-black text-white">{MESI[calMonth]} {calYear}</p>
            <button onClick={nextMonth} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white/60 hover:text-white">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Header giorni */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {GIORNI_HEADER.map((g) => (
              <div key={g} className="py-1 text-center text-[11px] font-bold uppercase tracking-widest text-white/30">{g}</div>
            ))}
          </div>

          {/* Griglia giorni */}
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((cell, idx) => {
              const dayEvents = cell.inMonth ? getEventsForDay(cell.day) : [];
              const todayCell = cell.inMonth && isToday(cell.day);
              return (
                <div
                  key={idx}
                  className={`min-h-[80px] rounded-md border p-1 ${cell.inMonth ? "border-white/10 bg-white/[0.025]" : "border-white/5 bg-transparent opacity-40"}`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      todayCell ? "bg-orange-500 text-black" : "text-white/55"
                    }`}
                  >
                    {cell.day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setPopoverEvent(ev)}
                        className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-semibold text-white/80 hover:bg-white/10"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ev.colore ?? "#ff6b35" }} />
                        <span className="truncate">{ev.titolo}</span>
                      </button>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="px-1 text-[10px] text-white/35">+{dayEvents.length - 2} altri</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Popover evento */}
      {popoverEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPopoverEvent(null)}>
          <div className="glass w-full max-w-sm rounded-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 h-1 rounded-full" style={{ background: popoverEvent.colore ?? "#ff6b35" }} />
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-white/42">{popoverEvent.tipo_evento}</p>
            <h3 className="mt-2 text-xl font-black text-white">{popoverEvent.titolo}</h3>
            <p className="mt-2 font-mono text-sm text-orange-200">{formatDate(popoverEvent.data_evento)}</p>
            {popoverEvent.luogo && <p className="mt-1 text-sm text-white/55">{popoverEvent.luogo}</p>}
            {popoverEvent.note && <p className="mt-3 text-sm leading-6 text-white/60">{popoverEvent.note}</p>}
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={() => deleteEvent(popoverEvent.id)}
                className="inline-flex items-center gap-2 rounded-md border border-red-400/25 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10"
              >
                <Trash2 size={14} />
                Elimina
              </button>
              <button
                onClick={() => setPopoverEvent(null)}
                className="ml-auto inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-white/60 hover:text-white"
              >
                <X size={14} />
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="glass rounded-md p-5">
          {events.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/40">Nessun evento in calendario.</p>
          ) : (
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
          <ActionButton icon={Plus} text="Registra data" loading={saving} />
        </form>
      </div>
    </>
  );
}

// FIX 4: Helper albumGradient - palette deterministica sull'id
function albumGradient(id: string | number): string {
  const palettes = [
    "from-purple-900 to-orange-800",
    "from-blue-900 to-indigo-700",
    "from-emerald-900 to-teal-700",
    "from-rose-900 to-pink-700",
    "from-amber-900 to-yellow-700",
    "from-cyan-900 to-sky-700",
    "from-fuchsia-900 to-purple-700",
    "from-red-900 to-orange-700",
  ];
  const str = String(id);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return palettes[Math.abs(hash) % palettes.length];
}

// FIX 4: Projects completamente riscritto con griglia album
function Projects({ albums, tracks, user, reload, onToast }: { albums: Album[]; tracks: Track[]; user: AppUser; reload: () => Promise<void>; onToast: (text: string, kind?: "error" | "success") => void }) {
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [showTrackForm, setShowTrackForm] = useState(false);
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [uploadingTrack, setUploadingTrack] = useState(false);

  async function createAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAlbum(true);
    try {
      const form = new FormData(event.currentTarget);
      const nome_album = String(form.get("album") ?? "").trim();

      if (!nome_album) {
        onToast("Inserisci un nome per l'album.");
        return;
      }

      const { error } = await getSupabase().from("album_progetti").insert({
        creato_da: user.id,
        nome_album,
      });

      if (error) {
        onToast(`Errore album: ${error.message}`);
        return;
      }

      onToast("Album creato.", "success");
      (event.target as HTMLFormElement).reset();
      setShowAlbumForm(false);
      await reload();
    } finally {
      setSavingAlbum(false);
    }
  }

  async function deleteAlbum(album: Album) {
    const albumTracks = tracks.filter((t) => t.album_id === album.id);
    const confirmed = window.confirm(
      `Eliminare l'album "${album.nome_album}"? Contiene ${albumTracks.length} tracce. Le tracce verranno de-associate.`
    );
    if (!confirmed) return;

    const { error } = await getSupabase().from("album_progetti").delete().eq("id", album.id);
    if (error) {
      onToast(`Errore eliminazione album: ${error.message}`);
      return;
    }
    onToast("Album eliminato.", "success");
    setSelectedAlbum(null);
    await reload();
  }

  async function addTrack(event: FormEvent<HTMLFormElement>, albumId: string | number | null) {
    event.preventDefault();
    setUploadingTrack(true);
    try {
      const form = new FormData(event.currentTarget);
      const nome_traccia = String(form.get("nome_traccia") ?? "").trim();

      if (!nome_traccia) {
        onToast("Inserisci un nome per la traccia.");
        return;
      }

      const fileInput = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
      const file = fileInput?.files?.[0];
      const supabase = getSupabase();
      let audio_file_url: string | null = null;

      if (file) {
        const filePath = `${Date.now()}-${file.name}`;
        const { error: storageError } = await supabase.storage.from("audio").upload(filePath, file);
        if (storageError) {
          onToast(`Errore upload audio: ${storageError.message}`);
          return;
        }
        const { data: urlData } = supabase.storage.from("audio").getPublicUrl(filePath);
        audio_file_url = urlData.publicUrl;
      }

      const { error } = await supabase.from("tracce_audio").insert({
        caricato_da: user.id,
        album_id: albumId,
        nome_traccia,
        fase: form.get("fase"),
        audio_file_url,
      });

      if (error) {
        onToast(`Errore traccia: ${error.message}`);
        return;
      }

      onToast("Traccia aggiunta.", "success");
      (event.target as HTMLFormElement).reset();
      setShowTrackForm(false);
      await reload();
    } finally {
      setUploadingTrack(false);
    }
  }

  async function deleteTrack(track: Track) {
    const confirmed = window.confirm(`Eliminare la traccia "${track.nome_traccia}"?`);
    if (!confirmed) return;

    const supabase = getSupabase();

    // Tenta di eliminare da storage se l'URL è disponibile
    if (track.audio_file_url) {
      try {
        const url = new URL(track.audio_file_url);
        const pathParts = url.pathname.split("/audio/");
        if (pathParts.length > 1) {
          await supabase.storage.from("audio").remove([pathParts[1]]);
        }
      } catch {
        // Ignora errori di parsing URL
      }
    }

    const { error } = await supabase.from("tracce_audio").delete().eq("id", track.id);
    if (error) {
      onToast(`Errore eliminazione traccia: ${error.message}`);
      return;
    }
    onToast("Traccia eliminata.", "success");
    await reload();
  }

  async function updateTrackPhase(trackId: string | number, fase: string) {
    const { error } = await getSupabase().from("tracce_audio").update({ fase }).eq("id", trackId);
    if (error) {
      onToast(`Errore aggiornamento fase: ${error.message}`);
    } else {
      await reload();
    }
  }

  const unassignedTracks = tracks.filter((t) => !t.album_id);
  const albumTracks = selectedAlbum ? tracks.filter((t) => t.album_id === selectedAlbum.id) : [];

  // Vista dettaglio album
  if (selectedAlbum !== null) {
    return (
      <>
        <ModuleHeader
          title="Studio Hub"
          text="Album, tracce, fasi di produzione e player per gli asset audio caricati su Supabase Storage."
          icon={Disc3}
          actions={
            <button
              onClick={() => setSelectedAlbum(null)}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white/70 transition hover:text-white"
            >
              <ChevronLeft size={15} />
              Torna agli album
            </button>
          }
        />

        {/* Header album */}
        <div className="glass mb-5 flex flex-col gap-5 rounded-md p-5 sm:flex-row sm:items-center">
          <div className={`h-24 w-24 shrink-0 overflow-hidden rounded-md bg-gradient-to-br ${albumGradient(selectedAlbum.id)} flex items-center justify-center`}>
            {selectedAlbum.cover_image_url ? (
              <Image src={selectedAlbum.cover_image_url} alt={selectedAlbum.nome_album} width={96} height={96} className="h-full w-full object-cover" />
            ) : (
              <Music size={32} className="text-white/40" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-black text-white">{selectedAlbum.nome_album}</h3>
            <p className="mt-1 text-sm text-white/50">{albumTracks.length} tracce</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTrackForm(!showTrackForm)}
              className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-sm font-black text-black transition hover:bg-orange-300"
            >
              <Plus size={15} />
              Aggiungi traccia
            </button>
            <button
              onClick={() => deleteAlbum(selectedAlbum)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-400/25 text-red-200 hover:bg-red-500/10"
              title="Elimina album"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Form aggiungi traccia */}
        {showTrackForm && (
          <form onSubmit={(e) => addTrack(e, selectedAlbum.id)} className="glass mb-5 rounded-md p-5">
            <p className="mb-4 font-black text-white">Nuova traccia in "{selectedAlbum.nome_album}"</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="nome_traccia" label="Nome traccia" required />
              <Select name="fase" label="Fase" options={TRACK_PHASES} />
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">File audio</span>
              <input type="file" accept="audio/*" className="field mt-2 rounded-md px-3 py-2.5 text-sm" />
            </label>
            <div className="mt-4 flex gap-3">
              <ActionButton icon={UploadCloud} text="Aggiungi traccia" loading={uploadingTrack} />
              <button type="button" onClick={() => setShowTrackForm(false)} className="mt-5 inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-3 text-sm font-bold text-white/60 hover:text-white">
                Annulla
              </button>
            </div>
          </form>
        )}

        {/* Tabella tracce */}
        <div className="glass rounded-md p-5">
          {albumTracks.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/40">Nessuna traccia in questo album.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-white/35">
                  <tr>
                    <th className="border-b border-white/10 py-3 text-left">#</th>
                    <th className="border-b border-white/10 py-3 text-left">Traccia</th>
                    <th className="border-b border-white/10 py-3 text-left">Fase</th>
                    <th className="border-b border-white/10 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {albumTracks.map((track, idx) => (
                    <tr key={track.id} className="border-b border-white/7">
                      <td className="py-4 font-mono text-white/40">{idx + 1}</td>
                      <td className="py-4">
                        <p className="font-bold text-white">{track.nome_traccia}</p>
                        {track.audio_file_url ? (
                          <audio className="mt-2 h-8 w-full" controls src={track.audio_file_url} />
                        ) : (
                          <p className="mt-1 text-xs text-white/30">Audio non caricato</p>
                        )}
                      </td>
                      <td className="py-4">
                        <select
                          value={track.fase || "Demo"}
                          onChange={(e) => updateTrackPhase(track.id, e.target.value)}
                          className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white"
                        >
                          {TRACK_PHASES.map((f) => <option key={f} value={f} className="bg-neutral-950">{f}</option>)}
                        </select>
                      </td>
                      <td className="py-4 text-right">
                        <button onClick={() => deleteTrack(track)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-400/25 text-red-200 hover:bg-red-500/10">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  // Vista griglia album
  return (
    <>
      <ModuleHeader
        title="Studio Hub"
        text="Album, tracce, fasi di produzione e player per gli asset audio caricati su Supabase Storage."
        icon={Disc3}
        actions={
          <button
            onClick={() => setShowAlbumForm(!showAlbumForm)}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-black transition hover:bg-orange-300"
          >
            <Plus size={15} />
            Nuovo album
          </button>
        }
      />

      {/* Form crea album */}
      {showAlbumForm && (
        <form onSubmit={createAlbum} className="glass mb-5 rounded-md p-5">
          <p className="mb-4 font-black text-white">Nuovo album</p>
          <div className="flex gap-3">
            <Input name="album" label="Nome album" required className="flex-1" />
          </div>
          <div className="mt-4 flex gap-3">
            <ActionButton icon={Plus} text="Crea album" loading={savingAlbum} />
            <button type="button" onClick={() => setShowAlbumForm(false)} className="mt-5 inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-3 text-sm font-bold text-white/60 hover:text-white">
              Annulla
            </button>
          </div>
        </form>
      )}

      {/* Griglia album */}
      {albums.length === 0 ? (
        <div className="glass rounded-md p-10 text-center">
          <Music size={36} className="mx-auto mb-4 text-white/20" />
          <p className="text-sm text-white/40">Nessun album creato. Comincia creando il primo progetto.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {albums.map((album) => {
            const count = tracks.filter((t) => t.album_id === album.id).length;
            return (
              <button
                key={album.id}
                onClick={() => setSelectedAlbum(album)}
                className="glass group overflow-hidden rounded-md text-left transition hover:border-orange-400/30"
              >
                <div className={`relative h-40 bg-gradient-to-br ${albumGradient(album.id)} flex items-center justify-center`}>
                  {album.cover_image_url ? (
                    <Image src={album.cover_image_url} alt={album.nome_album} fill className="object-cover" />
                  ) : (
                    <Music size={40} className="text-white/20" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                    <span className="rounded-full bg-black/60 p-3">
                      <Play size={20} className="text-white" fill="white" />
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-black text-white">{album.nome_album}</p>
                  <p className="mt-1 text-xs text-white/45">{count} {count === 1 ? "traccia" : "tracce"}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tracce non assegnate */}
      {unassignedTracks.length > 0 && (
        <div className="glass mt-6 rounded-md p-5">
          <div className="mb-4 flex items-center gap-2">
            <MoreHorizontal size={18} className="text-white/40" />
            <p className="font-bold text-white/70">Tracce non assegnate</p>
            <span className="ml-auto font-mono text-xs text-white/30">{unassignedTracks.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-white/35">
                <tr>
                  <th className="border-b border-white/10 py-2 text-left">#</th>
                  <th className="border-b border-white/10 py-2 text-left">Nome</th>
                  <th className="border-b border-white/10 py-2 text-left">Fase</th>
                  <th className="border-b border-white/10 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {unassignedTracks.map((track, idx) => (
                  <tr key={track.id} className="border-b border-white/7">
                    <td className="py-3 font-mono text-white/40">{idx + 1}</td>
                    <td className="py-3 font-bold text-white">{track.nome_traccia}</td>
                    <td className="py-3">
                      <select
                        value={track.fase || "Demo"}
                        onChange={(e) => updateTrackPhase(track.id, e.target.value)}
                        className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white"
                      >
                        {TRACK_PHASES.map((f) => <option key={f} value={f} className="bg-neutral-950">{f}</option>)}
                      </select>
                    </td>
                    <td className="py-3 text-right">
                      <button onClick={() => deleteTrack(track)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-400/25 text-red-200 hover:bg-red-500/10">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// FIX 5: PressKit con download .txt e salvataggio nel vault
function PressKit({ state, user, onToast }: { state: AppState; user: AppUser; onToast: (text: string, kind?: "error" | "success") => void }) {
  const [prompt, setPrompt] = useState("Genera un press kit sintetico per la prossima release, includendo bio, pitch editoriale, punti forza e caption social.");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingToVault, setSavingToVault] = useState(false);

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
      if (!response.ok) throw new Error(data.error || "Errore AI.");
      setAnswer(data.text);
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Errore durante la generazione.");
    } finally {
      setLoading(false);
    }
  }

  function downloadTxt() {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const blob = new Blob([answer], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `press-kit-${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function saveToVault() {
    setSavingToVault(true);
    try {
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0];
      const dateTimeStr = today.toISOString().replace("T", "-").slice(0, 16).replace(":", "");
      const filePath = `press-kit/press-kit-${dateTimeStr}.txt`;

      const blob = new Blob([answer], { type: "text/plain;charset=utf-8" });
      const supabase = getSupabase();

      const { error: storageError } = await supabase.storage.from("vault").upload(filePath, blob, {
        contentType: "text/plain",
        upsert: true,
      });

      if (storageError) {
        onToast(`Errore upload vault: ${storageError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage.from("vault").getPublicUrl(filePath);

      // Formatta data italiana DD/MM/YYYY
      const [year, month, day] = dateStr.split("-");
      const italianDate = `${day}/${month}/${year}`;

      const { error: dbError } = await supabase.from("vault_documenti").insert({
        nome_file: `Press Kit ${italianDate}`,
        cartella: "Press",
        file_url: urlData.publicUrl,
        caricato_da: user.id,
      });

      if (dbError) {
        onToast(`Errore salvataggio vault: ${dbError.message}`);
        return;
      }

      onToast("Press Kit salvato nel Vault.", "success");
    } finally {
      setSavingToVault(false);
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
          <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-white/75">{answer || "L'output generato apparirà qui."}</pre>

          {/* FIX 5: Bottoni download e salva nel vault */}
          {answer !== "" && (
            <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-5">
              <button
                onClick={downloadTxt}
                className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <Download size={15} />
                Scarica .txt
              </button>
              <button
                onClick={saveToVault}
                disabled={savingToVault}
                className="inline-flex items-center gap-2 rounded-md border border-orange-400/30 bg-orange-500/10 px-4 py-2.5 text-sm font-bold text-orange-200 transition hover:bg-orange-500/20 disabled:opacity-60"
              >
                {savingToVault ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />}
                Salva nel Vault
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Profiles({ profiles, user, reload, onToast }: { profiles: ArtistProfile[]; user: AppUser; reload: () => Promise<void>; onToast: (text: string, kind?: "error" | "success") => void }) {
  const [saving, setSaving] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const nome_arte = String(form.get("nome_arte") ?? "").trim();

      if (!nome_arte) {
        onToast("Il nome arte è obbligatorio.");
        return;
      }

      const { error } = await getSupabase().from("profili_artisti").upsert({
        user_id: user.id,
        nome_arte,
        strumentazione: form.get("strumentazione") || null,
        bio_breve: form.get("bio_breve") || null,
        email_contatto: form.get("email_contatto") || null,
        link_instagram: form.get("link_instagram") || null,
        link_spotify: form.get("link_spotify") || null,
      });

      if (error) {
        onToast(`Errore profilo: ${error.message}`);
        return;
      }

      onToast("Profilo salvato.", "success");
      await reload();
    } finally {
      setSaving(false);
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
          <ActionButton icon={Download} text="Salva profilo" loading={saving} />
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

function Vault({ files, folders, user, reload, onToast }: { files: VaultFile[]; folders: VaultFolder[]; user: AppUser; reload: () => Promise<void>; onToast: (text: string, kind?: "error" | "success") => void }) {
  const [uploading, setUploading] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string>("Tutti");
  const [showNewFolder, setShowNewFolder] = useState(false);

  const folderNames = folders.map((f) => f.nome);
  const allFolderTabs = ["Tutti", ...folderNames];
  const filteredFiles = activeFolder === "Tutti" ? files : files.filter((f) => f.cartella === activeFolder);

  async function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nome = String(data.get("nome") ?? "").trim();
    if (!nome) return;
    const { error } = await getSupabase().from("vault_cartelle").insert({ nome, creato_da: user.id });
    if (error) { onToast(`Errore cartella: ${error.message}`); return; }
    event.currentTarget.reset();
    setShowNewFolder(false);
    await reload();
  }

  async function deleteFile(file: VaultFile) {
    const { error } = await getSupabase().from("vault_documenti").delete().eq("id", file.id);
    if (error) {
      onToast(`Errore eliminazione: ${error.message}`);
      return;
    }
    onToast("File eliminato.", "success");
    await reload();
  }

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    try {
      const form = new FormData(event.currentTarget);
      const fileInput = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
      const file = fileInput?.files?.[0];
      if (!file) {
        onToast("Seleziona un file da caricare.");
        return;
      }

      const supabase = getSupabase();
      const filePath = `${Date.now()}-${file.name}`;
      const { error: storageError } = await supabase.storage.from("vault").upload(filePath, file);
      if (storageError) {
        onToast(`Errore upload: ${storageError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage.from("vault").getPublicUrl(filePath);
      const { error: dbError } = await supabase.from("vault_documenti").insert({
        nome_file: (form.get("nome_file") as string) || file.name,
        cartella: form.get("cartella"),
        file_url: urlData.publicUrl,
        caricato_da: user.id,
      });

      if (dbError) {
        onToast(`Errore salvataggio: ${dbError.message}`);
        return;
      }

      onToast("File caricato.", "success");
      (event.target as HTMLFormElement).reset();
      await reload();
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <ModuleHeader title="Vault" text="Documenti, contratti e asset organizzati per cartelle." icon={Archive} />
      <div className="grid gap-5 lg:grid-cols-[180px_1fr_300px]">
        {/* Sidebar cartelle */}
        <div className="glass h-fit rounded-md p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Cartelle</p>
            <button
              onClick={() => setShowNewFolder(!showNewFolder)}
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/12 text-white/40 hover:text-white"
              title="Nuova cartella"
            >
              <Plus size={12} />
            </button>
          </div>
          {showNewFolder && (
            <form onSubmit={createFolder} className="mb-3 flex gap-1">
              <input name="nome" required placeholder="Nome" className="field min-w-0 flex-1 rounded px-2 py-1.5 text-xs" />
              <button type="submit" className="rounded bg-orange-500 px-2 py-1.5 text-xs font-black text-black">+</button>
            </form>
          )}
          {allFolderTabs.map((folder) => (
            <button
              key={folder}
              onClick={() => setActiveFolder(folder)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                activeFolder === folder ? "bg-orange-500/15 font-bold text-orange-200" : "text-white/50 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <span>{folder}</span>
              <span className="font-mono text-xs opacity-55">
                {folder === "Tutti" ? files.length : files.filter((f) => f.cartella === folder).length}
              </span>
            </button>
          ))}
        </div>

        {/* File grid */}
        <div className="glass rounded-md p-5">
          {filteredFiles.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/40">
              {activeFolder === "Tutti" ? "Nessun documento nel vault." : `Nessun file in "${activeFolder}".`}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredFiles.map((file) => (
                <article key={file.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-200">{file.cartella}</p>
                  <h3 className="mt-2 font-black text-white">{file.nome_file}</h3>
                  <div className="mt-5 flex gap-2">
                    <a href={file.file_url} className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-white/8 px-3 py-2 text-xs font-bold text-white hover:bg-white/12" target="_blank" rel="noreferrer">
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
          )}
        </div>

        {/* Upload form */}
        <form onSubmit={uploadFile} className="glass h-fit rounded-md p-5">
          <p className="text-lg font-black text-white">Carica documento</p>
          <p className="mt-1 text-sm text-white/50">Upload su Supabase Storage bucket "vault".</p>
          <Input name="nome_file" label="Nome file (opzionale)" />
          <Select name="cartella" label="Cartella" options={folderNames.length ? folderNames : ["Press", "Live", "Amministrazione", "Altro"]} />
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

// ── KanbanBoard ──────────────────────────────────────────────

const KANBAN_STATI = ["Da Fare", "In Corso", "Completato"] as const;
type KanbanStato = (typeof KANBAN_STATI)[number];

function KanbanBoard({
  tasks,
  user,
  reload,
  onToast,
}: {
  tasks: KanbanTask[];
  user: AppUser;
  reload: () => Promise<void>;
  onToast: (text: string, kind?: "error" | "success") => void;
}) {
  const [saving, setSaving] = useState(false);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = new FormData(event.currentTarget);
      const titolo = String(data.get("titolo") ?? "").trim();
      if (!titolo) { onToast("Inserisci un titolo."); return; }
      const { error } = await getSupabase().from("tasks_kanban").insert({
        titolo,
        stato: String(data.get("stato") ?? "Da Fare"),
        scadenza: String(data.get("scadenza") ?? "") || null,
        assegnato_a: user.email,
      });
      if (error) { onToast(`Errore task: ${error.message}`); return; }
      onToast("Task aggiunto.", "success");
      (event.target as HTMLFormElement).reset();
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function moveTask(task: KanbanTask, direction: "prev" | "next") {
    const idx = KANBAN_STATI.indexOf(task.stato as KanbanStato);
    const nextIdx = direction === "next" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= KANBAN_STATI.length) return;
    const { error } = await getSupabase().from("tasks_kanban").update({ stato: KANBAN_STATI[nextIdx] }).eq("id", task.id);
    if (error) { onToast(`Errore: ${error.message}`); return; }
    await reload();
  }

  async function deleteTask(task: KanbanTask) {
    const { error } = await getSupabase().from("tasks_kanban").delete().eq("id", task.id);
    if (error) { onToast(`Errore: ${error.message}`); return; }
    onToast("Task eliminato.", "success");
    await reload();
  }

  const colColors: Record<KanbanStato, string> = {
    "Da Fare": "border-white/10 bg-white/[0.025]",
    "In Corso": "border-orange-400/20 bg-orange-500/[0.05]",
    "Completato": "border-emerald-400/20 bg-emerald-500/[0.05]",
  };
  const dotColors: Record<KanbanStato, string> = {
    "Da Fare": "bg-white/30",
    "In Corso": "bg-orange-400",
    "Completato": "bg-emerald-400",
  };

  return (
    <>
      <ModuleHeader title="Task Board" text="Kanban del collettivo — Da Fare, In Corso, Completato." icon={ClipboardList} />

      <form onSubmit={createTask} className="glass mb-6 rounded-md p-5">
        <p className="mb-4 font-black text-white">Nuovo task</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input name="titolo" label="Titolo" placeholder="Es. Mixare Traccia 3" required />
          <Select name="stato" label="Stato iniziale" options={[...KANBAN_STATI]} />
          <Input name="scadenza" label="Scadenza (opzionale)" type="date" />
        </div>
        <ActionButton icon={Plus} text="Aggiungi task" loading={saving} />
      </form>

      <div className="grid gap-4 lg:grid-cols-3">
        {KANBAN_STATI.map((stato) => {
          const col = tasks.filter((t) => t.stato === stato);
          return (
            <div key={stato} className={`rounded-md border p-4 ${colColors[stato]}`}>
              <div className="mb-4 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${dotColors[stato]}`} />
                <p className="text-xs font-bold uppercase tracking-widest text-white/55">{stato}</p>
                <span className="ml-auto font-mono text-xs text-white/30">{col.length}</span>
              </div>
              <div className="space-y-3">
                {col.length === 0 && <p className="py-6 text-center text-xs text-white/20">Nessun task</p>}
                {col.map((task) => {
                  const stIdx = KANBAN_STATI.indexOf(task.stato as KanbanStato);
                  return (
                    <div key={task.id} className="glass rounded-md p-3">
                      <p className="text-sm font-bold text-white">{task.titolo}</p>
                      {task.scadenza && (
                        <p className="mt-1 font-mono text-[10px] text-white/35">
                          Scadenza: {new Date(task.scadenza).toLocaleDateString("it-IT")}
                        </p>
                      )}
                      {task.assegnato_a && <p className="mt-0.5 text-[10px] text-white/30">{task.assegnato_a}</p>}
                      <div className="mt-3 flex items-center justify-between gap-1">
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveTask(task, "prev")}
                            disabled={stIdx === 0}
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/10 text-white/40 hover:text-white disabled:opacity-20"
                          >
                            <ChevronLeft size={13} />
                          </button>
                          <button
                            onClick={() => moveTask(task, "next")}
                            disabled={stIdx === KANBAN_STATI.length - 1}
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/10 text-white/40 hover:text-white disabled:opacity-20"
                          >
                            <ChevronRight size={13} />
                          </button>
                        </div>
                        <button
                          onClick={() => deleteTask(task)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-red-400/20 text-red-400/50 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Componenti UI condivisi ──────────────────────────────────

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

function Select({ label, name, options }: { label: string; name: string; options: readonly string[] | string[] }) {
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

function ActionButton({ icon: Icon, text, loading = false }: { icon: typeof Plus; text: string; loading?: boolean }) {
  return (
    <button disabled={loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300 disabled:opacity-60">
      {loading ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
      {text}
    </button>
  );
}

// ── Utility ──────────────────────────────────────────────────

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
