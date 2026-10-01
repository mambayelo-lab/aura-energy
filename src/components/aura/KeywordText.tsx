import { Fragment, type ReactNode } from "react";

/**
 * Lexique par défaut des mots clés de questions, commun aux trois applications
 * (Supply, Décider, Architect). Utilisé lorsqu'aucune liste explicite n'est
 * fournie. Les pluriels simples (s / x) sont reconnus automatiquement.
 */
export const DEFAULT_QUESTION_KEYWORDS: readonly string[] = [
  // Décision / arbitrage
  "décision", "décider", "décide", "arbitrer", "arbitrage", "stratégie", "investissement", "recommandation",
  "objectif", "objectif principal", "horizon", "priorité", "enjeu", "enjeux", "cadre", "cadrage", "périmètre", "situation",
  "contrainte", "risque", "non négociable", "exigence", "sacrifié", "facteurs imposés", "hors contrôle", "maîtrisez", "maîtrisables",
  "partie prenante", "parties prenantes", "impacté", "impact", "résister", "acteur", "levier", "agir",
  "scénario", "option", "critère", "indicateur", "KPI", "jalon", "trajectoire", "suivi", "hypothèse", "incertitude",
  // Supply
  "produit", "référence", "fournisseur", "stock", "demande", "prévision", "capacité", "coût", "délai", "taux de service",
  "service", "entrepôt", "site", "usine", "transport", "approvisionnement", "réseau", "saisonnalité", "budget", "marge",
  // Architect
  "transformation", "domaine", "besoin", "paysage applicatif", "application", "capacité métier", "architecture", "cible",
  // Général
  "secteur", "document", "données", "domaine métier", "objet métier", "valeur", "alertez", "alerte", "seuil", "champ", "accède", "pilotez", "détiennent", "structurent", "alimente",
];

function escape(k: string) {
  return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Texte dont certains mots clés sont surlignés avec douceur (fond indigo très
 * clair, texte indigo foncé, graisse renforcée) — jamais uniquement par la
 * couleur. Recherche insensible à la casse, sur mots entiers (pluriels s/x
 * tolérés) ; le texte n'est pas modifié (le nom accessible reste identique).
 * Sans liste `keywords`, le lexique par défaut est utilisé.
 */
export function KeywordText({ text, keywords, className }: { text: string; keywords?: readonly string[]; className?: string }): ReactNode {
  const source = keywords && keywords.length ? keywords : DEFAULT_QUESTION_KEYWORDS;
  const list = [...new Set(source.map(k => k.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!text || !list.length) return <span className={className}>{text}</span>;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${list.map(escape).join("|")})(?:s|x)?(?![\\p{L}\\p{N}])`, "giu");
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>);
    out.push(<mark key={i++} className="aura-kw">{m[0]}</mark>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);
  return <span className={className}>{out}</span>;
}

/** Raccourci : question / intitulé avec le lexique par défaut. */
export function Q({ children, keywords }: { children: string; keywords?: readonly string[] }): ReactNode {
  return <KeywordText text={children} keywords={keywords} className="aura-q" />;
}
