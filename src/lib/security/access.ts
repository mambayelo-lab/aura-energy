// Rôles et droits Aura (Supply et Décider). Source unique de vérité, appliquée côté
// serveur (fonctions serveur, policies RLS) et reflétée dans l'interface.
export type Role = "lecteur" | "analyste" | "administrateur";
export type AccessRole = Role | "demo";
export const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: "lecteur", label: "Lecteur", hint: "Consulte le cockpit." },
  { id: "analyste", label: "Analyste", hint: "Décide, commente, modifie les seuils et les règles." },
  { id: "administrateur", label: "Administrateur", hint: "Studio complet : sources, identifiants, mappings, utilisateurs, audit." },
];

export type Action =
  | "cockpit.read" | "decision.write" | "comment.write" | "thresholds.edit" | "rules.edit" | "export"
  | "studio.read" | "sources.edit" | "credentials.edit" | "mappings.edit" | "ontology.edit" | "users.manage" | "audit.read";

const MATRIX: Record<Role, Action[]> = {
  lecteur: ["cockpit.read", "studio.read"],
  analyste: ["cockpit.read", "studio.read", "decision.write", "comment.write", "thresholds.edit", "rules.edit", "export"],
  administrateur: ["cockpit.read", "studio.read", "decision.write", "comment.write", "thresholds.edit", "rules.edit", "export", "sources.edit", "credentials.edit", "mappings.edit", "ontology.edit", "users.manage", "audit.read"],
};

/** Rôles historiques de organization_members ramenés aux 3 rôles. */
export function normalizeRole(r: string | null | undefined): Role | null {
  if (!r) return null;
  if (r === "owner" || r === "admin" || r === "administrateur") return "administrateur";
  if (r === "member" || r === "analyste") return "analyste";
  if (r === "lecteur" || r === "viewer") return "lecteur";
  return null;
}

/** Le mode démo (sans authentification) garde tous les droits, clairement étiqueté. */
export function can(role: AccessRole | null, action: Action): boolean {
  if (role === "demo") return true;
  return !!role && MATRIX[role].includes(action);
}

export const DENIED = (action: Action) => `Action réservée : ${action} (droits insuffisants pour votre rôle).`;
