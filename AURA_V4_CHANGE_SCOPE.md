# AURA V4 — Document de périmètre des changements

> Produit avant tout code. Ce document doit être relu et validé avant de toucher le moindre fichier.

**Date** : 13 juillet 2026  
**Portée** : Consolidation V4 uniquement — V2 et V3 non touchés  
**Règle d'or** : Toute modification d'un module partagé doit rester rétrocompatible et les 54 tests Coalition doivent rester verts.

---

## 1. Photographie de l'existant V4

### Fichiers V4 existants

| Fichier | Lignes | État actuel |
|---------|--------|-------------|
| `src/routes/cockpit.v4.tsx` | 7 | Shell parent — inchangé |
| `src/routes/cockpit.v4.decisions.tsx` | 960 | Données démo hardcodées dans la route, DIE appelé directement |
| `src/routes/cockpit.v4.library.tsx` | 425 | PatternStore in-memory, perd les données au reload |
| `src/routes/cockpit.v4.studio.tsx` | 905 | UI Studio V4 — partiellement fonctionnel |
| `src/lib/v4/decision-intelligence-engine.ts` | 536 | Moteur DIE propre — aucun Math.random, ConfidenceEngine calculé |
| `src/lib/v4/pattern-engine.ts` | 282 | Bridge Pattern → DIE, 5 modèles d'impact |
| `src/lib/v4/pattern-store.ts` | 140 | Singleton in-memory + hooks React |
| `src/data/domain/patterns.ts` | 1050 | 41 patterns, 7 secteurs, types domaine |

### Module Coalition (existant, NON branché à V4)

| Fichier | État |
|---------|------|
| `src/lib/engine/coalition/*.ts` (11 fichiers) | 54 tests verts, non modifiés |

### Problèmes identifiés dans l'existant V4

1. **DEMO_\* hardcodés dans la route** : `DEMO_ALTERNATIVES`, `DEMO_FACTS`, `DEMO_CRITERIA`, `DEMO_ASSUMPTIONS`, `DEMO_CANDIDATE_QUESTIONS`, `RECENT_CONVS` — tous dans `cockpit.v4.decisions.tsx`
2. **DIE appelé au module-load** : `const DIE_RESULT = runDecisionIntelligenceEngine(...)` au niveau module → pas de session, pas de persistence
3. **PatternStore 100% in-memory** : perd tout au reload
4. **Coalition non connecté** : `src/lib/engine/coalition/` existe mais aucune route V4 ne l'utilise
5. **Aucune table Supabase V4** : zéro persistence
6. **Aucun test V4** : zéro test unitaire ou d'intégration
7. **Aucune server function V4** : calculs dans le browser
8. **Pas de façade unique** : la route appelle directement `runDecisionIntelligenceEngine`

---

## 2. Fichiers V4 qui seront modifiés

| Fichier | Type de modification | Raison |
|---------|---------------------|--------|
| `src/routes/cockpit.v4.decisions.tsx` | Refactoring — supprimer calculs locaux | Déplacer DEMO_* vers moteur, appeler server function |
| `src/routes/cockpit.v4.library.tsx` | Refactoring — connecter repository | Persistence Supabase via pattern-repository |
| `src/routes/cockpit.v4.studio.tsx` | Refactoring mineur | Connecter CRUD patterns au repository |
| `src/lib/v4/pattern-store.ts` | Extension — ajouter mode repository | Garder in-memory pour compatibilité, ajouter synchro DB |

---

## 3. Nouveaux fichiers V4

| Fichier | Rôle |
|---------|------|
| `src/lib/engine/v4/types.ts` | Types V4 dédiés (V4DecisionInput, V4DecisionResult, etc.) |
| `src/lib/engine/v4/execute-decision.ts` | Façade unique `executeV4Decision()` |
| `src/lib/engine/v4/coalition-adapter.ts` | Adaptateur V4 → module coalition existant |
| `src/lib/engine/v4/confidence.ts` | Calcul confiance V4 avec composantes explicites |
| `src/lib/v4/pattern-repository.server.ts` | Repository Supabase pour patterns V4 |
| `src/lib/v4/session-repository.server.ts` | Repository Supabase pour sessions V4 |
| `src/lib/v4/server-functions.ts` | Server functions TanStack Start V4 |
| `supabase/migrations/20260713000001_v4_tables.sql` | 6 tables V4 |
| `src/__tests__/v4/execute-decision.test.ts` | Tests façade V4 |
| `src/__tests__/v4/coalition-adapter.test.ts` | Tests adaptateur coalition |
| `src/__tests__/v4/confidence.test.ts` | Tests confiance V4 |
| `src/__tests__/v4/pattern-repository.test.ts` | Tests repository patterns |
| `AURA_V4_ARCHITECTURE.md` | Document architecture cible |
| `AURA_V4_MIGRATION_LOG.md` | Journal des modifications |

---

## 4. Modules partagés appelés (lecture seule)

| Module | Usage V4 | Rétrocompatibilité |
|--------|----------|--------------------|
| `src/lib/engine/coalition/*.ts` | Via coalition-adapter.ts uniquement | ✓ Aucune modification |
| `src/lib/v4/decision-intelligence-engine.ts` | Appelé par execute-decision.ts | ✓ Aucune modification |
| `src/lib/v4/pattern-engine.ts` | Appelé par execute-decision.ts | ✓ Aucune modification |
| `src/data/domain/patterns.ts` | Types importés par types.ts | ✓ Aucune modification |

---

## 5. Fichiers V2/V3 explicitement exclus

Les fichiers suivants ne seront **pas touchés** :

```
src/routes/cockpit.index.tsx
src/routes/cockpit.v2.*.tsx
src/routes/cockpit.v3.*.tsx
src/routes/studio.*.tsx  (hors cockpit.v4.studio.tsx)
src/lib/engine/index.ts  (moteur d'agrégation V3)
src/lib/engine/pipeline.ts
src/lib/cap.ts
src/lib/whyEngine.functions.ts
src/lib/llm.server.ts
src/__tests__/coalition/*.test.ts  (54 tests existants intouchables)
```

---

## 6. Tables Supabase utilisées

### Nouvelles tables (migration 20260713000001_v4_tables.sql)

```sql
v4_decision_patterns    -- patterns persistés avec schema_version = 'v4'
v4_pattern_versions     -- historique des versions
v4_decision_sessions    -- sessions de décision
v4_session_inputs       -- faits et réponses par session
v4_scenario_results     -- résultats calculés
v4_calculation_traces   -- traces d'audit reproductibles
```

### Tables existantes réutilisées (lecture seule depuis V4)

Aucune — V4 a ses propres tables pour éviter toute régression.

---

## 7. Risques de régression

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Import circulaire entre v4/types.ts et engine/coalition/ | Faible | types.ts n'importe pas de coalition |
| PatternStore in-memory cassé pour V3 (si utilisé) | Faible | V3 n'utilise pas PatternStore |
| Migration Supabase bloque les migrations suivantes | Très faible | Préfixe v4_ isolé |
| Tests Coalition cassés par des imports V4 | Nul | Coalition non modifié |
| cockpit.v2/v3 cassés par refactoring des routes V4 | Nul | Routes V4 isolées dans /cockpit/v4/* |

---

## 8. Stratégie de rollback

1. **Nouveaux fichiers** : suppression directe — aucun impact ailleurs
2. **Modifications de routes V4** : git revert ciblé sur `cockpit.v4.decisions.tsx` et `cockpit.v4.library.tsx`
3. **Migration Supabase** : script `DROP TABLE IF EXISTS v4_*` dans une nouvelle migration — tables isolées
4. **PatternStore** : garde la logique in-memory intacte, repository est une couche additionnelle

**Point de non-retour** : Il n'y en a pas — toutes les modifications sont additives ou isolées dans le namespace V4.

---

## 9. Ordre d'implémentation

```
① types.ts                    (aucune dépendance)
② coalition-adapter.ts         (dépend : types.ts + module coalition existant)
③ execute-decision.ts          (dépend : types.ts + DIE existant + coalition-adapter)
④ migration SQL                (aucune dépendance code)
⑤ pattern-repository.server.ts (dépend : migration)
⑥ session-repository.server.ts (dépend : migration)
⑦ server-functions.ts          (dépend : execute-decision + repositories)
⑧ refactoring routes V4        (dépend : server-functions)
⑨ tests V4                     (dépend : tous les précédents)
⑩ documents finaux
```

---

*Ce périmètre est figé. Toute déviation doit être documentée dans AURA_V4_MIGRATION_LOG.md.*
