# Revues gstack des produits Aura (Supply, Décider, Architect)

*Date : 28 septembre 2026. Méthode : skills `office-hours`, `plan-ceo-review` et `plan-eng-review` de gstack (Garry Tan), appliqués à la main.*

## Source et limites

- gstack a été cloné depuis `https://github.com/garrytan/gstack` : les SKILL.md de `office-hours` (et sa section `phase-2a-startup-diagnostic.md`), `plan-ceo-review` et `plan-eng-review` ont été lus. Les questions ci-dessous reprennent celles des skills.
- Ce qui existe a été lu : `docs/REVUE-PRODUITS-ET-CHALLENGE.md`, `docs/llm-runtime.md`, les guides de `docs/guides`, le contenu du site (`mambayelo-lab/aura-website/content/products.ts`, `value.ts`) et le code d'Architect (`src/lib/v4/`).
- **Limite majeure.** Une vraie séance office-hours se tient *face à la personne fondatrice*. Ici, les réponses sont **déduites des documents**. Quand un document ne répond pas, la réponse est marquée « trou ». Or presque tous les trous portent sur des preuves de demande, et seule Mambaye Lo peut les combler.

### Ce que font les trois skills

| Skill | Modes | Questions / démarche | Livrable |
|---|---|---|---|
| `/office-hours` | **Startup** (6 questions forcing) ou **Builder** (brainstorm) | Q1 Réalité de la demande · Q2 Statu quo · Q3 Spécificité désespérée (un nom, un titre) · Q4 Coin d'entrée le plus étroit · Q5 Observation et surprise · Q6 Pertinence dans 3 ans ; puis remise en cause des prémisses, paysage concurrentiel, alternatives | Un document de conception : problème reformulé, wedge, prémisses validées ou non, prochaine action |
| `/plan-ceo-review` | **Expansion**, **Expansion sélective**, **Maintien du périmètre**, **Réduction** | Step 0 : remise en cause des prémisses, « qu'est-ce qui rend ce plan 10× meilleur », ce qu'on coupe ; puis revue section par section | Liste garder / couper / ajouter, « NOT in scope », rapport de revue |
| `/plan-eng-review` | Un seul mode, avec Step 0 « Scope Challenge » | Architecture, flux de données, cas limites et erreurs, tests, performance, observabilité ; diagrammes ASCII | Plan durci, liste des risques, tests à écrire, rapport de revue |

---

## 1. Office hours : Aura Supply Chain

Mode retenu : **Startup** (produit en démo, sans client payant documenté), donc Q1 à Q3 en priorité.

| Question | Réponse déduite de l'existant | Trou |
|---|---|---|
| **Q1. Demande réelle.** Qui serait vraiment contrarié si Supply disparaissait demain ? | Le site décrit la douleur (« vous apprenez la rupture quand le client appelle »). La démo publique est « Maison Lucie », une entreprise fictive. | **Aucun client, aucun pilote ni aucune lettre d'intention cités.** Pour la skill, un intérêt exprimé n'est pas de la demande. |
| **Q2. Statu quo.** Que font les gens aujourd'hui, même mal ? | Le site le dit bien : SAP, Kinaxis ou o9 envoient des alertes, puis Excel, réunions et mails prennent le relais. Aura se pose en couche de décision au-dessus. | Le coût du contournement n'est pas chiffré : heures passées en réunion S&OP, € de ruptures par an. |
| **Q3. Spécificité.** Quelle personne précise, et qu'est-ce qui la fait promouvoir ou licencier ? | Des rôles : directeur supply, planificateur, S&OP. | Des catégories, pas une personne. Il faut un nom, par exemple « la responsable approvisionnement de X, jugée sur son taux de service ». |
| **Q4. Coin d'entrée.** Qu'est-ce qu'on paierait *cette semaine* ? | Le « sprint résilience » de quelques semaines : choisir un risque, brancher 2 ou 3 sources, puis décider. | C'est le bon wedge, mais il s'agit d'une prestation. Il manque son prix et la plus petite version autonome, du type « import CSV → 3 alertes causales en 10 minutes ». |
| **Q5. Observation.** Quelqu'un a-t-il été observé en train de s'en servir seul ? | Aucune trace. Il existe des tests e2e Playwright, mais ce ne sont pas des observations d'utilisateurs. | Trou complet. |
| **Q6. Dans 3 ans ?** | L'argument le plus fort des trois produits : les agents LLM vont multiplier les alertes, et la valeur ira à qui rend la décision **explicable, signée et mémorisée**. | La thèse tient, mais « explicable » est aussi le discours de Kinaxis et o9. Il faut la preuve que les règles causales explicites battent leurs explications. |

**Prémisse contestée.** « Les planificateurs manquent de décisions » : peut-être manquent-ils plutôt de *données fiables*. Si l'intégration au SI coûte plus cher que la décision, Supply devient « un tableau de bord de plus », le risque que le site cite lui-même.

**Verdict Supply : le meilleur candidat commercial, mais aucune preuve de demande.** Wedge : le sprint résilience, vendu à prix fixe à **un** directeur supply nommé, sur **une** famille de ruptures. Prochaine action : 5 entretiens avec des responsables approvisionnement et une démo sur *leur* export CSV, pas sur Maison Lucie.

---

## 2. Office hours : Aura Décider

Mode retenu : **Startup**.

| Question | Réponse déduite de l'existant | Trou |
|---|---|---|
| **Q1. Demande** | Une base scientifique solide (thèse, méthode Bora, agrégation pondérée, publications). | Une publication n'est pas de la demande. Aucun comité de direction n'est cité comme utilisateur. |
| **Q2. Statu quo** | Les décisions stratégiques se tranchent en comité, avec un PowerPoint, une matrice pondérée sous Excel et l'avis du plus gradé. | C'est **gratuit et suffisant pour la plupart**. Il faut dire pourquoi la matrice pondérée échoue *au point qu'on paie* : décision contestée, audit, recours. |
| **Q3. Spécificité** | « Décideurs, comités, directions de programme ». | Trop large. Les pistes les plus aiguës sont celles où il faut **justifier** une décision : achats publics (notation des offres), comités d'investissement, arbitrages réglementés. |
| **Q4. Coin d'entrée** | Le sprint décision et l'export pour le comité. | Plus petit wedge payable : « votre grille de notation d'appel d'offres, rendue défendable, avec l'analyse pessimiste et le plus petit changement qui renverse le classement (backward) ». |
| **Q5. Observation** | Aucune. | Le vocabulaire (agrégation max-min, treillis) est déjà signalé comme bloquant dans la revue produits. C'est le signe probable qu'aucun utilisateur métier ne l'a encore essayé seul. |
| **Q6. Dans 3 ans** | Les LLM rendront facile la production d'options. La rareté se déplacera vers *le choix défendable*. | Bon argument. Mais un LLM saura aussi produire une matrice pondérée « suffisante » : le différenciateur doit être la **garantie formelle** (mode pessimiste, backward), pas l'interface. |

**Prémisse contestée.** « Décider est un produit. » Tout indique plutôt que c'est un **moteur** : c'est le cœur que Supply et Architect appellent, et la seule chose qu'aucun concurrent ne sait faire.

**Verdict Décider : ne pas le vendre seul pour l'instant.** Il faut le repositionner comme moteur embarqué (« Décider » au sein de Supply et d'Architect), avec un seul usage autonome : la notation défendable d'appels d'offres. La valeur scientifique est réelle ; la demande autonome n'est pas démontrée.

---

## 3. Office hours : Aura Architect

Mode retenu : **Startup**, avec l'adaptation « intrapreneuriat » pour Q4 (quelle plus petite démo convainc un DSI ?).

| Question | Réponse déduite de l'existant | Trou |
|---|---|---|
| **Q1. Demande** | C'est le domaine où Mambaye Lo a le plus d'expérience propre (formations en architecture d'entreprise, CESAM, ingénierie système). | Même trou : aucun DSI ni architecte payant n'est cité. |
| **Q2. Statu quo** | PowerPoint, draw.io, LeanIX, Ardoq, MEGA HOPEX, et des cabinets de conseil facturés au jour. | Le statu quo est **cher** (conseil), c'est une bonne nouvelle. En revanche, LeanIX et Ardoq ajoutent déjà de l'IA générative à leur référentiel. |
| **Q3. Spécificité** | « Architecte d'entreprise, DSI, directeur de programme ». | La personne la plus aiguë est probablement **l'architecte solution qui doit présenter un dossier en comité d'architecture dans 10 jours**. |
| **Q4. Coin d'entrée** | Aujourd'hui : un parcours Cadrer → Comprendre → Transformer, avec beaucoup de saisie manuelle. | Plus petite démo payable : **« Dessine-moi »**. Une phrase et un document existant en entrée ; en sortie, un schéma éditable, l'évaluation selon les 6 piliers Well-Architected et un dossier PDF. Dessine-moi, c'est le wedge d'Architect, pas une simple fonction. |
| **Q5. Observation** | Aucune. | Trou complet. |
| **Q6. Dans 3 ans** | Les LLM dessineront tous des schémas : **le dessin devient une commodité**. | Seuls resteront différenciants l'évaluation (piliers, patterns) et le **choix entre deux cibles** via le moteur Bora. Si Dessine-moi n'est qu'un générateur de Mermaid, il sera rattrapé en 6 mois. |

**Verdict Architect : le wedge est bon mais pas encore construit.** Dessine-moi n'a de valeur durable que s'il aboutit à **« deux cibles comparées et un choix défendable »**. C'est le pont avec Décider, et c'est là que se trouve l'originalité d'Aura.

---

## 4. Revue CEO du portefeuille (`/plan-ceo-review`)

**Mode choisi : RÉDUCTION pour le portefeuille, EXPANSION SÉLECTIVE pour Architect Dessine-moi.** La règle de la skill l'impose presque : au-delà de 15 fichiers modifiés, recommander la réduction. Or trois produits, un site, des guides, un kit commercial et un agent Achats en projet, pour une fondatrice ou un fondateur quasi seul et **sans client payant documenté**, c'est largement au-delà.

### Step 0 : remise en cause des prémisses

1. **« Trois produits » est une prémisse, pas un fait.** Du point de vue de l'acheteur, il y a *un* moteur de décision (Bora) et *deux* terrains d'application (supply, architecture). Décider n'est pas un troisième produit.
2. **« Le site et les guides font avancer les ventes. »** Rien ne le prouve. Le volume de documentation (guides PDF, kit commercial, publications) dépasse de loin le volume de preuves client (zéro).
3. **« Un agent Achats réutilise 80 % du Studio. »** C'est plausible techniquement, mais cela multiplie les fronts commerciaux avant que le premier ait trouvé preneur.

### Qu'est-ce qui rendrait le plan 10× meilleur ?

Pas une fonction de plus : **un client pilote payant**, sur Supply ou sur Architect, observé en usage réel, avec un chiffre « décision → résultat » (en € ou en jours) à mettre sur le site.

### Garder / couper / ajouter

| Garder | Couper ou geler | Ajouter |
|---|---|---|
| Moteur Bora (pessimiste, backward) : c'est le différenciateur | Décider comme produit vendu seul : le **geler** et le réemployer comme moteur embarqué | Import CSV/Excel → valeur en 10 minutes, sur Supply d'abord |
| Supply : le sprint résilience comme offre d'entrée | Tout nouveau guide PDF ou deck tant qu'il n'y a pas de pilote | Suivi « décision → résultat » : c'est la preuve de ROI |
| Architect avec Dessine-moi comme wedge | Les écrans de saisie manuelle d'Architect que le LLM peut préremplir | SSO et journal d'audit, **seulement** au moment où un pilote l'exige |
| Grammaire commune Constater → Comprendre → Décider → Suivre | Le vocabulaire de chercheur dans les écrans d'action | Export d'une décision en une page (PDF ou PowerPoint) pour le comité |

### Séquencement

1. **T0 à T+3 mois** : Supply, un pilote payant (sprint résilience à prix fixe) ; en parallèle, Dessine-moi en version minimale (voir section 5).
2. **T+3 à T+6** : Architect, un pilote avec un architecte solution sur un vrai dossier de comité. Décider reste dedans comme « choix entre deux cibles ».
3. **Après deux pilotes chiffrés seulement** : un nouvel agent.

### Le prochain agent : Achats ?

- **Pour** : c'est le prolongement naturel de Supply (fournisseurs, risque géopolitique), l'acheteur (le CPO) dispose d'un budget, et la CSRD et le devoir de vigilance créent une obligation.
- **Contre** : le marché est encombré (Coupa, SAP Ariba, Sievo, EcoVadis, Prewave, Craft), et la conformité est un achat de *couverture*, pas de décision. Et surtout, **construire Achats avant qu'un client paie Supply revient à disperser l'effort**.
- **Verdict** : Achats reste le bon *suivant*, mais **pas maintenant**. Il faut le faire naître *à l'intérieur* de Supply, sous la forme d'un module « risque fournisseur → double source » vendu au même client pilote, et non comme un quatrième produit. Le BFR (trésorerie) est à écarter pour l'instant : c'est un autre acheteur, le DAF, et un autre cycle de vente.

---

## 5. Revue technique : Architect « Dessine-moi » (`/plan-eng-review`)

### Step 0 : périmètre, à partir de ce qui existe dans le code

- `src/lib/v4/generate-mermaid.ts` : une server function Mistral qui génère du **texte Mermaid** (séquence, flowchart, C4) à partir d'une chaîne `context`. **Elle n'est importée nulle part ailleurs dans `src`** : le code est mort ou n'est pas encore branché.
- `src/lib/v4/export-drawio.ts` (417 lignes) et `diagram-layout.ts` : l'export draw.io existe déjà et part du **modèle** d'étude, pas du texte Mermaid. C'est la bonne base.
- `src/lib/v4/transformation-store.ts` : la mémoire des études est dans **`localStorage`**, avec un cache des suggestions LLM. La formulation de la problématique est déterministe, et un commentaire indique qu'« un vrai appel LLM pourrait remplacer cette fonction ».
- `docs/llm-runtime.md` : Mistral côté serveur, 3 tentatives sur les erreurs 429, et un principe « proposition à confirmer » déjà en place (`aura:accepted-proposal`).

### Architecture recommandée

```
phrase + documents (OCR) + existant (CSV/CMDB)
        │
        ▼
 [LLM Mistral, sortie JSON]  ──►  validation zod du MODÈLE
        │                          (couches ArchiMate : métier, applis, données, techno ;
        │                           éléments + relations, identifiants stables)
        ▼                                   │ échec → 1 réparation, puis erreur honnête
 « Proposition à confirmer » (diff)         │
        ▼                                   ▼
 modèle d'étude (source de vérité) ──► rendus dérivés : draw.io (existant), Mermaid/C4, PDF
        │
        ├──► évaluation déterministe : règles des 6 piliers + catalogue de patterns (pas le LLM)
        └──► 2 cibles → moteur Bora (pessimiste + backward)
```

### Constats et décisions

| # | Sujet | Constat | Décision |
|---|---|---|---|
| 1 | **Génération** | Le LLM produit du texte Mermaid libre, qui n'est ni validé ni éditable comme modèle. | Le LLM produit un **JSON du modèle**, validé par zod. Mermaid et draw.io en sont des *rendus*. Jamais de Mermaid comme source de vérité. |
| 2 | **Injection** | `context` est interpolé tel quel dans le prompt, et les documents importés deviendront une surface d'injection de prompt. | Séparer les instructions des données (balises délimitées), borner la taille, traiter les documents comme des données. |
| 3 | **Évaluation** | Le risque est de laisser le LLM « noter » les 6 piliers, ce qui donnerait un résultat non reproductible. | Des règles **déterministes** sur le modèle (par exemple une seule zone de disponibilité signifie un écart de fiabilité), avec gravité et recommandation. Le LLM ne sert qu'à rédiger l'explication. |
| 4 | **Export** | draw.io existe ; Visio, Terraform et Jira sont annoncés. | Pour la version minimale : draw.io et PDF seulement. Terraform en squelette plus tard. Visio est à couper, car draw.io importe et exporte déjà ce format. |
| 5 | **Mémoire** | `localStorage` : une étude est perdue si le navigateur change, elle ne peut pas être partagée, et le quota est vite atteint avec des diagrammes. | Stocker dans Supabase (déjà présent dans le dépôt) : une table des études et une table des **versions du modèle** (historique des propositions acceptées). C'est aussi la condition du journal d'audit. |
| 6 | **Correction conversationnelle** | Le principe de proposition à confirmer existe. | Une modification = un **patch JSON** sur le modèle (ajouter ou retirer des éléments et relations), présenté comme un diff et appliqué seulement après confirmation. |
| 7 | **Erreurs et coûts** | Les erreurs 429 sont gérées. | Ajouter un délai d'expiration, une seule réparation en cas de JSON invalide, puis un message honnête. Journaliser les jetons consommés par étude. |
| 8 | **Tests** | Il existe des tests e2e, mais aucun test sur la génération. | Un jeu de 10 phrases de référence, avec des propriétés vérifiées : JSON valide, 4 couches présentes, pas de relation orpheline, export draw.io qui s'ouvre. Un test de non-régression pour les règles des piliers. |

**NOT in scope pour la version minimale** : Visio, le backlog Jira, l'import de CMDB en direct (commencer par un CSV), le multi-cloud détaillé.

**Verdict technique : faisable en 3 à 4 semaines**, à condition d'inverser la conception actuelle : un **modèle JSON validé** d'abord, des rendus ensuite, une évaluation déterministe et une persistance serveur. En l'état, `generate-mermaid.ts` est un prototype non branché qu'il ne faut pas étendre.

---

## Synthèse des verdicts

| Produit / sujet | Verdict |
|---|---|
| Supply | Le meilleur candidat commercial, sans preuve de demande. Wedge : le sprint résilience à prix fixe, pour un directeur supply nommé. |
| Décider | Ne pas le vendre seul. C'est un moteur embarqué, avec un seul usage autonome : la notation défendable d'appels d'offres. |
| Architect | Dessine-moi est le wedge, à condition d'aboutir à « deux cibles comparées par Bora ». |
| Portefeuille | Réduction : un pilote payant avant toute nouvelle fonction ou tout nouveau document. |
| Agent Achats | Le bon suivant, mais pas maintenant : d'abord un module de Supply chez le même client. |
| Dessine-moi (technique) | Modèle JSON validé, rendus dérivés, règles déterministes, stockage Supabase. Ne pas étendre `generate-mermaid.ts`. |

---

## Pas à pas pour refaire ces revues vous-même

### 1. Installer Claude Code

```bash
# Prérequis : Node.js 18+ et Git ; gstack demande aussi Bun (https://bun.sh)
npm install -g @anthropic-ai/claude-code
curl -fsSL https://bun.sh/install | bash
claude            # première ouverture : connexion au compte Claude
```

### 2. Installer gstack (commande exacte du README)

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
```

Le README propose ensuite d'ajouter une section « gstack » au `CLAUDE.md` du dépôt pour que l'équipe en profite. Mise à jour ultérieure : `/gstack-upgrade`.

### 3. Lancer les séances, un produit à la fois

Ouvrez un terminal dans `aura-decision-zen`, tapez `claude`, puis :

1. **`/office-hours`**
   - Répondez « startup » quand la skill demande le type de projet.
   - Donnez en entrée : « Produit : Aura Supply Chain. Lis `docs/REVUE-PRODUITS-ET-CHALLENGE.md`, `docs/REVUES-GSTACK.md` section 1 et `../mambayelo-lab/aura-website/content/products.ts` (bloc `supply`). »
   - **Répondez vous-même aux 6 questions avec des faits** : noms, montants, observations. C'est précisément ce que ce document n'a pas pu faire.
   - Livrable : un document de conception (wedge, prémisses).
2. **`/plan-ceo-review`**
   - Donnez le document de conception produit à l'étape précédente et ce fichier.
   - Mode : « scope reduction » pour le portefeuille, « selective expansion » pour Dessine-moi.
   - Livrable : garder / couper / ajouter.
3. **`/plan-eng-review`**
   - Donnez le plan Dessine-moi (section 5) et laissez la skill lire `src/lib/v4/`.
   - Livrable : un plan durci, avec les tests à écrire.
4. **`/qa https://<votre-url-vercel>`**
   - Ajoutez éventuellement un scénario, par exemple : « Parcours : ouvrir Supply, lancer la démo Maison Lucie, décider sur la première alerte ; puis Architect, créer une étude. »
   - La skill teste l'URL dans un vrai navigateur, corrige les bugs et vérifie chaque correction. `/qa-only` produit le rapport sans rien corriger.

**Règle d'or** : arrivez avec une hypothèse chiffrée (« un architecte gagne 3 semaines par dossier ») et repartez avec un verdict écrit dans ce fichier.
