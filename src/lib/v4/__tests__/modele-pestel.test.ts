import { describe, expect, it } from "vitest";
import { applyProposal, sanitizeProposal, deduceFromDescription } from "../decision-dialogue";
import { newSession } from "../atelier-store";
import { getLeafCriteria } from "../atelier-compute";

const q = "Retard transport critique sur l'axe Asie-Europe : passer une partie en aérien, rerouter par un hub alternatif ou attendre ?";
const llm = {
  enjeu: "Protéger le service client face au retard maritime.", options: ["Passer une partie en aérien", "Rerouter par un hub alternatif", "Attendre"],
  criteria: [{ label: "Délai de livraison", importance: "Essentiel" }, { label: "Coût de transport", importance: "Important" }, { label: "Empreinte carbone", importance: "Secondaire" }],
  impacts: {}, risques: ["Pénalités clients", "Saturation du hub"],
  modele: { objectifs: [
    { label: "Service client", criteres: [{ label: "Délais", indicateurs: [{ label: "Délai de transit Asie-Europe (jours)", why: "Ce que le retard allonge." }, { label: "Taux OTIF (%)", why: "Commandes complètes et à l'heure." }, { label: "Commandes en retard par semaine", why: "Volume exposé." }] }, { label: "Fiabilité", indicateurs: [{ label: "Variabilité du transit", why: "Prévisibilité." }] }] },
    { label: "Coût et climat", criteres: [{ label: "Coûts", indicateurs: [{ label: "Surcoût par conteneur", why: "Prix de l'accélération." }, { label: "Émissions par tonne-km", why: "Engagement climat." }, { label: "Pénalités contractuelles", why: "Retards facturés." }, { label: "Coût de stockage tampon", why: "Stock de sécurité." }, { label: "Indicateur en trop", why: "Hors cible." }] }] },
  ], leviers: [
    { label: "Mode de transport", options: [{ label: "Aérien partiel sur l'urgent", why: "Accélère le critique." }, { label: "Ferroviaire Chine-Europe", why: "Compromis délai-coût." }, { label: "Maritime standard", why: "Référence." }] },
    { label: "Hub de contournement", options: [{ label: "Hub méditerranéen", why: "Contourne le blocage." }, { label: "Hub actuel", why: "Référence." }] },
    { label: "Priorisation", options: [{ label: "Clients stratégiques d'abord", why: "Protège le chiffre d'affaires." }, { label: "Premier arrivé", why: "Neutre." }] },
  ] },
  pestel: { P: "Tensions en mer Rouge", E: "Hausse du fret aérien", En: "Objectifs de réduction des émissions" },
  questions: ["Quelles commandes sont critiques ?", "Quelle capacité aérienne est disponible ?"],
};

describe("modèle propre au problème, PESTEL et questions de cadrage", () => {
  it("le modèle du LLM est retenu, ramené aux cibles (5 à 8 indicateurs, 2 ou 3 critères, 3 à 5 leviers)", () => {
    const p = sanitizeProposal(llm as never, q)!;
    expect(p.modele).toBeDefined();
    const s = { ...newSession({ contextRaw: q }), ...applyProposal(newSession({ contextRaw: q }), p, q) } as ReturnType<typeof newSession>;
    const leaves = getLeafCriteria(s.criteria);
    expect(leaves.length).toBeGreaterThanOrEqual(5); expect(leaves.length).toBeLessThanOrEqual(8);
    expect(leaves.map(c => c.label)).toContain("Délai de transit Asie-Europe (jours)");
    expect(s.leviersDef.length).toBeGreaterThanOrEqual(3); expect(s.leviersDef.length).toBeLessThanOrEqual(5);
    expect(s.leviersDef.map(l => l.label)).toContain("Hub de contournement");
    for (const l of s.leviersDef) { expect(l.options.length).toBeGreaterThanOrEqual(2); expect(l.options.length).toBeLessThanOrEqual(4); }
    // PESTEL : conservé et repris dans les risques ; questions de cadrage conservées.
    expect(s.elicitation?.pestelAnswers).toMatchObject({ P: "Tensions en mer Rouge" });
    expect(s.elicitation?.risques?.some(r => /Politique : Tensions en mer Rouge/.test(r))).toBe(true);
    expect(s.elicitation?.questionsCadrage).toEqual(llm.questions);
  });
  it("sans LLM : PESTEL et questions de cadrage de secours, cibles tenues", () => {
    const d = deduceFromDescription(q);
    const s = { ...newSession({ contextRaw: q }), ...applyProposal(newSession({ contextRaw: q }), d.proposal, q) } as ReturnType<typeof newSession>;
    expect(Object.keys(s.elicitation?.pestelAnswers ?? {}).length).toBeGreaterThanOrEqual(3);
    expect(s.elicitation?.questionsCadrage?.length).toBe(3);
    const n = getLeafCriteria(s.criteria).length;
    expect(n).toBeGreaterThanOrEqual(5); expect(n).toBeLessThanOrEqual(8);
  });
});
