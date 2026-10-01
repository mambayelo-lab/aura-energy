// onboarding-scripts.ts — « Comment ça marche » : le script pédagogique de
// chaque application Aura, écrit pour être LU À VOIX HAUTE (voix off) autant
// que lu à l'écran. Un chapitre = une idée, une phrase par idée, dans le
// registre d'un directeur de mission : à quoi sert l'application, ce que
// l'utilisateur fait à chaque étape, et sur quoi ça débouche.
//
// Le texte vit ici (pas dans le composant) pour deux raisons :
//  · il sert de script de tournage au rendu vidéo Remotion FR/EN — mêmes mots
//    à l'écran et dans la voix off, jamais deux versions qui divergent ;
//  · il reste relisible et corrigeable sans toucher au lecteur.
//
// Rien d'inventé : chaque chapitre décrit une capacité réellement présente
// dans l'application, illustrée sur le cas démo (GRDF pour Architecturer).

export type OnboardingApp = "architecturer" | "decider" | "copilote";

export interface OnboardingChapter {
  /** Titre court affiché dans le sommaire. */
  title: string;
  /** Une à trois phrases, dites à voix haute telles quelles. */
  body: string;
  /** Repère à l'écran : où regarder pendant ce chapitre. */
  where?: string;
  /** Capture d'écran réelle de l'application illustrant ce chapitre —
   *  fichier de remotion/public/shots/. Aucune image de synthèse : si la
   *  capture manque, la vidéo retombe sur la planche typographique plutôt
   *  que de montrer un écran qui n'existe pas. */
  shot?: string;
}

export interface OnboardingScript {
  app: OnboardingApp;
  title: string;
  pitch: string;
  chapters: OnboardingChapter[];
}

const FR: Record<OnboardingApp, OnboardingScript> = {
  architecturer: {
    app: "architecturer",
    title: "Architecturer une transformation",
    pitch: "Passer d'un problème formulé en réunion à une architecture cible et un backlog défendables.",
    chapters: [
      {
        title: "Bienvenue",
        where: "Vous êtes dans Architecturer",
        shot: "arch-home.png",
        body: "Bienvenue dans AURA. Vous êtes dans Architecturer, l'application qui construit la mise en œuvre d'une décision. Tout ce qui suit est montré sur de vrais écrans, avec le cas démo du réseau gazier.",
      },
      {
        title: "À quoi ça sert",
        where: "Parcours en haut de l'écran",
        shot: "arch-home.png",
        body: "Architecturer transforme une intention de transformation en modèle exploitable : cadrage, capacités métier, architecture cible, dossier et backlog. Tout ce que vous voyez est dérivé de ce que vous avez saisi : aucun schéma n'est décoratif.",
      },
      {
        title: "Cadrer",
        where: "Étape Cadrage",
        shot: "arch-cadrage.png",
        body: "Décrivez le problème en langage libre, ou dictez-le. L'IA en déduit le domaine, la problématique sous contrainte, les parties prenantes, les besoins, les exigences et les applications concernées. Chaque champ reste modifiable : la machine propose, vous tranchez.",
      },
      {
        title: "Capacités métier",
        where: "Étape Capacités",
        shot: "arch-capacites.png",
        body: "Vous positionnez les capacités concernées et leur niveau d'exigence. C'est le pivot métier : le reste du dossier s'y rattache, y compris les applications.",
      },
      {
        title: "Cible et flux",
        where: "Étape Cible & flux",
        shot: "arch-cible.png",
        body: "Sept lectures d'un seul modèle : trajectoire As-Is vers cible, capacités vers applications, vue fonctionnelle, schéma inter-applicatif, séquences, liste des flux, dépendances. Le schéma inter-applicatif est éditable directement : glissez une application, tracez un flux, renommez un nœud.",
      },
      {
        title: "Le cas démo GRDF",
        where: "Bouton Démo GRDF, colonne de gauche",
        shot: "arch-demo.png",
        body: "Un clic charge une transformation complète sur le réseau gazier : applications, flux, capacités, besoins, backlog. C'est le meilleur moyen de comprendre l'outil en cinq minutes, et tout y est modifiable.",
      },
      {
        title: "Backlog et traçabilité",
        where: "Étape Backlog",
        shot: "arch-backlog.png",
        body: "Chaque fonctionnalité du backlog remonte au besoin et à l'exigence qui la justifient. L'IA propose ce rattachement, vous le validez ligne par ligne. Une fonctionnalité sans besoin d'origine est signalée : c'est du périmètre non justifié.",
      },
      {
        title: "Ce que vous en sortez",
        where: "Bouton Dossier PDF",
        shot: "arch-rapport.png",
        body: "Un dossier d'architecture imprimable, un backlog par vagues, et une trace de qui a décidé quoi. C'est ce document qui se défend en comité.",
      },
    ],
  },
  decider: {
    app: "decider",
    title: "Décider",
    pitch: "Trancher une décision multicritère sans inventer de chiffres, et pouvoir l'expliquer.",
    chapters: [
      {
        title: "Bienvenue",
        where: "Vous êtes dans Décider",
        shot: "dec-home.png",
        body: "Bienvenue dans AURA. Vous êtes dans Décider, l'application qui structure et tranche un arbitrage. Chaque étape est illustrée sur un vrai écran et sur un cas réellement chargé.",
      },
      {
        title: "À quoi ça sert",
        where: "Fil des étapes",
        shot: "dec-home.png",
        body: "Décider structure un arbitrage : comprendre la décision, poser les options, exprimer les critères, arbitrer, suivre. Le raisonnement est qualitatif et ordinal — aucune moyenne pondérée, aucun score inventé.",
      },
      {
        title: "Comprendre",
        where: "Étape Comprendre",
        shot: "dec-comprendre.png",
        body: "Le compagnon vous pose les questions à voix haute, écoute votre réponse, la reformule et l'enregistre après votre validation. Vous pouvez aussi déposer un document : il alimente le cadrage.",
      },
      {
        title: "Composer et impacter",
        where: "Étapes Composer et Impacter",
        shot: "dec-composer.png",
        body: "Vous posez les options réellement sur la table, puis leur effet sur chaque critère, en niveaux : nul, faible, moyen, fort. Un critère éliminatoire reste éliminatoire : rien ne le compense.",
      },
      {
        title: "Arbitrer",
        where: "Étape Arbitrer",
        shot: "dec-arbitrer.png",
        body: "Le moteur BORA rend un verdict, la carte de décision montre potentiels d'amélioration et de dégradation, la matrice de dominance dit qui bat qui, et la robustesse dit jusqu'où l'ordre d'importance peut bouger avant que la réponse change.",
      },
      {
        title: "Deux registres de lecture",
        where: "Onglets Décideur / Analyste",
        shot: "dec-analyste.png",
        body: "Le registre Décideur donne le verdict, les réserves et la fiche signable. Le registre Analyste ouvre la mécanique : dominance, robustesse, désaccords entre parties prenantes, hypothèses testées par l'agent.",
      },
      {
        title: "Ce que vous en sortez",
        where: "Fiche de décision",
        shot: "dec-fiche.png",
        body: "Une fiche d'une page, signable et imprimable : la question, l'option retenue, ce qui a été écarté et pourquoi. C'est la décision qui reste opposable douze mois plus tard.",
      },
    ],
  },
  copilote: {
    app: "copilote",
    title: "Copilote Décisionnel",
    pitch: "Surveiller la performance, être alerté, et ouvrir un arbitrage sur la bonne question.",
    chapters: [
      {
        title: "Bienvenue",
        where: "Vous êtes dans le Copilote Décisionnel",
        shot: "cop-home.png",
        body: "Bienvenue dans AURA. Vous êtes dans le Copilote Décisionnel, l'application qui surveille votre performance et prépare la décision. Les écrans montrés ici sont ceux de l'application, sur le cas démo.",
      },
      {
        title: "À quoi ça sert",
        where: "Colonne de gauche",
        shot: "cop-home.png",
        body: "Le Copilote observe vos indicateurs, signale ce qui dérive et prépare la décision. Il ne décide jamais à votre place : l'arbitrage est calculé hors modèle de langage, par le moteur BORA.",
      },
      {
        title: "Le Studio",
        where: "Menu Studio",
        shot: "cop-studio.png",
        body: "Le Studio branche le Copilote sur votre réalité : vocabulaire métier, applications sources et leurs accès, puis mapping des objets métier. Chaque étape est guidée par le compagnon, à la voix, avec dépôt de documents.",
      },
      {
        title: "Le dialogue",
        where: "Écran Copilote Décideur",
        shot: "cop-chat.png",
        body: "Vous posez la question en langage courant, en français ou en anglais. La réponse cite ses sources et propose l'action suivante : creuser, alerter, ou ouvrir un arbitrage.",
      },
      {
        title: "Alertes",
        where: "Menu Alertes",
        shot: "cop-alertes.png",
        body: "Un seuil franchi déclenche une alerte, et l'alerte propose une question de décision déjà formulée. C'est le passage de la surveillance à l'arbitrage.",
      },
      {
        title: "Audit et traçabilité",
        where: "Menu Audit & traçabilité",
        shot: "cop-audit.png",
        body: "Chaque décision garde sa justification, ses sources et son auteur. C'est ce qui rend l'usage de l'IA défendable devant un auditeur.",
      },
    ],
  },
};

const EN: Record<OnboardingApp, OnboardingScript> = {
  architecturer: {
    app: "architecturer",
    title: "Architect a transformation",
    pitch: "Turn a problem stated in a meeting into a defensible target architecture and backlog.",
    chapters: [
      { title: "Welcome", where: "You are in Architecturer", shot: "arch-home.png", body: "Welcome to AURA. You are in Architecturer, the application that builds the implementation of a decision. Everything that follows is shown on real screens, using the gas-network demo case." },
      { title: "What it is for", where: "Journey bar at the top", shot: "arch-home.png", body: "Architecturer turns a transformation intent into a workable model: framing, business capabilities, target architecture, dossier and backlog. Every view is derived from what you entered — no decorative diagrams." },
      { title: "Framing", where: "Framing step", shot: "arch-cadrage.png", body: "Describe the problem in plain words, or dictate it. The AI derives the domain, the constrained problem statement, stakeholders, needs, requirements and the applications involved. Everything stays editable: the machine proposes, you decide." },
      { title: "Business capabilities", where: "Capabilities step", shot: "arch-capacites.png", body: "You position the capabilities at stake and the level required. This is the business pivot the rest of the dossier attaches to, applications included." },
      { title: "Target and flows", where: "Target & flows step", shot: "arch-cible.png", body: "Seven readings of one model: As-Is to target trajectory, capabilities to applications, functional view, cross-application diagram, sequences, flow list, dependencies. The cross-application diagram is directly editable: drag an application, draw a flow, rename a node." },
      { title: "The GRDF demo case", where: "GRDF demo button, left column", shot: "arch-demo.png", body: "One click loads a complete gas-network transformation: applications, flows, capabilities, needs, backlog. It is the fastest way to understand the tool, and all of it is editable." },
      { title: "Backlog and traceability", where: "Backlog step", shot: "arch-backlog.png", body: "Every backlog feature traces back to the need and requirement that justify it. The AI proposes those links, you approve them one by one. A feature with no originating need is flagged as unjustified scope." },
      { title: "What you walk away with", where: "PDF dossier button", shot: "arch-rapport.png", body: "A printable architecture dossier, a wave-based backlog, and a record of who decided what. That is the document you defend in committee." },
    ],
  },
  decider: {
    app: "decider",
    title: "Decide",
    pitch: "Settle a multi-criteria decision without inventing numbers — and be able to explain it.",
    chapters: [
      { title: "Welcome", where: "You are in Decide", shot: "dec-home.png", body: "Welcome to AURA. You are in Decide, the application that structures and settles a trade-off. Every step is illustrated on a real screen and on a case actually loaded." },
      { title: "What it is for", where: "Step rail", shot: "dec-home.png", body: "Decide structures an arbitration: understand the decision, state the options, express the criteria, arbitrate, follow up. The reasoning is qualitative and ordinal — no weighted average, no invented score." },
      { title: "Understand", where: "Understand step", shot: "dec-comprendre.png", body: "The companion asks each question out loud, listens to your answer, restates it and records it once you confirm. You can also drop a document: it feeds the framing." },
      { title: "Compose and impact", where: "Compose and Impact steps", shot: "dec-composer.png", body: "You state the options actually on the table, then their effect on each criterion in levels: none, low, medium, high. A knock-out criterion stays a knock-out: nothing compensates it." },
      { title: "Arbitrate", where: "Arbitrate step", shot: "dec-arbitrer.png", body: "The BORA engine returns a verdict, the decision card shows upside and downside potential, the dominance matrix shows who beats whom, and robustness shows how far the importance order can move before the answer changes." },
      { title: "Two reading registers", where: "Decision-maker / Analyst tabs", shot: "dec-analyste.png", body: "The decision-maker register gives the verdict, the reservations and the signable sheet. The analyst register opens the mechanics: dominance, robustness, stakeholder disagreements, hypotheses tested by the agent." },
      { title: "What you walk away with", where: "Decision sheet", shot: "dec-fiche.png", body: "A one-page signable sheet: the question, the option retained, what was ruled out and why. That is the decision that still holds twelve months later." },
    ],
  },
  copilote: {
    app: "copilote",
    title: "Decision Copilot",
    pitch: "Watch performance, get alerted, and open an arbitration on the right question.",
    chapters: [
      { title: "Welcome", where: "You are in the Decision Copilot", shot: "cop-home.png", body: "Welcome to AURA. You are in the Decision Copilot, the application that watches your performance and prepares the decision. The screens shown here are the application's own, on the demo case." },
      { title: "What it is for", where: "Left column", shot: "cop-home.png", body: "The Copilot watches your indicators, flags what drifts and prepares the decision. It never decides for you: the arbitration is computed outside the language model, by the BORA engine." },
      { title: "The Studio", where: "Studio menu", shot: "cop-studio.png", body: "The Studio connects the Copilot to your reality: business vocabulary, source applications and their access, then business-object mapping. Each step is guided by the companion, by voice, with document upload." },
      { title: "The dialogue", where: "Decision Copilot screen", shot: "cop-chat.png", body: "You ask in plain language, in French or English. The answer cites its sources and proposes the next move: dig deeper, raise an alert, or open an arbitration." },
      { title: "Alerts", where: "Alerts menu", shot: "cop-alertes.png", body: "A crossed threshold raises an alert, and the alert proposes an already-formulated decision question. That is the step from monitoring to arbitration." },
      { title: "Audit and traceability", where: "Audit & traceability menu", shot: "cop-audit.png", body: "Every decision keeps its justification, its sources and its author. That is what makes the use of AI defensible in front of an auditor." },
    ],
  },
};

export function getOnboardingScript(app: OnboardingApp, lang: "fr" | "en"): OnboardingScript {
  return (lang === "en" ? EN : FR)[app];
}
