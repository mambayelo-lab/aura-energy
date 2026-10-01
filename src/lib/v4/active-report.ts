// Rapport PDF de la décision ouverte, proposé en pièce jointe par les boutons
// « Envoyer par e-mail » des copilotes (Décider et Supply).
export type ReportMaker = () => Promise<{ filename: string; bytes: Uint8Array }>;
let current: ReportMaker | undefined;
export function setActiveReport(maker: ReportMaker | undefined) { current = maker; }
export function getActiveReport(): ReportMaker | undefined { return current; }

// Classement du moteur pour la décision ouverte : les copilotes vérifient
// que leurs réponses ne le contredisent pas (garde-fou « le LLM ne calcule jamais »).
export interface ActiveRanking { winner: string; options: string[] }
let ranking: ActiveRanking | undefined;
export function setActiveRanking(r: ActiveRanking | undefined) { ranking = r; }
export function getActiveRanking(): ActiveRanking | undefined { return ranking; }

/** Réponse du copilote filtrée : si elle désigne une autre option que celle du moteur, elle est remplacée. */
export async function guardAgainstEngine(text: string): Promise<{ text: string; rejected: boolean }> {
  const r = ranking;
  if (!r || r.options.length < 2) return { text, rejected: false };
  const { contradictsEngine } = await import("./decision-dialogue");
  if (!contradictsEngine(text, r.winner, r.options)) return { text, rejected: false };
  return { text: `Garde-fou : la réponse du modèle désignait une autre option que le calcul. Selon le moteur de décision (thèse Lô), « ${r.winner} » arrive en tête ; ouvrez « Ce qui ferait changer la décision » pour voir ce qui pourrait modifier ce choix.`, rejected: true };
}
