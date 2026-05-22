"use client";
import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { Loader2, ChevronRight } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();

    // Subscribe first to catch the event if it fires after mount
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { setReady(true); return; }
      // INITIAL_SESSION fires immediately on subscribe if a session already exists
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session) setReady(true);
    });

    // Fallback: detectSessionInUrl may have set the session before this listener registered
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 6) { setMessage("Minimo 6 caratteri."); return; }
    if (password !== confirm) { setMessage("Le password non coincidono."); return; }
    setLoading(true);
    setMessage(null);
    const { error } = await getSupabase().auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      setSuccess(true);
      setMessage("Password aggiornata! Reindirizzamento...");
      setTimeout(() => { window.location.href = "/"; }, 1500);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10" style={{ background: "#09090b" }}>
      <div className="fixed inset-0 -z-10 opacity-45">
        <Image src="/assets/background_main.png" alt="" fill priority className="object-cover" />
      </div>
      <div className="glass w-full max-w-md rounded-md p-7">
        <div className="mx-auto mb-8 h-28 w-52">
          <Image src="/assets/logo_login.png" alt="SUPERFLUIDO" width={420} height={220} className="h-full w-full object-contain" priority />
        </div>
        <h1 className="text-center text-2xl font-black tracking-tight text-white">Nuova Password</h1>
        <p className="mt-2 text-center text-sm text-white/55">
          {ready ? "Scegli una nuova password per il tuo account." : "Verifica del link in corso..."}
        </p>

        {message && (
          <p className={`mt-4 rounded-md px-4 py-3 text-sm font-semibold ${success ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            {message}
          </p>
        )}

        {ready && !success && (
          <form onSubmit={handleSubmit}>
            <label className="mt-6 block text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              Nuova password
            </label>
            <input
              className="field mt-2 w-full rounded-md px-4 py-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Minimo 6 caratteri"
              required
            />
            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              Conferma password
            </label>
            <input
              className="field mt-2 w-full rounded-md px-4 py-3"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              placeholder="Ripeti la password"
              required
            />
            <button
              disabled={loading}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
              Imposta nuova password
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
