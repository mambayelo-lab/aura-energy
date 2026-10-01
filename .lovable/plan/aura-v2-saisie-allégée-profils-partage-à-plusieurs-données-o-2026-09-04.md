# Aura V2 — saisie allégée, profils, partage à plusieurs, données optionnelles

## 1. Un seul endroit de saisie, plus court que la V1

Aujourd'hui la V2 construit le dossier depuis le dialogue puis laisse corriger ligne par ligne. On le rend explicite et plus court :

- Un panneau **Dossier** en une page : objectif, exigences rédhibitoires, leviers, options, indicateurs.
- **Six questions maximum** au lieu de la série longue de la V1 : objectif, ce qui est interdit, marges de manœuvre, options en présence, ce qui compte le plus, ce qu'on mesurera. Le reste est proposé par Aura et se corrige au clic.
- Chaque ligne proposée porte une étiquette « suggéré » avec Valider / Corriger / Ignorer. Rien n'entre en arbitrage sans validation.

## 2. Arborescence des indicateurs

Nouvel arbre à trois niveaux, visible dans le Dossier et repris dans le Suivi :

```text
Résultat visé
  └─ Indicateur de résultat (ex. coût du service rendu)
       └─ Indicateur de pilotage (ce que l'équipe suit au mois)
            └─ Preuve (source, date, qui la fournit)
```

L'arbre sert de socle au prévu / constaté du Suivi et aux alertes.

## 3. Deux registres : Exécutif et Expert

- **Exécutif** : vocabulaire courant (« avantage net », « point bloquant », « à trancher »), une carte par option, un verdict, un prochain geste. Aucune mécanique visible.
- **Expert** : mêmes écrans plus la lecture par critère, la matrice de dominance, la robustesse, le journal du moteur et les incertitudes.
- Le basculement reste unique, en bas de la colonne de gauche, et se mémorise par analyse.

## 4. Plusieurs utilisateurs, partage et validation

Le partage existe déjà pour une fiche de Suivi (lien sans compte). On l'étend à l'analyse entière :

- **Partager une analyse** avec des personnes nommées, en Lecture ou Contribution.
- Un contributeur voit l'analyse partagée avec lui et peut **proposer** : un levier, une option, un critère, une réserve — jamais modifier directement.
- Le propriétaire a une file « Propositions reçues » : Accepter / Refuser avec motif.
- **Notifications** : le contributeur est informé de la décision, le propriétaire à chaque nouvelle proposition. Cloche en haut à droite + relevé dans l'analyse.
- Base : tables des partages, des propositions et des notifications, protégées ligne par ligne (chacun ne voit que ce qui le concerne).

## 5. Nuances d'indigo

Oui, sans casser la sobriété : une échelle indigo à cinq degrés (fond très pâle, bordure, indigo signature, indigo profond pour l'encre des titres, indigo sombre pour les états actifs) plus un gris légèrement bleuté pour les fonds de cartes. Les quatre couleurs de statut restent inchangées, seules elles portent du sens.

## 6. Le backward, honnêtement

Il existe et fonctionne : on part du résultat visé et on remonte aux options qui l'atteignent. Ce qui manque pour tenir la promesse :

- la **chaîne explicative** (quel critère bloque, dans quelle option),
- les **réparations minimales** (le plus petit changement de levier qui fait passer le seuil), classées par effort,
- l'écart à la cible affiché en clair dans le rail de droite.

## 7. Avec ou sans données

- **Sans données** : le mode actuel, dire à dire, aucune donnée inventée.
- **Avec données** : connexion à un entrepôt ou à un système métier (SAP, Salesforce, entrepôt cloud), puis **rattachement** de chaque champ importé à un concept Aura. Un indicateur alimenté par une source affiche sa provenance et sa date ; sinon il reste « déclaré ».
- **Alertes** : quand une source est branchée, une règle par indicateur (seuil franchi, exigence rédhibitoire menacée, écart prévu/constaté) déclenche une notification et marque l'analyse à revoir.

## Détails techniques

- `src/lib/v2/dossier.ts` : ajout de l'arbre d'indicateurs (`resultats[] → pilotage[] → preuves[]`) et d'un statut `suggere | valide` par ligne.
- `src/lib/v2/cadrage.functions.ts` : sortie limitée à 6 questions, priorisées par manque bloquant.
- `src/components/v2/CadrerV2.tsx` : panneau unique, groupes repliables, arbre d'indicateurs.
- `src/components/v2/EtatAnalyse.tsx` : écart à la cible + réparations minimales.
- `src/components/v2/ArbitrageV2.tsx` : chaîne explicative et réparations côté backward (moteur BORA inchangé, aucune moyenne, aucun score continu).
- Nouveau `src/lib/v2/partage.functions.ts` + migration : `analyses_partagees`, `analyse_propositions`, `analyse_notifications` avec RLS et GRANT.
- Nouvelle route `/v2/partagees` et file de validation dans le rail droit.
- `src/styles.css` : échelle `--v2-indigo-1..5` sous `.v2-skin`.
- Données : réutilisation de `src/lib/v4/mapping-engine.ts` et `si-connector.ts` pour le rattachement à l'ontologie ; règles d'alerte dans un nouveau `src/lib/v2/alertes.ts`.

## Ordre proposé

1. Saisie unique + 6 questions + arbre d'indicateurs
2. Registres Exécutif / Expert et nuances d'indigo
3. Backward complet (chaîne + réparations)
4. Partage multi-utilisateurs, propositions, notifications
5. Branchement des données et alertes
