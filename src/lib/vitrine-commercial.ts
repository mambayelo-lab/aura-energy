// vitrine-commercial.ts — couche commerciale du site vitrine.
//
// Pourquoi ce fichier : le texte existant (vitrine-copy.ts) est juste, mais il
// est écrit comme une note de méthode. Un visiteur qui découvre Aura a besoin,
// dans les dix premières secondes, de trois choses : ce que c'est, ce qu'il y
// gagne, et la preuve que ça marche sur un cas comme le sien.
//
// Registre emprunté : Palantir (phrases courtes, affirmatives, l'institution
// décide, le logiciel outille) et Datadog (bénéfice nommé avant la mécanique,
// entrée par le rôle et par le cas). Mindset entrepreneuriat tech : on assume
// une position de catégorie — Decision Intelligence & Augmented Architecture — plutôt que
// de se décrire comme un outil de plus.
//
// Contraintes tenues : aucun chiffre client, aucun logo, aucun cas nominatif
// présenté comme une référence commerciale. Les cas sont des situations types,
// annoncées comme telles, et restent qualitatives.

export type L = "fr" | "en";
type Bi = { fr: string; en: string };

export interface UseCase {
  dom: Bi;
  titre: Bi;
  situation: Bi;
  aura: Bi;
  sortie: Bi;
  role: Bi;
}

export const COM: {
  hero: {
    eyebrow: Bi; h1: Bi; h1b: Bi; sub: Bi; ctaA: Bi; ctaB: Bi;
    proof: Bi[];
  };
  data: { eyebrow: Bi; h2: Bi; lead: Bi; cols: { t: Bi; d: Bi }[]; note: Bi };
  valeur: { eyebrow: Bi; h2: Bi; lead: Bi; items: { t: Bi; d: Bi }[] };
  cas: { eyebrow: Bi; h2: Bi; lead: Bi; sitLabel: Bi; auraLabel: Bi; outLabel: Bi; cta: Bi; items: UseCase[] };
  roles: { eyebrow: Bi; h2: Bi; items: { t: Bi; d: Bi }[] };
  gartner: { eyebrow: Bi; h2: Bi; lead: Bi; cta: Bi };
  final: { h2: Bi; lead: Bi; ctaA: Bi; ctaB: Bi; note: Bi };
  cout: { eyebrow: Bi; h2: Bi; lead: Bi; items: { t: Bi; d: Bi }[] };
  modules: {
    eyebrow: Bi; h2: Bi; lead: Bi;
    items: { t: Bi; d: Bi; bullets: Bi[] }[];
    backward: { t: Bi; d: Bi; cta: Bi };
  };
} = {
  hero: {
    eyebrow: { fr: "Decision Intelligence & Augmented Architecture", en: "Decision Intelligence & Augmented Architecture" },
    h1: { fr: "Décidez ce qui doit changer.", en: "Decide what must change." },
    h1b: { fr: "Architecturez ce qui vient ensuite.", en: "Architect what comes next." },
    sub: {
      fr: "Une conversation guidée transforme une situation complexe en décision explicable, puis en architecture et en actions cohérentes. Aura utilise vos données lorsqu’elles existent, signale ce qui manque et laisse toujours la décision aux humains.",
      en: "Aura structures your critical trade-offs, settles them on a rule you can defend, then turns them into an execution plan. With your data when it exists. Without inventing it when it does not. Always with the knowledge your teams already hold.",
    },
    ctaA: { fr: "Analyser une décision", en: "Analyse a decision" },
    ctaB: { fr: "Voir la plateforme en 2 min", en: "See the platform in 2 min" },
    proof: [
      { fr: "Décider avant que la donnée existe", en: "Decide before the data exists" },
      { fr: "Relier décision, architecture et exécution", en: "Connect decisions to architecture and execution" },
      { fr: "Apprendre de ce qui s'est réellement passé", en: "Learn from what actually happened" },
      { fr: "Une fiche d'une page, signable", en: "A one-page record, ready to sign" },
    ],
  },

  data: {
    eyebrow: { fr: "Notre position", en: "Where we stand" },
    h2: { fr: "Avec ou sans données. Jamais sans vous.", en: "With or without data. Never without you." },
    lead: {
      fr: "La plupart des plateformes attendent que la donnée soit prête. Vos comités, eux, décident la semaine prochaine. Aura part de ce qui est su — puis remplace l'appréciation par le fait dès qu'il arrive.",
      en: "Most platforms wait for the data to be ready. Your committees decide next week. Aura starts from what is known — then replaces judgement with fact as soon as fact arrives.",
    },
    cols: [
      {
        t: { fr: "Avec vos données", en: "With your data" },
        d: { fr: "Le copilote se branche sur vos systèmes, suit la santé par domaine et instruit le dossier avec des preuves rattachées à leur source.", en: "The copilot connects to your systems, tracks health by domain and builds the case with evidence traced back to its source." },
      },
      {
        t: { fr: "Sans vos données", en: "Without your data" },
        d: { fr: "Aucune donnée disponible ? La séance démarre quand même : options, critères, niveaux qualitatifs. Rien n'est inventé, rien n'est chiffré à tort.", en: "No data available? The session still starts: options, criteria, qualitative levels. Nothing is invented, nothing is falsely quantified." },
      },
      {
        t: { fr: "Toujours avec la connaissance humaine", en: "Always with human knowledge" },
        d: { fr: "Ce sont vos experts qui classent, arbitrent et signent. L'IA générative instruit, reformule et rédige — elle ne tranche jamais à votre place.", en: "Your experts rank, arbitrate and sign. Generative AI interviews, restates and drafts — it never decides for you." },
      },
    ],
    note: {
      fr: "C'est la ligne que nous ne franchissons pas : une plateforme qui décide seule n'est pas défendable devant un régulateur, un conseil ou un auditeur.",
      en: "This is the line we do not cross: a platform that decides on its own cannot be defended to a regulator, a board or an auditor.",
    },
  },

  valeur: {
    eyebrow: { fr: "Ce que vous y gagnez", en: "What you get" },
    h2: { fr: "Décidez plus vite. Défendez la décision. Exécutez-la.", en: "Decide faster. Defend the decision. Execute it." },
    lead: {
      fr: "Trois blocages reviennent dans chaque comité : on ne sait pas trancher, on ne sait pas justifier, on ne sait pas dérouler. Aura attaque les trois dans le même environnement.",
      en: "Three blockers show up in every committee: no one can settle it, no one can justify it, no one can roll it out. Aura tackles all three in one environment.",
    },
    items: [
      {
        t: { fr: "La séance aboutit", en: "The meeting concludes" },
        d: { fr: "Les désaccords sont cartographiés au lieu d'être arbitrés à la voix la plus forte. Vous sortez avec une option retenue et le critère qui a tranché.", en: "Disagreements are mapped instead of being settled by the loudest voice. You leave with a chosen option and the criterion that decided it." },
      },
      {
        t: { fr: "La décision tient à l'audit", en: "The decision survives audit" },
        d: { fr: "Règle publiée, jugements datés, participants nommés. Six mois plus tard, la conclusion se rejoue à l'identique, devant qui la demande.", en: "Published rule, dated judgements, named participants. Six months later the conclusion replays identically, for whoever asks." },
      },
      {
        t: { fr: "Rien ne se perd entre décider et faire", en: "Nothing is lost between deciding and doing" },
        d: { fr: "Le choix devient cible, flux, séquence et backlog par vagues — et le coût se lit en amont, depuis ce qui a été décrit.", en: "The choice becomes a target, flows, a sequence and a wave-based backlog — with cost readable upfront, from what was described." },
      },
      {
        t: { fr: "Vous savez, après coup, si c'était juste", en: "You learn, afterwards, whether it was right" },
        d: { fr: "Chaque décision signée entre dans un registre de suivi : prévu contre constaté, preuves rattachées, réserves levées ou non.", en: "Every signed decision enters a tracking register: expected versus observed, evidence attached, caveats cleared or not." },
      },
    ],
  },

  cas: {
    eyebrow: { fr: "Cas d'usage", en: "Use cases" },
    h2: { fr: "Des situations que vous reconnaîtrez", en: "Situations you will recognise" },
    lead: {
      fr: "Trois arbitrages réels de nos secteurs prioritaires, décrits comme ils se présentent en séance. Situations types, volontairement qualitatives : aucun chiffre client n'est avancé.",
      en: "Three real trade-offs from our priority sectors, described as they show up in the room. Typical situations, deliberately qualitative: no client figures are claimed.",
    },
    sitLabel: { fr: "La situation", en: "The situation" },
    auraLabel: { fr: "Ce que fait Aura", en: "What Aura does" },
    outLabel: { fr: "Ce qui sort de la séance", en: "What leaves the room" },
    cta: { fr: "Voir tous les cas du secteur", en: "See every case in this sector" },
    items: [
      {
        dom: { fr: "Énergie & Utilities", en: "Energy & Utilities" },
        role: { fr: "Direction technique · régulation", en: "Technical direction · regulatory" },
        titre: { fr: "Renforcer le réseau, stocker, ou effacer la pointe", en: "Reinforce the grid, store, or shave the peak" },
        situation: { fr: "Une charge nouvelle dépasse la capacité fermes d'un poste. Trois leviers, un critère de sûreté non négociable, un régulateur qui demandera pourquoi ce levier-là.", en: "A new load exceeds the firm capacity of a substation. Three levers, one non-negotiable safety criterion, and a regulator who will ask why this lever." },
        aura: { fr: "Les leviers sont comparés critère par critère, en niveaux ordinaux. La sûreté ne se fait pas racheter par une économie de coût.", en: "Levers are compared criterion by criterion, in ordinal levels. Safety is never bought off by a cost saving." },
        sortie: { fr: "Le levier engagé, le critère décisif, la marge avant renversement — et le backlog de mise en œuvre qui en découle.", en: "The lever committed, the deciding criterion, the margin before the ranking flips — and the implementation backlog that follows." },
      },
      {
        dom: { fr: "Retail & distribution", en: "Retail" },
        role: { fr: "Direction commerciale · direction financière", en: "Commercial · finance" },
        titre: { fr: "Réduire l'assortiment sans fermer de ventes stratégiques", en: "Trim the range without closing strategic sales" },
        situation: { fr: "Simplifier l'exécution ferme des ventes. Le commerce, la finance et la supply classent les mêmes références dans trois ordres différents.", en: "Simplifying execution closes sales. Commerce, finance and supply rank the same references in three different orders." },
        aura: { fr: "Chaque direction classe depuis son poste. Aura montre où les lectures divergent, puis tranche sur la hiérarchie de critères validée en séance.", en: "Each function ranks from its own seat. Aura shows where the readings diverge, then settles on the criteria hierarchy agreed in the room." },
        sortie: { fr: "Les références retirées, celles qui restent sous réserve nommée, et le responsable de chaque réserve.", en: "The references withdrawn, those kept under a named caveat, and the owner of each caveat." },
      },
      {
        dom: { fr: "Supply chain", en: "Supply chain" },
        role: { fr: "Opérations · achats", en: "Operations · procurement" },
        titre: { fr: "Doubler une source ou tenir le stock", en: "Dual-source or hold buffer stock" },
        situation: { fr: "Un choc fournisseur est possible, sa probabilité n'est pas connue. Attendre la donnée coûte plus cher que décider avec ce qui est su.", en: "A supplier shock is possible, its probability unknown. Waiting for data costs more than deciding on what is known." },
        aura: { fr: "Les deux réponses sont décrites par ce qu'elles apportent et ce qu'elles coûtent, séparément. Aucune moyenne ne masque la traçabilité perdue.", en: "Both answers are described by what they bring and what they cost, separately. No average hides the traceability lost." },
        sortie: { fr: "Une décision signée, la condition qui la ferait rejouer, et le suivi prévu contre constaté sur les critères qui ont tranché.", en: "A signed decision, the condition that would replay it, and expected-versus-observed tracking on the criteria that decided." },
      },
    ],
  },

  roles: {
    eyebrow: { fr: "Par rôle", en: "By role" },
    h2: { fr: "Ce que vous ouvrez lundi matin", en: "What you open on Monday morning" },
    items: [
      { t: { fr: "Direction générale", en: "Executive committee" }, d: { fr: "L'état de santé par domaine, les décisions en attente, et celles que vous avez signées.", en: "Health by domain, decisions pending, and those you have signed." } },
      { t: { fr: "Direction financière", en: "Finance" }, d: { fr: "Le coût de la transformation lu en amont, et l'écart prévu / constaté sur les décisions engagées.", en: "Transformation cost read upfront, and expected-versus-observed on committed decisions." } },
      { t: { fr: "Opérations", en: "Operations" }, d: { fr: "Les arbitrages répétés outillés une fois pour toutes, avec le même vocabulaire de critères.", en: "Recurring trade-offs tooled once, with a single criteria vocabulary." } },
      { t: { fr: "DSI & architecture", en: "IT & architecture" }, d: { fr: "La cible, les flux nommés, le backlog par vagues — dérivés de la décision, pas rédigés à côté.", en: "The target, named flows, the wave-based backlog — derived from the decision, not written alongside it." } },
    ],
  },

  gartner: {
    eyebrow: { fr: "Catégorie", en: "Category" },
    h2: { fr: "Gartner appelle cela decision intelligence. Nous y ajoutons l'architecture.", en: "Gartner calls it decision intelligence. We add architecture." },
    lead: {
      fr: "La catégorie exige la boucle entière : expliciter comment la décision est prise, puis mesurer ce qu'elle produit. Nous la tenons de bout en bout, avec un parti pris — le raisonnement reste qualitatif et non compensatoire, et l'humain garde la signature.",
      en: "The category demands the full loop: make explicit how the decision is made, then measure what it produces. We hold it end to end, with a stance — the reasoning stays qualitative and non-compensatory, and the human keeps the signature.",
    },
    cta: { fr: "Lire la définition et nos écarts", en: "Read the definition and where we differ" },
  },

  final: {
    h2: { fr: "Une décision réelle, sur vos critères.", en: "A real decision, on your criteria." },
    lead: {
      fr: "Une séance suffit pour modéliser un arbitrage en cours et produire la fiche signable. Votre vocabulaire de critères vous reste.",
      en: "One session is enough to model a live trade-off and produce the signable record. Your criteria vocabulary stays with you.",
    },
    ctaA: { fr: "Analyser une décision", en: "Analyse a decision" },
    ctaB: { fr: "Présenter votre cas", en: "Present your case" },
    note: { fr: "Sans carte bancaire. Aucun connecteur requis pour la première séance.", en: "No credit card. No connector required for the first session." },
  },

  // Registre emprunté à Geeglee : nommer le coût de la mauvaise décision avant
  // de parler du produit. Aucun chiffre : uniquement des conséquences que le
  // visiteur reconnaît dans ses propres comités.
  cout: {
    eyebrow: { fr: "Le vrai risque", en: "The real risk" },
    h2: { fr: "Une décision mal tranchée coûte plus cher qu'une décision tardive.", en: "A badly settled decision costs more than a late one." },
    lead: {
      fr: "Ce que l'on paie ensuite ne se lit jamais dans le compte rendu de séance. Aura rend ces quatre coûts visibles au moment où ils se décident encore.",
      en: "What you pay afterwards never shows up in the minutes. Aura makes these four costs visible while they can still be avoided.",
    },
    items: [
      { t: { fr: "Le retour arrière", en: "The reversal" }, d: { fr: "L'option retenue heurte une contrainte que personne n'avait posée comme rédhibitoire.", en: "The chosen option hits a constraint nobody had declared a deal-breaker." } },
      { t: { fr: "La séance qui se rejoue", en: "The meeting replayed" }, d: { fr: "Faute de règle écrite, le même arbitrage revient au comité suivant, avec d'autres arguments.", en: "With no written rule, the same trade-off returns at the next committee with new arguments." } },
      { t: { fr: "Le plan orphelin", en: "The orphan plan" }, d: { fr: "La décision est prise, mais le programme d'exécution est rédigé à côté, sans lien avec ce qui a tranché.", en: "The decision is made, but the execution plan is written alongside it, disconnected from what settled it." } },
      { t: { fr: "L'absence de retour d'expérience", en: "No lessons learned" }, d: { fr: "Personne ne sait, deux ans plus tard, si le choix était bon — donc rien n'est appris.", en: "Two years later nobody knows whether the choice was right — so nothing is learned." } },
    ],
  },

  // Trois modules nommés, avec des capacités vérifiables produit par produit.
  modules: {
    eyebrow: { fr: "La plateforme", en: "The platform" },
    h2: { fr: "Trois modules, un seul raisonnement", en: "Three modules, one reasoning" },
    lead: {
      fr: "Le même vocabulaire de critères traverse les trois. Rien n'est ressaisi d'un module à l'autre.",
      en: "The same criteria vocabulary runs through all three. Nothing is re-entered between modules.",
    },
    items: [
      {
        t: { fr: "Décider", en: "Decide" },
        d: { fr: "Cadrer l'arbitrage et le trancher sur une règle publiée.", en: "Frame the trade-off and settle it on a published rule." },
        bullets: [
          { fr: "Options, critères et niveaux qualitatifs — sans chiffrer ce qui n'est pas mesuré", en: "Options, criteria and qualitative levels — without quantifying what is not measured" },
          { fr: "Dominance : voir immédiatement s'il existe mieux", en: "Dominance: see immediately whether something better exists" },
          { fr: "Robustesse : la marge avant que le verdict ne se renverse", en: "Robustness: the margin before the verdict flips" },
          { fr: "Fiche d'une page, signable et rejouable à l'identique", en: "A one-page record, signable and replayable identically" },
        ],
      },
      {
        t: { fr: "Architecturer", en: "Architect" },
        d: { fr: "Prolonger la décision en cible, flux et backlog.", en: "Extend the decision into target, flows and backlog." },
        bullets: [
          { fr: "Cible fonctionnelle et cartographie inter-applicative dérivées du cadrage", en: "Functional target and inter-application map derived from the framing" },
          { fr: "Séquence de transformation et backlog par vagues (epics, features, user stories)", en: "Transformation sequence and wave-based backlog (epics, features, user stories)" },
          { fr: "Alertes de cohérence quand un schéma s'écarte de ce qui a été décidé", en: "Consistency alerts when a diagram drifts from what was decided" },
          { fr: "Édition manuelle assumée : vous ajoutez, supprimez, corrigez", en: "Manual editing by design: you add, remove, correct" },
        ],
      },
      {
        t: { fr: "Copilote décisionnel", en: "Decision copilot" },
        d: { fr: "Instruire le dossier avec vos systèmes et vos documents.", en: "Build the case from your systems and documents." },
        bullets: [
          { fr: "Import de documents, ontologie minimale, mapping des objets métier", en: "Document import, minimal ontology, business-object mapping" },
          { fr: "Preuves rattachées à leur source, jamais reformulées en fait", en: "Evidence attached to its source, never restated as fact" },
          { fr: "Dialogue en français ou en anglais, à l'écrit comme à la voix", en: "Dialogue in French or English, written or spoken" },
          { fr: "L'IA instruit et rédige ; elle ne tranche jamais à votre place", en: "AI interviews and drafts; it never decides for you" },
        ],
      },
    ],
    backward: {
      t: { fr: "Et si aucune option ne convient : la lecture inverse", en: "And if no option fits: the reverse reading" },
      d: {
        fr: "Partez de l'objectif visé plutôt que des options. Aura remonte les combinaisons de leviers qui l'atteignent, et nomme celles qui restent hors d'atteinte tant qu'une contrainte n'est pas levée.",
        en: "Start from the target rather than the options. Aura works back to the combinations of levers that reach it, and names those out of reach until a constraint is lifted.",
      },
      cta: { fr: "Voir la méthode", en: "See the method" },
    },
  },
};

