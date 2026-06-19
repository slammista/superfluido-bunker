"use client";
import { useEffect, useRef } from "react";
import { Command } from "cmdk";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Home, Package, CalendarDays, Disc3, Radio, UserRound, FolderOpen,
  Plus, Sparkles, Search,
} from "lucide-react";

type View = "home" | "inventory" | "calendar" | "projects" | "distrib" | "profile" | "vault";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
  onAction: (action: string) => void;
}

const NAV_ITEMS: Array<{ id: View; label: string; icon: typeof Home; description: string }> = [
  { id: "home",      label: "Overview",   icon: Home,        description: "Dashboard principale" },
  { id: "inventory", label: "Magazzino",  icon: Package,     description: "Inventario e merch" },
  { id: "calendar",  label: "Calendario", icon: CalendarDays, description: "Eventi e task" },
  { id: "projects",  label: "Studio Hub", icon: Disc3,       description: "Album e tracce" },
  { id: "distrib",   label: "Distribuzione", icon: Radio,    description: "Release e discografia" },
  { id: "profile",   label: "Profili",    icon: UserRound,   description: "Artisti del roster" },
  { id: "vault",     label: "Vault",      icon: FolderOpen,  description: "Documenti e file" },
];

const ACTIONS = [
  { id: "new-product",  label: "Nuovo prodotto",  icon: Plus,     description: "Aggiungi articolo al magazzino",   view: "inventory" as View },
  { id: "new-event",    label: "Nuovo evento",    icon: Plus,     description: "Crea evento in calendario",       view: "calendar" as View },
  { id: "open-ai",      label: "Apri AI Chat",    icon: Sparkles, description: "Parla con l'assistente AI",       view: "home" as View },
  { id: "new-track",    label: "Nuova traccia",   icon: Plus,     description: "Aggiungi traccia allo studio hub", view: "projects" as View },
];

const GROUP_HEADING_CLS = "[&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-white/35";

export function CommandPalette({ open, onClose, onNavigate, onAction }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  function handleSelect(value: string) {
    const nav = NAV_ITEMS.find((n) => `nav-${n.id}` === value);
    if (nav) { onNavigate(nav.id); onClose(); return; }
    const action = ACTIONS.find((a) => `action-${a.id}` === value);
    if (action) { onNavigate(action.view); onAction(action.id); onClose(); }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, ...(prefersReduced ? {} : { scale: 0.96, y: -8 }) }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, ...(prefersReduced ? {} : { scale: 0.96, y: -8 }) }}
            transition={{ duration: prefersReduced ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[18%] z-[301] w-full max-w-xl -translate-x-1/2 px-4"
          >
            <Command
              aria-label="Command palette"
              className="overflow-hidden rounded-xl border border-white/12 bg-[#111] shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
                <Search size={16} className="shrink-0 text-white/40" />
                <Command.Input
                  ref={inputRef}
                  placeholder="Cerca o esegui un'azione..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
                />
                <kbd className="shrink-0 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-white/30">
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-80 overflow-y-auto p-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-orange-500/40">
                <Command.Empty className="py-8 text-center text-sm text-white/35">
                  Nessun risultato trovato.
                </Command.Empty>

                <Command.Group
                  heading="Naviga"
                  className={GROUP_HEADING_CLS}
                >
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.id}
                        value={`nav-${item.id}`}
                        onSelect={handleSelect}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white aria-selected:bg-orange-500/15 aria-selected:text-white data-[selected=true]:bg-orange-500/15 data-[selected=true]:text-white"
                      >
                        <Icon size={15} className="shrink-0 text-orange-300/70" />
                        <span className="flex-1 font-semibold">{item.label}</span>
                        <span className="text-xs text-white/30">{item.description}</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>

                <Command.Separator className="my-2 h-px bg-white/8" />

                <Command.Group
                  heading="Azioni rapide"
                  className={GROUP_HEADING_CLS}
                >
                  {ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Command.Item
                        key={action.id}
                        value={`action-${action.id}`}
                        onSelect={handleSelect}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white aria-selected:bg-orange-500/15 aria-selected:text-white data-[selected=true]:bg-orange-500/15 data-[selected=true]:text-white"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-orange-400/25 bg-orange-500/10 text-orange-300">
                          <Icon size={12} />
                        </div>
                        <span className="flex-1 font-semibold">{action.label}</span>
                        <span className="text-xs text-white/30">{action.description}</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              </Command.List>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-white/8 px-4 py-2">
                <div className="flex items-center gap-3 text-[10px] text-white/25">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-white/12 bg-white/5 px-1 font-mono">↑↓</kbd> naviga
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-white/12 bg-white/5 px-1 font-mono">↵</kbd> seleziona
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-white/20">
                  <span>SUPERFLUIDO</span>
                  <span className="text-orange-500/50">●</span>
                  <span>Bunker OS</span>
                </div>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
