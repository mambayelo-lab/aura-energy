// Modèle de décision de secours de Comprendre (sans LLM) et plancher de richesse.
//
// Quand le modèle de langage est indisponible, Comprendre ne doit pas s'arrêter sur un
// écran vide : on construit, de façon déterministe, un modèle structuré à partir du
// contexte élicité (objectif, exigences, leviers cités par le décideur). Ce modèle ne
// contient AUCUN chiffre métier inventé : uniquement des libellés d'objectifs,
// d'indicateurs et d'options qualitatifs, que le décideur ajuste ensuite.
//
// Le même module garantit un plancher de richesse sur une réponse LLM trop pauvre
// (trop peu de leviers ou d'options, aucune option inspirante marquée par la lampe).
import type { GeneratedFullModel, GeneratedObjective, GeneratedLevier, GeneratedOption } from "./atelier-llm";
import type { ElicitationData } from "./atelier-store";

export interface FallbackInput {
  context?: string;
  elicitation?: Partial<ElicitationData>;
  /** Mode Décision encapsulé dans Supply : modèle spécialisé supply chain. */
  supplyChain?: boolean;
  sector?: string;
}

type Imp = "Essentiel" | "Important" | "Secondaire" | "Faible";
type TplTpm = [label: string, description: string, importance: Imp, exploratoire?: boolean];
type TplMop = [label: string, description: string, importance: Imp, tpms: TplTpm[]];
type TplMoe = { label: string; description: string; importance: Imp; nature: "efficacite" | "cout" | "risque"; mops: TplMop[] };
type TplOpt = [label: string, justification: string, exploratoire?: boolean];
type TplLev = { label: string; type: GeneratedLevier["type"]; options: TplOpt[] };

const GENERIC_MOE: TplMoe[] = [
  { label: "Valeur créée par la décision", description: "Ce que la décision apporte aux bénéficiaires et à l'objectif prioritaire.", importance: "Essentiel", nature: "efficacite", mops: [
    ["Bénéfice pour les parties prenantes", "Gain perçu par ceux que la décision sert.", "Essentiel", [
      ["Gain perçu par les bénéficiaires", "Amélioration ressentie par les clients ou utilisateurs visés.", "Essentiel"],
      ["Délai avant les premiers bénéfices visibles", "Temps avant qu'un effet concret soit constaté.", "Important"],
    ]],
    ["Contribution à l'objectif prioritaire", "Alignement avec le résultat recherché.", "Important", [
      ["Contribution directe à l'objectif prioritaire", "Part du résultat visé que l'option permet d'atteindre.", "Essentiel"],
      ["Avantage difficile à copier par un concurrent", "Ce qui resterait différenciant dans la durée.", "Important", true],
    ]],
  ] },
  { label: "Coût et effort consentis", description: "Ce que la décision consomme en ressources, budget et attention.", importance: "Important", nature: "cout", mops: [
    ["Investissement et coûts récurrents", "Effort financier initial puis courant.", "Important", [
      ["Investissement initial requis", "Niveau d'engagement financier au démarrage.", "Important"],
      ["Coûts récurrents induits", "Charges durables créées par l'option.", "Secondaire"],
    ]],
    ["Charge des équipes clés", "Mobilisation des personnes rares.", "Secondaire", [
      ["Charge sur les équipes clés", "Temps pris aux équipes déjà sollicitées.", "Important"],
    ]],
  ] },
  { label: "Maîtrise du risque d'exécution", description: "Ce que la décision menace : faisabilité, dépendances, réversibilité.", importance: "Essentiel", nature: "risque", mops: [
    ["Faisabilité", "Capacité réelle à mener l'option à bien.", "Important", [
      ["Maturité des compétences et des outils", "Niveau de maîtrise disponible aujourd'hui.", "Important"],
      ["Dépendance à des tiers", "Part du succès qui repose sur des acteurs externes.", "Important"],
    ]],
    ["Réversibilité", "Possibilité de corriger la trajectoire.", "Important", [
      ["Coût de sortie si l'hypothèse se révèle fausse", "Ce qu'il en coûterait de revenir en arrière à mi-parcours.", "Important", true],
    ]],
  ] },
  { label: "Acceptabilité et conformité", description: "Adhésion des parties prenantes et respect des exigences non négociables.", importance: "Important", nature: "efficacite", mops: [
    ["Adhésion des parties prenantes", "Soutien des décideurs et des impactés.", "Important", [
      ["Adhésion des décideurs", "Niveau de soutien de ceux qui arbitrent.", "Important"],
      ["Résistance attendue des parties impactées", "Intensité des oppositions prévisibles.", "Secondaire"],
    ]],
    ["Conformité", "Respect du cadre imposé.", "Essentiel", [
      ["Respect des exigences non négociables", "Aucune exigence essentielle compromise.", "Essentiel"],
    ]],
  ] },
  { label: "Tenue de l'horizon", description: "Capacité à produire le résultat dans le délai visé.", importance: "Secondaire", nature: "cout", mops: [
    ["Délai de mise en œuvre", "Temps nécessaire au déploiement.", "Important", [
      ["Délai de mise en œuvre", "Durée entre la décision et l'effet opérationnel.", "Important"],
      ["Jalons intermédiaires sécurisés", "Points de contrôle permettant d'ajuster en route.", "Secondaire"],
    ]],
  ] },
];

const GENERIC_LEVERS: TplLev[] = [
  { label: "Ampleur de l'engagement", type: "decision", options: [
    ["Statu quo amélioré", "Préserve les coûts, limite la valeur créée."],
    ["Pilote ciblé", "Réduit le risque d'exécution, valeur partielle."],
    ["Déploiement progressif", "Équilibre valeur et maîtrise du risque."],
    ["Engagement complet", "Valeur maximale, coût et risque élevés."],
    ["Engagement en tranches conditionnelles, chacune débloquée par un signal", "Garde la réversibilité sans renoncer à l'ambition.", true],
  ] },
  { label: "Calendrier", type: "temps", options: [
    ["Lancement immédiat", "Bénéfices plus tôt, préparation réduite."],
    ["Par phases successives", "Sécurise les jalons intermédiaires."],
    ["Différé après validation", "Réduit le risque, retarde la valeur."],
  ] },
  { label: "Mode de réalisation", type: "ressource", options: [
    ["En interne", "Maîtrise forte, charge élevée sur les équipes clés."],
    ["Avec un partenaire", "Accès à des compétences, dépendance accrue."],
    ["Externalisé", "Soulage les équipes, réversibilité plus faible."],
    ["Co-construction avec un client pilote", "Valide la valeur au plus près du bénéficiaire.", true],
  ] },
  { label: "Financement et ressources", type: "budget", options: [
    ["Budget existant", "Aucun arbitrage supplémentaire, ambition limitée."],
    ["Réallocation depuis un autre projet", "Coût d'opportunité à assumer."],
    ["Enveloppe dédiée", "Moyens adaptés, engagement financier accru."],
    ["Partage des coûts avec un acteur de l'écosystème", "Réduit l'investissement, crée une dépendance.", true],
  ] },
  { label: "Gouvernance de la décision", type: "decision", options: [
    ["Décideur unique", "Rapidité, adhésion collective moindre."],
    ["Comité de pilotage", "Adhésion accrue, délais plus longs."],
    ["Pilotage par jalons go / no-go", "Réversibilité et contrôle du risque."],
  ] },
  { label: "Traitement du risque principal", type: "risque", options: [
    ["Accepter le risque", "Aucun coût supplémentaire, exposition entière."],
    ["Réduire par un plan de mitigation", "Coût modéré, exposition réduite."],
    ["Transférer (assurance, contrat)", "Exposition transférée, coût récurrent."],
    ["Option de sortie négociée dès le départ", "Rend l'erreur peu coûteuse.", true],
  ] },
];

const SUPPLY_MOE: TplMoe[] = [
  { label: "Continuité du service client", description: "Servir les clients malgré la perturbation observée.", importance: "Essentiel", nature: "efficacite", mops: [
    ["Niveau de service", "Tenue des engagements de livraison.", "Essentiel", [
      ["Taux de service (OTIF) sur les références exposées", "Livraisons complètes et à l'heure pendant la perturbation.", "Essentiel"],
      ["Commandes clients en retard", "Volume de commandes dont la date promise glisse.", "Important"],
    ]],
    ["Protection des clients prioritaires", "Préserver les comptes stratégiques.", "Important", [
      ["Couverture des clients stratégiques", "Part de la demande prioritaire effectivement servie.", "Important"],
    ]],
  ] },
  { label: "Rapidité de rétablissement", description: "Revenir vite à un flux nominal.", importance: "Essentiel", nature: "efficacite", mops: [
    ["Réactivité", "Vitesse de mise en œuvre de la parade.", "Important", [
      ["Délai de rétablissement (TTR)", "Temps pour revenir au flux nominal.", "Essentiel"],
      ["Délai de mise en œuvre de la parade", "Temps entre la décision et l'effet sur le flux.", "Important"],
    ]],
    ["Visibilité amont", "Détecter plus tôt la prochaine rupture.", "Secondaire", [
      ["Délai entre le premier signal fournisseur et l'alerte interne", "Avance gagnée pour réagir avant la rupture.", "Important", true],
    ]],
  ] },
  { label: "Coût de la réponse", description: "Surcoûts engagés pour absorber la perturbation.", importance: "Important", nature: "cout", mops: [
    ["Surcoûts logistiques", "Transport et stockage additionnels.", "Important", [
      ["Coût de transport additionnel", "Surcoût des modes ou itinéraires alternatifs.", "Important"],
      ["Coût de possession du stock de sécurité", "Immobilisation liée au stock renforcé.", "Secondaire"],
    ]],
    ["Impact sur la marge", "Ventes perdues et pénalités.", "Important", [
      ["Marge perdue sur ventes manquées", "Marge non réalisée faute de disponibilité.", "Important"],
    ]],
  ] },
  { label: "Exposition résiduelle au risque", description: "Dépendances qui subsistent après la décision.", importance: "Essentiel", nature: "risque", mops: [
    ["Dépendance fournisseurs", "Concentration de l'approvisionnement.", "Essentiel", [
      ["Part d'approvisionnement mono-source", "Part des volumes critiques sans alternative qualifiée.", "Essentiel"],
      ["Temps de survie en cas de perte du fournisseur critique (TTS)", "Durée pendant laquelle la demande reste servie sans lui.", "Important"],
    ]],
    ["Risque d'exécution", "Faisabilité de la parade.", "Important", [
      ["Qualification des sources alternatives", "Maturité des fournisseurs ou sites de repli.", "Important"],
    ]],
  ] },
  { label: "Durabilité de la chaîne", description: "Effets environnementaux et sociaux de la réponse.", importance: "Secondaire", nature: "efficacite", mops: [
    ["Empreinte du transport", "Émissions liées aux modes retenus.", "Secondaire", [
      ["Émissions du transport de secours", "Émissions induites par l'accélération des flux.", "Secondaire"],
    ]],
  ] },
];

const SUPPLY_LEVERS: TplLev[] = [
  { label: "Stratégie de sourcing", type: "decision", options: [
    ["Maintenir le fournisseur actuel", "Aucun coût de bascule, exposition inchangée."],
    ["Double sourcing sur les références critiques", "Réduit la part mono-source, coût de qualification."],
    ["Fournisseur de secours pré-qualifié", "Améliore le TTS, effort de qualification limité."],
    ["Mutualiser un stock de sécurité avec un pair du secteur", "Couverture partagée à coût réduit.", true],
  ] },
  { label: "Stock de sécurité", type: "ressource", options: [
    ["Niveau inchangé", "Aucun coût de possession supplémentaire."],
    ["Renforcé sur les références critiques", "Protège l'OTIF, immobilise du capital."],
    ["Stock avancé près des clients prioritaires", "Protège les comptes stratégiques."],
    ["Stock consigné chez le fournisseur (VMI)", "Déporte le coût de possession.", true],
  ] },
  { label: "Mode et itinéraire de transport", type: "technique", options: [
    ["Mode et itinéraire actuels", "Coût stable, délai subi."],
    ["Accélération (express ou aérien)", "Réduit le TTR, surcoût et émissions."],
    ["Itinéraire ou port alternatif", "Contourne la perturbation, délai de mise en place."],
    ["Bascule multimodale", "Compromis coût, délai et émissions."],
  ] },
  { label: "Allocation de la disponibilité", type: "decision", options: [
    ["Premier arrivé, premier servi", "Simple, clients stratégiques exposés."],
    ["Priorité aux clients stratégiques", "Protège les comptes clés."],
    ["Allocation au prorata des commandes", "Équité, service partiel pour tous."],
    ["Proposer une référence de substitution au client", "Sert la demande sans la pièce manquante.", true],
  ] },
  { label: "Planification de la production", type: "temps", options: [
    ["Plan inchangé", "Aucun effort, risque de rupture."],
    ["Réordonnancement des ordres de fabrication", "Priorise les références exposées."],
    ["Capacité additionnelle (équipes, heures)", "Rattrape le retard, coût de main-d'œuvre."],
    ["Sous-traitance de capacité", "Absorbe le pic, dépendance nouvelle."],
  ] },
  { label: "Cadre contractuel fournisseurs", type: "risque", options: [
    ["Statu quo contractuel", "Aucune négociation, aucune garantie."],
    ["Clauses de pénalités de retard", "Transfère une part du coût, relation tendue."],
    ["Capacité réservée en contrat cadre", "Sécurise les volumes, engagement ferme."],
    ["Co-planification avec partage des prévisions", "Détection plus précoce des ruptures.", true],
  ] },
];

const USER_LEVER_OPTIONS: TplOpt[] = [
  ["Maintenir en l'état", "Point de référence, aucun effort supplémentaire."],
  ["Ajuster à la marge", "Gain limité, mise en œuvre rapide."],
  ["Transformer en profondeur", "Gain potentiel élevé, effort et risque accrus."],
  ["Confier ce levier à un partenaire spécialisé", "Accès à une expertise externe, dépendance nouvelle.", true],
];

function slug(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function splitList(s?: string): string[] {
  if (!s) return [];
  return s.split(/[,;\n•]+/).map(x => x.trim().replace(/\.$/, "")).filter(x => x.length > 2 && x.length < 90);
}

export function isSupplyContext(input: FallbackInput): boolean {
  if (input.supplyChain) return true;
  if (input.sector && /supply|logisti|approvision/i.test(input.sector)) return true;
  return /supply chain|fournisseur|approvisionnement|rupture de stock|OTIF|entrep[oô]t|transport(eur)? /i.test(input.context ?? "");
}

function buildObjectives(tpl: TplMoe[], e?: Partial<ElicitationData>): GeneratedObjective[] {
  return tpl.map((moe, i) => ({
    id: `obj_${i + 1}`,
    label: moe.label,
    description: moe.description,
    importance: moe.importance,
    nature: moe.nature,
    besoinTrace: i === 0 && e?.objectif ? `Objectif exprimé : ${e.objectif}` : undefined,
    children: moe.mops.map(([label, description, importance, tpms], j) => ({
      id: `crit_${i + 1}_${j + 1}`,
      label, importance,
      description: label === "Conformité" && e?.exigencesNonNeg ? `${description} Exigences citées : ${e.exigencesNonNeg}` : description,
      children: tpms.map(([tl, td, ti, lamp], k) => ({
        id: `ind_${i + 1}_${j + 1}_${k + 1}`, label: tl, description: td, importance: ti,
        ...(lamp ? { exploratoire: true } : {}),
      })),
    })),
  }));
}

function buildLever(t: TplLev, idx: number): GeneratedLevier {
  return {
    id: `lev_${idx}`, label: t.label, type: t.type,
    options: t.options.map(([label, justification, lamp], k) => ({
      id: `opt_${idx}_${k + 1}`, label, justification, ...(lamp ? { exploratoire: true } : {}),
    })),
  };
}

/** Modèle de secours complet, déterministe, sans chiffre inventé. */
export function buildFallbackModel(input: FallbackInput): GeneratedFullModel {
  const supply = isSupplyContext(input);
  const e = input.elicitation;
  const criteria = buildObjectives(supply ? SUPPLY_MOE : GENERIC_MOE, e);
  const templates = supply ? SUPPLY_LEVERS : GENERIC_LEVERS;
  const leviers: GeneratedLevier[] = [];
  // Les leviers cités par le décideur passent en premier : ce sont les siens.
  const known = new Set(templates.map(t => slug(t.label)));
  for (const lbl of splitList(e?.leviersDDP).slice(0, 4)) {
    if (known.has(slug(lbl))) continue;
    known.add(slug(lbl));
    leviers.push(buildLever({ label: lbl.charAt(0).toUpperCase() + lbl.slice(1), type: "decision", options: USER_LEVER_OPTIONS }, leviers.length + 1));
  }
  for (const t of templates) leviers.push(buildLever(t, leviers.length + 1));
  return { criteria, leviers };
}

export interface RichnessCounts { objectives: number; indicators: number; leviers: number; options: number; lamps: number }

export function countModel(m: GeneratedFullModel): RichnessCounts {
  let indicators = 0, lamps = 0;
  const walk = (n: { children?: unknown[]; exploratoire?: boolean }) => {
    const ch = (n.children ?? []) as Array<{ children?: unknown[]; exploratoire?: boolean }>;
    if (!ch.length) { indicators++; if (n.exploratoire) lamps++; return; }
    ch.forEach(walk);
  };
  m.criteria.forEach(o => (o.children?.length ? o.children.forEach(walk) : walk(o)));
  const options = m.leviers.reduce((s, l) => s + l.options.length, 0);
  lamps += m.leviers.reduce((s, l) => s + l.options.filter(o => o.exploratoire).length, 0);
  return { objectives: m.criteria.length, indicators, leviers: m.leviers.length, options, lamps };
}

/**
 * Plancher de richesse appliqué à un modèle généré (LLM) : complète sans jamais
 * retirer ni réécrire ce qui a été produit.
 * – au moins 3 objectifs, au moins 5 leviers, au moins 3 options par levier ;
 * – au moins une option inspirante (lampe).
 */
export function ensureRichModel(model: GeneratedFullModel, input: FallbackInput): GeneratedFullModel {
  const fb = buildFallbackModel(input);
  const criteria = [...(model.criteria ?? [])];
  if (criteria.length < 3) {
    const have = new Set(criteria.map(c => slug(c.label)));
    for (const o of fb.criteria) {
      if (criteria.length >= 3) break;
      if (!have.has(slug(o.label))) criteria.push({ ...o, id: `${o.id}_aura` });
    }
  }
  const leviers: GeneratedLevier[] = (model.leviers ?? []).map(l => ({ ...l, options: [...(l.options ?? [])] }));
  const levSlugs = new Set(leviers.map(l => slug(l.label)));
  for (const l of fb.leviers) {
    if (leviers.length >= 5) break;
    if (!levSlugs.has(slug(l.label))) { leviers.push({ ...l, id: `${l.id}_aura` }); levSlugs.add(slug(l.label)); }
  }
  for (const l of leviers) {
    let k = 0;
    while (l.options.length < 3 && k < USER_LEVER_OPTIONS.length) {
      const [label, justification] = USER_LEVER_OPTIONS[k++];
      if (!l.options.some(o => slug(o.label) === slug(label))) l.options.push({ id: `${l.id}_aura_${k}`, label, justification });
    }
  }
  if (!leviers.some(l => l.options.some(o => o.exploratoire))) {
    // Un levier entier du modèle de référence, cohérent avec son option inspirante,
    // plutôt qu'une option greffée sur un levier sans rapport.
    const lampLev = fb.leviers.find(l => !levSlugs.has(slug(l.label)) && l.options.some((o: GeneratedOption) => o.exploratoire));
    if (lampLev) leviers.push({ ...lampLev, id: `${lampLev.id}_aura` });
  }
  return { criteria, leviers };
}
