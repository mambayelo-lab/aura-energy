# Revue produits Aura, vue par l'utilisateur, et plan de challenge

## 1. Architect : cohérent ? pertinent ? utile ?

**Cohérent : oui.** Le parcours Cadrer → Comprendre → Transformer suit la logique d'un architecte d'entreprise.

**Pertinent : à moitié.** Un architecte ou un DSI n'achète pas un questionnaire. Il achète un **livrable qu'il peut défendre en comité** : un schéma cible, les écarts, une feuille de route et des risques chiffrés.

**Utile : pas encore assez.** Il manque aujourd'hui l'étape qui fait gagner du temps : passer de la demande au dessin.

### À ajouter en priorité : « Dessine-moi »
Un agent LLM qui dessine sur demande, du métier jusqu'à l'infrastructure.
- **Entrée**
  - Une phrase, par exemple : « Migre notre ERP vers le cloud avec une reprise après sinistre sous 4 h ».
  - Des documents (OCR déjà présent).
  - L'existant (import de CMDB, de Jira, d'un fichier).
- **Sortie : un modèle structuré, pas une image.** Il suit les couches ArchiMate : métier, applications, données, technologie. Il est rendu en diagramme éditable (C4, ou Mermaid/diagrams-as-code), et on peut le corriger par la conversation : « ajoute une file d'attente ».
- **Garde-fous obligatoires**
  - Chaque schéma est évalué selon les **6 piliers du Well-Architected Framework** (AWS/Azure/GCP) : excellence opérationnelle, sécurité, fiabilité, performance, coûts et durabilité.
  - Il est aussi confronté à un catalogue de patterns : strangler, event-driven, CQRS, zero-trust, multi-AZ.
  - Chaque écart porte un score, une gravité et une recommandation.
- **Pont vers le moteur Bora** : le choix entre deux architectures cibles passe par Décider, en mode pessimiste et avec un backward pour trouver le plus petit changement. C'est votre différenciateur ; aucun outil de dessin ne le fait.
- **Exports** : draw.io ou Visio, Terraform (squelette), backlog Jira, dossier d'architecture en PDF.

### À supprimer ou simplifier
- Les écrans qui demandent de saisir à la main ce qu'un LLM peut pré-remplir. Le principe devient : proposer, puis faire valider.
- Tout reste du code Architect dans Supply et Décider, une fois Architect autonome.

## 2. Utilisabilité en contexte réel d'entreprise, pour les trois produits

| Constat (côté utilisateur) | Action |
|---|---|
| Le premier écran exige de comprendre le modèle avant d'avoir de la valeur. | **Ajouter** : démarrage en un clic sur ses propres données (import d'un CSV ou d'un Excel, et un connecteur) et une valeur visible en 10 minutes. |
| Il n'y a ni SSO, ni rôles, ni journal d'audit. C'est bloquant pour une grande entreprise. | **Ajouter** : SSO (Entra ID ou Google), rôles lecteur / analyste / admin, historique des décisions. |
| Les alertes restent dans l'application. | **Ajouter** : envoi vers Teams, Slack et e-mail, avec un lien profond vers l'alerte. |
| On ne sait pas combien une décision a rapporté. | **Ajouter** : un suivi « décision → résultat » (€ évités, jours gagnés), qui sert de preuve du ROI au renouvellement. |
| Trop de vocabulaire de chercheur (agrégation max-min, treillis) visible par l'utilisateur métier. | **Modifier** : garder ces termes dans « Comprendre » et dans l'aide, pas dans les écrans d'action. |
| Les trois produits ont des gestes différents pour la même action. | **Modifier** : une même grammaire partout (Constater → Comprendre → Décider → Suivre). |
| Mobile | Consultation et validation seulement, sans création de modèle. |
| Il n'y a pas d'export pour le comité. | **Ajouter** : un export PowerPoint ou PDF d'une décision, en une page. |

## 3. Faire challenger Aura avec gstack

gstack (Garry Tan) fournit des skills Claude Code : `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/review` et `/qa`.

Installation dans le dépôt :

```bash
git clone https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
```

Séquence proposée, un produit à la fois :
1. **`/office-hours`** : le produit est confronté aux 6 questions forcing de YC (qui souffre vraiment, statu quo, le plus petit coin d'entrée, observation d'usage réel). Vous lui donnez ce document et la page produit du site. Livrable : le problème reformulé et le « wedge ».
2. **`/plan-ceo-review`** : il challenge l'ambition et le périmètre, en mode « expansion » pour Architect (Dessine-moi) et en mode « réduction » pour Supply (ce qu'on coupe). Livrable : la liste « garder / couper / ajouter ».
3. **`/plan-eng-review`** : il vérifie l'architecture technique du plan retenu (données, LLM, sécurité).
4. **`/qa`** sur l'URL déployée : un test utilisateur réel dans le navigateur, avec correction des bugs trouvés.

Règle : entrer dans chaque séance avec une hypothèse chiffrée (par exemple « un DSI gagne 3 semaines par dossier d'architecture ») et en ressortir avec un verdict.

## 4. Quel agent construire en plus de Supply ?

Critères : même moteur (signal → règle causale → décision), douleur chiffrée, acheteur doté d'un budget, données déjà structurées.

1. **Recommandé : Aura Achats / Risque fournisseurs.** C'est le prolongement naturel de Supply, qui a déjà les fournisseurs et le risque géopolitique. Il couvre la double source, la renégociation et la conformité CSRD et devoir de vigilance. L'acheteur (CPO) a un budget, et la vente croisée est immédiate.
2. **Aura Trésorerie / BFR** (DAF) : prévision de cash, relances clients, arbitrage entre stock et cash. Le ROI est très lisible (jours de BFR gagnés).
3. **Aura Maintenance prédictive** (industrie) : des signaux capteurs vers une décision d'intervention. Le marché est plus gros, mais l'intégration est plus lourde.

Ordre conseillé : Achats (6 mois), puis BFR. Les deux réutilisent 80 % du Studio et du Cockpit.
