// argus-llm.ts — deux appels LLM courts, à la demande, jamais automatiques :
// suggérer un vocabulaire métier minimal pragmatique pour un domaine donné,
// et affiner le rapprochement sémantique entre indicateurs et champs
// applicatifs. Même discipline que architecture-llm.ts.
import { createServerFn } from "@tanstack/react-start";

const DIRECTIONS = ["au_dessus_alerte", "en_dessous_alerte"] as const;

export interface SuggestedKpi {
  label: string;
  unit: string;
  direction: (typeof DIRECTIONS)[number];
  seuilAlerte: number;
  seuilCritique: number;
  // Périmètre fonctionnel d'origine (ex. "Commercial & Clients") — sert à
  // regrouper l'affichage, jamais à un calcul.
  perimetre: string;
  // 2-4 attributs de l'objet métier que représente cet indicateur — ce sont
  // eux, pas le libellé, qui seront rapprochés des métadonnées des sources.
  attributs: string[];
}

// Périmètres fonctionnels couvrant la diversité réelle d'une organisation —
// inspirés d'une lecture PESTEL appliquée à l'entreprise (les leviers
// Politique/Légal et Écologique deviennent Risque & Conformité et
// Durabilité, les plus actionnables à ce niveau) plutôt que macro-économique
// pure. Demander 2-3 indicateurs par périmètre pertinent pour le domaine,
// plutôt qu'une liste plate, est ce qui rend la suggestion à la fois riche
// (couvre tout un métier, pas un seul service) et pragmatique (bornée,
// jamais un inventaire sans fin).
const PERIMETRES = [
  "Commercial & Clients", "Finance & Rentabilité", "Opérations & Supply Chain",
  "RH & Organisation", "Risque & Conformité", "Technologie & SI", "Durabilité & Environnement",
] as const;

// Langue de sortie du Studio — le prompt métier reste en français (registre de
// référence), seuls les libellés produits changent de langue.
const OUTPUT_LANG = {
  fr: "Réponds uniquement en JSON valide, en français.",
  en: "Answer with valid JSON only, and write every label, unit and text value in professional English.",
} as const;

export const suggestVocabulaire = createServerFn({ method: "POST" })
  .validator((d: { domaine: string; lang?: "fr" | "en" }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; kpis?: SuggestedKpi[]; error?: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es un analyste qui définit un vocabulaire métier pour piloter un secteur — sans jamais te présenter comme tel. Couvre la diversité réelle du métier en t'appuyant sur ces périmètres fonctionnels : ${PERIMETRES.join(", ")}. Pour CHAQUE périmètre réellement pertinent pour ce domaine (écarte ceux qui ne s'appliquent pas), propose 2 à 3 indicateurs — jamais une liste plate d'un seul point de vue. Reste pragmatique : pas de périmètre forcé s'il n'a pas de sens ici, pas d'indicateur redondant. Pour chaque indicateur, identifie aussi 2 à 4 attributs concrets de l'objet métier qu'il représente (ex. pour "Marge brute" : "chiffre d'affaires", "coût des ventes") — ce sont ces attributs qui seront ensuite rapprochés des données réelles des systèmes sources, pas le nom de l'indicateur. ${OUTPUT_LANG[data.lang ?? "fr"]}`,
        },
        {
          role: "user",
          content: `Domaine métier : ${data.domaine}

Réponds avec ce JSON :
{ "kpis": [
  { "label": "court, 2-4 mots", "unit": "ex: %, K€, jours", "direction": "au_dessus_alerte|en_dessous_alerte", "seuilAlerte": nombre, "seuilCritique": nombre, "perimetre": "un des périmètres listés", "attributs": ["attribut 1", "attribut 2"] }
] }
"au_dessus_alerte" = un chiffre trop haut est mauvais (ex. délai, taux de défaut) ; "en_dessous_alerte" = un chiffre trop bas est mauvais (ex. marge, taux de service). Les seuils doivent être des ordres de grandeur crédibles pour ce secteur, pas 0 ou 100 par défaut.`,
        },
      ],
      maxTokens: 1600,
      temperature: 0.4,
      jsonMode: true,
    });
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const parsed = JSON.parse(r.content) as { kpis: SuggestedKpi[] };
      return { ok: true, kpis: parsed.kpis };
    } catch {
      return { ok: false, error: "Réponse LLM invalide" };
    }
  });

export interface MappingCandidateInput {
  kpiId: string; kpiLabel: string;
  fieldId: string; fieldName: string; appLabel: string;
  semanticScore: number;
}
export interface MappingSuggestion {
  kpiId: string; fieldId: string; confidence: number; rationale: string;
}

export const refineMappings = createServerFn({ method: "POST" })
  .validator((d: { candidates: MappingCandidateInput[] }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; suggestions?: MappingSuggestion[]; error?: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const lines = data.candidates.map(c =>
      `- indicateur "${c.kpiLabel}" (id ${c.kpiId}) ↔ champ "${c.fieldName}" de ${c.appLabel} (id ${c.fieldId}) — score lexical ${c.semanticScore.toFixed(2)}`
    ).join("\n");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es un expert en rapprochement sémantique de données d'entreprise (mapping ontologie ↔ métadonnées applicatives) — sans jamais te présenter comme tel. Le score lexical fourni est indicatif, pas définitif : un champ nommé différemment peut sémantiquement correspondre. Réponds uniquement en JSON valide, en français, avec une justification d'une phrase par correspondance retenue.`,
        },
        {
          role: "user",
          content: `Voici des correspondances candidates entre indicateurs métier et champs applicatifs :\n${lines}\n\nPour chaque paire qui te semble être une vraie correspondance (confiance ≥ 0.4), réponds avec ce JSON :\n{ "suggestions": [ { "kpiId": "...", "fieldId": "...", "confidence": 0.0-1.0, "rationale": "une phrase" } ] }\nOmets les paires non pertinentes.`,
        },
      ],
      maxTokens: 700,
      temperature: 0.2,
      jsonMode: true,
    });
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const parsed = JSON.parse(r.content) as { suggestions: MappingSuggestion[] };
      return { ok: true, suggestions: parsed.suggestions };
    } catch {
      return { ok: false, error: "Réponse LLM invalide" };
    }
  });

export interface SuggestedCausalRule {
  label: string;
  conditions: { kpiLabel: string; minStatus: "alerte" | "critique" }[];
  conclusion: string;
  severity: "alerte" | "critique";
}

export const suggestCausalRules = createServerFn({ method: "POST" })
  .validator((d: { domaine: string; kpiLabels: string[]; problematique?: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; rules?: SuggestedCausalRule[]; error?: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es un analyste qui identifie des combinaisons d'indicateurs révélatrices d'une situation opérationnelle précise dans un secteur donné — sans jamais te présenter comme tel. Une règle causale relie TOUJOURS au moins 2 indicateurs (jamais un seul, ça n'aurait rien de causal) et conclut sur un risque ou une opportunité concrète, jamais générique. 2 à 4 règles maximum. Réponds uniquement en JSON valide, en français, en utilisant EXACTEMENT les libellés d'indicateurs fournis.`,
        },
        {
          role: "user",
          content: `Domaine métier : ${data.domaine}${data.problematique ? `\nProblématique : ${data.problematique}` : ""}
Indicateurs disponibles : ${data.kpiLabels.join(", ")}

Réponds avec ce JSON :
{ "rules": [
  {
    "label": "nom court de la situation (ex: Risque de rupture de trésorerie)",
    "conditions": [ { "kpiLabel": "doit être un des indicateurs fournis, exact", "minStatus": "alerte|critique" } ],
    "conclusion": "une phrase causale concrète expliquant pourquoi cette combinaison est significative",
    "severity": "alerte|critique"
  }
] }
N'invente aucun indicateur qui ne serait pas dans la liste fournie.`,
        },
      ],
      maxTokens: 600,
      temperature: 0.3,
      jsonMode: true,
    });
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const parsed = JSON.parse(r.content) as { rules: SuggestedCausalRule[] };
      return { ok: true, rules: parsed.rules };
    } catch {
      return { ok: false, error: "Réponse LLM invalide" };
    }
  });

// ── Modèle entités-relations ─────────────────────────────────────────────────
// L'ontologie NOMINALE d'un domaine — les objets métier réels (Client,
// Produit, Fournisseur, Commande…) et leurs relations, nécessaires pour
// interroger un SI et raisonner sur l'activité au-delà des seuls
// indicateurs chiffrés. Généré à la demande, jamais automatique ; toujours
// modifiable ensuite (ajout/suppression/édition manuelle dans Studio).
export interface SuggestedEntity {
  name: string;
  description: string;
  attributes: string[];
}
export interface SuggestedRelationship {
  from: string; // nom d'entité, doit correspondre à une entité proposée
  to: string;
  label: string; // verbe court, ex. "passe", "livre", "facture"
  cardinality: "1-1" | "1-N" | "N-N";
}

export const suggestEntityModel = createServerFn({ method: "POST" })
  .validator((d: { domaine: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; entities?: SuggestedEntity[]; relationships?: SuggestedRelationship[]; error?: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu conçois le modèle entités-relations MINIMAL et NOMINAL d'un domaine métier — les objets réels sur lesquels une entreprise de ce secteur doit pouvoir interroger son système d'information et raisonner pour décider (ex. Client, Produit, Fournisseur, Commande, Contrat — jamais des indicateurs chiffrés, qui sont traités ailleurs). Sans jamais te présenter comme un rôle.
5 à 9 entités maximum, chacune avec 2 à 5 attributs factuels (pas de KPI). 4 à 8 relations entre elles avec une cardinalité réaliste. Réponds uniquement en JSON valide, en français.`,
        },
        {
          role: "user",
          content: `Domaine : ${data.domaine}

Réponds avec ce JSON exact :
{
  "entities": [ { "name": "...", "description": "...", "attributes": ["...", "..."] } ],
  "relationships": [ { "from": "nom d'entité exact", "to": "nom d'entité exact", "label": "verbe court", "cardinality": "1-1|1-N|N-N" } ]
}`,
        },
      ],
      maxTokens: 1500,
      temperature: 0.3,
      jsonMode: true,
    });
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const parsed = JSON.parse(r.content) as { entities: SuggestedEntity[]; relationships: SuggestedRelationship[] };
      return { ok: true, entities: parsed.entities, relationships: parsed.relationships };
    } catch {
      return { ok: false, error: "Réponse LLM invalide" };
    }
  });
