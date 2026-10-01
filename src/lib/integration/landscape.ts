// Cartographie déduite d'un schéma du SI client (image, PDF, draw.io, BPMN, ArchiMate, Visio…) :
// applications, flux et objets métier, puis questionnaire pré-rempli à valider.
// Rien n'est inventé : une application doit être nommée dans le schéma ; ce qui est
// déduit (type d'application, objet porté, maître) est marqué « à confirmer ».
import type { Diagram } from "../v4/doc-formats";
import { Q_COLUMNS, Q_ONTOLOGY, type QRow } from "./questionnaire";

export const A_CONFIRMER = "à confirmer";
export interface LApp { name: string; kind?: string; objects: string[]; confirm: boolean; evidence: string }
export interface LFlow { from: string; to: string; objects: string[]; label?: string; confirm: boolean }
export interface Landscape { apps: LApp[]; flows: LFlow[]; origin: "schéma" | "texte" | "modèle de langage"; notes: string[] }

export const OBJECTS = [...new Set(Q_ONTOLOGY.map(a => a.objet))];
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Type d'application reconnu à son nom, et objets dont il est le maître habituel (à confirmer).
const KINDS: { kind: string; re: RegExp; masters: string[]; carries: string[] }[] = [
  { kind: "ERP", re: /\b(erp|sap|s\/?4 ?hana|ecc|oracle (ebs|fusion|erp)|dynamics|navision|jde|jd edwards|sage|infor|netsuite|odoo|cegid|divalto)\b/, masters: ["Fournisseur", "Commande d'achat"], carries: ["Article", "Site"] },
  { kind: "PIM", re: /\b(pim|akeneo|salsify|referentiel produit|mdm produit|product information)\b/, masters: ["Article"], carries: [] },
  { kind: "WMS", re: /\b(wms|manhattan|reflex|generix|blue ?yonder wms|sap ewm|ewm|entrepot|warehouse)\b/, masters: ["Stock", "Site"], carries: ["Article"] },
  { kind: "TMS", re: /\b(tms|transport|shippeo|project44|alpega|transporeon)\b/, masters: ["Expédition"], carries: ["Commande d'achat"] },
  { kind: "OMS", re: /\b(oms|order management|e-?commerce|salesforce commerce|sfcc|shopify|magento|adobe commerce|commande client)\b/, masters: ["Commande client"], carries: ["Article"] },
  { kind: "APS", re: /\b(aps|s&op|sop|kinaxis|o9|blue ?yonder|anaplan|planification|forecast|prevision)\b/, masters: ["Prévision de demande"], carries: ["Article"] },
  { kind: "SRM", re: /\b(srm|coupa|ariba|ivalua|jaggaer|portail fournisseur|supplier portal)\b/, masters: [], carries: ["Fournisseur"] },
  { kind: "QMS", re: /\b(qms|qualite|quality|veeva|mastercontrol|non-?conformite)\b/, masters: ["Non-conformité"], carries: ["Article"] },
  { kind: "Data lake", re: /\b(data ?lake|lakehouse|datalake|snowflake|databricks|bigquery|entrepot de donnees|data warehouse|dwh)\b/, masters: ["Vente"], carries: [] },
  { kind: "POS", re: /\b(pos|caisse|point of sale)\b/, masters: ["Vente"], carries: [] },
  { kind: "CRM", re: /\b(crm|salesforce|hubspot)\b/, masters: [], carries: ["Commande client"] },
  { kind: "MES", re: /\b(mes|atelier|production)\b/, masters: [], carries: ["Stock"] },
];
const SYN: Record<string, RegExp> = {
  "Fournisseur": /fournisseur|supplier|vendor/, "Article": /article|produit|product|sku|item|ean|gtin|materi/, "Site": /\bsite|entrepot|magasin|store|facility|depot/,
  "Stock": /stock|inventaire|inventory/, "Commande d'achat": /commandes? d'achat|purchase order|\bpo\b|approvisionnement|appro/, "Expédition": /expedition|shipment|livraison|delivery|transport/,
  "Commande client": /commandes? clients?|sales order|\borders?\b|\bcommandes?\b/, "Vente": /vente|sales|ticket|sell-out/, "Prévision de demande": /prevision|forecast|demand/, "Non-conformité": /non-conformite|nonconform|qualite|quality|retour/,
};
export const objectsIn = (label = "") => {
  const t = fold(label), found = OBJECTS.filter(o => SYN[o]?.test(t));
  // « commande d'achat » n'est pas une commande client.
  return found.includes("Commande d'achat") && !/client|sales/.test(t) ? found.filter(o => o !== "Commande client") : found;
};
export const kindOf = (name: string) => KINDS.find(k => k.re.test(fold(name)));

// Éléments d'un schéma qui ne sont pas des applications (processus, acteurs, objets de données…).
const NOT_APP_TYPES = /^(activité|événement|décision|objet|lane|Business|Motivation|Strategy|Implementation|Junction|Grouping|Location|Stakeholder|Driver|Goal|Principle|Requirement|Constraint|Capability|ValueStream|Resource|CourseOfAction|DataObject|Artifact|Representation|Contract|Product)/;
const APP_TYPES = /^(participant|ApplicationComponent|ApplicationCollaboration|ApplicationInterface|SystemSoftware|Node|Device|TechnologyService|ApplicationService)$/;

function finalize(apps: LApp[], flows: LFlow[], origin: Landscape["origin"], notes: string[]): Landscape {
  // Objets portés : lus sur les flux (sûrs), sinon ceux du type d'application (à confirmer).
  for (const a of apps) {
    const fromFlows = flows.filter(f => f.from === a.name || f.to === a.name).flatMap(f => f.objects);
    const k = kindOf(a.name);
    a.kind = a.kind ?? k?.kind;
    const guess = k ? [...k.masters, ...k.carries] : [];
    a.objects = [...new Set([...a.objects, ...fromFlows, ...(fromFlows.length ? [] : guess)])];
    if (!fromFlows.length && guess.length) a.confirm = true;
  }
  if (!apps.length) notes.push("Aucune application reconnue dans ce document : cartographiez à la main ou chargez un schéma d'architecture.");
  return { apps, flows, origin, notes };
}

/** Schéma structuré (draw.io, BPMN, ArchiMate, Visio) : éléments et flux tels qu'écrits. */
export function landscapeFromDiagram(d: Diagram): Landscape {
  const label = new Map(d.nodes.map(n => [n.id, n.label]));
  const isApp = (n: { label: string; type?: string }) => (n.type && APP_TYPES.test(n.type)) || (!(n.type && NOT_APP_TYPES.test(n.type)) && (d.kind === "drawio" || d.kind === "vsdx") && n.label.length <= 60);
  const apps: LApp[] = [];
  for (const n of d.nodes) if (isApp(n) && !apps.some(a => a.name === n.label)) apps.push({ name: n.label, objects: [], confirm: !(n.type && APP_TYPES.test(n.type)) && !kindOf(n.label), evidence: `élément « ${n.label} » du schéma` });
  const names = new Set(apps.map(a => a.name));
  const flows: LFlow[] = [];
  for (const e of d.edges) {
    const from = label.get(e.from), to = label.get(e.to);
    if (!from || !to || !names.has(from) || !names.has(to) || from === to) continue;
    const objects = objectsIn(e.label);
    flows.push({ from, to, objects, label: e.label, confirm: !objects.length });
  }
  // Données (BPMN, ArchiMate) reliées à une application : objets portés.
  const dataNodes = d.nodes.filter(n => n.type && /objet|stockage|DataObject|Artifact/.test(n.type));
  for (const dn of dataNodes) for (const e of d.edges.filter(x => x.from === dn.id || x.to === dn.id)) {
    const other = label.get(e.from === dn.id ? e.to : e.from), app = apps.find(a => a.name === other);
    if (app) app.objects.push(...objectsIn(dn.label));
  }
  return finalize(apps, flows, "schéma", []);
}

/** Texte libre (transcription d'une image, PDF…) sans modèle de langage : applications reconnues à leur nom. */
export function landscapeFromText(text: string): Landscape {
  const apps: LApp[] = [];
  for (const piece of text.split(/\n|;|,|\||→|->|:/)) {
    const name = piece.replace(/^[-•*\s\d.)]+/, "").replace(/\(.*?\)/g, "").trim();
    if (name.length < 2 || name.length > 40) continue;
    const k = kindOf(name);
    if (k && !apps.some(a => fold(a.name) === fold(name))) apps.push({ name, kind: k.kind, objects: [], confirm: true, evidence: `texte « ${name} »` });
  }
  const flows: LFlow[] = [];
  for (const m of text.matchAll(/([^\n→>-]{2,40}?)\s*(?:→|->)\s*([^\n:]{2,40}?)(?:\s*:\s*([^\n]+))?$/gm)) {
    const from = apps.find(a => fold(m[1]).includes(fold(a.name))), to = apps.find(a => fold(m[2]).includes(fold(a.name)));
    if (from && to && from !== to) flows.push({ from: from.name, to: to.name, objects: objectsIn(m[3]), label: m[3]?.trim(), confirm: true });
  }
  return finalize(apps, flows, "texte", ["Lecture sans modèle de langage : applications reconnues à leur nom, tout est à confirmer."]);
}

/** Réponse du modèle de langage : seules les applications nommées dans le texte source sont gardées. */
export function sanitizeLandscape(raw: unknown, source: string): Landscape | null {
  const r = raw as { applications?: { nom?: string; type?: string; objets?: string[] }[]; flux?: { de?: string; vers?: string; objets?: string[]; libelle?: string }[] };
  if (!r || !Array.isArray(r.applications)) return null;
  const src = fold(source);
  const apps: LApp[] = [];
  for (const a of r.applications) {
    const name = String(a?.nom ?? "").trim();
    if (!name || name.length > 60 || !src.includes(fold(name)) || apps.some(x => fold(x.name) === fold(name))) continue;
    const objects = (a.objets ?? []).filter(o => OBJECTS.includes(o));
    apps.push({ name, kind: typeof a.type === "string" ? a.type.slice(0, 30) : kindOf(name)?.kind, objects, confirm: true, evidence: `nommée dans le document` });
  }
  const names = new Set(apps.map(a => a.name));
  const flows: LFlow[] = (r.flux ?? []).map(f => ({ from: String(f?.de ?? ""), to: String(f?.vers ?? ""), objects: (f?.objets ?? []).filter(o => OBJECTS.includes(o)), label: f?.libelle ? String(f.libelle).slice(0, 80) : undefined, confirm: true }))
    .filter(f => names.has(f.from) && names.has(f.to) && f.from !== f.to);
  // Une application reconnue à son nom, dont un objet est lu sur un flux libellé dans le texte, n'est plus « à confirmer ».
  for (const a of apps) if (kindOf(a.name) && flows.some(f => (f.from === a.name || f.to === a.name) && f.label && src.includes(fold(f.label)))) a.confirm = false;
  return finalize(apps, flows, "modèle de langage", []);
}

export const LANDSCAPE_PROMPT = `On te donne le texte d'un schéma ou d'un document d'architecture du SI d'un client (transcription d'image, PDF, diagramme).
Relève uniquement ce qui y est écrit. Réponds en JSON strict :
{"applications": [{"nom": "nom exact tel qu'écrit", "type": "ERP|PIM|WMS|TMS|OMS|APS|SRM|QMS|Data lake|POS|CRM|MES|autre", "objets": ["objets métier portés"]}],
 "flux": [{"de": "nom exact", "vers": "nom exact", "objets": ["objets métier échangés"], "libelle": "libellé du flux tel qu'écrit, sinon vide"}]}
Objets métier possibles : ${OBJECTS.join(", ")}.
N'ajoute aucune application absente du texte. Si un flux ou un objet est déduit d'une flèche sans libellé, garde-le : il sera marqué « à confirmer ».`;

/** Maître proposé pour un objet : l'application dont c'est le rôle habituel, sinon la première qui le porte. */
function masterOf(l: Landscape, objet: string): { app: string; sure: boolean } | null {
  const holders = l.apps.filter(a => a.objects.includes(objet));
  if (!holders.length) return null;
  const typical = holders.find(a => kindOf(a.name)?.masters.includes(objet) || KINDS.find(k => k.kind === a.kind)?.masters.includes(objet));
  return { app: (typical ?? holders[0]).name, sure: false };
}

/** Questionnaire pré-rempli : une ligne par attribut et par application qui porte l'objet. Accès et champs restent à compléter. */
export function landscapeToQuestionnaire(l: Landscape): (QRow & { statut: string })[] {
  const rows: (QRow & { statut: string })[] = [];
  for (const objet of OBJECTS) {
    const m = masterOf(l, objet);
    if (!m) continue;
    for (const a of l.apps.filter(x => x.objects.includes(objet))) {
      for (const attr of Q_ONTOLOGY.filter(o => o.objet === objet)) {
        rows.push({ objet, attribut: attr.attribut, description: attr.description, sources: a.name, maitre: m.app, mode: "", acces: "", champ: "", cle: attr.key ? "oui" : "non", frequence: "", contact: "", tolerance: "",
          statut: [a.confirm ? `application ${A_CONFIRMER}` : "", `maître ${A_CONFIRMER}`, "accès et champ à compléter"].filter(Boolean).join(" · ") });
      }
    }
  }
  return rows;
}

export function questionnaireSheetFrom(l: Landscape) {
  const header = [...Q_COLUMNS, "Statut"];
  const rows = landscapeToQuestionnaire(l).map(r => [r.objet, r.attribut, r.description, r.sources, r.maitre, r.mode, r.acces, r.champ, r.cle, r.frequence, r.contact, r.tolerance, r.statut]);
  const apps = [["Application", "Type", "Objets portés", "Statut", "Source"], ...l.apps.map(a => [a.name, a.kind ?? "", a.objects.join(", "), a.confirm ? A_CONFIRMER : "lu dans le schéma", a.evidence])];
  const flows = [["De", "Vers", "Objets", "Libellé", "Statut"], ...l.flows.map(f => [f.from, f.to, f.objects.join(", "), f.label ?? "", f.confirm ? A_CONFIRMER : "lu dans le schéma"])];
  return [
    { name: "Questionnaire", headerRow: 0, rows: [header, ...rows], widths: [18, 26, 40, 24, 20, 16, 48, 22, 12, 16, 22, 18, 40] },
    { name: "Applications", headerRow: 0, rows: apps, widths: [28, 12, 40, 18, 40] },
    { name: "Flux", headerRow: 0, rows: flows, widths: [24, 24, 36, 36, 18] },
  ];
}

/** Fusionne plusieurs cartographies (plusieurs schémas chargés ensemble). */
export function mergeLandscapes(ls: Landscape[]): Landscape {
  const apps: LApp[] = [], flows: LFlow[] = [];
  for (const l of ls) {
    for (const a of l.apps) { const x = apps.find(y => fold(y.name) === fold(a.name)); if (x) { x.objects = [...new Set([...x.objects, ...a.objects])]; x.confirm = x.confirm && a.confirm; x.kind ??= a.kind; } else apps.push({ ...a, objects: [...a.objects] }); }
    for (const f of l.flows) if (!flows.some(g => g.from === f.from && g.to === f.to && g.label === f.label)) flows.push(f);
  }
  return { apps, flows, origin: ls[0]?.origin ?? "schéma", notes: [...new Set(ls.flatMap(l => l.notes))] };
}
