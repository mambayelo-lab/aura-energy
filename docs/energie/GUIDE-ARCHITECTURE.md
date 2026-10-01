# Guide d'architecture — Aura Énergie

> SI et données fictifs. Périmètre générique d'un opérateur d'actifs renouvelables et flexibles multi-pays.

## Couches

| Couche | Contenu | Rôle d'Aura |
|---|---|---|
| Terrain | Actifs (éolien, solaire, hydro, thermique, BESS, hybrides), RTU | aucun |
| Communication pays | SCADA générique IEC 104 / OPC UA, liens centre–pays | lit l'état des liens |
| Conduite | Centres pays et central, orchestrateur de consignes, suivi temps réel, historian, journaux de quart | lit acquittements, écarts, qualité |
| Planification & marchés | Programmes DA/ID, aFRR/mFRR, BESS, connecteur TSO | lit engagements, SoC requis |
| Transverses | Référentiel d'actifs, indisponibilités, GMAO, REMIT, monitoring réseau | lit statuts, échéances, correspondances |
| Décision | Aura : règles causales, cockpit, Décider | qualifie et instruit la décision ; **n'émet aucune consigne** |

## Principes

- Aura ne calcule rien : toute valeur dérivée (écart, retard, conflit) est publiée par l'outil source.
- Aucun agent n'émet de consigne ; la sortie d'une alerte est une question de décision et des leviers.
- Comparaison d'options qualitative (moteur `src/lib/engine/lo/*`, inchangé).
- Mode dégradé : sans SI joignable, lecture de l'instantané embarqué, signalée à l'écran.

## Décisions stratégiques outillées

Investissement BESS, hybridation, choix des marchés de services système, mutualisation des centres de conduite, modèle central/pays, automatisation REMIT, référentiel d'actifs unique, redondance des liens centre–pays (`src/lib/v4/strategic-examples.ts`).
