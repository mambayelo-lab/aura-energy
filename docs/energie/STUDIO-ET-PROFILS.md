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
- **Q11** Le BMS/EMS expose-t-il SoC, SoH, températures, alarme gaz et énergie disponible vs énergie requise par l'engagement ? *(alimente E10, E11, E12)*
- **Q12** Où lire débit restitué, débit réservé et cotes min/max de chaque ouvrage ? *(alimente E13, E14)*
- **Q13** L'exploitation thermique publie-t-elle démarrages restants, démarrages planifiés, émissions et VLE du permis ? *(alimente E15, E16)*
- **Q14** Quel outil publie l'écart par périmètre d'équilibre, le seuil interne et le prix de déséquilibre ? *(alimente E17)*
- **Q15** L'outil de performance publie-t-il productible attendu, écart, tolérance et disponibilité contractuelle ? *(alimente E18, E19)*
- **Q16** Où lire mode de réglage de tension, réglages de protection, préqualifications et accusés d'activation GRT ? *(alimente E9, E20, E21, E23)*
- **Q17** La supervision OT publie-t-elle les événements qualifiés et l'échéance d'alerte précoce NIS2 ? *(alimente E22)*

## Profils Décider

| Profil | Règles suivies | Critères qualitatifs |
|---|---|---|
| Dispatcher central | E1, E7 | Sûreté de conduite, Respect du programme, Charge opérateur |
| Chef de quart pays | E5, E6 | Contrôlabilité, Délai de rétablissement, Sécurité des intervenants |
| Responsable trading / services système | E2, E3, E9, E17, E23 | Tenue des engagements, Exposition aux pénalités, Valeur de marché |
| Responsable conformité REMIT | E4 | Conformité, Exactitude de l'information, Rapidité |
| Responsable données d'actifs / DSI | E8, E6 | Cohérence des référentiels, Effort de correction, Risque opérationnel |
| Responsable actifs stockage | E3, E10, E11, E12 | Sécurité, Tenue des engagements, Durée de vie, Valeur de marché |
| Exploitant hydraulique / thermique | E13, E14, E15, E16 | Conformité environnementale, Disponibilité, Coût d'exploitation, Engagements |
| Responsable performance et contrats O&M | E18, E19 | Énergie produite, Respect des garanties, Coût d'intervention |
| Responsable conformité raccordement | E20, E21, E23 | Conformité code de réseau, Sûreté système, Délai de mise en conformité |
| Responsable cybersécurité OT | E22, E6 | Confinement, Continuité de conduite, Conformité NIS2 |
| Direction (décisions stratégiques) | décisions stratégiques | Valeur, Risque, Capex/Opex, Conformité, Résilience |
