# AURA V4 — Architecture

## Vue d'ensemble

```
UI (routes /cockpit/v4/*)
        │
        ▼
server-functions.ts          ← createServerFn (TanStack Start)
        │
        ├── PatternRepository.server.ts   ← Supabase v4_decision_patterns (+ fallback PatternStore)
        ├── SessionRepository.server.ts   ← Supabase v4_decision_sessions / v4_scenario_results
        └── executeV4Decision()           ← façade unique
                │
                ├── PatternStore.getById()         ← résolution pattern
                ├── runDecisionIntelligenceEngine() ← DIE inchangé (5 sous-moteurs)
                ├── predictPatternConsequences()   ← pattern-engine inchangé
                ├── evalPareto()                   ← fonction pure
                ├── buildConfidence()              ← déterministe, pas de Math.random
                └── runCoalitionAnalysis()         ← via coalition-adapter.ts (optionnel)
                        │
                        └── module coalition/      ← INCHANGÉ (54 tests)
```

## Couches

| Couche | Fichiers | Responsabilité |
|--------|----------|----------------|
| Types | `src/lib/engine/v4/types.ts` | Contrats V4 exclusifs, sans import V2/V3 |
| Façade | `src/lib/engine/v4/execute-decision.ts` | Point d'entrée unique, déterminisme garanti |
| Adaptateur | `src/lib/engine/v4/coalition-adapter.ts` | Traduction V4 ↔ module coalition |
| Repository patterns | `src/lib/v4/pattern-repository.server.ts` | CRUD patterns, Supabase-first |
| Repository sessions | `src/lib/v4/session-repository.server.ts` | Persistance sessions et résultats |
| Server functions | `src/lib/v4/server-functions.ts` | Frontière client/serveur (Zod + createServerFn) |
| Routes | `src/routes/cockpit.v4.*.tsx` | UI pure, zéro formule métier |

## Règles invariantes

1. **CAP = min(valeur, faisabilité)** — calculé dans `execute-decision.ts`, jamais dans l'UI.
2. **Pas de Math.random() ni Date.now()** dans les chemins de calcul V4.
3. **mode="demo"** → DEMO_FACTS isolés dans `execute-decision.ts` ; la route ne connaît pas les faits.
4. **mode="live" sans faits** → résultat UNKNOWN (pas d'injection silencieuse).
5. **Coalition** appelée uniquement si `includeCoalition: true` ; le module coalition n'est jamais modifié.
6. **Persistance non-bloquante** : les erreurs Supabase ne bloquent pas le retour du résultat.
7. **Fallback in-memory** : si Supabase indisponible, PatternStore sert les patterns.

## Tables Supabase V4

| Table | Clé | Description |
|-------|-----|-------------|
| `v4_decision_patterns` | TEXT PK | Patterns avec schéma JSONB (critères, questions, alternatives) |
| `v4_pattern_versions` | UUID PK | Snapshots immuables pour audit |
| `v4_decision_sessions` | UUID PK | Chaque exécution enregistrée |
| `v4_session_inputs` | UUID PK | Facts + assumptions d'entrée |
| `v4_scenario_results` | UUID PK | Résultats complets (scores, coalition, pareto) |
| `v4_calculation_traces` | UUID PK | Traces de calcul pour reproductibilité |

Toutes les tables ont RLS activé. Trigger `trg_v4_patterns_updated_at` sur `v4_decision_patterns`.

## Flux de données — exécution d'une décision

```
1. Utilisateur clique "Analyser" dans cockpit.v4.decisions.tsx
2. Route appelle executeV4DecisionSession({ question, patternId, facts, mode })
3. server-functions.ts valide avec Zod → appelle executeV4Decision()
4. executeV4Decision() :
   a. Résout pattern via PatternStore.getById(patternId)
   b. Construit DIEInputs via patternToDIEInputs()
   c. Exécute runDecisionIntelligenceEngine(inputs) → DIEResult
   d. Prédit conséquences via predictPatternConsequences()
   e. Mappe scores → V4ScenarioResult[]
   f. evalPareto() → pareto frontier
   g. buildConfidence() → V4ConfidenceResult
   h. makeTrace() → V4CalculationTrace[]
   i. (optionnel) runCoalitionAnalysis() via coalition-adapter
   j. Retourne V4DecisionResult
5. server-functions.ts persiste en arrière-plan (SessionRepository)
6. Route reçoit V4DecisionResult → adaptV4ToLegacy() → affiche via composants existants
```
