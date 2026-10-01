// CombinaisonsSuivies.tsx — registre des combinaisons nommées, dans Suivi.
// Une carte par combinaison : leviers, verdict ordinal, boucle valeur
// (prévu → constaté), preuves d'ancrage, gouvernance signable.
// Aucun score, aucune moyenne : le verdict reste le couple qualitatif (δ⁺, δ⁻).

import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { publishCombo, pullComboAvis } from "@/lib/v4/combos-share.functions";
import {
  loadCombos, loadCombosForSession, updateCombo, deleteCombo,
  addComment, deleteComment, addSuiviPoint, deleteSuiviPoint, verdictDrift,
  addPreuve, deletePreuve, signCombo, reopenCombo, downloadAudit,
  addAvis, deleteAvis, toggleReserveLevee, consensusState,
  setShareToken, mergeRemoteAvis,
  addConstat, deleteConstat, retexLecture, leconsRegistre,
  STATUT_META, ORD_NAME, PREUVE_META, AVIS_META, TENUE_META,
  type TrackedCombo, type ComboStatut, type OrdLevel, type ComboPreuve, type AvisPosition,
  type TenueLevier,
} from "@/lib/v4/combinaisons-store";

const STATUTS: ComboStatut[] = ["candidate", "retenue", "en_cours", "realisee", "abandonnee"];
const LEVELS: OrdLevel[] = [0, 1, 2, 3];

const btn = (kind: "ghost" | "solid" | "dash") => ({
  fontSize: 12.5, fontWeight: 700 as const, padding: "5px 11px", borderRadius: 8,
  cursor: "pointer", fontFamily: "inherit",
  border: kind === "solid" ? "none" : kind === "dash" ? "1px dashed var(--v4-accent)" : "1px solid var(--v4-border)",
  background: kind === "solid" ? "var(--v4-accent)" : "transparent",
  color: kind === "solid" ? "#fff" : kind === "dash" ? "var(--v4-accent)" : "var(--v4-text3)",
});

const field = { fontSize: 13, padding: "5px 8px", borderRadius: 8, border: "1px solid var(--v4-border)", fontFamily: "inherit" as const, background: "var(--v4-surface)" };

/** Jauge ordinale : 4 crans, remplis jusqu'au niveau. Lecture immédiate, sans chiffre. */
function Gauge({ level, tone }: { level: OrdLevel; tone: "plus" | "minus" }) {
  const full = tone === "plus" ? "#10b981" : "#f59e0b";
  return (
    <span style={{ display: "inline-flex", gap: 2, verticalAlign: "middle" }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{ width: 12, height: 7, borderRadius: 6, background: level >= i ? full : "var(--v4-border)" }} />
      ))}
    </span>
  );
}

function VerdictRow({ gPlus, dMinus, compact }: { gPlus: OrdLevel; dMinus: OrdLevel; compact?: boolean }) {
  return (
    <span style={{ display: "inline-flex", gap: compact ? 12.5 : 14, alignItems: "center", fontSize: 12.5, color: "var(--v4-text3)" }}>
      <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
        <Gauge level={gPlus} tone="plus" />
        <b style={{ color: "var(--v4-text)" }}>{ORD_NAME[gPlus]}</b> potentiel
      </span>
      <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
        <Gauge level={dMinus} tone="minus" />
        <b style={{ color: "var(--v4-text)" }}>{ORD_NAME[dMinus]}</b> risque
      </span>
    </span>
  );
}

/** Boucle valeur : prévu → constaté, en clair. Le retour d'expérience prime sur le simple relevé. */
function BoucleValeur({ combo }: { combo: TrackedCombo }) {
  const retex = retexLecture(combo);
  const drift = verdictDrift(combo);
  const last = retex ? retex.constat.verdict : drift?.last;
  const dG = retex ? retex.dGPlus : drift?.gPlus ?? 0;
  const dM = retex ? retex.dDMinus : drift?.dMinus ?? 0;
  const same = !last || (dG === 0 && dM === 0);
  const tone = retex ? retex.tone : same ? "#6b7280" : (dG >= 0 && dM <= 0) ? "#065f46" : "#b45309";
  const verdictTexte = retex
    ? retex.label
    : same
      ? "Constaté conforme au prévu"
      : `${dG > 0 ? "Potentiel meilleur" : dG < 0 ? "Potentiel en retrait" : "Potentiel tenu"} · ${dM > 0 ? "risque plus élevé" : dM < 0 ? "risque contenu" : "risque tenu"}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "8px 10px", borderRadius: 8, background: "var(--v4-accent-bg)", marginTop: 9 }}>
      <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--v4-text3)" }}>Prévu</span>
      <VerdictRow gPlus={combo.verdictInitial.gPlus} dMinus={combo.verdictInitial.dMinus} compact />
      <span style={{ color: "var(--v4-text3)" }}>→</span>
      <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--v4-text3)" }}>Constaté</span>
      {last ? <VerdictRow gPlus={last.gPlus} dMinus={last.dMinus} compact />
            : <span style={{ fontSize: 12.5, fontStyle: "italic", color: "var(--v4-text3)" }}>pas encore relevé</span>}
      <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: tone }}>{verdictTexte}</span>
    </div>
  );
}

type Tab = "evolution" | "retex" | "avis" | "preuves" | "gouvernance";
const TABS: { id: Tab; label: string }[] = [
  { id: "evolution", label: "Évolution" },
  { id: "retex", label: "Prévu / constaté" },
  { id: "avis", label: "Parties prenantes" },
  { id: "preuves", label: "Preuves" },
  { id: "gouvernance", label: "Gouvernance" },
];

const POSITIONS: AvisPosition[] = ["pour", "reserve", "contre"];
const TENUES: TenueLevier[] = ["tenu", "partiel", "non_tenu", "abandonne"];

/** Écart ordinal signé, en clair : « + 1 cran », « − 2 crans », « conforme ». */
function EcartChip({ d, tone }: { d: number; tone: "plus" | "minus" }) {
  const good = tone === "plus" ? d >= 0 : d <= 0;
  const color = d === 0 ? "#4b5563" : good ? "#065f46" : "#b91c1c";
  const bg = d === 0 ? "#f3f4f6" : good ? "#d1fae5" : "#fee2e2";
  return (
    <span style={{ fontSize: 12, fontWeight: 800, padding: "1px 7px", borderRadius: 8, background: bg, color }}>
      {d === 0 ? "conforme" : `${d > 0 ? "+" : "−"}${Math.abs(d)} cran${Math.abs(d) > 1 ? "s" : ""}`}
    </span>
  );
}

/** Onglet Prévu / constaté : la boucle d'apprentissage de la décision signée. */
function RetexTab({ combo, onChange }: { combo: TrackedCombo; onChange: () => void }) {
  const constats = combo.constats ?? [];
  const [open, setOpen] = useState(constats.length === 0);
  const [form, setForm] = useState<{
    date: string; gPlus: OrdLevel; dMinus: OrdLevel;
    tenue: Record<string, TenueLevier>; cause: string; lecon: string;
  }>({
    date: new Date().toISOString().slice(0, 10),
    gPlus: combo.verdictInitial.gPlus,
    dMinus: combo.verdictInitial.dMinus,
    tenue: Object.fromEntries(combo.leviers.map(l => [l.leverId, "tenu" as TenueLevier])),
    cause: "", lecon: "",
  });

  const submit = () => {
    addConstat(combo.id, {
      date: form.date,
      verdict: { gPlus: form.gPlus, dMinus: form.dMinus },
      leviers: combo.leviers.map(l => ({ leverId: l.leverId, tenue: form.tenue[l.leverId] ?? "tenu" })),
      cause: form.cause.trim() || undefined,
      lecon: form.lecon.trim() || undefined,
    });
    setForm({ ...form, cause: "", lecon: "" });
    setOpen(false);
    onChange();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12.5, color: "var(--v4-text3)" }}>
        Le prévu est gelé à la signature. Le constaté s'ajoute par-dessus, sans le réécrire.
      </div>

      {constats.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--v4-text3)", fontStyle: "italic" }}>Aucun constaté relevé.</div>
      )}

      {[...constats].reverse().map(cs => {
        const dG = cs.verdict.gPlus - combo.verdictInitial.gPlus;
        const dM = cs.verdict.dMinus - combo.verdictInitial.dMinus;
        return (
          <div key={cs.id} style={{ border: "1px solid var(--v4-border)", borderRadius: 8, padding: "9px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)" }}>{cs.date}</span>
              <VerdictRow gPlus={cs.verdict.gPlus} dMinus={cs.verdict.dMinus} compact />
              <span style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 12, color: "var(--v4-text3)" }}>
                potentiel <EcartChip d={dG} tone="plus" /> · risque <EcartChip d={dM} tone="minus" />
              </span>
              <button onClick={() => { deleteConstat(combo.id, cs.id); onChange(); }}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13 }}>×</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
              {cs.leviers.map(l => {
                const lev = combo.leviers.find(x => x.leverId === l.leverId);
                const m = TENUE_META[l.tenue];
                return (
                  <span key={l.leverId} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, background: m.bg, color: m.color, fontWeight: 700 }}>
                    {lev?.leverLabel ?? l.leverId} : {m.label}
                  </span>
                );
              })}
            </div>
            {cs.cause && <div style={{ fontSize: 13, marginTop: 7, color: "var(--v4-text2)" }}><b>Cause de l'écart :</b> {cs.cause}</div>}
            {cs.lecon && <div style={{ fontSize: 13, marginTop: 4, color: "var(--v4-text2)" }}><b>Leçon :</b> {cs.lecon}</div>}
          </div>
        );
      })}

      {open ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, border: "1px dashed var(--v4-accent)", borderRadius: 8, padding: "10px 11px" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={field} />
            <select value={form.gPlus} onChange={e => setForm({ ...form, gPlus: Number(e.target.value) as OrdLevel })} style={field}>
              {LEVELS.map(v => <option key={v} value={v}>Potentiel constaté : {ORD_NAME[v]}</option>)}
            </select>
            <select value={form.dMinus} onChange={e => setForm({ ...form, dMinus: Number(e.target.value) as OrdLevel })} style={field}>
              {LEVELS.map(v => <option key={v} value={v}>Risque constaté : {ORD_NAME[v]}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {combo.leviers.map(l => (
              <div key={l.leverId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                <span style={{ color: "var(--v4-text3)", minWidth: 130 }}>{l.leverLabel} <b style={{ color: "var(--v4-accent)" }}>{l.optionLabel}</b></span>
                <select value={form.tenue[l.leverId] ?? "tenu"}
                  onChange={e => setForm({ ...form, tenue: { ...form.tenue, [l.leverId]: e.target.value as TenueLevier } })}
                  style={field}>
                  {TENUES.map(t => <option key={t} value={t}>{TENUE_META[t].label}</option>)}
                </select>
              </div>
            ))}
          </div>
          <input placeholder="Cause de l'écart (ce qui l'explique)" value={form.cause}
            onChange={e => setForm({ ...form, cause: e.target.value })} style={field} />
          <input placeholder="Leçon à retenir pour la prochaine décision du même type" value={form.lecon}
            onChange={e => setForm({ ...form, lecon: e.target.value })} style={field} />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={submit} style={btn("solid")}>Consigner le constaté</button>
            {constats.length > 0 && <button onClick={() => setOpen(false)} style={btn("ghost")}>Annuler</button>}
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={btn("dash")}>+ Relever le constaté</button>
      )}
    </div>
  );
}

function ComboCard({ combo, onChange }: { combo: TrackedCombo; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("evolution");
  const [comment, setComment] = useState("");
  const [ptOpen, setPtOpen] = useState(false);
  const [pt, setPt] = useState({
    date: new Date().toISOString().slice(0, 10),
    statut: combo.statut,
    gPlus: combo.verdictInitial.gPlus,
    dMinus: combo.verdictInitial.dMinus,
    note: "",
  });
  const [pr, setPr] = useState<{ kind: ComboPreuve["kind"]; label: string; ref: string }>({ kind: "document", label: "", ref: "" });
  const [sig, setSig] = useState({ nom: "", role: "" });
  const [av, setAv] = useState<{ nom: string; role: string; position: AvisPosition; reserve: string }>({ nom: "", role: "", position: "pour", reserve: "" });
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(combo.name);

  // Partage multi-utilisateurs : publier la fiche, puis récupérer les avis déposés.
  const publish = useServerFn(publishCombo);
  const pull = useServerFn(pullComboAvis);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const shareLink = combo.shareToken && typeof window !== "undefined"
    ? `${window.location.origin}/avis/${combo.shareToken}` : null;

  const doPublish = async () => {
    setShareBusy(true); setShareMsg(null);
    try {
      const r: any = await publish({ data: {
        localId: combo.id, sessionId: combo.sessionId, sessionTitle: combo.sessionTitle,
        name: combo.name, statut: combo.statut, version: combo.version ?? 1,
        leviers: combo.leviers, verdictInitial: combo.verdictInitial as any,
        comments: combo.comments, timeline: combo.timeline, preuves: combo.preuves ?? [],
        signature: combo.signature ?? null,
      } });
      setShareToken(combo.id, r.shareToken);
      const link = `${window.location.origin}/avis/${r.shareToken}`;
      try { await navigator.clipboard.writeText(link); setShareMsg("Lien copié — à envoyer aux parties prenantes."); }
      catch { setShareMsg("Lien prêt."); }
      onChange();
    } catch { setShareMsg("Connexion requise pour partager la fiche."); }
    setShareBusy(false);
  };

  const doPull = async () => {
    setShareBusy(true); setShareMsg(null);
    try {
      const r: any = await pull({ data: { localId: combo.id } });
      const n = mergeRemoteAvis(combo.id, r.avis ?? []);
      setShareMsg(n ? `${n} nouvel${n > 1 ? "s" : ""} avis intégré${n > 1 ? "s" : ""}.` : "Aucun nouvel avis.");
      onChange();
    } catch { setShareMsg("Connexion requise pour relever les avis."); }
    setShareBusy(false);
  };

  const meta = STATUT_META[combo.statut];
  const avis = combo.avis ?? [];
  const cons = consensusState(combo);
  const preuves = combo.preuves ?? [];
  const signed = !!combo.signature;

  return (
    <div style={{ border: `1px solid ${signed ? "#a7f3d0" : "var(--v4-border)"}`, borderRadius: 8, background: "var(--v4-surface)", padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {renaming ? (
          <input
            autoFocus value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={() => { updateCombo(combo.id, { name: nameDraft }); setRenaming(false); onChange(); }}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            style={{ ...field, fontSize: 13, fontWeight: 700, border: "1px solid var(--v4-accent)", flex: 1, minWidth: 160 }} />
        ) : (
          <button onClick={() => setRenaming(true)} title="Renommer"
            style={{ background: "none", border: "none", padding: 0, cursor: "text", fontSize: 13, fontWeight: 800, color: "var(--v4-text)", fontFamily: "inherit", textAlign: "left" }}>
            {combo.name}
          </button>
        )}
        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: "var(--v4-accent-bg)", color: "var(--v4-accent)" }}>v{combo.version ?? 1}</span>
        {signed && (
          <span title={`Signée par ${combo.signature!.signataire}`} style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "#d1fae5", color: "#065f46" }}>
            ✓ Signée
          </span>
        )}
        <span title="Lecture du collectif — aucune moyenne, aucun vote majoritaire"
          style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: cons.bg, color: cons.tone }}>
          {cons.label}
        </span>
        <select
          value={combo.statut} disabled={signed}
          onChange={e => { updateCombo(combo.id, { statut: e.target.value as ComboStatut }); onChange(); }}
          style={{ fontSize: 12.5, fontWeight: 700, padding: "3px 7px", borderRadius: 6, border: `1px solid ${meta.color}40`, background: meta.bg, color: meta.color, fontFamily: "inherit", cursor: signed ? "not-allowed" : "pointer", opacity: signed ? .7 : 1 }}>
          {STATUTS.map(s => <option key={s} value={s}>{STATUT_META[s].label}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button onClick={() => setOpen(o => !o)} style={btn("ghost")}>{open ? "Replier" : "Détail"}</button>
        <button onClick={() => { if (confirm(`Retirer « ${combo.name} » du suivi ?`)) { deleteCombo(combo.id); onChange(); } }}
          title="Retirer du suivi"
          style={{ ...btn("ghost"), color: "#b91c1c", padding: "3px 8px", fontSize: 13 }}>×</button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
        {combo.leviers.map(l => (
          <span key={l.leverId} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, background: "var(--v4-accent-bg)", border: "1px solid var(--v4-border)" }}>
            <span style={{ color: "var(--v4-text3)", fontWeight: 600 }}>{l.leverLabel} : </span>
            <span style={{ color: "var(--v4-accent)", fontWeight: 700 }}>{l.optionLabel}</span>
          </span>
        ))}
      </div>

      <BoucleValeur combo={combo} />

      <div style={{ marginTop: 7, fontSize: 12.5, color: "var(--v4-text3)" }}>
        {combo.sessionTitle} · {combo.timeline.length} relevé{combo.timeline.length > 1 ? "s" : ""} · {preuves.length} preuve{preuves.length > 1 ? "s" : ""} · {avis.length} avis · {combo.comments.length} commentaire{combo.comments.length > 1 ? "s" : ""}
        {preuves.length === 0 && <span style={{ color: "#b45309", fontWeight: 700 }}> · aucune preuve rattachée</span>}
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--v4-border)", marginBottom: 10 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ fontSize: 13, fontWeight: 700, padding: "6px 11px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit",
                  color: tab === t.id ? "var(--v4-accent)" : "var(--v4-text3)",
                  borderBottom: `2px solid ${tab === t.id ? "var(--v4-accent)" : "transparent"}`, marginBottom: -1 }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "evolution" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {combo.timeline.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, borderLeft: `2px solid ${STATUT_META[p.statut].color}`, paddingLeft: 12 }}>
                    <span style={{ fontWeight: 700, color: "var(--v4-text)" }}>{p.date}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 6px", borderRadius: 6, background: STATUT_META[p.statut].bg, color: STATUT_META[p.statut].color }}>{STATUT_META[p.statut].label}</span>
                    {p.verdict && <VerdictRow gPlus={p.verdict.gPlus} dMinus={p.verdict.dMinus} compact />}
                    {p.note && <span style={{ color: "var(--v4-text3)" }}>{p.note}</span>}
                    {!signed && (
                      <button onClick={() => { deleteSuiviPoint(combo.id, p.id); onChange(); }}
                        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13 }}>×</button>
                    )}
                  </div>
                ))}
              </div>
              {signed ? (
                <div style={{ fontSize: 12.5, color: "var(--v4-text3)", fontStyle: "italic" }}>Version signée : ouvrez une nouvelle version pour relever un changement.</div>
              ) : ptOpen ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <input type="date" value={pt.date} onChange={e => setPt({ ...pt, date: e.target.value })} style={field} />
                  <select value={pt.statut} onChange={e => setPt({ ...pt, statut: e.target.value as ComboStatut })} style={field}>
                    {STATUTS.map(s => <option key={s} value={s}>{STATUT_META[s].label}</option>)}
                  </select>
                  <select value={pt.gPlus} onChange={e => setPt({ ...pt, gPlus: Number(e.target.value) as OrdLevel })} style={field}>
                    {LEVELS.map(v => <option key={v} value={v}>Potentiel {ORD_NAME[v]}</option>)}
                  </select>
                  <select value={pt.dMinus} onChange={e => setPt({ ...pt, dMinus: Number(e.target.value) as OrdLevel })} style={field}>
                    {LEVELS.map(v => <option key={v} value={v}>Risque {ORD_NAME[v]}</option>)}
                  </select>
                  <input placeholder="Ce qui a changé…" value={pt.note} onChange={e => setPt({ ...pt, note: e.target.value })} style={{ ...field, flex: 1, minWidth: 160 }} />
                  <button onClick={() => {
                    addSuiviPoint(combo.id, { date: pt.date, statut: pt.statut, verdict: { gPlus: pt.gPlus, dMinus: pt.dMinus }, note: pt.note.trim() || undefined });
                    setPt({ ...pt, note: "" }); setPtOpen(false); onChange();
                  }} style={btn("solid")}>Enregistrer</button>
                  <button onClick={() => setPtOpen(false)} style={btn("ghost")}>Annuler</button>
                </div>
              ) : (
                <button onClick={() => setPtOpen(true)} style={btn("dash")}>+ Relevé du constaté</button>
              )}

              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--v4-text3)", marginBottom: 12 }}>Commentaires</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {combo.comments.length === 0 && <div style={{ fontSize: 13, color: "var(--v4-text3)", fontStyle: "italic" }}>Aucun commentaire.</div>}
                  {combo.comments.map(c => (
                    <div key={c.id} style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "baseline" }}>
                      <span style={{ color: "var(--v4-text3)", fontVariantNumeric: "tabular-nums" }}>{c.date.slice(0, 10)}</span>
                      <span style={{ color: "var(--v4-text)", flex: 1 }}>{c.texte}</span>
                      <button onClick={() => { deleteComment(combo.id, c.id); onChange(); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13 }}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
                  <input value={comment} onChange={e => setComment(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && comment.trim()) { addComment(combo.id, comment); setComment(""); onChange(); } }}
                    placeholder="Ajouter un commentaire…" style={{ ...field, flex: 1 }} />
                  <button onClick={() => { if (comment.trim()) { addComment(combo.id, comment); setComment(""); onChange(); } }} style={btn("solid")}>Ajouter</button>
                </div>
              </div>
            </div>
          )}

          {tab === "retex" && <RetexTab combo={combo} onChange={onChange} />}

          {tab === "avis" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12.5, color: "var(--v4-text3)" }}>
                Chaque position est lue telle quelle. Une réserve se lève par un fait, pas par un vote.
              </div>

              {/* Recueil à distance : un lien, une position par personne. */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: "8px 10px", borderRadius: 8, border: "1px dashed var(--v4-border)" }}>
                <button onClick={doPublish} disabled={shareBusy} style={btn("dash")}>
                  {shareLink ? "↻ Republier la fiche" : "⇗ Partager pour avis"}
                </button>
                {shareLink && (
                  <>
                    <button onClick={doPull} disabled={shareBusy} style={btn("ghost")}>↓ Relever les avis</button>
                    <input readOnly value={shareLink} onFocus={e => e.currentTarget.select()}
                      style={{ ...field, flex: 1, minWidth: 190, color: "var(--v4-text3)" }} />
                  </>
                )}
                {shareMsg && <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--v4-accent)" }}>{shareMsg}</span>}
              </div>
              {avis.length === 0 && <div style={{ fontSize: 13, color: "var(--v4-text3)", fontStyle: "italic" }}>Aucun avis recueilli.</div>}
              {avis.map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, padding: "6px 9px", borderRadius: 8, background: "var(--v4-accent-bg)" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, padding: "1px 7px", borderRadius: 8, background: AVIS_META[a.position].bg, color: AVIS_META[a.position].color }}>
                    {AVIS_META[a.position].icon} {AVIS_META[a.position].label}
                  </span>
                  <span style={{ fontWeight: 700, color: "var(--v4-text)" }}>{a.nom}</span>
                  {a.role && <span style={{ color: "var(--v4-text3)" }}>· {a.role}</span>}
                  {a.reserve && (
                    <span style={{ color: a.levee ? "#047857" : "#b45309", fontWeight: 600, textDecoration: a.levee ? "line-through" : "none" }}>
                      réserve : {a.reserve}
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
                    {a.reserve && !signed && (
                      <button onClick={() => { toggleReserveLevee(combo.id, a.id); onChange(); }} style={btn("ghost")}>
                        {a.levee ? "Rouvrir" : "Marquer levée"}
                      </button>
                    )}
                    {!signed && (
                      <button onClick={() => { deleteAvis(combo.id, a.id); onChange(); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13 }}>×</button>
                    )}
                  </span>
                </div>
              ))}
              {!signed && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <input placeholder="Partie prenante" value={av.nom} onChange={e => setAv({ ...av, nom: e.target.value })} style={{ ...field, width: 150 }} />
                  <input placeholder="Fonction" value={av.role} onChange={e => setAv({ ...av, role: e.target.value })} style={{ ...field, width: 130 }} />
                  <select value={av.position} onChange={e => setAv({ ...av, position: e.target.value as AvisPosition })} style={field}>
                    {POSITIONS.map(p => <option key={p} value={p}>{AVIS_META[p].label}</option>)}
                  </select>
                  <input placeholder="Réserve à lever (optionnel)" value={av.reserve} onChange={e => setAv({ ...av, reserve: e.target.value })} style={{ ...field, flex: 1, minWidth: 170 }} />
                  <button onClick={() => {
                    if (!av.nom.trim()) return;
                    addAvis(combo.id, { nom: av.nom, role: av.role.trim() || undefined, position: av.position, reserve: av.reserve });
                    setAv({ nom: "", role: "", position: av.position, reserve: "" }); onChange();
                  }} style={btn("solid")}>Consigner l'avis</button>
                </div>
              )}
            </div>
          )}

          {tab === "preuves" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12.5, color: "var(--v4-text3)" }}>Ce qui rattache la combinaison au réel. Une preuve documente, elle ne note pas.</div>
              {preuves.length === 0 && <div style={{ fontSize: 13, color: "var(--v4-text3)", fontStyle: "italic" }}>Aucune preuve rattachée.</div>}
              {preuves.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 9px", borderRadius: 8, background: "var(--v4-accent-bg)" }}>
                  <span style={{ fontSize: 13 }}>{PREUVE_META[p.kind].icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase" }}>{PREUVE_META[p.kind].label}</span>
                  <span style={{ fontWeight: 700, color: "var(--v4-text)" }}>{p.label}</span>
                  {p.ref && <span style={{ color: "var(--v4-text3)" }}>· {p.ref}</span>}
                  <span style={{ marginLeft: "auto", color: "var(--v4-text3)" }}>{p.date.slice(0, 10)}</span>
                  {!signed && (
                    <button onClick={() => { deletePreuve(combo.id, p.id); onChange(); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13 }}>×</button>
                  )}
                </div>
              ))}
              {!signed && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={pr.kind} onChange={e => setPr({ ...pr, kind: e.target.value as ComboPreuve["kind"] })} style={field}>
                    {(Object.keys(PREUVE_META) as ComboPreuve["kind"][]).map(k => <option key={k} value={k}>{PREUVE_META[k].label}</option>)}
                  </select>
                  <input placeholder="Intitulé (ex : Note de cadrage GRDF)" value={pr.label} onChange={e => setPr({ ...pr, label: e.target.value })} style={{ ...field, flex: 1, minWidth: 180 }} />
                  <input placeholder="Référence / lien" value={pr.ref} onChange={e => setPr({ ...pr, ref: e.target.value })} style={{ ...field, width: 150 }} />
                  <button onClick={() => { if (pr.label.trim()) { addPreuve(combo.id, { kind: pr.kind, label: pr.label, ref: pr.ref.trim() || undefined }); setPr({ kind: pr.kind, label: "", ref: "" }); onChange(); } }}
                    style={btn("solid")}>Rattacher</button>
                </div>
              )}
            </div>
          )}

          {tab === "gouvernance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {signed ? (
                <div style={{ padding: "10px 12px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#065f46" }}>
                    ✓ {combo.signature!.signataire}{combo.signature!.role ? ` — ${combo.signature!.role}` : ""}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#047857", marginTop: 3 }}>
                    Signée le {combo.signature!.date.slice(0, 10)} sur la version {combo.signature!.version}. La version est gelée.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <input placeholder="Nom du signataire" value={sig.nom} onChange={e => setSig({ ...sig, nom: e.target.value })} style={{ ...field, flex: 1, minWidth: 150 }} />
                  <input placeholder="Fonction" value={sig.role} onChange={e => setSig({ ...sig, role: e.target.value })} style={{ ...field, width: 150 }} />
                  <button onClick={() => { if (sig.nom.trim()) { signCombo(combo.id, sig.nom, sig.role); onChange(); } }} style={btn("solid")}>Signer la version</button>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {signed && <button onClick={() => { if (confirm("Ouvrir une nouvelle version ? La signature actuelle sera levée et datée dans l'historique.")) { reopenCombo(combo.id); onChange(); } }} style={btn("ghost")}>Ouvrir une v{(combo.version ?? 1) + 1}</button>}
                <button onClick={() => downloadAudit(combo)} style={btn("ghost")}>↓ Exporter la piste d'audit</button>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--v4-text3)" }}>
                Signer gèle les leviers, le verdict, les preuves et l'historique. Toute reprise crée une version datée — rien n'est effacé.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CombinaisonsSuivies({ sessionId, scope = "initiative" }: { sessionId: string; scope?: "initiative" | "global" }) {
  const [combos, setCombos] = useState<TrackedCombo[]>([]);
  const refresh = useCallback(() => {
    setCombos(scope === "global" ? loadCombos() : loadCombosForSession(sessionId));
  }, [sessionId, scope]);
  useEffect(refresh, [refresh]);

  const signees = combos.filter(c => c.signature).length;
  const sansPreuve = combos.filter(c => !(c.preuves ?? []).length).length;
  const reservesOuvertes = combos.reduce((n, c) => n + consensusState(c).ouvertes, 0);
  // Boucle prévu / constaté : signées attendant leur constaté, et décisions démenties.
  const sansConstat = combos.filter(c => c.signature && !(c.constats ?? []).length).length;
  const dementies = combos.filter(c => {
    const r = retexLecture(c);
    return r && (r.dGPlus < 0 || r.dDMinus > 0);
  }).length;
  const lecons = leconsRegistre(combos);

  return (
    <div style={{ border: "1px solid var(--v4-border)", borderRadius: 8, background: "var(--v4-bg2, transparent)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)" }}>Combinaisons suivies</div>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "var(--v4-accent-bg)", color: "var(--v4-accent)" }}>{combos.length}</span>
        {signees > 0 && <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "#d1fae5", color: "#065f46" }}>{signees} signée{signees > 1 ? "s" : ""}</span>}
        {sansPreuve > 0 && <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "#fef3c7", color: "#92400e" }}>{sansPreuve} sans preuve</span>}
        {reservesOuvertes > 0 && <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "#ffedd5", color: "#9a3412" }}>{reservesOuvertes} réserve{reservesOuvertes > 1 ? "s" : ""} à lever</span>}
        {sansConstat > 0 && <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "#e0e7ff", color: "#3730a3" }}>{sansConstat} signée{sansConstat > 1 ? "s" : ""} sans constaté</span>}
        {dementies > 0 && <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "#fee2e2", color: "#b91c1c" }}>{dementies} écart{dementies > 1 ? "s" : ""} au prévu</span>}
      </div>
      <div style={{ fontSize: 13, color: "var(--v4-text3)", marginBottom: 12.5 }}>
        Prévu → constaté, avis des parties prenantes, preuves d'ancrage, signature opposable. Le verdict reste qualitatif.
      </div>
      {combos.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--v4-text3)", fontStyle: "italic", padding: "10px 0" }}>
          Aucune combinaison enregistrée. Dans Arbitrer, sélectionnez une combinaison puis « Suivre cette combinaison ».
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {combos.map(c => <ComboCard key={c.id} combo={c} onChange={refresh} />)}
        </div>
      )}
      {lecons.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--v4-border)" }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--v4-text3)", marginBottom: 12 }}>
            Ce que le terrain a appris
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lecons.slice(0, 8).map((l, i) => (
              <div key={i} style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ color: "var(--v4-text3)", fontVariantNumeric: "tabular-nums" }}>{l.date}</span>
                <span style={{ fontWeight: 700, color: "var(--v4-text2)" }}>{l.comboName}</span>
                <span style={{ color: "var(--v4-text)", flex: 1 }}>{l.lecon}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
