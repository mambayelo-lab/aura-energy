# Runtime LLM Aura

Aura utilise **Mistral** comme moteur texte principal. Le dialogue central et les générations métier restent côté serveur : aucune clé n'est exposée au navigateur.

## Variables Vercel

- `MISTRAL_API_KEY` — obligatoire.
- `MISTRAL_DIALOGUE_MODEL` — facultative ; valeur recommandée : `mistral-small-latest`.

Configurer ces variables pour **Production**, **Preview** et **Development**, puis redéployer.

## Choix du modèle

`mistral-small-latest` est le modèle par défaut pour le dialogue guidé : coût maîtrisé, français correct et latence adaptée. Les calculs BORA ne passent jamais par le LLM.

## Exploitation

- Les réponses du dialogue sont streamées via `/api/aura/dialogue`.
- Trois tentatives bornées sont effectuées lors d'un `429`.
- Une saturation persistante devient un message utilisateur court ; aucune fausse réponse n'est générée.
- Les demandes de modification produisent une proposition à confirmer avant transmission à l'espace de travail.
- Surveiller dans Mistral Studio : requêtes/minute, tokens/minute, crédits et taux de `429`.

## Test de recette

1. Ouvrir Décider et demander d'expliquer un critère : la réponse doit apparaître progressivement.
2. Ouvrir Architecturer et demander un changement : une carte « Proposition à confirmer » doit apparaître.
3. Écarter : le dossier ne change pas.
4. Confirmer : l'événement `aura:accepted-proposal` est émis vers l'espace de travail.
5. Simuler un quota épuisé : l'interface doit afficher l'indisponibilité sans prétendre avoir appliqué la demande.
