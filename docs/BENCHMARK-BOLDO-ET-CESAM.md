# Benchmark : Boldo (et concurrents) × CESAM, pour Aura Architect

*Rédigé le 28/09/2026. Limite de méthode : le proxy de la session bloquait boldo.io et youtube.com. Les données sur Boldo proviennent donc des extraits de recherche web (pages boldo.io indexées, Capterra, Clever Age, J'aime les startups, Foxeet). Pour la vidéo, le titre, la description et la durée n'ont pas pu être récupérés (oembed bloqué). Tout ce qui est marqué **[déduction]** reste à vérifier.*

## 1. Boldo en bref

- **Positionnement** : « Architecture d'entreprise moderne », « l'architecture d'entreprise pour tous ». Boldo transforme une organisation complexe en **carte vivante** que DSI, architectes et métiers utilisent pour décider, transformer et prouver le ROI. Éditeur français, hébergé en SaaS sur une infrastructure européenne (Scaleway).
- **Fonctions** :
  - moteur de graphe avec un métamodèle souple et personnalisable ;
  - **nested maps** (cartes imbriquées), vues dynamiques et graphes pour « raconter des histoires métier » ;
  - **analyse d'impact** et scénarios de transformation ;
  - portefeuille d'actifs (applications, processus, données, infrastructures, prestataires TIC) ;
  - diagrammes et tableaux de bord.
- **Conformité** : DORA, NIS2, RGPD et PCA/PRA. Le graphe relie les actifs, leurs propriétaires et leurs dépendances, dont les prestataires TIC critiques, dans une source unique de vérité.
- **IA** : import par LLM, qui transforme des cahiers des charges et des entretiens en données structurées. On peut interroger les cartes en langage naturel et demander une analyse d'impact. Message officiel : l'IA *assiste* l'architecte, elle ne le remplace pas.
- **Cas d'usage** : cartographie post-fusion, migrations applicatives, DORA/NIS2, due diligence IT, gestion des connaissances. Un client cité : la ville d'Antibes (Smart City).
- **Prix** : PRO à **39 € HT par éditeur et par mois** (jusqu'à 5 éditeurs, 10 lecteurs, 500 actifs, vues illimitées). Lecteurs gratuits. Offre Enterprise sur devis.
- **Preuve sociale** : 4 badges G2 à l'été 2026, dont la meilleure satisfaction client de la catégorie EA Tools.
- **Marketing** : pages « alternatives à » (Sparx, Archi, etc.), wiki pédagogique (« Qu'est-ce que l'AE », DORA), documentation publique et académie.

### Vidéo https://www.youtube.com/watch?v=FNjGdEWBNss

Titre, description et durée : **non récupérés**, car YouTube et oembed étaient bloqués. À compléter à la main.

Structure probable **[déduction]**, d'après le format habituel des démos SaaS d'architecture d'entreprise :
1. accroche sur la douleur (« votre SI est un plat de spaghettis ») ;
2. apparition de la carte vivante et zoom dans les cartes imbriquées ;
3. clic sur une application, puis propagation de l'analyse d'impact ;
4. tableau de bord ou conformité DORA ;
5. import par IA ;
6. logos, badges G2 et appel à l'action vers l'essai gratuit.

## 2. Concurrents (en bref)

| Outil | Force | Faiblesse | Prix indicatif |
|---|---|---|---|
| **Boldo** | Simplicité, cartes imbriquées, DORA, prix public bas, français | Peu de modélisation solution (séquence, DDD) ; l'IA sert surtout à l'import | 39 €/éditeur/mois |
| **BiZZdesign (Horizzon)** | ArchiMate/BPMN complets, analyses avancées, grands comptes | Lourd, courbe d'apprentissage, coûteux | Sur devis (élevé) |
| **SAP LeanIX** | Standard de la gestion du portefeuille applicatif (APM), fiches, intégrations SaaS (SAP, ServiceNow), IA SAP | Peu de conception solution, prix élevé, dépendance à SAP | Sur devis |
| **Ardoq** | Graphe, scénarios, conception pilotée par les données, IA | Configuration exigeante | Sur devis |
| **MEGA HOPEX** | Couverture GRC, AE et conformité complète, secteurs réglementés | Interface datée, lourd, projets d'intégration longs | Sur devis (élevé) |
| **Aura Architect** | Cadrage conversationnel par LLM, **un modèle vers 7 vues**, référentiel de bonnes pratiques, estimation en t-shirt, moteur de décision | Pas encore de portefeuille d'actifs persistant, d'import en masse, d'intégrations CMDB ni de preuve sociale | À définir |

## 3. Tableau comparatif (fonctions)

| Capacité | Boldo | LeanIX | Ardoq | BiZZdesign | HOPEX | Aura |
|---|---|---|---|---|---|---|
| Cadrage conversationnel par LLM | Partiel (Q/R sur la carte) | Partiel | Partiel | Non | Partiel | **Oui (cœur du produit)** |
| Vues capacités | Oui | Oui | Oui | Oui | Oui | Oui |
| Vue inter-applicative | Oui | Oui | Oui | Oui | Oui | Oui |
| Séquence / BPMN | Limité | Non | Limité | Oui | Oui | **Oui, générée** |
| DDD / architecture fonctionnelle | Non | Non | Non | Partiel | Partiel | **Oui** |
| Cartes imbriquées / zoom | **Oui** | Partiel | Oui | Oui | Oui | À faire |
| Analyse d'impact | **Oui** | Oui | **Oui** | Oui | Oui | Partiel (via le modèle) |
| DORA / NIS2 | **Oui** | Oui | Oui | Oui | **Oui** | À faire |
| Portefeuille d'actifs | Oui | **Oui** | Oui | Oui | Oui | À faire |
| Référentiel de bonnes pratiques contextualisé | Wiki | Non | Non | Gabarits | Gabarits | **Oui (TOGAF, DDD, WAF, CESAM…)** |
| Estimation (t-shirt) | Non | Non | Non | Non | Non | **Oui** |
| Moteur de décision / ADR | Non | Non | Partiel | Partiel | Partiel | **Oui** |
| Import de documents par IA | **Oui** | Partiel | Partiel | Non | Non | À faire |
| Intégrations (CMDB, SaaS) | Oui | **Oui** | Oui | Oui | Oui | Non |

## 4. Ce qu'Aura fait mieux, ce qui lui manque, ce qu'il faut copier ou éviter

**Ce qu'Aura fait mieux**
- Aura va **de l'intention à la décision** : cadrage, modèle, sept vues, estimation, décision. Les outils d'AE *documentent* l'existant ; Aura *conçoit* le changement.
- Les vues solution (séquence, DDD, BPMN) sont générées à partir du même modèle, sans ressaisie.
- Chaque recommandation est justifiée par une règle sourcée (Fowler, Hohpe, Richardson, CESAM).

**Ce qui lui manque**
- Un inventaire persistant (portefeuille), des cartes imbriquées navigables, une analyse d'impact visuelle.
- Un pack DORA et NIS2, un import de l'existant (Excel/CSV, documents par LLM), une preuve sociale et des prix publics.

**À copier chez Boldo**
- Prix public simple et lecteurs gratuits.
- Pages « alternatives à » et wiki SEO.
- Le récit de la « carte vivante ».
- Un cas d'usage réglementaire (DORA) comme porte d'entrée commerciale.
- L'import de documents par IA.

**À éviter**
- Devenir un énième outil d'inventaire.
- Imposer un métamodèle lourd façon HOPEX ou BiZZdesign.
- Vendre de l'IA « gadget » sans traçabilité : Aura doit rester explicable, avec les règles et les sources affichées.

## 5. CESAM : dépôts de Mambaye Lo

Aucun dépôt dédié à CESAM/CESAMES, TOGAF ou l'AE parmi les 22 dépôts accessibles. Une recherche de code montre que CESAM est **déjà intégré** dans `Aura-Architect` : `src/lib/dessine/referentiel.ts`, `model.ts`, `generator.ts`, `agent.functions.ts`, `src/lib/v4/architecture-llm.ts`, `transformation-store.ts`, ainsi qu'un test (`referentiel.test.ts`). Il est aussi cité dans ce dépôt (`src/lib/vitrine-copy.ts`, `docs/REVUES-GSTACK.md`). Les dépôts proches (`Vibe-Architecting`, `Vibe-Architecting-V3`, `agent-archi`, `aura-eventstorming-agent`) n'ont pas été clonés : à explorer pour récupérer des gabarits.

Pour enrichir Architect, voici les apports de la méthode CESAM (connaissance publique, CESAMES Academy) :
- **Trois visions** : opérationnelle (le pourquoi : contexte, parties prenantes, missions, cas d'usage), fonctionnelle (le quoi : fonctions, flux fonctionnels) et constructionnelle (le comment : composants, flux physiques). Chacune doit être ancrée dans une vue d'Aura : capacités et BPMN pour l'opérationnel, architecture fonctionnelle et DDD pour le fonctionnel, inter-applicatif et infrastructure pour le constructionnel.
- **Règles à coder** :
  1. toute fonction est allouée à au moins un composant ;
  2. tout flux externe relie un acteur du contexte ;
  3. toute exigence est rattachée à une mission ou à un cas d'usage ;
  4. une vision n'introduit pas de concepts de la vision inférieure (pas de techno dans le fonctionnel).
- **Gabarits** :
  - diagramme de contexte (système et environnement) ;
  - matrice d'allocation fonctions × composants ;
  - matrice de traçabilité exigences ↔ fonctions ;
  - fiche de mode de vie (cycle de vie, modes opérationnels).
- **Vocabulaire** : système d'intérêt, environnement, mission, mode opérationnel, fonction, composant, flux, allocation.

## 6. Recommandations pour Architect (par priorité)

1. **P0, analyse d'impact visuelle.** Cliquer sur un élément du modèle unique et voir la propagation dans les sept vues, avec une estimation en t-shirt recalculée. C'est l'effet démo de Boldo, en plus puissant.
2. **P0, pack de conformité DORA/NIS2.** Attributs de criticité, prestataire TIC, RTO/RPO et propriétaire sur le modèle ; règles de vérification ; export du registre d'information DORA. C'est une porte d'entrée commerciale prouvée.
3. **P0, import par IA.** Glisser un cahier des charges, un compte rendu d'atelier ou un CSV d'inventaire pour préremplir le modèle, avec une revue ligne à ligne.
4. **P1, contrôles CESAM.** Trois visions explicites, matrice d'allocation et contrôles de cohérence (règles 1 à 4 ci-dessus) intégrés au moteur de décision.
5. **P1, cartes imbriquées et zoom sémantique.** Capacité, puis application, puis composant, puis déploiement, avec une navigation fluide.
6. **P1, portefeuille persistant.** Inventaire des actifs réutilisé d'un cadrage à l'autre, avec cycle de vie TIME (Tolerate/Invest/Migrate/Eliminate).
7. **P2, prix public, lecteurs gratuits, pages « alternatives à » et wiki SEO.**
8. **P2, connecteurs** vers ServiceNow CMDB, LeanIX (import) et GitHub (ADR).

## 7. Vidéo produit d'Aura : script de 75 secondes

Ton : calme, premium, fond sombre, une seule couleur d'accent, musique électronique lente, sous-titres incrustés. Pas de voix off pendant les 5 premières secondes.

| Plan | Durée | À l'écran (Aura) | Texte ou voix |
|---|---|---|---|
| 1 | 0-5 s | Page blanche, curseur qui clignote dans le chat de cadrage | « Toute transformation commence par une phrase. » |
| 2 | 5-14 s | Saisie : « Ouvrir la vente en ligne à nos 40 boutiques d'ici juin ». Aura pose 3 questions de cadrage. | « Aura cadre avec vous. » |
| 3 | 14-24 s | Le modèle unique se construit : les nœuds apparaissent et se relient | « Un seul modèle… » |
| 4 | 24-38 s | Défilement rapide des 7 vues (capacités, inter-applicatif, séquence, infrastructure, BPMN, fonctionnelle, DDD) en fondu enchaîné, la même entité mise en surbrillance dans chacune | « …sept vues cohérentes. » |
| 5 | 38-48 s | Clic sur « Paiement ». L'impact se propage en rouge, les pastilles t-shirt passent de M à L. | « Chaque changement, mesuré. » |
| 6 | 48-58 s | Panneau du référentiel : une règle Richardson ou CESAM signalée, avec correctif proposé et sa source | « Chaque choix, justifié par les meilleures pratiques. » |
| 7 | 58-68 s | Moteur de décision : trois options, un score, un ADR généré | « Décidez. Documentez. Avancez. » |
| 8 | 68-75 s | Logo Aura Architect et appel à l'action | « Aura Architect : de l'intention à l'architecture. » |

Conseils :
- Enregistrer en 60 i/s et en 4K, avec des zooms doux (effet Ken Burns) sur l'interface réelle, sans maquettes.
- Utiliser un cas fil rouge unique (par exemple maison-lucie-si).
- Produire une version de 15 s pour LinkedIn (plans 3, 4 et 5).

## 8. Sources

- https://www.boldo.io/fr (bloquée par le proxy pendant la session ; contenu vu via la recherche)
- https://www.boldo.io/en/features
- https://www.boldo.io/fr/architectes-denterprise
- https://www.boldo.io/en/wiki/dora-the-european-framework-for-operational-resilience
- https://www.boldo.io/en/blog/ai-and-enterprise-architecture-for-now-we-mostly-have-questions
- https://www.boldo.io/en/alternatives-to
- https://www.boldo.io/en/docs/introduction-to-boldo-documentation
- https://www.capterra.com/p/10033569/Boldo/
- https://www.clever-age.com/boldo-larchitecture-dentreprise-pour-tous/
- https://www.jaimelesstartups.fr/solution-architecture-entreprise-boldo/
- https://foxeet.fr/contenu/boldo-plateforme-cartographie-architecture-entreprise
- https://www.youtube.com/watch?v=FNjGdEWBNss (non accessible)
- Concurrents : bizzdesign.com, leanix.net, ardoq.com, mega.com (connaissances générales, non revérifiées pendant cette session)
- CESAM : https://www.cesames.net (connaissances générales)
