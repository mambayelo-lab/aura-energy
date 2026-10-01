// llm-guardrails.ts — NOUVEAU. Le contrat commun imposé à TOUS les appels LLM
// d'Aura (Décider, Architecturer, Copilote décisionnel).
//
// ── Pourquoi ce fichier existe ────────────────────────────────────────────
// Chaque générateur portait ses propres garde-fous, rédigés à la main, donc
// inégaux : certains interdisaient les chiffres inventés, d'autres non ;
// certains exigeaient de la profondeur, d'autres se contentaient de labels
// génériques. Un moteur de décision opposable ne peut pas avoir une exigence
// de vérité qui varie selon l'écran. On centralise donc :
//   · ANTI_HALLUCINATION — ce que le modèle n'a PAS le droit d'inventer ;
//   · PROFONDEUR        — le niveau d'expertise attendu dans les libellés ;
//   · ORIGINALITE       — l'obligation de rendre visible le non-imaginé ;
//   · CONTROLE_UTILISATEUR — toute proposition est un brouillon à valider.
//
// Ce module est PUREMENT déclaratif : il n'appelle aucun LLM, ne calcule rien
// et ne réécrit jamais une sortie de modèle. Il s'ajoute aux prompts existants
// (append), il n'en remplace aucun — les prompts métier déjà écrits restent la
// référence de leur domaine.

/** Ce que le modèle n'a jamais le droit d'inventer. Vaut pour tous les espaces. */
export const G_ANTI_HALLUCINATION = `
━━━ CONTRAT DE VÉRITÉ (prime sur toute autre consigne) ━━━
① AUCUN CHIFFRE INVENTÉ. Tu ne produis un nombre que s'il a été fourni dans le contexte, ou s'il ne sert qu'à NOMMER un paramètre (« Latence P99 (ms) », « Point mort (mois) ») sans en donner la valeur. Jamais de %, de montant, de note, de score, de délai ni de volumétrie estimés de ta propre initiative.
② AUCUN NOM PROPRE INVENTÉ. Pas d'éditeur, de produit, de fournisseur, de norme, de référence bibliographique, de client ni de site nommé s'il n'apparaît pas dans le contexte fourni. À la place, une catégorie générique (« ERP », « plateforme de données », « un référentiel réglementaire applicable »).
③ AUCUN FAIT PRÊTÉ À L'ORGANISATION. Tu ne déclares pas ce que l'entreprise « fait déjà », « possède » ou « a constaté » si ce n'est pas dans le contexte. Formule-le comme une question ou une hypothèse explicite.
④ DIRE « JE NE SAIS PAS » EST UNE RÉPONSE VALIDE ET ATTENDUE. Une information manquante se signale (« ? », « à confirmer », champ vide, liste vide) — elle ne se comble jamais par une valeur plausible. Une liste courte et vraie vaut mieux qu'une liste longue et décorative.
⑤ ÉVALUATION STRICTEMENT ORDINALE. Les jugements se posent sur l'échelle ++ / + / 0 / − / −− / ? uniquement. Aucune moyenne, aucune pondération, aucun score continu, aucun seuil numérique — un critère éliminatoire reste éliminatoire.`.trim();

/** Le niveau d'expertise attendu dans les libellés — jamais du remplissage. */
export const G_PROFONDEUR = `
━━━ PROFONDEUR (le niveau attendu est celui d'un expert du domaine) ━━━
① Chaque libellé NOMME quelque chose de réel : un paramètre dimensionnant, un mécanisme, une architecture, une structure contractuelle, une barrière de risque — jamais une abstraction interchangeable d'un projet à l'autre. Test : si le libellé pourrait être copié tel quel dans un autre dossier d'un autre secteur, il est trop faible — récris-le.
② Interdits comme libellés : « Performance », « Coût », « Risque », « Qualité », « Option A/B/C », « Solution robuste / standard / économique », « Améliorer le processus », « Mettre en place un suivi ».
③ Nomme le MÉCANISME, pas l'intention : ✗ « Améliorer la disponibilité » → ✓ « Bascule automatique sur site secondaire sans réamorçage applicatif ».
④ Calibre le registre sur l'interlocuteur, jamais la rigueur : une question de cap de direction générale mérite des mécanismes de gouvernance et des structures de deal nommés, pas des raideurs en N/mm — mais avec la même exigence de précision.
⑤ Descriptions COURTES (≤ 18 mots). La richesse est dans le libellé, pas dans la prose.`.trim();

/** Rendre visible le non-imaginé — sans jamais sortir du crédible. */
export const G_ORIGINALITE = `
━━━ ORIGINALITÉ UTILE (l'effet « on n'y avait pas pensé ») ━━━
① Au moins une proposition doit venir d'un RENVERSEMENT du problème (supprimer le besoin plutôt que le satisfaire) ou d'une TRANSPOSITION depuis un domaine voisin.
② Cette proposition doit rester défendable devant un comité : sa justification dit d'où vient l'idée et à quelle condition elle tient. Une idée originale sans condition d'applicabilité est du bruit — ne la produis pas.
③ L'originalité ne remplace jamais la couverture attendue : on ajoute l'option latérale AUX options classiques, on ne les supprime pas.
④ Pas de créativité de forme : aucune emphase, aucun superlatif, aucune formule commerciale. L'idée porte, pas son emballage.`.trim();

/** Rappel que la sortie est un brouillon soumis à l'utilisateur. */
export const G_CONTROLE_UTILISATEUR = `
━━━ CONTRÔLE DE L'UTILISATEUR ━━━
Tout ce que tu produis est une PROPOSITION à valider, jamais une décision. Tu ne conclus pas à la place du décideur, tu n'appliques rien de toi-même, et tu rends visible ce sur quoi tu es incertain pour qu'il puisse le corriger avant de s'engager.`.trim();

/**
 * Bloc à concaténer à un prompt système existant.
 * `only` permet de ne prendre que les volets pertinents (ex. un extracteur de
 * document n'a pas besoin du volet originalité).
 */
export function guardrails(only?: Array<"verite" | "profondeur" | "originalite" | "controle">): string {
  const set = new Set(only ?? ["verite", "profondeur", "originalite", "controle"]);
  const parts: string[] = [];
  if (set.has("verite")) parts.push(G_ANTI_HALLUCINATION);
  if (set.has("profondeur")) parts.push(G_PROFONDEUR);
  if (set.has("originalite")) parts.push(G_ORIGINALITE);
  if (set.has("controle")) parts.push(G_CONTROLE_UTILISATEUR);
  return parts.length ? `\n\n${parts.join("\n\n")}` : "";
}

/* ── Détection (jamais réécriture) ─────────────────────────────────────────── */
//
// On ne corrige PAS la sortie du modèle : la corriger silencieusement
// masquerait le problème et retirerait le contrôle à l'utilisateur. On la
// SIGNALE, pour que l'interface puisse afficher « à confirmer » à côté de la
// proposition concernée.

export interface GuardrailWarning {
  kind: "chiffre" | "score";
  extrait: string;
  message: string;
}

const NUM_TOKEN = /(?<![\p{L}\d])(\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d+)?)\s?(%|pts?\b|k€|K€|m€|M€|€|\$|jours?\b|mois\b|semaines?\b|ans?\b)/giu;
const SCORE_TOKEN = /\b\d{1,3}\s*\/\s*(?:5|10|20|100)\b/g;

/**
 * Repère les grandeurs affirmées par le modèle qui n'apparaissent pas dans le
 * contexte fourni par l'utilisateur — les candidates à l'hallucination.
 * `sourceText` = tout ce que l'utilisateur a réellement fourni.
 */
export function detectUngroundedFigures(generated: string, sourceText: string): GuardrailWarning[] {
  const out: GuardrailWarning[] = [];
  const haystack = sourceText.toLowerCase();
  const seen = new Set<string>();

  for (const m of generated.matchAll(NUM_TOKEN)) {
    const extrait = m[0].trim();
    const key = extrait.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Le nombre nu suffit : s'il figure dans ce que l'utilisateur a fourni, il est ancré.
    if (haystack.includes((m[1] ?? "").toLowerCase())) continue;
    out.push({
      kind: "chiffre",
      extrait,
      message: `« ${extrait} » n'apparaît pas dans les éléments que vous avez fournis — à confirmer avant de vous en servir.`,
    });
  }
  for (const m of generated.matchAll(SCORE_TOKEN)) {
    const extrait = m[0].trim();
    if (seen.has(extrait.toLowerCase())) continue;
    seen.add(extrait.toLowerCase());
    out.push({
      kind: "score",
      extrait,
      message: `« ${extrait} » est une note continue : Aura raisonne en ordinal, cette valeur n'a pas de statut dans le modèle.`,
    });
  }
  return out.slice(0, 8);
}
