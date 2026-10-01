// atelier-llm.ts — LLM server functions for the Atelier
import { createServerFn } from "@tanstack/react-start";
import type { AtelierCriterion, AtelierLevierDef, ElicitationData, ImportanceBadge, QualitativeImpact } from "./atelier-store";
import { stripJsonNoise } from "./json-noise";


// ─── Supply Chain Resilience Agent — cadrage expert additif (Comprendre) ─────
// Utilisé UNIQUEMENT quand `domainExpertiseHint` est fourni par l'appelant —
// c'est-à-dire UNIQUEMENT depuis le shell "Supply Chain Resilience Agent"
// (/cockpit/resilience, ControlTowerShell.tsx), qui seul passe cette valeur
// à AtelierPage via `embeddedDomainExpertise`, sur le même patron additif que
// `embeddedSuggestions`. Le Décider "nu" (/cockpit/atelier) n'appelle jamais
// ces fonctions avec ce paramètre : il reste donc `undefined`, et chaque
// fonction ci-dessous n'insère ce bloc que dans une branche
// `if (domainExpertiseHint)` — jamais dans le gabarit de base. Omis, le
// prompt produit est strictement identique à avant l'ajout de ce paramètre.
// Bug corrigé (retour utilisateur) : ce bloc était appendu tel quel à TOUTES
// les fonctions LLM du fichier, y compris celles qui exigent une réponse
// courte/JSON strict avec un budget de tokens serré (classifyDecision 400,
// inferElicitationFromDescription 500) — sa numérotation ①-⑦ entrait en
// collision avec les "RÈGLES QUALITÉ ABSOLUES" ①-⑨ du prompt de base de
// generateFullModel juste au-dessus (deux listes ①②③... consécutives), et sa
// longueur (~600 mots) pouvait à elle seule dépasser le budget de tokens
// restant sur les tâches à réponse courte. Résultat observé : Comprendre (côté
// Supply Chain Resilience Agent) produisait très peu ou pas d'indicateurs/
// leviers/options, contrairement au Décider "nu" qui n'a jamais ce bloc.
// Fix : lettres A-G (jamais de collision avec une numérotation ①②③ existante),
// et surtout — seule generateFullModel (le générateur d'indicateurs/leviers,
// qui a la marge de tokens et la structure adaptées) reçoit encore ce bloc
// complet ; les tâches à réponse courte (classifyDecision,
// inferElicitationFromDescription, generateDiscriminatingQuestions) reçoivent
// désormais scResilienceCompactHint, une version courte sans numérotation.
function scResilienceExpertBlock(hint: string): string {
  return `

━━━ CADRAGE EXPERT SUPPLY CHAIN RESILIENCE (fourni par l'agent hôte, EN COMPLÉMENT des règles ci-dessus — ne réduit jamais les seuils structurels demandés : toujours 4 à 6 MOE, 8 à 10 leviers, etc.) ━━━
${hint}

Applique ce cadrage à ta réponse :
A. DÉTECTION DE LA VERTICALE : identifie la sous-filière Supply Chain précise que la description implique (retail, pharma/santé, automobile, agroalimentaire, électronique/semi-conducteurs, chimie, aéronautique, luxe/mode, etc.) et NOMME-la explicitement dans ton raisonnement/tes libellés quand c'est pertinent — jamais un traitement générique "supply chain" indifférencié à la filière.
B. LEVIERS RÉELS, PAS DES MOTS-VALISE : ancre chaque objectif (MOE/MOP) ou critère (TPM) sur un levier de résilience Supply Chain réel et reconnaissable — double sourcing, stock de sécurité, taux de service OTIF, lead time fournisseur, capacité et flexibilité industrielle, conception réseau (centraliser vs régionaliser), allocation sous pénurie, exposition géopolitique/pays, reroutage transport, substitution produit/nomenclature, visibilité et fiabilité des données supply — jamais un buzzword générique ("optimiser la chaîne", "améliorer la résilience") sans levier concret derrière. Un concept SCM établi et nommé (OTIF, stock de sécurité, lead time…) est toujours acceptable ; seul un néologisme vague est à éviter — ceci ne doit JAMAIS te conduire à produire moins de critères/leviers que demandé : en cas de doute sur un libellé précis, garde une formulation SCM générique plutôt que de omettre l'item.
C. CE QUE BORA FAIT MIEUX QU'UN ALGORITHME GÉNÉRIQUE : évalue chaque levier en BIPOLAIRE (gain ET risque suivis séparément, jamais nettés) et agrège de façon NON-COMPENSATOIRE (un échec sur un critère "Essentiel" n'est jamais racheté par de bons scores ailleurs), avec veto explicite et raisonnement À REBOURS (depuis une cible, le changement minimal qui l'atteint). Concrètement : fais ressortir au moins une VRAIE TENSION gain/risque sur un levier (ex. double sourcing = résilience fournisseur mais coût unitaire et complexité qualité en hausse) ; identifie au moins une LIGNE ROUGE non-compensable candidate à "Essentiel" (ex. rupture de service client stratégique, rupture réglementaire ou de sécurité produit) ; quand une cible est identifiable (niveau de service, délai, coût plafond), formule au moins un critère en RECHERCHE DE CIBLE plutôt qu'en pure minimisation de coût.
D. Ne propose jamais un cadrage "minimiser le coût total" isolé comme fil directeur unique — solliciter BORA pour ce que lui seul résout bien (arbitrages non-compensables, tensions bipolaires, recherche de cible).
E. CLASSIFICATION STRATÉGIQUE/TACTIQUE/OPÉRATIONNELLE : classe chaque indicateur selon stratégique ≈ MOE (transverse, financier/client) / tactique ≈ MOP (moyen terme, inter-équipes) / opérationnel ≈ TPM (quotidien, mono-fonction), justifiable et non arbitraire.
F. CONCRET SANS ÊTRE VAGUE, PAS UNE INTERDICTION DE PRODUIRE : chaque indicateur/levier/option doit être plausible en Supply Chain (élément de la description, référentiel SCRA déjà cité dans ce cadrage, ou vocabulaire SCM établi) — reformule un item vague plutôt que de l'omettre ; ne JAMAIS descendre sous les seuils structurels (4-6 MOE, 8-10 leviers) au nom de la précision. Pour un indicateur de stock, utilise Stock disponible = Stock physique − Stock réservé − Stock bloqué plutôt qu'un vague "niveau de stock".
G. PATRON CAUSAL ÉVÉNEMENT/ANOMALIE/DÉCISION : quand pertinent, cadre au moins un TPM autour d'une transition d'état traçable (commande créée→validée→allouée→préparée→expédiée→reçue) et un critère autour d'une cause de défaut d'exécution (amont chaîne, tiers, cause connue et nommée, ou cause inconnue jamais masquée) — l'OTIF (expédition ou livraison) est en défaut dès qu'il n'est pas à 100 %.`;
}

// Version courte (sans numérotation, ~5 lignes) du cadrage ci-dessus, pour
// les tâches à réponse courte et budget de tokens serré (classifyDecision,
// inferElicitationFromDescription, generateDiscriminatingQuestions) — le
// bloc complet ci-dessus y était disproportionné (jusqu'à dépasser le budget
// maxTokens à lui seul) et provoquait des réponses vides ou tronquées.
function scResilienceCompactHint(hint: string): string {
  return `

Cadrage Supply Chain Resilience (contexte fourni par l'agent hôte) : ${hint}
Nomme la sous-filière Supply Chain précise si elle ressort de la description (retail, pharma, automobile, électronique, luxe…) et ancre ta réponse sur un levier de résilience réel et reconnaissable (double sourcing, stock de sécurité, OTIF, lead time fournisseur, capacité industrielle, allocation sous pénurie, exposition géopolitique, reroutage transport…) plutôt qu'un terme générique ("optimiser la chaîne") — sans jamais réduire le nombre d'éléments demandé par ailleurs.`;
}

function extractJson(raw: string): unknown {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in LLM response");
  const cleaned = stripJsonNoise(m[0]);
  try {
    return JSON.parse(cleaned);
  } catch {
    // Réponse coupée par maxTokens (modèle riche en leviers/critères demandé
    // par l'utilisateur) : on tente de récupérer tout ce qui a été généré
    // avant la coupure plutôt que de tout jeter au profit d'un gabarit
    // générique sans rapport avec la demande.
    return JSON.parse(repairTruncatedJson(cleaned));
  }
}


// Referme au mieux un JSON tronqué en fin de flux : retire le dernier fragment
// incomplet (chaîne ouverte ou élément d'objet/tableau non fini) puis empile
// les fermetures manquantes dans l'ordre inverse d'ouverture.
function repairTruncatedJson(raw: string): string {
  let s = raw;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastSafeIdx = -1; // dernier indice où l'on est hors chaîne, après une virgule/accolade/crochet
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) { escaped = false; }
      else if (c === "\\") { escaped = true; }
      else if (c === '"') { inString = false; }
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === "{" || c === "[") { stack.push(c === "{" ? "}" : "]"); }
    else if (c === "}" || c === "]") { stack.pop(); }
    if (c === "," || c === "{" || c === "[") lastSafeIdx = i;
  }
  if (inString) {
    // Chaîne jamais refermée : on coupe avant elle et on repart du dernier point sûr.
    s = lastSafeIdx >= 0 ? s.slice(0, lastSafeIdx + 1) : s;
    // Recalcule la pile après troncature.
    return repairTruncatedJson(s + "}".repeat(0)); // relance propre sur la portion sûre
  }
  // Retire une éventuelle virgule terminale avant de refermer.
  s = s.replace(/,\s*$/, "");
  return s + stack.reverse().join("");
}


// ─── 0. Extract text from uploaded doc ───────────────────────────────────────

export const extractDocText = createServerFn({ method: "POST" })
  .validator((d: { base64: string; filename: string }) => d)
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { mistralChat } = await import("../mistral.server");
    // Decode base64 to get first 3000 chars of text
    const buf = Buffer.from(data.base64, "base64");
    const raw = buf.toString("utf-8").replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, " ").slice(0, 6000);
    // Ask LLM to extract key facts from the raw content
    const r = await mistralChat({
      messages: [
        { role: "system", content: `Tu es un assistant d'extraction. Extrais les informations clés de ce document (stratégie, chiffres, marchés, objectifs, contraintes). Réponds en 10-15 bullet points concis en français. Uniquement les faits pertinents pour une analyse décisionnelle.` },
        { role: "user", content: `Fichier : ${data.filename}\n\nContenu :\n${raw}` },
      ],
      maxTokens: 600,
      temperature: 0.1,
    });
    return { text: r.ok ? r.content : raw.slice(0, 2000) };
  });

// ─── 0a. Extract text/content from an image or a scanned document page ──────
// Vision : couvre les photos de tableau blanc, captures d'écran, slides,
// et pages de PDF scanné (image pure, sans couche texte) rendues en image
// côté client puis envoyées ici page par page.
export const extractTextFromImage = createServerFn({ method: "POST" })
  .validator((d: { dataUrl: string; label?: string }) => d)
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { mistralChat } = await import("../mistral.server");
    // Vision côté serveur : Pixtral d'abord ; si le fournisseur le refuse, modèle multimodal courant.
    // (`pixtral-12b-2409` est retiré et retombait silencieusement sur un modèle texte.)
    const call = (model: string) => mistralChat({
      model,
      messages: [
        { role: "system", content: `Tu es un analyste senior en aide à la décision, avec un œil systémique et la rigueur d'un consultant en stratégie de premier plan (sans te nommer comme tel). On te soumet l'image d'un document (photo, capture d'écran, slide, page scannée, tableau blanc, tableau de chiffres...). Transcris fidèlement tout le texte lisible, PUIS ajoute une lecture structurée : la situation décrite, la complication ou tension visible, les chiffres ou faits clés tels qu'écrits (jamais inventés ni arrondis), les parties prenantes nommées ou clairement impliquées. Si l'image contient un schéma ou un graphique, décris ce qu'il montre (tendance, comparaison, structure) sans inventer de valeurs non lisibles. Réponds en français, en texte brut structuré (pas de JSON).` },
        { role: "user", content: [
          { type: "text", text: `Document${data.label ? ` : ${data.label}` : ""} — transcris et analyse cette image.` },
          { type: "image_url", image_url: { url: data.dataUrl } },
        ] },
      ],
      maxTokens: 1600,
      temperature: 0.1,
    });
    if (data.dataUrl.length > 14_000_000) return { text: "" }; // au-delà de 10 Mo encodés : refusé
    let r = await call("pixtral-large-latest");
    if (!r.ok || !r.content.trim()) r = await call("mistral-small-latest");
    return { text: r.ok ? r.content : "" };
  });

// ─── 0b. Parse elicitation fields from a document ────────────────────────────

export interface ParsedElicitation {
  contextRaw: string;
  objectif: string;
  horizon: string;
  decideurs: string;
  impactes: string;
  resistances: string;
  exigencesNonNeg: string;
  leviersDDP: string;
  contraintesDIP: string;
  risques: string[];
  caseType: string;
  sector: string;
  title: string;
}

export const parseElicitationFromDoc = createServerFn({ method: "POST" })
  .validator((d: { text: string }) => d)
  .handler(async ({ data }): Promise<ParsedElicitation> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        { role: "system", content: `Tu es un analyste senior en aide à la décision : la rigueur de structuration d'un directeur de conseil en stratégie de premier plan, combinée à la lecture systémique d'un ingénieur système expérimenté (analyse en systèmes, parties prenantes, boucles de cause à effet) — sans jamais te présenter ni te nommer comme tel.

Applique ces patterns de lecture, dans cet ordre, avant de produire le JSON :

① SITUATION → COMPLICATION → QUESTION : identifie d'abord la situation de référence (le contexte stable), puis la complication qui la remet en cause (ce qui a changé, ce qui ne va plus), puis la question de décision qui en découle réellement — ne recopie jamais telle quelle une question de façade si le document révèle une question plus profonde.

② SYMPTÔME VS CAUSE RACINE : si le document décrit un problème comme une conséquence (ex. "baisse des ventes"), remonte mentalement à la cause agissante plausible (ex. rupture de chaîne d'approvisionnement, changement réglementaire, obsolescence produit) avant de formuler l'objectif — ne fige jamais un symptôme en objectif.

③ CARTOGRAPHIE DES PARTIES PRENANTES : identifie qui décide, qui est impacté, qui pourrait résister — y compris les acteurs IMPLICITES que le document ne nomme pas explicitement mais dont l'intérêt est manifestement engagé (régulateur, partenaire, collectivité, client final, concurrent).

④ TENSIONS ET ARBITRAGES IMPLICITES : repère les tensions non dites entre objectifs (court terme/long terme, coût/qualité, rapidité/robustesse, autonomie/dépendance) — ces tensions nourrissent les exigences non-négociables et les leviers, même quand le document ne les formule pas comme telles.

⑤ LEVIERS RÉELLEMENT CONTRÔLABLES VS CONTRAINTES SUBIES : ne classe en leviers (leviersDDP) que ce que le décideur contrôle réellement ; classe en contraintes (contraintesDIP) tout ce qui est imposé par le marché, la réglementation, ou le contexte macro — cette distinction est structurante pour la suite de l'analyse, ne la brouille jamais.

⑥ SYNTHÈSE, JAMAIS COPIE : tu es un analyste qui restitue le SENS, pas un extracteur qui recopie. N'insère JAMAIS dans un champ une liste brute de noms de variables, de codes techniques, de colonnes ou d'identifiants internes tels qu'ils apparaissent dans le document (ex. "STOCK_THEORIQUE_FIN", "PMPA_ECONOMIQUE_PROJETE", "PRIX_MATA") — reformule TOUJOURS en langage métier clair ce que ces éléments signifient pour la décision (ex. non pas "PRIX_MATA" mais "un prix plancher unique imposé au réseau"). Si le document contient une longue liste d'éléments (règles, contraintes, indicateurs, risques...), NE LES RECOPIE PAS TOUS : sélectionne les 3 à 5 plus décisifs pour l'arbitrage et condense les autres en une clause de synthèse (ex. "ainsi que plusieurs règles de gestion des stocks et prix de moindre portée décisionnelle") plutôt que d'énumérer quinze éléments à la suite. Chaque champ texte reste lisible en une seule lecture, jamais un mur de texte ou une liste à virgules de dix éléments et plus.

Règles absolues : n'invente aucun chiffre, aucune donnée, aucun fait absent du document — si une information manque, laisse le champ vide plutôt que de la déduire comme certaine (tu peux inférer prudemment un objectif implicite via le pattern ①-②, mais jamais une donnée factuelle comme un chiffre, un nom d'entreprise ou une date). Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour. Les champs risques et pestelSelected sont des tableaux. caseType doit être l'un de : nouveau_produit, conception_complexe, strategique, operationnel, risque, investissement.` },
        { role: "user", content: `Document :\n${data.text.slice(0, 12000)}\n\nExtrais ces champs en JSON, en appliquant les patterns de lecture ci-dessus (pas une simple paraphrase du texte, et surtout pas une recopie des noms de variables/codes internes — synthétise en langage métier, condense les longues listes aux 3-5 éléments les plus décisifs) :\n{\n  "title": "titre court de la décision (5-8 mots)",\n  "contextRaw": "situation de référence + complication qui la remet en cause, en langage clair (3-5 phrases max)",\n  "objectif": "la vraie question de décision (cause racine, pas le symptôme de façade si différent) — 1-2 phrases",\n  "horizon": "horizon temporel (ex : 1-3 ans)",\n  "decideurs": "qui prend la décision — noms de rôles, pas une liste exhaustive",\n  "impactes": "qui est impacté, y compris les parties prenantes implicites pertinentes — 3-5 maximum",\n  "resistances": "qui pourrait résister et pourquoi (intérêt engagé) — condensé",\n  "exigencesNonNeg": "les 3-5 exigences non-négociables les plus décisives (critères éliminatoires), condensées en langage métier — jamais une recopie exhaustive des règles du document",\n  "leviersDDP": "les leviers réellement contrôlables par le décideur, synthétisés (jamais une contrainte subie, jamais une liste de noms de variables)",\n  "contraintesDIP": "les facteurs de contexte imposés les plus significatifs, condensés",\n  "risques": ["risque 1 en langage clair", "risque 2 en langage clair"],\n  "caseType": "type de cas parmi la liste fournie",\n  "sector": "secteur d'activité (ex: Transport, Industrie, Finance, Santé, Immobilier, Énergie, Technologie, Retail, Public, Défense)"\n}` },
      ],
      maxTokens: 1400,
      temperature: 0.15,
    });
    // Repli honnête : si le LLM est indisponible OU n'a rien extrait, on injecte
    // au moins l'en-tête du document comme contexte — jamais un succès vide.
    const fallback: ParsedElicitation = { title: "", contextRaw: data.text.slice(0, 400), objectif: "", horizon: "", decideurs: "", impactes: "", resistances: "", exigencesNonNeg: "", leviersDDP: "", contraintesDIP: "", risques: [], caseType: "", sector: "" };
    if (!r.ok) return fallback;
    try {
      const raw = extractJson(r.content) as Record<string, unknown>;
      // Le LLM ne respecte pas toujours le schéma à la lettre (un champ texte
      // peut revenir en tableau ou en objet) — on force chaque champ dans le
      // type attendu ici, une bonne fois, plutôt que de laisser une valeur
      // mal typée se propager jusqu'à planter un .trim() en aval.
      // Garde-fou de longueur : même si le LLM ignore la consigne de synthèse
      // et recopie une longue liste brute (noms de variables, énumération de
      // règles...), aucun champ n'atteint l'utilisateur en mur de texte.
      // Garde-fou large, pas une limite de synthèse : la consigne de synthèse
      // ci-dessus fait le travail de condensation ; ce plafond n'existe que
      // pour arrêter un texte qui deviendrait franchement anormal (des
      // milliers de caractères), pas pour couper une réponse conforme de
      // 600-900 caractères en plein milieu d'une phrase.
      const MAX_FIELD_LEN = 1200;
      const asText = (v: unknown): string => {
        const s = typeof v === "string" ? v
          : Array.isArray(v) ? v.map(String).join(", ")
          : v && typeof v === "object" ? "" // objet inattendu : on ignore plutôt que d'exposer [object Object]
          : v != null ? String(v) : "";
        return s.length > MAX_FIELD_LEN ? s.slice(0, MAX_FIELD_LEN - 1).trimEnd() + "…" : s;
      };
      const parsed: ParsedElicitation = {
        title: asText(raw.title), contextRaw: asText(raw.contextRaw), objectif: asText(raw.objectif),
        horizon: asText(raw.horizon), decideurs: asText(raw.decideurs), impactes: asText(raw.impactes),
        resistances: asText(raw.resistances), exigencesNonNeg: asText(raw.exigencesNonNeg),
        leviersDDP: asText(raw.leviersDDP), contraintesDIP: asText(raw.contraintesDIP),
        risques: Array.isArray(raw.risques) ? raw.risques.map(String) : [],
        caseType: asText(raw.caseType), sector: asText(raw.sector),
      };
      if (!parsed.contextRaw && !parsed.objectif && !parsed.title) return fallback;
      return parsed;
    } catch {
      return fallback;
    }
  });

// ─── Affinage LLM du module Transform (libellés métier) ──────────────────────
// L'heuristique produit la structure ; le LLM affine les libellés avec le
// contexte de la décision. Repli silencieux : en cas d'indisponibilité,
// les libellés heuristiques restent (jamais d'échec bloquant).
export interface RefineTransformInput {
  context: string; objective: string;
  flows: Array<{ id: string; label: string; fromLabel: string; toLabel: string }>;
  ciblesFeatures: string[];
  backlog: Array<{ id: string; titre: string }>;
}
export interface RefineTransformOutput {
  flows: Array<{ id: string; label: string }>;
  extraFeatures: string[];
  backlog: Array<{ id: string; titre: string }>;
}
export const refineTransform = createServerFn({ method: "POST" })
  .validator((d: RefineTransformInput) => d)
  .handler(async ({ data }): Promise<RefineTransformOutput | null> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        { role: "system", content: "Tu es un architecte d'entreprise. Affine des libellés d'architecture de transformation pour qu'ils soient métier, précis et compréhensibles par un COMEX. Réponds UNIQUEMENT en JSON valide. Jamais de jargon technique gratuit, jamais de chiffres inventés." },
        { role: "user", content: `Décision : ${data.context}\nObjectif de transformation : ${data.objective}\n\nFlux actuels (libellés heuristiques à affiner — le libellé doit dire l'INFORMATION MÉTIER transitée) :\n${data.flows.map(f => `- id ${f.id} : ${f.fromLabel} → ${f.toLabel} : « ${f.label} »`).join("\n")}\n\nFonctions du module cible : ${data.ciblesFeatures.join(", ")}\n\nBacklog (titres à affiner en épics actionnables) :\n${data.backlog.map(b => `- id ${b.id} : ${b.titre}`).join("\n")}\n\nRéponds : {"flows":[{"id":"...","label":"libellé métier affiné"}],"extraFeatures":["1 à 2 fonctions L4 supplémentaires pertinentes pour le module cible"],"backlog":[{"id":"...","titre":"titre affiné"}]}` },
      ],
      maxTokens: 700, temperature: 0.2,
    });
    if (!r.ok) return null;
    try { return extractJson(r.content) as RefineTransformOutput; } catch { return null; }
  });

// ─── Affinage LLM du dossier d'exigences ─────────────────────────────────────
export const refineExigences = createServerFn({ method: "POST" })
  .validator((d: { context: string; exigences: Array<{ id: string; type: string; texte: string }> }) => d)
  .handler(async ({ data }): Promise<{ exigences: Array<{ id: string; texte: string }>; nouvelles: Array<{ type: string; texte: string }> } | null> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        { role: "system", content: "Tu es un ingénieur des exigences. Reformule des exigences produit/offre au format normalisé « Le système doit être capable de <capacité vérifiable> — niveau de performance requis : <Élevé|Modéré|Faible> » (the system shall be able to). Vérifiables, non ambiguës, de niveau système : jamais de solution technique imposée, jamais de valeur chiffrée inventée — le niveau de performance reste sur l'échelle ordinale. Remplace « (cible chiffrée : à préciser) » par une cible quantifiée UNIQUEMENT si le contexte la fournit ou la rend déductible de façon défendable — sinon conserve la mention. Ajoute « , en <contexte opérationnel> » seulement quand un contexte pertinent existe. Réponds UNIQUEMENT en JSON valide." },
        { role: "user", content: `Contexte de la décision : ${data.context}\n\nExigences à affiner :\n${data.exigences.map(e => `- id ${e.id} [${e.type}] : ${e.texte}`).join("\n")}\n\nRéponds : {"exigences":[{"id":"...","texte":"reformulation vérifiable"}],"nouvelles":[{"type":"Fonctionnelle|Non fonctionnelle|Contrainte","texte":"exigence manquante importante (2 max)"}]}` },
      ],
      maxTokens: 800, temperature: 0.2,
    });
    if (!r.ok) return null;
    try { return extractJson(r.content) as { exigences: Array<{ id: string; texte: string }>; nouvelles: Array<{ type: string; texte: string }> }; } catch { return null; }
  });

// ─── 1. Classify decision & propose dimensions ────────────────────────────────

export interface ClassifyResult {
  problemType: string;   // ex: "Make-or-Buy stratégique"
  playbookId: string | null;
  dimensions: string[];  // 3–4 strategic dimensions
  contextSummary: string;
  confidence: number;    // 0–100
}

export const classifyDecision = createServerFn({ method: "POST" })
  .validator((d: { text: string; companyContext?: string; domainExpertiseHint?: string }) => d)
  .handler(async ({ data }): Promise<ClassifyResult> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura, analyste expert en Ingénierie Système et aide à la décision. Analyse la situation avec une grille systémique. Réponds UNIQUEMENT en JSON valide.

Identifie :
1. Le Système d'Intérêt (SOI) : qu'est-ce qu'on décide de concevoir, choisir ou transformer ? (1 phrase)
2. Les parties prenantes clés : qui sont les acteurs dont la satisfaction définira le succès ? (2-4 noms de rôles)
3. Le type de problème : verbe d'action + enjeu précis (ex: "Choisir entre deux technologies de rupture", "Arbitrer l'allocation de budget R&D entre 3 axes")
4. Le playbook applicable : supply_crisis | ma_pme | sales_strategic | investment_prioritization | si_rationalization | risk_management | null
5. 3-4 dimensions stratégiques EN TENSION RÉELLE dans ce problème (pas des catégories génériques — identifier les vrais trade-offs)
6. Un résumé contextuel court (1 phrase max)

Format JSON : {"problemType":"...","playbookId":"...ou null","dimensions":["...","...","..."],"contextSummary":"1 phrase max sur le SOI et ses acteurs","confidence":80}${data.companyContext ?? ""}${data.domainExpertiseHint ? scResilienceCompactHint(data.domainExpertiseHint) : ""}`,
        },
        { role: "user", content: data.text },
      ],
      maxTokens: 550,
      temperature: 0.2,
    });
    if (!r.ok) return { problemType: "Décision stratégique", playbookId: null, dimensions: ["Impact financier", "Faisabilité opérationnelle", "Risque"], contextSummary: data.text.slice(0, 80), confidence: 60 };
    try {
      return extractJson(r.content) as ClassifyResult;
    } catch {
      return { problemType: "Décision stratégique", playbookId: null, dimensions: ["Impact financier", "Faisabilité opérationnelle", "Risque"], contextSummary: data.text.slice(0, 80), confidence: 60 };
    }
  });

// ─── 2. Generate full decision model (criteria tree + leviers + options) ────────

export interface GeneratedIndicator {
  id: string;
  label: string;
  description: string;
  importance: "Essentiel" | "Important" | "Secondaire" | "Faible";
  // true UNIQUEMENT si un modèle physique/de comportement connu pourrait en principe calculer
  // cette valeur à partir des leviers (rare). Absent/false = jugement d'expert qualitatif,
  // le cas normal en l'absence de modèle — jamais un chiffre inventé pour combler ce vide.
  modelisable?: boolean;
  // true UNIQUEMENT sur un ou deux TPM particulièrement justes, précis et inspirants — un
  // angle de mesure auquel le décideur n'aurait probablement pas pensé seul (même badge que
  // l'option de levier "exploratoire"). Purement indicatif, n'affecte aucun calcul.
  exploratoire?: boolean;
}

export interface GeneratedCriterion {
  id: string;
  label: string;
  description: string;
  importance: "Essentiel" | "Important" | "Secondaire" | "Faible";
  children: GeneratedIndicator[];
}

export interface GeneratedObjective {
  id: string;
  label: string;
  description: string;
  importance: "Essentiel" | "Important" | "Secondaire" | "Faible";
  children: GeneratedCriterion[];
  // Besoin exprimé que ce MOE trace — gabarit "Le <partie prenante> doit/ne doit pas <capacité>
  // avec <niveau de performance> dans <contexte>". Traçabilité besoin → MOE, jamais chiffrée.
  besoinTrace?: string;
  // Nature de l'objectif. La thèse (ch. VI, perspectives) note que l'évaluation se limitait à
  // l'efficacité et devait s'étendre au coût et au risque : on rend donc les trois axes explicites.
  // N'affecte AUCUN calcul — l'agrégation reste identique. Sert à garantir la couverture et à
  // montrer l'équilibre du modèle.
  nature?: "efficacite" | "cout" | "risque";
}

export interface GeneratedOption {
  id: string;
  label: string;
  exploratoire?: boolean;
  // Justification qualitative courte : quel(s) TPM/besoin cette option satisfait et comment —
  // allocation option → besoin, jamais un score.
  justification?: string;
  // Ids d'options d'AUTRES leviers structurellement incompatibles avec celle-ci (couplage fort
  // empêchant la coexistence) — signal qualitatif, jamais une contrainte numérique.
  incompatibleAvec?: string[];
}

export interface GeneratedLevier {
  id: string;
  label: string;
  type: "budget" | "ressource" | "temps" | "risque" | "decision" | "technique" | "autre";
  options: GeneratedOption[];
}

export interface GeneratedFullModel {
  criteria: GeneratedObjective[];
  leviers: GeneratedLevier[];
}

export const generateFullModel = createServerFn({ method: "POST" })
  .validator((d: { context: string; problemType: string; dimensions: string[]; companyContext?: string; elicitation?: import('./atelier-store').ElicitationData; domainExpertiseHint?: string }) => d)
  .handler(async ({ data }): Promise<GeneratedFullModel> => {
    const { mistralChat } = await import("../mistral.server");

    function buildElicitationContext(e: typeof data.elicitation): string {
      if (!e) return "";
      const parts: string[] = [];
      if (e.objectif) parts.push(`Objectif prioritaire : ${e.objectif}`);
      if (e.horizon)  parts.push(`Horizon : ${e.horizon}`);
      if (e.decideurs)  parts.push(`Décideurs : ${e.decideurs}`);
      if (e.impactes)   parts.push(`Parties impactées : ${e.impactes}`);
      if (e.resistances) parts.push(`Résistances potentielles : ${e.resistances}`);
      if (e.exigencesNonNeg) parts.push(`Exigences non-négociables (→ MOE "Essentiel" dans le modèle) : ${e.exigencesNonNeg}`);
      if (e.leviersDDP) parts.push(`Leviers actionnables identifiés par le décideur (→ DDPs prioritaires) : ${e.leviersDDP}`);
      if (e.contraintesDIP) parts.push(`Contraintes de contexte hors contrôle (→ ne PAS inclure comme leviers, ce sont des DIPs) : ${e.contraintesDIP}`);
      if (e.risques?.length) parts.push(`Risques d'exécution : ${e.risques.join(", ")}`);
      const pestelLabels: Record<string,string> = {P:"Politique",E:"Économique",S:"Social",T:"Technologique",En:"Environnemental",L:"Légal"};
      const pestelParts = (e.pestelSelected ?? [])
        .filter(d => e.pestelAnswers?.[d])
        .map(d => `${pestelLabels[d] ?? d} : ${e.pestelAnswers![d]}`);
      if (pestelParts.length) parts.push(`Contexte externe (PESTEL) :\n${pestelParts.map(p=>`  • ${p}`).join("\n")}`);
      if (!parts.length) return "";
      return `\n\n--- Contexte élicité ---\n${parts.join("\n")}\n---`;
    }
    const elicitCtx = buildElicitationContext(data.elicitation);

    const callModel = (retryHint: string, maxTokens: number) => mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura, analyste expert en Ingénierie Système et en aide à la décision multicritère (MCDA). Tu appliques la méthode MCD-E de décomposition rigoureuse MOE/MOP/TPM, fondée sur les principes de l'Ingénierie Système. Cette démarche vaut identiquement pour un cas business, stratégique, risque, produit ou de conception technique — UNE seule chaîne de raisonnement, jamais un mécanisme différent selon le domaine.

━━━ PHASE -1 — CADRAGE DU PROBLÈME (générique, tous domaines, avant tout le reste) ━━━
① Formule le problème/l'enjeu SANS AMBIGUÏTÉ en une phrase — qu'est-ce qu'on décide exactement ?
② Vérifie que ce n'est pas un symptôme : si le sujet donné ressemble à une conséquence plutôt qu'à la cause à traiter, remonte mentalement à la cause agissante (façon « 5 pourquoi », 2-3 relances suffisent) avant de cadrer le reste.
③ Si le problème est complexe, décompose-le en 2-4 sous-problèmes indépendants et exhaustifs — chacun pourra donner un MOE distinct.

━━━ PHASE 0 — ENVIRONNEMENT & CADRAGE SYSTÉMIQUE ━━━
AVANT toute décomposition, identifier mentalement :
① Le périmètre de la décision : qu'est-ce qu'on décide exactement de concevoir, choisir ou transformer ?
② Les parties prenantes / systèmes externes : qui sont les acteurs dont la satisfaction déterminera le succès, ou qui influencent la décision de l'extérieur ? (utilisateurs finaux, clients, opérateurs, partenaires, régulateurs, marché, concurrents) — pour chacun, identifie aussi son ENJEU (ce qu'il gagne ou risque de perdre dans cette décision).
③ Le contexte opérationnel : dans quel environnement la solution sera-t-elle évaluée, déployée ou utilisée ? (marché, réglementation, contraintes techniques, horizon temporel)
④ Les situations critiques : 2-3 cas d'usage, contextes ou moments du cycle de vie (nominal, dégradé, lancement, crise...) qui révèlent quelles exigences sont vraiment critiques.

━━━ PHASE 0bis — BESOINS EXPRIMÉS (obligatoire, avant tout MOE) ━━━
Pour chaque partie prenante identifiée en ②, formule explicitement le besoin brut selon ce gabarit qualitatif et testable (jamais un score, jamais un chiffre inventé), en l'ancrant sur son enjeu :
« Le ⟨partie prenante⟩, pour qui ⟨enjeu⟩, doit (ou ne doit pas) ⟨avoir une capacité⟩ avec un ⟨niveau de performance⟩ dans ⟨contexte donné⟩. »
Exemples : « L'opérateur au sol doit pouvoir localiser le drone en toute condition météo avec une précision suffisante pour intervenir en moins de 10 minutes. » ; « Le comité d'investissement ne doit pas engager de capital sans visibilité sur le point mort avant 18 mois. »
Produis un besoin par partie prenante clé (3 à 5 au total) — c'est cette liste qui nourrit et justifie les MOE de la Phase 1.

━━━ PHASE 1 — MOE (Mesure d'Efficacité — niveau Mission) ━━━
→ Un MOE exprime la SATISFACTION D'UNE PARTIE PRENANTE IDENTIFIÉE face à la mission de la solution.
→ Un MOE est mesuré dans le contexte opérationnel réel, pas en laboratoire.
→ Test MOE : "Si cet objectif n'est pas atteint, la décision est-elle un ÉCHEC pour cette partie prenante ?" — seuls ceux qui passent sont des MOE valides.
→ Un MOE non directement estimable → le décomposer en 2-3 MOP. S'il est directement estimable, il peut rester tel quel.
→ 4 à 6 MOE, non redondants, couvrant des tensions réelles : valeur/risque, court terme/long terme, interne/externe, performance/acceptabilité.
→ COUVERTURE DES TROIS AXES (obligatoire) : un modèle qui n'évalue que l'efficacité est incomplet. Chaque MOE porte un champ "nature" valant "efficacite" (ce que la solution APPORTE : performance, valeur, satisfaction), "cout" (ce qu'elle COÛTE : investissement, ressources, effort, délai consommé) ou "risque" (ce qu'elle MENACE : exécution, conformité, dépendance, réversibilité). Le jeu de MOE doit contenir AU MOINS UN objectif de nature "cout" ET AU MOINS UN de nature "risque" — sauf si le contexte les exclut explicitement. Ces axes s'évaluent exactement comme les autres, sur la même échelle ordinale : un coût élevé se traduit par une dégradation (−/−−), jamais par un chiffre.
→ TRAÇABILITÉ OBLIGATOIRE : chaque MOE doit citer, dans le champ JSON "besoinTrace", le besoin exprimé (Phase 0bis) dont il découle — jamais un MOE sans besoin d'origine identifié.

━━━ PHASE 2 — MOP (Mesure de Performance — niveau Capacité Fonctionnelle) ━━━
→ Un MOP caractérise une CAPACITÉ (fonctionnelle ou physique) que la solution doit posséder pour satisfaire son MOE parent.
→ Test MOP : "Cette capacité est-elle nécessaire ET suffisante pour contribuer au MOE parent ?"
→ Les "-ilités" sont de bons candidats : disponibilité, maintenabilité, intégrabilité, adaptabilité, faisabilité, sûreté de fonctionnement.
→ 3 à 4 MOP par MOE.

━━━ PHASE 3 — TPM (Paramètre de Conception — niveau Design) ━━━
→ Un TPM est un PARAMÈTRE DE CONCEPTION : sa valeur est fixée par les choix d'architecture ou de configuration réalisés.
→ Test TPM : "Cette valeur change-t-elle selon les leviers activés ou les options de conception choisies ?" Si non → c'est une contrainte fixe de contexte, pas un critère d'évaluation.
→ RÈGLE CRITIQUE : chaque TPM doit être influencé par au moins un levier (DDP). Un TPM sans levier associé n'est pas utile dans la comparaison des scénarios.
→ Un TPM est quantifiable ou qualifiable : ratio, durée, coût, niveau qualitatif, score.
→ 3 à 4 TPM par MOP.
→ MODÈLE DE COMPORTEMENT (rare — la plupart des TPM n'en ont pas) : le cas normal est l'ABSENCE de modèle physique/comportemental connu — c'est précisément pour ça que l'évaluation reste qualitative (avis d'expert : ++/+/0/−/−−/?), jamais un chiffre inventé pour combler ce vide. Marque "modelisable": true UNIQUEMENT si un modèle de comportement réel (physique, financier, simulable) pourrait en principe calculer la valeur de ce TPM à partir des leviers — laisse le champ absent dans tous les autres cas (l'immense majorité).

━━━ PHASE 4 — LEVIERS (Variables de décision contrôlables) ━━━
→ UNIQUEMENT les variables que le décideur CONTRÔLE RÉELLEMENT dans la décision à prendre.
→ NE PAS inclure les facteurs imposés (marché, réglementation imposée, contexte macro, contraintes technologiques subies) — ce sont des contraintes de contexte, pas des leviers.
→ Chaque levier doit créer un trade-off réel entre TPM (améliorer l'un peut dégrader l'autre).
→ 8 à 10 leviers actionnables et spécifiques au domaine du problème (vise le haut de la fourchette pour les cas complexes : conception, stratégie lourde, M&A — un espace de choix trop pauvre appauvrit l'arbitrage).
→ 4 à 5 options concrètes et nommées par levier, couvrant un spectre de compromis réel (jamais "Option A/B/C" — utiliser des valeurs ou approches réelles du domaine).
→ ALLOCATION QUALITATIVE (obligatoire) : chaque option porte un champ JSON "justification" — une phrase courte (≤15 mots) disant QUEL TPM elle sert et COMMENT (ex : "réduit la masse du train — impacte directement l'énergie d'impact absorbée"). Jamais un score, juste la raison qualitative du lien option → TPM/besoin. Pour les cas business/stratégie/risque, la justification peut aussi situer l'option dans une trajectoire (état actuel → intermédiaire → cible) et porter un jugement qualitatif coût/bénéfice ("investissement lourd mais différenciant", "gain rapide, effort limité") — jamais un chiffre.
→ COUPLAGE (uniquement si réel et fort) : si le choix d'une option rend structurellement incohérent le choix d'une option précise d'un AUTRE levier (ex : architecture légère incompatible avec un blindage lourd), liste l'id de cette option dans le champ JSON "incompatibleAvec" (tableau d'ids). Ne remplis ce champ QUE pour des incompatibilités réelles et fortes — la plupart des options n'en ont aucune, laisse le champ absent dans ce cas.

━━━ PHASE 5 — PROFONDEUR TECHNIQUE (obligatoire, quel que soit le domaine) ━━━
Le modèle doit être PARAMÉTRIQUE, au niveau d'un ingénieur senior ou d'un expert du domaine — jamais surfacique.
→ Chaque TPM nomme un PARAMÈTRE DIMENSIONNANT réel du domaine, avec son unité et, si pertinent, le phénomène qui le gouverne. Exemples du niveau attendu :
   · conception/mécanique : « Énergie d'impact absorbée à l'atterrissage (J) — course d'amortissement × raideur », « Marge de flambage des jambes (%) », « Masse du train (kg) » ;
   · logiciel/SI : « Latence P99 sous charge nominale (ms) », « Coût de migration par service (j·h) » ;
   · stratégie/finance : « Point mort de la filiale (mois) », « Sensibilité de la marge au taux de change (pp/10 %) » ;
   · santé/industrie/énergie : même exigence de granularité.
→ Chaque LEVIER est une VARIABLE DE CONCEPTION ou DE STRUCTURE paramétrée ; ses options portent des VALEURS ou ARCHITECTURES précises du domaine (matériau, géométrie, nombre, technologie, mécanisme contractuel, séquencement) — jamais des généralités. Exemple attendu pour un atterrisseur : levier « Architecture d'amortissement » → « 4 jambes cantilever + nid d'abeille écrasable », « 3 jambes inversées + amortisseurs oléopneumatiques », « Coussins gonflables (airbags) péri-chocs » ; PAS « solution robuste / standard / économique ».
→ Adapte le registre au type de cas : conception_complexe → paramètres physiques et architectures ; strategique/investissement → leviers structurels chiffrables (mode d'entrée, séquence, structure de financement) ; operationnel → paramètres de processus (takt, lotissement, polyvalence) ; risque → barrières et détections paramétrées.
→ Pour conception_complexe : le libellé de chaque option EST le composant ou l'architecture technique candidate (pas une abstraction) — combiné à son "justification" (quel TPM il sert), cela trace la chaîne complète besoin → MOE → TPM → composant candidat, sans jamais sortir du qualitatif.
→ GARANTIE QUALITATIVE (inviolable) : les unités, valeurs et grandeurs ne servent qu'à NOMMER précisément paramètres et options. L'ÉVALUATION reste strictement ordinale (échelle ++/+/0/−/−−/?) — aucun calcul, aucune agrégation, aucun seuil ne sera jamais fait sur ces nombres. La profondeur est dans le vocabulaire, la rigueur reste dans le modèle ordinal.
→ ADAPTATIVITÉ : calibre la profondeur sur la demande. Un dirigeant qui pose une question de cap n'a pas besoin de raideurs en N/mm — mais mérite le même niveau d'expertise dans SON registre (structures de deal, séquencements, mécanismes de gouvernance nommés). Ne sur-détaille jamais un sujet simple ; ne sous-détaille jamais un sujet expert.

━━━ PHASE 6 — EXPLORATION (l'effet Aura, tous domaines) ━━━
Aura doit rendre visible le non-imaginé : pour AU MOINS UN levier (idéalement deux), inclure UNE OPTION LATÉRALE à laquelle le décideur n'aurait probablement pas pensé — crédible, défendable, issue d'un domaine voisin ou d'un renversement du problème (ex : au lieu de « quel amortisseur ? », « supprimer l'atterrissage : station-mère qui ne se pose jamais » ; au lieu de « quel pays d'abord ? », « acquérir le distributeur plutôt que le concurrent »). La nommer normalement (pas de mention « créatif ») et la MARQUER dans le JSON par "exploratoire": true — l’interface l’éclairera comme une lampe. C'est cette option qui crée l'effet « on n'y avait pas pensé » — sur la stratégie, les risques et l'opérationnel autant que sur la conception.
Le même effet vaut pour la MESURE, pas seulement pour le choix : parmi tous les TPM produits en Phase 3, choisis UN ou DEUX (jamais plus) qui sont particulièrement justes, précis et inspirants — un angle de mesure sec et révélateur auquel le décideur n'aurait probablement pas pensé seul (ex : au lieu de « Coût du projet », « Coût du premier mois de silence si le fournisseur disparaît » ; au lieu de « Satisfaction client », « Délai avant qu'un client mécontent recommande quand même »). MARQUE-les dans le JSON par "exploratoire": true sur le TPM — jamais sur un MOE ou un MOP, et jamais plus de deux au total dans tout le modèle.

━━━ RÈGLE DE VOLUME (prime sur tout) ━━━
Les phases 5 et 6 enrichissent les LIBELLÉS, elles ne réduisent JAMAIS les quantités : livre TOUJOURS 4 à 6 MOE, 3 à 4 MOP par MOE, 3 à 4 TPM par MOP, 8 à 10 leviers, 4 à 5 options par levier (dont l'option exploratoire). Pour tenir ce volume, garde les descriptions COURTES (≤ 18 mots) — la richesse va dans les labels, pas dans la prose. Un modèle riche mais incomplet est un échec ; livre le JSON COMPLET. Un modèle pauvre (peu de leviers, peu d'options, arbre étroit) prive le décideur de vraies alternatives à comparer — vise systématiquement le haut de chaque fourchette plutôt que le bas.

FORMAT JSON ATTENDU (respecte exactement cette structure) :
{
  "criteria": [
    {
      "id": "obj_1",
      "label": "Libellé court du MOE — ancré sur une partie prenante et sa mission",
      "description": "Partie prenante concernée + ce que ce MOE cherche à maximiser/minimiser dans le contexte réel",
      "besoinTrace": "Le <partie prenante> doit <capacité> avec <niveau de performance> dans <contexte> — le besoin exprimé en Phase 0bis dont ce MOE découle",
      "nature": "efficacite",
      "importance": "Essentiel",
      "children": [
        {
          "id": "crit_1_1",
          "label": "Libellé du MOP — capacité fonctionnelle requise",
          "description": "Capacité ou service que la solution doit fournir pour satisfaire ce MOE",
          "importance": "Important",
          "children": [
            { "id": "ind_1_1_1", "label": "Libellé du TPM — paramètre de conception mesurable", "description": "Valeur qui change selon le levier activé — ex: délai en semaines, coût en €, taux en %", "importance": "Important", "exploratoire": true }
          ]
        }
      ]
    }
  ],
  "leviers": [
    {
      "id": "lev_1",
      "label": "Levier d'action — variable contrôlable par le décideur",
      "type": "decision",
      "options": [
        { "id": "opt_1_1", "label": "Valeur ou approche concrète A — nom réel du domaine", "justification": "Sert le TPM <x> en <comment>, courte phrase" },
        { "id": "opt_1_2", "label": "Valeur ou approche concrète B — nom réel du domaine", "justification": "..." },
        { "id": "opt_1_3", "label": "Option latérale inattendue mais crédible", "exploratoire": true, "justification": "..." }
      ]
    }
  ]
}

RÈGLES QUALITÉ ABSOLUES :
① Structure : 4 à 6 MOE → chacun avec 3 à 4 MOP → chaque MOP avec 3 à 4 TPM
② Labels SPÉCIFIQUES au problème : ✗ "Performance" → ✓ "Performance de traitement en pic de charge" ; ✗ "Coût" → ✓ "Coût total de déploiement sur 3 ans"
③ Chaque MOE correspond à une partie prenante identifiée en Phase 0 ET cite son besoin d'origine dans "besoinTrace" (Phase 0bis) — aucun MOE orphelin ; chaque MOE porte sa "nature" (efficacite | cout | risque), avec au moins un "cout" et un "risque" dans le jeu
④ Chaque TPM doit être influençable par au moins un levier — sinon c'est une contrainte de contexte, pas un critère
⑤ Les leviers sont des variables contrôlables : JAMAIS des facteurs de marché, réglementaires ou macro-économiques
⑥ importance : "Essentiel" (MOE non-négociable), "Important" (MOP clé), "Secondaire" ou "Faible" (TPM secondaire)
⑦ 8 à 10 leviers, type parmi : budget | ressource | temps | risque | decision | technique | autre
⑧ 1 à 2 TPM (jamais plus, jamais un MOE ni un MOP) portent "exploratoire": true — le ou les indicateurs les plus justes, précis et inspirants du modèle
⑨ Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, sans commentaire (jamais de /* … */ ni de //) et sans virgule traînante${retryHint}${data.domainExpertiseHint ? scResilienceExpertBlock(data.domainExpertiseHint) : ""}`,
        },
        {
          role: "user",
          content: `Problème décisionnel : ${data.context}${elicitCtx}${data.companyContext ?? ""}
Type : ${data.problemType}
Dimensions en tension : ${data.dimensions.join(", ")}

Démarche OBLIGATOIRE avant de générer le JSON :

PHASE 0 — CADRAGE (répondre mentalement) :
• Quel est le Système d'Intérêt (SOI) ? Qu'est-ce qu'on décide exactement ?
• Qui sont les acteurs du contexte opérationnel ? (utilisateurs, clients, opérateurs, régulateurs...)
• Dans quel environnement le SOI sera-t-il évalué / déployé ?
• Quels scénarios opérationnels typiques révèlent les exigences critiques ?

PHASE 1 → MOE : Pour chaque partie prenante identifiée, quel objectif de mission sa satisfaction requiert-elle ? (Test : échec si non atteint ?)
PHASE 2 → MOP : Pour chaque MOE, quelles capacités fonctionnelles la solution doit-elle posséder ? (Test : nécessaire ET suffisant pour ce MOE ?)
PHASE 3 → TPM : Pour chaque MOP, quels paramètres de conception varient selon les options choisies ? (Test : change selon les leviers ?)
PHASE 4 → Leviers : Quelles variables le décideur contrôle-t-il réellement ? (Exclure : marché, réglementation imposée, contexte macro = contraintes de contexte)

Générer maintenant le JSON complet avec toute la décomposition MOE/MOP/TPM et les leviers DDPs.`,
        },
      ],
      guardrails: ["verite", "profondeur", "originalite", "controle"],
      maxTokens,
      temperature: 0.25,
    });

    // Génération de secours des leviers seuls : appel court et donc très robuste,
    // utilisé quand l'arbre de critères est bon mais que "leviers" (placé après
    // les ~45 nœuds MOE/MOP/TPM dans le JSON) a été perdu par troncature.
    async function generateLeviersOnly(criteria: GeneratedFullModel["criteria"]): Promise<GeneratedFullModel["leviers"] | null> {
      const tpmLabels = JSON.stringify(criteria).slice(0, 4000);
      const res = await mistralChat({
        messages: [
          { role: "system", content: `Tu es Aura, analyste expert en aide à la décision multicritère. Tu produis UNIQUEMENT les leviers d'action (DDPs) et leurs options.
→ 8 à 10 leviers réellement CONTRÔLABLES par le décideur (jamais marché, réglementation imposée, contexte macro).
→ 4 à 5 options concrètes par levier, nommées avec le vocabulaire réel du domaine ; marque "exploratoire": true sur une option latérale crédible pour un ou deux leviers.
→ type parmi : budget | ressource | temps | risque | decision | technique | autre. Descriptions ≤ 15 mots.
→ Réponds UNIQUEMENT en JSON valide : {"leviers":[{"id":"lev_1","label":"...","type":"decision","options":[{"id":"opt_1_1","label":"...","justification":"..."}]}]} — sans commentaire, sans virgule traînante.` },
          { role: "user", content: `Problème décisionnel : ${data.context}${elicitCtx}${data.companyContext ?? ""}
Type : ${data.problemType}
Arbre de critères déjà produit (les leviers doivent influencer ces TPM) :
${tpmLabels}

Générer maintenant le JSON des leviers et options.` },
        ],
        guardrails: ["verite", "profondeur", "originalite", "controle"],
        maxTokens: 4000,
        temperature: 0.25,
      });
      if (!res.ok) return null;
      try {
        const parsed = extractJson(res.content) as { leviers?: GeneratedFullModel["leviers"] };
        const lev = (parsed.leviers ?? []).filter(l => l?.options?.length);
        return lev.length ? lev : null;
      } catch { return null; }
    }

    // Le modèle complet est volumineux : une première réponse tronquée ou mal
    // formée est fréquente. On réessaie automatiquement (au lieu d'exiger de
    // l'utilisateur qu'il relance lui-même), avec un cadrage plus compact à
    // chaque tentative, puis en dernier recours on complète les leviers seuls.
    const hints = [
      "",
      "\n\n⚠️ TENTATIVE 2 — CONTRAINTE DE COMPACITÉ : livre 3 MOE, 2 MOP par MOE, 2 TPM par MOP, 6 leviers, 3 options par levier. Descriptions ≤ 12 mots. Le JSON DOIT être complet et refermé : les leviers et leurs options sont obligatoires.",
      "\n\n⚠️ TENTATIVE 3 — PRIORITÉ ABSOLUE AUX LEVIERS : livre 3 MOE, 2 MOP par MOE, 1 TPM par MOP, 6 leviers, 3 options par levier. Supprime tous les champs de description (garde uniquement id, label, importance, nature, type). Le JSON DOIT être complet et refermé.",
    ];
    let lastErr = "";
    for (let i = 0; i < hints.length; i++) {
      const r = await callModel(hints[i], i === 0 ? 18000 : 9000);
      if (!r.ok) { lastErr = `appel LLM échoué (${r.error})`; continue; }
      let j: GeneratedFullModel;
      try {
        j = extractJson(r.content) as GeneratedFullModel;
      } catch (e) {
        lastErr = `réponse illisible (${(e as Error).message})`;
        continue;
      }
      if (!j.criteria?.length) { lastErr = "réponse sans critères exploitables"; continue; }
      const leviersOk = !!j.leviers?.length && j.leviers.every(l => l.options?.length);
      if (leviersOk) return j;
      // Critères valides mais leviers manquants/incomplets : on les régénère seuls
      // plutôt que de perdre l'arbre déjà produit.
      const repaired = await generateLeviersOnly(j.criteria);
      if (repaired) return { ...j, leviers: repaired };
      lastErr = "réponse sans leviers exploitables (probablement tronquée)";
    }
    // IMPORTANT : ne jamais retourner silencieusement un modèle générique de repli
    // ici — l'appelant doit savoir que la génération a échoué.
    throw new Error(`generateFullModel: ${lastErr}`);
  });

// ─── 2b. Legacy — kept for "Proposer une décomposition" button ────────────────

export const generateCriteria = createServerFn({ method: "POST" })
  .validator((d: { context: string; problemType: string; dimensions: string[] }) => d)
  .handler(async ({ data }): Promise<Array<{ id: string; label: string; poids: number; description: string }>> => {
    const m = await generateFullModel({ data });
    return m.criteria.map((o, i) => ({ id: o.id, label: o.label, poids: Math.round(100 / m.criteria.length), description: o.description }));
  });

// ─── 3. Generate scenarios ────────────────────────────────────────────────────

export interface GeneratedScenario {
  id: string;
  label: string;
  color: string;
  description: string;
  leviers: Array<{ id: string; label: string; valeur: string; impact: "+" | "-" | "~" }>;
  valeur: number;       // 0–100
  faisabilite: number;  // 0–100
}

export const generateScenarios = createServerFn({ method: "POST" })
  .validator((d: { context: string; problemType: string; criteriaLabels: string[]; companyContext?: string }) => d)
  .handler(async ({ data }): Promise<GeneratedScenario[]> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura, assistant décisionnel expert. Génère 3 scénarios décisionnels distincts (prudent, équilibré, ambitieux). Réponds UNIQUEMENT en JSON valide.
Format : {"scenarios":[{"id":"s0","label":"Prudent","color":"#6b7280","description":"...","leviers":[{"id":"l1","label":"Budget","valeur":"500K€","impact":"+"}],"valeur":45,"faisabilite":75},...]}.
valeur et faisabilite sont des scores 0-100. impact doit être "+", "-" ou "~".${data.companyContext ?? ""}`,
        },
        {
          role: "user",
          content: `Décision : ${data.context}\nType : ${data.problemType}\nCritères à évaluer : ${data.criteriaLabels.join(", ")}`,
        },
      ],
      guardrails: ["verite", "profondeur", "originalite", "controle"],
      maxTokens: 900,
      temperature: 0.4,
    });
    if (!r.ok) return defaultScenarios();
    try {
      const j = extractJson(r.content) as { scenarios: GeneratedScenario[] };
      return (j.scenarios ?? defaultScenarios()).map((s, i) => ({
        ...s,
        color: s.color ?? ["#6b7280", "#6366f1", "#10b981"][i] ?? "#6366f1",
      }));
    } catch {
      return defaultScenarios();
    }
  });

function defaultScenarios(): GeneratedScenario[] {
  return [
    { id: "s0", label: "Prudent", color: "#6b7280", description: "Approche conservatrice, risque minimal", leviers: [{ id: "l1", label: "Investissement", valeur: "Minimal", impact: "-" }], valeur: 40, faisabilite: 80 },
    { id: "s1", label: "Équilibré", color: "#6366f1", description: "Compromis valeur-risque optimal", leviers: [{ id: "l1", label: "Investissement", valeur: "Modéré", impact: "~" }], valeur: 65, faisabilite: 65 },
    { id: "s2", label: "Ambitieux", color: "#10b981", description: "Transformation accélérée, impact maximal", leviers: [{ id: "l1", label: "Investissement", valeur: "Élevé", impact: "+" }], valeur: 85, faisabilite: 45 },
  ];
}

// ─── 4. Motivate recommendation ───────────────────────────────────────────────

export const motivateRecommendation = createServerFn({ method: "POST" })
  .validator((d: { context: string; scenarios: Array<{ label: string; potentiel?: string; risque?: string; valeur?: number; faisabilite?: number }>; bestLabel: string }) => d)
  .handler(async ({ data }): Promise<{ recommendation: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const scenarioDesc = data.scenarios.map(s =>
      `${s.label}: potentiel=${s.potentiel ?? "—"}, risque=${s.risque ?? "—"}`
    ).join(" | ");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura, assistant décisionnel expert. Rédige une recommandation motivée, professionnelle et concise (4-6 phrases) en français. IMPORTANT : n'utilise JAMAIS de pourcentages, chiffres ou notes numériques — uniquement des qualificatifs ordinaux (Nul, Limité, Modéré, Élevé, fort, faible…). Réponds UNIQUEMENT en JSON : {"recommendation":"..."}`,
        },
        {
          role: "user",
          content: `Décision : ${data.context}\nScénario recommandé : ${data.bestLabel}\nComparaison ordinale : ${scenarioDesc}`,
        },
      ],
      maxTokens: 350,
      temperature: 0.3,
    });
    if (!r.ok) return { recommendation: `Le scénario "${data.bestLabel}" offre le meilleur équilibre valeur-faisabilité selon les critères définis. Il est recommandé de procéder à une validation rapide des hypothèses clés avant la mise en œuvre.` };
    try {
      return extractJson(r.content) as { recommendation: string };
    } catch {
      return { recommendation: `Le scénario "${data.bestLabel}" est recommandé sur la base des critères analysés.` };
    }
  });

// ─── 4bis. Explication à la demande d'une alternative du classement (Arbitrer) ─
// Volontairement appelée uniquement au clic (jamais au chargement de la page,
// jamais pour toutes les alternatives) : avec des centaines de milliers de
// combinaisons possibles, générer ceci pour chaque ligne du classement
// alourdirait la page pour rien — seule l'option que le décideur regarde
// mérite l'appel LLM.
export const explainAlternative = createServerFn({ method: "POST" })
  .validator((d: { context: string; label: string; potentiel: string; risque: string; improves: string[]; degrades: string[]; changes?: string[] }) => d)
  .handler(async ({ data }): Promise<{ forces: string[]; risques: string[]; autres: string[] }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura, assistant décisionnel expert. Pour l'option de décision donnée, produis une explication courte et structurée en français : ses forces réelles, ses points de vigilance (risques), et d'éventuels autres aspects structurants (dépendances, réversibilité, coût d'opportunité…). N'utilise JAMAIS de pourcentages, chiffres ou notes numériques — uniquement des qualificatifs ordinaux et des faits qualitatifs déjà donnés. Reste factuel, ne réponds qu'à partir des éléments fournis. Réponds UNIQUEMENT en JSON : {"forces":["...","..."],"risques":["...","..."],"autres":["..."]} avec au plus 3 éléments par liste (peut être vide).`,
        },
        {
          role: "user",
          content: `Décision : ${data.context}\nOption évaluée : ${data.label}\nPotentiel global : ${data.potentiel} · Risque global : ${data.risque}\nAméliore : ${data.improves.join(", ") || "—"}\nDégrade : ${data.degrades.join(", ") || "—"}${data.changes?.length ? `\nChangements de leviers proposés : ${data.changes.join(", ")}` : ""}`,
        },
      ],
      // Sortie volontairement courte (3 listes de ≤3 items) : un maxTokens réduit et
      // le mode JSON strict (moins d'aller-retours de parsing, pas de préambule ni
      // de balises markdown à trancher) suffisent et raccourcissent nettement la
      // latence perçue au clic sur "Expliquer cette option", sans perte de contenu.
      maxTokens: 220,
      temperature: 0.2,
      jsonMode: true,
    });
    // Ne jamais renvoyer un résultat "vide mais réussi" : le composant appelant
    // distingue "chargement" / "données" / "erreur" et un objet {forces:[],
    // risques:[], autres:[]} silencieux se comportait comme un succès sans rien
    // à afficher — le bouton "Expliquer" disparaissait (remplacé par rien) sans
    // aucun message, laissant croire à l'utilisateur qu'il n'a rien cliqué. Un
    // échec réel (LLM indisponible, réponse illisible) doit lever une erreur
    // pour que l'appelant affiche clairement "Explication indisponible".
    if (!r.ok) throw new Error("explainAlternative: appel LLM indisponible");
    try {
      const parsed = extractJson(r.content) as { forces?: string[]; risques?: string[]; autres?: string[] };
      const result = {
        forces: (parsed.forces ?? []).slice(0, 3),
        risques: (parsed.risques ?? []).slice(0, 3),
        autres: (parsed.autres ?? []).slice(0, 3),
      };
      if (result.forces.length === 0 && result.risques.length === 0 && result.autres.length === 0) {
        throw new Error("explainAlternative: réponse vide");
      }
      return result;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("explainAlternative:")) throw e;
      throw new Error("explainAlternative: réponse illisible");
    }
  });

// ─── 5. Free-form Aura chat in atelier context ────────────────────────────────

export const askAtelierAura = createServerFn({ method: "POST" })
  .validator((d: { userMessage: string; sessionContext: string }) => d)
  .handler(async ({ data }): Promise<{ reply: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura, assistant décisionnel Supply Chain. Pour les démonstrations connectées, la source de référence est exclusivement Maison Lucie. Tu aides à analyser une décision stratégique en cours.
Tu ne décides jamais — tu aides à décider. Réponds en français, de façon concise (3-5 phrases max), avec une perspective analytique.
Contexte de la session : ${data.sessionContext}`,
        },
        { role: "user", content: data.userMessage },
      ],
      maxTokens: 300,
      temperature: 0.4,
    });
    return { reply: r.ok ? r.content : "Je ne peux pas répondre pour l'instant. Veuillez réessayer." };
  });

// ─── 5bis. Copilote Supply Chain Resilience Agent (volet droit, Cockpit + Décision) ──────────
// Réutilise exactement le patron de askAtelierAura : même appel mistralChat,
// mêmes conventions (français, concis, jamais de fabrication de données hors
// du contexte fourni). Le contexte est soit l'alerte survolée (Cockpit), soit
// l'objectif/contexte de la session en cours (Décision).
export const askCopilot = createServerFn({ method: "POST" })
  .validator((d: { question: string; lang?: "fr" | "en"; context: { mode: "cockpit" | "decision"; alertLabel?: string; alertSignal?: string; objectif?: string; contextRaw?: string; vocabSummary?: string; pastSessionsSummary?: string; seriesSummary?: string; facts?: string; chartShown?: boolean; intent?: string } }) => d)
  .handler(async ({ data }): Promise<{ reply: string; llm: boolean }> => {
    const { mistralChat } = await import("../mistral.server");
    const c = data.context;
    const contextDesc = c.mode === "cockpit"
      ? (c.alertLabel ? `Alerte en cours de consultation : ${c.alertLabel}. Signal : ${c.alertSignal ?? "—"}` : "Aucune alerte sélectionnée — vue Cockpit générale.")
      : `Décision en cours : ${c.objectif || c.contextRaw || "aucun contexte de session renseigné"}`;
    const dataBlock = [
      c.vocabSummary ? `Données Studio actuellement raccordées (KPI, statut, règles causales déclenchées) :\n${c.vocabSummary}` : "Aucune donnée Studio n'est raccordée pour l'instant — ne pas inventer de valeur ou de règle.",
      c.seriesSummary ? `Valeurs par enregistrement source (lues dans Studio) :\n${c.seriesSummary}` : "",
      c.pastSessionsSummary ? `Décisions déjà évaluées dans Décider (historique disponible pour rejouer ou reprendre) :\n${c.pastSessionsSummary}` : "Aucune décision n'a encore été évaluée dans Décider.",
    ].join("\n\n");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura, copilote du décideur dans la Tour de contrôle Supply Chain. Tu aides à interpréter une alerte ou une décision en cours, tu raisonnes à partir des règles causales et des indicateurs réellement raccordés via Studio, et tu sais ce qui a déjà été évalué dans Décider — tu peux t'y référer et proposer de reprendre ou de rejouer une évaluation. Tu ne décides jamais à la place de l'utilisateur. ${data.lang === "en" ? "Answer in ENGLISH ONLY (even though the context below is in French: translate it), in plain, readable markdown" : "Réponds en français dans un markdown sobre et lisible"} : un constat bref, les preuves disponibles, puis une action ou une question de décision. Reste concis (3 à 6 phrases ou puces). N'invente jamais de donnée, de chiffre, de règle ou de session absente du contexte fourni ; si l'information manque, dis-le explicitement. Raisonne explicitement avec les règles causales : quelles conditions sont remplies, par quels enregistrements (cite leurs identifiants et valeurs), et ce qu'elles impliquent. Quand un graphique aide à répondre (comparaison entre enregistrements, répartition, écart aux seuils), ajoute UN bloc \`\`\`chart contenant un JSON {"type":"bar"|"line"|"pie"|"table","title":"…","subtitle":"source …","data":[{"name":"…","valeur":nombre}],"keys":["valeur"],"thresholds":[{"label":"…","value":nombre}]} construit UNIQUEMENT avec les valeurs fournies ci-dessous, jamais inventées. Sans bloc de ta part, l'interface ajoute elle-même un graphique vérifié.
Contexte (${c.mode === "cockpit" ? "mode Cockpit" : "mode Décision"}) : ${contextDesc}

${dataBlock}`,
        },
        ...(c.facts ? [{ role: "system" as const, content: `Faits vérifiés calculés par Aura à partir des données observées et des règles (à utiliser tels quels, sans rien ajouter d'autre) :\n${c.facts}\n\n${c.chartShown ? "Un graphique vérifié est déjà affiché sous ta réponse : commente-le en 2 à 4 phrases, sans produire de bloc chart." : `Réponds en texte seul (intention : ${c.intent ?? "synthèse"}), sans bloc chart.`}` }] : []),
        ...(data.lang === "en" ? [{ role: "system" as const, content: "The user interface is in English: answer in English (keep identifiers and values unchanged). Translate every French label from the context into English, including option, indicator and rule names (e.g. « Réapprovisionnement » → replenishment); only codes, identifiers and proper names stay as they are." }] : []),
        { role: "user", content: data.question },
      ],
      maxTokens: 900,
      temperature: 0.3,
    });
    return r.ok ? { reply: r.content, llm: true } : { reply: "Je ne peux pas répondre pour l'instant (modèle indisponible). Veuillez réessayer.", llm: false };
  });

// ─── 5ter. Copilote de CONFIGURATION de l'ontologie SCRA ─────────────────────
// Distinct de askCopilot ci-dessus (qui répond à des questions sur une
// alerte/décision affichée) : celui-ci accélère le PARAMÉTRAGE de
// l'ontologie — suggère un jeu d'attributs pour un objet métier, avec une
// application plausible et un nom de champ physique dans le style de cette
// application. Même patron que le reste du fichier (mistralChat, français,
// JSON strict, jamais de fabrication) :
// - l'objet métier et sa famille/alertes viennent du VRAI catalogue
//   (ontology-catalogue.ts / alert-catalogue.ts), lus ici directement ;
// - les applications proposables sont EXACTEMENT la liste réelle
//   `SOURCE_CARDS` de ControlTowerShell.tsx, transmise par l'appelant (pas
//   dupliquée ici) — le modèle ne peut choisir qu'un id de cette liste ;
// - les suggestions sont un point de départ pour l'humain (accepter/
//   modifier/rejeter côté UI, CopilotPanel.tsx) — rien n'est appliqué
//   automatiquement par cette fonction elle-même.
export const suggestOntologyConfig = createServerFn({ method: "POST" })
  .validator((d: {
    objectName: string;
    description?: string;
    existingAttributes: string[];
    sourceCards: { id: string; nom: string; type: string }[];
  }) => d)
  .handler(async ({ data }): Promise<{ suggestions: { attribut: string; applicationId: string; champGuess: string; alertesLiees: string[]; note: string }[] } | { error: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const { ONTOLOGY_CATALOGUE } = await import("./ontology-catalogue");
    const { ALERT_CATALOGUE } = await import("./alert-catalogue");
    const family = ONTOLOGY_CATALOGUE["supply-chain"].find(f => f.objetsMinimaux.includes(data.objectName));
    const relatedAlerts = family ? ALERT_CATALOGUE.filter(a => family.alertesAlimentees.includes(a.id)) : [];
    const validIds = new Set(data.sourceCards.map(s => s.id));
    const validAlertIds = new Set(relatedAlerts.map(a => a.id));
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es le copilote de configuration de l'ontologie Aura (Supply Chain Resilience Agent). Ton rôle : accélérer le paramétrage en proposant, pour un objet métier donné, un jeu d'attributs plausibles à modéliser.
Pour chaque attribut suggéré, propose : un id d'application PARMI la liste réelle fournie (jamais une application inventée, jamais hors de cette liste), un nom de champ physique plausible dans le style typique de cette application (ex. codes courts type SAP pour un ERP, camelCase pour une API REST), et — si pertinent — les IDs d'alertes PARMI la liste réelle fournie (jamais une alerte inventée) que cet attribut aide à instrumenter.
Réponds UNIQUEMENT en JSON, sans texte autour, au format : { "suggestions": [ { "attribut": string, "applicationId": string, "champGuess": string, "alertesLiees": string[], "note": string } ] }.
"note" est une phrase courte expliquant le lien avec l'alerte/le besoin, en français.
Ces suggestions sont des points de départ illustratifs que l'utilisateur accepte, modifie ou rejette une par une — elles ne sont jamais appliquées automatiquement.`,
        },
        {
          role: "user",
          content: `Objet métier : ${data.objectName}${data.description ? `\nCe que l'utilisateur essaie de modéliser : ${data.description}` : ""}
Attributs déjà définis pour cet objet : ${data.existingAttributes.length ? data.existingAttributes.join(", ") : "aucun"}
Applications disponibles — utilise UNIQUEMENT ces id : ${data.sourceCards.map(s => `${s.id} (${s.nom}, ${s.type})`).join(" · ")}
Alertes déjà rattachées à la famille ontologique de cet objet — utilise UNIQUEMENT ces IDs si pertinent, laisse "alertesLiees" vide sinon : ${relatedAlerts.map(a => `${a.id} — ${a.label}`).join(" · ") || "aucune"}
Propose 3 à 6 attributs, en évitant ceux déjà définis.`,
        },
      ],
      maxTokens: 900,
      temperature: 0.3,
    });
    if (!r.ok) return { error: "L'appel au modèle a échoué (réseau ou service indisponible). Réessayez plus tard." };
    try {
      const parsed = extractJson(r.content) as { suggestions?: { attribut: string; applicationId: string; champGuess: string; alertesLiees: string[]; note: string }[] };
      const suggestions = (parsed.suggestions ?? [])
        .filter(s => s && typeof s.attribut === "string" && validIds.has(s.applicationId))
        .map(s => ({ ...s, alertesLiees: (s.alertesLiees ?? []).filter(id => validAlertIds.has(id)) }));
      return { suggestions };
    } catch {
      return { error: "Réponse du modèle invalide (JSON non exploitable)." };
    }
  });

// ─── 6. Levier insight (debounced, called on levier change) ──────────────────

export const getLevierInsight = createServerFn({ method: "POST" })
  .validator((d: { scenarioLabel: string; levierLabel: string; valeur: string; context: string }) => d)
  .handler(async ({ data }): Promise<{ insight: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura. Donne une insight analytique très courte (1-2 phrases max) sur la valeur d'un levier dans un scénario décisionnel. Réponds en JSON : {"insight":"..."}`,
        },
        {
          role: "user",
          content: `Scénario: ${data.scenarioLabel} | Levier: ${data.levierLabel} = "${data.valeur}" | Contexte: ${data.context}`,
        },
      ],
      guardrails: ["verite", "profondeur", "originalite", "controle"],
      maxTokens: 120,
      temperature: 0.3,
    });
    if (!r.ok) return { insight: "" };
    try { return extractJson(r.content) as { insight: string }; }
    catch { return { insight: r.content.slice(0, 150) }; }
  });

// ─── 7. Generate discriminating questions (adaptive, post-model) ──────────────

export interface DiscriminatingQuestion {
  id: string;
  question: string;
  rationale: string;
  choices: Array<{ id: string; label: string }>;
}

export const generateDiscriminatingQuestions = createServerFn({ method: "POST" })
  .validator((d: {
    context: string;
    problemType: string;
    criteriaLabels: string[];
    levierLabels: string[];
    companyContext?: string;
    domainExpertiseHint?: string;
  }) => d)
  .handler(async ({ data }): Promise<DiscriminatingQuestion[]> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura, assistant décisionnel. Un modèle décisionnel vient d'être généré pour une décision. Tu dois identifier 3 à 5 informations manquantes qui, si connues, changeraient l'arbitrage entre les options.

Pour chaque information manquante, formule une question fermée courte avec 3 à 4 choix. Les questions doivent être directement liées aux critères et leviers du modèle généré — pas de questions génériques.

Format JSON :
{
  "questions": [
    {
      "id": "q1",
      "question": "Question courte et précise ?",
      "rationale": "Impacte le poids du critère X ou le choix du levier Y",
      "choices": [
        { "id": "q1_a", "label": "Choix A" },
        { "id": "q1_b", "label": "Choix B" },
        { "id": "q1_c", "label": "Choix C" }
      ]
    }
  ]
}

Réponds UNIQUEMENT en JSON valide.${data.domainExpertiseHint ? scResilienceCompactHint(data.domainExpertiseHint) : ""}`,
        },
        {
          role: "user",
          content: `Décision : ${data.context}
Type : ${data.problemType}
Critères générés : ${data.criteriaLabels.join(", ")}
Leviers générés : ${data.levierLabels.join(", ")}${data.companyContext ?? ""}

Quelles informations manquantes changeraient l'arbitrage ?`,
        },
      ],
      guardrails: ["verite", "profondeur", "originalite", "controle"],
      maxTokens: 800,
      temperature: 0.3,
    });
    if (!r.ok) return defaultDiscriminatingQuestions(data.context, data.levierLabels, data.criteriaLabels);
    try {
      const j = extractJson(r.content) as { questions: DiscriminatingQuestion[] };
      const qs = (j.questions ?? []).slice(0, 5);
      return qs.length ? qs : defaultDiscriminatingQuestions(data.context, data.levierLabels, data.criteriaLabels);
    } catch {
      return defaultDiscriminatingQuestions(data.context, data.levierLabels, data.criteriaLabels);
    }
  });

// ── Standard answer sets — same question type always gets the same choices ──────
const STD_CHOICES = {
  delai:      [{ id: "d_a", label: "< 3 mois" }, { id: "d_b", label: "3–6 mois" }, { id: "d_c", label: "6–18 mois" }, { id: "d_d", label: "> 18 mois" }],
  budget:     [{ id: "b_a", label: "< 100 K€" }, { id: "b_b", label: "100 K€ – 500 K€" }, { id: "b_c", label: "500 K€ – 5 M€" }, { id: "b_d", label: "> 5 M€" }],
  maturite:   [{ id: "m_a", label: "Déjà maîtrisé en interne" }, { id: "m_b", label: "Partiellement maîtrisé" }, { id: "m_c", label: "À acquérir / former" }, { id: "m_d", label: "À externaliser" }],
  conformite: [{ id: "c_a", label: "Oui, déjà conforme" }, { id: "c_b", label: "En cours de mise en conformité" }, { id: "c_c", label: "Non, effort significatif requis" }],
  risque:     [{ id: "r_a", label: "Risque minimal acceptable" }, { id: "r_b", label: "Risque modéré toléré" }, { id: "r_c", label: "Risque élevé acceptable si ROI suffisant" }],
  priorite:   [{ id: "p_a", label: "Croissance / conquête" }, { id: "p_b", label: "Maîtrise des risques" }, { id: "p_c", label: "Rentabilité immédiate" }, { id: "p_d", label: "Équilibre" }],
  marche:     [{ id: "k_a", label: "Urgence forte — concurrents actifs" }, { id: "k_b", label: "Pression modérée" }, { id: "k_c", label: "Pas d'urgence marché" }],
  perf:       [{ id: "f_a", label: "Niveau industriel / critique" }, { id: "f_b", label: "Standard marché" }, { id: "f_c", label: "Acceptable / MVP" }],
};

type QType = keyof typeof STD_CHOICES;

// Detect semantic type from a label string
function detectType(label: string): QType | null {
  const l = label.toLowerCase();
  if (/délai|temps|calendrier|planning|livraison|mise en prod|time.to|horizon/.test(l)) return "delai";
  if (/budget|coût|coût|invest|financi|enveloppe|capex|opex|prix|tarif/.test(l)) return "budget";
  if (/compétence|ressource|équipe|expertise|maîtrise|savoir.faire|formation|rh|effectif/.test(l)) return "maturite";
  if (/conformité|norme|iso|réglementaire|certif|homologat|légal|rgpd|gdpr/.test(l)) return "conformite";
  if (/risque|fiabilité|sécurité|sûreté|criticité|défaillance|résilience/.test(l)) return "risque";
  if (/priorité|alignement|stratégie|objectif|vision|mission/.test(l)) return "priorite";
  if (/marché|client|concurrent|positionnement|part de marché|croissance|acquisition/.test(l)) return "marche";
  if (/performance|qualité|fiabilité|disponibilité|maintenabilité|robustesse|efficacité/.test(l)) return "perf";
  return null;
}

function makeQuestion(id: string, type: QType, label: string): DiscriminatingQuestion {
  const choices = STD_CHOICES[type].map(c => ({ ...c, id: `${id}_${c.id}` }));
  const question = {
    delai:      `Quel est le délai cible pour "${label}" ?`,
    budget:     `Quelle enveloppe budgétaire pour "${label}" ?`,
    maturite:   `Où en êtes-vous sur "${label}" en interne ?`,
    conformite: `Êtes-vous déjà conforme à "${label}" ?`,
    risque:     `Quel niveau de risque est acceptable sur "${label}" ?`,
    priorite:   `Quelle est la priorité de "${label}" dans votre décision ?`,
    marche:     `Quelle est la pression marché sur "${label}" ?`,
    perf:       `Quel niveau de "${label}" est requis ?`,
  }[type];
  const rationale = {
    delai:      "Oriente le poids du critère time-to-value vs qualité",
    budget:     "Conditionne directement les options de leviers financiers",
    maturite:   "Pèse sur la faisabilité et le délai d'exécution",
    conformite: "Modifie l'effort et le risque d'une option vs une autre",
    risque:     "Calibre le profil d'attitude (prudent vs ambitieux) pour ce critère",
    priorite:   "Rééquilibre les poids entre critères valeur / risque / délai",
    marche:     "Modifie le poids du time-to-market face à la qualité",
    perf:       "Discrimine les options selon leur niveau d'exigence requis",
  }[type];
  return { id, question, rationale, choices };
}

function defaultDiscriminatingQuestions(_context: string, levierLabels: string[], criteriaLabels: string[] = []): DiscriminatingQuestion[] {
  const seen = new Set<QType>();
  const qs: DiscriminatingQuestion[] = [];

  // Scan criteria labels first (more specific), then lever labels
  for (const label of [...criteriaLabels, ...levierLabels]) {
    if (qs.length >= 5) break;
    const type = detectType(label);
    if (!type || seen.has(type)) continue;
    seen.add(type);
    qs.push(makeQuestion(`dq_${type}`, type, label));
  }

  // Always ensure a priority question exists
  if (!seen.has("priorite") && qs.length < 5) {
    seen.add("priorite");
    qs.push(makeQuestion("dq_priorite", "priorite", "cette décision"));
  }

  // Always ensure a délai question exists
  if (!seen.has("delai") && qs.length < 5) {
    seen.add("delai");
    qs.push(makeQuestion("dq_delai", "delai", "la mise en œuvre"));
  }

  return qs.slice(0, 5);
}

// ─── 6. Generate OKR + KPI + baseline after decision validation ───────────────

export interface OKRKeyResult {
  id: string;
  label: string;       // ex. "Réduire le délai de livraison de 15 jours à 8 jours"
  kpi: string;         // ex. "Délai moyen de livraison (jours)"
  baseline: string;    // ex. "15 jours (Q3 2024)"
  target: string;      // ex. "8 jours"
  deadline: string;    // ex. "Q4 2025"
}

export interface OKRObjective {
  id: string;
  objective: string;   // ex. "Améliorer la performance opérationnelle de la chaîne d'approvisionnement"
  horizon: string;     // ex. "12 mois"
  keyResults: OKRKeyResult[];
}

export interface GeneratedOKR {
  objectives: OKRObjective[];
  nextSteps: string[];  // 3-4 immediate actions
}

export const generateOKR = createServerFn({ method: "POST" })
  .validator((d: {
    decisionTitle: string;
    scenarioLabel: string;
    scenarioDescription: string;
    problemType: string;
    atouts: string[];       // top criteria where best scenario excels
    leviers: string[];      // levers in the retained scenario
    companyContext?: string;
  }) => d)
  .handler(async ({ data }): Promise<GeneratedOKR> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura, assistant décisionnel expert en OKR et pilotage stratégique.
À partir d'une décision validée, génère un cadre OKR (Objectives & Key Results) opérationnel.

Format JSON attendu :
{
  "objectives": [
    {
      "id": "okr_1",
      "objective": "Libellé ambitieux de l'objectif stratégique",
      "horizon": "12 mois",
      "keyResults": [
        {
          "id": "kr_1_1",
          "label": "Description mesurable du résultat clé",
          "kpi": "Nom de l'indicateur de performance",
          "baseline": "Valeur actuelle connue ou estimée",
          "target": "Valeur cible",
          "deadline": "Q1 2026"
        }
      ]
    }
  ],
  "nextSteps": ["Action immédiate 1", "Action immédiate 2", "Action immédiate 3"]
}

Règles :
- 2-3 objectifs stratégiques cohérents avec la décision et le type de problème
- 2-3 Key Results par objectif, mesurables et datés
- KPI explicite et chiffrable (ratio, durée, montant, %)
- Baseline réaliste (à partir du contexte ou estimée)
- 3-4 prochaines étapes immédiates actionnables (J+30)
- Réponds UNIQUEMENT en JSON valide, sans commentaire${data.companyContext ?? ""}`,
        },
        {
          role: "user",
          content: `Décision : ${data.decisionTitle}
Type : ${data.problemType}
Scénario retenu : ${data.scenarioLabel} — ${data.scenarioDescription}
Atouts clés : ${data.atouts.join(", ")}
Leviers activés : ${data.leviers.join(", ")}`,
        },
      ],
      guardrails: ["verite", "profondeur", "originalite", "controle"],
      maxTokens: 1200,
      temperature: 0.25,
    });

    if (!r.ok) return defaultOKR(data.decisionTitle, data.scenarioLabel, data.leviers);
    try {
      return extractJson(r.content) as GeneratedOKR;
    } catch {
      return defaultOKR(data.decisionTitle, data.scenarioLabel, data.leviers);
    }
  });

function defaultOKR(title: string, scenario: string, leviers: string[]): GeneratedOKR {
  return {
    objectives: [
      {
        id: "okr_1",
        objective: `Réussir la mise en œuvre de : ${scenario}`,
        horizon: "12 mois",
        keyResults: [
          {
            id: "kr_1_1",
            label: `Déployer ${leviers[0] ?? "le premier levier"} dans les délais planifiés`,
            kpi: "Avancement déploiement (%)",
            baseline: "0%",
            target: "100%",
            deadline: "Q2 2025",
          },
          {
            id: "kr_1_2",
            label: "Atteindre le niveau de performance cible sur les indicateurs prioritaires",
            kpi: "Score multicritère (0-100)",
            baseline: "Niveau actuel",
            target: "+30%",
            deadline: "Q4 2025",
          },
        ],
      },
      {
        id: "okr_2",
        objective: `Sécuriser et piloter les risques liés à : ${title}`,
        horizon: "6 mois",
        keyResults: [
          {
            id: "kr_2_1",
            label: "Mettre en place un tableau de bord de suivi avec revues mensuelles",
            kpi: "Nombre de KPI suivis en temps réel",
            baseline: "0",
            target: `${Math.max(3, leviers.length)}`,
            deadline: "Q1 2025",
          },
        ],
      },
    ],
    nextSteps: [
      "Nommer un sponsor exécutif et un responsable de pilotage de la décision",
      `Lancer le chantier "${leviers[0] ?? "premier levier"}" avec une équipe dédiée (J+7)`,
      "Définir les KPI de suivi et mettre en place le reporting mensuel (J+14)",
      "Organiser une revue de lancement avec toutes les parties prenantes (J+30)",
    ],
  };
}

// ─── 9b. Generate concrete actions to achieve a Key Result ───────────────────

export interface KRAction {
  id: string;
  label: string;        // concise action title
  who: string;          // responsible party / role
  when: string;         // timing (e.g. "J+7", "Mois 1-2", "Q1 2026")
  effort: "Faible" | "Moyen" | "Élevé";
  impact: "Faible" | "Moyen" | "Élevé";
}

export const generateKRActionsForKR = createServerFn({ method: "POST" })
  .validator((d: {
    decisionTitle: string;
    objective: string;
    kr: { label: string; kpi: string; baseline: string; target: string; deadline: string };
    context?: string;
  }) => d)
  .handler(async ({ data }): Promise<{ actions: KRAction[] }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura, assistant décisionnel expert en pilotage opérationnel.
Pour un Key Result donné, génère 4 à 6 actions concrètes et actionnables qui permettront de l'atteindre.
Format JSON attendu :
{
  "actions": [
    {
      "id": "a1",
      "label": "Action courte et précise",
      "who": "Responsable / Rôle",
      "when": "J+7 / Mois 1 / Q1 2026",
      "effort": "Faible|Moyen|Élevé",
      "impact": "Faible|Moyen|Élevé"
    }
  ]
}
Règles : actions opérationnelles et séquencées, responsable nommé, délai réaliste, effort et impact évalués.
N'utilise JAMAIS de pourcentages ou chiffres dans les libellés d'effort/impact — uniquement Faible/Moyen/Élevé.
Réponds UNIQUEMENT en JSON valide.`,
        },
        {
          role: "user",
          content: `Décision : ${data.decisionTitle}
Objectif : ${data.objective}
Key Result : ${data.kr.label}
KPI : ${data.kr.kpi} | Baseline : ${data.kr.baseline} | Cible : ${data.kr.target} | Échéance : ${data.kr.deadline}${data.context ? `\nContexte : ${data.context}` : ""}`,
        },
      ],
      guardrails: ["verite", "profondeur", "originalite", "controle"],
      maxTokens: 800,
      temperature: 0.3,
    });
    if (!r.ok) return { actions: [] };
    try { return extractJson(r.content) as { actions: KRAction[] }; }
    catch { return { actions: [] }; }
  });

// ─── 9. Suggest impacts for levier options × criteria ────────────────────────

export const suggestImpacts = createServerFn({ method: "POST" })
  .validator((d: {
    context: string;
    levers: Array<{ id: string; label: string; options: Array<{ id: string; label: string }> }>;
    criteria: Array<{ id: string; label: string }>;
  }) => d)
  .handler(async ({ data }): Promise<Record<string, Record<string, string>>> => {
    const { mistralChat } = await import("../mistral.server");
    const impactVocab = '"++" amélioration forte, "+" amélioration, "0" neutre, "-" dégradation, "--" dégradation forte';
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura, assistant décisionnel. Pour chaque option de levier, évalue son impact sur chaque critère décisionnel.
Vocabulaire d'impact : ${impactVocab}.
Réponds UNIQUEMENT en JSON : { "<optionId>": { "<criteriaId>": "<impact>", ... }, ... }
Sois réaliste et précis — un levier budget n'affecte pas les critères techniques de la même façon.`,
        },
        {
          role: "user",
          content: `Contexte : ${data.context}

Leviers et options :
${data.levers.map(l => `• ${l.label}:\n${l.options.map(o => `  - ${o.id}: "${o.label}"`).join("\n")}`).join("\n")}

Critères à évaluer :
${data.criteria.map(c => `• ${c.id}: ${c.label}`).join("\n")}

Génère le JSON d'impacts.`,
        },
      ],
      guardrails: ["verite", "profondeur", "controle"],
      maxTokens: 1200,
      temperature: 0.2,
    });
    if (!r.ok) return {};
    try {
      return extractJson(r.content) as Record<string, Record<string, string>>;
    } catch {
      return {};
    }
  });

// ─── 9. Generate OKR action plan per KR via Mistral ─────────────────────────

export interface KRAction {
  label: string;
  responsable: string;
  horizon: string;
  risque: string;
}
export interface KRActionResult {
  krId: string;
  actions: KRAction[];
}

export const generateKRActions = createServerFn({ method: "POST" })
  .validator((d: {
    decisionContext: string;
    bestScenario: string;
    krs: Array<{ krId: string; objectif: string; keyResult: string }>;
  }) => d)
  .handler(async ({ data }): Promise<KRActionResult[]> => {
    const { mistralChat } = await import("../mistral.server");
    const results: KRActionResult[] = [];
    for (const kr of data.krs) {
      const r = await mistralChat({
        messages: [
          {
            role: "system",
            content: `Tu es Aura, assistant décisionnel expert. Pour un Key Result donné, génère 2 à 3 actions concrètes et actionnables qui permettront de l'atteindre.
Chaque action doit avoir : un intitulé court et précis (max 10 mots), un rôle responsable (ex: DG, DAF, DRH, DSI, Dir. Commercial), un horizon temporel (J+30, J+60, J+90, J+180), et un risque d'exécution en une courte phrase.
Réponds UNIQUEMENT en JSON valide : { "actions": [ { "label": "...", "responsable": "...", "horizon": "...", "risque": "..." } ] }`,
          },
          {
            role: "user",
            content: `Contexte décision : ${data.decisionContext}
Scénario retenu : ${data.bestScenario}
Objectif stratégique : ${kr.objectif}
Key Result : ${kr.keyResult}

Génère 2-3 actions pour atteindre ce KR.`,
          },
        ],
        maxTokens: 400,
        temperature: 0,
      });
      if (r.ok) {
        try {
          const j = extractJson(r.content) as { actions: KRAction[] };
          results.push({ krId: kr.krId, actions: (j.actions ?? []).slice(0, 3) });
        } catch {
          results.push({ krId: kr.krId, actions: [] });
        }
      } else {
        results.push({ krId: kr.krId, actions: [] });
      }
    }
    return results;
  });

// ─── Architect LLM functions ───────────────────────────────────────────────

// Types shared with architect components
export interface BPMNLane {
  actor: string;
  steps: Array<{ id: string; label: string; type: "task" | "gateway" | "start" | "end"; next?: string[]; condition?: string }>;
}
export interface BPMNProcess { id: string; name: string; lanes: BPMNLane[]; flows: Array<{ from: string; to: string; label?: string }>; }

export const generateBPMNProcess = createServerFn({ method: "POST" })
  .validator((d: { projectContext: string; processName: string; actors: string[] }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; process?: BPMNProcess; error?: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        { role: "system", content: `Tu es un expert en modélisation de processus métier BPMN et transformation digitale. Génère un processus BPMN structuré en swimlanes par acteur, basé sur le contexte fourni. Réponds UNIQUEMENT en JSON valide sans markdown ni commentaires.` },
        { role: "user", content: `Contexte transformation : ${data.projectContext}\nProcessus à modéliser : ${data.processName}\nActeurs impliqués : ${data.actors.join(", ")}\n\nGénère un processus BPMN avec 3-5 acteurs et 4-8 étapes par acteur. Format JSON : { "id": "...", "name": "...", "lanes": [ { "actor": "Nom acteur", "steps": [ { "id": "s1", "label": "Action concrète", "type": "task|gateway|start|end", "next": ["s2"], "condition": "si applicable" } ] } ], "flows": [ { "from": "acteur1.s1", "to": "acteur2.s2", "label": "Déclencheur optionnel" } ] }` },
      ],
      maxTokens: 1200,
      temperature: 0,
    });
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const j = extractJson(r.content) as BPMNProcess;
      return { ok: true, process: j };
    } catch {
      return { ok: false, error: "JSON parse error" };
    }
  });

export interface EnrichedFlow { id: string; from: string; to: string; label: string; protocol: string; enabler: string; volumetrie: string; sla: string; criticite: "Critique" | "Standard" | "Batch"; statut: "Existant" | "Nouveau" | "À moderniser"; bcL3?: string; }

export const generateEnrichedFlows = createServerFn({ method: "POST" })
  .validator((d: { projectContext: string; apps: string[]; enablers: string[]; bcL3s: string[] }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; flows?: EnrichedFlow[]; error?: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        { role: "system", content: `Tu es un architecte d'intégration SI expert. Génère des flux inter-applicatifs détaillés et réalistes depuis le contexte de transformation. Chaque flux doit avoir des attributs complets. Réponds UNIQUEMENT en JSON valide.` },
        { role: "user", content: `Contexte : ${data.projectContext}\nApplications : ${data.apps.join(", ")}\nEnabler technologiques disponibles : ${data.enablers.join(", ") || "Kafka, API Gateway, REST direct"}\nCapabilities L3 couvertes : ${data.bcL3s.join(", ") || "non spécifié"}\n\nGénère 5-8 flux inter-applicatifs. JSON : { "flows": [ { "id": "F001", "from": "AppSource", "to": "AppCible", "label": "Nom du flux", "protocol": "REST|AMQP|gRPC|SOAP|Kafka|FTP", "enabler": "nom enabler utilisé", "volumetrie": "50k msg/jour", "sla": "< 200ms P99", "criticite": "Critique|Standard|Batch", "statut": "Existant|Nouveau|À moderniser", "bcL3": "identifiant BC L3 porté" } ] }` },
      ],
      maxTokens: 1200,
      temperature: 0,
    });
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const j = extractJson(r.content) as { flows: EnrichedFlow[] };
      return { ok: true, flows: j.flows ?? [] };
    } catch {
      return { ok: false, error: "JSON parse error" };
    }
  });

export interface DataEntity { id: string; name: string; masterL3: string; attributes: string[]; sovereign: "France" | "EU" | "Global"; mdmStrategy: "Golden Record" | "Reference Data" | "Transactional"; consumers: string[]; }
export interface DataPlatformLayer { name: string; tools: string[]; description: string; }

export const generateDataArchitecture = createServerFn({ method: "POST" })
  .validator((d: { projectContext: string; businessObjects: Array<{ label: string; masterL3: string }>; apps: string[] }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; entities?: DataEntity[]; layers?: DataPlatformLayer[]; error?: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        { role: "system", content: `Tu es un architecte data expert (MDM, Data Platform, Data Governance). Génère une architecture data complète depuis les objets métier et le contexte de transformation. Réponds UNIQUEMENT en JSON valide.` },
        { role: "user", content: `Contexte : ${data.projectContext}\nObjets métier maîtres : ${data.businessObjects.map(b => `${b.label} (maître: ${b.masterL3})`).join(", ")}\nApplications : ${data.apps.join(", ")}\n\nGénère: 1) Entités de données avec leur master L3, attributs clés, souveraineté RGPD, stratégie MDM et consommateurs. 2) Couches de la Data Platform (Ingestion, Storage, Processing, Serving, Governance). Format JSON : { "entities": [ { "id": "E001", "name": "Nom entité", "masterL3": "BC L3 responsable", "attributes": ["attr1", "attr2"], "sovereign": "France|EU|Global", "mdmStrategy": "Golden Record|Reference Data|Transactional", "consumers": ["App1", "App2"] } ], "layers": [ { "name": "Ingestion", "tools": ["Airbyte", "Kafka Connect"], "description": "..." } ] }` },
      ],
      maxTokens: 1400,
      temperature: 0,
    });
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const j = extractJson(r.content) as { entities: DataEntity[]; layers: DataPlatformLayer[] };
      return { ok: true, entities: j.entities ?? [], layers: j.layers ?? [] };
    } catch {
      return { ok: false, error: "JSON parse error" };
    }
  });

export interface TransitionState { id: string; label: string; period: string; theme: string; apps: Array<{ id: string; label: string; status: "Legacy" | "En cours" | "Nouveau" | "Décommissionné" }>; keyDecisions: string[]; risks: string[]; }

export const generateTransitionArchitecture = createServerFn({ method: "POST" })
  .validator((d: { projectContext: string; appsAsIs: string[]; appsToBe: string[]; bcAssessments: string; horizons: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; states?: TransitionState[]; error?: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        { role: "system", content: `Tu es un architecte SI expert en architecture de transition et migration progressive. Génère les états intermédiaires de l'architecture (AS-IS → Step 1 → Step 2 → TO-BE) depuis le contexte. Réponds UNIQUEMENT en JSON valide.` },
        { role: "user", content: `Contexte : ${data.projectContext}\nApps AS-IS : ${data.appsAsIs.join(", ")}\nApps TO-BE : ${data.appsToBe.join(", ")}\nAssessment BC L3 : ${data.bcAssessments}\nHorizons : ${data.horizons}\n\nGénère 3-4 états de transition (AS-IS, Step 1, Step 2, TO-BE). Pour chaque état : période, thème stratégique, état de chaque application (Legacy/En cours/Nouveau/Décommissionné), décisions clés prises, risques identifiés. JSON : { "states": [ { "id": "AS-IS", "label": "Architecture Actuelle", "period": "Aujourd'hui", "theme": "...", "apps": [ { "id": "app-ecc", "label": "SAP ECC 6.0", "status": "Legacy" } ], "keyDecisions": ["..."], "risks": ["..."] } ] }` },
      ],
      maxTokens: 1400,
      temperature: 0,
    });
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const j = extractJson(r.content) as { states: TransitionState[] };
      return { ok: true, states: j.states ?? [] };
    } catch {
      return { ok: false, error: "JSON parse error" };
    }
  });

export interface TraceabilityRow { enjeuId: string; enjeuLabel: string; okr: string; bcL3: string; exigenceId: string; exigenceLabel: string; epicId: string; epicLabel: string; featureLabel: string; userStory: string; acceptance: string[]; }

export const generateTraceabilityMatrix = createServerFn({ method: "POST" })
  .validator((d: { projectContext: string; enjeux: string; bcAssessments: string; exigences: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; rows?: TraceabilityRow[]; error?: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        { role: "system", content: `Tu es un architecte d'entreprise et product owner expert. Génère une matrice de traçabilité complète Enjeu → OKR → BC L3 → Exigence → Epic → Feature → User Story avec critères d'acceptance. Réponds UNIQUEMENT en JSON valide.` },
        { role: "user", content: `Contexte : ${data.projectContext}\nEnjeux : ${data.enjeux}\nAssessment BC L3 : ${data.bcAssessments}\nExigences existantes : ${data.exigences}\n\nGénère 5-8 lignes de traçabilité. Format JSON : { "rows": [ { "enjeuId": "E1", "enjeuLabel": "...", "okr": "KR1: ...", "bcL3": "BC L3 concerné", "exigenceId": "FR-001", "exigenceLabel": "...", "epicId": "E-001", "epicLabel": "...", "featureLabel": "Nom feature", "userStory": "En tant que [rôle], je veux [action] afin de [bénéfice]", "acceptance": ["Critère 1", "Critère 2", "Critère 3"] } ] }` },
      ],
      maxTokens: 1600,
      temperature: 0,
    });
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const j = extractJson(r.content) as { rows: TraceabilityRow[] };
      return { ok: true, rows: j.rows ?? [] };
    } catch {
      return { ok: false, error: "JSON parse error" };
    }
  });

export interface ADREntry { id: string; title: string; status: "Proposé" | "Accepté" | "Rejeté" | "Déprécié"; bcL3: string; context: string; decision: string; consequences: string[]; alternatives: string[]; date: string; }

export const generateADRsForBC = createServerFn({ method: "POST" })
  .validator((d: { projectContext: string; bcAssessments: string; enablers: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; adrs?: ADREntry[]; error?: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        { role: "system", content: `Tu es un architecte principal expert en Architecture Decision Records (ADR - format MADR). Génère des ADRs pertinents liés aux choix d'architecture pour les BC L3 en changement. Réponds UNIQUEMENT en JSON valide.` },
        { role: "user", content: `Contexte : ${data.projectContext}\nBC L3 en changement : ${data.bcAssessments}\nEnabler retenus : ${data.enablers}\n\nGénère 4-6 ADRs pour les décisions architecturales clés (choix technologiques, patterns d'intégration, stratégies de migration). Format JSON : { "adrs": [ { "id": "ADR-001", "title": "Titre décision", "status": "Accepté", "bcL3": "BC L3 concerné", "context": "Situation qui justifie cette décision...", "decision": "Nous décidons de...", "consequences": ["Conséquence positive 1", "Contrainte 1"], "alternatives": ["Alternative écartée 1: raison"], "date": "2025-Q2" } ] }` },
      ],
      maxTokens: 1400,
      temperature: 0,
    });
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const j = extractJson(r.content) as { adrs: ADREntry[] };
      return { ok: true, adrs: j.adrs ?? [] };
    } catch {
      return { ok: false, error: "JSON parse error" };
    }
  });

export interface ArchKPI { id: string; label: string; category: "Complexité" | "Couplage" | "Dette technique" | "Agilité" | "Résilience" | "Sécurité"; asIs: string; tobe: string; delta: string; trend: "↑" | "↓" | "→"; interpretation: string; }

export const generateArchKPIs = createServerFn({ method: "POST" })
  .validator((d: { projectContext: string; appsCount: number; flowsCount: number; bcAssessments: string; enablers: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; kpis?: ArchKPI[]; error?: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        { role: "system", content: `Tu es un architecte SI expert en métriques d'architecture (fitness functions, architecture runway, technical debt). Génère des KPIs d'architecture AS-IS vs TO-BE pertinents et chiffrés depuis le contexte. Réponds UNIQUEMENT en JSON valide.` },
        { role: "user", content: `Contexte : ${data.projectContext}\nNombre d'applications AS-IS : ${data.appsCount}\nNombre de flux : ${data.flowsCount}\nBC L3 en changement : ${data.bcAssessments}\nEnabler retenus : ${data.enablers}\n\nGénère 8-10 KPIs d'architecture couvrant complexité applicative, couplage, dette technique, agilité delivery, résilience et sécurité. Format JSON : { "kpis": [ { "id": "K001", "label": "Nombre d'applications actives", "category": "Complexité", "asIs": "47 apps", "tobe": "28 apps", "delta": "-40%", "trend": "↓", "interpretation": "Réduction du portfolio par rationalisation et consolidation sur S/4HANA" } ] }` },
      ],
      maxTokens: 1200,
      temperature: 0,
    });
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const j = extractJson(r.content) as { kpis: ArchKPI[] };
      return { ok: true, kpis: j.kpis ?? [] };
    } catch {
      return { ok: false, error: "JSON parse error" };
    }
  });

// ─── Pré-remplissage du cadrage (Comprendre) depuis la description libre ────────
// Réduit le nombre de questions posées : au lieu de faire taper l'objectif, les
// décideurs, les impactés, les leviers et les risques un par un, l'IA les déduit
// de la description déjà saisie. L'utilisateur vérifie et corrige — jamais
// obligé de partir d'un champ vide s'il a déjà tout dit dans sa description.
export interface InferredElicitation {
  objectif?: string;
  horizon?: string;
  decideurs?: string;
  impactes?: string;
  resistances?: string;
  exigencesNonNeg?: string;
  leviersDDP?: string;
  contraintesDIP?: string;
  risques?: string[];
  sector?: string;
}

export const inferElicitationFromDescription = createServerFn({ method: "POST" })
  .validator((d: { description: string; caseType?: string; domainExpertiseHint?: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; result?: InferredElicitation; error?: string }> => {
    const { mistralChat } = await import("../mistral.server");
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es un analyste senior en aide à la décision. Réponds uniquement en JSON valide, en français, avec des réponses courtes (une phrase ou une liste de noms séparés par des virgules) — jamais de paragraphe. N'invente aucun fait absent de la description : un champ sans indice fiable reste vide plutôt que deviné.${data.domainExpertiseHint ? scResilienceCompactHint(data.domainExpertiseHint) : ""}`,
        },
        {
          role: "user",
          content: `Description de la décision${data.caseType ? ` (type : ${data.caseType})` : ""} :
"""
${data.description}
"""

Réponds avec ce JSON :
{
  "objectif": "ce que le décideur cherche à atteindre, mesurable si possible — sinon omettre",
  "horizon": "l'un de : < 3 mois, 3–12 mois, 1–3 ans, > 3 ans — sinon omettre",
  "decideurs": "noms de rôles séparés par des virgules, qui tranchent — sinon omettre",
  "impactes": "noms de rôles séparés par des virgules, qui subissent le résultat — sinon omettre",
  "resistances": "résistances au changement probables, courtes — sinon omettre",
  "exigencesNonNeg": "exigences non négociables si mentionnées — sinon omettre",
  "leviersDDP": "variables que le décideur contrôle réellement, séparées par des virgules — sinon omettre",
  "contraintesDIP": "facteurs de contexte imposés, non maîtrisables, séparés par des virgules — sinon omettre",
  "risques": ["0 à 4 risques d'exécution courts, si identifiables"],
  "sector": "secteur d'activité si identifiable — sinon omettre"
}`,
        },
      ],
      maxTokens: 650,
      temperature: 0.3,
      jsonMode: true,
    });
    if (!r.ok) return { ok: false, error: r.error };
    try {
      const parsed = JSON.parse(r.content) as InferredElicitation;
      return { ok: true, result: parsed };
    } catch {
      return { ok: false, error: "Réponse LLM invalide" };
    }
  });

const AUTO_FILL_IMP_TO_POIDS: Record<ImportanceBadge, number> = { Essentiel: 40, Important: 25, Secondaire: 15, Faible: 8 };

export interface AutoFilledSessionPatch {
  contextRaw: string;
  sector?: string;
  elicitation: Partial<ElicitationData>;
  problemType?: string;
  dimensions?: string[];
  playbookId?: string;
  criteria?: AtelierCriterion[];
  leviersDef?: AtelierLevierDef[];
}

// Orchestration partagée "décrire une fois → tout est prérempli" — utilisée
// par le parcours Comprendre (Décider) ET par les points d'entrée externes
// vers une décision (alerte du Copilote Décideur, arbitrage lancé depuis
// Architecturer) pour qu'une session ouverte depuis n'importe lequel de ces
// trois endroits arrive déjà avec son élicitation, ses critères et ses
// leviers déduits — pas seulement un `contextRaw` brut à ré-analyser à la
// main. Dégrade honnêtement (schéma minimal, jamais de fausse donnée) si le
// LLM est indisponible.
export async function buildAutoFilledSessionPatch(
  description: string,
  opts?: { existingElicitation?: Partial<ElicitationData>; existingSector?: string; companyContext?: string },
): Promise<AutoFilledSessionPatch> {
  let elicitationPatch: Partial<ElicitationData> = { ...(opts?.existingElicitation ?? {}), step: 6 };
  let sectorPatch = opts?.existingSector;
  let problemTypePatch: string | undefined;
  let dimensionsPatch: string[] | undefined;
  let playbookIdPatch: string | undefined;
  let criteriaPatch: AtelierCriterion[] | undefined;
  let leviersDefPatch: AtelierLevierDef[] | undefined;

  try {
    const r = await inferElicitationFromDescription({ data: { description } });
    if (r.ok && r.result) {
      const res = r.result;
      elicitationPatch = {
        ...elicitationPatch,
        objectif: res.objectif ?? elicitationPatch.objectif,
        horizon: res.horizon ?? elicitationPatch.horizon,
        decideurs: res.decideurs ?? elicitationPatch.decideurs,
        impactes: res.impactes ?? elicitationPatch.impactes,
        resistances: res.resistances ?? elicitationPatch.resistances,
        exigencesNonNeg: res.exigencesNonNeg ?? elicitationPatch.exigencesNonNeg,
        leviersDDP: res.leviersDDP ?? elicitationPatch.leviersDDP,
        contraintesDIP: res.contraintesDIP ?? elicitationPatch.contraintesDIP,
        risques: res.risques?.length ? res.risques : elicitationPatch.risques,
      };
      sectorPatch = sectorPatch ?? res.sector;
    }
  } catch { /* ignore — le schéma reste utilisable avec juste la description brute */ }

  try {
    const cls = await classifyDecision({ data: { text: description, companyContext: opts?.companyContext } });
    problemTypePatch = cls.problemType; dimensionsPatch = cls.dimensions; playbookIdPatch = cls.playbookId ?? undefined;

    const model = await generateFullModel({ data: { context: description, problemType: cls.problemType, dimensions: cls.dimensions, companyContext: opts?.companyContext, elicitation: elicitationPatch as ElicitationData } });
    const mapIndicator = (ind: GeneratedIndicator): AtelierCriterion => ({
      id: ind.id, label: ind.label, description: ind.description, modelisable: ind.modelisable,
      importance: ind.importance, poids: AUTO_FILL_IMP_TO_POIDS[ind.importance as ImportanceBadge] ?? 15,
    });
    const mapCriterion = (crit: GeneratedCriterion): AtelierCriterion => ({
      id: crit.id, label: crit.label, description: crit.description,
      importance: crit.importance, poids: AUTO_FILL_IMP_TO_POIDS[crit.importance as ImportanceBadge] ?? 15,
      children: (crit.children ?? []).map(mapIndicator),
    });
    criteriaPatch = model.criteria.map(obj => ({
      id: obj.id, label: obj.label, description: obj.description, besoinTrace: obj.besoinTrace, nature: obj.nature,
      importance: obj.importance, poids: AUTO_FILL_IMP_TO_POIDS[obj.importance as ImportanceBadge] ?? 25,
      children: (obj.children ?? []).map(mapCriterion),
    }));
    leviersDefPatch = model.leviers.map(lev => ({
      id: lev.id, label: lev.label, type: lev.type,
      options: lev.options.map(opt => ({ id: opt.id, label: opt.label, exploratoire: opt.exploratoire, justification: opt.justification, incompatibleAvec: opt.incompatibleAvec, impacts: {} as Record<string, QualitativeImpact> })),
    }));
  } catch { /* ignore — le schéma reste utilisable avec juste le cadrage élicité */ }

  return {
    contextRaw: description, sector: sectorPatch, elicitation: elicitationPatch,
    problemType: problemTypePatch, dimensions: dimensionsPatch, playbookId: playbookIdPatch,
    criteria: criteriaPatch, leviersDef: leviersDefPatch,
  };
}

// ─── Génération du plan d'action (Suivre) ────────────────────────────────────

export interface ActionPlanActionDraft {
  id: string;
  label: string;
  owner: string;
  dueDate: string;
  status: "todo" | "progress" | "done";
  krId?: string;
}

export const generateActionPlan = createServerFn({ method: "POST" })
  .validator((d: {
    decisionTitle: string;
    contextRaw: string;
    scenarioLabel: string;
    scenarioDescription?: string;
    leviersResume?: string;
    /** Objectif prioritaire déclaré du cadrage (elicitation.objectif) — jamais inventé, uniquement cité tel que saisi. */
    objectif?: string;
    /** Exigences non négociables déclarées (elicitation.exigencesNonNeg) — les actions ne doivent pas les ignorer. */
    exigencesNonNeg?: string;
    /** KR réels de la session (Suivi OKR) — sert UNIQUEMENT à rattacher chaque action
     *  au bon KR ; jamais un KR inventé hors de cette liste. */
    krs?: Array<{ id: string; objectif: string; keyResult: string }>;
  }) => d)
  .handler(async ({ data }): Promise<{ actions: ActionPlanActionDraft[] }> => {
    const { mistralChat } = await import("../mistral.server");
    const krList = data.krs ?? [];
    const krDesc = krList.length
      ? krList.map(k => `- ${k.id} : ${k.objectif} → ${k.keyResult}`).join("\n")
      : null;
    const r = await mistralChat({
      messages: [
        {
          role: "system",
          content: `Tu es Aura, assistant décisionnel expert en pilotage opérationnel.
On te donne une décision déjà arbitrée, l'objectif prioritaire déclaré par le décideur, et l'alternative retenue (ou recommandée). Génère un plan d'action concret pour mettre en œuvre cette alternative EN VISANT EXPLICITEMENT cet objectif — l'alternative est le moyen, l'objectif est la fin : chaque action doit contribuer à l'atteindre, pas seulement dérouler mécaniquement les leviers de l'alternative.
4 à 8 actions, séquencées, avec un responsable et une échéance réalistes.${krDesc ? `
Des résultats clés (KR) de suivi existent déjà pour cette décision. Pour CHAQUE action, indique dans "krId" l'identifiant EXACT du KR qu'elle sert le mieux, choisi UNIQUEMENT parmi cette liste (jamais un identifiant inventé) :
${krDesc}
Si aucune action ne se rattache clairement à un KR, laisse "krId" absent pour cette action — jamais un rattachement forcé.` : ""}
Format JSON attendu :
{
  "actions": [
    { "id": "a1", "label": "Action courte et précise", "owner": "Responsable / Rôle", "dueDate": "J+15 / Mois 1 / Q1 2026", "status": "todo"${krDesc ? `, "krId": "l'un des identifiants ci-dessus, ou absent"` : ""} }
  ]
}
Règles : status vaut toujours "todo" à la génération. Actions opérationnelles, non redondantes, avec un responsable nommé et une échéance réaliste par rapport au contexte donné. Ne jamais fabriquer un objectif ou une exigence qui n'a pas été fournie — si aucun objectif n'est donné, base-toi seulement sur l'alternative retenue.
Réponds UNIQUEMENT en JSON valide.`,
        },
        {
          role: "user",
          content: `Décision : ${data.decisionTitle}
Contexte : ${data.contextRaw}${data.objectif ? `\nObjectif prioritaire déclaré : ${data.objectif}` : ""}${data.exigencesNonNeg ? `\nExigences non négociables : ${data.exigencesNonNeg}` : ""}
Alternative retenue : ${data.scenarioLabel}${data.scenarioDescription ? `\nDescription : ${data.scenarioDescription}` : ""}${data.leviersResume ? `\nLeviers activés : ${data.leviersResume}` : ""}

Génère le plan d'action pour mettre en œuvre cette alternative${data.objectif ? " en l'alignant explicitement sur l'objectif prioritaire déclaré ci-dessus" : ""}.`,
        },
      ],
      guardrails: ["verite", "profondeur", "originalite", "controle"],
      maxTokens: 900,
      temperature: 0.3,
    });
    if (!r.ok) return { actions: [] };
    const validKrIds = new Set(krList.map(k => k.id));
    try {
      const parsed = extractJson(r.content) as { actions: ActionPlanActionDraft[] };
      return {
        actions: (parsed.actions ?? []).map((a, i) => ({
          ...a, id: a.id || `a${i + 1}`, status: "todo" as const,
          krId: a.krId && validKrIds.has(a.krId) ? a.krId : undefined,
        })),
      };
    } catch { return { actions: [] }; }
  });
