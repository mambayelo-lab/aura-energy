import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";

// Flat dictionary keyed by dotted path. Add new strings here as the UI is translated.
const DICT: Record<Lang, Record<string, string>> = {
  fr: {
    // common
    "common.loading": "Chargement…",
    "common.signout": "Se déconnecter",
    "common.member": "membre",
    "common.cancel": "Annuler",
    "common.save": "Enregistrer",
    "common.close": "Fermer",
    "common.open": "Ouvrir",
    "common.create": "Créer",
    "common.send": "Envoyer",
    "common.search": "Rechercher",
    "common.viewAll": "Voir tout",
    "common.confidential": "Confidentiel",
    "common.restricted": "Accès restreint",
    "common.noData": "Aucune donnée pour le moment.",
    "common.language": "Langue",
    "common.delete": "Supprimer",
    "common.confirmDelete": "Supprimer cet élément ?",
    "common.deleted": "Supprimé",

    // barre de compte (shell cockpit)
    "account.signedout": "Non connecté",
    "account.admin": "Administration",
    "account.accounts": "Comptes",
    "account.subscription": "Abonnement",
    "account.signout": "Déconnexion",
    "account.signin": "Connexion",

    // shell
    "shell.admin.exit": "Quitter l'administration",
    "shell.admin.entry": "Administration",
    "shell.switcher.all": "Tous les espaces (admin)",
    "shell.switcher.yours": "Vos espaces",

    // workspaces
    "ws.ops.label": "Terrain", "ws.ops.tagline": "Comprendre ce qui se passe", "ws.ops.item": "Décryptage terrain",
    "ws.manager.label": "Manager", "ws.manager.tagline": "Décider vite, piloter juste", "ws.manager.item": "Pilotage tactique",
    "ws.direction.label": "Direction métier", "ws.direction.tagline": "Pilotage par exception", "ws.direction.item": "Cockpit direction",
    "ws.decideur.label": "Décideur", "ws.decideur.tagline": "Decision Capabilities & projets",
    "ws.decideur.cockpit": "Cockpit", "ws.decideur.library": "Bibliothèque", "ws.decideur.projects": "Projets",
    "ws.comex.label": "COMEX", "ws.comex.tagline": "Décisions stratégiques", "ws.comex.item": "Cockpit exécutif",
    "ws.rh.label": "RH", "ws.rh.tagline": "Talents & décisions sensibles", "ws.rh.item": "Talents & décisions",

    // admin nav
    "admin.cockpit": "Cockpit", "admin.missions": "Missions",
    "admin.interviews": "Interviews",
    "admin.interviews.done": "Réalisées",
    "admin.interviews.todo": "À planifier",
    "admin.interviews.deductions": "Décisions déduites",
    "admin.interviews.templates": "Templates",
    "admin.readiness": "IA Readiness", "admin.architecture": "Architecture & SI",
    "admin.lineage": "Décisions & Signals", "admin.signals": "Signals", "admin.decision_support": "Aide à la décision",
    "admin.semantic": "Ontologie", "admin.packs": "Decision Capabilities", "admin.hub": "Hub Argus",

    // ops / manager / direction cockpits
    "ops.eyebrow": "Cockpit opérationnel",
    "ops.h1": "Décryptage terrain.",
    "ops.sub": "Comprendre ce qui se passe, ce qui change, ce qu'il faut surveiller — au quotidien.",
    "ops.console.title": "Aura — Décryptage",
    "ops.console.sub": "Pédagogique, concret, factuel. Vos questions alimentent l'ontologie vivante.",
    "manager.eyebrow": "Cockpit manager",
    "manager.h1": "Décider vite, piloter juste.",
    "manager.sub": "Priorisation, décisions tactiques, OKRs, points d'attention.",
    "manager.console.title": "Aura — Pilotage tactique",
    "manager.console.sub": "Aide à la décision quotidienne et hebdomadaire.",
    "direction.eyebrow": "Cockpit direction métier",
    "direction.h1": "Pilotage par exception.",
    "direction.sub": "CFO, COO, CIO, RH, Supply : leviers, arbitrages, vision consolidée.",
    "direction.console.title": "Aura — Direction métier",
    "direction.console.sub": "Arbitrages, leviers, exceptions à traiter.",

    // RH
    "rh.eyebrow": "Espace RH · Confidentiel",
    "rh.h1": "Talents & décisions RH",
    "rh.sub": "Succession, mobilité, rémunération. Accès limité RH + PDG.",
    "rh.profiles": "Profils talents",
    "rh.decisions": "Décisions RH récentes",
    "rh.potential": "Potentiel", "rh.perf": "Perf", "rh.risk": "Risque",

    // COMEX
    "comex.eyebrow": "Cockpit COMEX",
    "comex.h1": "Pilotage exécutif",
    "comex.sub": "Modules stratégiques. Données confidentielles, accès COMEX uniquement.",
    "comex.tab.warroom": "War Room", "comex.tab.ma": "M&A", "comex.tab.okr": "OKR",
    "comex.tab.board": "Board Pack", "comex.tab.crisis": "Crise", "comex.tab.esg": "ESG",
    "comex.tab.reg": "Réglementaire", "comex.tab.redteam": "Red Team", "comex.tab.replay": "Replay",
    "comex.tab.stake": "Parties prenantes",
    "comex.warroom.new": "Nouvelle session War Room",
    "comex.warroom.titlePh": "Titre (ex : Arbitrage acquisition)",
    "comex.warroom.agendaPh": "Agenda (optionnel)",
    "comex.warroom.created": "Session créée",
    "comex.sections.sessions": "Sessions",
    "comex.sections.ma": "Cibles M&A & synergies",
    "comex.sections.okr": "OKRs en cours",
    "comex.sections.board": "Board packs",
    "comex.sections.crisis": "Événements",
    "comex.sections.esg": "Indicateurs ESG",
    "comex.sections.reg": "Veille réglementaire",
    "comex.sections.redteam": "Pré-mortems",
    "comex.sections.replay": "Décisions revues",
    "comex.sections.stake": "Cartographie",
    "comex.valuation": "Valorisation", "comex.stage": "Stage",
    "comex.synergies": "synergie(s) identifiée(s)",
    "comex.value": "Valeur",
    "comex.biases": "biais détecté(s)",
    "comex.decisionN": "Décision", "comex.variance": "Écart prédit/réel",
    "comex.influence": "Influence", "comex.posture": "Posture",
    "comex.effective": "entrée en vigueur",

    // admin home
    "adminHome.eyebrow": "Cockpit Admin",
    "adminHome.h1": "Missions IA Readiness",
    "adminHome.sub": "Conduisez les diagnostics et produisez les rapports de cadrage.",
    "adminHome.new": "Nouvelle mission",
    "adminHome.created": "Mission créée",
    "adminHome.kpi.total": "Missions",
    "adminHome.kpi.active": "Actives",
    "adminHome.kpi.draft": "Brouillons",
    "adminHome.kpi.closed": "Clôturées",
    "adminHome.all": "Toutes les missions",
    "adminHome.empty": "Aucune mission. Créez la première.",
    "adminHome.form.client": "Client",
    "adminHome.form.sector": "Secteur",
    "adminHome.form.context": "Contexte",

    // décideur cockpit
    "dec.eyebrow": "Cockpit Décideur",
    "dec.greeting.morning": "Bonjour", "dec.greeting.afternoon": "Bon après-midi", "dec.greeting.evening": "Bonsoir",
    "dec.h1Tail": "Vos décisions, sans bruit.",
    "dec.sub": "Activez des Decision Capabilities pour ouvrir un copilote dédié par sujet. Chaque conversation devient une décision tracée, reliée à ses signaux et ses sources.",
    "dec.cta.catalog": "Catalogue de packs",
    "dec.cta.projects": "Mes projets",
    "dec.kpi.activePacks": "Packs actifs",
    "dec.kpi.openDecisions": "Décisions en cours",
    "dec.kpi.thisWeek": "Cette semaine",
    "dec.kpi.momentum": "Momentum",
    "dec.activePacks.title": "Vos packs actifs",
    "dec.activePacks.sub": "Démarrez une nouvelle décision en un clic.",
    "dec.activePacks.new": "Nouvelle décision",
    "dec.recent.title": "Décisions récentes",
    "dec.recent.sub": "Reprenez où vous vous étiez arrêté.",
    "dec.recent.empty": "Aucune décision encore.",
    "dec.recent.emptySub": "Activez un pack et lancez une conversation.",
    "dec.confirmDelete": "Supprimer cette décision ?",

    // library
    "lib.h1": "Decision Capabilities",
    "lib.searchPh": "Rechercher une décision…",
    "lib.overlays": "Overlays",

    // packs
    "packs.eyebrow": "Catalogue",
    "packs.h1": "Decision Capabilities",
    "packs.sub": "Activez ce dont vous avez besoin. Un pack actif ouvre un copilote dédié.",
    "packs.activated": "Pack activé", "packs.deactivated": "Pack désactivé",
    "packs.openCopilot": "Ouvrir le copilote",

    // projects
    "proj.eyebrow": "Portfolio Décideur",
    "proj.h1": "Projets stratégiques",
    "proj.sub": "Visualisez l'impact des initiatives sur vos décisions. Votez et commentez pour prioriser.",
    "proj.lift": "Lift",
    "proj.impacted": "Décisions impactées",
    "proj.capabilities": "Capabilities",
    "proj.applications": "Applications",
    "proj.support": "Votre soutien",
    "proj.for": "Pour", "proj.against": "Contre", "proj.priority": "Priorité",
    "proj.discussion": "Discussion",
    "proj.noComments": "Aucun commentaire.",
    "proj.opinionPh": "Votre avis…",
    "proj.voteSaved": "Vote enregistré",

    // admin pages — chrome (eyebrow / h1 / sub)
    "adminPage.missions.eyebrow": "Portefeuille de missions",
    "adminPage.missions.h1": "Missions de cadrage IA",
    "adminPage.missions.sub": "Pilotez vos missions clients, leurs entretiens et le rapport associé.",
    "adminPage.architecture.eyebrow": "Cartographie d'architecture",
    "adminPage.architecture.h1": "Architecture & Système d'Information",
    "adminPage.architecture.sub": "Applications, capacités et flux issus de la maison Lumen et des extractions Argus.",
    "adminPage.readiness.eyebrow": "Diagnostic IA Readiness",
    "adminPage.readiness.h1": "IA Readiness",
    "adminPage.readiness.sub": "Maturité par dimension, trajectoire et synthèse exécutive prête à exporter.",
    "adminPage.hub.eyebrow": "Hub d'ingestion Argus",
    "adminPage.hub.h1": "Hub Argus — connecteurs & flux",
    "adminPage.hub.sub": "Connecteurs, schémas inférés et flux normalisés vers l'ontologie.",
    "adminPage.signals.eyebrow": "Moteur de signaux",
    "adminPage.signals.h1": "Signals & règles",
    "adminPage.signals.sub": "Règles, évaluations et déclenchements supervisés en continu.",
    "adminPage.semantic.eyebrow": "Ontologie métier",
    "adminPage.semantic.h1": "Objets, attributs & contrats",
    "adminPage.semantic.sub": "Modélisez les objets métier et leurs sources de vérité.",
    "adminPage.templates.eyebrow": "Templates d'entretien",
    "adminPage.templates.h1": "Templates & banque de questions",
    "adminPage.templates.sub": "Modèles de CR par capacité, réutilisables par mission.",
    "adminPage.projects.eyebrow": "Projets & initiatives",
    "adminPage.projects.h1": "Pipeline projets",
    "adminPage.projects.sub": "Initiatives, impacts décisions et arbitrages COMEX.",
    "adminPage.lineage.eyebrow": "Decision Lineage",
    "adminPage.lineage.h1": "Traçabilité des décisions",
    "adminPage.lineage.sub": "Décision → signal → objets métier → faits → sources.",
    "adminPage.packs.eyebrow": "Décisions packs",
    "adminPage.packs.h1": "Catalogue & édition des Decision Capabilities",
    "adminPage.packs.sub": "Catalogue universel et sectoriel fusionné, éditable et relié aux entretiens.",
  },
  en: {
    // common
    "common.loading": "Loading…",
    "common.signout": "Sign out",
    "common.member": "member",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.close": "Close",
    "common.open": "Open",
    "common.create": "Create",
    "common.send": "Send",
    "common.search": "Search",
    "common.viewAll": "View all",
    "common.confidential": "Confidential",
    "common.restricted": "Restricted access",
    "common.noData": "No data yet.",
    "common.language": "Language",
    "common.delete": "Delete",
    "common.confirmDelete": "Delete this item?",
    "common.deleted": "Deleted",

    // account bar (cockpit shell)
    "account.signedout": "Not signed in",
    "account.admin": "Administration",
    "account.accounts": "Accounts",
    "account.subscription": "Subscription",
    "account.signout": "Sign out",
    "account.signin": "Sign in",

    // shell
    "shell.admin.exit": "Exit administration",
    "shell.admin.entry": "Administration",
    "shell.switcher.all": "All workspaces (admin)",
    "shell.switcher.yours": "Your workspaces",

    // workspaces
    "ws.ops.label": "Field", "ws.ops.tagline": "Understand what is happening", "ws.ops.item": "Field decoding",
    "ws.manager.label": "Manager", "ws.manager.tagline": "Decide fast, steer right", "ws.manager.item": "Tactical steering",
    "ws.direction.label": "Business leadership", "ws.direction.tagline": "Exception-based steering", "ws.direction.item": "Leadership cockpit",
    "ws.decideur.label": "Decision-maker", "ws.decideur.tagline": "Decision Capabilities & projects",
    "ws.decideur.cockpit": "Cockpit", "ws.decideur.library": "Library", "ws.decideur.projects": "Projects",
    "ws.comex.label": "COMEX", "ws.comex.tagline": "Strategic decisions", "ws.comex.item": "Executive cockpit",
    "ws.rh.label": "HR", "ws.rh.tagline": "Talent & sensitive decisions", "ws.rh.item": "Talent & decisions",

    // admin nav
    "admin.cockpit": "Cockpit", "admin.missions": "Missions",
    "admin.interviews": "Interviews",
    "admin.interviews.done": "Completed",
    "admin.interviews.todo": "To schedule",
    "admin.interviews.deductions": "Inferred decisions",
    "admin.interviews.templates": "Templates",
    "admin.readiness": "AI Readiness", "admin.architecture": "Architecture & IS",
    "admin.lineage": "Decisions & Signals", "admin.signals": "Signals", "admin.decision_support": "Decision Support",
    "admin.semantic": "Ontology", "admin.packs": "Decision Capabilities", "admin.hub": "Argus Hub",

    // ops / manager / direction cockpits
    "ops.eyebrow": "Operational cockpit",
    "ops.h1": "Field decoding.",
    "ops.sub": "Understand what is happening, what is changing, what to watch — day in, day out.",
    "ops.console.title": "Aura — Decoding",
    "ops.console.sub": "Practical, factual, educational. Your questions feed the living ontology.",
    "manager.eyebrow": "Manager cockpit",
    "manager.h1": "Decide fast, steer right.",
    "manager.sub": "Prioritisation, tactical decisions, OKRs, watch-outs.",
    "manager.console.title": "Aura — Tactical steering",
    "manager.console.sub": "Daily and weekly decision support.",
    "direction.eyebrow": "Business leadership cockpit",
    "direction.h1": "Exception-based steering.",
    "direction.sub": "CFO, COO, CIO, HR, Supply: levers, trade-offs, consolidated view.",
    "direction.console.title": "Aura — Business leadership",
    "direction.console.sub": "Trade-offs, levers, exceptions to handle.",

    // HR
    "rh.eyebrow": "HR space · Confidential",
    "rh.h1": "Talent & HR decisions",
    "rh.sub": "Succession, mobility, compensation. HR + CEO access only.",
    "rh.profiles": "Talent profiles",
    "rh.decisions": "Recent HR decisions",
    "rh.potential": "Potential", "rh.perf": "Perf", "rh.risk": "Risk",

    // COMEX
    "comex.eyebrow": "COMEX cockpit",
    "comex.h1": "Executive steering",
    "comex.sub": "Strategic modules. Confidential data, COMEX access only.",
    "comex.tab.warroom": "War Room", "comex.tab.ma": "M&A", "comex.tab.okr": "OKR",
    "comex.tab.board": "Board Pack", "comex.tab.crisis": "Crisis", "comex.tab.esg": "ESG",
    "comex.tab.reg": "Regulatory", "comex.tab.redteam": "Red Team", "comex.tab.replay": "Replay",
    "comex.tab.stake": "Stakeholders",
    "comex.warroom.new": "New War Room session",
    "comex.warroom.titlePh": "Title (e.g. Acquisition trade-off)",
    "comex.warroom.agendaPh": "Agenda (optional)",
    "comex.warroom.created": "Session created",
    "comex.sections.sessions": "Sessions",
    "comex.sections.ma": "M&A targets & synergies",
    "comex.sections.okr": "Active OKRs",
    "comex.sections.board": "Board packs",
    "comex.sections.crisis": "Events",
    "comex.sections.esg": "ESG metrics",
    "comex.sections.reg": "Regulatory watch",
    "comex.sections.redteam": "Pre-mortems",
    "comex.sections.replay": "Reviewed decisions",
    "comex.sections.stake": "Map",
    "comex.valuation": "Valuation", "comex.stage": "Stage",
    "comex.synergies": "identified synergy/ies",
    "comex.value": "Value",
    "comex.biases": "bias(es) detected",
    "comex.decisionN": "Decision", "comex.variance": "Predicted/actual gap",
    "comex.influence": "Influence", "comex.posture": "Posture",
    "comex.effective": "effective",

    // admin home
    "adminHome.eyebrow": "Admin cockpit",
    "adminHome.h1": "AI Readiness missions",
    "adminHome.sub": "Run diagnostics and produce framing reports.",
    "adminHome.new": "New mission",
    "adminHome.created": "Mission created",
    "adminHome.kpi.total": "Missions",
    "adminHome.kpi.active": "Active",
    "adminHome.kpi.draft": "Drafts",
    "adminHome.kpi.closed": "Closed",
    "adminHome.all": "All missions",
    "adminHome.empty": "No mission yet. Create the first one.",
    "adminHome.form.client": "Client",
    "adminHome.form.sector": "Sector",
    "adminHome.form.context": "Context",

    // decision-maker cockpit
    "dec.eyebrow": "Decision-maker cockpit",
    "dec.greeting.morning": "Good morning", "dec.greeting.afternoon": "Good afternoon", "dec.greeting.evening": "Good evening",
    "dec.h1Tail": "Your decisions, without the noise.",
    "dec.sub": "Activate Decision Capabilities to open a dedicated copilot per topic. Each conversation becomes a tracked decision, linked to its signals and sources.",
    "dec.cta.catalog": "Pack catalogue",
    "dec.cta.projects": "My projects",
    "dec.kpi.activePacks": "Active packs",
    "dec.kpi.openDecisions": "Open decisions",
    "dec.kpi.thisWeek": "This week",
    "dec.kpi.momentum": "Momentum",
    "dec.activePacks.title": "Your active packs",
    "dec.activePacks.sub": "Start a new decision in one click.",
    "dec.activePacks.new": "New decision",
    "dec.recent.title": "Recent decisions",
    "dec.recent.sub": "Pick up where you left off.",
    "dec.recent.empty": "No decisions yet.",
    "dec.recent.emptySub": "Activate a pack and start a conversation.",
    "dec.confirmDelete": "Delete this decision?",

    // library
    "lib.h1": "Decision Capabilities",
    "lib.searchPh": "Search a decision…",
    "lib.overlays": "Overlays",

    // packs
    "packs.eyebrow": "Catalogue",
    "packs.h1": "Decision Capabilities",
    "packs.sub": "Activate what you need. An active pack opens a dedicated copilot.",
    "packs.activated": "Pack activated", "packs.deactivated": "Pack deactivated",
    "packs.openCopilot": "Open the copilot",

    // projects
    "proj.eyebrow": "Decision-maker portfolio",
    "proj.h1": "Strategic projects",
    "proj.sub": "See the impact of initiatives on your decisions. Vote and comment to prioritise.",
    "proj.lift": "Lift",
    "proj.impacted": "Impacted decisions",
    "proj.capabilities": "Capabilities",
    "proj.applications": "Applications",
    "proj.support": "Your support",
    "proj.for": "For", "proj.against": "Against", "proj.priority": "Priority",
    "proj.discussion": "Discussion",
    "proj.noComments": "No comments yet.",
    "proj.opinionPh": "Your opinion…",
    "proj.voteSaved": "Vote recorded",

    // admin pages — chrome (eyebrow / h1 / sub)
    "adminPage.missions.eyebrow": "Mission portfolio",
    "adminPage.missions.h1": "AI scoping missions",
    "adminPage.missions.sub": "Steer your client missions, their interviews and the related report.",
    "adminPage.architecture.eyebrow": "Architecture map",
    "adminPage.architecture.h1": "Architecture & Information System",
    "adminPage.architecture.sub": "Applications, capabilities and flows from the Lumen house and Argus extractions.",
    "adminPage.readiness.eyebrow": "AI Readiness diagnostic",
    "adminPage.readiness.h1": "AI Readiness",
    "adminPage.readiness.sub": "Maturity per dimension, roadmap and executive synthesis ready to export.",
    "adminPage.hub.eyebrow": "Argus ingestion hub",
    "adminPage.hub.h1": "Argus Hub — connectors & flows",
    "adminPage.hub.sub": "Connectors, inferred schemas and normalised flows feeding the ontology.",
    "adminPage.signals.eyebrow": "Signal engine",
    "adminPage.signals.h1": "Signals & rules",
    "adminPage.signals.sub": "Rules, evaluations and triggers continuously supervised.",
    "adminPage.semantic.eyebrow": "Business ontology",
    "adminPage.semantic.h1": "Objects, attributes & contracts",
    "adminPage.semantic.sub": "Model business objects and their sources of truth.",
    "adminPage.templates.eyebrow": "Interview templates",
    "adminPage.templates.h1": "Templates & question bank",
    "adminPage.templates.sub": "Reusable CR templates per capability across missions.",
    "adminPage.projects.eyebrow": "Projects & initiatives",
    "adminPage.projects.h1": "Project pipeline",
    "adminPage.projects.sub": "Initiatives, decision impacts and COMEX arbitration.",
    "adminPage.lineage.eyebrow": "Decision Lineage",
    "adminPage.lineage.h1": "Decision traceability",
    "adminPage.lineage.sub": "Decision → signal → business objects → facts → sources.",
    "adminPage.packs.eyebrow": "Decision Capabilities",
    "adminPage.packs.h1": "Decision Capabilities catalog & editor",
    "adminPage.packs.sub": "Universal and sector catalog merged, editable and linked to interviews.",
  },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, fallback?: string) => string };
const I18nCtx = createContext<Ctx | null>(null);
const LS_KEY = "aura.lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");
  useEffect(() => {
    const stored = (typeof window !== "undefined" && (localStorage.getItem(LS_KEY) as Lang | null)) || null;
    // Français par défaut ; l'anglais est un choix explicite, mémorisé.
    if (stored === "fr" || stored === "en") setLangState(stored);
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(LS_KEY, l); } catch {}
    if (typeof document !== "undefined") document.documentElement.lang = l;
    // La langue de l'interface pilote aussi la langue d'échange vocal / LLM
    // (compagnon, Studio, copilote). Import dynamique : le module vocal ne doit
    // pas être tiré dans le graphe de toutes les pages.
    import("./v4/speech-client").then(m => m.saveLang(l)).catch(() => {});
  }, []);

  // Anglais : traduction continue de tout le texte affiché (i18n-dom). Retour
  // au français : rechargement, pour retrouver les textes d'origine.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    if (lang !== "en") return;
    let stop: (() => void) | undefined;
    import("./i18n-dom").then(m => { stop = m.startDomTranslation(); }).catch(() => {});
    return () => { stop?.(); };
  }, [lang]);
  const prevLang = useRef(lang);
  useEffect(() => {
    if (prevLang.current === "en" && lang === "fr" && typeof window !== "undefined") window.location.reload();
    prevLang.current = lang;
  }, [lang]);
  const t = useCallback((key: string, fallback?: string) => DICT[lang][key] ?? fallback ?? DICT.fr[key] ?? key, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const v = useContext(I18nCtx);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}
export function useT() { return useI18n().t; }

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`inline-flex items-center rounded-md border border-sidebar-border overflow-hidden text-[13px] ${className}`}>
      <button
        type="button"
        onClick={() => setLang("fr")}
        className={`px-2 py-1 ${lang === "fr" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-sidebar-accent"}`}
        aria-pressed={lang === "fr"}
      >FR</button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2 py-1 border-l border-sidebar-border ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-sidebar-accent"}`}
        aria-pressed={lang === "en"}
      >EN</button>
    </div>
  );
}
