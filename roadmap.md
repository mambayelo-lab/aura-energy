# Roadmap Aura

## Compagnon vocal (pop-up) — cohérence
- [x] Cadrer (Architecturer) : 14 questions / 8 cartes, lanceur global + par carte
- [x] Comprendre (Décider) : 9 questions / 5 sous-étapes, déductions locales
- [x] Décider : lanceur vocal aussi sur l'écran d'entrée (vue Schéma)
- [x] Décider : question d'entrée « type de décision » intégrée au fil vocal
- [x] Cadrer : préconisation IA calculée à la volée si l'inférence n'a pas été lancée
- [x] Copilote Décideur : briefing vocal guidé (4 questions) qui ouvre l'échange LLM
- [x] Synthèse finale : récapitulatif question / réponse retenue, lisible à voix haute

## Uniformisation Aura (proposition, en attente d'arbitrage)
- U1 Système d'icônes : remplacer tous les emoji par Lucide (sidebar, cartes, sections). Défaut visible : glyphes manquants.
- U2 Identité : un seul lockup Aura (aujourd'hui 3 variantes : Accueil, Studio, Copilote).
- U3 Échelle typographique : 6 tailles nommées, serif réservé aux titres de page.
- U4 Gabarit de page unique : en-tête + colonne 960 + états vides pleine hauteur.
- U5 Studio en parcours numéroté 1→6 (modèle 1000minds) avec état d'avancement.
- U6 Tokens : sortir les styles inline vers des tokens/composants partagés.

## Cas de référence & Arbitrer avancé — livré
- [x] Bibliothèque de cas sectoriels mémorisés (Retail, Utilities, Santé/public, DSI ETI) + vocabulaire de critères réutilisable
- [x] Chaque cas porte une **vue As-Is** (situation actuelle) en plus de la cible et de la trajectoire
- [x] Arbitrer : matrice de dominance option × option
- [x] Arbitrer : robustesse ordinale (jusqu'où déplacer l'ordre d'importance avant bascule)
- [x] Arbitrer : carte des désaccords entre parties prenantes
- [x] Arbitrer : fiche de décision 1 page signable (imprimable)
- [x] Site vitrine Aura (offres, blanc/indigo)

## Recommandations fond & forme — état
- [x] Nommer et publier la méthode : moteur **BORA** (Bipolar Ordinal Reasoning Aggregation) — nom, 6 axiomes, exemples reproductibles, citation (`src/lib/v4/bora.ts`, section « Moteur » du site)
- [x] Certifier l'agent : journal des hypothèses testées, affiché dans l'onglet « Agent — et si ? » (axiome A6)
- [x] Objet visuel signature : **Carte de décision** (`src/components/aura/CarteDecision.tsx`), identique dans le produit et dans la fiche signable
- [x] Deux registres de lecture sur Arbitrer : « Décideur » (verdict, carte, réserves, signature) / « Analyste » (dominance, robustesse, désaccords, agent)
- [x] Zoom sectoriel orienté problématiques (Retail, Énergie & Utilities) sur le site
- [x] Compagnon : étape X/N, retour arrière, fermeture par la croix uniquement
- [ ] Groupe et désaccord en entrée nominale : chaque partie prenante ordonne ses critères depuis son poste (aujourd'hui les profils sont dérivés automatiquement)
- [ ] Boucler sur le réel : rejouer une décision 12 mois après avec ce qui s'est passé, et dire quel critère avait été mal jugé
- [ ] Modèles sectoriels démarrables en un clic depuis un cas de référence (critères déjà instruits)
- [ ] Connecteurs frugaux : lire juste assez du SI pour instruire une décision, et l'afficher comme tel
- [ ] Réduction de texte de moitié : passe restante sur Architecturer (design, backlog) et Studio

## Lot 5 — Arbitrer, plateforme SaaS, vitrine (en cours)
- [x] Notation ordinale unique dans tout Aura : 0 · L · M · H (`src/lib/v4/ordinal-scale.ts`)
- [x] Arbitrer : espace des profils COMPLET (16 cases δ⁺ × δ⁻), cases vides visibles, clic = alternatives correspondantes
- [x] Arbitrer : rendu plus fluide et plus lisible (fil de lecture unique, moins d'onglets)
- [ ] Moteur Décider embarqué dans Architecturer et Copilote (panneau in-situ, pas de va-et-vient)
- [ ] Pricing sur le site vitrine (3 plans + prix par module)
- [ ] SaaS : abonnements, essai gratuit, coupure d'accès à l'expiration
- [ ] Écran de consommation en tokens (par utilisateur / organisation)
- [ ] Connecteurs natifs configurables pour rendre le Copilote décisionnel utilisable en SaaS
- [ ] Vitrine : différenciation visuelle vs 1000minds (images, structure)

## Vidéo & marque (en cours)
- [x] Logo AuraMark : nuances indigo + éclat de lumière
- [x] Teaser V10 : vrais écrans Aura, versions FR et EN, logo, images de transition, sans mention de carte bancaire
- [ ] Répondre : état auth / cybersécurité / comptes utilisateurs (alternative sans dépendance Lovable)

## Lot sécurité (en cours)
- [x] Base : organizations, organization_members, organization_invitations, usage_events (RLS + GRANT + fonctions anti-récursion)
- [x] Serveur : org.functions.ts (créer org, inviter, révoquer, accepter, rôles, retrait)
- [x] Écran /auth : mot de passe, Google, second facteur TOTP, consommation d'invitation
- [x] Écran /cockpit/comptes : organisation, membres, invitations, activation MFA
- [ ] Activer le fournisseur Google (identifiants client à fournir)
- [ ] Envoi d'email d'invitation (aujourd'hui : lien à transmettre)
- [ ] Rattacher missions/usage à org_id dans les écrans existants

## Arbitrer — refonte compartiment par compartiment (à valider)
- [ ] Centre : carte de décision épurée (une seule figure porteuse, légende ordinale persistante)
- [ ] Droite : panneau « option retenue vs dauphine » (écart décisif, pas de classement bavard)
- [ ] Bas : arbre dynamique — chemin déterminant surligné, branches non décisives repliées
- [ ] OKR : passage du verdict à l'engagement (1 objectif, 3 résultats, dérive signalée)
- [ ] Narratif : une phrase par compartiment, autoportante, sans chiffre sur Décider

## Architecturer — capacités & traçabilité (fait)
- [x] Traçabilité assistée : l'IA propose Feature → besoin / exigence, validation ligne par ligne
- [x] Vue « Capacités → applications » : couloirs L3, rattachement éditable, alerte non-rattaché
- [x] Schéma des capacités L3 : nœuds L3, liens = informations échangées, clic = flux d'origine

## Voix — mise en évidence (fait)
- [x] Bouton micro indigo plein + halo pulsé + libellé « Cliquez pour parler » (VoiceInput, Compagnon Aura)

## Onboarding par application (en cours)
- [x] Script pédagogique par application, FR/EN, sur le cas démo (`src/lib/v4/onboarding-scripts.ts`)
- [x] Lien « Comment ça marche » dans la sidebar d'Architecturer, Décider et Copilote — lecteur pop-up avec voix off, sommaire, retour arrière, fermeture par la croix
- [ ] Rendu vidéo Remotion FR/EN à partir du même script (voix off + captures d'écran)

## Architecturer — capacités L3 (fait)
- [x] Rattachement L3 proposé par l'IA dans le catalogue du domaine, validation ligne par ligne
- [x] Schéma des capacités décliné As-Is / Cible, capacités qui apparaissent signalées


## Demande du 31/08
- [x] Retirer les couches canaux / processus / données du schéma inter-applicatif
- [x] Accroche vitrine : « AURA part de ce que vous savez… »
- [x] Vidéos d'onboarding : 6 masters FR/EN refaits avec chapitre de bienvenue et captures réelles du cas démo

## Pénétration sectorielle (août 2026)
- [x] Vitrine : section Solutions unique (secteur → cas → produit → livrable) ; sections Secteurs/Enjeux redondantes supprimées
- [x] Pack Retail dans Décider : 3 décisions pré-câblées (assortiment, réseau, omnicanal) — src/lib/v4/pack-retail.ts
- [ ] Pack Énergie & Utilities, puis Supply chain (même grammaire)
- [ ] Copilote : objets métier et indicateurs canoniques Retail pré-mappés
- [ ] Architecturer : architectures de référence Retail / Utilities / Supply
- [x] Rapport v2 : atlas d'écrans (Décider, Copilote, Architecturer) + 30 cas approfondis bout-en-bout (`/mnt/documents/aura-rapport-v2-atlas-et-30-cas.pdf`)

## Aura V2 — modernisation complète (livré)
- [x] Cadrer par le dialogue : le fil produit un dossier (leviers, options, critères, exigences rédhibitoires, impacts ordinaux), corrigeable ligne par ligne, validé explicitement
- [x] Arbitrer sur votre propre dossier (chip « Votre dossier ») en plus des cas mémorisés — moteur V1 inchangé
- [x] Signer la décision (option, motif, réserves, signataire) + boucle prévu/constaté par critère
- [x] Mise en œuvre : initiatives rattachées aux critères, applications, échanges, séquence, backlog epic → feature → user story avec critères d'acceptation
- [x] Dialogue : dictée vocale et import de document dans le composeur
- [ ] Mémoire partagée multi-postes (compte + publication du dossier) — reste local au navigateur
