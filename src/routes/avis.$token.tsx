// Écran public « Donner mon avis » — ouvert par lien, sans compte.
// Une partie prenante lit la fiche (leviers, verdict qualitatif) et dépose
// sa position. Aucun chiffre, aucun vote comptabilisé : une position, et si
// besoin la réserve précise à lever.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSharedCombo, submitSharedAvis } from "@/lib/v4/combos-share.functions";

export const Route = createFileRoute("/avis/$token")({
  head: () => ({
    meta: [
      { title: "Donner mon avis — Aura" },
      { name: "description", content: "Consultez la combinaison décisionnelle et déposez votre position : pour, réserve à lever, ou contre." },
      { property: "og:title", content: "Donner mon avis — Aura" },
      { property: "og:description", content: "Une position, une réserve précise. Pas de vote, pas de score." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AvisPage,
});

const ORD = ["Nul", "Faible", "Modéré", "Élevé"];
const POSITIONS = [
  { id: "pour" as const, label: "Pour", hint: "Je soutiens en l'état" },
  { id: "reserve" as const, label: "Réserve", hint: "Je soutiens si un point est levé" },
  { id: "contre" as const, label: "Contre", hint: "Je m'oppose en l'état" },
];

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
  padding: "22px 24px", boxShadow: "0 1px 2px rgba(16,24,40,.04)",
};

function AvisPage() {
  const { token } = Route.useParams();
  const load = useServerFn(getSharedCombo);
  const send = useServerFn(submitSharedAvis);

  const [state, setState] = useState<{ loading: boolean; found: boolean; combo?: any; avis?: any[] }>({ loading: true, found: false });
  const [form, setForm] = useState({ nom: "", role: "", position: "pour" as "pour" | "reserve" | "contre", reserve: "" });
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load({ data: { token } })
      .then((r: any) => setState({ loading: false, found: r.found, combo: r.combo, avis: r.avis }))
      .catch(() => setState({ loading: false, found: false }));
  }, [token, load]);

  const submit = async () => {
    if (!form.nom.trim() || busy) return;
    setBusy(true);
    try {
      const r: any = await send({ data: {
        token, nom: form.nom, role: form.role.trim() || undefined,
        position: form.position, reserve: form.reserve.trim() || undefined,
      } });
      setDone(r.ok ? "ok" : r.reason === "signee" ? "signee" : "introuvable");
    } catch { setDone("erreur"); }
    setBusy(false);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8f9fc", padding: "48px 20px", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", color: "#111827" }}>AURA</span>
          <span style={{ fontSize: 13, color: "#6b7280" }}>Avis sur une combinaison</span>
        </div>

        {state.loading && <div style={{ ...card, fontSize: 13, color: "#6b7280" }}>Chargement…</div>}

        {!state.loading && !state.found && (
          <div style={{ ...card, fontSize: 13, color: "#6b7280" }}>
            Ce lien n'est plus valide. Demandez un nouveau lien au porteur de la décision.
          </div>
        )}

        {!state.loading && state.found && (
          <>
            <section style={card}>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#111827", letterSpacing: "-.01em" }}>{state.combo.name}</h1>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                {state.combo.sessionTitle} · version {state.combo.version}
              </div>
              <div style={{ display: "flex", gap: 22, marginTop: 14, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: "#6b7280" }}>Potentiel d'amélioration</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#065f46" }}>{ORD[state.combo.verdictInitial?.gPlus ?? 0]}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: "#6b7280" }}>Risque de dégradation</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#92400e" }}>{ORD[state.combo.verdictInitial?.dMinus ?? 0]}</div>
                </div>
              </div>
              {state.combo.leviers?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: "#6b7280", marginBottom: 12 }}>Leviers retenus</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {state.combo.leviers.map((l: any, i: number) => (
                      <div key={i} style={{ fontSize: 13.5, color: "#111827" }}>
                        <span style={{ color: "#6b7280" }}>{l.leverLabel} —</span> <b>{l.optionLabel}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section style={card}>
              {done === "ok" ? (
                <div style={{ fontSize: 14, fontWeight: 700, color: "#065f46" }}>
                  Avis enregistré. Merci — il sera lu tel quel, sans être moyenné.
                </div>
              ) : done === "signee" ? (
                <div style={{ fontSize: 13, color: "#92400e" }}>Cette version est signée : les avis sont clos.</div>
              ) : done ? (
                <div style={{ fontSize: 13, color: "#b91c1c" }}>Enregistrement impossible. Réessayez ou demandez un nouveau lien.</div>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>Votre position</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>
                    Une réserve se lève par un fait, pas par une majorité.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginTop: 14 }}>
                    {POSITIONS.map(p => {
                      const on = form.position === p.id;
                      return (
                        <button key={p.id} onClick={() => setForm({ ...form, position: p.id })}
                          style={{
                            textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                            border: on ? "2px solid #6C5CE7" : "1px solid #e5e7eb",
                            background: on ? "#f5f3ff" : "#fff",
                          }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>{p.label}</div>
                          <div style={{ fontSize: 13, color: "#6b7280" }}>{p.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                    <input placeholder="Votre nom" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })}
                      style={{ flex: 1, minWidth: 180, fontSize: 13, padding: "9px 11px", borderRadius: 8, border: "1px solid #e5e7eb", fontFamily: "inherit" }} />
                    <input placeholder="Votre fonction" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                      style={{ flex: 1, minWidth: 160, fontSize: 13, padding: "9px 11px", borderRadius: 8, border: "1px solid #e5e7eb", fontFamily: "inherit" }} />
                  </div>
                  <textarea placeholder={form.position === "pour" ? "Un point d'attention (optionnel)" : "Ce qu'il faut lever, précisément"}
                    value={form.reserve} onChange={e => setForm({ ...form, reserve: e.target.value })} rows={3}
                    style={{ width: "100%", marginTop: 8, fontSize: 13, padding: "9px 11px", borderRadius: 8, border: "1px solid #e5e7eb", fontFamily: "inherit", resize: "vertical" }} />
                  <button onClick={submit} disabled={!form.nom.trim() || busy}
                    style={{
                      marginTop: 12, padding: "10px 18px", borderRadius: 8, border: "none", cursor: form.nom.trim() ? "pointer" : "default",
                      background: form.nom.trim() ? "#6C5CE7" : "#d1d5db", color: "#fff", fontSize: 13, fontWeight: 800, fontFamily: "inherit",
                    }}>
                    {busy ? "Envoi…" : "Déposer mon avis"}
                  </button>
                </>
              )}
            </section>

            {(state.avis?.length ?? 0) > 0 && (
              <section style={card}>
                <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: "#6b7280", marginBottom: 12 }}>
                  Avis déjà déposés
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {state.avis!.map((a: any) => (
                    <div key={a.id} style={{ fontSize: 13.5, color: "#111827" }}>
                      <b>{a.nom}</b>{a.role ? <span style={{ color: "#6b7280" }}> · {a.role}</span> : null}
                      <span style={{ color: a.position === "contre" ? "#b91c1c" : a.position === "reserve" ? "#b45309" : "#047857", fontWeight: 700 }}>
                        {" "}— {a.position === "pour" ? "Pour" : a.position === "reserve" ? "Réserve" : "Contre"}
                      </span>
                      {a.reserve ? <span style={{ color: "#6b7280" }}> : {a.reserve}</span> : null}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
