// Questionnaire Studio Énergie et profils Décider.
export const ENERGY_QUESTIONNAIRE: { id: string; question: string; alimente: string[] }[] = [
  { id: "Q1", question: "Quel outil est maître des identifiants d'actifs, et quels outils en gardent une copie (SCADA, GMAO, planification, TSO) ?", alimente: ["E8"] },
  { id: "Q2", question: "Où lire l'acquittement et l'état d'exécution d'une consigne, et quel délai maximal d'acquittement l'orchestrateur publie-t-il ?", alimente: ["E1"] },
  { id: "Q3", question: "Quel outil publie l'écart consigne–télémesure et la tolérance par actif ?", alimente: ["E1"] },
  { id: "Q4", question: "La planification publie-t-elle la capacité disponible par période et les conflits avec les indisponibilités ?", alimente: ["E2"] },
  { id: "Q5", question: "Le SoC des stockages est-il exposé en temps réel, et le SoC requis par programme est-il publié ?", alimente: ["E3"] },
  { id: "Q6", question: "L'outil REMIT publie-t-il l'échéance de publication et le retard constaté pour chaque indisponibilité ?", alimente: ["E4"] },
  { id: "Q7", question: "Quel outil qualifie une télémesure de figée, et avec quel seuil ?", alimente: ["E5"] },
  { id: "Q8", question: "Où lire l'état des liens centre–pays et le passage en mode dégradé ?", alimente: ["E6"] },
  { id: "Q9", question: "Les contraintes locales (GMAO, journal de quart) sont-elles exposées en MW par actif ?", alimente: ["E7"] },
  { id: "Q10", question: "Par quel protocole chaque outil est-il accessible (REST, Kafka, MQTT, IEC 104, OPC UA, SOAP, MCP) et avec quelle authentification ?", alimente: ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"] },
  { id: "Q11", question: "Le BMS/EMS expose-t-il SoC, SoH, températures, alarme gaz et énergie disponible vs énergie requise par l'engagement ?", alimente: ["E10", "E11", "E12"] },
  { id: "Q12", question: "Où lire débit restitué, débit réservé et cotes min/max de chaque ouvrage ?", alimente: ["E13", "E14"] },
  { id: "Q13", question: "L'exploitation thermique publie-t-elle démarrages restants, démarrages planifiés, émissions et VLE du permis ?", alimente: ["E15", "E16"] },
  { id: "Q14", question: "Quel outil publie l'écart par périmètre d'équilibre, le seuil interne et le prix de déséquilibre ?", alimente: ["E17"] },
  { id: "Q15", question: "L'outil de performance publie-t-il productible attendu, écart, tolérance et disponibilité contractuelle ?", alimente: ["E18", "E19"] },
  { id: "Q16", question: "Où lire mode de réglage de tension, réglages de protection, préqualifications et accusés d'activation GRT ?", alimente: ["E9", "E20", "E21", "E23"] },
  { id: "Q17", question: "La supervision OT publie-t-elle les événements qualifiés et l'échéance d'alerte précoce NIS2 ?", alimente: ["E22"] },
];

export const DECIDER_PROFILES: { id: string; libelle: string; regles: string[]; criteres: string[] }[] = [
  { id: "dispatcher", libelle: "Dispatcher central", regles: ["E1", "E7"], criteres: ["Sûreté de conduite", "Respect du programme", "Charge opérateur"] },
  { id: "chef-quart", libelle: "Chef de quart pays", regles: ["E5", "E6"], criteres: ["Contrôlabilité", "Délai de rétablissement", "Sécurité des intervenants"] },
  { id: "trading", libelle: "Responsable trading / services système", regles: ["E2", "E3", "E9", "E17", "E23"], criteres: ["Tenue des engagements", "Exposition aux pénalités", "Valeur de marché"] },
  { id: "conformite", libelle: "Responsable conformité REMIT", regles: ["E4"], criteres: ["Conformité", "Exactitude de l'information", "Rapidité"] },
  { id: "donnees", libelle: "Responsable données d'actifs / DSI", regles: ["E8", "E6"], criteres: ["Cohérence des référentiels", "Effort de correction", "Risque opérationnel"] },
  { id: "stockage", libelle: "Responsable actifs stockage", regles: ["E3", "E10", "E11", "E12"], criteres: ["Sécurité", "Tenue des engagements", "Durée de vie", "Valeur de marché"] },
  { id: "hydro-thermique", libelle: "Exploitant hydraulique / thermique", regles: ["E13", "E14", "E15", "E16"], criteres: ["Conformité environnementale", "Disponibilité", "Coût d'exploitation", "Engagements"] },
  { id: "performance", libelle: "Responsable performance et contrats O&M", regles: ["E18", "E19"], criteres: ["Énergie produite", "Respect des garanties", "Coût d'intervention"] },
  { id: "raccordement", libelle: "Responsable conformité raccordement", regles: ["E20", "E21", "E23"], criteres: ["Conformité code de réseau", "Sûreté système", "Délai de mise en conformité"] },
  { id: "cyber", libelle: "Responsable cybersécurité OT", regles: ["E22", "E6"], criteres: ["Confinement", "Continuité de conduite", "Conformité NIS2"] },
  { id: "direction", libelle: "Direction (décisions stratégiques)", regles: [], criteres: ["Valeur", "Risque", "Capex/Opex", "Conformité", "Résilience"] },
];
