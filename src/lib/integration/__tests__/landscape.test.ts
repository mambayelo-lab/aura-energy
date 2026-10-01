import { describe, it, expect } from "vitest";
import { parseDrawio, parseBpmn } from "../../v4/doc-formats";
import { importQuestionnaire } from "../questionnaire";
import { A_CONFIRMER, landscapeFromDiagram, landscapeFromText, landscapeToQuestionnaire, sanitizeLandscape } from "../landscape";
import { DRAWIO } from "../../../test/fixtures/diagrams";

describe("cartographie déduite d'un schéma du SI", () => {
  it("draw.io : applications, flux et objets lus sur les flux", async () => {
    const l = landscapeFromDiagram(await parseDrawio(DRAWIO));
    expect(l.apps.map(a => [a.name, a.kind])).toEqual([["SAP S/4HANA", "ERP"], ["Manhattan WMS", "WMS"], ["Data lake", "Data lake"]]);
    expect(l.flows.map(f => [f.from, f.to, f.objects.join("+"), f.confirm])).toEqual([["Manhattan WMS", "Data lake", "Stock", false], ["SAP S/4HANA", "Manhattan WMS", "Commande d'achat", false]]);
    expect(l.apps.find(a => a.name === "SAP S/4HANA")!.confirm).toBe(false);
  });
  it("BPMN : couloirs applicatifs, tâches exclues", () => {
    const l = landscapeFromDiagram(parseBpmn(`<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"><collaboration><participant id="p1" name="OMS"/><participant id="p2" name="Entrepôt"/><messageFlow id="m" sourceRef="p1" targetRef="p2"/></collaboration><process><task id="t" name="Préparer"/></process></definitions>`));
    expect(l.apps.map(a => a.name)).toEqual(["OMS", "Entrepôt"]);
    expect(l.flows[0].confirm).toBe(true); // flèche sans libellé : à confirmer
  });
  it("modèle de langage : une application absente du texte est écartée (rien d'inventé)", () => {
    const l = sanitizeLandscape({ applications: [{ nom: "Reflex WMS", type: "WMS", objets: ["Stock"] }, { nom: "Oracle EBS", type: "ERP" }], flux: [{ de: "Reflex WMS", vers: "Oracle EBS", objets: ["Stock"] }] }, "Schéma : Reflex WMS alimente le lac.")!;
    expect(l.apps.map(a => a.name)).toEqual(["Reflex WMS"]);
    expect(l.flows).toEqual([]);
    expect(l.apps[0].confirm).toBe(true);
  });
  it("texte sans modèle de langage : applications reconnues à leur nom, toutes à confirmer", () => {
    const l = landscapeFromText("Applications : SAP S/4HANA, Akeneo PIM, Shippeo\nSAP S/4HANA → Shippeo : expéditions");
    expect(l.apps.map(a => a.kind)).toEqual(["ERP", "PIM", "TMS"]);
    expect(l.apps.every(a => a.confirm)).toBe(true);
    expect(l.flows[0]).toMatchObject({ from: "SAP S/4HANA", to: "Shippeo", objects: ["Expédition"] });
  });
  it("questionnaire pré-rempli : maître proposé, accès à compléter, statut « à confirmer »", async () => {
    const rows = landscapeToQuestionnaire(landscapeFromDiagram(await parseDrawio(DRAWIO)));
    const stock = rows.filter(r => r.objet === "Stock");
    expect(new Set(stock.map(r => r.maitre))).toEqual(new Set(["Manhattan WMS"]));
    expect(rows.every(r => r.statut.includes(`maître ${A_CONFIRMER}`) && r.acces === "")).toBe(true);
    expect(new Set(rows.map(r => r.sources))).toEqual(new Set(["SAP S/4HANA", "Manhattan WMS", "Data lake"]));
    const setup = importQuestionnaire(rows);
    expect(setup.issues.some(i => /ligne incomplète/.test(i.message))).toBe(true); // à valider avant de connecter
  });
});
