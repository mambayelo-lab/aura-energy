# Audit « ce qui n'apporte rien » : Supply et Décider

## Règle suivie

- **Supprimé** : l'élément est inutile et sa suppression ne présente aucun risque.
  - Il s'agit de code mort, d'un écran sans lien ou d'un contenu factice.
  - Le moteur Bora, les données client, les exports et les parcours principaux ne sont jamais touchés.
- **Replié** : en cas de doute, l'élément reste accessible à la demande.
- **Gardé** : l'élément a une utilité réelle, ou le supprimer ferait perdre une fonction.

## Supply

| Élément | Ce que c'est | Pourquoi il n'apporte rien | Risque à le supprimer | Décision |
|---|---|---|---|---|
| Section « Administration » (`?section=administration`) | Page annonçant droits et connecteurs | Elle l'affiche elle-même : « Rien de fonctionnel encore ». Elle n'est reliée à aucun lien. | Aucun : l'URL renvoie désormais au cockpit. | **Supprimé** |
| Section « Capabilities » du shell Supply et onglet Studio « Capabilities » | Carte L1→L4 des capacités métier | N'alimente ni les alertes ni les décisions. L'utilisateur n'en voit pas l'usage. | Faible : le modèle de données reste intact ; seuls l'écran et le composant sont retirés. | **Supprimé** (écran et composant) |
| Tuiles KPI factices (`MOCK_KPIS`) | Valeurs d'exemple (4,2 M€, 78 %…) | Code mort, et des chiffres inventés. | Aucun. | **Supprimé** |
| Constantes mortes (`CAPABILITIES`, `WIZARD_STEPS`, `STRATEGIC_NO_DATA_*`) | Reliquats d'anciens écrans | Jamais lues. | Aucun. | **Supprimé** |
| Ancien formulaire de connexion du Studio (8 protocoles, catalogue `SOURCE_TEMPLATES`) | Formulaire remplacé par les cartes de connecteurs et le bloc « Identifiants » | Doublon, devenu du code mort. | Aucun : les mêmes protocoles passent par le nouveau bloc. | **Supprimé** |
| Anciens sous-menus « Propositions / Indicateurs ↔ champs / Attributs ↔ champs » (Mapper) | Trois listes qui se recoupaient | Doublons de la vue de couverture et du Lignage. | Faible : les propositions se valident d'un clic, les indicateurs sont repliés. | **Replié ou fusionné** |
| Scénario guidé de la démo | Bandeau à 5 étapes | Utile pour une première démo, bruyant ensuite. | Une perte d'aide pour les nouveaux utilisateurs. | **Replié** (l'étape suivante seulement, fermable) |
| Ontologie du shell Supply ET Ontologie vivante du Studio | Deux vues de l'ontologie | Recouvrement partiel : l'une sert à la lecture et l'édition des objets, l'autre aux valeurs observées. | Moyen : ce sont deux usages distincts. | **Gardé** (à fusionner plus tard si l'usage le confirme) |
| Publier → « Vers le cockpit » | Synthèse des faits publiables | Vue de contrôle avant publication. | Perte du contrôle. | **Gardé** |

## Décider

| Élément | Ce que c'est | Pourquoi il n'apporte rien | Risque à le supprimer | Décision |
|---|---|---|---|---|
| Panneau « Améliorer » (moteur Sow) dans Suivre | Coalitions d'objectifs | Utile à la définition des OKR, mais pas au suivi courant. | Perte d'une analyse. | **Replié** |
| Synthèse de la problématique (Comprendre) | Paragraphe généré | Répète les réponses aux questions. | Faible. | **Replié** |
| Encarts « Indicateurs déduits » et « Leviers & options déduits » (Comprendre) | Vues détaillées modifiables | Doublons de l'arbre réglable et de ses liens avec les leviers. | Perte d'édition fine. | **Replié** |
| Légendes textuelles (Impacter, Arbitrer) | Libellés à côté des symboles | Les symboles suffisent. | Aucun : libellés conservés en info-bulle. | **Replié** (info-bulle) |
| Sous-onglets Impacter : Matrice, Arbre, Scénarios | Trois vues du même modèle | Scénarios sert à composer les combinaisons. | Élevé : parcours principal. | **Gardé** |
| Explorer les solutions | Espace exact des combinaisons | Calcul exact et plus petit changement. | Élevé. | **Gardé** |
| Page « Analyses partagées avec moi » (`/analyses-partagees`) | Lire une analyse partagée et proposer | Aucun lien depuis la navigation. | Elle sert au partage entre utilisateurs. | **Gardé** (à relier à la navigation) |
| Pages Démonstrations et Cas de référence | Exemples prêts à ouvrir | Utiles à la découverte. | Perte de démonstrations. | **Gardé** |

## Vérifications

- `tsc` : seule l'erreur connue (`comprendre-documents.ts`) subsiste.
- Tests : 360 tests unitaires et les suites e2e Supply et Décider passent.
- Aucun fichier du moteur (`src/lib/engine/*`), aucune donnée client et aucun export n'ont été modifiés.
