// NotificationsPartage.tsx — la cloche : ce qui attend une décision de ma part, et
// les réponses reçues sur mes propositions. Aucune relance automatique.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, X } from "lucide-react";
import { mesNotifications, lireNotifications } from "@/lib/partage/partage.functions";

type Notif = { id: string; titre: string; corps: string; lu: boolean; type: string; created_at: string };

export function NotificationsPartage() {
  const lister = useServerFn(mesNotifications);
  const marquer = useServerFn(lireNotifications);
  const [liste, setListe] = useState<Notif[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [dispo, setDispo] = useState(true);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      try {
        const r = await lister({});
        if (vivant) setListe((r.notifications ?? []) as Notif[]);
      } catch {
        if (vivant) setDispo(false);
      }
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  if (!dispo) return null;
  const nonLues = liste.filter((n) => !n.lu).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOuvert((v) => !v)}
        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
          ouvert ? "border-primary text-primary" : "border-foreground/10 text-muted-foreground hover:text-foreground"
        }`}
        title="Ce qui m'attend"
      >
        <Bell className="h-4 w-4" />
        {nonLues > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-primary px-1 text-[12.5px] font-semibold leading-4 text-primary-foreground">
            {nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute right-0 top-10 z-30 w-80 rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="v2-label">Ce qui m'attend</p>
            <button onClick={() => setOuvert(false)} className="text-muted-foreground hover:text-foreground transition" title="Fermer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {liste.length === 0 && <p className="text-[13.5px] text-muted-foreground">Rien à signaler.</p>}
            {liste.map((n) => (
              <div key={n.id} className={`rounded-lg border p-2.5 ${n.lu ? "border-border" : "border-primary/30 v2-tint-1"}`}>
                <p className="text-[13.5px] font-medium">{n.titre}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{n.corps}</p>
              </div>
            ))}
          </div>
          {nonLues > 0 && (
            <button
              onClick={async () => { await marquer({}); setListe((l) => l.map((n) => ({ ...n, lu: true }))); }}
              className="mt-2 w-full rounded-lg border border-border py-1.5 text-[13px] text-muted-foreground hover:text-foreground transition"
            >
              Tout marquer comme lu
            </button>
          )}
        </div>
      )}
    </div>
  );
}
