# Questionnaire Studio et profils Décider

> SI et données fictifs (Héliade Énergies). Aucun lien avec un opérateur réel. Fichier généré par `npx tsx scripts/gen-energy-docs.ts`.

## Questionnaire Studio

- **Q1** Quel outil est maître des identifiants d'actifs, et quels outils en gardent une copie (SCADA, GMAO, planification, TSO) ? *(alimente E8)*
- **Q2** Où lire l'acquittement et l'état d'exécution d'une consigne, et quel délai maximal d'acquittement l'orchestrateur publie-t-il ? *(alimente E1)*
- **Q3** Quel outil publie l'écart consigne–télémesure et la tolérance par actif ? *(alimente E1)*
- **Q4** La planification publie-t-elle la capacité disponible par période et les conflits avec les indisponibilités ? *(alimente E2)*
- **Q5** Le SoC des stockages est-il exposé en temps réel, et le SoC requis par programme est-il publié ? *(alimente E3)*
- **Q6** L'outil REMIT publie-t-il l'échéance de publication et le retard constaté pour chaque indisponibilité ? *(alimente E4)*
- **Q7** Quel outil qualifie une télémesure de figée, et avec quel seuil ? *(alimente E5)*
- **Q8** Où lire l'état des liens centre–pays et le passage en mode dégradé ? *(alimente E6)*
- **Q9** Les contraintes locales (GMAO, journal de quart) sont-elles exposées en MW par actif ? *(alimente E7)*
- **Q10** Par quel protocole chaque outil est-il accessible (REST, Kafka, MQTT, IEC 104, OPC UA, SOAP, MCP) et avec quelle authentification ? *(alimente E1, E2, E3, E4, E5, E6, E7, E8)*

## Profils Décider

| Profil | Règles suivies | Critères qualitatifs |
|---|---|---|
| Dispatcher central | E1, E7 | Sûreté de conduite, Respect du programme, Charge opérateur |
| Chef de quart pays | E5, E6 | Contrôlabilité, Délai de rétablissement, Sécurité des intervenants |
| Responsable trading / services système | E2, E3 | Tenue des engagements, Exposition aux pénalités, Valeur de marché |
| Responsable conformité REMIT | E4 | Conformité, Exactitude de l'information, Rapidité |
| Responsable données d'actifs / DSI | E8, E6 | Cohérence des référentiels, Effort de correction, Risque opérationnel |
| Direction (décisions stratégiques) | décisions stratégiques | Valeur, Risque, Capex/Opex, Conformité, Résilience |
