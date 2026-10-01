# Générateur de leviers, options et indicateurs : ancien, actuel, corrigé

Ce document compare trois états du générateur, sur les 5 mêmes énoncés Supply Chain :

1. double sourcing ou accord-cadre ;
2. hub régional ou prestataire logistique (3PL) ;
3. prévision de demande avant la promotion de Noël ;
4. retard transport Asie-Europe ;
5. nouveau WMS/TMS ou évolution de l'outil actuel.

Les trois états comparés sont les suivants :

- **Ancien** (commit `2df68072`, 22 septembre) : `generateFullModel`, un prompt MCD-E de 15 000 caractères, précédé d'une élicitation (8 champs, PESTEL en 6 dimensions, questions discriminantes). Il a été rejoué tel quel, sur le même modèle de langage.
- **Actuel** (avant correctif) : « Décider vite ». Déduction heuristique, puis le LLM propose les options et 3 à 5 critères. Les leviers et les indicateurs viennent des gabarits métier.
- **Corrigé** : même dialogue, mais le LLM propose aussi un modèle propre au problème. Ce modèle est vérifié et ramené aux cibles. S'y ajoutent un PESTEL et des questions de cadrage. Le secours sans LLM a aussi été corrigé.

Données brutes : `scratchpad/chantier-suivant/comparaison-generateur*.json`, produites par le script de comparaison `scripts/compare-generator.mts`.

## Mesures (moyenne, et plage sur les 5 énoncés)

| | Ancien | Actuel | Corrigé |
|---|---|---|---|
| Objectifs (MOE) | 5,4 (5–6) | 2 | 2 |
| Critères (MOP) | 9,2 (6–12) | 3 | 3 |
| Indicateurs (TPM) | 22 (9–33) | 7 | 7 (5–8) |
| Leviers | 9,6 (9–10) | 4 | 4,6 (4–5) |
| Options au total (par levier) | 34,8 (4–5 par levier) | 9,2 (2–3) | 14,4 (2–4) |
| Options justifiées | toutes | toutes | toutes |
| Temps de génération | 30 s | 7 s | 15 s |
| Questions posées | élicitation de 8 champs, PESTEL en 6 dimensions, questions discriminantes | 1, souvent générique (« Quel est l'objectif principal ? ») | 3 questions de cadrage ciblées (par exemple « Quelle capacité aérienne est disponible ? ») et au plus 3 questions de complétude |
| PESTEL | oui, saisi par l'utilisateur | absent | proposé (3 à 6 facteurs), replié dans Comprendre, repris dans les risques |

## Qualité

- **Pertinence et richesse.**
  - L'ancien générateur était nettement plus spécifique. Ses indicateurs étaient des paramètres du domaine, avec unité (« Délai moyen de transit Asie-Europe (jours ouvrés) », « Rayon de couverture effectif (km) »). Ses leviers aussi (« Hub de contournement : Istanbul / Dubaï / Mumbai »), et il proposait des options latérales.
  - Le dialogue actuel retombait sur des libellés de gabarit (« Délai de livraison », « Routier / Multimodal rail-route » pour un retard Asie-Europe).
  - Le corrigé retrouve cette spécificité (« Localisation du hub régional », « Taux de livraison en 24 h », « Temps de reprise après incident pendant les pics ») sans en reprendre le volume.
- **Cohérence.**
  - L'ancien dépassait largement les cibles (jusqu'à 33 indicateurs et 39 options), ce qui submerge l'utilisateur et rend l'arbitrage lourd.
  - L'actuel mêlait des indicateurs hors sujet : « Dépendance à un fournisseur unique » dans un problème de prévision.
  - Le corrigé tient les cibles : 3 à 5 leviers, 2 à 4 options par levier, 5 à 8 indicateurs, 2 ou 3 critères, 1 ou 2 objectifs. Un modèle hors cible est tronqué, jamais gonflé. Les indicateurs fournisseur ne restent que dans les profils fournisseur et géopolitique.
- **Questions.** L'ancien en posait beaucoup avant de produire quoi que ce soit. Le corrigé produit d'abord le modèle, puis propose 3 questions de cadrage cliquables, spécifiques à l'énoncé, et garde les questions de complétude (3 au plus).

## Ce qui a été rétabli

- Le modèle propre au problème, produit par le LLM : objectifs, critères, indicateurs précis et leviers aux options nommées, dont une option latérale. Il est vérifié par `sanitizeModele`, ramené aux cibles, et sans chiffre inventé.
- Le PESTEL : section « Contexte externe (PESTEL) », repliée dans Comprendre. Le LLM la pré-remplit, avec un secours Supply si le LLM ne répond pas. Les deux premiers facteurs alimentent les risques.
- Des questions de cadrage ciblées, cliquables pour répondre dans le fil.
- Un secours sans LLM plus cohérent :
  - les profils Supply par situation ont des indicateurs propres (précision de la prévision, stock en fin de promotion, délai de transit) ;
  - la dépendance fournisseur n'apparaît plus hors propos.

## Ce qui n'a pas été repris

- Le volume de l'ancien générateur (22 indicateurs et 35 options en moyenne) : il contredit la simplicité demandée.
- L'élicitation préalable en 8 champs : les mêmes informations sont maintenant déduites de l'énoncé ou demandées par au plus 3 questions.

Tests : `src/lib/v4/__tests__/modele-pestel.test.ts` (modèle LLM ramené aux cibles, PESTEL repris dans les risques, secours) et `supply-profiles.test.ts` (un test par type d'alerte).
