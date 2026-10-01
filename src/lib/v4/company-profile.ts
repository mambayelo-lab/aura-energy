// company-profile.ts — Persistent company context injected into all LLM prompts

export interface CompanyProfile {
  secteur: string;       // ex. "Énergie / Utilities"
  ca: string;            // ex. "500M€"
  effectif: string;      // ex. "2 000 personnes"
  strategie: string;     // 2-4 sentences on current strategy
  marches: string;       // ex. "France, Belgique — B2B PME et grands comptes"
  contraintes: string;   // ex. "Marge en baisse, pression réglementaire RE2025"
  docExtract?: string;   // extracted text from uploaded reference doc
  updatedAt?: string;
}

const KEY = "aura-v4-company-profile";

export function getProfile(): CompanyProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CompanyProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: CompanyProfile): void {
  localStorage.setItem(KEY, JSON.stringify({ ...p, updatedAt: new Date().toISOString() }));
}

export function clearProfile(): void {
  localStorage.removeItem(KEY);
}

/** Build a compact LLM-ready context string from the profile */
export function buildCompanyContext(p: CompanyProfile | null): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.secteur)    parts.push(`Secteur : ${p.secteur}`);
  if (p.ca)         parts.push(`CA : ${p.ca}`);
  if (p.effectif)   parts.push(`Effectif : ${p.effectif}`);
  if (p.marches)    parts.push(`Marchés : ${p.marches}`);
  if (p.strategie)  parts.push(`Stratégie actuelle : ${p.strategie}`);
  if (p.contraintes) parts.push(`Contraintes clés : ${p.contraintes}`);
  if (p.docExtract) parts.push(`Extrait document de référence :\n${p.docExtract.slice(0, 800)}`);
  if (!parts.length) return "";
  return `\n\n--- Contexte entreprise ---\n${parts.join("\n")}\n---`;
}

export const SECTEUR_OPTIONS = [
  "Énergie / Utilities", "Industrie / Manufacturing", "Services financiers / Banque",
  "Assurance", "Retail / Distribution", "SaaS / Tech", "Santé / Pharma",
  "Agroalimentaire", "Logistique / Transport", "Immobilier / Construction",
  "Télécoms", "Médias / Publishing", "Éducation / Formation", "Public / Collectivités",
  "Conseil / Services", "Aéronautique / Défense", "Chimie / Matériaux", "Autre",
];
