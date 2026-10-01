// cockpit.cas-references.tsx — bibliothèque de cas de référence Aura.
// Quatre terrains, huit cas. Pour chacun : l'As-Is (ce qui existe et ce qui
// coince), la cible, la trajectoire par vagues, les critères, les leviers.
// Lecture seule : c'est le socle doctrinal, pas une session de travail.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  CASE_SECTORS, REFERENCE_CASES, casesForSector, AS_IS_STYLE,
  type CaseSectorId, type ReferenceCase,
} from "../lib/v4/sector-cases";
import { PageHeader, PageBody } from "../components/aura/AuraUI";

export const Route = createFileRoute("/cockpit/cas-references")({
  component: CasReferencesPage,
  head: () => ({
    meta: [
      { title: "Cas de référence Aura — Retail, Utilities, Santé, DSI" },
      { name: "description", content: "Huit cas d'arbitrage récurrents et massifs, avec As-Is, cible, trajectoire et vocabulaire de critères réutilisable." },
      { property: "og:title", content: "Cas de référence Aura" },
      { property: "og:description", content: "Retail, Utilities, Santé, DSI d'ETI : As-Is, cible, trajectoire et critères." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const card: React.CSSProperties = {
  border: "1px solid var(--v4-border)", borderRadius: 8,
  background: "var(--v4-surface)", padding: "18px 20px",
};
const label: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, letterSpacing: ".08em",
  textTransform: "uppercase", color: "var(--v4-text3)",
};

type Layer = "asis" | "cible" | "trajectoire" | "modele";

function CasReferencesPage() {
  const [sector, setSector] = useState<CaseSectorId>("retail");
  const [openId, setOpenId] = useState<string>(REFERENCE_CASES[0].id);
  const [layer, setLayer] = useState<Layer>("asis");

  const sec = CASE_SECTORS.find(s => s.id === sector)!;
  const cases = casesForSector(sector);
  const open = cases.find(c => c.id === openId) ?? cases[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <PageHeader
        title="Cas de référence"
        badge="Doctrine"
        subtitle="Là où la décision est complexe, récurrente et massive. Retail et Utilities en priorité : deux références suffisent à constituer un vocabulaire de critères réutilisable."
      />
      <PageBody width={1080}>
        {/* Terrains */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CASE_SECTORS.map(s => (
            <button key={s.id}
              onClick={() => { setSector(s.id); setOpenId(casesForSector(s.id)[0].id); setLayer("asis"); }}
              style={{
                padding: "8px 16px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 700,
                border: sector === s.id ? "1px solid var(--v4-accent)" : "1px solid var(--v4-border)",
                background: sector === s.id ? "var(--v4-accent)" : "transparent",
                color: sector === s.id ? "#fff" : "var(--v4-text2)",
              }}>
              {s.label}
              {s.priority === "prioritaire" && <span style={{ marginLeft: 6, opacity: .8 }}>★</span>}
            </button>
          ))}
        </div>

        {/* Thèse du terrain */}
        <div style={{ ...card, borderLeft: `3px solid var(--v4-accent)` }}>
          <div style={label}>Pourquoi ce terrain</div>
          <div style={{ fontSize: 13.5, color: "var(--v4-text)", lineHeight: 1.55, marginTop: 12 }}>{sec.these}</div>
          <div style={{ display: "flex", gap: 26, flexWrap: "wrap", marginTop: 12 }}>
            <Meta k="Acheteur" v={sec.acheteur} />
            <Meta k="Fréquence" v={sec.frequence} />
            <Meta k="Priorité" v={sec.priority === "prioritaire" ? "Terrain prioritaire" : "Terrain secondaire"} />
          </div>
        </div>

        {/* Vocabulaire réutilisable */}
        <div style={card}>
          <div style={label}>Vocabulaire de critères — réutilisable d'un client à l'autre</div>
          <div style={{ marginTop: 10 }}>
            {sec.vocabulaire.map(v => (
              <div key={v.label} style={{ display: "flex", gap: 12, padding: "8px 0", borderTop: "1px solid var(--v4-border)" }}>
                <div style={{ width: 210, flexShrink: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v4-text)" }}>{v.label}</div>
                  <div style={{ fontSize: 12.5, color: "var(--v4-text3)", marginTop: 1 }}>{v.importance}</div>
                </div>
                <div style={{ flex: 1, fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.5 }}>{v.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cas du terrain */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cases.map(c => (
            <button key={c.id} onClick={() => { setOpenId(c.id); setLayer("asis"); }}
              style={{
                textAlign: "left", padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                border: open?.id === c.id ? "1.5px solid var(--v4-accent)" : "1px solid var(--v4-border)",
                background: open?.id === c.id ? "var(--v4-accent-bg)" : "var(--v4-surface)",
                maxWidth: 320,
              }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v4-text)" }}>{c.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--v4-text3)", marginTop: 2 }}>{c.recurrence}</div>
            </button>
          ))}
        </div>

        {open && <CaseDetail c={open} layer={layer} onLayer={setLayer} />}
      </PageBody>
    </div>
  );
}

function CaseDetail({ c, layer, onLayer }: { c: ReferenceCase; layer: Layer; onLayer: (l: Layer) => void }) {
  const layers: { key: Layer; label: string }[] = [
    { key: "asis", label: "As-Is" },
    { key: "cible", label: "Cible" },
    { key: "trajectoire", label: "Trajectoire" },
    { key: "modele", label: "Critères & leviers" },
  ];
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--v4-border)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--aura-t2)", fontWeight: 600, color: "var(--v4-text)" }}>{c.title}</div>
        <div style={{ fontSize: 13.5, color: "var(--v4-text2)", marginTop: 5, lineHeight: 1.5 }}>{c.question}</div>
        <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 8, lineHeight: 1.5 }}>
          <strong style={{ color: "var(--v4-text2)" }}>Ce qui rend la décision difficile :</strong> {c.difficulte}
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "10px 16px", borderBottom: "1px solid var(--v4-border)", background: "var(--v4-bg)", flexWrap: "wrap" }}>
        {layers.map(l => (
          <button key={l.key} onClick={() => onLayer(l.key)}
            style={{
              padding: "5px 13px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
              fontSize: 13, fontWeight: 700, border: "none",
              background: layer === l.key ? "var(--v4-accent)" : "transparent",
              color: layer === l.key ? "#fff" : "var(--v4-text2)",
            }}>{l.label}</button>
        ))}
      </div>

      <div style={{ padding: "16px 20px 20px" }}>
        {layer === "asis" && (
          <div>
            <div style={{ ...label, marginBottom: 10 }}>Situation actuelle — ce qui existe, et ce qui coince</div>
            {c.asIs.map(a => {
              const st = AS_IS_STYLE[a.etat];
              return (
                <div key={a.label} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: "1px solid var(--v4-border)", alignItems: "flex-start" }}>
                  <span style={{
                    flexShrink: 0, minWidth: 92, textAlign: "center", padding: "3px 9px", borderRadius: 999,
                    fontSize: 12, fontWeight: 800, color: st.color, background: st.bg,
                  }}>{st.label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v4-text)" }}>{a.label}</div>
                    <div style={{ fontSize: 13, color: "var(--v4-text2)", marginTop: 2, lineHeight: 1.5 }}>{a.constat}</div>
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 12.5, color: "var(--v4-text3)", marginTop: 12, fontStyle: "italic" }}>
              L'As-Is est qualitatif par construction : aucun chiffre n'est produit tant qu'il n'est pas mesuré chez le client.
            </div>
          </div>
        )}

        {layer === "cible" && (
          <div>
            <div style={{ ...label, marginBottom: 10 }}>Cible — l'état visé, exprimé en décisions tenables</div>
            {c.cible.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: "1px solid var(--v4-border)" }}>
                <span style={{ color: "var(--v4-accent)", fontWeight: 800, fontSize: 13 }}>{i + 1}</span>
                <div style={{ fontSize: 13.5, color: "var(--v4-text)", lineHeight: 1.55 }}>{t}</div>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: "var(--v4-accent-bg)" }}>
              <div style={label}>Livrable</div>
              <div style={{ fontSize: 13.5, color: "var(--v4-text)", marginTop: 4 }}>{c.livrable}</div>
            </div>
          </div>
        )}

        {layer === "trajectoire" && (
          <div>
            <div style={{ ...label, marginBottom: 12 }}>Trajectoire As-Is → cible, par vagues</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {c.trajectoire.map((t, i) => (
                <div key={t.vague} style={{
                  flex: "1 1 200px", minWidth: 200, padding: "14px 16px", borderRadius: 8,
                  border: "1px solid var(--v4-border)", background: "var(--v4-bg)",
                  borderTop: `3px solid ${["#6C5CE7", "#0369a1", "#059669"][i] ?? "#6C5CE7"}`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)" }}>{t.vague}</div>
                  <div style={{ ...label, marginTop: 2 }}>{t.horizon}</div>
                  <div style={{ fontSize: 13, color: "var(--v4-text2)", marginTop: 8, lineHeight: 1.5 }}>{t.contenu}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {layer === "modele" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ ...label, marginBottom: 8 }}>Critères ({c.criteres.length}) et mesures associées</div>
              {c.criteres.map(cr => (
                <div key={cr.label} style={{ display: "flex", gap: 12, padding: "8px 0", borderTop: "1px solid var(--v4-border)", flexWrap: "wrap" }}>
                  <div style={{ width: 220, flexShrink: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v4-text)" }}>{cr.label}</div>
                    <div style={{ fontSize: 12.5, color: "var(--v4-text3)", marginTop: 1 }}>
                      {cr.importance} · {cr.nature === "efficacite" ? "efficacité" : cr.nature === "cout" ? "coût" : "risque"}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {cr.mops.map(m => (
                      <span key={m} style={{ fontSize: 12.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: "var(--v4-accent-bg)", color: "var(--v4-text2)" }}>{m}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ ...label, marginBottom: 8 }}>Leviers et options</div>
              {c.leviers.map(l => (
                <div key={l.label} style={{ padding: "8px 0", borderTop: "1px solid var(--v4-border)" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v4-text)" }}>{l.label}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                    {l.options.map(o => (
                      <span key={o} style={{ fontSize: 12.5, padding: "2px 9px", borderRadius: 6, border: "1px dashed var(--v4-border)", color: "var(--v4-text2)" }}>{o}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ ...label, marginBottom: 6 }}>Parties prenantes</div>
              <div style={{ fontSize: 13, color: "var(--v4-text2)" }}>{c.partiesPrenantes.join(" · ")}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={label}>{k}</div>
      <div style={{ fontSize: 13, color: "var(--v4-text2)", marginTop: 3 }}>{v}</div>
    </div>
  );
}
