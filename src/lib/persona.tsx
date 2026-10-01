import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Persona = "decideur" | "admin_metier";

const LABELS: Record<Persona, { title: string; tagline: string; home: string }> = {
  decideur:     { title: "Décideur", tagline: "Comprendre · Décider · Agir",                home: "/cockpit" },
  admin_metier: { title: "Admin",    tagline: "Sources · Contracts · Mappings · Modèles",   home: "/studio" },
};

type Ctx = {
  active: Persona;
  available: Persona[];
  setActive: (p: Persona) => void;
  label: (p: Persona) => { title: string; tagline: string; home: string };
  ready: boolean;
};

const PersonaCtx = createContext<Ctx | null>(null);
const LS_KEY = "aura.persona";

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState<Persona[]>(["decideur"]);
  const [active, setActiveState] = useState<Persona>("decideur");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadRoles(_userId: string | undefined) {
      const personas: Persona[] = ["decideur", "admin_metier"];
      if (cancelled) return;
      setAvailable(personas);
      const storedRaw = (typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null) as string | null;
      // Migration : si on avait stocké "architecte", on bascule sur "admin_metier"
      const stored = (storedRaw === "architecte" ? "admin_metier" : storedRaw) as Persona | null;
      const initial = stored && personas.includes(stored) ? stored : personas[0];
      setActiveState(initial);
      setReady(true);
    }
    try {
      supabase.auth.getUser().then(({ data }) => loadRoles(data.user?.id)).catch(() => loadRoles(undefined));
      const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        window.setTimeout(() => loadRoles(s?.user.id), 0);
      });
      return () => { cancelled = true; sub.subscription.unsubscribe(); };
    } catch {
      loadRoles(undefined);
    }
  }, []);

  const value = useMemo<Ctx>(() => ({
    active, available, ready,
    setActive: (p) => { setActiveState(p); try { localStorage.setItem(LS_KEY, p); } catch {} },
    label: (p) => LABELS[p],
  }), [active, available, ready]);

  return <PersonaCtx.Provider value={value}>{children}</PersonaCtx.Provider>;
}

export function usePersona() {
  const ctx = useContext(PersonaCtx);
  if (!ctx) {
    return { active: "decideur" as Persona, available: ["decideur" as Persona], setActive: () => {}, label: (p: Persona) => LABELS[p], ready: false };
  }
  return ctx;
}

export const PERSONA_LABELS = LABELS;
