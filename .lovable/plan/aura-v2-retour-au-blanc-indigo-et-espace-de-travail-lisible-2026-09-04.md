# Aura V2 — retour au blanc / indigo et espace de travail lisible

Les maquettes envoyées donnent une direction claire : fond blanc, indigo signature, cartes nettes, colonne de gauche sobre, et une colonne de droite qui montre en permanence « où en est l'analyse ». Le plan ci-dessous ne touche qu'à la V2 et à sa présentation ; le moteur de décision reste identique.

## 1. Style : blanc / indigo

- Repasser l'habillage V2 en blanc franc, encre sombre, indigo #6C5CE7 en couleur d'action, gris très clairs pour les fonds de cartes.
- Retirer le papier sable, le cuivre et les titres en serif italique ; titres en sans-serif, épais, comme sur les maquettes.
- Statuts en trois couleurs constantes partout : favorable (vert), acceptable (ambre), défavorable (rouge), plus un gris « inconnu ».
- Cartes à coins arrondis, bord fin, ombre à peine visible ; icônes dans une pastille indigo pâle.

## 2. Colonne de gauche

Réduite à l'essentiel, comme dans les images : Accueil, Dialogue, Modèle, Documents, Forward, Backward, Actions. En bas, l'utilisateur et un interrupteur « Expert » qui révèle les détails de méthode sans les imposer.

## 3. Colonne de droite : l'état vivant de l'analyse

Elle ne montre plus un plan figé mais ce qui bouge :
- l'objectif reformulé et sa clarté,
- les blocages détectés avec leur niveau,
- les options du moment et leur lecture,
- ce qui manque encore pour conclure,
- les questions à trancher, avec un bouton pour les envoyer aux parties prenantes,
- l'état de la fiche : prête à signer ou non.

## 4. Reconnaître une analyse déjà vue

À l'ouverture d'un nouveau cas, Aura compare l'énoncé aux cas déjà travaillés et aux cas de référence, puis propose « repartir de X » ou « créer un cas neuf ». La proposition est affichée, jamais appliquée d'office.

## 5. Encadrer le dialogue libre

- Le texte libre reste l'entrée, mais chaque demande est ramenée à une action connue (compléter le cadrage, ajouter un levier, lancer une lecture, ouvrir le suivi). Hors de cette liste, Aura répond ce qu'elle sait faire au lieu d'improviser.
- Rien n'entre dans le dossier sans validation visible : toute proposition arrive en « suggéré » avec Valider / Corriger / Ignorer.
- Le moteur de décision n'est jamais piloté par le texte : il ne lit que les éléments validés.

## 6. Les quatre écrans, alignés sur les maquettes

- **Dialogue** : conversation, dépôt de documents, bouton « Lancer la lecture forward ».
- **Modèle** : objectifs, contraintes, leviers, options, impacts en colonnes, avec les zones d'incertitude visibles.
- **Forward** : lecture par critère, comparaison des scénarios, points bloquants, inconnues.
- **Backward** : écart à la cible, blocages racines, chaîne explicative, réparations minimales chiffrées en effort/impact.
- **Actions** : objectifs, plan, backlog initial, livrables — le passage de la décision à la mise en œuvre.

## Détails techniques

- Réécriture du bloc `.v2-skin` dans `src/styles.css` (jetons blanc/indigo, suppression `--copper`, `.v2-paper`, serif) ; classes `.v2-*` conservées pour ne rien casser.
- `src/routes/v2.tsx` : nouvelle grille (rail gauche fixe, zone centrale, rail droit d'état), toggle Expert dans le contexte de route.
- Nouveau `src/components/v2/EtatAnalyse.tsx` pour le rail droit, alimenté par l'état d'étude existant.
- Nouveau `src/lib/v4/intent-router.ts` : liste fermée d'intentions + repli explicite ; nouveau `src/lib/v4/cas-similaires.ts` pour la reconnaissance de cas.
- `CadrerV2`, `ArbitrageV2`, `ArchitecturerV2`, `SuiviV2`, `PartiesV2` : passage aux nouvelles cartes et aux pastilles de statut, contenu inchangé.
- Aucune modification du moteur BORA ni des règles ordinales.
