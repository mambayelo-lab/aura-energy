import type { ArgusVocab, CausalRule, KpiDef, MappingDef } from "./argus-vocab-store";

// Opérations d'édition du Studio (indicateurs, mappings, règles et alertes),
// pures et testables. Une suppression d'un élément du catalogue standard est
// mémorisée dans `removedStandard` pour que le catalogue ne le réinjecte pas.

const STANDARD_KPI = /^k-s\d+$/;
const STANDARD_RULE = /^S\d+$/;

function remember(vocab: ArgusVocab, kind: "kpis" | "rules", id: string): ArgusVocab["removedStandard"] {
  const current = vocab.removedStandard ?? {};
  const standard = kind === "kpis" ? STANDARD_KPI.test(id) : STANDARD_RULE.test(id);
  if (!standard) return vocab.removedStandard;
  const list = new Set(current[kind] ?? []);
  list.add(id);
  return { ...current, [kind]: [...list] };
}

export function updateKpi(vocab: ArgusVocab, id: string, patch: Partial<KpiDef>): ArgusVocab {
  return { ...vocab, kpis: vocab.kpis.map(k => k.id === id ? { ...k, ...patch } : k) };
}

// Supprime l'indicateur, ses mappings et les conditions de règle qui le citent.
export function removeKpi(vocab: ArgusVocab, id: string): ArgusVocab {
  return {
    ...vocab,
    kpis: vocab.kpis.filter(k => k.id !== id),
    mappings: vocab.mappings.filter(m => m.kpiId !== id),
    causalRules: vocab.causalRules.map(r => ({ ...r, conditions: r.conditions.filter(c => c.kpiId !== id) })),
    removedStandard: remember(vocab, "kpis", id),
  };
}

export function addKpiMapping(vocab: ArgusVocab, kpiId: string, fieldId: string, method: MappingDef["method"] = "manuel", extra: Partial<MappingDef> = {}): ArgusVocab {
  const field = vocab.fields.find(f => f.id === fieldId);
  if (!field || !vocab.kpis.some(k => k.id === kpiId)) return vocab;
  const mapping: MappingDef = { id: crypto.randomUUID(), kpiId, fieldId, appId: field.appId, method, ...extra };
  return { ...vocab, mappings: [...vocab.mappings, mapping] };
}

// Modifie un mapping existant : autre champ source et/ou autre indicateur.
export function updateKpiMapping(vocab: ArgusVocab, id: string, patch: { fieldId?: string; kpiId?: string }): ArgusVocab {
  return {
    ...vocab,
    mappings: vocab.mappings.map(m => {
      if (m.id !== id) return m;
      const field = patch.fieldId ? vocab.fields.find(f => f.id === patch.fieldId) : undefined;
      return {
        ...m,
        ...(patch.kpiId ? { kpiId: patch.kpiId } : {}),
        ...(field ? { fieldId: field.id, appId: field.appId, method: "manuel" as const, confidence: undefined, rationale: "Modifié à la main dans le Studio." } : {}),
      };
    }),
  };
}

export function removeKpiMapping(vocab: ArgusVocab, id: string): ArgusVocab {
  return { ...vocab, mappings: vocab.mappings.filter(m => m.id !== id) };
}

export function updateAttributeMappingField(vocab: ArgusVocab, id: string, fieldId: string): ArgusVocab {
  const field = vocab.fields.find(f => f.id === fieldId);
  if (!field) return vocab;
  return {
    ...vocab,
    entityMappings: (vocab.entityMappings ?? []).map(l => l.id === id ? { ...l, fieldId: field.id, appId: field.appId, method: "manuel", confidence: undefined, rationale: "Modifié à la main dans le Studio." } : l),
  };
}

export function blankRule(): CausalRule {
  return { id: crypto.randomUUID(), label: "", conclusion: "", severity: "alerte", origin: "manuel", validation: "validee", alertEnabled: true, conditions: [], causes: [], options: [] };
}

// Crée ou remplace la règle (même identifiant).
export function upsertRule(vocab: ArgusVocab, rule: CausalRule): ArgusVocab {
  const clean: CausalRule = {
    ...rule,
    label: rule.label.trim(),
    conclusion: rule.conclusion.trim(),
    conditions: rule.conditions.filter(c => c.ruleId ? c.ruleId !== rule.id : c.kpiId),
    causes: (rule.causes ?? []).map(x => x.trim()).filter(Boolean),
    options: (rule.options ?? []).map(x => x.trim()).filter(Boolean),
    tags: rule.tags?.map(t => t.trim()).filter(Boolean),
    decisionQuestion: rule.decisionQuestion?.trim() || undefined,
  };
  const exists = vocab.causalRules.some(r => r.id === rule.id);
  return { ...vocab, causalRules: exists ? vocab.causalRules.map(r => r.id === rule.id ? clean : r) : [...vocab.causalRules, clean] };
}

export function duplicateRule(vocab: ArgusVocab, id: string): ArgusVocab {
  const source = vocab.causalRules.find(r => r.id === id);
  if (!source) return vocab;
  const copy: CausalRule = {
    ...structuredClone(source), id: crypto.randomUUID(), label: `${source.label} (copie)`, origin: "manuel", grounded: undefined,
  };
  const index = vocab.causalRules.findIndex(r => r.id === id);
  const causalRules = [...vocab.causalRules];
  causalRules.splice(index + 1, 0, copy);
  return { ...vocab, causalRules };
}

export function setRuleEnabled(vocab: ArgusVocab, id: string, enabled: boolean): ArgusVocab {
  return { ...vocab, causalRules: vocab.causalRules.map(r => r.id === id ? { ...r, alertEnabled: enabled } : r) };
}

// Supprime la règle, les conditions chaînées qui la citent et les conditions
// de mapping qui en dépendent.
export function removeRule(vocab: ArgusVocab, id: string): ArgusVocab {
  return {
    ...vocab,
    causalRules: vocab.causalRules.filter(r => r.id !== id).map(r => ({ ...r, conditions: r.conditions.filter(c => c.ruleId !== id) })),
    mappings: vocab.mappings.map(m => m.condition?.ruleId === id ? { ...m, condition: undefined } : m),
    removedStandard: remember(vocab, "rules", id),
  };
}

// Une règle à une condition est une alerte simple ; à deux ou plus, une
// règle causale.
export function ruleKind(rule: CausalRule): "alerte" | "règle causale" | "modèle" {
  return rule.conditions.length === 0 ? "modèle" : rule.conditions.length === 1 ? "alerte" : "règle causale";
}
