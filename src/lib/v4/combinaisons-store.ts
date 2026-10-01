// combinaisons-store.ts — registre local des combinaisons de leviers nommées
// et suivies dans le temps.
//
// Une combinaison est un choix d'option par levier. Arbitrer en produit des
// milliers ; seules quelques-unes méritent d'être nommées, commentées et
// suivies. Ce registre garde, pour chacune : ses leviers, son verdict ordinal
// au moment de l'enregistrement (δ⁺ / δ⁻ — jamais un score), ses commentaires
// et ses points de suivi successifs.
//
// Aucun calcul ici : les verdicts sont des SNAPSHOTS produits par le moteur
// (BORA) et recopiés tels quels. Le registre n'agrège rien et ne moyenne rien.

export type OrdLevel = 0 | 1 | 2 | 3;

export type ComboStatut = "candidate" | "retenue" | "en_cours" | "realisee" | "abandonnee";

export interface ComboVerdict {
  /** Potentiel d'amélioration δ⁺ (0=Nul … 3=Élevé). */
  gPlus: OrdLevel;
  /** Risque de dégradation δ⁻ (0=Nul … 3=Élevé). */
  dMinus: OrdLevel;
  /** Nom du scénario si la combinaison correspond à un scénario défini. */
  scenarioLabel?: string;
}

export interface ComboLevier {
  leverId: string;
  leverLabel: string;
  optionId: string;
  optionLabel: string;
}

export interface ComboComment {
  id: string;
  date: string;      // ISO
  auteur?: string;
  texte: string;
}

/** Un point de suivi : l'état constaté à une date, avec le verdict revu. */
export interface ComboSuiviPoint {
  id: string;
  date: string;      // YYYY-MM-DD
  statut: ComboStatut;
  verdict?: ComboVerdict;
  note?: string;
}

/** Preuve d'ancrage : ce qui rattache la combinaison au réel. Jamais convertie en score. */
export interface ComboPreuve {
  id: string;
  kind: "document" | "indicateur" | "entretien" | "systeme";
  label: string;
  ref?: string;      // lien, cote de document, nom de table…
  date: string;      // ISO
}

/** Position d'une partie prenante. Jamais comptée ni moyennée : lue une par une. */
export type AvisPosition = "pour" | "reserve" | "contre";

export interface ComboAvis {
  id: string;
  nom: string;
  role?: string;
  position: AvisPosition;
  /** Ce qu'il faut lever pour que la position change. */
  reserve?: string;
  levee?: boolean;
  date: string;      // ISO
}

/** Signature opposable : qui assume, à quelle date, sur quelle version. */
export interface ComboSignature {
  signataire: string;
  role?: string;
  date: string;      // ISO
  version: number;
}

/** Tenue d'un levier au constaté — jugement qualitatif, jamais un pourcentage. */
export type TenueLevier = "tenu" | "partiel" | "non_tenu" | "abandonne";

/**
 * Retour d'expérience : ce qui s'est réellement produit, confronté à ce qui
 * avait été signé. Le prévu reste `verdictInitial` (gelé) ; le constaté est un
 * verdict relevé à une date, levier par levier, avec la cause et la leçon.
 * Aucune conversion en score : on compare des niveaux ordinaux.
 */
export interface ComboConstat {
  id: string;
  date: string;                  // YYYY-MM-DD
  /** Verdict constaté sur le terrain, dans la même échelle que le prévu. */
  verdict: ComboVerdict;
  /** Tenue effective de chaque levier signé. */
  leviers: { leverId: string; tenue: TenueLevier; note?: string }[];
  /** Ce qui explique l'écart. */
  cause?: string;
  /** Ce qu'on retient pour la prochaine décision du même type. */
  lecon?: string;
  auteur?: string;
}



export interface TrackedCombo {
  id: string;
  sessionId: string;
  sessionTitle: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  statut: ComboStatut;
  leviers: ComboLevier[];
  /** Verdict à l'enregistrement — la référence contre laquelle on compare. */
  verdictInitial: ComboVerdict;
  comments: ComboComment[];
  timeline: ComboSuiviPoint[];
  preuves?: ComboPreuve[];
  avis?: ComboAvis[];
  /** Numéro de version, incrémenté à chaque modification substantielle. */
  version?: number;
  signature?: ComboSignature | null;
  /** Jeton du lien de partage, présent dès que la fiche est publiée. */
  shareToken?: string | null;
  /** Retours d'expérience : le constaté, confronté au prévu signé. */
  constats?: ComboConstat[];

}

const KEY = "aura-v4-combinaisons-suivies";

export const STATUT_META: Record<ComboStatut, { label: string; bg: string; color: string }> = {
  candidate:  { label: "Candidate",  bg: "#f3f4f6", color: "#4b5563" },
  retenue:    { label: "Retenue",    bg: "#ede9fe", color: "#6d28d9" },
  en_cours:   { label: "En cours",   bg: "#fef3c7", color: "#92400e" },
  realisee:   { label: "Réalisée",   bg: "#d1fae5", color: "#065f46" },
  abandonnee: { label: "Abandonnée", bg: "#fee2e2", color: "#b91c1c" },
};

export const PREUVE_META: Record<ComboPreuve["kind"], { label: string; icon: string }> = {
  document:    { label: "Document",    icon: "\u25a4" },
  indicateur:  { label: "Indicateur",  icon: "\u25a5" },
  entretien:   { label: "Entretien",   icon: "\u25cb" },
  systeme:     { label: "Système",     icon: "\u25a3" },
};

export const ORD_NAME: Record<OrdLevel, string> = { 0: "Nul", 1: "Faible", 2: "Modéré", 3: "Élevé" };

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadCombos(): TrackedCombo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as TrackedCombo[];
    if (!Array.isArray(raw)) return [];
    return raw.map(c => ({
      ...c,
      comments: c.comments ?? [],
      timeline: c.timeline ?? [],
      leviers: c.leviers ?? [],
      statut: c.statut ?? "candidate",
      preuves: c.preuves ?? [],
      avis: c.avis ?? [],
      version: c.version ?? 1,
      signature: c.signature ?? null,
      constats: c.constats ?? [],

    }));
  } catch { return []; }
}

function persist(list: TrackedCombo[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200))); } catch { /* stockage indisponible */ }
}

export function loadCombosForSession(sessionId: string): TrackedCombo[] {
  return loadCombos().filter(c => c.sessionId === sessionId);
}

export function saveCombo(input: {
  sessionId: string;
  sessionTitle: string;
  name: string;
  leviers: ComboLevier[];
  verdict: ComboVerdict;
  note?: string;
}): TrackedCombo {
  const now = new Date().toISOString();
  const combo: TrackedCombo = {
    id: uid("cmb"),
    sessionId: input.sessionId,
    sessionTitle: input.sessionTitle,
    name: input.name.trim() || "Combinaison sans nom",
    createdAt: now,
    updatedAt: now,
    statut: "candidate",
    leviers: input.leviers,
    verdictInitial: input.verdict,
    comments: input.note?.trim() ? [{ id: uid("cm"), date: now, texte: input.note.trim() }] : [],
    timeline: [{
      id: uid("pt"),
      date: now.slice(0, 10),
      statut: "candidate",
      verdict: input.verdict,
      note: "Enregistrement depuis Arbitrer",
    }],
    preuves: [],
    avis: [],
    version: 1,
    signature: null,
  };
  persist([combo, ...loadCombos()]);
  return combo;
}

export function updateCombo(id: string, patch: Partial<Pick<TrackedCombo, "name" | "statut">>): void {
  const list = loadCombos().map(c =>
    c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
  );
  persist(list);
}

export function deleteCombo(id: string): void {
  persist(loadCombos().filter(c => c.id !== id));
}

export function addComment(id: string, texte: string, auteur?: string): void {
  const t = texte.trim();
  if (!t) return;
  const list = loadCombos().map(c => c.id === id
    ? { ...c, updatedAt: new Date().toISOString(), comments: [...c.comments, { id: uid("cm"), date: new Date().toISOString(), texte: t, ...(auteur ? { auteur } : {}) }] }
    : c);
  persist(list);
}

export function deleteComment(id: string, commentId: string): void {
  persist(loadCombos().map(c => c.id === id
    ? { ...c, comments: c.comments.filter(x => x.id !== commentId) }
    : c));
}

export function addSuiviPoint(id: string, point: Omit<ComboSuiviPoint, "id">): void {
  const list = loadCombos().map(c => c.id === id
    ? {
        ...c,
        statut: point.statut,
        updatedAt: new Date().toISOString(),
        timeline: [...c.timeline, { ...point, id: uid("pt") }].sort((a, b) => a.date.localeCompare(b.date)),
      }
    : c);
  persist(list);
}

export function deleteSuiviPoint(id: string, pointId: string): void {
  persist(loadCombos().map(c => c.id === id
    ? { ...c, timeline: c.timeline.filter(p => p.id !== pointId) }
    : c));
}

/** Évolution du verdict entre l'enregistrement et le dernier point daté. */
export function verdictDrift(c: TrackedCombo): { gPlus: number; dMinus: number; last?: ComboVerdict } | null {
  const withVerdict = c.timeline.filter(p => p.verdict);
  const last = withVerdict.length ? withVerdict[withVerdict.length - 1].verdict! : undefined;
  if (!last) return null;
  return { gPlus: last.gPlus - c.verdictInitial.gPlus, dMinus: last.dMinus - c.verdictInitial.dMinus, last };
}

/* ── Ancrage réel ───────────────────────────────────────────────────────── */

export function addPreuve(id: string, p: Omit<ComboPreuve, "id" | "date">): void {
  if (!p.label.trim()) return;
  persist(loadCombos().map(c => c.id === id
    ? { ...c, updatedAt: new Date().toISOString(),
        preuves: [...(c.preuves ?? []), { ...p, label: p.label.trim(), id: uid("pr"), date: new Date().toISOString() }] }
    : c));
}

export function deletePreuve(id: string, preuveId: string): void {
  persist(loadCombos().map(c => c.id === id
    ? { ...c, preuves: (c.preuves ?? []).filter(p => p.id !== preuveId) }
    : c));
}

/* ── Boucle prévu / constaté ────────────────────────────────────────────── */

export const TENUE_META: Record<TenueLevier, { label: string; bg: string; color: string }> = {
  tenu:       { label: "Tenu",             bg: "#d1fae5", color: "#065f46" },
  partiel:    { label: "Partiellement",    bg: "#fef3c7", color: "#92400e" },
  non_tenu:   { label: "Non tenu",         bg: "#fee2e2", color: "#b91c1c" },
  abandonne:  { label: "Abandonné",        bg: "#f3f4f6", color: "#4b5563" },
};

/**
 * Consigne un constaté. Autorisé même sur une version signée : le prévu reste
 * gelé, le retour d'expérience s'ajoute par-dessus sans le réécrire.
 */
export function addConstat(id: string, c0: Omit<ComboConstat, "id">): void {
  persist(loadCombos().map(c => {
    if (c.id !== id) return c;
    const constat: ComboConstat = { ...c0, id: uid("cs") };
    return {
      ...c,
      updatedAt: new Date().toISOString(),
      constats: [...(c.constats ?? []), constat].sort((a, b) => a.date.localeCompare(b.date)),
      // Le constaté alimente aussi l'évolution : une seule chronologie.
      timeline: [...c.timeline, {
        id: uid("pt"), date: constat.date, statut: c.statut, verdict: constat.verdict,
        note: constat.cause ? `Constaté — ${constat.cause}` : "Constaté relevé",
      }].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }));
}

export function deleteConstat(id: string, constatId: string): void {
  persist(loadCombos().map(c => c.id === id
    ? { ...c, constats: (c.constats ?? []).filter(x => x.id !== constatId) }
    : c));
}

export interface RetexLecture {
  constat: ComboConstat;
  /** Écarts ordinaux, signés : > 0 = niveau plus haut que prévu. */
  dGPlus: number;
  dDMinus: number;
  /** Verdict de la boucle, en clair. */
  label: string;
  tone: string;
  bg: string;
  tenue: Record<TenueLevier, number>;
}

/** Lecture du dernier constaté face au prévu signé. Aucune moyenne. */
export function retexLecture(c: TrackedCombo): RetexLecture | null {
  const list = c.constats ?? [];
  if (!list.length) return null;
  const constat = list[list.length - 1];
  const dGPlus = constat.verdict.gPlus - c.verdictInitial.gPlus;
  const dDMinus = constat.verdict.dMinus - c.verdictInitial.dMinus;
  const tenue: Record<TenueLevier, number> = { tenu: 0, partiel: 0, non_tenu: 0, abandonne: 0 };
  constat.leviers.forEach(l => { tenue[l.tenue] += 1; });

  let label: string, tone: string, bg: string;
  if (dGPlus === 0 && dDMinus === 0) {
    label = "Décision confirmée par le terrain"; tone = "#065f46"; bg = "#d1fae5";
  } else if (dGPlus >= 0 && dDMinus <= 0) {
    label = "Mieux que prévu"; tone = "#065f46"; bg = "#d1fae5";
  } else if (dGPlus < 0 && dDMinus > 0) {
    label = "Décision démentie — potentiel en retrait, risque plus élevé"; tone = "#b91c1c"; bg = "#fee2e2";
  } else if (dGPlus < 0) {
    label = "Potentiel non atteint"; tone = "#b45309"; bg = "#fef3c7";
  } else {
    label = "Risque sous-estimé"; tone = "#b45309"; bg = "#fef3c7";
  }
  return { constat, dGPlus, dDMinus, label, tone, bg, tenue };
}

/** Leçons capitalisées sur l'ensemble du registre, telles qu'écrites. */
export function leconsRegistre(list: TrackedCombo[]): { comboName: string; date: string; lecon: string }[] {
  const out: { comboName: string; date: string; lecon: string }[] = [];
  list.forEach(c => (c.constats ?? []).forEach(x => {
    if (x.lecon?.trim()) out.push({ comboName: c.name, date: x.date, lecon: x.lecon.trim() });
  }));
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/* ── Décision collective ────────────────────────────────────────────────── */


export const AVIS_META: Record<AvisPosition, { label: string; bg: string; color: string; icon: string }> = {
  pour:    { label: "Pour",     bg: "#d1fae5", color: "#065f46", icon: "\u2713" },
  reserve: { label: "Réserve",  bg: "#fef3c7", color: "#92400e", icon: "!" },
  contre:  { label: "Contre",   bg: "#fee2e2", color: "#b91c1c", icon: "\u2715" },
};

export function addAvis(id: string, a: Omit<ComboAvis, "id" | "date" | "levee">): void {
  if (!a.nom.trim()) return;
  persist(loadCombos().map(c => c.id === id
    ? { ...c, updatedAt: new Date().toISOString(),
        avis: [...(c.avis ?? []), { ...a, nom: a.nom.trim(), reserve: a.reserve?.trim() || undefined, levee: false, id: uid("av"), date: new Date().toISOString() }] }
    : c));
}

export function toggleReserveLevee(id: string, avisId: string): void {
  persist(loadCombos().map(c => c.id === id
    ? { ...c, updatedAt: new Date().toISOString(),
        avis: (c.avis ?? []).map(a => a.id === avisId ? { ...a, levee: !a.levee } : a) }
    : c));
}

export function deleteAvis(id: string, avisId: string): void {
  persist(loadCombos().map(c => c.id === id
    ? { ...c, avis: (c.avis ?? []).filter(a => a.id !== avisId) }
    : c));
}

/** Lecture qualitative du collectif : aucune moyenne, aucun vote majoritaire. */
export function consensusState(c: TrackedCombo): { label: string; tone: string; bg: string; ouvertes: number } {
  const avis = c.avis ?? [];
  const ouvertes = avis.filter(a => a.reserve && !a.levee).length;
  const contre = avis.some(a => a.position === "contre");
  if (!avis.length) return { label: "Aucun avis recueilli", tone: "#4b5563", bg: "#f3f4f6", ouvertes: 0 };
  if (contre) return { label: "Opposition exprimée", tone: "#b91c1c", bg: "#fee2e2", ouvertes };
  if (ouvertes) return { label: `${ouvertes} réserve${ouvertes > 1 ? "s" : ""} à lever`, tone: "#92400e", bg: "#fef3c7", ouvertes };
  return { label: "Aucune réserve ouverte", tone: "#065f46", bg: "#d1fae5", ouvertes: 0 };
}

/* ── Gouvernance opposable ──────────────────────────────────────────────── */

export function signCombo(id: string, signataire: string, role?: string): void {
  if (!signataire.trim()) return;
  persist(loadCombos().map(c => c.id === id
    ? { ...c, updatedAt: new Date().toISOString(),
        signature: { signataire: signataire.trim(), role: role?.trim() || undefined, date: new Date().toISOString(), version: c.version ?? 1 } }
    : c));
}

/** Lever la signature ouvre une nouvelle version : la précédente reste datée dans la timeline. */
export function reopenCombo(id: string): void {
  persist(loadCombos().map(c => {
    if (c.id !== id) return c;
    const v = (c.version ?? 1) + 1;
    const note = c.signature
      ? `Signature levée (v${c.signature.version} signée par ${c.signature.signataire}) — passage en v${v}`
      : `Passage en v${v}`;
    return {
      ...c, version: v, signature: null, updatedAt: new Date().toISOString(),
      timeline: [...c.timeline, { id: uid("pt"), date: new Date().toISOString().slice(0, 10), statut: c.statut, note }],
    };
  }));
}

/** Piste d'audit lisible — exportable, sans aucun score. */
export function auditTrail(c: TrackedCombo): string {
  const L: string[] = [];
  L.push(`# ${c.name}  (v${c.version ?? 1})`);
  L.push(`Initiative : ${c.sessionTitle}`);
  L.push(`Statut : ${STATUT_META[c.statut].label}`);
  L.push(`Verdict d'origine : potentiel ${ORD_NAME[c.verdictInitial.gPlus]} · risque ${ORD_NAME[c.verdictInitial.dMinus]}`);
  L.push("");
  L.push("## Leviers");
  c.leviers.forEach(l => L.push(`- ${l.leverLabel} : ${l.optionLabel}`));
  L.push("");
  L.push("## Évolution");
  c.timeline.forEach(p => L.push(`- ${p.date} · ${STATUT_META[p.statut].label}${p.verdict ? ` · potentiel ${ORD_NAME[p.verdict.gPlus]} / risque ${ORD_NAME[p.verdict.dMinus]}` : ""}${p.note ? ` — ${p.note}` : ""}`));
  L.push("");
  L.push("## Preuves d'ancrage");
  const pr = c.preuves ?? [];
  if (!pr.length) L.push("- aucune preuve rattachée");
  pr.forEach(p => L.push(`- [${PREUVE_META[p.kind].label}] ${p.label}${p.ref ? ` (${p.ref})` : ""} — ${p.date.slice(0, 10)}`));
  L.push("");
  L.push("## Parties prenantes");
  const av = c.avis ?? [];
  if (!av.length) L.push("- aucun avis recueilli");
  av.forEach(a => L.push(`- [${AVIS_META[a.position].label}] ${a.nom}${a.role ? ` — ${a.role}` : ""}${a.reserve ? ` · réserve : ${a.reserve}${a.levee ? " (levée)" : " (ouverte)"}` : ""}`));
  L.push("");
  L.push("## Prévu / constaté");
  const cs = c.constats ?? [];
  if (!cs.length) L.push("- aucun constaté relevé");
  cs.forEach(x => {
    L.push(`- ${x.date} · constaté : potentiel ${ORD_NAME[x.verdict.gPlus]} / risque ${ORD_NAME[x.verdict.dMinus]} (prévu : potentiel ${ORD_NAME[c.verdictInitial.gPlus]} / risque ${ORD_NAME[c.verdictInitial.dMinus]})`);
    x.leviers.forEach(l => {
      const lev = c.leviers.find(y => y.leverId === l.leverId);
      L.push(`    · ${lev?.leverLabel ?? l.leverId} : ${TENUE_META[l.tenue].label}${l.note ? ` — ${l.note}` : ""}`);
    });
    if (x.cause) L.push(`    · cause de l'écart : ${x.cause}`);
    if (x.lecon) L.push(`    · leçon : ${x.lecon}`);
  });
  L.push("");
  L.push("## Commentaires");

  if (!c.comments.length) L.push("- aucun");
  c.comments.forEach(x => L.push(`- ${x.date.slice(0, 10)} : ${x.texte}`));
  L.push("");
  L.push(c.signature
    ? `## Signature\n${c.signature.signataire}${c.signature.role ? ` — ${c.signature.role}` : ""}, le ${c.signature.date.slice(0, 10)} (v${c.signature.version})`
    : "## Signature\nNon signée.");
  return L.join("\n");
}

export function downloadAudit(c: TrackedCombo): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([auditTrail(c)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${c.name.replace(/[^\w\-]+/g, "-").toLowerCase()}-v${c.version ?? 1}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Partage multi-utilisateurs ─────────────────────────────────────────── */

/** Mémorise le lien de partage renvoyé par la publication de la fiche. */
export function setShareToken(id: string, token: string): void {
  persist(loadCombos().map(c => c.id === id ? { ...c, shareToken: token } : c));
}

/**
 * Intègre les avis déposés à distance. Chaque avis distant garde son identité :
 * aucun cumul, aucun recomptage — on ajoute ce qui n'est pas déjà là.
 */
export function mergeRemoteAvis(
  id: string,
  remote: { id: string; nom: string; role?: string | null; position: AvisPosition; reserve?: string | null; levee?: boolean; created_at?: string }[],
): number {
  let added = 0;
  persist(loadCombos().map(c => {
    if (c.id !== id) return c;
    const existing = c.avis ?? [];
    const known = new Set(existing.map(a => a.id));
    const incoming = remote
      .filter(r => !known.has(`rav-${r.id}`))
      .map(r => ({
        id: `rav-${r.id}`,
        nom: r.nom,
        role: r.role || undefined,
        position: r.position,
        reserve: r.reserve || undefined,
        levee: Boolean(r.levee),
        date: r.created_at ?? new Date().toISOString(),
      }));
    added = incoming.length;
    if (!incoming.length) return c;
    return { ...c, updatedAt: new Date().toISOString(), avis: [...existing, ...incoming] };
  }));
  return added;
}
