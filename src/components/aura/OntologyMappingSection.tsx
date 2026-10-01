// OntologyMappingSection.tsx — « Ontology Mapping » du Studio : poser des
// candidats de mapping pour UN attribut d'UN objet métier donné.
//
// Prérequis assumé : les objets métier et leurs attributs sont d'abord posés
// dans « Entités & relations » (vocabulaire métier). Tant que ce n'est pas le
// cas, cette page le dit explicitement au lieu de proposer des branchements
// dans le vide.
//
// Vue maître-détail : à gauche les objets métier avec leur couverture, à
// droite chaque attribut avec ses branchements actifs (MASTER / contributeur)
// et les candidats classés par le moteur de rapprochement (mapping-engine).
// Rien n'est branché automatiquement : un candidat ne devient un branchement
// que si vous l'acceptez.
import { updateAttributeMappingField } from "../../lib/v4/studio-editing";
import { useState } from "react";
import {
  type ArgusVocab, type BusinessEntity, type EntityAttribute, type EntityMapping,
} from "../../lib/v4/argus-vocab-store";
import { rankCandidates, entityCoverage } from "../../lib/v4/mapping-engine";
import { refineMappingCandidates, type HybridMappingCandidate } from "../../lib/v4/hybrid-mapping.functions";

const ACCENT = "#6C5CE7";

function covColor(pct: number) {
  return pct >= 80 ? "#059669" : pct >= 40 ? "#D97706" : pct > 0 ? "#B45309" : "var(--v4-text3)";
}

function AttributeRow({ vocab, entity, attr, onUpdate }: {
  vocab: ArgusVocab; entity: BusinessEntity; attr: EntityAttribute; onUpdate: (v: ArgusVocab) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hybridCandidates, setHybridCandidates] = useState<HybridMappingCandidate[] | null>(null);
  const [hybridLoading, setHybridLoading] = useState(false);
  const [hybridError, setHybridError] = useState<string | null>(null);
  const links = (vocab.entityMappings ?? []).filter(l => l.entityId === entity.id && l.attributeId === attr.id);
  const candidates = rankCandidates(vocab, entity, attr).filter(c => !links.some(l => l.fieldId === c.field.id));
  const visibleCandidates: Array<(typeof candidates)[number] & { hybrid?: HybridMappingCandidate }> = hybridCandidates
    ? hybridCandidates.flatMap(hybrid => {
        const base = candidates.find(candidate => candidate.field.id === hybrid.fieldId);
        return base ? [{ ...base, score: hybrid.hybridScore, rationale: hybrid.rationale, hybrid }] : [];
      })
    : candidates;

  async function runHybridAnalysis() {
    setHybridLoading(true);
    setHybridError(null);
    try {
      const result = await refineMappingCandidates({ data: {
        entity: { name: entity.name, description: entity.description },
        attribute: { name: attr.name, type: attr.type },
        candidates: candidates.slice(0, 5).map(candidate => ({
          fieldId: candidate.field.id,
          fieldName: candidate.field.name,
          appLabel: vocab.apps.find(app => app.id === candidate.field.appId)?.label ?? "Source inconnue",
          samples: candidate.field.sampleValues.slice(0, 5),
          semanticScore: candidate.score,
          semanticRationale: candidate.rationale,
          profile: candidate.profile,
          expected: candidate.expected,
        })),
      } });
      setHybridCandidates(result.candidates);
      if (!result.llmAvailable) setHybridError("LLM indisponible : classement sémantique conservé.");
    } catch (error) {
      setHybridError(error instanceof Error ? error.message : "Analyse hybride impossible.");
    } finally {
      setHybridLoading(false);
    }
  }

  function accept(fieldId: string, appId: string, confidence: number, rationale: string) {
    const link: EntityMapping = {
      id: crypto.randomUUID(), entityId: entity.id, attributeId: attr.id, appId, fieldId,
      isMaster: links.length === 0, confidence, method: hybridCandidates ? "hybride" : "semantique", rationale,
    };
    onUpdate({ ...vocab, entityMappings: [...(vocab.entityMappings ?? []), link] });
  }
  function remove(id: string) {
    onUpdate({ ...vocab, entityMappings: (vocab.entityMappings ?? []).filter(l => l.id !== id) });
  }
  function setMaster(id: string) {
    onUpdate({
      ...vocab,
      entityMappings: (vocab.entityMappings ?? []).map(l =>
        l.entityId === entity.id && l.attributeId === attr.id ? { ...l, isMaster: l.id === id } : l),
    });
  }
  function addManual(fieldId: string) {
    const field = vocab.fields.find(f => f.id === fieldId);
    if (!field) return;
    accept(field.id, field.appId, 0, "branchement manuel");
  }

  return (
    <div style={{ border: "1px solid var(--v4-border)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", flex: 1 }}>{attr.name}</span>
        <span style={{ fontSize: 13, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: links.length ? "#05966915" : "var(--v4-bg)", color: links.length ? "#059669" : "var(--v4-text3)" }}>
          {links.length ? `${links.length} branchement${links.length > 1 ? "s" : ""}` : "non branché"}
        </span>
        <button onClick={() => setOpen(o => !o)}
          style={{ fontSize: 13, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: `1.5px solid ${ACCENT}`, background: open ? ACCENT : "transparent", color: open ? "#fff" : ACCENT, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          {open ? "Fermer" : `Poser des candidats (${visibleCandidates.length})`}
        </button>
      </div>

      {links.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {links.map(l => {
            const field = vocab.fields.find(f => f.id === l.fieldId);
            const app = vocab.apps.find(a => a.id === l.appId);
            return (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "5px 8px", borderRadius: 6, background: "var(--v4-bg)" }}>
                <select aria-label={`Champ source de ${entity.name} · ${attr.name}`} value={l.fieldId} onChange={e => onUpdate(updateAttributeMappingField(vocab, l.id, e.target.value))}
                  style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5, color: "var(--v4-text)", border: "1px solid var(--v4-border)", borderRadius: 6, padding: "2px 4px", background: "var(--v4-surface)", maxWidth: 320 }}>
                  {!field && <option value={l.fieldId}>champ supprimé</option>}
                  {vocab.fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <span style={{ color: "var(--v4-text3)" }}>· {app?.label ?? "?"}</span>
                <button onClick={() => setMaster(l.id)} disabled={l.isMaster}
                  title={l.isMaster ? "Source de référence de cet attribut" : "Désigner comme source de référence"}
                  style={{ fontSize: 12.5, fontWeight: 800, padding: "1px 7px", borderRadius: 999, border: "none", cursor: l.isMaster ? "default" : "pointer", fontFamily: "inherit", background: l.isMaster ? ACCENT : "var(--v4-border)", color: l.isMaster ? "#fff" : "var(--v4-text2)" }}>
                  {l.isMaster ? "MASTER" : "contributeur"}
                </button>
                {l.confidence ? <span style={{ fontSize: 13, color: "var(--v4-text3)" }}>{Math.round(l.confidence * 100)}%</span> : null}
                <button onClick={() => remove(l.id)} aria-label={`Supprimer le branchement ${attr.name} ← ${field?.name ?? ""}`} title="Supprimer" style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 14 }}>×</button>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--v4-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--v4-text3)" }}>
              Candidats classés — similarité, métadonnées et valeurs réelles
            </div>
            <button onClick={runHybridAnalysis} disabled={hybridLoading || candidates.length === 0}
              style={{ fontSize: 13, fontWeight: 750, padding: "5px 9px", borderRadius: 6, border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", cursor: hybridLoading ? "wait" : "pointer", fontFamily: "inherit" }}>
              {hybridLoading ? "Analyse IA…" : "Affiner avec le LLM"}
            </button>
          </div>
          <div style={{ fontSize: 13, color: "var(--v4-text3)", marginBottom: 12 }}>
            Similarité déterministe → top 5 → analyse contextuelle LLM → score hybride → validation humaine.
          </div>
          {hybridError && <div style={{ fontSize: 13, color: "#B45309", marginBottom: 12 }}>{hybridError}</div>}
          {visibleCandidates.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>
              Aucun candidat : ajoutez des champs sources dans « Données échantillon », ou branchez manuellement ci-dessous.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {visibleCandidates.map(c => {
              const pct = Math.round(c.score * 100);
              const bar = pct >= 60 ? "#059669" : pct >= 30 ? "#D97706" : "var(--v4-border2)";
              const app = vocab.apps.find(a => a.id === c.field.appId);
              return (
                <div key={c.field.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 9px", borderRadius: 8, border: "1px solid var(--v4-border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5 }}>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{c.field.name}</span>
                      <span style={{ color: "var(--v4-text3)" }}> · {app?.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <div style={{ width: 70, height: 4, borderRadius: 6, background: "var(--v4-bg)" }}>
                        <div style={{ width: `${pct}%`, height: 4, borderRadius: 6, background: bar }} />
                      </div>
                      <span style={{ fontSize: 12.5, color: "var(--v4-text3)" }}>{c.hybrid ? `Hybride ${pct}% · similarité ${Math.round(c.hybrid.semanticScore * 100)}% · LLM ${c.hybrid.llmScore == null ? "indisponible" : `${Math.round(c.hybrid.llmScore * 100)}%`}` : `${pct}% · ${c.rationale}`}</span>
                    </div>
                    {c.hybrid?.llmRationale && <div style={{ fontSize: 13, color: "#4338ca", marginTop: 3 }}>{c.hybrid.llmRationale}</div>}
                    {c.field.sampleValues.length > 0 && (
                      <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.field.sampleValues.slice(0, 3).join(" | ")}
                      </div>
                    )}
                  </div>
                  <button onClick={() => accept(c.field.id, c.field.appId, c.score, c.rationale)}
                    style={{ fontSize: 13, fontWeight: 700, padding: "5px 11px", borderRadius: 6, border: "none", background: ACCENT, color: "#fff", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    Brancher
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <select defaultValue="" onChange={e => { if (e.target.value) { addManual(e.target.value); e.target.value = ""; } }}
              style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)" }}>
              <option value="">Brancher manuellement un champ…</option>
              {vocab.fields.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({vocab.apps.find(a => a.id === f.appId)?.label})</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export function OntologyMappingSection({ vocab, onUpdate, onLineage }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void; onLineage?: (entityId: string) => void }) {
  const entities = vocab.entities ?? [];
  // Par défaut : l'objet le moins couvert, et seulement ses attributs à compléter.
  const [selectedId, setSelectedId] = useState(() => [...entities].sort((a, b) => entityCoverage(vocab, a).pct - entityCoverage(vocab, b).pct)[0]?.id ?? "");
  const [todoOnly, setTodoOnly] = useState(true);
  const selected = entities.find(e => e.id === selectedId) ?? [...entities].sort((a, b) => entityCoverage(vocab, a).pct - entityCoverage(vocab, b).pct)[0];

  if (entities.length === 0) {
    return (
      <div style={{ border: "1px solid var(--v4-border)", borderRadius: 8, padding: "16px 18px", fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.6 }}>
        <b>Prérequis :</b> posez d'abord vos objets métier et leurs attributs dans <b>Entités &amp; relations</b>
        {" "}(saisie manuelle ou « ✦ Générer par IA » à partir du domaine). Le mapping se fait toujours
        attribut par attribut — sans vocabulaire posé, il n'y a rien à brancher.
      </div>
    );
  }

  const totals = entities.reduce((acc, e) => {
    const c = entityCoverage(vocab, e);
    return { mapped: acc.mapped + c.mapped, total: acc.total + c.total };
  }, { mapped: 0, total: 0 });
  const globalPct = totals.total === 0 ? 0 : Math.round((totals.mapped / totals.total) * 100);

  return (
    <div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "var(--v4-bg)", marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: covColor(globalPct) }} title="Mapping hybride gouverné : le moteur mesure la similarité des métadonnées et la compatibilité des échantillons ; le LLM contextualise seulement les cinq meilleurs candidats. Aucun branchement n'est publié sans validation humaine.">{globalPct}%</div>
        <div style={{ fontSize: 13.5, color: "var(--v4-text2)" }}>
          <b>{totals.mapped}/{totals.total}</b> attributs branchés · {(vocab.entityMappings ?? []).length} branchements ·
          {" "}{vocab.fields.length} champs sources disponibles
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {entities.map(e => {
            const c = entityCoverage(vocab, e);
            const active = selected?.id === e.id;
            return (
              <button key={e.id} data-testid="coverage-object" onClick={() => { setSelectedId(e.id); setTodoOnly(true); }}
                style={{ textAlign: "left", padding: "8px 10px", borderRadius: 8, border: `1px solid ${active ? ACCENT : "var(--v4-border)"}`, background: active ? `${ACCENT}10` : "var(--v4-surface)", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", flex: 1 }}>{e.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: covColor(c.pct) }}>{c.pct}%</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 1 }}>{c.mapped}/{c.total} attributs</div>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {selected && selected.attributes.length === 0 && (
            <div style={{ fontSize: 13.5, color: "var(--v4-text3)" }}>
              « {selected.name} » n'a aucun attribut défini — ajoutez-les dans « Entités &amp; relations » avant de mapper.
            </div>
          )}
          {selected && selected.attributes.length > 0 && (() => {
            const linked = (a: EntityAttribute) => (vocab.entityMappings ?? []).some(l => l.entityId === selected.id && l.attributeId === a.id);
            const todo = selected.attributes.filter(a => !linked(a));
            const shown = todoOnly ? todo : selected.attributes;
            return <>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <b style={{ fontSize: 14 }}>{selected.name}</b>
                <span style={{ fontSize: 13, color: "var(--v4-text3)" }}>{todo.length ? `${todo.length} attribut(s) à compléter` : "Tout est branché"}</span>
                <button type="button" onClick={() => setTodoOnly(v => !v)} style={{ fontSize: 12.5, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--v4-border)", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>{todoOnly ? `Voir les ${selected.attributes.length}` : "À compléter seulement"}</button>
                {onLineage && <button type="button" data-testid="open-lineage" onClick={() => onLineage(selected.id)} style={{ fontSize: 12.5, padding: "3px 9px", borderRadius: 6, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, cursor: "pointer", fontFamily: "inherit" }}>Voir dans le Lignage</button>}
              </div>
              {shown.map(a => <AttributeRow key={a.id} vocab={vocab} entity={selected} attr={a} onUpdate={onUpdate} />)}
            </>;
          })()}
        </div>
      </div>
    </div>
  );
}
