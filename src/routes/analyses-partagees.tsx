// analyses-partagees.tsx — les analyses qu'on a partagées avec moi.
// Je peux les lire et proposer un levier, une option, un critère ou une
// réserve. Je ne modifie jamais le dossier de l'autre : le propriétaire
// tranche, et je suis averti de sa réponse.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send, Inbox } from "lucide-react";
import { analysesPartagees, proposer } from "@/lib/partage/partage.functions";
import { NotificationsPartage } from "@/components/aura/NotificationsPartage";

export const Route = createFileRoute("/analyses-partagees")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Analyses partagées avec moi — Aura" },
      { name: "description", content: "Les analyses de décision qu'on a partagées avec vous : les lire et proposer un levier, une option, un critère ou une réserve, que le propriétaire tranche." },
      { property: "og:title", content: "Analyses partagées avec moi — Aura" },
      { property: "og:description", content: "Lire une analyse partagée et y déposer une proposition : le propriétaire accepte ou refuse avec un motif." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Analyse = { id: string; titre: string; contenu: Record<string, unknown>; updated_at: string };

function Page() {
  const lister = useServerFn(analysesPartagees);
  const envoyer = useServerFn(proposer);
  const [liste, setListe] = useState<Analyse[]>([]);
  const [etat, setEtat] = useState<"charge" | "prete" | "hors">("charge");
  const [cible, setCible] = useState<string | null>(null);
  const [type, setType] = useState<"levier" | "option" | "critere" | "reserve">("levier");
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");
  const [nom, setNom] = useState("");
  const [envoye, setEnvoye] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await lister({});
        setListe((r.analyses ?? []) as Analyse[]);
        setEtat("prete");
      } catch {
        setEtat("hors");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deposer(analyseId: string) {
    if (!label.trim()) return;
    await envoyer({ data: { analyseId, type, label, detail, auteurNom: nom } });
    setLabel(""); setDetail(""); setCible(null); setEnvoye(analyseId);
  }

  return (
    <div className="min-h-screen bg-white text-[#18162d]">
      <header className="h-14 flex items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-3">
          <Link to="/cockpit/home" className="text-muted-foreground hover:text-foreground transition" title="Revenir à Aura">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-[15px] font-semibold">Partagées avec moi</span>
        </div>
        <NotificationsPartage />
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-9">
        <h1 className="text-2xl font-semibold tracking-tight">Analyses partagées avec moi</h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground max-w-xl">
          Vous pouvez proposer un levier, une option, un critère ou une réserve. Le propriétaire de l'analyse
          l'accepte ou l'écarte avec un motif, et vous en êtes averti.
        </p>

        {etat === "hors" && (
          <p className="mt-6 rounded-xl border border-[#e8e3f7] bg-[#f8f6ff] p-4 text-[13px]">
            Le travail à plusieurs demande un compte. <Link to="/auth" className="text-primary hover:underline">Se connecter</Link>.
          </p>
        )}

        {etat === "prete" && liste.length === 0 && (
          <p className="mt-6 flex items-center gap-2 text-[13px] text-muted-foreground">
            <Inbox className="h-4 w-4" /> Personne ne vous a encore donné accès à une analyse.
          </p>
        )}

        <div className="mt-6 space-y-3">
          {liste.map((a) => {
            const objet = typeof a.contenu?.objet === "string" ? (a.contenu.objet as string) : "";
            return (
              <div key={a.id} className="rounded-2xl border border-[#e8e3f7] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[15px] font-semibold tracking-tight">{a.titre || "Analyse sans titre"}</h2>
                  <span className="text-[13px] text-muted-foreground">
                    mise à jour le {new Date(a.updated_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                {objet && <p className="mt-1.5 text-[13px] text-muted-foreground">{objet}</p>}

                {envoye === a.id && <p className="mt-3 text-[13.5px] text-primary">Proposition transmise.</p>}

                {cible === a.id ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={type}
                        onChange={(e) => setType(e.currentTarget.value as typeof type)}
                        className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-[13.5px]"
                      >
                        <option value="levier">un levier</option>
                        <option value="option">une option</option>
                        <option value="critere">un critère</option>
                        <option value="reserve">une réserve</option>
                      </select>
                      <input
                        value={label}
                        onChange={(e) => setLabel(e.currentTarget.value)}
                        placeholder="en une ligne"
                        className="min-w-[200px] flex-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-primary"
                      />
                      <input
                        value={nom}
                        onChange={(e) => setNom(e.currentTarget.value)}
                        placeholder="votre nom"
                        className="w-32 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-[13.5px] outline-none focus:border-primary"
                      />
                    </div>
                    <textarea
                      value={detail}
                      onChange={(e) => setDetail(e.currentTarget.value)}
                      rows={2}
                      placeholder="pourquoi cela compte, dans vos mots"
                      className="w-full resize-none rounded-lg border border-border bg-transparent px-2.5 py-2 text-[13.5px] outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void deposer(a.id)}
                        disabled={!label.trim()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13.5px] font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition"
                      >
                        <Send className="h-3.5 w-3.5" /> Proposer
                      </button>
                      <button
                        onClick={() => setCible(null)}
                        className="text-[13px] text-muted-foreground hover:text-foreground transition"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setCible(a.id); setEnvoye(null); }}
                    className="mt-3 rounded-lg border border-[#ded7f6] bg-[#f7f5ff] px-3 py-1.5 text-[13px] font-semibold text-[#5a3dd1]"
                  >
                    Déposer une proposition
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
