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
  ExternalLink,
  FileAudio,
  KeyRound,
  FolderOpen,
  FolderPlus,
  Home,
  List,
  Loader2,
  LogOut,
  MoreHorizontal,
  Music,
  Package,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  Save,
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
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getSupabase } from "@/lib/supabase";
import { sampleAlbums, sampleEvents, sampleProducts, sampleProfiles, sampleTracks, sampleVault } from "@/lib/sample-data";
import type { Album, ArtistProfile, CalendarEvent, KanbanTask, Product, Role, Track, VaultFile, VaultFolder } from "@/lib/types";

type View = "home" | "inventory" | "calendar" | "projects" | "distrib" | "profile" | "vault";

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
  { id: "distrib", label: "Distrib", icon: Radio },
  { id: "profile", label: "Profili", icon: UserRound },
  { id: "vault", label: "Vault", icon: FolderOpen },
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
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [playingTrack, setPlayingTrack] = useState<Track | null>(null);
  const [playerAlbumTracks, setPlayerAlbumTracks] = useState<Track[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  useEffect(() => {
    function onScroll() { setHeaderScrolled(window.scrollY > 20); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

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
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        if (mounted) {
          setUser(null);
          setState(emptyState);
          setView("home");
          setPasswordRecovery(false);
        }
      } else if (event === "PASSWORD_RECOVERY") {
        if (mounted && session?.user) {
          setPasswordRecovery(true);
        }
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Notifiche browser + real-time task subscription
  useEffect(() => {
    if (!user) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const uid = user.id;
    const channel = getSupabase()
      .channel(`notif-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks_kanban" }, (payload) => {
        const task = payload.new as KanbanTask;
        if (task.assegnato_a === uid && "Notification" in window && Notification.permission === "granted") {
          new Notification("Nuovo task assegnato", { body: task.titolo, icon: "/assets/logo_login.png" });
        }
        loadWorkspace(uid);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks_kanban" }, (payload) => {
        const task = payload.new as KanbanTask;
        const prev = payload.old as KanbanTask;
        if (task.stato === "Completato" && prev.stato !== "Completato" && "Notification" in window && Notification.permission === "granted") {
          new Notification("✅ Task completata", { body: task.titolo, icon: "/assets/logo_login.png" });
        }
        loadWorkspace(uid);
      })
      .subscribe();
    return () => { void getSupabase().removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function handleResetPassword(email: string) {
    setLoading(true);
    setNotice(null);
    try {
      const origin = process.env.NEXT_PUBLIC_SITE_URL ??
        (typeof window !== "undefined" ? window.location.origin : "");
      const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      });
      if (error) throw error;
      setNotice("Email inviata! Controlla la tua casella e clicca il link.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Errore nell'invio dell'email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetNewPassword(newPassword: string) {
    setLoading(true);
    setNotice(null);
    try {
      const { error } = await getSupabase().auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordRecovery(false);
      setNotice("Password aggiornata! Effettua il login.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Errore aggiornamento password.");
    } finally {
      setLoading(false);
    }
  }

  if (passwordRecovery) {
    return <PasswordRecoveryScreen loading={loading} notice={notice} onSetNewPassword={handleSetNewPassword} />;
  }

  if (!user) {
    return <LoginScreen loading={loading} notice={notice} onLogin={handleLogin} onSignup={handleSignup} onResetPassword={handleResetPassword} />;
  }

  return (
    <main className="min-h-screen">
      <div className="fixed inset-0 -z-10 opacity-35">
        <Image src="/assets/background_main.png" alt="" fill priority className="object-cover" />
      </div>

      <header className={`sticky top-0 z-40 border-b border-white/10 bg-black/55 backdrop-blur-2xl${headerScrolled ? " scrolled" : ""}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <button className="flex items-center gap-3 text-left" onClick={() => setView("home")}>
            <span className="relative block h-10 w-10 overflow-hidden rounded-md border border-white/10 bg-white/5">
              <Image src="/assets/logo_login.png" alt="SUPERFLUIDO" fill className="object-contain p-1 animate-[spin_12s_linear_infinite]" />
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

          <UserMenu user={user} onLogout={handleLogout} onPasswordReset={handleResetPassword} />
        </div>

      </header>

      {/* Toast globale */}
      {toast && (
        <div
          className={`fixed bottom-20 right-4 z-50 flex items-center gap-3 rounded-md border px-4 py-3 text-sm font-semibold shadow-xl transition xl:bottom-6 xl:right-6 ${
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

      <section className={`mx-auto max-w-7xl px-4 py-6 lg:py-8 ${playingTrack ? "pb-[136px] xl:pb-28" : "pb-16 xl:pb-0"}`}>
        {notice ? <Notice text={notice} /> : null}
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {view === "home" && <Overview state={state} user={user} goTo={setView} onToast={showToast} reload={() => loadWorkspace(user.id)} />}
            {view === "inventory" && <Inventory products={state.products} user={user} reload={() => loadWorkspace(user.id)} onToast={showToast} />}
            {view === "calendar" && <CalendarModule events={state.events} tasks={state.tasks} user={user} reload={() => loadWorkspace(user.id)} onToast={showToast} />}
            {view === "projects" && (
              <Projects
                albums={state.albums}
                tracks={state.tracks}
                user={user}
                reload={() => loadWorkspace(user.id)}
                onToast={showToast}
                playingTrack={playingTrack}
                setPlayingTrack={setPlayingTrack}
                playerAlbumTracks={playerAlbumTracks}
                setPlayerAlbumTracks={setPlayerAlbumTracks}
              />
            )}
            {view === "distrib" && <Distrib albums={state.albums} user={user} reload={() => loadWorkspace(user.id)} onToast={showToast} goTo={setView} />}
            {view === "profile" && <Profiles profiles={state.profiles} user={user} reload={() => loadWorkspace(user.id)} onToast={showToast} />}
            {view === "vault" && <Vault files={state.vault} folders={state.folders} user={user} reload={() => loadWorkspace(user.id)} onToast={showToast} />}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Persistent audio player */}
      {playingTrack && (
        <NowPlayingBar
          track={playingTrack}
          album={state.albums.find((a) => a.id === playingTrack.album_id) ?? null}
          allTracks={playerAlbumTracks}
          onTrackChange={setPlayingTrack}
          onClose={() => setPlayingTrack(null)}
        />
      )}

      {/* Floating AI chat button */}
      <motion.button
        onClick={() => setChatOpen((o) => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className={`fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full border shadow-2xl transition-all duration-200 xl:right-6 ${playingTrack ? "bottom-[152px] xl:bottom-[88px]" : chatOpen ? "bottom-36 xl:bottom-6" : "bottom-20 xl:bottom-6"} ${chatOpen ? "border-orange-400/40 bg-orange-500/20 text-orange-300" : "border-white/15 bg-[#111] text-white/60 hover:border-white/25 hover:text-white"}`}
        title="AI Assistant"
      >
        <Sparkles size={22} />
      </motion.button>

      {/* AI chat slide-in panel */}
      <AIChatPanel
        state={state}
        user={user}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onToast={showToast}
        reload={() => loadWorkspace(user.id)}
        playerActive={!!playingTrack}
      />

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch border-t border-white/10 bg-[#0a0a0a]/96 backdrop-blur-xl xl:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition ${active ? "text-orange-400" : "text-white/35 hover:text-white/70"}`}
            >
              <Icon size={19} />
              <span className="text-[9px] font-semibold tracking-wide leading-none">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}

// ─── UserMenu (avatar dropdown) ──────────────────────────────────────────────

function UserMenu({
  user,
  onLogout,
  onPasswordReset,
}: {
  user: AppUser;
  onLogout: () => void;
  onPasswordReset: (email: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const initial = user.email[0].toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-500/40 bg-orange-500/15 text-sm font-black text-orange-300 transition hover:border-orange-400 hover:bg-orange-500/25"
        title={user.email}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-md border border-white/10 bg-[#0f0f0f] shadow-2xl">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="truncate text-xs font-semibold text-white">{user.email}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-orange-300">{user.role}</p>
          </div>
          <div className="p-1.5">
            <button
              onClick={async () => {
                setOpen(false);
                await onPasswordReset(user.email);
              }}
              className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              <KeyRound size={13} /> Cambia password
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm text-white/70 transition hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut size={13} /> Esci
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// FIX 2: LoginScreen con toggle login/signup
function LoginScreen({
  loading,
  notice,
  onLogin,
  onSignup,
  onResetPassword,
}: {
  loading: boolean;
  notice: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "login") {
      await onLogin(email, password);
    } else if (mode === "signup") {
      await onSignup(email, password);
    } else {
      await onResetPassword(email);
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
          {mode === "login" ? "Bunker Login" : mode === "signup" ? "Crea Account" : "Reset Password"}
        </h1>
        <p className="mt-2 text-center text-sm text-white/55">
          {mode === "login"
            ? "Accesso operativo a magazzino, studio, calendario e AI press kit."
            : mode === "signup"
            ? "Crea il tuo account per accedere al Bunker."
            : "Inserisci la tua email e ti mandiamo il link per reimpostare la password."}
        </p>

        {notice ? <Notice text={notice} /> : null}

        <label className="mt-6 block text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Email</label>
        <input className="field mt-2 rounded-md px-4 py-3" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="utente@superfluido.it" type="email" required />

        {mode !== "reset" && (
          <>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Password</label>
            <input className="field mt-2 rounded-md px-4 py-3" value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" required />
          </>
        )}

        <button
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
          {mode === "login" ? "Entra" : mode === "signup" ? "Crea Account" : "Invia link di reset"}
        </button>

        <div className="mt-5 flex flex-col items-center gap-2 text-center">
          {mode === "login" && (
            <>
              <button type="button" onClick={() => setMode("signup")} className="text-sm text-white/50 transition hover:text-orange-300">
                Non hai un account? <span className="font-bold text-orange-400">Registrati</span>
              </button>
              <button type="button" onClick={() => setMode("reset")} className="text-xs text-white/30 transition hover:text-white/60">
                Password dimenticata?
              </button>
            </>
          )}
          {mode === "signup" && (
            <button type="button" onClick={() => setMode("login")} className="text-sm text-white/50 transition hover:text-orange-300">
              Hai già un account? <span className="font-bold text-orange-400">Accedi</span>
            </button>
          )}
          {mode === "reset" && (
            <button type="button" onClick={() => setMode("login")} className="text-sm text-white/50 transition hover:text-orange-300">
              ← Torna al login
            </button>
          )}
        </div>
      </form>
    </main>
  );
}

function PasswordRecoveryScreen({
  loading,
  notice,
  onSetNewPassword,
}: {
  loading: boolean;
  notice: string | null;
  onSetNewPassword: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 6) { setLocalError("La password deve essere almeno 6 caratteri."); return; }
    if (password !== confirm) { setLocalError("Le password non coincidono."); return; }
    setLocalError(null);
    await onSetNewPassword(password);
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
        <h1 className="text-center text-2xl font-black tracking-tight text-white">Nuova Password</h1>
        <p className="mt-2 text-center text-sm text-white/55">Scegli una nuova password per il tuo account.</p>

        {(notice || localError) ? <Notice text={localError ?? notice ?? ""} /> : null}

        <label className="mt-6 block text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Nuova password</label>
        <input className="field mt-2 rounded-md px-4 py-3" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Minimo 6 caratteri" required />

        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Conferma password</label>
        <input className="field mt-2 rounded-md px-4 py-3" value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" placeholder="Ripeti la password" required />

        <button
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
          Imposta nuova password
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
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-bold transition ${
        active ? "bg-orange-500 text-black" : "text-white/62 hover:bg-white/8 hover:text-white"
      } ${compact ? "border border-white/10 bg-white/[0.04]" : ""}`}
    >
      <Icon size={15} />
      {item.label}
    </motion.button>
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

function trackPhaseBadge(fase: string | null) {
  const map: Record<string, string> = {
    Beat: "bg-sky-500/15 text-sky-300",
    Provini: "bg-purple-500/15 text-purple-300",
    Demo: "bg-yellow-500/15 text-yellow-300",
    Mix: "bg-orange-500/15 text-orange-300",
    Master: "bg-emerald-500/15 text-emerald-300",
  };
  return map[fase ?? ""] ?? "bg-white/10 text-white/40";
}

function Overview({ state, user, goTo, onToast, reload }: { state: AppState; user: AppUser; goTo: (view: View) => void; onToast: (text: string, kind?: "error" | "success") => void; reload: () => Promise<void> }) {
  const totalStock = state.products.reduce(
    (sum, product) => sum + (product.product_variants ?? []).reduce((variantSum, variant) => variantSum + Number(variant.stock_quantity ?? 0), 0),
    0,
  );
  const lowStock = state.products.filter((product) => (product.product_variants ?? []).some((variant) => Number(variant.stock_quantity) < 6));
  const upcomingReleases = [...state.albums]
    .filter((a) => a.release_date && (a.stato === "upcoming" || a.stato === "released"))
    .sort((a, b) => new Date(b.release_date!).getTime() - new Date(a.release_date!).getTime())
    .slice(0, 5);
  const recentTracks = state.tracks.slice(0, 5);

  const metricContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07 } },
  };
  const metricItem = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
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
            <button
              onClick={() => document.getElementById("overview-ai-chat")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300"
            >
              <Sparkles size={18} />
              Chiedi all'AI
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
      </motion.div>

      <motion.div variants={metricContainer} initial="hidden" animate="visible">
      <section className="metric-grid mt-5 grid gap-4">
        <motion.div variants={metricItem}><Metric title="Stock totale" value={totalStock.toString()} tone="orange" /></motion.div>
        <motion.div variants={metricItem}><Metric title="Alert stock" value={lowStock.length.toString()} tone="red" /></motion.div>
        <motion.div variants={metricItem}><Metric title="Release assets" value={state.tracks.length.toString()} tone="blue" /></motion.div>
        <motion.div variants={metricItem}><Metric title="Profili artisti" value={state.profiles.length.toString()} tone="green" /></motion.div>
      </section>
      </motion.div>

      {/* Inline AI chat embed */}
      <section className="mt-5" id="overview-ai-chat">
        <OverviewAIWidget state={state} user={user} onToast={onToast} reload={reload} />
      </section>

      {/* Widget task board */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.22 }}>
      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Task da fare */}
        <div className="glass rounded-md p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-orange-300" />
              <p className="font-black text-white">Task Board</p>
            </div>
            <button onClick={() => goTo("calendar")} className="text-xs font-semibold text-orange-300 hover:text-orange-200 transition">
              Vedi tutto →
            </button>
          </div>
          {/* Contatori per stato */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            {(["Da Fare", "In Corso", "Completato"] as const).map((stato) => {
              const count = state.tasks.filter((t) => t.stato === stato).length;
              const dotCls = stato === "Da Fare" ? "bg-white/30" : stato === "In Corso" ? "bg-orange-400" : "bg-emerald-400";
              return (
                <div key={stato} className="rounded-md border border-white/8 bg-white/[0.025] p-3 text-center">
                  <p className="font-mono text-2xl font-black text-white">{count}</p>
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{stato}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Primi 4 task pendenti */}
          {state.tasks.filter((t) => t.stato !== "Completato").length === 0 ? (
            <p className="py-3 text-center text-sm text-white/30">Nessun task in sospeso.</p>
          ) : (
            <div className="space-y-2">
              {state.tasks
                .filter((t) => t.stato !== "Completato")
                .slice(0, 4)
                .map((task, idx) => {
                  const isInCorso = task.stato === "In Corso";
                  return (
                    <motion.div key={task.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05, duration: 0.2 }} className="flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.025] px-3 py-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${isInCorso ? "bg-orange-400" : "bg-white/25"}`} />
                      <p className="flex-1 truncate text-sm font-semibold text-white/80">{task.titolo}</p>
                      {task.scadenza && (
                        <p className="shrink-0 font-mono text-[10px] text-white/35">
                          {new Date(task.scadenza).toLocaleDateString("it-IT")}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Prossimi eventi */}
        <div className="glass rounded-md p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-orange-300" />
              <p className="font-black text-white">Prossimi eventi</p>
            </div>
            <button onClick={() => goTo("calendar")} className="text-xs font-semibold text-orange-300 hover:text-orange-200 transition">
              Vedi tutto →
            </button>
          </div>
          {state.events.length === 0 ? (
            <p className="py-3 text-center text-sm text-white/30">Nessun evento in calendario.</p>
          ) : (
            <div className="space-y-2">
              {[...state.events]
                .filter((e) => new Date(e.data_evento) >= new Date())
                .sort((a, b) => new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime())
                .slice(0, 4)
                .map((ev, idx) => (
                  <motion.div key={ev.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05, duration: 0.2 }} className="flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.025] px-3 py-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ev.colore ?? "#f97316" }} />
                    <p className="flex-1 truncate text-sm font-semibold text-white/80">{ev.titolo}</p>
                    <p className="shrink-0 font-mono text-[10px] text-white/35">
                      {new Date(ev.data_evento).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                    </p>
                  </motion.div>
                ))}
            </div>
          )}
        </div>
      </section>
      </motion.div>

      {/* Release in arrivo + ultime tracce */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.22 }}>
      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="glass rounded-md p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-orange-300" />
              <p className="font-black text-white">Release con data</p>
            </div>
            <button onClick={() => goTo("distrib")} className="text-xs font-semibold text-orange-300 hover:text-orange-200 transition">
              Vedi tutto →
            </button>
          </div>
          {upcomingReleases.length === 0 ? (
            <p className="py-3 text-center text-sm text-white/30">Nessuna release con data impostata.</p>
          ) : (
            <div className="space-y-2">
              {upcomingReleases.map((album, idx) => (
                <motion.div key={album.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05, duration: 0.2 }} className="flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.025] px-3 py-2.5">
                  <Radio size={12} className="shrink-0 text-orange-300/60" />
                  <p className="flex-1 truncate text-sm font-semibold text-white/80">{album.nome_album}</p>
                  <p className="shrink-0 font-mono text-[10px] text-white/35">
                    {new Date(album.release_date!).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-md p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music size={16} className="text-orange-300" />
              <p className="font-black text-white">Ultime tracce</p>
            </div>
            <button onClick={() => goTo("projects")} className="text-xs font-semibold text-orange-300 hover:text-orange-200 transition">
              Vedi tutto →
            </button>
          </div>
          {recentTracks.length === 0 ? (
            <p className="py-3 text-center text-sm text-white/30">Nessuna traccia caricata.</p>
          ) : (
            <div className="space-y-2">
              {recentTracks.map((track, idx) => (
                <motion.div key={track.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05, duration: 0.2 }} className="flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.025] px-3 py-2.5">
                  <Music size={12} className="shrink-0 text-white/25" />
                  <p className="flex-1 truncate text-sm font-semibold text-white/80">{track.nome_traccia}</p>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${trackPhaseBadge(track.fase)}`}>
                    {track.fase ?? "—"}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
      </motion.div>
    </>
  );
}

// ── AI helpers ────────────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string; printable?: boolean };

function buildAIContext(state: AppState) {
  return {
    vault: state.vault.map((f) => ({ nome: f.nome_file, cartella: f.cartella || "root" })),
    tasks: state.tasks.map((t) => ({ titolo: t.titolo, stato: t.stato, scadenza: t.scadenza })),
    eventi: state.events
      .filter((e) => new Date(e.data_evento) >= new Date())
      .slice(0, 8)
      .map((e) => ({ titolo: e.titolo, data: e.data_evento, luogo: e.luogo })),
    album_in_lavorazione: state.albums
      .filter((a) => !a.stato || a.stato === "in_progress")
      .map((a) => ({ nome: a.nome_album })),
    discografia: state.albums
      .filter((a) => a.stato === "released")
      .slice(0, 30)
      .map((a) => ({
        nome: a.nome_album,
        tipo: a.tipo_release ?? "album",
        anno: a.release_date?.slice(0, 4) ?? null,
        spotify: a.link_spotify ?? null,
        apple: a.link_apple ?? null,
        bandcamp: a.link_bandcamp ?? null,
      })),
    profili: state.profiles.map((p) => ({
      nome_arte: p.nome_arte,
      ruolo: p.strumentazione,
      bio: p.bio_breve,
      instagram: p.link_instagram,
      spotify: p.link_spotify,
      email: p.email_contatto,
    })),
  };
}

// ── Markdown → HTML (no deps) ─────────────────────────────────────────────────

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMd(s: string) {
  return escHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inUl = false;
  const closeList = () => { if (inUl) { out.push("</ul>"); inUl = false; } };
  for (const raw of lines) {
    const t = raw.trimEnd();
    if (t.startsWith("### "))     { closeList(); out.push(`<h3>${inlineMd(t.slice(4))}</h3>`); }
    else if (t.startsWith("## ")) { closeList(); out.push(`<h2>${inlineMd(t.slice(3))}</h2>`); }
    else if (t.startsWith("# "))  { closeList(); out.push(`<h1>${inlineMd(t.slice(2))}</h1>`); }
    else if (/^[*-] /.test(t))    { if (!inUl) { out.push("<ul>"); inUl = true; } out.push(`<li>${inlineMd(t.slice(2))}</li>`); }
    else if (t === "")             { closeList(); out.push(""); }
    else                           { closeList(); out.push(`<p>${inlineMd(t)}</p>`); }
  }
  closeList();
  return out.join("\n");
}

// ── PrintPreviewModal ─────────────────────────────────────────────────────────

function PrintPreviewModal({ content, onClose, onToast }: { content: string; onClose: () => void; onToast?: (text: string, kind?: "error" | "success") => void }) {
  const html = markdownToHtml(content);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!onToast || savedRef.current) return;
    savedRef.current = true;
    const today = new Date();
    const [year, month, day] = today.toISOString().split("T")[0].split("-");
    const italianDate = `${day}/${month}/${year}`;
    const dateTimeStr = today.toISOString().replace("T", "-").slice(0, 16).replace(/:/g, "");
    const filePath = `press-kit/press-kit-${dateTimeStr}.html`;
    const fullHtml = buildPressKitHtmlStyled(html, italianDate);
    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const supabase = getSupabase();
    (async () => {
      const { error: storageErr } = await supabase.storage.from("vault").upload(filePath, blob, { contentType: "text/html", upsert: true });
      if (storageErr) { onToast(`Errore upload vault: ${storageErr.message}`); return; }
      const { data: urlData } = supabase.storage.from("vault").getPublicUrl(filePath);
      const { error: dbErr } = await supabase.from("vault_documenti").insert({ nome_file: `Press Kit ${italianDate}`, cartella: "Press", file_url: urlData.publicUrl });
      if (dbErr) { onToast(`Errore vault: ${dbErr.message}`); return; }
      onToast("Press kit salvato nel Vault → cartella Press.", "success");
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function downloadHtml() {
    const today = new Date();
    const [year, month, day] = today.toISOString().split("T")[0].split("-");
    const italianDate = `${day}/${month}/${year}`;
    const fullHtml = buildPressKitHtmlStyled(html, italianDate);
    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `press-kit-superfluido-${today.toISOString().split("T")[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-auto bg-white text-black">
      <div className="mx-auto max-w-2xl px-6 py-8 sm:px-8">
        <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-gray-200 pb-5">
          <button
            onClick={downloadHtml}
            className="inline-flex items-center gap-2 rounded-md bg-black px-5 py-2.5 text-sm font-bold text-white hover:bg-gray-800"
          >
            <Download size={15} />
            Scarica
          </button>
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Chiudi
          </button>
          <span className="text-xs text-gray-400">Apri il file scaricato → stampa → salva come PDF</span>
        </div>
        {/* Branded preview */}
        <div style={{ borderTop: "5px solid #f97316", marginBottom: "0" }} />
        <div style={{ padding: "32px 0 8px", borderBottom: "1px solid #e5e5e5", marginBottom: "32px" }}>
          <div style={{ fontSize: "9px", fontFamily: "Helvetica,Arial,sans-serif", letterSpacing: ".4em", textTransform: "uppercase" as const, color: "#f97316", fontWeight: 700, marginBottom: "10px" }}>
            SUPERFLUIDO · BUNKER OPERATING SYSTEM
          </div>
          <div style={{ fontSize: "40px", fontWeight: 900, lineHeight: "1", letterSpacing: "-1.5px", fontFamily: "Helvetica,Arial,sans-serif", color: "#000" }}>
            MEDIA PRESS KIT
          </div>
          <div style={{ marginTop: "12px", fontSize: "11px", color: "#999", fontFamily: "Helvetica,Arial,sans-serif" }}>
            {new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </div>
        <div style={{ fontFamily: "Georgia,'Times New Roman',serif", color: "#111", lineHeight: "1.85" }}
          dangerouslySetInnerHTML={{ __html: html.replace(/<h1>/g, '<h1 style="font-size:20px;font-weight:900;font-family:Helvetica,Arial,sans-serif;border-left:4px solid #f97316;padding-left:14px;margin:32px 0 12px;color:#000">').replace(/<h2>/g, '<h2 style="font-size:11px;font-weight:700;font-family:Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:.14em;color:#f97316;margin:24px 0 8px">').replace(/<h3>/g, '<h3 style="font-size:10px;font-weight:700;font-family:Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:.12em;color:#888;margin:18px 0 6px">').replace(/<p>/g, '<p style="font-size:14px;line-height:1.85;color:#222;margin-bottom:12px">').replace(/<li>/g, '<li style="font-size:14px;line-height:1.75;margin-bottom:5px">') }}
        />
      </div>
    </div>
  );
}

type PendingIntentClient = { type: string; entities: Record<string, string | null> } | null;

async function sendToAI(
  messages: ChatMessage[],
  context: ReturnType<typeof buildAIContext>,
  userId: string,
  onChunk: (chunk: string) => void,
  pendingIntent?: PendingIntentClient,
): Promise<{ actionPerformed: boolean; actionMessage?: string; printable?: boolean; pendingIntent?: PendingIntentClient }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context, userId, pendingIntent }),
  });
  if (!res.ok) { const data = await res.json() as { error?: string }; throw new Error(data.error ?? "Errore AI"); }
  const data = await res.json() as {
    text?: string;
    actionPerformed?: boolean;
    actionMessage?: string;
    printable?: boolean;
    pendingIntent?: PendingIntentClient;
  };
  if (data.text) onChunk(data.text);
  return {
    actionPerformed: data.actionPerformed ?? false,
    actionMessage: data.actionMessage,
    printable: data.printable ?? false,
    pendingIntent: data.pendingIntent ?? null,
  };
}

// ── OverviewAIWidget (embedded ChatGPT-style) ────────────────────────────────

function OverviewAIWidget({
  state,
  user,
  onToast,
  reload,
}: {
  state: AppState;
  user: AppUser;
  onToast: (text: string, kind?: "error" | "success") => void;
  reload: () => Promise<void>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [printContent, setPrintContent] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState("AI");
  const [pendingIntent, setPendingIntent] = useState<PendingIntentClient>(null);
  const msgsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, aiLoading]);

  async function send() {
    const text = input.trim();
    if (!text || aiLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setInput("");
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setAiLoading(true);
    try {
      let streamedContent = "";
      const meta = await sendToAI(
        nextMessages,
        buildAIContext(state),
        user.id,
        (chunk) => {
          streamedContent += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk,
            };
            return updated;
          });
        },
        pendingIntent,
      );
      setPendingIntent(meta.pendingIntent ?? null);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], printable: meta.printable };
        return updated;
      });
      if (meta.printable) setPrintContent(streamedContent);
      if (meta.actionPerformed) {
        await reload();
        onToast(meta.actionMessage ?? "Operazione completata.", "success");
      }
    } catch (e) {
      console.error("AI error:", e);
      onToast("Servizio AI momentaneamente occupato. Riprova tra qualche secondo.", "error");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setAiLoading(false);
    }
  }

  const CHIPS = [
    "Crea un task per il prossimo showcase",
    "Aggiungi un evento in studio per venerdì",
    "Cerca contratti nel Vault",
    "Cosa abbiamo in lavorazione?",
  ];

  return (
    <div className="glass flex h-[340px] flex-col overflow-hidden rounded-md sm:h-[480px]">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/8 px-5 py-4">
        <Sparkles size={15} className="text-orange-300" />
        <p className="font-black text-white">AI Assistant</p>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setPendingIntent(null); }}
            className="ml-2 text-[11px] text-white/30 transition hover:text-white/60"
          >
            Nuova chat
          </button>
        )}
        <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.14em] text-white/22">
          {aiProvider}
        </span>
      </div>

      {/* Messages area */}
      <div ref={msgsRef} className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-5">
            <div className="text-center">
              <Sparkles size={32} className="mx-auto mb-3 text-orange-300/40" />
              <p className="text-sm font-semibold text-white/40">
                Posso creare task, aggiungere eventi al calendario,<br />cercare documenti nel Vault e rispondere su SUPERFLUIDO.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {CHIPS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/55 transition hover:border-orange-400/30 hover:text-white/85"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <span className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/15">
                <Sparkles size={11} className="text-orange-300" />
              </span>
            )}
            <div className="flex max-w-[75%] flex-col gap-1.5">
              <div
                className={`rounded-xl px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "rounded-br-sm bg-orange-500/20 text-white"
                    : "rounded-bl-sm bg-white/[0.06] text-white/85"
                }`}
              >
                {msg.role === "assistant"
                  ? <span dangerouslySetInnerHTML={{ __html: renderMsgMarkdown(msg.content) }} />
                  : msg.content}
              </div>
              {msg.printable && (
                <button
                  onClick={() => setPrintContent(msg.content)}
                  className="self-start rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/55 transition hover:border-orange-400/30 hover:text-white/80"
                >
                  <Download size={11} className="mr-1.5 inline" />
                  Stampa / Salva PDF
                </button>
              )}
            </div>
          </div>
        ))}

        {aiLoading && messages[messages.length - 1]?.content === "" && (
          <div className="mb-4 flex justify-start">
            <span className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/15">
              <Sparkles size={11} className="text-orange-300" />
            </span>
            <div className="rounded-xl rounded-bl-sm bg-white/[0.06] px-4 py-3">
              <div className="flex gap-1">
                {[0, 0.15, 0.3].map((d, i) => (
                  <span
                    key={i}
                    className="block h-1.5 w-1.5 animate-bounce rounded-full bg-white/40"
                    style={{ animationDelay: `${d}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/8 px-5 py-4">
        <div className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 focus-within:border-orange-500/40">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Scrivi un messaggio…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!input.trim() || aiLoading}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-black transition hover:bg-orange-300 disabled:opacity-35"
          >
            <Send size={13} />
          </button>
        </div>
      </div>

      {printContent !== null && (
        <PrintPreviewModal content={printContent} onClose={() => setPrintContent(null)} onToast={onToast} />
      )}
    </div>
  );
}

// ── AIChatPanel (floating slide-in) ──────────────────────────────────────────

function AIChatPanel({
  state,
  user,
  open,
  onClose,
  onToast,
  reload,
  playerActive,
}: {
  state: AppState;
  user: AppUser;
  open: boolean;
  onClose: () => void;
  onToast: (text: string, kind?: "error" | "success") => void;
  reload: () => Promise<void>;
  playerActive: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [printContent, setPrintContent] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState("AI");
  const [pendingIntent, setPendingIntent] = useState<PendingIntentClient>(null);
  const msgsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, aiLoading]);

  async function send() {
    const text = input.trim();
    if (!text || aiLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setInput("");
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setAiLoading(true);
    try {
      let streamedContent = "";
      const meta = await sendToAI(
        nextMessages,
        buildAIContext(state),
        user.id,
        (chunk) => {
          streamedContent += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk,
            };
            return updated;
          });
        },
        pendingIntent,
      );
      setPendingIntent(meta.pendingIntent ?? null);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], printable: meta.printable };
        return updated;
      });
      if (meta.printable) setPrintContent(streamedContent);
      if (meta.actionPerformed) {
        await reload();
        onToast(meta.actionMessage ?? "Operazione completata.", "success");
      }
    } catch (e) {
      console.error("AI error:", e);
      onToast("Servizio AI momentaneamente occupato. Riprova tra qualche secondo.", "error");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setAiLoading(false);
    }
  }

  const CHIPS = [
    "Crea un task urgente",
    "Aggiungi un live al calendario",
    "Dove sono i contratti?",
    "Genera un press kit rapido",
  ];

  return (
    <div
      className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-white/10 bg-[#0a0a0a] shadow-2xl transition-transform duration-300 xl:w-[360px] ${open ? "translate-x-0" : "translate-x-full"} ${playerActive ? "pb-[136px] xl:pb-[72px]" : "pb-16 xl:pb-0"}`}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
        <Sparkles size={15} className="text-orange-300" />
        <p className="flex-1 text-sm font-black text-white">AI Assistant</p>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
          {aiProvider}
        </span>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setPendingIntent(null); }}
            className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[11px] font-semibold text-white/40 transition hover:border-orange-500/40 hover:text-orange-300"
          >
            <Plus size={11} />
            Nuova
          </button>
        )}
        <button onClick={onClose} className="text-white/35 transition hover:text-white">
          <X size={15} />
        </button>
      </div>

      {/* Messages */}
      <div ref={msgsRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-center text-sm text-white/35">
              Posso creare task, aggiungere eventi, cercare nel Vault e generare documenti.
            </p>
            <div className="mt-4 space-y-2">
              {CHIPS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="w-full rounded-md border border-white/8 bg-white/[0.025] px-3 py-2.5 text-left text-sm text-white/55 transition hover:border-white/15 hover:text-white/80"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] rounded-md px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-orange-500/20 text-white"
                  : "bg-white/[0.06] text-white/85"
              }`}
            >
              {msg.role === "assistant"
                ? <span dangerouslySetInnerHTML={{ __html: renderMsgMarkdown(msg.content) }} />
                : msg.content}
            </div>
            {msg.printable && (
              <button
                onClick={() => setPrintContent(msg.content)}
                className="mt-1.5 rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/50 transition hover:border-orange-400/30 hover:text-white/75"
              >
                <Download size={10} className="mr-1 inline" />
                Stampa / Salva PDF
              </button>
            )}
          </div>
        ))}

        {aiLoading && messages[messages.length - 1]?.content === "" && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-md bg-white/[0.06] px-3 py-2.5">
              <div className="flex gap-1">
                {[0, 0.15, 0.3].map((d, i) => (
                  <span
                    key={i}
                    className="block h-1.5 w-1.5 animate-bounce rounded-full bg-white/40"
                    style={{ animationDelay: `${d}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Scrivi un messaggio…"
            className="flex-1 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-orange-500/40 focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!input.trim() || aiLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orange-500 text-black transition hover:bg-orange-300 disabled:opacity-40"
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {printContent !== null && (
        <PrintPreviewModal content={printContent} onClose={() => setPrintContent(null)} onToast={onToast} />
      )}
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function Metric({ title, value, tone }: { title: string; value: string; tone: "orange" | "red" | "blue" | "green" }) {
  const numericValue = parseInt(value, 10);
  const isNumeric = !isNaN(numericValue);
  const [displayed, setDisplayed] = useState(isNumeric ? 0 : null);

  useEffect(() => {
    if (!isNumeric) return;
    const start = performance.now();
    const duration = 800;
    function frame(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * numericValue));
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }, [numericValue, isNumeric]);

  const displayValue = isNumeric ? String(displayed) : value;
  const tones = {
    orange: "text-orange-200 bg-orange-500/12 border-orange-400/25",
    red: "text-red-200 bg-red-500/10 border-red-400/25",
    blue: "text-sky-200 bg-sky-500/10 border-sky-400/25",
    green: "text-emerald-200 bg-emerald-500/10 border-emerald-400/25",
  };
  return (
    <div className={`rounded-md border p-5 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-65">{title}</p>
      <p className="mt-3 font-mono text-4xl font-black">{displayValue}</p>
    </div>
  );
}

function Inventory({ products, user, reload, onToast }: { products: Product[]; user: AppUser; reload: () => Promise<void>; onToast: (text: string, kind?: "error" | "success") => void }) {
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [updatingProduct, setUpdatingProduct] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [inventoryView, setInventoryView] = useState<"list" | "analytics">("list");
  const addFormRef = useRef<HTMLDivElement>(null);
  const filtered = products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase()));

  const analyticsData = useMemo(() => {
    const totalValue = products.reduce((sum, p) => {
      const stock = (p.product_variants ?? []).reduce((s, v) => s + Number(v.stock_quantity ?? 0), 0);
      return sum + stock * Number(p.base_price_sell ?? 0);
    }, 0);
    const byProduct = products
      .map((p) => ({ name: p.name, stock: (p.product_variants ?? []).reduce((s, v) => s + Number(v.stock_quantity ?? 0), 0) }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 8);
    const maxStock = Math.max(...byProduct.map((p) => p.stock), 1);
    const byCategory: Record<string, number> = {};
    for (const p of products) { const cat = p.category ?? "Altro"; byCategory[cat] = (byCategory[cat] ?? 0) + 1; }
    const lowStock = products.filter((p) => (p.product_variants ?? []).some((v) => Number(v.stock_quantity ?? 0) <= 3));
    return { totalValue, byProduct, maxStock, byCategory, lowStock };
  }, [products]);

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      const category = String(data.get("category") ?? "Altro");
      const stock = Number(data.get("stock") ?? 0);
      if (!name) { onToast("Inserisci un nome per il prodotto."); return; }
      const supabase = getSupabase();
      const { data: created, error } = await supabase.from("products").insert({ name, category, base_price_sell: Number(data.get("price") ?? 0), base_price_cost: 0 }).select().single();
      if (error) { onToast(`Errore prodotto: ${error.message}`); return; }
      const { error: variantError } = await supabase.from("product_variants").insert({ product_id: created.id, variant_name: "Default", stock_quantity: stock });
      if (variantError) { onToast(`Prodotto creato ma errore variante: ${variantError.message}`); } else { onToast("Prodotto aggiunto.", "success"); (event.target as HTMLFormElement).reset(); }
      await reload();
    } finally { setSaving(false); }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Eliminare "${product.name}"? Questa azione è irreversibile.`)) return;
    const { error } = await getSupabase().from("products").delete().eq("id", product.id);
    if (error) { onToast(`Errore eliminazione: ${error.message}`); return; }
    onToast("Prodotto eliminato.", "success");
    await reload();
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct) return;
    setUpdatingProduct(true);
    try {
      const form = new FormData(event.currentTarget);
      const fileInput = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
      const file = fileInput?.files?.[0];
      let image_url = editingProduct.image_url ?? null;

      if (file) {
        const supabase = getSupabase();
        const ext = file.name.split(".").pop() ?? "jpg";
        const filePath = `prodotti/${String(editingProduct.id)}-${Date.now()}.${ext}`;
        const { error: storageErr } = await supabase.storage.from("vault").upload(filePath, file, { upsert: true });
        if (storageErr) { onToast(`Errore immagine: ${storageErr.message}`); return; }
        const { data: urlData } = supabase.storage.from("vault").getPublicUrl(filePath);
        image_url = urlData.publicUrl;
      }

      const { error } = await getSupabase().from("products").update({
        name: String(form.get("name") ?? "").trim(),
        category: String(form.get("category") ?? "Altro"),
        base_price_sell: Number(form.get("price") ?? 0),
        description: String(form.get("description") ?? "") || null,
        image_url,
      }).eq("id", editingProduct.id);

      if (error) { onToast(`Errore aggiornamento: ${error.message}`); return; }
      onToast("Prodotto aggiornato.", "success");
      setEditingProduct(null);
      await reload();
    } finally { setUpdatingProduct(false); }
  }

  return (
    <>
      <ModuleHeader title="Magazzino" text="Inventario merch, varianti e alert stock con lettura diretta dalle tabelle products e product_variants." icon={Warehouse} />

      {/* Tab Lista / Analytics */}
      <div className="mb-5 flex items-center gap-2">
        <button
          onClick={() => setInventoryView("list")}
          className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold transition ${inventoryView === "list" ? "bg-orange-500 text-black" : "border border-white/10 bg-white/[0.04] text-white/60 hover:text-white"}`}
        >
          <List size={14} />
          Lista
        </button>
        <button
          onClick={() => setInventoryView("analytics")}
          className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold transition ${inventoryView === "analytics" ? "bg-orange-500 text-black" : "border border-white/10 bg-white/[0.04] text-white/60 hover:text-white"}`}
        >
          <Sparkles size={14} />
          Analytics
        </button>
      </div>

      {/* Modal modifica prodotto */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" onClick={() => setEditingProduct(null)}>
          <form key={String(editingProduct.id)} onSubmit={updateProduct} className="glass w-full max-w-lg rounded-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-lg font-black text-white">Modifica prodotto</p>
              <button type="button" onClick={() => setEditingProduct(null)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="mb-1 flex gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/5">
                {editingProduct.image_url ? (
                  <Image src={editingProduct.image_url} alt={editingProduct.name} width={80} height={80} className="h-full w-full object-cover" />
                ) : (
                  <Package size={24} className="text-white/20" />
                )}
              </div>
              <label className="flex-1">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Immagine prodotto</span>
                <input type="file" accept="image/*" className="field mt-2 rounded-md px-3 py-2.5 text-sm" />
              </label>
            </div>
            <Input name="name" label="Nome" required defaultValue={editingProduct.name} />
            <Select name="category" label="Categoria" options={PRODUCT_CATEGORIES} defaultValue={editingProduct.category ?? "Altro"} />
            <Input name="price" label="Prezzo vendita" type="number" step="0.01" defaultValue={String(editingProduct.base_price_sell ?? "")} />
            <Textarea name="description" label="Descrizione" defaultValue={editingProduct.description ?? ""} rows={3} />
            <div className="mt-5 flex gap-3">
              <button disabled={updatingProduct} className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300 disabled:opacity-60">
                {updatingProduct ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Salva modifiche
              </button>
              <button type="button" onClick={() => setEditingProduct(null)} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-3 text-sm font-bold text-white/60 hover:text-white">
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {inventoryView === "list" && (
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="glass rounded-md p-5">
          <div className="mb-5 flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3">
            <Search size={18} className="text-white/40" />
            <input className="w-full bg-transparent text-sm text-white outline-none" placeholder="Cerca prodotto, categoria o variante" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>

          {/* Mobile card list */}
          <div className="space-y-3 lg:hidden">
            {filtered.length === 0 && <p className="py-10 text-center text-sm text-white/40">Nessun prodotto trovato.</p>}
            {filtered.map((product) => {
              const stock = (product.product_variants ?? []).reduce((sum, v) => sum + Number(v.stock_quantity ?? 0), 0);
              return (
                <div key={product.id} className="flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.03] p-3">
                  {product.image_url ? (
                    <Image src={product.image_url} alt={product.name} width={48} height={48} className="h-12 w-12 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5">
                      <Package size={18} className="text-white/20" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white">{product.name}</p>
                    <p className="text-xs text-white/45">{product.category ?? "Generale"} · {formatEuro(product.base_price_sell)}</p>
                  </div>
                  <span className={`shrink-0 font-mono text-sm font-black ${stock < 6 ? "text-red-300" : "text-emerald-300"}`}>{stock}</span>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => setEditingProduct(product)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/40 hover:bg-white/8 hover:text-white">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => deleteProduct(product)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-400/25 text-red-200 hover:bg-red-500/10">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-white/38">
                <tr>
                  <th className="border-b border-white/10 py-3 w-12"></th>
                  <th className="border-b border-white/10 py-3">Prodotto</th>
                  <th className="border-b border-white/10 py-3">Categoria</th>
                  <th className="border-b border-white/10 py-3">Varianti</th>
                  <th className="border-b border-white/10 py-3 text-right">Prezzo</th>
                  <th className="border-b border-white/10 py-3 text-right">Stock</th>
                  <th className="border-b border-white/10 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-sm text-white/40">Nessun prodotto trovato.</td></tr>
                )}
                {filtered.map((product) => {
                  const stock = (product.product_variants ?? []).reduce((sum, item) => sum + Number(item.stock_quantity ?? 0), 0);
                  return (
                    <tr key={product.id} className="border-b border-white/7 text-white/78">
                      <td className="py-4">
                        {product.image_url ? (
                          <Image src={product.image_url} alt={product.name} width={36} height={36} className="h-9 w-9 rounded object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded border border-white/10 bg-white/5">
                            <Package size={14} className="text-white/20" />
                          </div>
                        )}
                      </td>
                      <td className="py-4">
                        <p className="font-bold text-white">{product.name}</p>
                        {product.description && <p className="mt-0.5 text-xs text-white/40 line-clamp-1">{product.description}</p>}
                      </td>
                      <td className="py-4">{product.category ?? "Generale"}</td>
                      <td className="py-4">{(product.product_variants ?? []).map((variant) => `${variant.variant_name}: ${variant.stock_quantity}`).join(" · ")}</td>
                      <td className="py-4 text-right font-mono">{formatEuro(product.base_price_sell)}</td>
                      <td className={`py-4 text-right font-mono font-black ${stock < 6 ? "text-red-300" : "text-emerald-300"}`}>{stock}</td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditingProduct(product)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/40 hover:bg-white/8 hover:text-white" title="Modifica">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteProduct(product)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-400/25 text-red-200 hover:bg-red-500/10" title="Elimina">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div ref={addFormRef} className="glass rounded-md">
          <button
            type="button"
            onClick={() => {
              setShowAddForm((v) => {
                if (!v) setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                return !v;
              });
            }}
            className="flex w-full items-center justify-between px-5 py-4 lg:hidden"
          >
            <span className="text-sm font-black text-white">+ Nuovo prodotto</span>
            <ChevronRight size={16} className={`text-white/40 transition-transform duration-200 ${showAddForm ? "rotate-90" : ""}`} />
          </button>
          <form
            onSubmit={addProduct}
            className={`p-5 ${showAddForm ? "block" : "hidden"} lg:block`}
          >
            <p className="hidden text-lg font-black text-white lg:block">Nuovo prodotto</p>
            <p className="mt-1 hidden text-sm text-white/50 lg:block">Creazione rapida su Supabase per merch e supporti fisici.</p>
            <Input name="name" label="Nome" required />
            <Select name="category" label="Categoria" options={PRODUCT_CATEGORIES} />
            <Input name="price" label="Prezzo vendita" type="text" inputMode="decimal" />
            <Input name="stock" label="Stock iniziale" type="text" inputMode="numeric" defaultValue="0" />
            <ActionButton icon={Plus} text="Aggiungi" loading={saving} />
            <p className="mt-4 text-xs text-white/35">Operatore: {user.email}</p>
          </form>
        </div>
      </div>
      )}

      {inventoryView === "analytics" && (
        <div className="space-y-5">
          {/* Valore totale */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass rounded-md border border-orange-400/25 bg-orange-500/12 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-200/65">Valore totale stock</p>
              <p className="mt-3 font-mono text-3xl font-black text-orange-200">{formatEuro(analyticsData.totalValue)}</p>
            </div>
            <div className="glass rounded-md border border-white/10 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">Prodotti totali</p>
              <p className="mt-3 font-mono text-3xl font-black text-white">{products.length}</p>
            </div>
            <div className="glass rounded-md border border-red-400/25 bg-red-500/10 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-200/65">Scorte basse (≤3)</p>
              <p className="mt-3 font-mono text-3xl font-black text-red-300">{analyticsData.lowStock.length}</p>
            </div>
          </div>

          {/* Stock per prodotto */}
          <div className="glass rounded-md p-5">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.16em] text-white/45">Stock per prodotto</p>
            <div className="space-y-3">
              {analyticsData.byProduct.map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <p className="w-36 shrink-0 truncate text-sm text-white/70">{p.name}</p>
                  <div className="flex-1 rounded-full bg-white/[0.06]" style={{ height: 8 }}>
                    <div
                      className="rounded-full bg-orange-500 transition-all"
                      style={{ height: 8, width: `${Math.round((p.stock / analyticsData.maxStock) * 100)}%` }}
                    />
                  </div>
                  <p className="w-8 shrink-0 text-right font-mono text-sm font-black text-white">{p.stock}</p>
                </div>
              ))}
              {analyticsData.byProduct.length === 0 && <p className="text-sm text-white/35">Nessun prodotto.</p>}
            </div>
          </div>

          {/* Distribuzione per categoria + Alert scorte basse */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="glass rounded-md p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-white/45">Per categoria</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(analyticsData.byCategory).map(([cat, count]) => {
                  const pct = products.length > 0 ? Math.round((count / products.length) * 100) : 0;
                  return (
                    <div key={cat} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      <span className="text-sm font-bold text-white">{cat}</span>
                      <span className="font-mono text-xs text-orange-300">{pct}%</span>
                    </div>
                  );
                })}
                {Object.keys(analyticsData.byCategory).length === 0 && <p className="text-sm text-white/35">Nessun dato.</p>}
              </div>
            </div>
            <div className="glass rounded-md p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-white/45">Alert scorte basse</p>
              <div className="space-y-2">
                {analyticsData.lowStock.length === 0 && <p className="text-sm text-white/35">Nessun prodotto sotto soglia.</p>}
                {analyticsData.lowStock.map((p) => {
                  const stock = (p.product_variants ?? []).reduce((s, v) => s + Number(v.stock_quantity ?? 0), 0);
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-red-400/20 bg-red-500/[0.06] px-3 py-2">
                      <p className="text-sm text-white/80">{p.name}</p>
                      <span className="font-mono text-sm font-black text-red-300">{stock} rimasti</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// FIX 3: CalendarModule con vista mensile
function CalendarModule({ events, tasks, user, reload, onToast }: { events: CalendarEvent[]; tasks: KanbanTask[]; user: AppUser; reload: () => Promise<void>; onToast: (text: string, kind?: "error" | "success") => void }) {
  const [saving, setSaving] = useState(false);
  const [calView, setCalView] = useState<"month" | "list" | "kanban">("month");
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const [popoverEvent, setPopoverEvent] = useState<CalendarEvent | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied"
  );

  function requestNotifPerm() {
    if (!("Notification" in window)) return;
    void Notification.requestPermission().then((p) => setNotifPerm(p));
  }

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
      <ModuleHeader
        title={calView === "kanban" ? "Task Board" : "Calendario"}
        text={calView === "kanban" ? "Kanban del collettivo — Da Fare, In Corso, Completato." : "Vista eventi condivisa per live, release, interviste e sessioni studio."}
        icon={calView === "kanban" ? ClipboardList : CalendarDays}
      />

      {/* Toggle Mensile / Lista / Task Board */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCalView("month")}
          className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold transition ${calView === "month" ? "bg-orange-500 text-black" : "border border-white/10 bg-white/[0.04] text-white/60 hover:text-white"}`}
        >
          <CalendarDays size={14} />
          Mensile
        </button>
        <button
          onClick={() => setCalView("list")}
          className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold transition ${calView === "list" ? "bg-orange-500 text-black" : "border border-white/10 bg-white/[0.04] text-white/60 hover:text-white"}`}
        >
          <List size={14} />
          Lista
        </button>
        <button
          onClick={() => setCalView("kanban")}
          className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold transition ${calView === "kanban" ? "bg-orange-500 text-black" : "border border-white/10 bg-white/[0.04] text-white/60 hover:text-white"}`}
        >
          <ClipboardList size={14} />
          Task Board
        </button>
        {calView === "kanban" && typeof window !== "undefined" && "Notification" in window && notifPerm !== "denied" && (
          <button
            onClick={notifPerm === "default" ? requestNotifPerm : undefined}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${notifPerm === "granted" ? "cursor-default bg-emerald-500/15 text-emerald-300" : "cursor-pointer bg-orange-500/15 text-orange-300 hover:bg-orange-500/25"}`}
          >
            🔔 {notifPerm === "granted" ? "Notifiche attive" : "Abilita notifiche"}
          </button>
        )}
      </div>

      {calView === "kanban" && (
        <KanbanBoard hideHeader tasks={tasks} user={user} reload={reload} onToast={onToast} />
      )}

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

      {calView !== "kanban" && (
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
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        onClick={() => openGoogleCalendar(event)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs text-white/50 transition hover:border-orange-400/30 hover:text-orange-400"
                        title="Aggiungi a Google Calendar"
                      >
                        <CalendarDays size={13} />
                        + Google Cal
                      </button>
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
      )}

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

// ── NowPlayingBar ─────────────────────────────────────────────

function NowPlayingBar({
  track,
  album,
  allTracks,
  onTrackChange,
  onClose,
}: {
  track: Track;
  album: Album | null;
  allTracks: Track[];
  onTrackChange: (t: Track) => void;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveRef = useRef<number[]>([]);
  const rafRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    let seed = Math.abs(String(track.id).split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));
    const rand = () => { seed = ((seed * 1664525) + 1013904223) | 0; return Math.abs(seed) / 0x7fffffff; };
    waveRef.current = Array.from({ length: 100 }, () => 0.15 + rand() * 0.85);
    const a = audioRef.current;
    if (a && track.audio_file_url) {
      a.pause();
      a.src = track.audio_file_url;
      a.play().catch(() => {});
      setIsPlaying(true);
      setCurTime(0);
      setDur(0);
    }
  }, [track.id]);

  useEffect(() => {
    function frame() {
      const canvas = canvasRef.current;
      const audio = audioRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(frame); return; }
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width, H = canvas.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { rafRef.current = requestAnimationFrame(frame); return; }
      const progress = audio && isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0;
      ctx.clearRect(0, 0, W, H);
      const bars = waveRef.current;
      const bw = 2 * dpr, gap = 1.5 * dpr, step = bw + gap;
      const totalW = bars.length * step;
      const ox = (W - totalW) / 2;
      const px = ox + progress * totalW;
      for (let i = 0; i < bars.length; i++) {
        const x = ox + i * step;
        const bh = bars[i] * H * 0.78;
        const y = (H - bh) / 2;
        ctx.fillStyle = x < px ? "#f97316" : "#2c2c2c";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, 1);
        else ctx.rect(x, y, bw, bh);
        ctx.fill();
      }
      ctx.fillStyle = "#fb923c";
      ctx.fillRect(px - 0.5 * dpr, 0, dpr, H);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [track.id]);

  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      const wrap = canvas?.parentElement;
      if (!canvas || !wrap) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wrap.offsetWidth * dpr;
      canvas.height = wrap.offsetHeight * dpr;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) { a.pause(); setIsPlaying(false); }
    else { a.play().catch(() => {}); setIsPlaying(true); }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !isFinite(a.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
  }

  function fmt(s: number) {
    if (!isFinite(s) || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  const idx = allTracks.findIndex((t) => t.id === track.id);
  function goNext() { if (idx < allTracks.length - 1) onTrackChange(allTracks[idx + 1]); }
  function goPrev() { if (idx > 0) onTrackChange(allTracks[idx - 1]); }

  return (
    <>
      <audio
        ref={audioRef}
        src={track.audio_file_url ?? undefined}
        onTimeUpdate={() => setCurTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDur(audioRef.current?.duration ?? 0)}
        onEnded={goNext}
      />
      <div className="fixed bottom-16 left-0 right-0 z-50 flex h-[72px] items-center gap-3 border-t border-white/8 bg-[#0c0c0c]/96 px-4 backdrop-blur-xl xl:bottom-0">
        {/* Thumbnail */}
        <div className={`relative h-11 w-11 shrink-0 overflow-hidden rounded ${album ? `bg-gradient-to-br ${albumGradient(album.id)}` : "bg-white/10"} flex items-center justify-center`}>
          {album?.cover_image_url ? (
            <Image src={album.cover_image_url} alt="" fill className="object-cover" unoptimized />
          ) : (
            <Music size={16} className="text-white/30" />
          )}
        </div>
        {/* Info */}
        <div className="w-36 min-w-0 shrink-0">
          <p className="truncate text-xs font-bold text-white">{track.nome_traccia}</p>
          {album && <p className="truncate text-[10px] text-white/35">{album.nome_album}</p>}
        </div>
        {/* Center controls + waveform */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex items-center gap-5">
            <button type="button" onClick={goPrev} disabled={idx <= 0} className="text-white/35 transition hover:text-white disabled:opacity-20">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={toggle} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition hover:bg-orange-100">
              {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
            </button>
            <button type="button" onClick={goNext} disabled={idx >= allTracks.length - 1} className="text-white/35 transition hover:text-white disabled:opacity-20">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2">
            <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-white/30">{fmt(curTime)}</span>
            <div onClick={seek} className="relative h-8 flex-1 cursor-pointer overflow-hidden rounded-sm">
              <canvas ref={canvasRef} className="h-full w-full" />
            </div>
            <span className="w-9 shrink-0 font-mono text-[10px] tabular-nums text-white/30">{fmt(dur)}</span>
          </div>
        </div>
        {/* Close */}
        <button type="button" onClick={onClose} className="shrink-0 text-white/25 transition hover:text-white">
          <X size={16} />
        </button>
      </div>
    </>
  );
}

// FIX 4: Projects completamente riscritto con griglia album
function Projects({
  albums, tracks, user, reload, onToast,
  playingTrack, setPlayingTrack, playerAlbumTracks, setPlayerAlbumTracks,
}: {
  albums: Album[];
  tracks: Track[];
  user: AppUser;
  reload: () => Promise<void>;
  onToast: (text: string, kind?: "error" | "success") => void;
  playingTrack: Track | null;
  setPlayingTrack: (t: Track | null) => void;
  playerAlbumTracks: Track[];
  setPlayerAlbumTracks: (t: Track[]) => void;
}) {
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [showTrackForm, setShowTrackForm] = useState(false);
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [uploadingTrack, setUploadingTrack] = useState(false);
  const [albumNameEditing, setAlbumNameEditing] = useState(false);
  const [albumNameDraft, setAlbumNameDraft] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [savingTrackInfo, setSavingTrackInfo] = useState(false);

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
    if (error) { onToast(`Errore aggiornamento fase: ${error.message}`); } else { await reload(); }
  }

  async function renameAlbum() {
    if (!selectedAlbum || !albumNameDraft.trim()) return;
    const { error } = await getSupabase().from("album_progetti").update({ nome_album: albumNameDraft.trim() }).eq("id", selectedAlbum.id);
    if (error) { onToast(`Errore: ${error.message}`); return; }
    setSelectedAlbum({ ...selectedAlbum, nome_album: albumNameDraft.trim() });
    setAlbumNameEditing(false);
    onToast("Album rinominato.", "success");
    await reload();
  }

  async function uploadAlbumCover(file: File) {
    if (!selectedAlbum) return;
    setUploadingCover(true);
    try {
      const supabase = getSupabase();
      const ext = file.name.split(".").pop() ?? "jpg";
      const filePath = `album-covers/${String(selectedAlbum.id)}.${ext}`;
      const { error: storageErr } = await supabase.storage.from("vault").upload(filePath, file, { upsert: true });
      if (storageErr) { onToast(`Errore cover: ${storageErr.message}`); return; }
      const { data: urlData } = supabase.storage.from("vault").getPublicUrl(filePath);
      const cover_image_url = urlData.publicUrl;
      const { error } = await supabase.from("album_progetti").update({ cover_image_url }).eq("id", selectedAlbum.id);
      if (error) { onToast(`Errore: ${error.message}`); return; }
      setSelectedAlbum({ ...selectedAlbum, cover_image_url });
      onToast("Copertina caricata.", "success");
      await reload();
    } finally { setUploadingCover(false); }
  }

  async function updateTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTrack) return;
    setSavingTrackInfo(true);
    try {
      const form = new FormData(event.currentTarget);
      const nome_traccia = String(form.get("nome_traccia") ?? "").trim() || editingTrack.nome_traccia;
      const bpmRaw = Number(form.get("bpm") ?? "");
      const { error } = await getSupabase().from("tracce_audio").update({
        nome_traccia,
        fase: String(form.get("fase") ?? editingTrack.fase),
        bpm: bpmRaw > 0 ? bpmRaw : null,
        tonalita: String(form.get("tonalita") ?? "") || null,
        nota: String(form.get("nota") ?? "") || null,
      }).eq("id", editingTrack.id);
      if (error) { onToast(`Errore: ${error.message}`); return; }
      onToast("Traccia aggiornata.", "success");
      setEditingTrack(null);
      await reload();
    } finally { setSavingTrackInfo(false); }
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
          {/* Cover con upload al click */}
          <label className="group relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-md">
            <div className={`relative h-full w-full bg-gradient-to-br ${albumGradient(selectedAlbum.id)} flex items-center justify-center`}>
              {selectedAlbum.cover_image_url ? (
                <Image src={selectedAlbum.cover_image_url} alt={selectedAlbum.nome_album} fill className="object-cover" unoptimized />
              ) : (
                <Music size={32} className="text-white/40" />
              )}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-md bg-black/70 opacity-0 transition group-hover:opacity-100">
              {uploadingCover ? <Loader2 size={18} className="animate-spin text-white" /> : (
                <>
                  <UploadCloud size={18} className="text-white" />
                  <span className="mt-1 text-[10px] font-bold text-white">Cover</span>
                </>
              )}
            </div>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAlbumCover(f); }} />
          </label>

          <div className="flex-1">
            {albumNameEditing ? (
              <div className="flex items-center gap-2">
                <input
                  value={albumNameDraft}
                  onChange={(e) => setAlbumNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); renameAlbum(); } if (e.key === "Escape") setAlbumNameEditing(false); }}
                  className="field flex-1 rounded-md px-3 py-2 text-lg font-black"
                  autoFocus
                />
                <button type="button" onClick={renameAlbum} className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-orange-500 text-black hover:bg-orange-300">
                  <Save size={15} />
                </button>
                <button type="button" onClick={() => setAlbumNameEditing(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white/50 hover:text-white">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-white">{selectedAlbum.nome_album}</h3>
                <button
                  type="button"
                  onClick={() => { setAlbumNameEditing(true); setAlbumNameDraft(selectedAlbum.nome_album); }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/40 hover:text-white"
                  title="Rinomina album"
                >
                  <Pencil size={13} />
                </button>
              </div>
            )}
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

        {/* Modal modifica traccia */}
        {editingTrack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" onClick={() => setEditingTrack(null)}>
            <form key={String(editingTrack.id)} onSubmit={updateTrack} className="glass w-full max-w-md rounded-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="mb-5 flex items-center justify-between">
                <p className="font-black text-white">Modifica traccia</p>
                <button type="button" onClick={() => setEditingTrack(null)} className="text-white/40 hover:text-white"><X size={18} /></button>
              </div>
              <Input name="nome_traccia" label="Nome traccia" required defaultValue={editingTrack.nome_traccia} />
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Select name="fase" label="Fase" options={[...TRACK_PHASES]} defaultValue={editingTrack.fase ?? "Demo"} />
                <Input name="bpm" label="BPM" type="number" min="40" max="300" defaultValue={editingTrack.bpm ? String(editingTrack.bpm) : ""} />
              </div>
              <Input name="tonalita" label="Tonalità" placeholder="Es. La minore, Do maggiore" defaultValue={editingTrack.tonalita ?? ""} />
              <Textarea name="nota" label="Note" rows={3} defaultValue={editingTrack.nota ?? ""} />
              <div className="mt-5 flex gap-3">
                <button disabled={savingTrackInfo} className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300 disabled:opacity-60">
                  {savingTrackInfo ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Salva
                </button>
                <button type="button" onClick={() => setEditingTrack(null)} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-3 text-sm font-bold text-white/60 hover:text-white">
                  Annulla
                </button>
              </div>
            </form>
          </div>
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
                    <th className="border-b border-white/10 py-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {albumTracks.map((track, idx) => (
                    <tr key={track.id} className={`border-b border-white/7 transition ${playingTrack?.id === track.id ? "bg-orange-500/5" : ""}`}>
                      <td className="w-10 py-4">
                        {track.audio_file_url ? (
                          <button
                            type="button"
                            onClick={() => { setPlayingTrack(track); setPlayerAlbumTracks(albumTracks); }}
                            className="flex h-7 w-7 items-center justify-center text-white/40 hover:text-orange-300 transition"
                          >
                            {playingTrack?.id === track.id ? (
                              <span className="flex h-4 w-5 items-end gap-[2px]">
                                {[60, 100, 50, 80].map((h, i) => (
                                  <span key={i} className="wave-bar w-[3px] rounded-[1px] bg-orange-400" style={{ height: `${h}%`, animationDelay: `${i * 0.15}s` }} />
                                ))}
                              </span>
                            ) : (
                              <Play size={12} fill="currentColor" />
                            )}
                          </button>
                        ) : (
                          <span className="font-mono text-xs text-white/25">{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-4">
                        <p className={`font-bold ${playingTrack?.id === track.id ? "text-orange-200" : "text-white"}`}>{track.nome_traccia}</p>
                        {(track.bpm || track.tonalita || track.nota) && (
                          <p className="mt-0.5 text-xs text-white/40">
                            {[track.bpm && `${track.bpm} BPM`, track.tonalita, track.nota].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {!track.audio_file_url && (
                          <p className="mt-1 text-xs text-white/25">Audio non caricato</p>
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
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditingTrack(track)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/40 hover:bg-white/8 hover:text-white" title="Modifica">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteTrack(track)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-400/25 text-red-200 hover:bg-red-500/10">
                            <Trash2 size={13} />
                          </button>
                        </div>
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

      {/* Griglia album — solo progetti in lavorazione */}
      {(() => {
        const wipAlbums = albums.filter((a) => !a.stato || a.stato === "in_progress" || a.stato === "upcoming");
        return wipAlbums.length === 0 ? (
        <div className="glass rounded-md p-10 text-center">
          <Music size={36} className="mx-auto mb-4 text-white/20" />
          <p className="text-sm text-white/40">Nessun progetto in lavorazione. Creane uno o sposta una release in "In Lavorazione" da Distrib.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {wipAlbums.map((album) => {
            const count = tracks.filter((t) => t.album_id === album.id).length;
            return (
              <button
                key={album.id}
                onClick={() => setSelectedAlbum(album)}
                className="glass group overflow-hidden rounded-md text-left transition hover:border-orange-400/30"
              >
                <div className={`relative aspect-square bg-gradient-to-br ${albumGradient(album.id)} flex items-center justify-center`}>
                  {album.cover_image_url ? (
                    <Image src={album.cover_image_url} alt={album.nome_album} fill className="object-cover" unoptimized />
                  ) : (
                    <Music size={32} className="text-white/20" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                    <span className="rounded-full bg-black/60 p-2.5">
                      <Play size={16} className="text-white" fill="white" />
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-bold text-white">{album.nome_album}</p>
                  <p className="mt-0.5 text-xs text-white/45">{count} {count === 1 ? "traccia" : "tracce"}</p>
                </div>
              </button>
            );
          })}
        </div>
      );
      })()}

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

// ─── Distrib ─────────────────────────────────────────────────────────────────

type DistribSection = "album" | "single" | "collab" | "wip";

function Distrib({
  albums,
  user,
  reload,
  onToast,
  goTo,
}: {
  albums: Album[];
  user: AppUser;
  reload: () => Promise<void>;
  onToast: (msg: string, kind?: "error" | "success") => void;
  goTo: (view: View) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [activeSection, setActiveSection] = useState<DistribSection>("album");
  const [form, setForm] = useState({
    nome_album: "",
    release_date: "",
    stato: "in_progress",
    tipo_release: "album",
    link_spotify: "",
    link_apple: "",
    link_bandcamp: "",
    spotify_album_id: "",
    spotify_cover_url: "",
  });

  async function autoFillFromSpotify() {
    if (!spotifyUrl.trim()) return;
    setAutoFilling(true);
    try {
      const res = await fetch("/api/spotify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "album", url: spotifyUrl }),
      });
      const data = (await res.json()) as { album?: Partial<typeof form>; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Errore Spotify");
      if (data.album) {
        setForm((prev) => ({
          ...prev,
          nome_album: (data.album!.nome_album as string) ?? prev.nome_album,
          release_date: (data.album!.release_date as string) ?? prev.release_date,
          link_spotify: (data.album!.link_spotify as string) ?? prev.link_spotify,
          spotify_album_id: (data.album!.spotify_album_id as string) ?? prev.spotify_album_id,
          spotify_cover_url: (data.album!.spotify_cover_url as string) ?? prev.spotify_cover_url,
        }));
      }
      onToast("Dati importati da Spotify.", "success");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Errore");
    } finally {
      setAutoFilling(false);
    }
  }

  async function saveRelease(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.nome_album.trim()) { onToast("Il nome è obbligatorio."); return; }
    setSaving(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from("album_progetti").insert({
        creato_da: user.id,
        nome_album: form.nome_album.trim(),
        release_date: form.release_date || null,
        stato: form.stato,
        tipo_release: form.tipo_release,
        link_spotify: form.link_spotify || null,
        link_apple: form.link_apple || null,
        link_bandcamp: form.link_bandcamp || null,
        spotify_album_id: form.spotify_album_id || null,
        cover_image_url: form.spotify_cover_url || null,
      });
      if (error) throw error;

      // Auto-crea evento in calendario se release_date è impostata
      if (form.release_date) {
        await supabase.from("eventi_calendario").insert({
          creato_da: user.id,
          titolo: `Release: ${form.nome_album.trim()}`,
          tipo_evento: "Release",
          data_evento: new Date(form.release_date).toISOString(),
          colore: "#ff6b35",
        });
      }

      onToast("Release aggiunta." + (form.release_date ? " Evento calendario creato." : ""), "success");
      await reload();
      setShowForm(false);
      setSpotifyUrl("");
      setForm({ nome_album: "", release_date: "", stato: "in_progress", tipo_release: "album", link_spotify: "", link_apple: "", link_bandcamp: "", spotify_album_id: "", spotify_cover_url: "" });
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRelease(id: string | number) {
    const { error } = await getSupabase().from("album_progetti").delete().eq("id", id);
    if (error) { onToast(`Errore: ${error.message}`); return; }
    onToast("Release rimossa.", "success");
    await reload();
  }

  async function updateStato(id: string | number, stato: string) {
    const { error } = await getSupabase().from("album_progetti").update({ stato }).eq("id", id);
    if (error) { onToast(`Errore: ${error.message}`); return; }
    await reload();
  }

  function sortByDate(list: Album[]) {
    return [...list].sort((a, b) => {
      if (!a.release_date && !b.release_date) return 0;
      if (!a.release_date) return 1;
      if (!b.release_date) return -1;
      return new Date(b.release_date).getTime() - new Date(a.release_date).getTime();
    });
  }

  const releasedAlbums = albums.filter((a) => a.stato === "released");
  const fullAlbums  = sortByDate(releasedAlbums.filter((a) => !a.tipo_release || a.tipo_release === "album" || a.tipo_release === "ep" || a.tipo_release === "compilation"));
  const singoli     = sortByDate(releasedAlbums.filter((a) => a.tipo_release === "single"));
  const collab      = sortByDate(releasedAlbums.filter((a) => a.tipo_release === "collab"));
  const wip         = sortByDate(albums.filter((a) => a.stato === "in_progress" || a.stato === "upcoming"));

  return (
    <>
      <ModuleHeader title="Distrib" text="Catalogo release del collettivo." icon={Radio} />

      {/* Action buttons */}
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-400"
        >
          <Plus size={16} /> Aggiungi
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="glass mb-6 rounded-md p-5">
          <p className="mb-4 text-sm font-bold text-white">Nuova release</p>

          {/* Spotify auto-fill */}
          <div className="mb-4 flex gap-2">
            <input
              className="field flex-1 rounded-md px-3 py-2 text-sm"
              placeholder="Incolla URL album Spotify per auto-compilare..."
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
            />
            <button
              type="button"
              onClick={autoFillFromSpotify}
              disabled={autoFilling || !spotifyUrl.trim()}
              className="inline-flex items-center gap-2 rounded-md border border-orange-500/50 px-3 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/10 disabled:opacity-40"
            >
              {autoFilling ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Auto-compila
            </button>
          </div>

          <form onSubmit={saveRelease} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <input
                className="field w-full rounded-md px-3 py-2 text-sm"
                placeholder="Nome album / EP / singolo *"
                required
                value={form.nome_album}
                onChange={(e) => setForm((p) => ({ ...p, nome_album: e.target.value }))}
              />
            </div>
            <input
              className="field rounded-md px-3 py-2 text-sm"
              type="date"
              title="Data uscita"
              value={form.release_date}
              onChange={(e) => setForm((p) => ({ ...p, release_date: e.target.value }))}
            />
            <select
              className="field rounded-md px-3 py-2 text-sm"
              value={form.stato}
              onChange={(e) => setForm((p) => ({ ...p, stato: e.target.value }))}
            >
              <option value="in_progress">In Lavorazione</option>
              <option value="upcoming">In Arrivo</option>
              <option value="released">Uscito</option>
            </select>
            <select
              className="field rounded-md px-3 py-2 text-sm"
              value={form.tipo_release}
              onChange={(e) => setForm((p) => ({ ...p, tipo_release: e.target.value }))}
            >
              <option value="album">Album</option>
              <option value="ep">EP</option>
              <option value="single">Singolo</option>
              <option value="compilation">Compilation</option>
              <option value="collab">Collaborazione</option>
            </select>
            <input
              className="field rounded-md px-3 py-2 text-sm"
              placeholder="Link Spotify"
              value={form.link_spotify}
              onChange={(e) => setForm((p) => ({ ...p, link_spotify: e.target.value }))}
            />
            <input
              className="field rounded-md px-3 py-2 text-sm"
              placeholder="Link Apple Music"
              value={form.link_apple}
              onChange={(e) => setForm((p) => ({ ...p, link_apple: e.target.value }))}
            />
            <input
              className="field rounded-md px-3 py-2 text-sm sm:col-span-2"
              placeholder="Link Bandcamp"
              value={form.link_bandcamp}
              onChange={(e) => setForm((p) => ({ ...p, link_bandcamp: e.target.value }))}
            />
            {form.spotify_cover_url && (
              <div className="sm:col-span-2 flex items-center gap-3">
                <Image src={form.spotify_cover_url} alt="" width={56} height={56} className="rounded-md object-cover" />
                <p className="text-xs text-white/50">Cover importata da Spotify</p>
              </div>
            )}
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-400 disabled:opacity-40"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salva
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white"
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab bar + grid */}
      {albums.length === 0 ? (
        <div className="py-20 text-center text-white/30">
          <Radio size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-black">Nessuna release</p>
          <p className="mt-1 text-sm">Aggiungi la prima con il pulsante in alto</p>
        </div>
      ) : (() => {
        const SECTIONS = [
          { key: "wip"    as DistribSection, label: "In Lavorazione", list: wip        },
          { key: "album"  as DistribSection, label: "Album",           list: fullAlbums },
          { key: "single" as DistribSection, label: "Singoli",         list: singoli    },
          { key: "collab" as DistribSection, label: "Presente in",     list: collab     },
        ].filter(({ list }) => list.length > 0);

        const current = SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0];

        return (
          <>
            {/* Tabs */}
            <div className="mb-6 flex gap-1 overflow-x-auto rounded-md border border-white/10 bg-white/[0.035] p-1">
              {SECTIONS.map(({ key, label, list }) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`shrink-0 rounded px-4 py-1.5 text-sm font-semibold transition ${
                    (current?.key ?? SECTIONS[0]?.key) === key
                      ? "bg-orange-500 text-white"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {label}
                  <span className="ml-1.5 text-xs opacity-60">({list.length})</span>
                </button>
              ))}
            </div>

            {/* Grid */}
            {current && current.list.length === 0 ? (
              <p className="py-16 text-center text-sm text-white/30">Nessuna release in questa sezione.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {(current ?? SECTIONS[0])?.list.map((album) => {
                  const cover = album.cover_image_url;
                  const isWip = current?.key === "wip";
                  return (
                    <article key={album.id} className="glass group overflow-hidden rounded-md">
                      <div className="relative aspect-square w-full bg-white/[0.04]">
                        {cover ? (
                          <Image src={cover} alt={album.nome_album} fill className="object-cover" unoptimized />
                        ) : (
                          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${albumGradient(album.id)}`}>
                            <Music size={32} className="text-white/30" />
                          </div>
                        )}
                      </div>

                      <div className="p-3">
                        <p className="truncate text-sm font-bold leading-tight text-white">{album.nome_album}</p>
                        {album.release_date && (
                          <p className="mt-0.5 text-xs text-white/50 truncate">
                            {new Date(album.release_date).toLocaleDateString("it-IT", { year: "numeric", month: "short" })}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {album.link_spotify && (
                            <a href={album.link_spotify} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20">
                              <ExternalLink size={10} /> Spotify
                            </a>
                          )}
                          {album.link_apple && (
                            <a href={album.link_apple} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded border border-pink-500/30 bg-pink-500/10 px-2.5 py-1 text-xs font-semibold text-pink-300 transition hover:bg-pink-500/20">
                              <ExternalLink size={10} /> Apple Music
                            </a>
                          )}
                          {album.link_bandcamp && (
                            <a href={album.link_bandcamp} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/20">
                              <ExternalLink size={10} /> Deezer
                            </a>
                          )}
                          {!album.link_spotify && !album.link_apple && !album.link_bandcamp && (
                            <span className="text-xs text-white/30">Nessun link</span>
                          )}
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          {isWip && (
                            <select
                              value={album.stato ?? "in_progress"}
                              onChange={(e) => updateStato(album.id, e.target.value)}
                              className="flex-1 rounded border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:border-orange-500/60"
                            >
                              <option value="in_progress" className="bg-neutral-900 text-white">In Lavorazione</option>
                              <option value="upcoming" className="bg-neutral-900 text-white">In Arrivo</option>
                              <option value="released" className="bg-neutral-900 text-white">Uscito</option>
                            </select>
                          )}
                          <button
                            onClick={() => goTo("projects")}
                            title="Vedi in Studio Hub"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/10 text-white/30 transition hover:border-orange-500/40 hover:text-orange-300"
                          >
                            <Disc3 size={13} />
                          </button>
                          <button
                            onClick={() => deleteRelease(album.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-400/20 text-red-400/30 transition hover:bg-red-500/10 hover:text-red-300"
                            title="Elimina"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}
    </>
  );
}

// Shared branded HTML wrapper — used by both PrintPreviewModal and PressKit
function buildPressKitHtmlStyled(htmlBody: string, italianDate: string): string {
  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Georgia,'Times New Roman',serif;color:#111;background:#fff}
    .accent-bar{height:6px;background:#f97316}
    .page{max-width:780px;margin:0 auto;padding:48px 60px 60px}
    .hdr{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:28px;border-bottom:1px solid #e5e5e5;margin-bottom:40px}
    .brand-tag{font-size:9px;font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:.38em;text-transform:uppercase;color:#f97316;font-weight:700;margin-bottom:14px}
    .pk-title{font-size:52px;font-weight:900;line-height:.92;letter-spacing:-2px;font-family:'Helvetica Neue',Arial,sans-serif;color:#000}
    .hdr-meta{text-align:right;font-size:11px;font-family:'Helvetica Neue',Arial,sans-serif;color:#bbb;line-height:1.8}
    .content h1{font-size:20px;font-weight:900;font-family:'Helvetica Neue',Arial,sans-serif;border-left:4px solid #f97316;padding-left:14px;margin:38px 0 12px;color:#000;line-height:1.2}
    .content h2{font-size:11px;font-weight:700;font-family:'Helvetica Neue',Arial,sans-serif;text-transform:uppercase;letter-spacing:.15em;color:#f97316;margin:26px 0 8px}
    .content h3{font-size:10px;font-weight:700;font-family:'Helvetica Neue',Arial,sans-serif;text-transform:uppercase;letter-spacing:.12em;color:#888;margin:20px 0 6px}
    .content p{font-size:14px;line-height:1.85;color:#222;margin-bottom:12px}
    .content ul{margin:4px 0 16px 0;list-style:none;padding:0}
    .content li{font-size:14px;line-height:1.75;color:#222;margin-bottom:6px;padding-left:18px;position:relative}
    .content li::before{content:"—";position:absolute;left:0;color:#f97316;font-weight:700}
    .content hr{border:none;border-top:1px solid #e5e5e5;margin:28px 0}
    .content strong{font-weight:700;color:#000}
    .content em{font-style:italic}
    .footer{margin-top:56px;padding-top:16px;border-top:2px solid #f97316;font-size:9px;font-family:'Helvetica Neue',Arial,sans-serif;color:#bbb;display:flex;justify-content:space-between;text-transform:uppercase;letter-spacing:.1em}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:36px 48px}}
  `;
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SUPERFLUIDO — Media Press Kit ${italianDate}</title><style>${css}</style></head><body><div class="accent-bar"></div><div class="page"><div class="hdr"><div><div class="brand-tag">SUPERFLUIDO · Bunker Operating System</div><div class="pk-title">MEDIA<br>PRESS KIT</div></div><div class="hdr-meta"><strong>Roma, ${italianDate}</strong><br>superfluido-bunker.vercel.app<br>@superfluido_official</div></div><div class="content">${htmlBody}</div><div class="footer"><span>SUPERFLUIDO — Hip-Hop Indipendente · Roma 2021</span><span>Generato il ${italianDate}</span></div></div></body></html>`;
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

  function buildPressKitHtml(content: string, italianDate: string): string {
    function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function inline(s: string) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>"); }
    const lines = content.split("\n");
    const chunks: string[] = [];
    const listBuf: string[] = [];
    function flushList() { if (listBuf.length) { chunks.push("<ul>" + listBuf.join("") + "</ul>"); listBuf.length = 0; } }
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith("### ")) { flushList(); chunks.push(`<h3>${inline(t.slice(4))}</h3>`); }
      else if (t.startsWith("## ")) { flushList(); chunks.push(`<h2>${inline(t.slice(3))}</h2>`); }
      else if (t.startsWith("# ")) { flushList(); chunks.push(`<h1>${inline(t.slice(2))}</h1>`); }
      else if (/^[-*] /.test(t)) { listBuf.push(`<li>${inline(t.slice(2))}</li>`); }
      else if (/^\d+\. /.test(t)) { listBuf.push(`<li>${inline(t.replace(/^\d+\. /, ""))}</li>`); }
      else if (t === "---" || t === "***") { flushList(); chunks.push("<hr>"); }
      else if (t === "") { flushList(); }
      else { flushList(); chunks.push(`<p>${inline(t)}</p>`); }
    }
    flushList();
    return buildPressKitHtmlStyled(chunks.join("\n"), italianDate);
  }

  function downloadPdf() {
    const today = new Date();
    const [year, month, day] = today.toISOString().split("T")[0].split("-");
    const italianDate = `${day}/${month}/${year}`;
    const html = buildPressKitHtml(answer, italianDate);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `press-kit-superfluido-${today.toISOString().split("T")[0]}.html`;
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
      const dateTimeStr = today.toISOString().replace("T", "-").slice(0, 16).replace(/:/g, "");
      const [year, month, day] = dateStr.split("-");
      const italianDate = `${day}/${month}/${year}`;
      const filePath = `press-kit/press-kit-${dateTimeStr}.html`;
      const htmlContent = buildPressKitHtml(answer, italianDate);
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const supabase = getSupabase();

      const { error: storageError } = await supabase.storage.from("vault").upload(filePath, blob, { contentType: "text/html", upsert: true });
      if (storageError) { onToast(`Errore upload vault: ${storageError.message}`); return; }

      const { data: urlData } = supabase.storage.from("vault").getPublicUrl(filePath);
      const { error: dbError } = await supabase.from("vault_documenti").insert({
        nome_file: `Press Kit ${italianDate}`,
        cartella: "Press",
        file_url: urlData.publicUrl,
      });
      if (dbError) { onToast(`Errore salvataggio vault: ${dbError.message}`); return; }
      onToast("Press Kit salvato nel Vault.", "success");
    } finally { setSavingToVault(false); }
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
                onClick={downloadPdf}
                className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <Download size={15} />
                Esporta PDF
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const myProfile = profiles.find((p) => p.user_id === user.id);

  function startEdit(profile: ArtistProfile) {
    setEditingId(profile.user_id);
    setEditForm({
      nome_arte:      profile.nome_arte ?? "",
      strumentazione: profile.strumentazione ?? "",
      bio_breve:      profile.bio_breve ?? "",
      email_contatto: profile.email_contatto ?? "",
      link_instagram: profile.link_instagram ?? "",
      link_spotify:   profile.link_spotify ?? "",
    });
  }

  async function saveEdit(targetUserId: string) {
    if (!editForm.nome_arte?.trim()) { onToast("Il nome arte è obbligatorio."); return; }
    setSaving(true);
    try {
      const { error } = await getSupabase().from("profili_artisti").upsert({
        user_id:        targetUserId,
        nome_arte:      editForm.nome_arte.trim(),
        strumentazione: editForm.strumentazione || null,
        bio_breve:      editForm.bio_breve || null,
        email_contatto: editForm.email_contatto || null,
        link_instagram: editForm.link_instagram || null,
        link_spotify:   editForm.link_spotify || null,
      });
      if (error) throw error;
      onToast("Profilo salvato.", "success");
      setEditingId(null);
      await reload();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  async function createMyProfile() {
    setSaving(true);
    try {
      const { error } = await getSupabase().from("profili_artisti").insert({ user_id: user.id, nome_arte: user.email.split("@")[0] });
      if (error) throw error;
      onToast("Profilo creato.", "success");
      await reload();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  const ef = editForm;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <>
      <ModuleHeader title="Profili" text="Anagrafiche artistiche del collettivo." icon={UserRound} />

      {!myProfile && (
        <div className="glass mb-5 flex items-center justify-between rounded-md p-4">
          <p className="text-sm text-white/60">Non hai ancora un profilo artista.</p>
          <button
            onClick={createMyProfile}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-orange-400 disabled:opacity-40"
          >
            <Plus size={14} /> Crea il mio profilo
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {profiles.map((profile) =>
          editingId === profile.user_id ? (
            <article key={profile.user_id} className="glass rounded-md p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-orange-400">Modifica profilo</p>
              <div className="grid gap-3">
                <input
                  className="field rounded-md px-3 py-2 text-sm"
                  placeholder="Nome arte *"
                  value={ef.nome_arte}
                  onChange={set("nome_arte")}
                />
                <input
                  className="field rounded-md px-3 py-2 text-sm"
                  placeholder="Strumentazione / ruolo"
                  value={ef.strumentazione}
                  onChange={set("strumentazione")}
                />
                <input
                  className="field rounded-md px-3 py-2 text-sm"
                  placeholder="Email contatto"
                  type="email"
                  value={ef.email_contatto}
                  onChange={set("email_contatto")}
                />
                <input
                  className="field rounded-md px-3 py-2 text-sm"
                  placeholder="Instagram (URL)"
                  value={ef.link_instagram}
                  onChange={set("link_instagram")}
                />
                <input
                  className="field rounded-md px-3 py-2 text-sm"
                  placeholder="Spotify (URL)"
                  value={ef.link_spotify}
                  onChange={set("link_spotify")}
                />
                <textarea
                  className="field rounded-md px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Bio breve"
                  value={ef.bio_breve}
                  onChange={set("bio_breve")}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(profile.user_id)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-400 disabled:opacity-40"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salva
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-md border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            </article>
          ) : (
            <article key={profile.user_id} className="glass rounded-md p-5">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="text-2xl font-black leading-tight text-white">{profile.nome_arte || "Profilo senza nome"}</p>
                <button
                  onClick={() => startEdit(profile)}
                  title="Modifica"
                  className="mt-1 shrink-0 rounded border border-white/10 p-1.5 text-white/30 transition hover:border-orange-500/40 hover:text-orange-300"
                >
                  <Pencil size={13} />
                </button>
              </div>
              <p className="text-sm text-orange-200">{profile.strumentazione || "Setup non indicato"}</p>
              <p className="mt-3 text-sm leading-6 text-white/60">{profile.bio_breve || "Bio non ancora compilata."}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.link_instagram && (
                  <a href={profile.link_instagram} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-white/10 px-2.5 py-1 text-xs text-white/50 transition hover:text-white">
                    <ExternalLink size={10} /> Instagram
                  </a>
                )}
                {profile.link_spotify && (
                  <a href={profile.link_spotify} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 transition hover:bg-emerald-500/20">
                    <ExternalLink size={10} /> Spotify
                  </a>
                )}
                {profile.email_contatto && (
                  <a href={`mailto:${profile.email_contatto}`}
                    className="inline-flex items-center gap-1 rounded border border-white/10 px-2.5 py-1 text-xs text-white/50 transition hover:text-white">
                    {profile.email_contatto}
                  </a>
                )}
              </div>
            </article>
          )
        )}
      </div>
    </>
  );
}

function Vault({ files, folders, user, reload, onToast }: { files: VaultFile[]; folders: VaultFolder[]; user: AppUser; reload: () => Promise<void>; onToast: (text: string, kind?: "error" | "success") => void }) {
  const [vaultView, setVaultView] = useState<"documenti" | "drive">("documenti");
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

      <div className="mb-5 flex items-center gap-2">
        <button
          onClick={() => setVaultView("documenti")}
          className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold transition ${vaultView === "documenti" ? "bg-orange-500 text-black" : "border border-white/10 bg-white/[0.04] text-white/60 hover:text-white"}`}
        >
          <Archive size={14} />
          Documenti
        </button>
        <button
          onClick={() => setVaultView("drive")}
          className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold transition ${vaultView === "drive" ? "bg-orange-500 text-black" : "border border-white/10 bg-white/[0.04] text-white/60 hover:text-white"}`}
        >
          <FolderOpen size={14} />
          Drive
        </button>
      </div>

      {vaultView === "documenti" && <div className="grid gap-5 lg:grid-cols-[180px_1fr_300px]">
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
      }

      {vaultView === "drive" && <DriveSection user={user} onToast={onToast} />}
    </>
  );
}

// ── DriveSection ──────────────────────────────────────────────

function DriveSection({ user, onToast }: { user: AppUser; onToast: (text: string, kind?: "error" | "success") => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string | null; name: string }[]>([{ id: null, name: "Drive" }]);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadItems();
  }, [currentFolderId]);

  async function loadItems() {
    setLoading(true);
    try {
      const res = await fetch("/api/drive/list", { method: "POST", body: JSON.stringify({ folderId: currentFolderId }) });
      const data = (await res.json()) as { items?: any[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load Drive items");
      const sorted = (data.items ?? []).sort((a, b) => {
        if (a.mimeType === "application/vnd.google-apps.folder" && b.mimeType !== "application/vnd.google-apps.folder") return -1;
        if (a.mimeType !== "application/vnd.google-apps.folder" && b.mimeType === "application/vnd.google-apps.folder") return 1;
        return a.name.localeCompare(b.name);
      });
      setItems(sorted);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Errore caricamento Drive");
    } finally {
      setLoading(false);
    }
  }

  function navigate(folderId: string, folderName: string) {
    setSearch(""); // Bug 1 fix: reset search on folder entry
    setCurrentFolderId(folderId);
    setBreadcrumb([...breadcrumb, { id: folderId, name: folderName }]);
  }

  function goBack() {
    if (breadcrumb.length <= 1) return;
    setSearch("");
    const newBreadcrumb = breadcrumb.slice(0, -1);
    setBreadcrumb(newBreadcrumb);
    setCurrentFolderId(newBreadcrumb[newBreadcrumb.length - 1].id);
  }

  function goHome() {
    setSearch("");
    setBreadcrumb([{ id: null, name: "Drive" }]);
    setCurrentFolderId(null);
  }

  async function createFolder(name: string) {
    setCreatingFolder(true);
    try {
      const res = await fetch("/api/drive/create-folder", { method: "POST", body: JSON.stringify({ folderName: name, parentId: currentFolderId }) });
      if (!res.ok) throw new Error("Errore creazione cartella");
      onToast("Cartella creata.", "success");
      setNewFolderName("");
      await loadItems();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Errore creazione cartella");
    } finally {
      setCreatingFolder(false);
    }
  }

  const isFolder = (mimeType: string) => mimeType === "application/vnd.google-apps.folder";
  // Google Workspace native files (Docs, Sheets, Slides, Shortcuts, etc.) cannot be
  // downloaded via alt=media — only binary files can. Show "Open in Drive" instead.
  const isGoogleNative = (mimeType: string) =>
    mimeType.startsWith("application/vnd.google-apps.") && !isFolder(mimeType);
  const displayItems = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="space-y-4">
      {/* Breadcrumb + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-white/50">
          {breadcrumb.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {idx > 0 && <span>/</span>}
              <button onClick={() => (item.id === null ? goHome() : navigate(item.id, item.name))} className="text-white hover:text-orange-300">
                {item.name}
              </button>
            </div>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            className="field w-56 rounded-md py-2 pl-8 pr-3 text-sm"
            placeholder="Cerca file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Create folder form */}
      <div className="glass rounded-md p-4">
        <div className="flex gap-2">
          <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Nome nuova cartella" className="field flex-1 rounded px-3 py-2 text-sm" />
          <button
            onClick={() => newFolderName.trim() && createFolder(newFolderName)}
            disabled={creatingFolder || !newFolderName.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-bold text-black hover:bg-orange-300 disabled:opacity-50"
          >
            <FolderPlus size={14} />
            Crea
          </button>
        </div>
      </div>

      {/* Items list */}
      <div className="glass rounded-md p-5">
        {loading ? (
          <p className="py-10 text-center text-sm text-white/40">Caricamento...</p>
        ) : displayItems.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/40">
            {search.trim() ? `Nessun risultato per "${search}"` : "Cartella vuota"}
          </p>
        ) : (
          <div className="space-y-2">
            {displayItems.map((item) => (
              <div key={item.id} className="glass flex items-center justify-between rounded-md p-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {isFolder(item.mimeType) ? <FolderOpen size={16} className="shrink-0 text-orange-300" /> : <FileAudio size={16} className="shrink-0 text-white/40" />}
                  <button
                    onClick={() => isFolder(item.mimeType) && navigate(item.id, item.name)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-white hover:text-orange-200"
                  >
                    {item.name}
                  </button>
                </div>
                {!isFolder(item.mimeType) && (
                  <div className="ml-2 shrink-0">
                    {isGoogleNative(item.mimeType) ? (
                      <a
                        href={item.webViewLink ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/10 text-white/50 hover:text-orange-300"
                        title="Apri in Drive"
                      >
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <a
                        href={`/api/drive/file/${item.id}?name=${encodeURIComponent(item.name)}`}
                        download={item.name}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/10 text-white/50 hover:text-orange-300"
                        title="Scarica"
                      >
                        <Download size={14} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {breadcrumb.length > 1 && (
        <button onClick={goBack} className="text-sm text-white/50 hover:text-white">
          ← Torna indietro
        </button>
      )}
    </div>
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
  hideHeader,
}: {
  tasks: KanbanTask[];
  user: AppUser;
  reload: () => Promise<void>;
  onToast: (text: string, kind?: "error" | "success") => void;
  hideHeader?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
        assegnato_a: user.id,
      });
      if (error) { onToast(`Errore task: ${error.message}`); return; }
      onToast("Task aggiunto.", "success");
      (event.target as HTMLFormElement).reset();
      setShowForm(false);
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
      {!hideHeader && (
        <ModuleHeader
          title="Task Board"
          text="Kanban del collettivo — Da Fare, In Corso, Completato."
          icon={ClipboardList}
          actions={
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-black transition hover:bg-orange-300"
            >
              <Plus size={15} />
              Nuovo task
            </button>
          }
        />
      )}

      {hideHeader && (
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm text-white/40">Trascina le card per cambiare stato</p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-black text-black transition hover:bg-orange-300"
          >
            <Plus size={15} />
            Nuovo task
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={createTask} className="glass mb-6 rounded-md p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input name="titolo" label="Titolo" placeholder="Es. Mixare Traccia 3" required />
            <Select name="stato" label="Stato iniziale" options={[...KANBAN_STATI]} />
            <Input name="scadenza" label="Scadenza (opzionale)" type="date" />
          </div>
          <div className="mt-4 flex gap-3">
            <ActionButton icon={Plus} text="Aggiungi task" loading={saving} />
            <button type="button" onClick={() => setShowForm(false)} className="mt-5 inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-3 text-sm font-bold text-white/60 hover:text-white">
              Annulla
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {KANBAN_STATI.map((stato) => {
          const col = tasks.filter((t) => t.stato === stato);
          return (
            <div key={stato} className={`flex min-h-[460px] flex-col rounded-md border p-4 ${colColors[stato]}`}>
              <div className="mb-4 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${dotColors[stato]}`} />
                <p className="text-xs font-bold uppercase tracking-widest text-white/55">{stato}</p>
                <span className="ml-auto font-mono text-sm font-black text-white/40">{col.length}</span>
              </div>
              <div className="flex-1 space-y-3">
                {col.length === 0 && (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/10">
                    <ClipboardList size={20} className="text-white/15" />
                    <p className="text-xs text-white/20">Nessun task</p>
                  </div>
                )}
                {col.map((task) => {
                  const stIdx = KANBAN_STATI.indexOf(task.stato as KanbanStato);
                  return (
                    <div key={task.id} className="glass rounded-md p-3">
                      <p className="text-sm font-bold text-white">{task.titolo}</p>
                      {task.descrizione && <p className="mt-1 text-xs leading-5 text-white/50">{task.descrizione}</p>}
                      {task.scadenza && (
                        <p className="mt-1.5 font-mono text-[10px] text-white/35">
                          ⏱ {new Date(task.scadenza).toLocaleDateString("it-IT")}
                        </p>
                      )}
                      {task.assegnato_a && <p className="mt-0.5 truncate text-[10px] text-white/25">{task.assegnato_a}</p>}
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

// ── Audio player custom ──────────────────────────────────────

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  function fmt(s: number) {
    if (!isFinite(s) || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mt-2 flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
          playing ? "bg-orange-500 text-black" : "border border-white/20 text-white/60 hover:border-orange-400/50 hover:text-orange-300"
        }`}
      >
        {playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <div
          onClick={seek}
          className="relative h-1 w-full cursor-pointer rounded-full bg-white/10"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-orange-500"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: `calc(${progress}% - 5px)` }}
          />
        </div>
      </div>
      <p className="shrink-0 font-mono text-[11px] tabular-nums text-white/35">
        {fmt(currentTime)} / {fmt(duration)}
      </p>
    </div>
  );
}

// ── Componenti UI condivisi ──────────────────────────────────

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, className, ...inputProps } = props;
  return (
    <label className="mt-4 block">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{label}</span>
      <input className={`field mt-2 rounded-md px-3 py-2.5 text-base sm:text-sm ${className ?? ""}`} {...inputProps} />
    </label>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const { label, className, ...textareaProps } = props;
  return (
    <label className="mt-4 block">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{label}</span>
      <textarea className={`field mt-2 min-h-28 rounded-md px-3 py-2.5 text-base sm:text-sm ${className ?? ""}`} {...textareaProps} />
    </label>
  );
}

function Select({ label, name, options, defaultValue }: { label: string; name: string; options: readonly string[] | string[]; defaultValue?: string }) {
  return (
    <label className="mt-4 block">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{label}</span>
      <select name={name} defaultValue={defaultValue} className="field mt-2 rounded-md px-3 py-2.5 text-base sm:text-sm">
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

// ── Markdown renderer for AI chat bubbles ────────────────────
function renderMsgMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
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

function openGoogleCalendar(event: CalendarEvent) {
  const dt = new Date(event.data_evento);
  const dtEnd = new Date(dt.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.titolo ?? "",
    dates: `${fmt(dt)}/${fmt(dtEnd)}`,
    ...(event.luogo ? { location: event.luogo } : {}),
    ...(event.tipo_evento ? { details: event.tipo_evento } : {}),
  });
  const webUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    // Intent URL opens Google Calendar app directly on Android, falls back to browser
    window.location.href = `intent://calendar.google.com/calendar/render?${params.toString()}#Intent;scheme=https;package=com.google.android.calendar;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
  } else {
    window.open(webUrl, "_blank");
  }
}
