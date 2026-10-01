# Aura Énergie

> **SI et données fictifs ; données publiques ENTSO-E citées ; aucun lien avec un opérateur réel.**

## Objectif

Déclinaison **énergie (renouvelables & flexibilité)** d'Aura : un cockpit qui lit le SI d'un producteur multi-pays, applique des règles causales (SI … ALORS …) et ouvre les décisions dans **Décider**, avec une comparaison qualitative des options. Aura ne calcule rien à la place du SI et **aucun agent n'émet de consigne**.

Terrain de démonstration : le SI fictif **Héliade Énergies** ([mambayelo-lab/heliade-energies-si](https://github.com/mambayelo-lab/heliade-energies-si)) — FR, ES, BE, DE ; éolien, solaire, hydro, thermique, BESS, hybrides.

## Ce qui est livré

- `/cockpit/energie` : 8 alertes causales — consigne non confirmée/non exécutée, indisponibilité en conflit avec un engagement aFRR/mFRR, SoC BESS incompatible avec le programme, UMM/REMIT en retard, télémesure figée, perte de lien centre–pays (mode dégradé), consigne centrale contraire à une contrainte locale, écart d'identifiants entre référentiels.
- Décisions stratégiques énergie dans Décider (investissement BESS, hybridation, marchés de services système, mutualisation des centres de conduite, modèle central/pays…).
- Connecteur Héliade (`src/lib/energy/heliade.ts`) avec repli sur instantané embarqué.
- Documentation : [docs/energie/](docs/energie/) — intégration des données, ontologie, catalogue des règles causales, matrice alertes × données, questionnaire Studio et profils Décider, guide d'architecture.

## Lancer

```bash
npm install
npm run dev                                  # http://localhost:3000/cockpit/energie
npx vitest run src/lib/energy                # règles causales
npx playwright test src/test/e2e/cockpit-energie.spec.ts
npx tsx scripts/gen-energy-docs.ts           # régénère docs/energie
```

## Déploiement Vercel

`vercel.json` : région `cdg1`, déploiements uniquement depuis `main`. Si le projet n'existe pas : **Vercel → Add New Project → Import Git Repository** (`mambayelo-lab/aura-energy`) **→ Region `cdg1`**. Variables d'environnement : voir [docs/energie/INTEGRATION-DONNEES.md](docs/energie/INTEGRATION-DONNEES.md) (`VITE_HELIADE_URL`, `SUPABASE_*`, `MISTRAL_API_KEY`, …). Aucun secret n'est commité (`.env.example`).

## Licence

Propriétaire — © 2026 Mambaye Lo, tous droits réservés (dépôt privé). Les données ENTSO-E restent soumises aux conditions de la plateforme ENTSO-E Transparency.
