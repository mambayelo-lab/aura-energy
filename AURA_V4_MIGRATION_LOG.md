# AURA V4 — Journal de migration

Date : 2026-07-13  
Branche : `claude/tender-johnson-jlccrf`  
Commit : `5cfec17`

## Fichiers modifiés

| Fichier | Avant | Après | Raison | Impact V2/V3 |
|---------|-------|-------|--------|--------------|
| `src/routes/cockpit.v4.decisions.tsx` | Importait DIE, patternToDIEInputs, predictPatternConsequences directement. DEMO_FACTS, DEMO_CRITERIA en dur. `runDecisionIntelligenceEngine()` appelé au niveau module. | Importe `executeV4Decision` et types V4. `adaptV4ToLegacy()` pour compatibilité composants. DEMO_RESULT déterministe. | Supprimer toute logique métier des routes. | Aucun — route V4 uniquement |
| `src/routes/cockpit.v4.library.tsx` | Utilisait `usePatternStore()` + `store.search()` → `DecisionPattern[]`. Affichage de champs V2/V3 (difficulty, estimatedTime, methods, author). | Loader TanStack (`getV4Patterns()`). Filtre client-side sur `V4DecisionPattern[]`. `store.setActive()` gardé pour navigation. Champs V2/V3 supprimés du rendu. | Connecter au repository Supabase. | Aucun — route V4 uniquement |

## Fichiers créés

| Fichier | Description | Impact V2/V3 |
|---------|-------------|--------------|
| `src/lib/engine/v4/types.ts` | Contrats TypeScript V4 exclusifs. `V4_ENGINE_VERSION = "4.0.0"`, `V4_SCHEMA_VERSION = "v4"`. | Aucun — fichier neuf |
| `src/lib/engine/v4/execute-decision.ts` | Façade unique `executeV4Decision()`. DEMO_FACTS isolés ici. Déterministe. | Aucun — fichier neuf |
| `src/lib/engine/v4/coalition-adapter.ts` | Traduction `V4CriterionEvaluation[]` → `TwoAdditiveCapacity`. Appelle `validateCapacity`, `choquet`, Shapley, Worth. Ne modifie pas le module coalition. | Aucun — fichier neuf |
| `src/lib/v4/pattern-repository.server.ts` | CRUD patterns Supabase + fallback PatternStore. Méthodes : getAll, getById, save, publish, archive, search, saveVersion. | Aucun — fichier neuf |
| `src/lib/v4/session-repository.server.ts` | Persistance sessions, inputs, résultats, traces dans tables `v4_*`. | Aucun — fichier neuf |
| `src/lib/v4/server-functions.ts` | 7 server functions validées Zod : getV4Patterns, getV4Pattern, saveV4Pattern, createV4DecisionSession, executeV4DecisionSession, getV4DecisionResult, runV4WhatIf. | Aucun — fichier neuf |
| `supabase/migrations/20260713000001_v4_tables.sql` | 6 tables préfixées `v4_` avec RLS, index, trigger. Isolation complète des tables V2/V3. | Aucun — tables nouvelles |
| `AURA_V4_CHANGE_SCOPE.md` | Document de périmètre écrit avant tout code. | N/A |
| `AURA_V4_ARCHITECTURE.md` | Vue d'ensemble architecture V4. | N/A |

## Fichiers inchangés (lus, validés, non modifiés)

| Fichier | Statut |
|---------|--------|
| `src/lib/v4/decision-intelligence-engine.ts` | Lu — aucune modification. DIE reste le moteur de calcul. |
| `src/lib/v4/pattern-engine.ts` | Lu — aucune modification. `patternToDIEInputs`, `predictPatternConsequences`, `scenarioColorMap` inchangés. |
| `src/lib/v4/pattern-store.ts` | Lu — aucune modification. Singleton gardé pour `setActive()` et fallback. |
| `src/data/domain/patterns.ts` | Lu — aucune modification. 41 patterns, types, SECTOR_LABELS. |
| `src/lib/engine/coalition/` | Non touché. 54 tests passants garantis. |
| Toutes les routes V2/V3 | Non touchées. |
| Tous les anciens démonstrateurs | Non touchés. |

## Décisions d'architecture

### Adaptateur LegacyDIEResult
Les composants d'affichage existants (`ScoreCard`, `EvidencePanel`, etc.) attendent `LegacyDIEResult`. Plutôt que de les réécrire (blast radius élevé), `adaptV4ToLegacy()` dans la route mappe `V4DecisionResult → LegacyDIEResult`. Les composants sont inchangés.

### Persistance non-bloquante
`executeV4DecisionSession` retourne le résultat immédiatement. La persistance Supabase s'exécute dans un try/catch non-bloquant. Si Supabase échoue, le résultat est toujours retourné à l'UI.

### Fallback PatternStore
`PatternRepository.getAll()` essaie Supabase d'abord. En cas d'erreur ou de données vides, retombe sur `PatternStore.getAll()` (in-memory, 41 patterns). Garantit le fonctionnement sans Supabase configuré.

### Mode démo isolé
`DEMO_FACTS` vit uniquement dans `execute-decision.ts`. La route ne connaît pas les faits de démo. `mode="demo"` → `executeV4Decision` injecte les faits. `mode="live"` sans faits → pas d'injection silencieuse, résultat UNKNOWN.

## Rollback

Pour revenir à l'état précédent :
```bash
git revert 5cfec17
```
Les tables Supabase peuvent être droppées manuellement (elles n'ont aucune FK vers les tables V2/V3).
