# Intégration de données : connecter le SI d'une grande entreprise sans le surcharger

Ce document décrit le dispositif d'intégration d'Aura Supply : comment une entreprise déclare ses sources, comment Aura s'y connecte, ce qu'Aura calcule, ce qu'Aura stocke, et ce qu'Aura garantit au SI client. Les mesures viennent d'un banc d'essai de 5 sources et de 68 millions de lignes.

Code : `src/lib/integration/`. Studio : `src/components/aura/studio/IntegrationJourney.tsx`. SI de test : dépôt `maison-lucie-si` (`lib/multisource-gen.js`, `api/sources/[source].js`).

---

## 1. Le dispositif en 4 étapes

Le Studio ne sert qu'à une chose : connecter le SI. Il suit 4 étapes, avec une seule action principale par écran et un indicateur de progression.

| Étape | Action principale | Ce qu'Aura fait |
|---|---|---|
| 1. Cartographier | Importer le questionnaire rempli | Crée les sources, le maître par attribut et les connecteurs à configurer. Contrôle l'import : lignes incomplètes, maître manquant, maîtres multiples. |
| 2. Connecter | Tester les connexions | Résout les identifiants côté serveur, teste chaque source (vert, orange, rouge), lit les métadonnées et un échantillon limité, propose les correspondances de champs. |
| 3. Vérifier | Mettre à jour maintenant | Montre la couverture par objet (%), le score de rapprochement par source et les écarts entre sources. On y valide, corrige ou refuse chaque correspondance. |
| 4. Régler les alertes | Publier au cockpit | Seuils des alertes calculées sur les sources, puis éditeur de règles causales existant. |

Ce qui existait est gardé et intégré au parcours :

- **Gardé dans « Vérifier »** : le lignage, l'ontologie vivante et le graphe du modèle. Ils affichent désormais les vraies métadonnées lues par les connecteurs (colonnes, échantillons, correspondances validées) grâce à `vocab-bridge.ts`.
- **Gardé en étape 4** : l'éditeur de règles et d'alertes.
- **Replié sous « Avancé »** : les connexions manuelles, les métadonnées et échantillons, les indicateurs et seuils, les faits publiés, ainsi que l'ancienne démo en un clic. Ces vues restent accessibles par `/cockpit/studio?tab=…`.

### 1.1 Le questionnaire « Cartographie des sources Supply »

Le modèle Excel se télécharge depuis l'étape 1. Une version Word est aussi disponible pour les ateliers.

Il contient trois éléments :

- une notice courte en tête ;
- une ligne par objet métier et par attribut, pré-remplie à partir de l'ontologie Supply : fournisseur, article, site, stock, commande d'achat, expédition, commande client, vente, prévision ;
- une feuille d'exemple remplie pour Maison Lucie, étiquetée « démo ».

Les colonnes sont les suivantes :

- objet métier, attribut, description ;
- application(s) source(s), application maître ;
- mode d'accès (fichier, SQL, OData, REST) ;
- table ou point d'accès ;
- champ ;
- clé d'identification ;
- fréquence de mise à jour, contact ;
- tolérance d'écart.

Le questionnaire indique **quels systèmes appeler et comment y accéder**. La colonne « Champ » est **facultative** : c'est un indice, pas le mapping. Si un attribut existe dans plusieurs applications, on duplique la ligne avec le même maître.

### 1.2 Le mapping au niveau des champs, fait par Aura

Pour chaque source déclarée, Aura procède en trois temps (`discovery.ts`).

1. **Lecture des métadonnées réelles.** Selon la source, Aura lit :
   - `information_schema` pour les sources SQL ;
   - `$metadata` (EDMX) pour les sources OData ;
   - un échantillon JSON pour les API REST ;
   - le schéma Parquet ou les en-têtes CSV pour les fichiers.
2. **Lecture d'un échantillon limité.** L'échantillon fait 50 lignes par entité, en un appel, sous budget.
3. **Proposition des correspondances.** Aura rapproche chaque attribut Aura d'un champ source, avec un **score de confiance** qui combine :
   - le nom, avec des synonymes FR et EN ;
   - le type ;
   - le profil des valeurs : format EAN, SIRET, TVA, DUNS, ISO pays, codes, statuts à faible cardinalité, unicité pour les clés, bornes pour les quantités ;
   - l'indice éventuel du questionnaire.

Au-dessus de 80 %, la correspondance est validée d'office, mais reste modifiable. En dessous, **rien n'est appliqué sans validation**. Le LLM est une option non activée : le score est déterministe et explicable (nom, type, profil, indice), ce qui le rend testable.

Les tests prouvent que ce mapping est générique (`discovery.test.ts`) :

- **Les 5 sources Maison Lucie** : les champs sont retrouvés sans indice.
- **Un WMS inconnu généré aléatoirement** (noms opaques `qte_physique`, `code_depot`, `gtin_article`…, colonnes mélangées) : les 6 champs du stock sont retrouvés.
- **Des fournisseurs aux colonnes `col_a` à `col_d`** : les champs sont reconnus par le seul profil des valeurs (TVA, pays, raison sociale, clé).

---

## 2. Architecture

```
Questionnaire ─► import ─► sources + objets + ACV (maître par attribut)
                               │
      ┌────────────────────────┴───────────────────────┐
      │  SDK de connecteurs (interface commune)         │  budget par source (file serveur)
      │  SQL · SAP OData · Manhattan · REST · Kafka · fichiers │  identifiants juste-à-temps
      └────────────────────────┬───────────────────────┘
                               │ requêtes agrégées poussées à la source, lecture incrémentale
                   cache L1 / L2 / L3 (TTL par classe d'objet, clé = requête + watermark)
                               │
   référentiels légers ─► crosswalk (exact → normalisé → ressemblance à valider)
                               │
       indicateurs agrégés ─► alertes avec preuve (écarts, replis) ─► cockpit, copilote
```

### 2.1 Le SDK de connecteurs (`types.ts`, `connectors/`)

Tous les connecteurs exposent la même interface :

- `testConnection` ;
- `discoverSchema` ;
- `sample` ;
- `query(QuerySpec)` : filtre, expression, `GROUP BY`, métriques et limite, **poussés à la source** quand elle sait le faire ;
- `readIncremental(entité, watermark, depuis)`.

| Connecteur | Pushdown | Incrémental | Remarques |
|---|---|---|---|
| SQL (Postgres, Snowflake, Databricks, BigQuery, DuckDB) | filtre, expression, GROUP BY, métriques, LIMIT | pagination par clé (watermark, clé), sans OFFSET | Requêtes compilées par dialecte, identifiants contrôlés, valeurs échappées. Pilotes : DuckDB (fichiers, Postgres en lecture seule via l'extension), Snowflake SQL API, Databricks Statement API, BigQuery `jobs.query`. Seul DuckDB est testé ici ; les trois API cloud sont à valider sur un compte client. |
| SAP OData v2 | `$filter`, `$select`, `$top` | `__next` puis `!deltatoken` si le service le propose, sinon filtre sur le champ de modification | Modèles prêts : A_Supplier (LFA1), A_PurchaseOrder et A_PurchaseOrderItem (EKKO/EKPO), A_MatlStkInAcctMod (MARD), A_Product (MARA). OData v2 n'agrège pas : le calcul se fait en flux, sans rien conserver. Les champs de modification sont « à vérifier avec la documentation client ». |
| Manhattan Active | fenêtre de temps (`from`) | page/size | Noms de paramètres « à vérifier avec la documentation client ». |
| REST générique | filtres d'égalité déclarés, GROUP BY si l'API en propose un | curseur, page ou offset, `updatedAfter` | L'ancien connecteur REST a été réaligné sur le SDK. |
| Kafka (proxy REST) | — | offset = watermark | L'ancien connecteur Kafka a été réaligné. Aura lit sans groupe de consommateurs. |
| Fichiers (S3, dépôt, SFTP) | via DuckDB : projection, élagage de partitions Hive, statistiques Parquet | watermark sur colonne | CSV et Parquet, partitionnés. SFTP : synchroniser d'abord vers un dépôt ou S3 (rclone, lftp). Aura n'ouvre pas de session SFTP. |
| OData v4 | `$filter` (`eq ne gt ge lt le`), `$select`, `$top` | `@odata.nextLink` ; watermark filtré | Découverte par le document de service et `$metadata` (CSDL 4.0). |
| GraphQL | — | `limit` / `offset` | Découverte par introspection : chaque champ liste avec `limit` devient une ressource, colonnes typées. |
| SOAP 1.1 | filtre d'égalité (`filterField`) | `offset` / `nextOffset` | WSDL lu (types XSD) ; valeurs typées par `xsi:type`. |
| Salesforce | SOQL : `WHERE` (égalité, comparaisons, `IN`) | `nextRecordsUrl` ; Bulk API 2.0 (CSV, `Sforce-Locator`) pour les gros volumes | Jeton Bearer ou OAuth 2.0 client credentials ; `describe` pour les types. |
| AMQP (API HTTP RabbitMQ) | — | position lue dans `x-offset` | Lecture sans consommation ; si la file ne renvoie pas la position, une seule lecture (aucune relecture en boucle). |
| IBM MQ (REST messaging) | — | un message par appel, plafonné (`maxMessages`) | Lecture non destructive, réservée au fil de l'eau. |
| CloudEvents / webhooks | — | `X-Next-Offset`, `Link rel="next"` | Lots CloudEvents 1.0 ; les données de l'évènement deviennent la ligne. |
| CDC (Debezium) | — | position (lsn) = watermark | Rejeu `r`, `c`, `u`, `d` en état courant ; doublons de clé gérés. |
| SFTP (passerelle HTTP) | — | fichier complet, découpé en pages | Listing et téléchargement ; CSV, JSON, XML typé, Parquet (DuckDB, serveur uniquement). |
| SQL / JDBC sur HTTP | filtre, `GROUP BY`, `COUNT`, `SUM`, `MIN`, `MAX`, `AVG` | `LIMIT` / `OFFSET` | Requête compilée, identifiants contrôlés, lecture seule. |
| gRPC-web | — | `page_token` | Protobuf décodé à la main (service `lucie.v1.RowService`), colonnes typées. Pas de réflexion gRPC : ressources déclarées. |
| ESB / iPaaS | — | `meta.pagination` | Lit la sortie d'une API d'expérience (demi-flux), avec `X-Correlation-ID`. |
| SAP IDoc XML | — | `X-Next-Offset` | ORDERS05, DESADV01, CREMAS05, MATMAS05 → une ligne par poste, colonnes neutres. |
| SAP RFC / BAPI (JSON-RPC) | `OPTIONS` de `RFC_READ_TABLE` | `ROWSKIPS` / `ROWCOUNT` | Champs et types lus dans `FIELDS`. |
| EDIFACT, X12, AS2 | — | `X-Next-Offset` | EDIFACT D.96A (ORDERS, DESADV, INVOIC) et X12 004010 (850, 856, 810) analysés avec contrôle des comptes UNT/UNZ et SE/GE ; AS2 : MIC SHA-256 vérifié avant lecture. |
| MCP générique | filtres de l'outil de requête | `nextOffset` de l'outil | Se branche sur n'importe quel serveur MCP (Streamable HTTP, JSON ou SSE, `Mcp-Session-Id`) : découvre outils et ressources, puis les convertit en ressources tabulaires (métadonnées, échantillon). |

Tous ces connecteurs passent par le même gouverneur (budget, plafond de requêtes, 1 000 lignes au plus par appel, repli sur 429 et 503, disjoncteur), la même clé de cache, et produisent des lignes que le profil de colonnes et le mapping avec score traitent comme les autres. Dans le Studio, « Connecter » présente une carte par type (ce que Supply en tire, ce qu'il faut fournir) ; la lecture passe par ce SDK.

### 2.1 bis Maison Lucie par chaque canal : tableau « canal × application »

Le test `src/lib/integration/__tests__/lucie-channels.e2e.test.ts` branche Supply sur Maison Lucie par chaque canal et vérifie que les lignes lues sont **identiques** à la lecture REST de référence (ou, pour l'EDI et l'IDoc, que les champs du document redonnent ceux des tables). « = » : lignes identiques ; « champs » : correspondance champ à champ ; « — » : canal sans objet pour ce type d'application.

| Canal (connecteur) | ERP SAP | PIM | WMS | TMS | APS | SRM | QMS | OMS | RH | Data lake |
|---|---|---|---|---|---|---|---|---|---|---|
| REST, SAP OData v2 (référence) | = | = | = | = | = | = | = | = | = | = |
| OData v4 | = | = | = | = | = | = | = | = | = | = |
| GraphQL | = | = | = | = | = | = | = | = | = | = |
| SOAP | = | = | = | = | = | = | = | = | = | = |
| Salesforce (SOQL, Bulk API 2.0) | = | = | = | = | = | = | = | = | = | = |
| Kafka | = | = | = | = | = | = | = | = | = | = |
| AMQP · RabbitMQ | = | = | = | = | = | = | = | = | = | = |
| IBM MQ (20 premiers messages) | = | = | = | = | = | = | = | = | = | = |
| CloudEvents | = | = | = | = | = | = | = | = | = | = |
| CDC (Debezium, rejoué) | = | = | = | = | = | = | = | = | = | = |
| SFTP : JSON, XML, Parquet (CSV en texte) | = | = | = | = | = | = | = | = | = | = |
| gRPC-web | = | = | = | = | = | = | = | = | = | = |
| ESB / iPaaS | = | = | = | = | = | = | = | = | = | = |
| MCP (connecteur générique) | = | = | = | = | = | = | = | = | = | = |
| SQL / JDBC | — | — | — | — | — | — | — | — | — | = |
| SAP RFC (`RFC_READ_TABLE`) | = | — | — | — | — | — | — | — | — | — |
| SAP IDoc | champs | champs | — | champs | — | — | — | — | — | — |
| EDIFACT, X12 | champs | — | — | champs | — | — | — | — | — | — |
| AS2 | champs | — | — | champs | — | — | — | — | — | — |

Avant ce lot, Supply n'avait que les connecteurs REST, SAP OData v2, Manhattan, Kafka, SQL et fichiers. Ce qui est simulé côté Maison Lucie (façades, broker, AS2 sans S/MIME…) est détaillé dans `docs/SOURCES-MULTI.md` du dépôt Maison Lucie.

**Serveur MCP de Maison Lucie** : `https://maison-lucie-si.vercel.app/mcp` (Streamable HTTP), jeton `Authorization: Bearer lucie_aura_gateway_demo_token`. Outils : `list_sources`, `read_object`, `query`, `kpi_series`, `alerts` ; ressources `lucie://catalog`, `lucie://ontology`, `lucie://schema/{source}`. Configuration d'un client :

```json
{ "mcpServers": { "maison-lucie": { "type": "http", "url": "https://maison-lucie-si.vercel.app/mcp", "headers": { "Authorization": "Bearer lucie_aura_gateway_demo_token" } } } }
```

### 2.2 Référentiels, crosswalk et rapprochement (`crosswalk.ts`, `normalize.ts`)

**Un maître par domaine**, affiné par attribut (ACV, § 2.4). L'`id_or` est stable : `FRN-<clé maître>`, `ART-…`, `SITE-…`.

Le crosswalk `(domaine, système, clé_source → id_or)` se construit en trois étapes :

1. **Exacte** : même valeur que la clé du maître, ou même nom exact.
2. **Clé normalisée** :
   - SIRET et SIREN ;
   - TVA, avec contrôle de la clé française ;
   - DUNS ;
   - EAN, GTIN-14 et UPC, avec clé de contrôle ;
   - référence fabricant ;
   - code site (`WHPAR`, `wh_par` et `WH-PAR` sont équivalents) ;
   - numéro de commande (`PO-4500000001` et `4500000001` sont équivalents).

   Un identifiant fiscal saisi librement est essayé comme SIREN, TVA et DUNS.
3. **Ressemblance** de raison sociale (Jaro-Winkler et trigrammes, avec blocage par mot) : le candidat va dans une **file de validation**. Il n'est **jamais appliqué automatiquement**. Une validation est reprise aux passages suivants.

Le lien produit → fournisseur passe par le champ fournisseur du maître produit.

**Rapport par domaine et par source** : % rapproché, orphelins, doublons, conflits (une clé ambiguë comme un EAN en double n'est jamais rattachée arbitrairement), et nombre en attente de validation.

### 2.3 Cohérence des attributs multi-sources (`ownership.ts`)

- **La valeur du maître fait foi.** Les autres sources lui sont comparées, attribut par attribut.
- **Tolérance par attribut**, déclarée dans le questionnaire :
  - `exact` ;
  - `forme` : casse et forme juridique ignorées ;
  - `±N %` pour les valeurs numériques ;
  - `±N j` pour les dates.
- **Signalement dans la preuve de l'alerte.** Un écart de fond au-delà de la tolérance apparaît dans la preuve de l'alerte qui concerne l'objet, jamais dans un onglet séparé. Exemple : « écart Pays (PIM) : HK ; maître SAP S/4HANA : CN ». L'étape « Vérifier » en donne le compte.
- **Repli déclaré.** Si le maître est indisponible, Aura se replie sur la dernière copie connue du maître et le **déclare** dans la preuve (« repli fournisseurs : SAP indisponible → dernière copie »).
- **Réconciliation des identifiants** par la table de correspondance.

### 2.4 ACV Master/Consumer par attribut

Pour chaque attribut d'objet métier, l'architecte déclare une application maître et des consommatrices. Par défaut, l'attribut hérite du maître de son domaine. La validation contrôle deux règles :

- un seul maître par attribut ;
- une application ne peut pas être à la fois maître et consommatrice.

Le contrôle golden record (§ 2.3) s'appuie sur cette table.

### 2.5 Calcul à la source, incrémental, et stockage minimal (`pipeline.ts`)

| Étape | Requête poussée à la source | Stocké dans Aura |
|---|---|---|
| Référentiels | lecture incrémentale des colonnes utiles | fournisseurs, articles, sites (quelques champs) |
| Ruptures | `WHERE OnHand - Allocated < SafetyStock` (SQL) ; en API, un parcours paginé évalué en flux | positions en alerte seulement, avec leur preuve |
| Clés articles et sites | `GROUP BY ItemId`, `GROUP BY FacilityId` | crosswalk |
| Retards fournisseurs | `GROUP BY fournisseur` sur les expéditions échues, et le nombre en retard | un compteur par fournisseur |
| Commandes clients | `WHERE Statut IN (…) GROUP BY article` | quantités en attente par article. **Aucun client individuel.** |
| Ventes | `WHERE date ≥ … GROUP BY EAN` | vélocité des articles |

En incrémental, Aura lit seulement ce qui a changé depuis le watermark. Pour les expéditions, il lit d'abord les clés modifiées, puis ré-agrège seulement les fournisseurs touchés. Pour le stock, il ouvre ou ferme les alertes sur les seules positions modifiées. Les systèmes que rien n'a touché conservent leur rapprochement précédent. L'index des maîtres reste en mémoire tant que le référentiel n'a pas changé.

**Journal de chaque relevé** : durée, lignes lues, lignes stockées, appels, pushdown, watermark avant et après, erreur ou report aux heures creuses.

### 2.6 Cache à trois niveaux (`cache.ts`)

| Niveau | Support | Durée | Choisi quand |
|---|---|---|---|
| L1 | mémoire du processus | 60 s | la clé a été demandée au moins 3 fois en 10 min |
| L2 | partagé côté serveur : table Supabase `aura_int_cache`, mémoire en repli | 1 h | toujours |
| L3 | fichiers (Parquet ou JSON compressé) sur stockage objet | 24 h | gros résultats (plus de 1 Mo), référentiels, ventes |

- **Clé** : empreinte de la requête et watermark de la source. Un nouveau watermark donne une nouvelle clé.
- **TTL effectif** : le plus court entre celui du niveau et celui de la classe d'objet (référentiel 24 h, stock 1 h, expéditions 15 min).
- **Score de qualité** de chaque fait renvoyé : fraîcheur (60 %), source maître (25 %) et absence de divergence (15 %).
- **Drill-down** : il passe par le budget, puis par le cache.
- **Accès direct juste-à-temps** : autorisé seulement si la fraîcheur est critique **et** que le budget le permet (disjoncteur fermé, régime normal, moins de 80 % du plafond journalier).

### 2.7 Copilote : routage par intention (`copilot-router.ts`)

Avant tout accès à la donnée, la question est classée par intention :

| Intention | Le copilote lit | Exemple |
|---|---|---|
| structurel | l'ontologie | « quelle source est maître du pays ? » |
| factuel | les faits en cache | « combien de ruptures ? » |
| causal | les règles | « pourquoi ce retard ? » |
| temporel | l'historique | « évolution depuis un mois ? » |

Le copilote reçoit seulement le compartiment utile. **Il ne déclenche jamais d'appel à la source.**

### 2.8 Configuration versionnée et planification

- **Configuration** : versionnée côté serveur (`aura_int_configs`, une version par enregistrement) avec l'état léger (`aura_int_state`) et le journal (`aura_int_runs`), via la migration `20260929090000_aura_integration.sql`. Si Supabase n'est pas configuré côté serveur, Aura garde la configuration en mémoire de l'instance et le signale dans « Stocké dans Aura ». Le Studio garde aussi une copie locale par navigateur, pour le confort.
- **Pas de secret en clair** : un secret en clair dans la configuration est refusé à l'enregistrement.
- **Relevé planifié** (`scheduler.ts`, `/api/integration/cron` protégé par `CRON_SECRET`) :
  - deltas légers toutes les 3 heures en journée (7 h–21 h) ;
  - relevé complet la nuit ;
  - cadence modifiable par source.

  Le cron Vercel déclaré est quotidien (2 h 15), pour rester compatible avec tous les plans. Les deltas toutes les 3 heures demandent Vercel Pro (`0 7-19/3 * * *`) ou pg_cron (requêtes fournies dans la migration).
- **Mise à jour manuelle** : le bouton « Mettre à jour maintenant » lance le même relevé, sous le même budget.

---

## 3. Garanties pour le SI client

Aura est conçu pour un SI qui **ne signale pas sa surcharge** : pas de 429, pas de Retry-After. La protection ne repose sur aucun signal de la source.

1. **Ordre de préférence des modes d'accès**, présenté ainsi dans le Studio :
   1. **dépôt** : la source dépose des fichiers ou pousse des événements, Aura ne l'interroge pas ;
   2. **réplique ou data lake** : lecture sur une copie, jamais sur la production ;
   3. **API directe**, en dernier recours seulement.
2. **Plafonds fixes imposés par Aura**, prudents par défaut, quelle que soit la source :

   | Plafond | Valeur par défaut |
   |---|---|
   | Requêtes simultanées | 1 |
   | Requêtes par minute | 30 |
   | Lignes par appel | 5 000 |
   | Appels par jour | 5 000 |
   | Lignes par parcours complet en journée | 20 000 |
   | Extractions lourdes | de 22 h à 6 h |

   Sans la case « Assouplir » (`explicitRelax`), Aura applique toujours le plus prudent entre le réglage demandé et ces plafonds : l'administrateur ne peut que les **assouplir explicitement**.
3. **Ralentissement mesuré par Aura** :
   - Aura enregistre une latence de référence **par forme de requête** : une agrégation lourde n'est pas comparée à une page légère.
   - Si la latence récente dépasse ×2 la référence, Aura divise son débit par 4 et espace ses appels d'au moins la latence observée.
   - À ×4, ou si la latence continue de monter trois fois de suite, Aura **s'arrête** (disjoncteur) et réessaie après 5 minutes.
   - Un délai dépassé compte comme une erreur.
   - Le plancher de 200 ms évite de réagir au bruit réseau.
4. **Accès juste-à-temps** :
   - la configuration ne contient que des références `{{env:NOM}}` ;
   - les secrets sont résolus à l'ouverture d'une fenêtre de synchronisation ou de drill-down, puis **effacés à sa fermeture** ;
   - aucune connexion permanente n'est ouverte : les pilotes SQL sont fermés en fin de relevé, et les jetons courts sont redemandés à chaque session.
5. **Pas d'appel par ligne ni par écran** :
   - les demandes identiques en cours sont **fusionnées** : 50 utilisateurs ne produisent qu'un appel ;
   - le cockpit et le copilote lisent l'instantané d'Aura, jamais la source.
6. **Si la source signale sa surcharge** (429, 502, 503, 504), Aura applique un repli exponentiel et respecte `Retry-After`. Le disjoncteur s'ouvre après 5 erreurs.
7. **Visibilité** : pour chaque source, les appels et lignes lus par jour sont affichés au regard du plafond (étapes « Connecter » et « Vérifier »).

**Tests** (`budget.test.ts`) :

- 200 utilisateurs simultanés ne dépassent jamais le plafond : au plus 5 démarrages par fenêtre et 1 appel simultané, avec fusion des doublons ;
- les plafonds ne s'assouplissent pas sans demande explicite ;
- une extraction lourde est refusée de jour, et un delta accepté ;
- `Retry-After` est respecté ;
- **simulateur muet** : la source ralentit sans jamais renvoyer d'erreur. Aura passe en « ralenti » (appels espacés), puis s'arrête (`SOURCE_SLOW`).

En charge (`scripts/integration-load.mts`, API à la volée de Maison Lucie, 1 000 000 d'articles) : 201 appels, jamais plus d'un appel simultané, plafond par minute respecté. Les 50 demandes identiques ont donné **1 appel**, les 49 autres ont été fusionnées.

---

## 4. Lecture DDD

- **Chaque source est un bounded context.** SAP, le PIM, le WMS, l'OMS et le lac ont leur propre modèle et leurs propres clés : LIFNR, EAN, référence interne, GTIN-14, code site sans tiret.
- **Chaque connecteur, avec son mapping, est une Anticorruption Layer.** La traduction vers le modèle d'Aura se fait à la frontière : correspondances de champs validées, normalisation des clés, crosswalk. Rien du modèle source ne fuit dans le cœur d'Aura.
- **L'ontologie Aura sert de Published Language.** Les objets et attributs Supply structurent le questionnaire, le mapping, les alertes et le copilote.
- **Aura n'est pas Conformist** aux modèles des sources. Il ne reprend ni leurs noms ni leurs structures : il les traduit.
- **La relation avec les sources est de type Customer/Supplier.** Aura est client de sources qui gardent la main. La politique de sollicitation (budget, fenêtres, mode d'accès) encadre cette relation, comme un contrat de service.
- **L'application maître par attribut est la règle d'arbitrage** entre contextes : sa valeur fait foi, et les autres sont comparées selon la tolérance déclarée.

---

## 5. SI de test : Maison Lucie, 5 sources

Maison Lucie expose 5 sources, chacune avec ses propres clés :

| Source | Rôle | Interface | Clés |
|---|---|---|---|
| SAP S/4HANA | maître fournisseurs, commandes d'achat | OData v2 : `$filter`, `$select`, `$top`, `__next`, `!deltatoken`, `$metadata` | LIFNR |
| PIM | maître produits | REST : curseur, `updatedAfter` | productId, EAN, identifiant fiscal fournisseur en saisie libre |
| Manhattan Active WM | stock, expéditions, sites | REST : page/size, fenêtre temporelle | GTIN-14, FacilityId sans tiret |
| OMS | commandes clients | REST ou fichier CSV | référence interne, casse libre |
| Data lake | ventes | CSV, agrégats | EAN, code magasin en minuscules |

**Erreurs volontaires**, documentées dans `maison-lucie-si/docs/SOURCES-MULTI.md` et retrouvées par Aura :

- fournisseurs en double (autre LIFNR, raison sociale en majuscules, SIRET espacé) ;
- produits dont le fournisseur est inconnu ;
- EAN en double ;
- GTIN inconnus ;
- site `WHXXX` ;
- raisons sociales variantes dans le WMS ;
- références en minuscules ;
- pays fournisseur divergent entre le PIM et SAP.

**Deux tailles, un seul générateur déterministe** (graine fixe, `lib/multisource-gen.js`) :

- **démo** : environ 13 000 lignes, servies en ligne ;
- **scale** :
  - 5 025 fournisseurs ;
  - 1 000 000 d'articles ;
  - 500 sites ;
  - 5 000 000 de positions de stock ;
  - 1 000 000 d'expéditions ;
  - 10 000 000 de lignes de commande ;
  - 50 000 000 de ventes.

La taille scale est disponible de deux façons :

- **à la volée**, en ligne, en ajoutant `size=scale` à toute ressource : chaque page est calculée à partir de son rang, sans rien stocker, en pagination seule ;
- **en Parquet**, par `npm run generate:scale` (230 s, 520 Mo zstd dans `/tmp/maison-lucie-scale`).

Un test vérifie que le générateur JavaScript et le générateur SQL DuckDB produisent **les mêmes lignes**, table par table.

---

## 6. Mesures (banc d'essai à l'échelle)

Machine : 4 vCPU, 15 Go de RAM. Script : `scripts/integration-bench.mts`.

Le banc suit le même parcours que le Studio : même questionnaire, en dépôt de fichiers Parquet, découverte des métadonnées, correspondances, puis synchronisation. Le budget est assoupli explicitement pour simuler une nuit : 250 000 lignes par appel.

| Mesure | Résultat |
|---|---|
| Découverte : métadonnées, échantillons, 44 correspondances | 0,4 s. 42 correspondances validées d'office, 2 à valider. |
| Premier chargement complet (68 M lignes à la source) | 78 s |
| Incrémental (10 000 positions de stock modifiées) | 21 s, dont 7 s d'accès aux sources |
| Lignes remontées vers Aura au premier chargement | 3,5 M, soit environ 5 % des lignes sources. Le reste est agrégé à la source. |
| Appels aux sources | SAP 4, PIM 8, WMS 17, OMS 4, lac 4 |
| Affichage cockpit : lecture de l'instantané et conversion | 10 ms (instantané de 8 Ko) |
| Drill-down (positions d'un article) | 90 ms à froid (source), 0,09 ms à chaud (cache) |
| Mémoire maximale du processus de synchronisation | 5,7 Go (voir les limites) |

**Taux de rapprochement.** Toutes les erreurs volontaires ont été retrouvées.

| Système | Rapproché | Constat |
|---|---|---|
| SAP (maître fournisseurs) | 100 % | 25 doublons trouvés (25 injectés) |
| PIM (maître produits) | 100 % | 2 000 EAN en double signalés en conflit (2 000 injectés) |
| PIM → fournisseur | 99,7 % | 3 003 orphelins (3 003 injectés) |
| WMS · articles (GTIN-14) | 99,3 % | orphelins : GTIN inconnus et EAN ambigus |
| WMS · sites | 99,6 % | `WHXXX` isolé |
| WMS · raisons sociales | 57,7 % rapproché d'office | 3 659 variantes en file de validation, jamais appliquées seules |
| OMS · références | 100 % | les variantes de casse sont reconnues comme la même référence |
| Lac · EAN / magasins | 99,6 % / 100 % | — |

**Écarts de fond** : 218 fournisseurs au pays divergent entre le PIM et SAP (218 injectés).

**Test de charge en API directe** : 1 000 000 d'articles lus en 9 s (111 000 lignes/s) avec un plafond assoupli à 600 requêtes/min. Avec les plafonds par défaut (30 requêtes/min × 5 000 lignes), le même chargement prend environ 7 minutes, de nuit.

### Volume stocké et coûts estimés

Hypothèse : 1 M de produits, 5 000 fournisseurs, 500 sites, 10 M de clients.

| Élément | Volume | Où |
|---|---|---|
| État léger : fournisseurs, sites, positions en alerte, compteurs, séries, alertes, journal | 15 Mo (JSON) | Postgres (Supabase) |
| Référentiel produits (1 M) | 7 Mo (Parquet zstd), environ 150 Mo en lignes Postgres | stockage objet recommandé |
| Crosswalk (3,5 M correspondances) | 18 Mo (Parquet zstd), environ 400 Mo en lignes Postgres | stockage objet, avec seulement les exceptions en Postgres |
| Cache L2 et L3 | quelques dizaines de Mo | Postgres ou stockage objet |
| Clients individuels | 0 | — |

Total : environ 50 Mo en colonnaire compressé, ou environ 600 Mo tout en Postgres.

**Coût mensuel indicatif** (tarifs publics 2026, à vérifier) :

- **Stockage** : l'offre gratuite de Supabase (500 Mo de base, 1 Go de stockage objet) suffit en colonnaire. Avec Supabase Pro (25 $/mois, 8 Go inclus), le stockage est négligeable.
- **Stockage objet** : environ 0,02 $/Go/mois, soit moins de 0,01 $.
- **Poste principal** : le calcul (fonctions serverless et relevés), pas le stockage.

---

## 6 bis. Données standard, résilience et alertes : Aura lit et raisonne, ne calcule pas

**Règle du fondateur (30 septembre 2026).** Aura ne calcule rien. Il **lit** des valeurs dans le SI du client (ERP, APS, MRP, WMS, TMS, SRM) : couverture en jours, délai de survie (TTS), délai de reprise (TTR), CA à risque, date de rupture projetée, prochaine réception, date promise et date de disponibilité confirmée (ATP), confirmation fournisseur, délai planifié et délai réel médian. Il **raisonne** avec des règles causales : comparaisons à des seuils, conditions SI → ALORS. Interdit : dériver un montant (donnée × hypothèse), diviser un stock par une demande pour obtenir une couverture, produire une probabilité, un agrégat en euros ou un stress-test chiffré. Une valeur que le SI ne fournit pas s'affiche « donnée non fournie par le SI ».

**Données standard.** Le questionnaire et l'ontologie Supply portent les attributs lus dans les champs standard des applications : source approuvée (SAP EORD), fiche info-achat (EINA/EINE), données MRP (MARC), en-tête de commande (EKKO), entrée de marchandises avec lot (MSEG), historiques de demande et d'achats (lac), évaluations de risque et certificats (SRM), lots de contrôle (QMS), étapes et évènements de transport (TMS), livraisons avec lot (WMS), absentéisme (SIRH). Quatre objets portent les valeurs de planification lues : **Position planifiée** (APS, par article et par site : couverture, TTS, TTR, CA à risque, rupture projetée, prochaine réception), **Confirmation fournisseur** (SAP EKES), **Promesse client** (contrôle ATP) et **Paramètre MRP** (délai planifié, délai réel médian). Maison Lucie les sert comme le ferait un APS (`aps?resource=supply-positions`, `lead-time-review`, `atp-checks`, `A_PurOrdSupplierConfirmation`).

**Alertes.** Règles causales pures sur valeurs lues :
- promesse client menacée (date de disponibilité ATP postérieure à la date promise, ou absente) ;
- commande fournisseur non confirmée ou confirmée après la date de besoin ;
- rupture projetée avant la prochaine réception ;
- paramètres MRP obsolètes (délai réel lu au-delà du délai planifié lu) ;
- fournisseur unique (TTR lu > TTS lu de plus de 7 j, seuil réglable) ;
- exposition géographique (articles critiques d'un fournisseur en Asie ou passant par un détroit) ;
- effet coup de fouet, défaillance financière (hausse du score lu, chaîne vers S1), qualité (lots refusés), certification, congestion portuaire, rappel produit, devoir de vigilance (loi 2017-399, CS3D ; la CSRD est une obligation de reporting).

Le ratio coup de fouet et le pic de demande sont lus dans l'outil de planification (`aps?resource=demand-signals`), la part de lots refusés dans l'outil qualité (`qms?resource=supplier-quality`) ; les écarts entre deux valeurs lues (TTR − TTS, hausse d'un score, jours avant échéance, retard) sont présentés comme des comparaisons. Les scores SRM sont des **niveaux lus**, jamais des probabilités. Corrections du check-up : RES-SECU retirée (le stock de sécurité couvre la variabilité, pas une rupture d'approvisionnement ; doublon de RES-TTS) ; S3 et RES-BFR fusionnées (S3 se déclenche sur la couverture lue par site) ; S5 = OTIF fournisseur, distincte de RES-QUALITE (lots refusés) ; RES-UNIQUE et RES-TTS ne se doublonnent plus (RES-TTS ne porte que les articles avec une source alternative) ; S14 et S15 sortent des alertes vers les décisions stratégiques (STRAT-RESEAU, STRAT-SI). La couverture et le TTS se lisent par site ; un article retient son site le plus exposé (TTS lu le plus court).

**Montants.** Une alerte n'affiche un montant que s'il est lu dans le SI (CA à risque de l'APS), pour l'entité qui déclenche la règle, avec sa source. Jamais une somme, jamais une valeur × hypothèse. Sinon : « donnée non fournie par le SI ». Le cockpit trie par **gravité ordinale** (règle), puis par délai avant impact lu ; jamais par euros.

**Scénario d'arrêt** (ex-stress-test). On choisit un fournisseur, un port ou un détroit et une durée : la règle « SI TTS lu < durée de l'arrêt ALORS l'article rompt avant la fin de l'arrêt » liste les articles exposés. Aucun montant. Les plans B sont classés par Décider (évaluation ordinale Bora, attitude pessimiste).

**Durabilité.** Les décisions stratégiques affichent les émissions du transport lues dans le TMS (`tms?resource=shipment-emissions`, ISO 14083), le statut ESG et les certificats lus dans le SRM, sinon « donnée non fournie par le SI ». Aucun calcul d'émissions.

**Deux modes dans le Studio.** « Pas à pas » est le mode normal pour un vrai client : Cartographier, Connecter (ses propres SI et identifiants), Vérifier, Régler les alertes, chaque étape validée. « Démo Maison Lucie en un clic » est un mode démo : il charge uniquement le SI de démonstration Maison Lucie (données synthétiques, identifiants de démo) et enchaîne questionnaire, connexion, métadonnées, mapping accepté au-dessus du seuil, synchronisation sous budget, alertes et résilience, puis ouvre le cockpit ; il s'arrête à la première étape en échec en disant où et pourquoi. Il ne s'applique jamais au SI d'un client. Chaque étape d'une démo reste modifiable en « Pas à pas ».

**Protocoles réalistes par type d'outil.** Le Studio ne propose pour une application que les protocoles que ce type d'outil expose sur le marché (`src/lib/integration/tool-protocols.ts`), le plus courant en premier et choisi par défaut : ERP SAP S/4HANA → OData v2, OData v4, RFC/BAPI, IDoc, SOAP (EDI par le traducteur du client) ; PIM (Akeneo, Salsify) → REST, SFTP ; WMS (Manhattan, Reflex, SAP EWM) → REST, SOAP, SFTP, files de messages (à confirmer) ; TMS → REST, EDIFACT, X12, AS2, SFTP ; APS (Kinaxis, o9) → REST, SFTP ; SRM (Coupa, Ariba) → REST, SOAP, SFTP (cXML non lu) ; QMS → REST, SOAP (à confirmer) ; OMS / e-commerce (Salesforce, Shopify) → REST, GraphQL, webhooks, Salesforce, gRPC (API Pub/Sub de Salesforce, à confirmer) ; SIRH (Workday, SuccessFactors) → SOAP, REST, OData, SFTP ; lac (Snowflake, Databricks) → SQL/JDBC, REST, fichiers Parquet, Kafka, CDC. ESB et MCP restent possibles partout, comme passerelles. Dans « Connecter », le champ « Type d'outil » limite la liste « Accès » et marque le protocole natif ; à l'import du questionnaire, un mode d'accès absent est remplacé par le protocole natif (avertissement), et un protocole irréaliste pour l'outil est signalé « à confirmer avec le client ». Sources publiques et tableau complet : `docs/SOURCES-MULTI.md` de Maison Lucie, qui applique la même matrice (un canal non offert y renvoie 404).

**Scénarios illustratifs.** Sur la démo Maison Lucie, trois alertes viennent de cas réglés à la main (fournisseur unique, port congestionné, paramètres MRP) : elles portent un badge discret « scénario illustratif » (`ILLUSTRATIVE_SCENARIOS`, `src/lib/v4/supply-derived.ts`). Les seuils des règles sont affichés « à confirmer » dans la vue Exposition.

**Matrice alerte × données** (`src/lib/v4/alert-data-matrix.ts`, affichée en bas de la vue Exposition, calculée sur les correspondances acceptées). Données hors du modèle objet, à renseigner : prévision de base hors promotion (S6, SI historique `DemandForecast.baseline`), capacité et charge par site (S7), historique des coûts (S8), capacité de repli des sites (S10), priorité de service par client (S11), nomenclature (S12), écarts entre sources (S13, déjà suivis dans Studio · Vérifier · Écarts), OTIF fournisseur (S5). Tables et champs réels : à confirmer avec le client.

**Décisions stratégiques** (Décision, section repliée « Décisions stratégiques », hors alertes, `src/lib/v4/strategic-decisions.ts`) : ouverture ou fermeture d'un entrepôt ou d'un hub, conception du réseau, faire ou faire faire (3PL), transporteurs et modes, relocalisation, stocks de sécurité, automatisation d'entrepôt, S&OP et horizon, transformation du SI (ex-S15). Chaque modèle arrive prérempli (4 leviers, 2 à 4 options, 5 à 8 indicateurs) avec les faits Maison Lucie lus sur les données (sites, flux, exposition Asie ou détroit, transporteurs, émissions et ESG lus, volumes, demande) ou « donnée à renseigner ». Pas de moteur d'optimisation de réseau : Bora compare les options posées ; les effets sont des hypothèses à confirmer.

## 7. Limites honnêtes

- **Budget par instance.** Le budget s'applique dans une file par source **et par instance serveur**. Sur Vercel, plusieurs instances simultanées ont chacune leur file. Pour un plafond global strict, il faut un compteur partagé (table Supabase ou Vercel KV). Ce compteur n'est pas encore branché : le cron unique et la fusion des demandes limitent le risque.
- **Mémoire à l'échelle.** À 1 M de produits, le crosswalk et les index sont tenus en mémoire JavaScript : 5,7 Go au pic. Il faut un worker dédié, non serverless, ou déplacer le crosswalk dans DuckDB.
- **SQL cloud** : les pilotes Snowflake, Databricks et BigQuery (API HTTP) ne sont pas testés sur un vrai compte. Seule la partie Postgres via DuckDB et DuckDB lui-même le sont.
- **SAP et Manhattan** : les noms de champs de modification et de paramètres sont « à vérifier avec la documentation client ». `!deltatoken` suppose un service delta-enabled.
- **SFTP** : Aura ne l'ouvre pas lui-même. Un outil de synchronisation doit déposer les fichiers dans un dépôt ou dans S3.
- **Score de mapping déterministe** : il reconnaît bien les formats forts (EAN, TVA, dates, quantités). Il est moins sûr sur des libellés libres proches (nom de site ou nom de zone). C'est pour cela que la validation humaine reste requise sous 80 %.
- **Tests e2e** : le test e2e du parcours complet demande Maison Lucie joignable (shim local ou déploiement).

## 8. Ce qui reste pour un vrai client

- **Réseau** : liste d'IP autorisées ou VPN site à site, ou agent de collecte côté client pour le mode dépôt. Proxy sortant si l'API est exposée.
- **SAP** :
  - activation des services OData dans SAP Gateway (`/IWFND/MAINT_SERVICE`) ;
  - utilisateur technique avec les rôles d'affichage (fournisseurs, commandes, stocks) ;
  - services delta ou vues CDS avec capture de changement.
- **Droits** : comptes techniques en lecture seule, de préférence sur une réplique ou le data lake. Rotation des jetons, jetons courts (OAuth client credentials) si la source le permet.
- **Exploitation** :
  - Supabase configuré côté serveur (`SUPABASE_SERVICE_ROLE_KEY`) ;
  - `CRON_SECRET` défini ;
  - cadence (Vercel Pro ou pg_cron) ;
  - compteur de budget partagé si plusieurs instances.
- **Validation métier** : revue de l'ACV par l'architecte, tolérances par attribut, statuts « en attente de stock » propres au client (étape 4).
