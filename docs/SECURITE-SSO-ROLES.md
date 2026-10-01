# SSO, rôles et journal d'audit (Supply et Décider)

## 1. Connexion (SSO)

La page `/auth` propose quatre modes de connexion :

- **Se connecter avec Microsoft** : Microsoft Entra ID, via OAuth (fournisseur `azure` de Supabase) ;
- **Continuer avec Google** ;
- **SSO entreprise (SAML 2.0)** : on saisit le domaine de l'entreprise ;
- adresse et mot de passe, avec second facteur si activé.

### 1.1 Microsoft Entra ID (côté client)

1. Ouvrir le portail Entra, puis **Applications → Inscriptions d'applications → Nouvelle inscription** :
   - **Nom** : « Aura » ;
   - **Types de comptes** : « Comptes de cet annuaire uniquement » (un seul tenant) ;
   - **URI de redirection (Web)** : `https://<ref-projet>.supabase.co/auth/v1/callback`.
2. Noter l'**ID d'application (client)** et l'**ID de l'annuaire (tenant)**.
3. **Certificats et secrets → Nouveau secret client** : copier la **valeur** du secret (et non son identifiant).
4. **Autorisations d'API** : Microsoft Graph, autorisations déléguées `openid`, `email` et `profile`.
5. **Configuration du jeton** : ajouter la revendication facultative `email`, pour que l'adresse remonte même sans boîte Exchange.

### 1.2 Supabase

1. **Authentication → Providers → Azure** :
   - activer le fournisseur ;
   - **Client ID** : l'ID d'application ;
   - **Secret** : la valeur du secret ;
   - **Azure Tenant URL** : `https://login.microsoftonline.com/<ID-tenant>`.
2. **Authentication → Providers → Google** : renseigner l'ID client et le secret d'un client OAuth « Application Web » créé dans Google Cloud. Son URI de redirection autorisée est la même : `https://<ref-projet>.supabase.co/auth/v1/callback`.
3. **Authentication → URL Configuration** :
   - **Site URL** : `https://aura-decision-zen.vercel.app` ;
   - **Redirect URLs** : `https://aura-decision-zen.vercel.app/auth` et `http://localhost:8080/auth`.

### 1.3 SAML 2.0

Le SSO SAML demande Supabase Pro.

1. **Côté fournisseur d'identité.** Dans Entra, créer l'application d'entreprise (**Applications d'entreprise → Nouvelle → Créer votre propre application → SAML**) :
   - **Identificateur (Entity ID)** : `https://<ref-projet>.supabase.co/auth/v1/sso/saml/metadata` ;
   - **URL de réponse (ACS)** : `https://<ref-projet>.supabase.co/auth/v1/sso/saml/acs` ;
   - **attribut** `email` = `user.mail`.
2. **Côté Supabase** (CLI) :

   ```
   supabase sso add --type saml --project-ref <ref-projet> \
     --metadata-url "<URL des métadonnées de fédération de l'application>" \
     --domains entreprise.fr
   ```

L'utilisateur saisit ensuite `entreprise.fr` dans le champ « Domaine de l'entreprise », puis clique sur **SSO entreprise**.

## 2. Organisations et rôles

Chaque utilisateur est rattaché à une organisation, qui est la base du multi-entreprise. Le premier utilisateur la crée depuis **Compte → Équipe & accès** et en devient administrateur. Les autres utilisateurs sont invités par e-mail.

| Rôle | Droits |
|---|---|
| Lecteur | consulte le cockpit et le Studio en lecture |
| Analyste | décide, commente et annote le journal, modifie les seuils et les règles, exporte |
| Administrateur | Studio complet (sources, identifiants, mappings, maîtres, ontologie), utilisateurs, audit |

Les droits sont appliqués à trois niveaux :

1. **Serveur**, dans les fonctions serveur (`requireAction`, `src/lib/security/`). Par exemple, l'enregistrement, le test et la découverte des sources sont réservés à l'administrateur, et la synchronisation à l'analyste.
2. **Base de données**, par des policies RLS (`supabase/migrations/20260929120000_roles_audit.sql`, fonctions `aura_role` et `aura_has_role`).
3. **Interface** : les contrôles non autorisés sont désactivés, avec la mention « Lecture seule ». Pour un lecteur, Décider affiche un message et « Ouvrir une décision » est désactivé.

Les administrateurs gèrent les rôles dans **Compte → Utilisateurs et audit** (`/cockpit/utilisateurs`).

## 3. Journal d'audit

La table `aura_audit_log` enregistre qui a fait quoi et quand. Elle est en ajout seul : un déclencheur refuse toute modification ou suppression, et les droits `update`, `delete` et `truncate` sont retirés.

Elle trace :

- les connexions ;
- les sources (enregistrement, test, modification, lecture des métadonnées) ;
- les mappings et les maîtres par attribut ;
- les règles, les seuils et l'ontologie ;
- les synchronisations ;
- les décisions (ouverture, modification, annotation) ;
- les exports (PDF, PPTX, CSV).

L'administrateur consulte le journal avec des filtres (action, utilisateur, période) et l'exporte en CSV. L'export est lui-même tracé.

## 3 bis. Collaboration (commentaires, mentions, assignation, activité)

L'espace partagé est l'**organisation** : on y invite ses collègues depuis **Compte → Équipe & accès** (invitations existantes). Dans le détail d'une alerte et dans le journal des décisions (bouton « Commentaires »), un panneau permet :

- de **commenter** une alerte ou une décision, et de **mentionner** un collègue avec `@prénom` ou `@adresse` (rapproché des membres de l'organisation) ;
- d'**assigner** une alerte à une personne, avec un **statut** : à traiter, en cours, traité ;
- de suivre le **fil d'activité** de l'espace (commentaires, mentions, assignations, statuts).

Tables et droits (`supabase/migrations/20260930090000_aura_collaboration.sql`, RLS avec `aura_has_role`) :

| Table | Lecteur | Analyste | Administrateur |
|---|---|---|---|
| `aura_comments` | lit | commente | commente, supprime |
| `aura_assignments` | lit | assigne, change le statut | idem |
| `aura_activity` (ajout seul) | lit | ajoute (par l'application) | idem |

Chaque commentaire et chaque assignation sont aussi tracés dans le journal d'audit (`collab.commentaire`, `collab.assignation`). Le rafraîchissement est simple : bouton et toutes les 30 secondes, sans temps réel.

Sans session (mode démo), le panneau fonctionne en **repli local** : commentaires et assignations restent dans ce navigateur, ne sont pas partagés, et le panneau l'indique (« local (sans session) »).

## 4. Mode démo

Sans authentification, Aura reste utilisable en **mode démo**, signalé en permanence par le libellé « Mode démo · sans authentification ». Tous les écrans sont ouverts et le journal est tenu en mémoire serveur.

Pour désactiver le mode démo en production, définir `AURA_DEMO_MODE=off` dans les variables d'environnement Vercel.

## 5. Mise en place

1. Appliquer les migrations : `supabase db push` (dont `20260930090000_aura_collaboration.sql` pour la collaboration).
2. Configurer les fournisseurs (§ 1).
3. Créer l'organisation, inviter les utilisateurs et attribuer les rôles.
4. Optionnel : `AURA_DEMO_MODE=off`.
