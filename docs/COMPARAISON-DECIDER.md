# Décider : ancienne version et version actuelle

## Méthode

**Versions comparées**
- **Ancienne version** : commit `9fb187b3`, le dernier avant la refonte de Décider (phase 7, qui commence à `05e53006`). Elle est servie depuis un worktree séparé sur le port 8090.
- **Version actuelle** : `main`, servie sur le port 8080.

**Mesures**
- Même démonstration des deux côtés : « Exemple — Expansion européenne » en autonome, et l'alerte Supply « Risque de rupture fournisseur » de la démo Maison Lucie.
- Les mots visibles sont comptés par Playwright sur `document.body.innerText`, sidebar et copilote compris.
- Les clics sont comptés du point d'entrée jusqu'au premier résultat affiché (option recommandée).
- Les captures sont dans `scratchpad/decider-compare/`.
  - `parcours-<écran>-ancien.png` et `parcours-<écran>-actuel.png` couvrent chaque écran.
  - `autonome-debut-*.png` montre le premier écran d'une nouvelle décision.
  - `*-fil.png` montre le fil complet du dialogue.

## Parcours complet

| Parcours | Ancien | Actuel |
|---|---|---|
| Autonome : écrans jusqu'au résultat | 5 (Comprendre avec 5 questions, Impacter, Scénarios, Arbitrer, Suivre) | 1 (fil « Décider vite ») ; les 4 étapes restent en mode Détail |
| Autonome : clics jusqu'au premier résultat | environ 15 (répondre aux 5 questions, générer le modèle, pré-remplir, composer, arbitrer) | 2 (Analyser, puis 0 à 3 cartes de choix) |
| Autonome : mots du premier écran | 145 | 36 |
| Depuis Supply : clics jusqu'au résultat | environ 12 (on arrive en Comprendre, question 2 sur 5) | 1 (« Décider » sur l'alerte : résultat et plus petit changement dans le fil) |
| Taille du modèle proposé | celle de la saisie | 3 à 5 leviers, 5 à 8 indicateurs sous 2 ou 3 MOP et 1 ou 2 MOE, marqués « à confirmer » |

## Écran par écran (mots visibles)

| Écran | Ancien | Actuel | Commentaire |
|---|---|---|---|
| Accueil Décider | 143 | 69 | Les descriptions des cartes passent en info-bulle. |
| Comprendre | 621 | 290 | L'arbre réglable reste visible. La vue détaillée, les leviers et la synthèse sont repliés. |
| Impacter (matrice) | 121 | 101 | La matrice est identique. Légende en symboles, aide sur « ? ». |
| Scénarios | 146 | sous-onglet d'Impacter | Aucune fonction perdue. |
| Arbitrer / Résultat | 353 | 219 | Recommandation, classement, treillis et légende identiques. Textes d'aide en info-bulle. |
| Suivre | 222 | 215 | Tableau de bord d'abord, comme l'ancienne version. « Améliorer » (moteur Sow) est replié. |
| Décision depuis Supply | 538 | 295 | Résultat, écart et « Ce qui ferait changer la décision » dans le fil. |
| Dialogue « Décider vite » | n'existait pas | 214 | Chaque déduction garde sa source. |

## Lisibilité et fidélité

**Lisibilité**
- L'ancienne version demandait de lire et de remplir avant de voir un résultat.
- La version actuelle montre d'abord le résultat, puis ce qui le ferait changer : une carte avant → après, avec une jauge à 4 crans.
- Les deux versions respectent la police minimale de 12 px ; c'est vérifié par test.

**Fidélité à la thèse Lô (2013)**
- Moteur Bora : même forward des deux côtés, ce que vérifient les tests de conformité, inchangés.
- La version actuelle ajoute :
  - un plus petit changement exact par programmation dynamique, sans échantillonnage, prouvé égal à la force brute ;
  - un garde-fou qui écarte toute réponse du LLM contredisant le calcul.

## Ce qui est meilleur, ce qui l'est moins

**Meilleur dans la version actuelle**
- Rapidité : 1 à 2 clics au lieu de 12 à 15 jusqu'au résultat.
- Moins de texte sur chaque écran (de 3 % à 53 % de mots en moins que l'ancienne version).
- Exemples plus réalistes.
- Calcul exact et rapide : 3 à 234 ms pour le plus petit changement sur les énoncés de test, contre 48 s avant sur supply-appro.
- Champs de saisie directement dans le fil : seuils, objectif, options, échéance.

**Meilleur dans l'ancienne version, et ce qui a été fait**
1. **Contexte de l'alerte.** Depuis Supply, l'ancien Comprendre affichait les faits de l'alerte : entités concernées, valeur observée, autres signaux. **Retour arrière** : ces faits sont de nouveau disponibles dans le dialogue, sous « Faits » (repliés).
2. **Suivre plus sobre.** L'ancien tableau de bord n'affichait pas les coalitions Sow en tête (222 mots contre 698 avant l'épuration). **Retour arrière** : « Améliorer » est replié et le tableau de bord vient en premier.
3. **Contexte externe (PESTEL).** L'ancien panneau « Ce qu'Aura comprend » l'affichait en continu. Il reste disponible dans le mode Détail (Comprendre), et n'est plus affiché d'office dans le fil.
4. **Questions de cadrage guidées.** L'ancienne version posait les questions une à une et laissait le temps de réfléchir, ce qui est plus pédagogique pour un premier usage. Elles restent accessibles dans le mode Détail (« ← Revoir les questions »).

## Conclusion

La version actuelle est nettement plus rapide et plus lisible, sans perte de fonction. Là où l'ancienne version montrait mieux le contexte (faits de l'alerte, Suivre sobre), l'actuelle y revient. PESTEL et le questionnaire pas à pas restent disponibles, à la demande, dans le mode Détail.
