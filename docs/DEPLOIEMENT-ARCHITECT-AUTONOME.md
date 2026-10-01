# Aura Architect autonome (déploiement et LLM dédiés)

Objectif : Aura Architect tourne sur SON projet Vercel, avec SA clé Mistral, sans
passer par le déploiement de Supply.

## 1. Projet Vercel `aura-architecturer`
- Settings → Git : connecter `mambayelo-lab/aura-decision-zen`, branche `main`.
- Settings → Build & Deployment : mêmes réglages que `aura-decider`
  (Framework « Other », Build Command `npm run build`).
- Settings → Environment Variables (Production) :
  - `VITE_AURA_PRODUCT` = `architecture`  ← verrouille le déploiement sur Architect
  - `MISTRAL_API_KEY_2` = clé Mistral dédiée à Architect
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
    `SUPABASE_SERVICE_ROLE_KEY` : mêmes valeurs que `aura-decision-zen`
- Deployments → Deploy.

## 2. Lien public `aura-architect-seven`
Projet Vercel `aura-architect` (dépôt `Aura-Architect`) → Environment Variables :
- `ARCHITECT_APP_URL` = `https://aura-architecturer.vercel.app`
puis Redeploy. Le lien pointe alors vers le déploiement autonome.

## 3. Verrouiller les autres déploiements (recommandé)
- `aura-decision-zen` : `VITE_AURA_PRODUCT` = `supply`
- `aura-decider` : `VITE_AURA_PRODUCT` = `decide`
puis Redeploy. Chaque déploiement ne sert alors qu'un produit, quelle que soit l'adresse
(le repli `?app=architecture` sur Supply est désactivé).
