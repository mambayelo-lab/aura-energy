import { describe, it, expect } from "vitest";
import { docsContext, fallbackCitations, sanitizeCitations } from "../doc-citations";

const docs = [{ name: "note-achats.pdf", text: "Contexte général du groupe.\nLe fournisseur SUP-003 livre 62 % des composants critiques. Un second fournisseur qualifié demande six mois d'audit.\nLa cantine rouvre lundi." }];

describe("documents joints au dialogue", () => {
  it("citations du modèle : seules les copies littérales sont gardées, jamais une invention", () => {
    const c = sanitizeCitations([
      { extrait: "Le fournisseur SUP-003 livre 62 % des composants critiques.", fichier: "note-achats.pdf", usage: "dépendance fournisseur" },
      { extrait: "Le fournisseur SUP-003 livre 80 % des composants.", fichier: "note-achats.pdf", usage: "inventé" },
      { extrait: "Un second fournisseur qualifié demande six mois d'audit.", fichier: "autre.pdf", usage: "délai de qualification" },
    ], docs);
    expect(c.map(x => x.extrait)).toEqual(["Le fournisseur SUP-003 livre 62 % des composants critiques.", "Un second fournisseur qualifié demande six mois d'audit."]);
    expect(c[1].fichier).toBe("note-achats.pdf");
    expect(sanitizeCitations("n'importe quoi", docs)).toEqual([]);
  });
  it("sans modèle de langage : phrases proches de la question, citées telles quelles", () => {
    const c = fallbackCitations("Double sourcing ou accord-cadre avec notre fournisseur unique de composants critiques ?", docs);
    expect(c.length).toBeGreaterThan(0);
    for (const x of c) expect(docs[0].text).toContain(x.extrait);
    expect(c.some(x => /cantine/.test(x.extrait))).toBe(false);
  });
  it("contexte envoyé au modèle borné", () => {
    expect(docsContext([{ name: "a", text: "x ".repeat(50_000) }]).length).toBeLessThanOrEqual(6000);
  });
});
