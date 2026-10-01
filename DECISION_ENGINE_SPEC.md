# Aura — Decision Operating System : Spécification Fonctionnelle

> **Version** : 1.1  
> **Date** : Juillet 2026  
> **Contrainte design** : Les termes techniques académiques (CAP, Choquet, agrégation max-min, worth index, mesure floue, etc.) ne sont **jamais** exposés au décideur. Le Cockpit parle uniquement le langage du dirigeant.

---

## 1. Vision

Les plateformes de données répondent à *"où sont les données ?"*.  
Les LLM répondent à *"que dit cette information ?"*.  
**Aura répond à la seule question qui crée réellement de la valeur :**

> **« Quelle décision devons-nous prendre maintenant, pourquoi, avec quel niveau de confiance, et que se passera-t-il si nous choisissons une autre option ? »**

Depuis trente ans, les entreprises investissent massivement dans leurs systèmes d'information. ERP. CRM. Data Lakes. BI. LLM. Pourtant, les dirigeants continuent de prendre leurs décisions dans Excel et PowerPoint.

La raison est simple : **aucune de ces technologies n'a été conçue pour décider**. Elles ont été conçues pour stocker, échanger, analyser, automatiser. Jamais pour décider.

Aura n'est pas une nouvelle plateforme de données. Aura n'est pas un chatbot. Aura est un **Decision Operating System** — la couche manquante entre les données et l'intelligence, entre l'observation et l'action.

---

## 2. Ce qu'Aura permet

Avant de décrire comment Aura fonctionne, voici ce qu'Aura permet de faire :

- **Décider plus vite** — les décisions récurrentes sont déjà modélisées, les signaux arrivent en temps réel
- **Décider avec plus de confiance** — chaque recommandation est expliquée, sourcée, avec un niveau de confiance explicite
- **Comprendre pourquoi** — pas seulement *quoi faire*, mais *pourquoi cette situation existe* et *quelles en sont les causes*
- **Anticiper** — simuler plusieurs scénarios avant de choisir, comparer les impacts
- **Apprendre** — capitaliser sur chaque décision prise, améliorer les recommandations futures

---

## 3. Le Decision Knowledge Graph — la colonne vertébrale d'Aura

Aura n'est pas un moteur de calcul. Aura est un **graphe de connaissance décisionnelle** : une représentation vivante de l'entreprise, de ses objectifs, de ses signaux, de ses contraintes et de ses décisions.

```
Enterprise Reality (le monde réel de l'entreprise)
        │
        ▼
Observations (Argus — découverte, mapping, qualification)
        │
        ▼
Facts (faits qualifiés : valeurs, couverture, confiance)
        │
        ▼
Signals (signaux activés : dérives, risques, opportunités)
        │
        ▼
Decision Context (contexte économique, réglementaire, stratégique)
        │
     ┌──┴──────────────────┐
     ▼                     ▼
Objectifs              Contraintes
     │                     │
     ▼                     ▼
Decision Library ──────────┘
(Décisions vivantes avec leurs scénarios, actions, historique)
        │
        ▼
Decision Intelligence Engine
(Évaluation multicritère, scoring, simulation)
        │
        ▼
Recommandations (expliquées, sourcées, avec confiance)
        │
        ▼
Actions (prises par le décideur)
        │
        ▼
Learning (résultats observés → amélioration continue)
```

**C'est cette boucle complète qui définit Aura.**  
Observe → Comprend → Évalue → Simule → Recommande → Apprend.

Si Aura ne fait qu'observer, il ressemble à Dynatrace.  
Si Aura ne fait que recommander, il ressemble à un copilote IA.  
**Si Aura fait les deux et apprend, il crée une nouvelle catégorie.**

---

## 4. Les objets métier d'Aura

### 4.1 Argus — le module de découverte (différenciateur stratégique)

Palantir suppose que les données sont déjà accessibles.  
Copilot suppose que les données sont déjà compréhensibles.  
**Aura dit : je vais découvrir où se trouve la donnée, comprendre son sens, qualifier sa qualité, et construire les faits nécessaires à la décision.**

Argus est le premier module que l'utilisateur configure. Il se connecte aux sources (ERP, CRM, fichiers, APIs), mappe les attributs aux concepts métier, mesure la couverture, détecte les anomalies, et produit des **Facts** — des faits qualifiés, datés, avec un niveau de confiance.

Sans Argus, Aura n'a rien à analyser. Avec Argus, Aura sait ce que l'entreprise sait réellement d'elle-même.

```
Sources (ERP, CRM, EDI, Fichiers)
    ↓
Connecteurs (authentification, accès, synchronisation)
    ↓
Extraction & Qualité (nettoyage, normalisation, scoring qualité)
    ↓
Mapping sémantique (attribut source → concept métier)
    ↓
Facts (faits qualifiés : valeur, date, couverture, confiance)
```

**Couverture par objet** : Argus mesure le taux de couverture pour chaque objet métier (Fournisseur, Commande, Livraison, Facture). Une couverture < 70% active le mode possibiliste — les scores affichent une fourchette plutôt qu'une valeur unique.

### 4.2 Signals — la détection continue

Un Signal est un indicateur qui franchit un seuil ou dérive de sa plage normale. Les signaux sont le pont entre les facts bruts et les décisions.

Chaque signal possède :
- Une **sévérité** (Critique / Élevé / Modéré / Faible)
- Des **conditions de déclenchement** (règles métier configurables)
- Une **cause probable** (raisonnement causal depuis le graphe)
- Un **lien vers la Décision** concernée dans la Library

Types de signaux pour Maison Lumen :

| Type | Description | Seuil exemple |
|------|-------------|---------------|
| Risque fournisseur | Fragilité financière ou retards récurrents | OTIF < 85% |
| Rupture imminente | Couverture stock critique | < 7 jours |
| Dérive financière | DSO ou marge qui s'érodent | Écart > 1σ sur 3 périodes |
| Performance boutique | CA/m² ou conversion en retard | < 80% de la cible |
| Opportunité | Condition favorable non exploitée | Score > 7/10 sur action inactive |

### 4.3 Decision Context — le contexte décisionnel

Une décision n'existe jamais seule. Elle existe dans un **contexte** — économique, réglementaire, stratégique, opérationnel — qui change sa réponse optimale.

La question *"Faut-il augmenter les prix ?"* n'a pas la même réponse selon que :
- l'inflation est à 2% ou à 10%
- un concurrent vient de baisser ses prix
- la trésorerie est sous tension
- le stock est saturé

Le Decision Context capture ces paramètres et les injecte dans le moteur. C'est lui qui permet à Aura de répondre différemment à la même question selon le moment.

```typescript
interface DecisionContext {
  id: string;
  label: string;                          // "Contexte Q4 2026 — tension approvisionnement"
  economicIndicators: ContextFactor[];    // Inflation, taux, change
  strategicPriorities: string[];          // "Croissance", "Préservation marge"
  activeConstraints: Constraint[];        // Contraintes non-négociables actives
  externalEvents: ExternalEvent[];        // "Hausse matières +15%", "Faillite fournisseur X"
  validFrom: Date;
  validTo?: Date;
}
```

### 4.4 La Decision Library — le patrimoine décisionnel

La Decision Library est à Aura ce qu'un ERP est aux transactions : **le référentiel central, structuré, vivant**.

Chaque entrée est une **Décision** — une question métier récurrente ou stratégique. Une décision existe indépendamment des applications. Elle survivra à toute migration. Elle s'enrichit à chaque usage.

> Une décision n'est pas une fiche. C'est un organisme vivant.

Exemple concret — la décision "Risque Cash" chez Maison Lumen :

```
Risque Cash
├── 12 signaux actifs (DSO, délais fournisseurs, prévisions ventes)
├── 5 scénarios (nominal, tension, stress, optimiste, crise)
├── 4 actions recommandées
├── 3 contraintes actives (covenant bancaire, seuil trésorerie min)
├── 27 décisions passées capitalisées
├── Niveau de confiance : 92%
└── Recommandation : "Réduire les délais de règlement clients de 5 jours"
```

**Structure d'une Décision** :

```
Décision
├── Question          ← En langage naturel ("Comment sécuriser nos approvisionnements ?")
├── Objectif(s)       ← Ce que l'on cherche (le DG pense objectifs, pas critères)
├── Decision Context  ← Le contexte actif
├── Critères          ← Dimensions d'évaluation (dérivées des objectifs)
├── Contraintes       ← Non-négociable
├── Scénarios         ← Situations comparées
├── Actions           ← Leviers disponibles
├── Données           ← Sources KPI liées (via Argus)
├── Recommandations   ← Output du moteur
└── Historique        ← Décisions passées, résultats, apprentissages
```

> **Simplification architecturale** : Il n'y a pas d'objet `DecisionModel` séparé. La Décision **est** son modèle. Un seul objet central.

**Interface TypeScript** :

```typescript
interface Decision {
  id: string;
  title: string;
  question: string;
  owner: string;
  horizon: "court" | "moyen" | "long";
  objectives: Objective[];
  context?: DecisionContext;
  criteria: Criterion[];
  constraints: Constraint[];
  scenarios: Scenario[];
  actions: Action[];
  dataSources: string[];               // IDs connecteurs Argus
  status: "draft" | "active" | "archived";
  confidence: number;                  // 0-1, calculé par le moteur
  history: DecisionRecord[];
}

interface Objective {
  id: string;
  label: string;                        // "Réduire le risque cash"
  direction: "minimize" | "maximize";
  criteria: Criterion[];               // Critères dérivés de cet objectif
}

interface Criterion {
  id: string;
  label: string;                        // "Solidité fournisseur" (jamais de jargon)
  weight: number;                       // [0,1]
  interactionGroup?: string;            // Usage interne moteur uniquement
  currentScore?: number;
  targetScore?: number;
}

interface Action {
  id: string;
  label: string;
  estimatedValue: number;              // Gain potentiel [0,1]
  feasibilityScore: number;            // Facilité d'exécution [0,1]
  opportunityScore: number;            // Score d'opportunité [0,1]
  cost?: number;
  timeToResult?: number;               // jours
  riskLevel: "faible" | "modéré" | "élevé";
  explanation: string;
}
```

---

## 5. Comment Aura pense — les 6 capacités

Le décideur ne voit jamais comment Aura calcule. Il voit ce qu'Aura lui permet de faire. En interne, le moteur orchestre six capacités :

### Observe
Argus surveille en continu les sources connectées. Quand une donnée change, un fait est mis à jour. Quand un seuil est franchi, un signal s'active. Le système ne dort jamais.

### Comprend
Quand un signal s'active, Aura remonte la chaîne causale : *pourquoi cette situation existe-t-elle ?* Quels faits l'ont provoquée ? Quelles applications sont en cause ? Quels propriétaires sont responsables ? Le décideur comprend la racine, pas seulement le symptôme.

### Évalue
Pour chaque action ou scénario, le moteur calcule un **Score de performance** (agrégation multicritère avec interactions) et un **Score d'opportunité** (arbitrage entre valeur attendue et faisabilité). Les interactions entre critères sont modélisées — certains se renforcent, d'autres se chevauchent.

Deux modes selon la qualité des données :
- **Mode précis** (couverture Argus ≥ 70%) : résultat unique, confiance élevée
- **Mode estimé** (couverture < 70%) : fourchette affichée, confiance modérée

### Simule
Le décideur teste des hypothèses avant de choisir. *"Et si le fournisseur X fait défaut ?"* Aura propage l'impact sur les scores, recalcule le classement des actions, identifie les actions **robustes** — celles qui restent recommandées quel que soit le scénario.

### Recommande
Aura propose les actions classées par Score d'opportunité, avec une explication en langage naturel pour chacune. Chaque recommandation affiche sa confiance, ses sources, et les hypothèses sur lesquelles elle repose.

### Apprend
Chaque décision prise est enregistrée. Le résultat observé à 30, 90 et 180 jours est comparé à la recommandation initiale. L'écart alimente l'amélioration des scores futurs. Aura apprend ce qui fonctionne réellement dans chaque contexte.

---

## 6. Architecture produit — Studio et Cockpit

### 6.1 Aura Studio (travail a priori)

Le Studio est l'espace des équipes data, des analystes et des architectes décision. On y prépare les décisions avant qu'elles ne soient utilisées.

```
Studio
├── Argus           ← Découverte sources, mapping, couverture, qualité
├── Connecteurs     ← Authentification, accès, synchronisation
├── Extraction      ← Règles d'extraction, qualité, synthèse
├── Signaux         ← Configuration des seuils, conditions, règles causales
├── Bibliothèque    ← CRUD Decision Library (Décisions, Objectifs, Scénarios, Actions)
└── Sémantique      ← Contrats sémantiques, ontologie métier
```

### 6.2 Cockpit Décideur (travail a posteriori)

Le dirigeant n'ouvre jamais le Studio. Il pose une question. Aura fait le reste.

```
Question en langage naturel
        ↓
Recherche dans la Decision Library
        ↓
Application du Decision Context actif
        ↓
Calcul des scores + simulation
        ↓
Recommandation + Explication + Confiance
        ↓
Comparaison de scénarios (optionnel)
        ↓
Décision → enregistrée dans l'historique
```

Le Cockpit est un espace **zéro jargon** : aucun terme académique, aucun acronyme non défini, aucun graphique sans légende claire.

---

## 7. Plan d'implémentation

### V1 — Fondation (Q3 2026)

**Objectif** : Decision Library fonctionnelle + Score d'opportunité opérationnel

- [ ] Modèle de données `Decision` + `Objective` + `DecisionContext` en base Supabase
- [ ] Interface Studio "Bibliothèque" — CRUD complet
- [ ] Calcul du Score d'opportunité : `min(gainPotentiel, facilitéExécution)` (remplace `impact × feasibility / 10`)
- [ ] Lien Signal → Décision : signal activé pointe vers la décision concernée
- [ ] Cockpit V0 : liste des décisions actives, scores, alertes signaux

Fichiers à créer :
- `src/types/decision.ts` — interfaces `Decision`, `Objective`, `Criterion`, `Action`, `Scenario`, `DecisionContext`
- `src/lib/engine/opportunity.ts` — `opportunityScore = min(value, feasibility)`
- `src/lib/engine/aggregate.ts` — agrégation V1 : moyenne pondérée simple
- `src/routes/cockpit.tsx` — page Cockpit décideur V0

### V2 — Moteur et Contexte (Q4 2026)

**Objectif** : Agrégation avec interactions + Decision Context + Simulation

- [ ] Agrégation multicritère avec interactions (`interactionGroup` → min du groupe)
- [ ] Fonctions d'utilité par KPI :
  - OTIF : 100% → 1.0 / 85% → 0.5 / < 70% → 0.0
  - DSO : < 30j → 1.0 / 45j → 0.5 / > 60j → 0.0
  - Score solidité : Altman Z > 2.99 → 1.0 / linéaire / < 1.81 → 0.0
- [ ] Decision Context : création, application, comparaison
- [ ] Module Scénarios : what-if, stress test, comparaison côte à côte
- [ ] Mode estimé : si couverture Argus < 70% → fourchette + bande de confiance

### V3 — Intelligence (Q1 2027)

**Objectif** : Raisonnement causal + Mémoire décisionnelle + Cockpit conversationnel

- [ ] Graphe causal : Signal → Cause → Critère → Décision
- [ ] Génération automatique de critères depuis un objectif (LLM + ontologie métier)
- [ ] Mémoire décisionnelle : résultats observés, écarts, feedback loop
- [ ] Génération de scénarios : Aura propose des hypothèses plausibles automatiquement
- [ ] Cockpit conversationnel : question en français → recommandation

---

## 8. Règles de nommage — interface décideur

### Principe absolu

> Aucun terme académique ou technique ne doit apparaître dans l'interface visible par le décideur.

Le Studio tolère certains termes techniques dans les onglets avancés (pour les analystes). Le Cockpit est une zone zéro jargon, sans exception.

### Table de correspondance

| Contexte | Terme interdit | Terme à utiliser |
|----------|----------------|-----------------|
| Cockpit | "Score CAP", "Worth index" | "Score d'opportunité" |
| Cockpit | "Intégrale de Choquet", "agrégation max-min" | "Score global", "Performance consolidée" |
| Cockpit | "Capacité floue", "Contrainte" | "Facilité d'exécution", "Réalisable ?" |
| Cockpit | "Distribution de possibilité", "α-coupe" | "Niveau de confiance", "Donnée estimée" |
| Cockpit | "Mesure floue μ", "Coalition" | "Axes d'évaluation", "Dimensions" |
| Cockpit | "Frontière de Pareto" | "Meilleur compromis" |
| Cockpit | "Critères" (seul) | "Objectifs → Critères" |
| Studio | "Fait", "Degree of truth" | "Indicateur", "Signal" |
| Studio | "Fonction d'utilité u_i" | "Calibrage de l'indicateur" |

---

## 9. Glossaire

### Glossaire décideur (usage Cockpit)

| Terme affiché | Définition |
|--------------|------------|
| **Score d'opportunité** | Note 0–10 : vaut-il la peine de lancer cette action, compte tenu du gain attendu et de la difficulté de mise en œuvre ? |
| **Gain potentiel** | Amélioration attendue si l'action est menée à bien |
| **Facilité d'exécution** | Capacité réelle à mener l'action (ressources, temps, contraintes) |
| **Score de performance** | Note globale d'une situation sur l'ensemble des critères |
| **Niveau de confiance** | Qualité et complétude des données utilisées pour la recommandation |
| **Contexte décisionnel** | Paramètres économiques, stratégiques et opérationnels qui influencent la décision |
| **Scénario** | Situation hypothétique testée pour anticiper les impacts avant de décider |
| **Signal** | Indicateur qui dérive ou franchit un seuil d'alerte |
| **Recommandation** | Action suggérée par Aura avec son explication et son niveau de confiance |
| **Décision** | Question métier modélisée, avec ses objectifs, scénarios et historique |
| **Bibliothèque** | Patrimoine décisionnel de l'entreprise — toutes les décisions modélisées |
| **Historique** | Décisions passées, résultats observés, apprentissages capitalisés |

### Glossaire technique (usage Studio / développeurs)

| Terme technique | Terme décideur | Référence |
|----------------|----------------|-----------|
| CAP — Choix d'objectifs Atteignables pour la Performance | Score d'opportunité | LGI2P / Mines d'Alès |
| Intégrale de Choquet C_μ | Agrégation multicritère avec interactions | Choquet 1954 |
| Agrégation max-min pondérée S_μ | Agrégation ordinale (données qualitatives) | Sugeno 1974 |
| Worth index W_H(x, I) | Gain potentiel d'une coalition d'actions | Sow & al. LFA 2015 |
| Mesure floue μ | Pondération avec interactions | Mesure non-additive |
| Fonction de difficulté d_x0 | Facilité d'exécution | Couturier & al. FUZZ 2020 |
| Fonction d'utilité u_i | Calibrage de l'indicateur | Normalisation [0,1] |
| Distribution de possibilité π | Estimation avec incertitude | Zadeh 1978 |
| OTIF (On Time In Full) | Taux de livraison conforme | APICS / ASCM |
| Altman Z-Score | Score de solidité financière | Altman 1968 |
| DSO (Days Sales Outstanding) | Délai moyen de recouvrement | Finance standard |
| Frontière de Pareto | Meilleur compromis entre actions | Optimisation multiobjectif |

---

## 10. Points de vigilance

1. **Un seul objet central** : la Décision absorbe le Decision Model. Pas d'objet séparé.
2. **Argus est stratégique**, pas un outil de configuration : c'est le premier différenciateur visible.
3. **Objectifs avant critères** : dans tout l'UI, un objectif métier précède toujours ses critères d'évaluation.
4. **Decision Context** : toute recommandation affiche le contexte dans lequel elle a été calculée.
5. **Progressivité** : V1 livre de la valeur immédiate. V2 et V3 n'ajoutent que ce que V1 ne peut pas faire.
6. **Credentials OAuth** : les données d'authentification des connecteurs restent dans `hub.functions.ts` — pas de migration vers des variables d'environnement dans cette phase.
7. **Incertitude explicite** : Aura n'invente pas de précision. Si les données sont partielles, la fourchette est affichée. Le décideur fait confiance à un système qui assume ses limites.
8. **Causalité avant corrélation** : un signal est un symptôme, pas une cause. Aura explique toujours la chaîne causale.

---

## 11. Plan de mise en œuvre — sans casser l'existant

### Principe directeur

Aura Studio existe et fonctionne. La stratégie est **additive** : on étend, on enrichit, on ajoute — on ne réécrit pas. Chaque étape livre de la valeur immédiatement et peut être livrée en PR indépendante.

### Les 5 PRs

```
PR 1 — Formule opportunityScore           [1 fichier, 1 ligne, zéro risque]
PR 2 — src/types/decision.ts             [Additif, zéro breaking change]
PR 3 — Enrichissement Library            [Étend l'existant]
PR 4 — Route /cockpit V0                 [Nouveau fichier, zéro régression]
PR 5 — Lien Signal → Décision            [Champ + UI légère]
```

---

**PR 1 — Formule du Score d'opportunité**

Fichier concerné : logique `decisionModel` existante.

```
Avant  :  cap = (impact × feasibility) / 10        [produit — favorise les extrêmes]
Après  :  opportunityScore = min(value, feasibility) [min — exige les deux]
```

Impact : un seul endroit à modifier. Aucune UI ne change. Les scores s'ajustent automatiquement.

---

**PR 2 — Types TypeScript**

Nouveau fichier `src/types/decision.ts` avec les interfaces `Decision`, `Objective`, `DecisionContext`, `Action` enrichie. L'interface `Cap` existante reste en place — pas de migration forcée. Les nouvelles décisions utilisent le nouveau type, les anciennes coexistent.

---

**PR 3 — Enrichissement de studio.library.tsx**

On ne réécrit pas la page. On ajoute :
- Un champ `Objectif` au-dessus des critères dans le panneau de détail
- Un bloc `Contexte décisionnel` (optionnel en V1, peut être vide)
- La décision affichée comme un **organisme vivant** : signaux actifs, niveau de confiance calculé, compteur décisions passées

---

**PR 4 — Route `/cockpit` V0**

Nouveau fichier `src/routes/cockpit.tsx`. Zéro impact sur l'existant. En V0 :
- Liste des décisions actives depuis la Library
- Scores d'opportunité + alertes signaux liés
- Écran lecture uniquement, pas d'édition

---

**PR 5 — Lien Signal → Décision**

Ajout d'un champ `decisionId?` dans le type Signal. Dans le panneau de détail Signal : une ligne "Décision associée → [titre]" avec navigation. Les signaux sans `decisionId` ne sont pas affectés.

---

### Ce qu'on ne fait pas en V1

- Pas de graphe causal automatique (V3)
- Pas de génération de critères depuis un objectif en langage naturel (V3)
- Pas de mémoire décisionnelle avec feedback loop (V3)
- Pas de refonte Supabase — on ajoute des tables, on ne touche pas aux existantes
- Pas de migration des credentials OAuth

---

## 12. Illustration — Maison Lumen (Retail Luxe)

### Contexte

Maison Lumen est une maison de luxe multi-boutiques. Son SI est fragmenté : ERP Sage pour la finance, WMS pour les stocks, un fichier Excel pour les prévisions de collection, un CRM partiel. Les décideurs — DAF, Directeur Achats, Directeur Réseau — travaillent dans des silos.

### La boucle Aura end-to-end

---

**ÉTAPE 1 — Argus découvre la réalité**

```
Sources connectées par Argus
─────────────────────────────────────────────────
  ERP Sage        → Factures, règlements, DSO
  WMS             → Stocks, couverture, ruptures
  EDI Fournisseurs→ Confirmations livraison, OTIF
  Fichier Excel   → Prévisions collection (qualité faible)
─────────────────────────────────────────────────
Couverture par objet
  Fournisseur     ████████░░  78%  (mode précis)
  Commande        ██████████  94%  (mode précis)
  Livraison       ██████░░░░  61%  (mode estimé ⚠)
  Facture         █████████░  89%  (mode précis)
```

Argus détecte que les données de livraison sont partielles. Il passe automatiquement en **mode estimé** pour les scores liés aux fournisseurs : les recommandations afficheront une fourchette.

---

**ÉTAPE 2 — Les signaux s'activent**

Un lundi matin, trois signaux s'activent simultanément :

```
🔴  CRITIQUE   Fournisseur Tissus Premium SA
                OTIF : 61%  (seuil : 85%)
                DSO : 67 jours  (seuil : 45j)
                Score solidité : 0.31  (seuil : 0.40)
                → Cause probable : fragilité financière + retards récurrents

🟡  MODÉRÉ     Collection Automne — Boutique Lyon
                Couverture stock : 4 jours  (seuil : 7j)
                → Cause probable : livraison bloquée (signal précédent)

🟢  OPPORTUNITÉ Boutique Paris Marais
                Score performance : 8.4/10
                Taux conversion : +18% vs cible
                → Action recommandée : augmenter le réassort prioritaire
```

---

**ÉTAPE 3 — Le Decision Context est actif**

```
Contexte décisionnel — Q4 2026
─────────────────────────────────────────────────
  Priorité stratégique   : Préservation marge (arbitrage engagé)
  Contrainte active      : Covenant bancaire — trésorerie min 2M€
  Événement externe      : Hausse matières cuir +12% (depuis août)
  Situation marché       : Concurrent X en promotion agressive
─────────────────────────────────────────────────
```

Ce contexte modifie le classement des actions. Une action "baisser les prix pour défendre les volumes" serait normalement neutre — dans ce contexte, elle est disqualifiée (covenant bancaire + pression marge).

---

**ÉTAPE 4 — La Décision vivante s'affiche**

Le Directeur Achats ouvre le Cockpit. Aura lui présente la décision "Risque Fournisseur Collection Premium" :

```
┌─────────────────────────────────────────────────────┐
│  Risque Fournisseur — Collection Premium            │
│                                                     │
│  Objectif : Sécuriser l'approvisionnement automne  │
│  Confiance : 71%  (données livraison partielles)   │
│                                                     │
│  3 signaux actifs  •  5 scénarios  •  12 décisions │
│  passées (taux de succès : 67%)                    │
│                                                     │
│  RECOMMANDATIONS                                    │
│  ─────────────────────────────────────────────────  │
│  1. Activer fournisseur alternatif Iberian Fabrics  │
│     Gain potentiel : 8.1/10                        │
│     Facilité d'exécution : 7.4/10                  │
│     Score d'opportunité : ██████████ 7.4           │
│     → "Contrat cadre existant, délai 3 semaines"   │
│                                                     │
│  2. Réduire exposition Tissus Premium SA à 30%      │
│     Score d'opportunité : ██████░░░░ 6.1           │
│     → "Risque rupture partielle — stock tampon ok" │
│                                                     │
│  3. Décaler réassort Lyon de 10 jours              │
│     Score d'opportunité : █████░░░░░ 5.2           │
│     → "Impact ventes estimé : -3% sur la période"  │
│                                                     │
│  Scénario testé : "Tissus Premium SA fait défaut"  │
│  → Action 1 reste recommandée (robuste)            │
│  → Délai critique : 18 jours avant rupture Lyon    │
└─────────────────────────────────────────────────────┘
```

---

**ÉTAPE 5 — La décision est prise et capitalisée**

Le Directeur Achats active Iberian Fabrics. La décision est enregistrée avec son contexte, ses hypothèses, et la date. Dans 30 jours, Aura compare le résultat observé à la recommandation — et l'écart alimente l'amélioration future.

```
Historique — Risque Fournisseur Premium
─────────────────────────────────────────────────────
  2024-03  Activation Iberian Fabrics     ✓ Succès  +8pts
  2024-09  Renégociation volume           ~ Partiel  +3pts
  2025-02  Stock tampon augmenté          ✓ Succès  +6pts
  2025-10  Décision actuelle              ⏳ En cours
─────────────────────────────────────────────────────
  Taux de succès : 67%    Confiance : 71%
```

---

## 13. Illustration — Entreprise Industrielle (ETI Manufacturière)

### Contexte

Acier Concept est un ETI industriel, fabricant de composants métalliques pour l'automobile et l'aéronautique. 450 salariés, 3 sites de production, 80 fournisseurs actifs, clients soumis à des SLA stricts. Le DAF, le Directeur des Opérations et le Directeur Commercial décident dans l'urgence, souvent avec des données en retard de 48h.

### La boucle Aura end-to-end

---

**ÉTAPE 1 — Argus cartographie le SI fragmenté**

```
Sources connectées par Argus
─────────────────────────────────────────────────────
  ERP SAP         → Commandes, production, coûts
  MES (site A/B)  → Temps de cycle, taux de rebut, TRS
  Logistique      → Délais transport, incidents livraison
  Qualité         → Non-conformités clients, retours
  Météo / Energie → Consommation, pics, contrats EDF
─────────────────────────────────────────────────────
Couverture par objet
  Ordre de fabrication  ███████████  96%
  Fournisseur matière   ████████░░░  82%
  Livraison client      ██████░░░░░  63%  ⚠ mode estimé
  Coût énergie          █████████░░  88%
```

---

**ÉTAPE 2 — Les signaux s'activent**

```
🔴  CRITIQUE   Site B — Taux de rebut
                Rebut acier inox : 8.3%  (seuil : 3%)
                TRS : 61%  (seuil : 78%)
                → Cause probable : usure outil de découpe + lot matière déviant

🔴  CRITIQUE   Client Stellantis — Risque SLA
                Retard cumulé : 4 jours
                Pénalité contractuelle : 12 000€/jour passé J+5
                → Cause : goulot site B + retard transport

🟡  MODÉRÉ     Acier inox — Tension approvisionnement
                Couverture matière : 6 jours  (seuil : 10j)
                Prix spot : +18% vs contrat cadre
                → Fournisseur principal en grève (signal presse externe)
```

---

**ÉTAPE 3 — Le Decision Context**

```
Contexte décisionnel — Novembre 2026
─────────────────────────────────────────────────────
  Priorité stratégique   : Zéro pénalité client (clause révision contrat)
  Contrainte active      : Capacité site A limitée (maintenance planifiée J+8)
  Événement externe      : Grève fournisseur inox principal (3 semaines estimées)
  Situation énergétique  : Pic tarifaire EDF prévu semaine 46
─────────────────────────────────────────────────────
```

---

**ÉTAPE 4 — La Décision vivante — "Continuité Production Stellantis"**

```
┌─────────────────────────────────────────────────────┐
│  Continuité Production — Client Stellantis          │
│                                                     │
│  Objectif : Livrer à temps, éviter les pénalités   │
│  Confiance : 83%                                    │
│                                                     │
│  2 signaux critiques  •  3 scénarios  •  8 décisions│
│  passées (taux de succès : 75%)                    │
│                                                     │
│  RECOMMANDATIONS                                    │
│  ─────────────────────────────────────────────────  │
│  1. Transférer 40% des ordres vers Site A           │
│     Gain potentiel : 9.1/10                        │
│     Facilité d'exécution : 6.8/10                  │
│     Score d'opportunité : ██████████ 6.8           │
│     → "Capacité disponible confirmée, surcoût +4%" │
│                                                     │
│  2. Activer stock de sécurité inox (Toulouse)       │
│     Score d'opportunité : ██████████ 7.2           │
│     → "14 jours de couverture, transport J+1"      │
│                                                     │
│  3. Renégocier planning Stellantis — décalage 3j    │
│     Score d'opportunité : ████░░░░░░ 4.1           │
│     → "Risque relation client, déconseillé dans    │
│        ce contexte (clause révision contrat)"      │
│                                                     │
│  SIMULATION TESTÉE                                  │
│  "Grève fournisseur dure 6 semaines (vs 3)"        │
│  → Action 2 insuffisante seule                     │
│  → Actions 1+2 combinées : robustes jusqu'à J+42  │
│  → Seuil critique : commander chez fournisseur     │
│     alternatif avant J+7                           │
└─────────────────────────────────────────────────────┘
```

---

**ÉTAPE 5 — Chaîne causale expliquée**

Le Directeur des Opérations demande : *"Pourquoi le taux de rebut a-t-il explosé sur le site B ?"*

```
Signal : Rebut inox 8.3%
    │
    ├── Cause 1 : Lot matière L-2289 (dureté hors spec)
    │   └── Source : Fournisseur ArcelorMittal — lot du 28/10
    │       └── Action : Déclencher non-conformité + retour
    │
    └── Cause 2 : Outil de découpe T-14 (usure critique)
        └── Dernière maintenance : J-47  (seuil : J-30)
            └── Action : Remplacement immédiat — délai 4h
```

Sans Aura : ce diagnostic prend 2 à 3 jours de réunions. Avec Aura : il est disponible en temps réel, sourcé, avec les actions correctives proposées.

---

**ÉTAPE 6 — Mémoire et apprentissage**

```
Historique — Continuité Production (incidents)
─────────────────────────────────────────────────────────
  2024-01  Grève transport    Transfert site A    ✓  +9pts
  2024-06  Panne MES site B   Reprogrammation     ✓  +7pts
  2025-03  Pénurie alu        Stock alternatif    ~ Partiel
  2025-11  Situation actuelle                     ⏳
─────────────────────────────────────────────────────────
  Apprentissage :
  → Le transfert site A est systématiquement efficace
    (score d'opportunité renforcé automatiquement)
  → Le stock de sécurité seul est insuffisant sur > 3 semaines
    (poids "durée crise" intégré dans le modèle)
```

---

### Ce que démontre cet exemple industriel

| Dimension | Sans Aura | Avec Aura |
|-----------|-----------|-----------|
| Détection du risque | 48h après (rapport hebdo) | Temps réel (signal automatique) |
| Diagnostic causal | 2-3 jours de réunions | Immédiat, sourcé |
| Simulation "grève 6 semaines" | Excel ad hoc | Intégré, en 30 secondes |
| Décision documentée | Email + PowerPoint | Capitalisée, traçable, apprenante |
| Pénalité Stellantis | Probable (12k€/j) | Évitée |

---

## Annexe — Fondements académiques du moteur

*Cette section est destinée aux développeurs et aux data scientists. Elle ne concerne jamais l'interface décideur.*

### Score d'opportunité

Formule interne : `opportunityScore = min(ω̄_I, s̄_I)`

- `ω̄_I` : gain potentiel normalisé (worth index — Sow et al. LFA 2015)
- `s̄_I` : score de faisabilité normalisé (fonction de difficulté inversée — Couturier et al. FUZZ 2020)

Remplace la formule produit `impact × feasibility / 10` actuellement en place.

### Agrégation multicritère (V2)

- **Données quantitatives fiables** : Intégrale de Choquet `C_μ(p) = Σ(p_σ(i) − p_σ(i-1)) × μ(A_σ(i))`
- **Données qualitatives ou ordinales** : Agrégation max-min pondérée `S_μ(k) = max_i min(k_σ(i), μ(A_σ(i)))`
- **Données incomplètes** (couverture < 70%) : framework possibiliste — fourchette `[Nécessité, Possibilité]`

### Références

1. Sow et al. (LFA 2015) — *Aide à la décision multicritère d'amélioration continue*
2. Imoussaten et al. (LFA 2017) — *Possibilistic worth index*
3. Montmain et al. (REM 2019) — *Ordinal Sugeno integral*
4. Couturier et al. (FUZZ 2020) — *Difficulty function*
5. Gartner — *Decision Intelligence Platforms* (2023–2025)
6. Altman (1968) — *Z-Score fragilité financière*
