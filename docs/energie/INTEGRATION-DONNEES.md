# Intégration des données — Aura Énergie × Héliade Énergies (fictif)

> SI et données fictifs ; données publiques ENTSO-E citées ; aucun lien avec un opérateur réel.

## Chaîne de lecture

1. **Connecteur** `src/lib/energy/heliade.ts` : `GET {VITE_HELIADE_URL}/api/aura/snapshot` (Bearer, jeton de démonstration public). Sans URL ou en cas d'échec : instantané embarqué `src/lib/energy/heliade-snapshot.json` (exporté par `npm run snapshot` dans le dépôt Héliade).
2. **Règles causales** `src/lib/energy/rules.ts` : comparaisons de valeurs lues (statuts, écarts, échéances, seuils publiés par l'outil source). Aucun calcul métier, aucune consigne.
3. **Cockpit** `/cockpit/energie` : alertes triées par gravité, valeurs lues et source citées, bouton « Ouvrir dans Décider » (le contexte de l'alerte pré-remplit le dialogue).
4. **Décider** : comparaison qualitative des options via le moteur existant (`src/lib/engine/lo/*`, inchangé).

## Accès par outil

| Outil | Protocole | Données lues |
|---|---|---|
| Référentiel d'actifs | REST, MCP | actifs, sites, contrats, correspondances d'identifiants |
| Programmes | REST, Kafka (AsyncAPI) | DA/ID, aFRR/mFRR, SoC requis, capacité disponible lue |
| Orchestrateur de consignes | REST, Kafka | acquittement, âge, écart consigne–télémesure, tolérance, limite locale |
| Suivi temps réel | MQTT, REST | puissance, SoC, qualité, durée sans variation |
| Indisponibilités | REST | nature, capacité restante, engagements impactés |
| Historian | OPC UA (passerelle REST) | qualité OPC UA des tags |
| Couche pays (SCADA) | IEC 60870-5-104 (passerelle REST) | état des liens, mode dégradé |
| Connecteur TSO | SOAP 1.1 | messages d'activation / programmes |
| Journaux de quart, GMAO, Monitoring réseau | REST | contraintes locales, OT, état des passerelles |
| Publication REMIT | REST | statut UMM, échéance, retard lu |
| ENTSO-E (public) | REST via Héliade `/entsoe/*` | prix DA, production par filière, indisponibilités publiées |

## Variables d'environnement

| Variable | Usage |
|---|---|
| `VITE_HELIADE_URL` | URL du SI Héliade (facultatif ; sinon instantané embarqué) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Comptes, sessions (mêmes noms qu'Aura Supply) |
| `MISTRAL_API_KEY`, `MISTRAL_DIALOGUE_MODEL` | Dialogue Décider |
| `RESEND_API_KEY`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Courriels (facultatif) |
| `CRON_SECRET` | Tâche planifiée d'intégration |

Côté Héliade : `ENTSOE_API_TOKEN` (facultatif), `HELIADE_GATEWAY_TOKEN` (facultatif). Aucun secret n'est commité.

Voir aussi : [REGLES-CAUSALES.md](REGLES-CAUSALES.md), [MATRICE-ALERTES-DONNEES.md](MATRICE-ALERTES-DONNEES.md), [ONTOLOGIE.md](ONTOLOGIE.md), [STUDIO-ET-PROFILS.md](STUDIO-ET-PROFILS.md), [GUIDE-ARCHITECTURE.md](GUIDE-ARCHITECTURE.md).
