// aura.tsx — site vitrine Aura.
//
// ── Parti pris éditorial (assumé, et pourquoi) ────────────────────────────
// Ce que l'on vend n'est pas un logiciel de plus : c'est une MÉTHODE OUTILLÉE.
// L'acheteur (COMEX, DSI, direction de la transformation) n'achète pas des
// écrans, il achète une manière de trancher qui reste défendable six mois plus
// tard. La page suit donc l'ordre d'une note de conseil : promesse → méthode →
// produits → fondement scientifique → terrains → auteur → passage à l'acte.
//
// ── Ce qu'on emprunte à la concurrence, et ce qu'on refuse ────────────────
// 1000minds : la méthode (PAPRIKA) est mise en avant AVANT le produit, avec
//   une entrée par secteur. On reprend méthode nommée, parcours en 4 temps et
//   terrains, parce qu'ils rassurent l'acheteur non technique.
// Geeglee : décision SANS donnée, explicabilité totale. On reprend la double
//   entrée (avec / sans données), et on va plus loin : eux s'arrêtent à
//   l'espace de décision, Aura enchaîne sur l'architecture.
// Ce qu'on refuse : murs de logos, prix et récompenses non vérifiables.
//
// ── Ce qui change dans cette version ─────────────────────────────────────
// 1. BILINGUE. Tout le texte vit dans lib/vitrine-copy.ts (FR / EN) ; ce
//    fichier ne contient plus que la mise en page. Un seul basculement en
//    barre, mémorisé pour la visite.
// 2. MARQUE. Le signe AuraMark (« a » latin / « lām » arabe) remplace le mot
//    seul, en noir sur blanc.
// 3. IMAGES. Une bannière pleine largeur ouvre la page sur le collectif —
//    plusieurs lectures d'un même classement — avant tout argument produit.
//
// Registre visuel : MODERNE, pas futuriste. Blanc / indigo, typographie
// éditoriale, respiration. Cohérent avec le thème produit.

import React, { useEffect, useState } from "react";
import { SOLUTIONS, PRODUITS, SOL_COPY, type ProduitId } from "../../lib/vitrine-solutions";
// Identité citable du moteur ordinal : nom, axiomes, exemples reproductibles.
import { BORA, BORA_AXIOMS, BORA_EXAMPLES } from "../../lib/v4/bora";
// Texte du site, deux langues, hors du JSX.
import { VITRINE, type Lang } from "../../lib/vitrine-copy";
// Marque : un tracé, deux lectures.
import { AuraArtwork, AuraMark } from "../aura/AuraMark";
// Teaser de découverte (10 s, sans texte incrusté : la page reste bilingue).
// Teaser bilingue : deux masters, même montage, voix off FR ou EN.
import teaserFr from "../../assets/aura-teaser-fr.mp4.asset.json";
import teaserEn from "../../assets/aura-teaser-en.mp4.asset.json";
// Poster : première image du teaser, pour éviter un rectangle noir avant lecture.
import teaserPoster from "../../assets/aura-teaser-poster.jpg";
// Couche commerciale : accroche, valeur nommée, cas concrets, entrées par rôle.
import { COM } from "../../lib/vitrine-commercial";
import comiteImg from "../../assets/vitrine-com-comite.jpg";
import donneesImg from "../../assets/vitrine-com-donnees.jpg";
// Une image par cas concret, dans l'ordre de COM.cas.items (énergie, retail, supply).
import casEnergie from "../../assets/sector/energy-decarbonation.jpg";
import casRetail from "../../assets/sector/retail-assortiment.jpg";
import casSupply from "../../assets/sector/supply-resilience.jpg";
const CAS_IMGS = [casEnergie, casRetail, casSupply];
// Attestation du prix de meilleure thèse — servie telle quelle, vérifiable.
import prixThese from "../../assets/prix-these-afis.pdf.asset.json";

// Références publiées de l'équipe d'encadrement. Elles sont citées parce que le
// raisonnement ordinal d'Aura en descend directement — chaque entrée est
// consultable, aucun titre n'est reformulé ni embelli.
const PUBLICATIONS: { t: string; a: string; r: string; url: string }[] = [
  {
    t: "Tracking the consequences of design decisions in mechatronic Systems Engineering",
    a: "P. Couturier, M. Lô, A. Imoussaten, V. Chapurlat, J. Montmain",
    r: "Mechatronics, 2014",
    url: "https://doi.org/10.1016/j.mechatronics.2014.03.004",
  },
  {
    t: "A qualitative method for evaluation in conceptual design",
    a: "P. Couturier, A. Imoussaten, V. Chapurlat, J. Montmain",
    r: "IFAC-PapersOnLine, 2015",
    url: "https://doi.org/10.1016/j.ifacol.2015.06.168",
  },
  // Publications où Mambaye Lô est premier auteur : la filiation du moteur
  // ordinal part de là, avant la thèse de 2013.
  {
    t: "Evaluating Alternatives for Designing Mechatronic Systems in a Systems Engineering Context",
    a: "M. Lô, P. Couturier, V. Chapurlat",
    r: "INCOSE Insight, 2013",
    url: "https://doi.org/10.1002/inst.201316416",
  },
  {
    t: "Needs for Tracing the Consequences of Decisions in Mechatronics Design",
    a: "M. Lô, P. Couturier",
    r: "ASME ESDA, 2012",
    url: "https://doi.org/10.1115/ESDA2012-82230",
  },
];
const THESE_URL = "https://theses.hal.science/tel-00918890";


import heroImg from "../../assets/vitrine-hero.jpg";
import banniereImg from "../../assets/vitrine-banniere.jpg";
import archImg from "../../assets/vitrine-architecture.jpg";
import ontoImg from "../../assets/vitrine-ontologie.jpg";
// Schémas au trait, un par compartiment : illustrer le message, jamais décorer.
import methodeImg from "../../assets/vitrine-methode.jpg";
import partiPrisImg from "../../assets/vitrine-parti-pris.jpg";
import partiesImg from "../../assets/vitrine-parties.jpg";
// Illustrations sectorielles : Supply chain, Énergie & Utilities, Retail.
import scResilienceImg from "../../assets/sector/supply-resilience.jpg";
import scIntelligentImg from "../../assets/sector/supply-intelligent.jpg";
import scDurableImg from "../../assets/sector/supply-sustainability.jpg";
import enDecarbImg from "../../assets/sector/energy-decarbonation.jpg";
import enGridImg from "../../assets/sector/energy-grid.jpg";
import enReseauxImg from "../../assets/sector/energy-reseaux.jpg";
import enMixImg from "../../assets/sector/energy-mix.jpg";
import retailImg from "../../assets/sector/retail-omnicanal.jpg";
import retailAssortImg from "../../assets/sector/retail-assortiment.jpg";
import retailReseauImg from "../../assets/sector/retail-reseau.jpg";
import retailDemarqueImg from "../../assets/sector/retail-demarque.jpg";
import retailFideliteImg from "../../assets/sector/retail-fidelite.jpg";

/**
 * Illustrations sectorielles. Chaque entrée nomme l'enjeu et l'arbitrage qu'il
 * impose — pas de chiffre, pas de promesse : ce que le décideur doit trancher.
 */
const SECTOR_ILLUS: {
  img: string;
  fr: { dom: string; titre: string; arbitrage: string; alt: string };
  en: { dom: string; titre: string; arbitrage: string; alt: string };
}[] = [
  {
    img: scResilienceImg,
    fr: { dom: "Supply chain", titre: "Résilience des flux", arbitrage: "Doubler une source ou tenir le stock : deux réponses au même choc, deux profils de risque qui ne se compensent pas.", alt: "Réseau logistique avec route interrompue et itinéraires de contournement" },
    en: { dom: "Supply chain", titre: "Flow resilience", arbitrage: "Dual-sourcing or buffer stock: two answers to the same shock, two risk profiles that do not offset each other.", alt: "Logistics network with a disrupted route and alternate paths" },
  },
  {
    img: scIntelligentImg,
    fr: { dom: "Supply chain", titre: "Supply chain intelligente", arbitrage: "La donnée temps réel n'arbitre pas seule : elle change les options ouvertes, pas le critère qui reste rédhibitoire.", alt: "Schéma de capteurs alimentant une grille de décision logistique" },
    en: { dom: "Supply chain", titre: "Intelligent supply chain", arbitrage: "Real-time data does not decide: it changes the options on the table, not the criterion that remains a deal-breaker.", alt: "Sensors feeding a logistics decision lattice" },
  },
  {
    img: scDurableImg,
    fr: { dom: "Supply chain", titre: "Durabilité et boucles matière", arbitrage: "Empreinte, service et coût : un gain sur l'un dégrade souvent l'autre. L'arbitrage se dit, il ne se moyenne pas.", alt: "Boucle circulaire de flux matière" },
    en: { dom: "Supply chain", titre: "Sustainability and material loops", arbitrage: "Footprint, service level and cost: a gain on one often degrades another. The trade-off is stated, never averaged.", alt: "Circular material flow loop" },
  },
  {
    img: enDecarbImg,
    fr: { dom: "Énergie & Utilities", titre: "Décarbonation", arbitrage: "Chaque palier de trajectoire suppose un levier engagé. Le suivant ne compense pas le précédent s'il est manqué.", alt: "Trajectoire de réduction des émissions en paliers" },
    en: { dom: "Energy & Utilities", titre: "Decarbonation", arbitrage: "Each step of the pathway commits a lever. A later step does not make up for one that was missed.", alt: "Stepwise emissions reduction pathway" },
  },
  {
    img: enGridImg,
    fr: { dom: "Énergie & Utilities", titre: "Flexibilité du réseau", arbitrage: "Renforcer le réseau, stocker ou effacer la pointe : trois options, un seul critère de sûreté non négociable.", alt: "Réseau électrique, stockage et courbe de pointe lissée" },
    en: { dom: "Energy & Utilities", titre: "Grid flexibility", arbitrage: "Reinforce, store or shave the peak: three options, one non-negotiable safety criterion.", alt: "Power grid with storage and a flattened peak curve" },
  },
  {
    img: enReseauxImg,
    fr: { dom: "Énergie & Utilities", titre: "Renouvellement des réseaux", arbitrage: "On ne renouvelle pas tout : quel tronçon d'abord, sur quel critère assumé devant le régulateur.", alt: "Tronçons de réseau enterré, certains priorisés" },
    en: { dom: "Energy & Utilities", titre: "Network asset renewal", arbitrage: "You cannot renew everything: which segment first, on which criterion you can defend to the regulator.", alt: "Buried network segments with prioritised sections" },
  },
  {
    img: enMixImg,
    fr: { dom: "Énergie & Utilities", titre: "Mix et nouvelles molécules", arbitrage: "Renouvelable, nucléaire, hydrogène : la décision se joue sur la faisabilité industrielle, pas sur un score composite.", alt: "Sources d'énergie reliées à un nœud central" },
    en: { dom: "Energy & Utilities", titre: "Mix and new molecules", arbitrage: "Renewables, nuclear, hydrogen: the decision turns on industrial feasibility, not a composite score.", alt: "Energy sources connected to a central node" },
  },
  {
    img: retailImg,
    fr: { dom: "Retail & distribution", titre: "Promesse omnicanale", arbitrage: "Délai promis, coût du dernier kilomètre, disponibilité en magasin : trois exigences à tenir ensemble ou à hiérarchiser.", alt: "Canaux de vente et flux logistiques convergents" },
    en: { dom: "Retail & distribution", titre: "Omnichannel promise", arbitrage: "Promised lead time, last-mile cost, in-store availability: hold all three or rank them explicitly.", alt: "Sales channels and logistics flows converging" },
  },
  {
    img: retailAssortImg,
    fr: { dom: "Retail & distribution", titre: "Assortiment et prix", arbitrage: "Réduire l'assortiment simplifie l'exécution et ferme des ventes : deux effets opposés qui ne s'annulent pas.", alt: "Linéaire de produits, références retenues et étiquettes prix" },
    en: { dom: "Retail & distribution", titre: "Assortment and price", arbitrage: "Trimming the range simplifies execution and closes sales: two opposite effects that do not cancel out.", alt: "Shelf of products with selected references and price tags" },
  },
  {
    img: retailReseauImg,
    fr: { dom: "Retail & distribution", titre: "Réseau de points de vente", arbitrage: "Fermer, transformer ou ouvrir : la décision se défend sur un critère assumé, pas sur une moyenne de rentabilité.", alt: "Carte régionale de magasins, un site fermé et un site ouvert" },
    en: { dom: "Retail & distribution", titre: "Store network", arbitrage: "Close, convert or open: the decision is defended on a stated criterion, not on an average of returns.", alt: "Regional store map with one closure and one opening" },
  },
  {
    img: retailDemarqueImg,
    fr: { dom: "Retail & distribution", titre: "Démarque et maîtrise des flux", arbitrage: "Contrôler à la source, équiper le magasin ou revoir le processus : trois réponses, une seule contrainte d'exploitation.", alt: "Flux entrepôt vers magasin avec dérivations et point de contrôle" },
    en: { dom: "Retail & distribution", titre: "Shrink and flow control", arbitrage: "Control at source, equip the store or redesign the process: three answers, one operating constraint.", alt: "Warehouse-to-store flow with diversions and a control point" },
  },
  {
    img: retailFideliteImg,
    fr: { dom: "Retail & distribution", titre: "Fidélité et relation client", arbitrage: "Remise, service ou abonnement : ce qui retient un segment fragilise souvent la marge d'un autre.", alt: "Cercles de clients reliés à des offres, un parcours mis en avant" },
    en: { dom: "Retail & distribution", titre: "Loyalty and customer relationship", arbitrage: "Discount, service or subscription: what retains one segment often erodes the margin of another.", alt: "Customer rings linked to offers with one path highlighted" },
  },
];

/** Rattache un secteur Solutions au libellé de domaine des illustrations. */
const SECTOR_DOM: Record<string, { fr: string; en: string }> = {
  retail: { fr: "Retail & distribution", en: "Retail & distribution" },
  energie: { fr: "Énergie & Utilities", en: "Energy & Utilities" },
  supply: { fr: "Supply chain", en: "Supply chain" },
};


const INDIGO = "#6C5CE7";
const wrap: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 28px" };
const eyebrow: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 800, letterSpacing: ".12em",
  textTransform: "uppercase", color: INDIGO,
};
const h2: React.CSSProperties = {
  fontFamily: "var(--font-display, Georgia, serif)", fontSize: "clamp(24px, 2.4vw, 34px)",
  fontWeight: 600, letterSpacing: "-.02em", color: "#151329", margin: "10px 0 0",
};
const lead: React.CSSProperties = { fontSize: 15, lineHeight: 1.65, color: "#4b4864", margin: "12px 0 0" };
const body: React.CSSProperties = { fontSize: 13.5, color: "#5a5677", lineHeight: 1.65 };
const cardS: React.CSSProperties = {
  border: "1px solid #e8e5f6", borderRadius: 8, background: "#fff",
  padding: "22px 24px", boxShadow: "0 1px 2px rgb(21 19 41 / .03), 0 12px 32px rgb(108 92 231 / .06)",
};
const cta: React.CSSProperties = {
  padding: "13px 26px", borderRadius: 999, background: INDIGO, color: "#fff",
  fontSize: 13, fontWeight: 700, textDecoration: "none",
};
const ctaGhost: React.CSSProperties = {
  padding: "13px 26px", borderRadius: 999, background: "#fff", color: "#2f2b52",
  border: "1px solid #ddd8f4", fontSize: 13, fontWeight: 700, textDecoration: "none",
};
const navLink: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, color: "#4b4864", textDecoration: "none" };
const sectionAlt: React.CSSProperties = {
  padding: "72px 0", background: "#faf9ff",
  borderTop: "1px solid #eeecf8", borderBottom: "1px solid #eeecf8",
};
const imgS: React.CSSProperties = {
  width: "100%", height: "auto", borderRadius: 8, border: "1px solid #eeecf8", background: "#fff",
};

const LANG_KEY = "aura_vitrine_lang";

// ── Pictos ───────────────────────────────────────────────────────────────────
// Tracés au trait, 1.4px, indigo, jamais remplis : ils ponctuent la lecture
// sans introduire un second registre visuel (pas d'illustration 3D, pas
// d'icônes colorées). Un picto = un concept, dans l'ordre du texte.
const PICTO_PATHS: Record<string, string> = {
  // parcours (4 temps)
  question: "M9 9a3 3 0 1 1 4 2.8c-.7.4-1 .9-1 1.7v.5M12 17.5v.5",
  balance: "M12 4v14M6 8h12M8 8l-2.5 5h5L8 8ZM16 8l-2.5 5h5L16 8Z",
  blueprint: "M4 5h16v14H4zM4 10h16M10 10v9",
  wave: "M3 15c2.5-4 5-4 7.5 0S18 19 21 15M3 9c2.5-4 5-4 7.5 0S18 13 21 9",
  // ontologie (8 concepts)
  decision: "M12 4v6M12 10 6 20h12L12 10Z",
  option: "M5 7h6M5 12h10M5 17h6M17 7l2 2 3-3",
  criterion: "M4 18V6M9 18v-7M14 18v-4M19 18V9",
  scale: "M4 19h16M7 19v-4M11 19v-7M15 19v-10M19 19v-13",
  impact: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z",
  capability: "M12 3l7 4v6c0 4-3 6.5-7 8-4-1.5-7-4-7-8V7l7-4Z",
  flow: "M4 8h9l-2-2M4 8l2 2M20 16h-9l2 2M20 16l-2-2",
  actor: "M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 21c0-4 3.2-6.5 7-6.5S19 17 19 21",
};
function Picto({ name, size = 22, color = INDIGO }: { name: keyof typeof PICTO_PATHS | string; size?: number; color?: string }) {
  const d = PICTO_PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const PARCOURS_PICTOS = ["question", "balance", "blueprint", "wave"];
const CONCEPT_PICTOS = ["decision", "option", "criterion", "scale", "impact", "capability", "flow", "actor"];

// ── Références méthodologiques ───────────────────────────────────────────────
// Citées telles qu'elles sont publiées : CESAM et TOGAF ne sont pas invoqués
// comme arguments d'autorité mais comme sources consultables. Titres non
// reformulés, liens vers l'éditeur ou le DOI.
const METHOD_REFS: { t: string; a: string; url: string }[] = [
  { t: "CESAM — CESAMES Systems Architecting Method, Pocket Guide", a: "D. Krob, CESAMES, 2017", url: "https://www.cesames.net/en/cesam-pocket-guide/" },
  { t: "Éléments d'architecture des systèmes complexes", a: "D. Krob, in Gestion de la complexité et de l'information, Hermès / Lavoisier, 2009", url: "https://www.researchgate.net/publication/265056391" },
  { t: "The TOGAF Standard, 10th Edition", a: "The Open Group, 2022", url: "https://pubs.opengroup.org/architecture/togaf-standard/" },
  { t: "TOGAF-based Enterprise Architecture Practice: An Exploratory Case Study", a: "S. Kotusev, Communications of the AIS, 2018", url: "https://doi.org/10.17705/1CAIS.04320" },
  { t: "The C4 model for visualising software architecture", a: "S. Brown", url: "https://c4model.com" },
];


export type PageId = "home" | "plateforme" | "solutions" | "methode" | "science" | "tarifs";

type Bi = { fr: string; en: string };

/** Barre de navigation : l'ordre suit la lecture d'un acheteur. */
const NAV: { id: PageId; to: string; label: Bi }[] = [
  { id: "home", to: "/aura", label: { fr: "Accueil", en: "Home" } },
  { id: "plateforme", to: "/aura/plateforme", label: { fr: "Produit", en: "Product" } },
  { id: "solutions", to: "/aura/solutions", label: { fr: "Cas d’usage", en: "Use cases" } },
  { id: "methode", to: "/aura/methode", label: { fr: "Méthode & confiance", en: "Method & trust" } },
  { id: "science", to: "/aura/science", label: { fr: "Science", en: "Science" } },
  { id: "tarifs", to: "/aura/tarifs", label: { fr: "Tarifs", en: "Pricing" } },
];

/** Promesse propre à chaque page : une intention, une phrase. */
const PAGE_META: Record<PageId, { eyebrow: Bi; h1: Bi; lead: Bi }> = {
  home: {
    eyebrow: { fr: "Decision Intelligence & Augmented Architecture", en: "Decision Intelligence & Augmented Architecture" },
    h1: { fr: "Aura", en: "Aura" },
    lead: { fr: "La plateforme.", en: "The platform." },
  },
  plateforme: {
    eyebrow: { fr: "Plateforme", en: "Platform" },
    h1: { fr: "Décider, puis architecturer — dans un seul environnement", en: "Decide, then architect — in one environment" },
    lead: {
      fr: "Trois espaces qui se tiennent : Décider tranche l'arbitrage, Architecturer le prolonge en cible et en plan, le Copilote relie les deux à vos objets métier.",
      en: "Three spaces that hold together: Decide settles the trade-off, Architect turns it into a target and a plan, the Copilot links both to your business objects.",
    },
  },
  solutions: {
    eyebrow: { fr: "Solutions", en: "Solutions" },
    h1: { fr: "Vos décisions, secteur par secteur", en: "Your decisions, sector by sector" },
    lead: {
      fr: "Énergie & Utilities, Retail & distribution, Supply chain : chaque cas dit la question posée, l'arbitrage à tenir et le livrable produit.",
      en: "Energy & Utilities, Retail, Supply chain: each case states the question, the trade-off to hold and the deliverable produced.",
    },
  },
  methode: {
    eyebrow: { fr: "Méthode", en: "Method" },
    h1: { fr: "Une méthode outillée, pas un logiciel de plus", en: "A tooled method, not one more piece of software" },
    lead: {
      fr: "Quatre temps — comprendre, arbitrer, architecturer, suivre — et un parti pris : un critère rédhibitoire reste rédhibitoire.",
      en: "Four steps — understand, arbitrate, architect, track — and one stance: a deal-breaker stays a deal-breaker.",
    },
  },
  science: {
    eyebrow: { fr: "Fondement scientifique", en: "Scientific foundation" },
    h1: { fr: "Le moteur est publié, daté, citable", en: "The engine is published, dated, citable" },
    lead: {
      fr: "Raisonnement ordinal bipolaire issu d'une thèse et de publications consultables ; ontologie minimale pour cadrer les modèles de langage.",
      en: "Bipolar ordinal reasoning from a doctoral thesis and peer-reviewed papers; a minimal ontology to frame language models.",
    },
  },
  tarifs: {
    eyebrow: { fr: "Tarifs", en: "Pricing" },
    h1: { fr: "Ce que vous payez, et ce que vous obtenez", en: "What you pay, and what you get" },
    lead: {
      fr: "Abonnement par décideur, et prestations outillées quand la première décision doit être conduite avec vous.",
      en: "Per-decision-maker subscription, plus tooled engagements when the first decision must be run with you.",
    },
  },
};

/** Architecture du site : une page = une intention d'achat, une seule. */
const PAGE_SECTIONS: Record<PageId, string[]> = {
  home: ["hero", "teaser", "categorie"],
  plateforme: ["produits", "architecturer"],
  solutions: ["terrains"],
  methode: ["methode", "partipris"],
  science: ["fondement", "moteur", "ontologie", "auteur"],
  tarifs: ["tarifs", "prestations"],
};

export function VitrineSite({ page = "home" }: { page?: PageId }) {
  const has = (k: string) => PAGE_SECTIONS[page].includes(k);
  // Le français est la langue de référence ; le choix est mémorisé pour la visite.
  const [lang, setLang] = useState<Lang>("fr");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANG_KEY);
      if (stored === "en" || stored === "fr") { setLang(stored); return; }
      if (navigator.language && !navigator.language.toLowerCase().startsWith("fr")) setLang("en");
    } catch { /* mode privé : on reste en français */ }
  }, []);
  function pick(l: Lang) {
    setLang(l);
    try { window.localStorage.setItem(LANG_KEY, l); } catch { /* sans effet */ }
  }

  const c = VITRINE[lang];
  const sc = SOL_COPY[lang];
  // Secteur affiché dans la matrice Solutions.
  const [secteur, setSecteur] = useState<string>(SOLUTIONS[0].id);

  const langBtn = (l: Lang): React.CSSProperties => ({
    padding: "4px 9px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
    fontSize: 13, fontWeight: 800, letterSpacing: ".04em",
    border: "1px solid " + (lang === l ? INDIGO : "#e2ddf5"),
    background: lang === l ? INDIGO : "#fff",
    color: lang === l ? "#fff" : "#6b6789",
  });

  return (
    <main style={{ background: "#fff", color: "#151329", minHeight: "100vh" }}>
      {/* ── Barre : marque en noir sur blanc, bascule de langue à droite ── */}
      <header style={{ borderBottom: "1px solid #eeecf8", position: "sticky", top: 0, background: "#fffffff2", backdropFilter: "blur(8px)", zIndex: 20 }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 16, height: 66 }}>
          <a href="/aura" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <AuraArtwork height={42} />
          </a>
          <span style={{ fontSize: 12.5, color: "#7a7694", fontWeight: 650 }}>{lang === "fr" ? "Décider · Architecturer · Transformer" : "Decide · Architect · Transform"}</span>
          {/* Navigation de site : une entrée = une page, pas une ancre. Le
              visiteur sait où il est et ce qui reste à lire. */}
          <nav style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            {NAV.filter(n => n.id !== "science").map(n => (
              <a key={n.id} href={n.to} style={{
                ...navLink,
                color: page === n.id ? INDIGO : "#4b4864",
                borderBottom: page === n.id ? `2px solid ${INDIGO}` : "2px solid transparent",
                paddingBottom: 2,
              }}>{n.label[lang]}</a>
            ))}
            <span style={{ display: "inline-flex", gap: 4 }}>
              <button onClick={() => pick("fr")} style={langBtn("fr")} aria-pressed={lang === "fr"}>FR</button>
              <button onClick={() => pick("en")} style={langBtn("en")} aria-pressed={lang === "en"}>EN</button>
            </span>
            <a href="/cockpit/home" style={{ ...cta, padding: "9px 18px", fontSize: 13 }}>{c.nav.open}</a>
          </nav>
        </div>
      </header>

      {/* ── En-tête de page (hors accueil) : la promesse de la page, en une
          phrase, avant tout contenu hérité. ── */}
      {page !== "home" && (
        <section style={{ background: "linear-gradient(180deg,#f8f7ff,#fff)", borderBottom: "1px solid #eeecf8", padding: "54px 0 40px" }}>
          <div style={wrap}>
            <div style={eyebrow}>{PAGE_META[page].eyebrow[lang]}</div>
            <h1 style={{
              fontFamily: "var(--font-display, Georgia, serif)", fontSize: "clamp(28px,3.4vw,44px)",
              fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.1, margin: "12px 0 0",
            }}>{PAGE_META[page].h1[lang]}</h1>
            <p style={{ ...lead, maxWidth: 640 }}>{PAGE_META[page].lead[lang]}</p>
          </div>
        </section>
      )}



      {/* ── Hero commercial ─────────────────────────────────────────────────
          Registre : Palantir (phrase affirmative, l'institution décide) et
          Datadog (bénéfice nommé avant la mécanique). Une accroche, une
          promesse de catégorie, deux actions, quatre preuves. ── */}
      {has("hero") && (<>
      <section style={{ background: "linear-gradient(180deg,#f6f4ff, #fff 78%)", borderBottom: "1px solid #eeecf8", padding: "78px 0 0" }}>
        <div style={{ ...wrap, display: "flex", gap: 44, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 480px", minWidth: 300 }}>
            <div style={eyebrow}>{COM.hero.eyebrow[lang]}</div>
            <h1 style={{
              fontFamily: "var(--font-display, Georgia, serif)", fontSize: "clamp(34px, 4.6vw, 58px)",
              fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.04, margin: "14px 0 0",
            }}>
              {COM.hero.h1[lang]}<br />
              <span style={{ color: INDIGO }}>{COM.hero.h1b[lang]}</span>
            </h1>
            <p style={{ ...lead, fontSize: 17, maxWidth: 560 }}>{COM.hero.sub[lang]}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <a href="/cockpit/atelier" style={cta}>{COM.hero.ctaA[lang]}</a>
              <a href="#teaser" style={ctaGhost}>{COM.hero.ctaB[lang]}</a>
            </div>
            {/* Bandeau de preuve : ce que le visiteur emporte, pas ce que nous savons faire. */}
            <div style={{ display: "flex", gap: 8, marginTop: 26, flexWrap: "wrap" }}>
              {COM.hero.proof.map(p => (
                <span key={p.en} style={{
                  fontSize: 13, fontWeight: 700, color: "#3b3560", background: "#fff",
                  border: "1px solid #e2ddf5", borderRadius: 999, padding: "7px 13px",
                }}>{p[lang]}</span>
              ))}
            </div>
          </div>
          <div style={{ flex: "1 1 400px", minWidth: 280 }}>
            <img src="/aura-hero-workspace.png" width={1440} height={1024} alt={c.hero.bannerAlt} style={imgS} />
          </div>
        </div>

        {/* Les quatre piliers de méthode restent : ils portent la crédibilité
            juste après la promesse commerciale. */}
        <div style={{ ...wrap, display: "flex", gap: 34, marginTop: 44, paddingBottom: 56, flexWrap: "wrap" }}>
          {c.hero.pillars.map(p => (
            <div key={p.t} style={{ flex: "1 1 240px", minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{p.t}</div>
              <div style={{ ...body, marginTop: 5 }}>{p.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Le coût d'une décision mal tranchée : nommer le risque avant le produit ── */}
      <section style={{ padding: "66px 0", background: "#fff", borderBottom: "1px solid #eeecf8" }}>
        <div style={wrap}>
          <div style={eyebrow}>{COM.cout.eyebrow[lang]}</div>
          <h2 style={h2}>{COM.cout.h2[lang]}</h2>
          <p style={{ ...lead, maxWidth: 700 }}>{COM.cout.lead[lang]}</p>
          <div style={{ display: "flex", gap: 16, marginTop: 26, flexWrap: "wrap" }}>
            {COM.cout.items.map((it, i) => (
              <div key={i} style={{ flex: "1 1 230px", minWidth: 215, borderLeft: `2px solid ${INDIGO}`, paddingLeft: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{it.t[lang]}</div>
                <div style={{ ...body, marginTop: 6 }}>{it.d[lang]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trois modules, capacités vérifiables + lecture inverse ── */}
      <section style={sectionAlt}>
        <div style={wrap}>
          <div style={eyebrow}>{COM.modules.eyebrow[lang]}</div>
          <h2 style={h2}>{COM.modules.h2[lang]}</h2>
          <p style={{ ...lead, maxWidth: 700 }}>{COM.modules.lead[lang]}</p>
          <div style={{ display: "flex", gap: 16, marginTop: 28, flexWrap: "wrap" }}>
            {COM.modules.items.map((m, i) => (
              <div key={i} style={{ ...cardS, flex: "1 1 300px", minWidth: 270, borderTop: `3px solid ${INDIGO}` }}>
                <div style={{ fontSize: 15.5, fontWeight: 700 }}>{m.t[lang]}</div>
                <div style={{ ...body, marginTop: 6 }}>{m.d[lang]}</div>
                <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none" }}>
                  {m.bullets.map((b, k) => (
                    <li key={k} style={{ ...body, display: "flex", gap: 8, marginTop: 8 }}>
                      <span style={{ color: INDIGO, fontWeight: 800, lineHeight: 1.4 }}>—</span>
                      <span>{b[lang]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ ...cardS, marginTop: 18, background: "#fff", borderLeft: `3px solid ${INDIGO}` }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{COM.modules.backward.t[lang]}</div>
            <div style={{ ...body, marginTop: 7, maxWidth: 760 }}>{COM.modules.backward.d[lang]}</div>
            <a href="/aura/methode" style={{ display: "inline-block", marginTop: 12, fontSize: 13, fontWeight: 700, color: INDIGO, textDecoration: "none" }}>
              {COM.modules.backward.cta[lang]} →
            </a>
          </div>
        </div>
      </section>


      {/* ── Avec ou sans données, jamais sans vous ── */}
      <section style={{ padding: "74px 0", background: "#fff" }}>
        <div style={wrap}>
          <div style={eyebrow}>{COM.data.eyebrow[lang]}</div>
          <h2 style={h2}>{COM.data.h2[lang]}</h2>
          <p style={{ ...lead, maxWidth: 700 }}>{COM.data.lead[lang]}</p>
          <img src={donneesImg} width={1280} height={720} loading="lazy"
            alt={lang === "fr"
              ? "Deux chemins — données structurées et jugements d'experts — convergent vers un même raisonnement, puis vers une décision signée"
              : "Two paths — structured data and expert judgement — converge into one reasoning step, then into a signed decision"}
            style={{ ...imgS, marginTop: 26 }} />
          <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
            {COM.data.cols.map((col, i) => (
              <div key={i} style={{ ...cardS, flex: "1 1 280px", minWidth: 260, borderTop: `3px solid ${i === 2 ? INDIGO : "#ddd5fb"}` }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{col.t[lang]}</div>
                <div style={{ ...body, marginTop: 8 }}>{col.d[lang]}</div>
              </div>
            ))}
          </div>
          <div style={{ ...body, marginTop: 18, maxWidth: 720, fontStyle: "italic" }}>{COM.data.note[lang]}</div>
        </div>
      </section>

      {/* ── La valeur, nommée avant la mécanique ── */}
      <section style={sectionAlt}>
        <div style={wrap}>
          <div style={eyebrow}>{COM.valeur.eyebrow[lang]}</div>
          <h2 style={h2}>{COM.valeur.h2[lang]}</h2>
          <p style={{ ...lead, maxWidth: 700 }}>{COM.valeur.lead[lang]}</p>
          <div style={{ display: "flex", gap: 16, marginTop: 28, flexWrap: "wrap" }}>
            {COM.valeur.items.map((v, i) => (
              <div key={i} style={{ ...cardS, flex: "1 1 240px", minWidth: 230 }}>
                <div style={{ fontFamily: "var(--font-display, Georgia, serif)", fontSize: 22, fontWeight: 700, color: INDIGO, lineHeight: 1 }}>0{i + 1}</div>
                <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 12.5 }}>{v.t[lang]}</div>
                <div style={{ ...body, marginTop: 8 }}>{v.d[lang]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cas concrets : situation → ce que fait Aura → ce qui sort ── */}
      <section style={{ padding: "74px 0" }}>
        <div style={wrap}>
          <div style={eyebrow}>{COM.cas.eyebrow[lang]}</div>
          <h2 style={h2}>{COM.cas.h2[lang]}</h2>
          <p style={{ ...lead, maxWidth: 720 }}>{COM.cas.lead[lang]}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 28 }}>
            {COM.cas.items.map((u, i) => (
              <div key={i} style={{ ...cardS, display: "flex", gap: 26, flexWrap: "wrap", alignItems: "stretch", padding: 0, overflow: "hidden" }}>
                <img src={CAS_IMGS[i]} width={1280} height={720} loading="lazy" alt={u.titre[lang]}
                  style={{ flex: "1 1 300px", minWidth: 260, maxWidth: 380, objectFit: "cover", alignSelf: "stretch", minHeight: 260, height: "auto", background: "#f7f5ff", borderRadius: 0 }} />

                <div style={{ flex: "1 1 420px", minWidth: 300, padding: "24px 26px 24px 0" }}>
                  <div style={eyebrow}>{u.dom[lang]}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8, lineHeight: 1.3, fontFamily: "var(--font-display, Georgia, serif)" }}>{u.titre[lang]}</div>
                  <div style={{ fontSize: 13, color: "#7a7694", fontWeight: 600, marginTop: 12 }}>{u.role[lang]}</div>
                  {([[COM.cas.sitLabel, u.situation], [COM.cas.auraLabel, u.aura], [COM.cas.outLabel, u.sortie]] as const).map(([lbl, txt], k) => (
                    <div key={k} style={{ marginTop: 14 }}>
                      <div style={{ ...eyebrow, letterSpacing: ".07em", color: k === 2 ? INDIGO : "#9b97b4" }}>{lbl[lang]}</div>
                      <div style={{ ...body, marginTop: 4 }}>{txt[lang]}</div>
                    </div>
                  ))}
                  <a href="/aura/solutions" style={{ display: "inline-block", marginTop: 16, fontSize: 13, fontWeight: 700, color: INDIGO, textDecoration: "none" }}>{COM.cas.cta[lang]} →</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Entrée par rôle : Datadog vend au rôle, pas au module ── */}
      <section style={sectionAlt}>
        <div style={wrap}>
          <div style={eyebrow}>{COM.roles.eyebrow[lang]}</div>
          <h2 style={h2}>{COM.roles.h2[lang]}</h2>
          <div style={{ display: "flex", gap: 16, marginTop: 26, flexWrap: "wrap" }}>
            {COM.roles.items.map((r, i) => (
              <div key={i} style={{ ...cardS, flex: "1 1 230px", minWidth: 220 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{r.t[lang]}</div>
                <div style={{ ...body, marginTop: 7 }}>{r.d[lang]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Catégorie : Gartner nomme le marché, nous y ajoutons l'architecture ── */}
      <section style={{ padding: "74px 0" }}>
        <div style={{ ...wrap, display: "flex", gap: 30, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 480px", minWidth: 300 }}>
            <div style={eyebrow}>{COM.gartner.eyebrow[lang]}</div>
            <h2 style={h2}>{COM.gartner.h2[lang]}</h2>
            <p style={{ ...lead, maxWidth: 640 }}>{COM.gartner.lead[lang]}</p>
            <a href="/aura/methode" style={{ display: "inline-block", marginTop: 16, fontSize: 13.5, fontWeight: 700, color: INDIGO, textDecoration: "none" }}>{COM.gartner.cta[lang]} →</a>
          </div>
          <div style={{ ...cardS, flex: "1 1 300px", minWidth: 280, borderLeft: `3px solid ${INDIGO}` }}>
            <div style={{ ...eyebrow, letterSpacing: ".07em" }}>{COM.final.h2[lang]}</div>
            <div style={{ ...body, marginTop: 8, fontSize: 13.5 }}>{COM.final.lead[lang]}</div>
            <a href="/cockpit/atelier" style={{ ...cta, display: "inline-block", marginTop: 14, padding: "11px 22px" }}>{COM.final.ctaA[lang]}</a>
            <div style={{ fontSize: 13, color: "#7a7694", marginTop: 12.5 }}>{COM.final.note[lang]}</div>
          </div>
        </div>
      </section>
      </>)}


      {/* ── Teaser de découverte ────────────────────────────────────────────
          Deux masters (FR / EN) produits avec Remotion (remotion/src/MainVideoV10.tsx) :
          captures réelles de la plateforme, images intercalaires, voix off féminine.
          Lecture à la demande — le son porte le propos, donc pas d'autoplay. ── */}
      {has("teaser") && (<>
      <section id="teaser" style={{ padding: "64px 0", background: "#fbfaff", borderBottom: "1px solid #eeecf8" }}>
        <div style={wrap}>
          <div style={eyebrow}>{c.teaser.eyebrow}</div>
          <h2 style={h2}>{c.teaser.h2}</h2>
          <p style={{ ...lead, maxWidth: 640 }}>{c.teaser.lead}</p>
          <video
            key={lang}
            src={(lang === "en" ? teaserEn : teaserFr).url}
            poster={teaserPoster}
            aria-label={c.teaser.label}
            controls playsInline preload="metadata"
            style={{ width: "100%", marginTop: 22, borderRadius: 8, border: "1px solid #e7e3f7", boxShadow: "0 20px 50px rgba(21,19,41,.10)", display: "block" }}
          />
        </div>
      </section>
      </>)}

      {/* ── Plan du site sur l'accueil : le visiteur voit l'ensemble de l'offre
          Decision Intelligence & Augmented Architecture avant d'entrer dans un détail. ── */}
      {page === "home" && (
        <section style={sectionAlt}>
          <div style={wrap}>
            <div style={eyebrow}>{lang === "fr" ? "La plateforme en quatre entrées" : "The platform in four entries"}</div>
            <h2 style={h2}>{lang === "fr" ? "Par où vous commencez" : "Where you start"}</h2>
            <div style={{ display: "flex", gap: 16, marginTop: 28, flexWrap: "wrap" }}>
              {NAV.filter(n => n.id !== "home").map(n => (
                <a key={n.id} href={n.to} style={{ ...cardS, flex: "1 1 230px", minWidth: 220, textDecoration: "none", color: "inherit", display: "block" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{n.label[lang]}</div>
                  <div style={{ ...body, marginTop: 8 }}>{PAGE_META[n.id as PageId].lead[lang]}</div>
                  <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: INDIGO }}>{lang === "fr" ? "Lire" : "Read"} →</div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── La méthode AURA ── */}
      {has("methode") && (<>
      <section id="methode" style={{ padding: "72px 0" }}>
        <div style={wrap}>
          <div style={eyebrow}>{c.methode.eyebrow}</div>
          <h2 style={h2}>{c.methode.h2}</h2>
          <p style={{ ...lead, maxWidth: 660 }}>{c.methode.lead}</p>
          <div style={{ display: "flex", gap: 16, marginTop: 30, flexWrap: "wrap" }}>
            {c.methode.letters.map(([l, t, d]) => (
              <div key={t} style={{ ...cardS, flex: "1 1 230px", minWidth: 220 }}>
                <div style={{ fontFamily: "var(--font-display, Georgia, serif)", fontSize: 30, fontWeight: 700, color: INDIGO, lineHeight: 1 }}>{l}</div>
                <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 12 }}>{t}</div>
                <div style={{ ...body, marginTop: 8 }}>{d}</div>
              </div>
            ))}
          </div>

          {/* Parcours en quatre temps : l'acheteur doit voir le chemin avant l'outil. */}
          <div style={{ ...cardS, marginTop: 20 }}>
            <div style={{ ...eyebrow, letterSpacing: ".08em" }}>{c.methode.parcoursLabel}</div>
            <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
              {c.methode.parcours.map((p, i) => (
                <div key={p.t} style={{ flex: "1 1 200px", minWidth: 190 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Picto name={PARCOURS_PICTOS[i] ?? "question"} size={20} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: INDIGO }}>0{i + 1}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 12 }}>{p.t}</div>
                  <div style={{ ...body, marginTop: 5 }}>{p.d}</div>
                </div>
              ))}

            </div>
          </div>

          {/* Schéma au trait : la décision signée se prolonge en plan, puis
              revient sur la cible. Illustratif du 4e temps, pas décoratif. */}
          <img src={methodeImg} width={1280} height={720} loading="lazy"
            alt="Une décision signée se prolonge en plan jalonné, dont le suivi revient sur la cible"
            style={{ ...imgS, marginTop: 22 }} />
        </div>
      </section>
      </>)}

      {/* ── Produits : double entrée décision + architecture + création d'offres ── */}
      {has("produits") && (<>
      <section id="produits" style={sectionAlt}>
        <div style={wrap}>
          <div style={eyebrow}>{c.produits.eyebrow}</div>
          <h2 style={h2}>{c.produits.h2}</h2>
          <p style={{ ...lead, maxWidth: 680 }}>{c.produits.lead}</p>
          <div style={{ display: "flex", gap: 16, marginTop: 30, flexWrap: "wrap" }}>
            {c.produits.items.map(o => (
              <div key={o.n} style={{ ...cardS, flex: "1 1 300px", minWidth: 280 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3 }}>{o.n}</div>
                <div style={{ ...eyebrow, marginTop: 6, letterSpacing: ".06em" }}>{o.who}</div>
                <div style={{ ...body, marginTop: 10 }}>{o.what}</div>
                <a href={o.to} style={{ display: "inline-block", marginTop: 14, fontSize: 13, fontWeight: 700, color: INDIGO, textDecoration: "none" }}>{c.produits.explore}</a>
              </div>
            ))}
          </div>
        </div>
      </section>
      </>)}

      {/* ── Solutions : entrée unique secteur → cas → produit → livrable ──
          Remplace quatre blocs qui redisaient les mêmes domaines (zooms
          sectoriels, enjeux du moment, fiches secteurs, galerie). Le visiteur
          choisit son secteur, lit sa question, et voit immédiatement quel
          produit la tranche et ce qu'il en sort. */}
      {has("terrains") && (<>
      <section id="terrains" style={{ padding: "72px 0" }}>
        <div style={wrap}>
          <div style={eyebrow}>{sc.eyebrow}</div>
          <h2 style={h2}>{sc.h2}</h2>
          <p style={{ ...lead, maxWidth: 700 }}>{sc.lead}</p>

          {/* Sélecteur de secteur : un seul secteur affiché à la fois, pour
              annuler la charge de lecture. */}
          <div style={{ display: "flex", gap: 8, marginTop: 26, flexWrap: "wrap" }}>
            {SOLUTIONS.map(s => {
              const on = s.id === secteur;
              return (
                <button key={s.id} onClick={() => setSecteur(s.id)}
                  style={{
                    border: `1px solid ${on ? INDIGO : "#e2ddf5"}`, background: on ? INDIGO : "#fff",
                    color: on ? "#fff" : "#3b3560", borderRadius: 999, padding: "8px 16px",
                    fontSize: 13.5, fontWeight: 700, cursor: "pointer",
                  }}>
                  {s.label[lang]}
                </button>
              );
            })}
          </div>

          {(() => {
            const s = SOLUTIONS.find(x => x.id === secteur) ?? SOLUTIONS[0];
            const illus = SECTOR_ILLUS.filter(i => i[lang].dom === SECTOR_DOM[s.id]?.[lang]);
            return (
              <>
                <div style={{ ...cardS, marginTop: 20, borderLeft: `3px solid ${INDIGO}` }}>
                  <div style={{ ...eyebrow, color: s.priority ? INDIGO : "#9b97b4" }}>
                    {s.priority ? sc.priority : sc.secondary}
                  </div>
                  <div style={{ ...eyebrow, marginTop: 12 }}>{sc.coince}</div>
                  <div style={{ ...body, marginTop: 4, maxWidth: 760 }}>{s.coince[lang]}</div>
                </div>

                {/* Les cas, regroupés par produit responsable. */}
                {(["decider", "copilote", "architecturer"] as ProduitId[]).map(pid => {
                  const cs = s.cases.filter(x => x.p === pid);
                  if (!cs.length) return null;
                  const p = PRODUITS[pid];
                  return (
                    <div key={pid} style={{ marginTop: 26 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                        <a href={p.to} style={{ fontSize: 15.5, fontWeight: 800, color: "#1d1836", textDecoration: "none" }}>
                          {p.label[lang]}
                        </a>
                        <span style={{ ...eyebrow, letterSpacing: ".06em" }}>{p.tag[lang]}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginTop: 12 }}>
                        {cs.map(k => (
                          <div key={k.q.fr} style={{ ...cardS, margin: 0, padding: "16px 18px" }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.45 }}>{k.q[lang]}</div>
                            <div style={{ ...eyebrow, marginTop: 10 }}>{sc.livrable}</div>
                            <div style={{ ...body, marginTop: 3 }}>{k.l[lang]}</div>
                            {k.suite && (
                              <div style={{ fontSize: 13, color: INDIGO, fontWeight: 700, marginTop: 12.5 }}>
                                {sc.suite} {PRODUITS[k.suite].label[lang]}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Illustrations du secteur sélectionné : habillage de la
                    matrice, plus une galerie autonome. */}
                {illus.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginTop: 30 }}>
                    {illus.map(i => (
                      <figure key={i.img} style={{ ...cardS, margin: 0, padding: 14, overflow: "hidden" }}>
                        <img src={i.img} width={1280} height={800} loading="lazy" alt={i[lang].alt}
                          style={{ width: "100%", height: "auto", display: "block", borderRadius: 8, background: "#fbfaff" }} />
                        <figcaption style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{i[lang].titre}</div>
                          <div style={{ ...body, marginTop: 6 }}>{i[lang].arbitrage}</div>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </>
            );
          })()}

          <a href="/cockpit/cas-references" style={{ display: "inline-block", marginTop: 24, fontSize: 13.5, fontWeight: 700, color: INDIGO, textDecoration: "none" }}>
            {sc.casLink}
          </a>
        </div>
      </section>
      </>)}



      {/* ── Fondement 1 : la thèse (raisonnement ordinal bipolaire) ── */}
      {has("fondement") && (<>
      <section id="fondement" style={{ padding: "72px 0" }}>
        <div style={wrap}>
          <div style={eyebrow}>{c.these.eyebrow}</div>
          <h2 style={h2}>{c.these.h2}</h2>
          <div style={{ display: "flex", gap: 40, marginTop: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 460px", minWidth: 300 }}>
              <p style={{ ...lead, marginTop: 0 }}>{c.these.p1}</p>
              <p style={lead}>{c.these.p2}</p>
              <div style={{ marginTop: 18 }}>
                {c.these.props.map(p => (
                  <div key={p.t} style={{ display: "flex", gap: 12, padding: "11px 0", borderTop: "1px solid #e8e5f6" }}>
                    <span style={{ color: INDIGO, fontWeight: 800, fontSize: 13, paddingTop: 2 }}>—</span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.t}</div>
                      <div style={{ ...body, marginTop: 3 }}>{p.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: "1 1 340px", minWidth: 280 }}>
              <img src={ontoImg} width={1280} height={800} loading="lazy" alt={c.these.imgAlt} style={imgS} />
              <div style={{ fontSize: 13, color: "#7a7694", marginTop: 10, lineHeight: 1.55 }}>{c.these.imgCaption}</div>
            </div>
          </div>
        </div>
      </section>
      </>)}

      {/* ── Le moteur a un nom ──
          PAPRIKA est l'actif de 1000minds, pas leur interface. On nomme, on
          énonce les axiomes, on publie des exemples reproductibles. Source
          unique : lib/v4/bora.ts. */}
      {has("moteur") && (<>
      <section id="moteur" style={{ padding: "72px 0", borderTop: "1px solid #eeecf8" }}>
        <div style={wrap}>
          <div style={eyebrow}>{c.moteur.eyebrow}</div>
          <h2 style={h2}>{BORA.acronym} — {BORA.name}</h2>
          {/* Formulation destinée au décideur (vitrine-copy) : la version
              mathématique reste dans lib/v4/bora.ts pour le produit. */}
          <p style={{ ...lead, maxWidth: 760 }}>{c.moteur.claim}</p>
          <div style={{ display: "flex", gap: 18, marginTop: 26, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 460px", minWidth: 300 }}>
              <div style={{ ...eyebrow, marginBottom: 6 }}>{c.moteur.axiomes}</div>
              {BORA_AXIOMS.map(a => (
                <div key={a.id} style={{ display: "flex", gap: 12, padding: "11px 0", borderTop: "1px solid #e8e5f6" }}>
                  <span style={{ color: INDIGO, fontWeight: 800, fontSize: 13, paddingTop: 3, minWidth: 20 }}>{a.id}</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.label}</div>
                    <div style={{ ...body, marginTop: 3 }}>{a.statement}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ flex: "1 1 320px", minWidth: 280 }}>
              <div style={{ ...cardS, borderTop: `3px solid ${INDIGO}` }}>
                <div style={{ ...eyebrow, marginBottom: 8 }}>{c.moteur.exemples}</div>
                {BORA_EXAMPLES.map(e => (
                  <a key={e.id} href={e.where} style={{ display: "block", padding: "10px 0", borderTop: "1px solid #eeecf8", textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{e.label}</div>
                    <div style={{ ...body, marginTop: 3 }}>{e.what}</div>
                  </a>
                ))}
                <div style={{ fontSize: 13, color: "#7a7694", marginTop: 14, lineHeight: 1.55, borderTop: "1px solid #eeecf8", paddingTop: 13 }}>
                  {c.moteur.citation} : {BORA.citation}
                </div>
              </div>
            </div>
          </div>

          {/* Chaque direction classe depuis son propre poste : le moteur ne
              moyenne pas ces lectures, il montre où elles divergent. */}
          <img src={partiesImg} width={1280} height={720} loading="lazy"
            alt="Plusieurs directions classent les mêmes options depuis un support commun"
            style={{ ...imgS, marginTop: 22 }} />
        </div>
      </section>
      </>)}

      {/* ── Fondement 2 : ontologie minimale × LLM ──
          On n'oppose pas symbolique et LLM : on les met en série. Le LLM parle,
          l'ontologie contraint, le moteur tranche. */}
      {has("ontologie") && (<>
      <section id="ontologie" style={sectionAlt}>
        <div style={wrap}>
          <div style={eyebrow}>{c.onto.eyebrow}</div>
          <h2 style={h2}>{c.onto.h2}</h2>
          <p style={{ ...lead, maxWidth: 760 }}>{c.onto.lead}</p>

          {/* Objets métier captés : présentés comme des EXEMPLES, jamais comme
              une liste fermée — le vocabulaire du client porte ses propres noms. */}
          <div style={{ ...eyebrow, marginTop: 26 }}>{c.onto.conceptsLabel}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {c.onto.concepts.map((k, i) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 7,
                border: `1px solid ${INDIGO}22`, background: "#fff", color: INDIGO,
                borderRadius: 999, padding: "6px 14px 6px 10px", fontSize: 13.5, fontWeight: 700 }}>
                <Picto name={CONCEPT_PICTOS[i] ?? "decision"} size={16} />{k}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 13, color: "#7a7694", marginTop: 12 }}>{c.onto.conceptsNote}</div>



          {/* Génération automatique de l'ontologie d'entreprise, puis ajustement. */}
          <div style={{ ...eyebrow, marginTop: 32 }}>{c.onto.autoLabel}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            {c.onto.auto.map(p => (
              <div key={p.t} style={{ ...cardS, flex: "1 1 240px", minWidth: 230, borderColor: `${INDIGO}33` }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.t}</div>
                <div style={{ ...body, marginTop: 8 }}>{p.d}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            {c.onto.items.map(p => (
              <div key={p.t} style={{ ...cardS, flex: "1 1 240px", minWidth: 230 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.t}</div>
                <div style={{ ...body, marginTop: 8 }}>{p.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      </>)}

      {/* ── Différence : Aura face aux IA généralistes ──
          Placée juste après les produits, là où le lecteur se demande
          « pourquoi pas simplement ChatGPT ? ». Deux colonnes, ligne par ligne :
          la colonne de gauche reste factuelle, jamais moqueuse — Aura utilise
          ces modèles. La rupture est portée par la colonne de droite. */}
      {has("partipris") && (<>
      <section id="parti-pris" style={sectionAlt}>
        <div style={wrap}>
          <div style={eyebrow}>{c.versus.eyebrow}</div>
          <h2 style={{ ...h2, maxWidth: 800 }}>{c.versus.h2}</h2>
          <p style={{ ...lead, maxWidth: 760 }}>{c.versus.lead}</p>

          {/* Un avis rédigé d'un côté, un calcul ordonné de l'autre : le schéma
              porte le parti pris avant que le tableau ne le détaille. */}
          <img src={partiPrisImg} width={1280} height={720} loading="lazy"
            alt="Un avis rédigé par une IA générative, puis un calcul déterministe qui ordonne les options"
            style={{ ...imgS, marginTop: 20 }} />


          <div style={{ ...cardS, marginTop: 26, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) minmax(200px,1.5fr) minmax(200px,1.5fr)", alignItems: "stretch" }}>
              <div />
              <div style={{ padding: "14px 18px", background: "#fbfaff", borderBottom: "1px solid #e8e5f6", fontSize: 13, fontWeight: 700, color: "#6b6789" }}>
                {c.versus.colA}
              </div>
              <div style={{ padding: "14px 18px", background: "#f4f1ff", borderBottom: "1px solid #e0daf9", borderLeft: "1px solid #e8e5f6", fontSize: 13, fontWeight: 800, color: INDIGO, display: "flex", alignItems: "center", gap: 12 }}>
                <AuraMark size={16} /> {c.versus.colB}
              </div>
              {c.versus.rows.map(r => (
                <React.Fragment key={r.k}>
                  <div style={{ padding: "15px 18px", borderTop: "1px solid #eeecf8", fontSize: 13, fontWeight: 800, color: "#151329" }}>{r.k}</div>
                  <div style={{ ...body, padding: "15px 18px", borderTop: "1px solid #eeecf8" }}>{r.a}</div>
                  <div style={{ ...body, padding: "15px 18px", borderTop: "1px solid #eeecf8", borderLeft: "1px solid #e8e5f6", background: "#fcfbff", color: "#2f2b52", fontWeight: 600 }}>{r.b}</div>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div style={{ ...cardS, marginTop: 18, borderLeft: "3px solid " + INDIGO }}>
            <div style={eyebrow}>{c.versus.kicker}</div>
            <p style={{ ...lead, marginTop: 8, maxWidth: 820 }}>{c.versus.kickerBody}</p>
          </div>
        </div>
      </section>
      </>)}

      {/* ── Decision intelligence : la catégorie de marché ──
          Les citations sont reprises mot pour mot et attribuées (Gartner Peer
          Insights, Magic Quadrant 2026, IT Glossary). Aucune donnée chiffrée
          n'est inventée : seules des hypothèses publiées sont citées. Le schéma
          est un croquis vectoriel du cycle — il ne représente aucun client. */}
      {has("categorie") && (<>
      <section id="categorie" style={{ padding: "72px 0", borderTop: "1px solid #eeecf8", background: "#fbfaff" }}>
        <div style={wrap}>
          <div style={eyebrow}>{c.di.eyebrow}</div>
          <h2 style={h2}>{c.di.h2}</h2>
          <p style={{ ...lead, maxWidth: 820 }}>{c.di.lead}</p>

          <div style={{ display: "flex", gap: 40, marginTop: 28, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 440px", minWidth: 300 }}>
              <div style={{ ...cardS, borderLeft: `3px solid ${INDIGO}` }}>
                <div style={eyebrow}>{c.di.defLabel}</div>
                <blockquote style={{ margin: "10px 0 0", fontFamily: "var(--font-display, Georgia, serif)",
                  fontSize: 16.5, lineHeight: 1.55, color: "#2c2748", fontStyle: "italic" }}>
                  « {c.di.def} »
                </blockquote>
                <div style={{ fontSize: 13, color: "#7a7694", marginTop: 12.5 }}>{c.di.defSource}</div>
              </div>

              <div style={{ marginTop: 16 }}>
                {c.di.quotes.map(q => (
                  <div key={q.q} style={{ padding: "13px 0", borderTop: "1px solid #e8e5f6" }}>
                    <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#2c2748" }}>« {q.q} »</div>
                    <a href={q.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-block", marginTop: 6, fontSize: 13, color: "#5b5580",
                        textDecoration: "none", borderBottom: `1px solid ${INDIGO}44` }}>{q.src} ↗</a>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: "1 1 380px", minWidth: 300 }}>
              <div style={eyebrow}>{c.di.schemaLabel}</div>
              <svg viewBox="0 0 420 420" width="100%" role="img" aria-label={c.di.schemaLabel}
                style={{ marginTop: 10, background: "#fff", border: "1px solid #e8e5f6", borderRadius: 8 }}>
                <defs>
                  <marker id="di-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M0 0 L10 5 L0 10 z" fill={INDIGO} />
                  </marker>
                </defs>
                {(() => {
                  const cx = 210, cy = 210, R = 132;
                  const pts = c.di.steps.map((s, i) => {
                    const a = -Math.PI / 2 + (i * 2 * Math.PI) / c.di.steps.length;
                    return { s, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a };
                  });
                  return (
                    <>
                      {pts.map((p, i) => {
                        const n = pts[(i + 1) % pts.length];
                        const a0 = p.a + 0.34, a1 = n.a - 0.34;
                        const arc = `M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`;
                        return <path key={`a${i}`} d={arc} fill="none" stroke={`${INDIGO}66`} strokeWidth={1.6} markerEnd="url(#di-arrow)" />;
                      })}
                      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={13} fontWeight={700} fill="#2c2748">AURA</text>
                      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill="#7a7694">decision intelligence</text>
                      {pts.map((p, i) => (
                        <g key={p.s.t}>
                          <circle cx={p.x} cy={p.y} r={30} fill="#fff" stroke={INDIGO} strokeWidth={1.4} />
                          <text x={p.x} y={p.y - 2} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="#2c2748">{p.s.t}</text>
                          <text x={p.x} y={p.y + 13} textAnchor="middle" fontSize={9.5} fill={INDIGO}>{i + 1}</text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
              <div style={{ fontSize: 13, color: "#7a7694", marginTop: 10, lineHeight: 1.55 }}>{c.di.schemaCaption}</div>
              <div style={{ marginTop: 14 }}>
                {c.di.steps.map((s, i) => (
                  <div key={s.t} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid #e8e5f6" }}>
                    <span style={{ color: INDIGO, fontWeight: 800, fontSize: 13, paddingTop: 3 }}>{i + 1}</span>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{s.t}</span>
                      <span style={{ ...body, marginLeft: 6 }}>{s.d}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 34, border: `1px solid ${INDIGO}22`, borderRadius: 8, background: "#fff", padding: "24px 24px" }}>
            <div style={eyebrow}>{c.di.standLabel}</div>
            <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
              {c.di.stand.map(p => (
                <div key={p.t} style={{ flex: "1 1 230px", minWidth: 220 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.t}</div>
                  <div style={{ ...body, marginTop: 5 }}>{p.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      </>)}

      {/* Section « Enjeux » retirée : chaque enjeu est désormais un cas de la
          matrice Solutions, rattaché au produit qui le traite. */}



      {/* ── Fondement 3 : Architecturer — systémique + TOGAF + C4 ── */}
      {has("architecturer") && (<>
      <section style={{ padding: "72px 0" }}>
        <div style={wrap}>
          <div style={eyebrow}>{c.archi.eyebrow}</div>
          <h2 style={h2}>{c.archi.h2}</h2>
          <div style={{ display: "flex", gap: 40, marginTop: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 440px", minWidth: 300 }}>
              <p style={{ ...lead, marginTop: 0 }}>{c.archi.lead}</p>
              <div style={{ marginTop: 16 }}>
                {c.archi.items.map(p => (
                  <div key={p.t} style={{ display: "flex", gap: 12, padding: "11px 0", borderTop: "1px solid #e8e5f6" }}>
                    <span style={{ color: INDIGO, fontWeight: 800, fontSize: 13, paddingTop: 2 }}>—</span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.t}</div>
                      <div style={{ ...body, marginTop: 3 }}>{p.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: "1 1 340px", minWidth: 280 }}>
              <img src={archImg} width={1280} height={800} loading="lazy" alt={c.archi.imgAlt} style={imgS} />
              <div style={{ fontSize: 13, color: "#7a7694", marginTop: 10, lineHeight: 1.55 }}>{c.archi.imgCaption}</div>
            </div>
          </div>

          {/* ── Bande CESAM ──
              Le cadrage entre par les besoins des parties prenantes : discipline
              CESAM (besoin porté, exigence tracée, trois vues croisées, flux
              qualifiés par l'information qui circule). */}
          <div style={{ marginTop: 40, border: `1px solid ${INDIGO}22`, borderRadius: 8, background: "#fff", padding: "28px 26px" }}>
            <div style={eyebrow}>{c.archi.cesamLabel}</div>
            <h3 style={{ fontFamily: "var(--font-display, Georgia, serif)", fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", margin: "8px 0 0" }}>{c.archi.cesamH}</h3>
            <p style={{ ...body, maxWidth: 720, marginTop: 10 }}>{c.archi.cesamLead}</p>
            <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
              {c.archi.cesam.map(p => (
                <div key={p.t} style={{ flex: "1 1 230px", minWidth: 220 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.t}</div>
                  <div style={{ ...body, marginTop: 5 }}>{p.d}</div>
                </div>
              ))}
            </div>
            <blockquote style={{ margin: "22px 0 0", paddingLeft: 14, borderLeft: `3px solid ${INDIGO}`,
              fontFamily: "var(--font-display, Georgia, serif)", fontSize: 16, color: "#2c2748", fontStyle: "italic" }}>
              « {c.archi.cesamQuote} »
            </blockquote>

            {/* Références consultables : CESAM, TOGAF, C4. Aucun cadre n'est
                invoqué sans sa source. */}
            <div style={{ marginTop: 24, borderTop: "1px solid #eeecf8", paddingTop: 16 }}>
              <div style={eyebrow}>{c.archi.refsLabel}</div>
              <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
                {METHOD_REFS.map(r => (
                  <li key={r.url} style={{ padding: "6px 0", fontSize: 13, lineHeight: 1.55 }}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#2f2b52", fontWeight: 600, textDecoration: "none", borderBottom: `1px solid ${INDIGO}44` }}>{r.t}</a>
                    <span style={{ color: "#7a7694" }}> — {r.a}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </section>
      </>)}

      {/* La section « Secteurs » est remontée juste après les applications :
          le visiteur veut se reconnaître avant de lire la méthode. */}


      {/* ── Tarifs (Lot 5) ──
          On affiche le prix. 1000minds et Geeglee font demander un devis : on
          fait l'inverse, parce qu'un acheteur de direction élimine d'abord sur
          l'ordre de grandeur. L'essai est mis en avant AVANT les plans. */}
      {has("tarifs") && (<>
      <section id="tarifs" style={{ padding: "72px 0", borderTop: "1px solid #eeecf8" }}>
        <div style={wrap}>
          <div style={eyebrow}>{c.pricing.eyebrow}</div>
          <h2 style={h2}>{c.pricing.h2}</h2>
          <p style={{ ...lead, maxWidth: 680 }}>{c.pricing.lead}</p>

          <div style={{ ...cardS, marginTop: 22, borderLeft: `3px solid ${INDIGO}`, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ ...body, fontSize: 13.5, flex: "1 1 420px", color: "#3c3860" }}>{c.pricing.trial}</div>
            <a href="/cockpit/abonnement" style={cta}>{c.pricing.cta}</a>
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap", alignItems: "stretch" }}>
            {c.pricing.plans.map((p, i) => (
              <div key={p.n} style={{
                ...cardS, flex: "1 1 290px", minWidth: 270, display: "flex", flexDirection: "column",
                borderTop: i === 2 ? `3px solid ${INDIGO}` : cardS.borderTop,
              }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{p.n}</div>
                <div style={{ fontFamily: "var(--font-display, Georgia, serif)", fontSize: 26, fontWeight: 600, color: INDIGO, marginTop: 12 }}>{p.price}</div>
                <div style={{ fontSize: 13, color: "#7a7694" }}>{p.year}</div>
                <div style={{ ...eyebrow, marginTop: 14, letterSpacing: ".06em" }}>{p.who}</div>
                <div style={{ marginTop: 10 }}>
                  {p.items.map(it => (
                    <div key={it} style={{ display: "flex", gap: 9, padding: "6px 0", borderTop: "1px solid #f1eefb" }}>
                      <span style={{ color: INDIGO, fontWeight: 800, fontSize: 13 }}>—</span>
                      <span style={body}>{it}</span>
                    </div>
                  ))}
                </div>
                <a href="/cockpit/abonnement" style={{ ...ctaGhost, marginTop: "auto", marginBlockStart: 18, textAlign: "center", padding: "10px 18px" }}>{c.pricing.cta}</a>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, color: "#7a7694", marginTop: 18, lineHeight: 1.6, maxWidth: 700 }}>{c.pricing.note}</div>
        </div>
      </section>
      </>)}

      {/* ── Prestations outillées (deck d'offres) ──
          La plateforme se vend aussi opérée : Decision Sprint, Engineering
          Decision Sprint, Transformation Architecture. Chaîne DECIDE → DESIGN
          → TRANSFORM affichée, prix affichés comme pour l'abonnement. */}
      {has("prestations") && (<>
      <section id="prestations" style={{ padding: "72px 0", borderTop: "1px solid #eeecf8", background: "#fbfaff" }}>
        <div style={wrap}>
          <div style={eyebrow}>{c.prestations.eyebrow}</div>
          <h2 style={h2}>{c.prestations.h2}</h2>
          <p style={{ ...lead, maxWidth: 720 }}>{c.prestations.lead}</p>
          <div style={{ ...eyebrow, color: INDIGO, letterSpacing: ".1em", marginTop: 6 }}>{c.prestations.chain}</div>

          <div style={{ display: "flex", gap: 16, marginTop: 22, flexWrap: "wrap", alignItems: "stretch" }}>
            {c.prestations.items.map((o, i) => (
              <div key={o.n} style={{
                ...cardS, flex: "1 1 300px", minWidth: 280, display: "flex", flexDirection: "column",
                borderTop: `3px solid ${i === 2 ? INDIGO : "#ddd5fb"}`,
              }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3 }}>{o.n}</div>
                <div style={{ ...body, marginTop: 6 }}>{o.sub}</div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
                  <div>
                    <div style={{ ...eyebrow, letterSpacing: ".06em" }}>{c.prestations.dureeLabel}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>{o.duree}</div>
                  </div>
                  <div>
                    <div style={{ ...eyebrow, letterSpacing: ".06em" }}>{c.prestations.prixLabel}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INDIGO, marginTop: 3 }}>{o.prix}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#6b6789", marginTop: 12, lineHeight: 1.6 }}>{o.steps}</div>
                <div style={{ marginTop: 10 }}>
                  {o.items.map(it => (
                    <div key={it} style={{ display: "flex", gap: 9, padding: "6px 0", borderTop: "1px solid #f1eefb" }}>
                      <span style={{ color: INDIGO, fontWeight: 800, fontSize: 13 }}>—</span>
                      <span style={body}>{it}</span>
                    </div>
                  ))}
                </div>
                <a href="mailto:contact@aura-decision.io" style={{ ...ctaGhost, marginTop: "auto", marginBlockStart: 18, textAlign: "center", padding: "10px 18px" }}>{c.prestations.cta}</a>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, color: "#7a7694", marginTop: 18, lineHeight: 1.6, maxWidth: 760 }}>{c.prestations.note}</div>
        </div>
      </section>
      </>)}


      {/* ── L'auteur : une méthode a un auteur. Rien d'invérifiable affirmé ici. ── */}
      {has("auteur") && (<>
      <section id="auteur" style={{ padding: "72px 0" }}>
        <div style={wrap}>
          <div style={eyebrow}>{c.auteur.eyebrow}</div>
          <h2 style={h2}>{c.auteur.h2}</h2>
          <div style={{ ...cardS, marginTop: 24, borderLeft: `3px solid ${INDIGO}`, display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 auto", paddingTop: 4 }}>
              <AuraMark size={54} color="#151329" />
            </div>
            <div style={{ flex: "1 1 420px", minWidth: 280 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{c.auteur.name}</div>
              <div style={{ ...eyebrow, marginTop: 6, letterSpacing: ".06em" }}>{c.auteur.role}</div>
              <div style={{ ...body, fontSize: 13.5, marginTop: 14, maxWidth: 780 }}>{c.auteur.p1}</div>
              <div style={{ ...body, fontSize: 13.5, marginTop: 12, maxWidth: 780 }}>{c.auteur.p2}</div>

              {/* Distinction — sobre, mais visible : un filet indigo, pas une médaille. */}
              <div style={{
                marginTop: 20, padding: "14px 18px", borderRadius: 8,
                background: "#f4f1ff", border: `1px solid #ddd5fb`,
                display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap", maxWidth: 780,
              }}>
                <div aria-hidden style={{ flex: "0 0 auto", marginTop: 2 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="9.5" r="6.2" stroke={INDIGO} strokeWidth="1.5" />
                    <path d="M9 15.2 L7.6 21.4 L12 19.2 L16.4 21.4 L15 15.2" stroke={INDIGO} strokeWidth="1.5" fill="none" />
                  </svg>
                </div>
                <div style={{ flex: "1 1 320px", minWidth: 240 }}>
                  <div style={{ ...eyebrow, letterSpacing: ".08em" }}>{c.auteur.awardEyebrow}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 5, lineHeight: 1.4 }}>{c.auteur.awardTitle}</div>
                  <div style={{ ...body, marginTop: 5 }}>{c.auteur.awardBody}</div>
                  <a href={prixThese.url} target="_blank" rel="noreferrer"
                    style={{ display: "inline-block", marginTop: 8, fontSize: 13, fontWeight: 700, color: INDIGO, textDecoration: "none" }}>
                    {c.auteur.awardLink} ↗
                  </a>
                </div>
              </div>

              {/* La thèse, citable et lisible en ligne. */}
              <div style={{ marginTop: 22, maxWidth: 780 }}>
                <div style={{ ...eyebrow, letterSpacing: ".08em" }}>{c.auteur.theseLabel}</div>
                <a href={THESE_URL} target="_blank" rel="noreferrer"
                  style={{ display: "block", fontSize: 13.5, fontWeight: 700, marginTop: 6, color: "#151329", textDecoration: "none", lineHeight: 1.45 }}>
                  {c.auteur.theseTitle}
                </a>
                <div style={{ ...body, marginTop: 4 }}>{c.auteur.theseMeta}</div>
                <a href={THESE_URL} target="_blank" rel="noreferrer"
                  style={{ display: "inline-block", marginTop: 7, fontSize: 13, fontWeight: 700, color: INDIGO, textDecoration: "none" }}>
                  {c.auteur.theseLink} ↗
                </a>
                <div style={{ ...body, marginTop: 10 }}>{c.auteur.encadrants}</div>
              </div>

              {/* Travaux fondateurs de l'équipe d'encadrement. */}
              <div style={{ marginTop: 22, maxWidth: 780 }}>
                <div style={{ ...eyebrow, letterSpacing: ".08em" }}>{c.auteur.travauxLabel}</div>
                <div style={{ ...body, marginTop: 5 }}>{c.auteur.travauxLead}</div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {PUBLICATIONS.map(pub => (
                    <a key={pub.url} href={pub.url} target="_blank" rel="noreferrer"
                      style={{ display: "block", padding: "10px 14px", borderRadius: 8, border: "1px solid #eeecf8", background: "#fff", textDecoration: "none" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#151329", lineHeight: 1.4 }}>{pub.t}</div>
                      <div style={{ fontSize: 13, color: "#6b6789", marginTop: 3 }}>{pub.a} — {pub.r}</div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      </>)}

      {/* ── Clôture ── */}
      <section style={{ padding: "68px 0", background: "linear-gradient(135deg,#151329,#2a2354)", color: "#fff" }}>
        <div style={{ ...wrap, display: "flex", gap: 26, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 420px", minWidth: 300 }}>
            <h2 style={{ ...h2, color: "#fff", margin: 0 }}>{c.cloture.h2}</h2>
            <p style={{ ...lead, color: "#c9c5e8", maxWidth: 540 }}>{c.cloture.lead}</p>
          </div>
          <a href="/cockpit/home" style={{
            padding: "14px 30px", borderRadius: 999, background: "#fff", color: "#221d47",
            fontSize: 13.5, fontWeight: 700, textDecoration: "none",
          }}>{c.cloture.cta}</a>
        </div>
      </section>

      <footer style={{ padding: "26px 0", borderTop: "1px solid #eeecf8" }}>
        <div style={{ ...wrap, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", fontSize: 13, color: "#7a7694" }}>
          <AuraMark size={28} mono color="#7a7694" />
          <span>Aura — Decision Intelligence & Augmented Architecture</span>
          <a href="/cockpit/cas-references" style={{ color: "#7a7694", textDecoration: "none" }}>{c.footer.cas}</a>
          <a href="/cockpit/home" style={{ color: "#7a7694", textDecoration: "none" }}>{c.footer.plateforme}</a>
        </div>
      </footer>
    </main>
  );
}
