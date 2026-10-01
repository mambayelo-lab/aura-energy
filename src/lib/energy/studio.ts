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
];

export const DECIDER_PROFILES: { id: string; libelle: string; regles: string[]; criteres: string[] }[] = [
  { id: "dispatcher", libelle: "Dispatcher central", regles: ["E1", "E7"], criteres: ["Sûreté de conduite", "Respect du programme", "Charge opérateur"] },
  { id: "chef-quart", libelle: "Chef de quart pays", regles: ["E5", "E6"], criteres: ["Contrôlabilité", "Délai de rétablissement", "Sécurité des intervenants"] },
  { id: "trading", libelle: "Responsable trading / services système", regles: ["E2", "E3"], criteres: ["Tenue des engagements", "Exposition aux pénalités", "Valeur de marché"] },
  { id: "conformite", libelle: "Responsable conformité REMIT", regles: ["E4"], criteres: ["Conformité", "Exactitude de l'information", "Rapidité"] },
  { id: "donnees", libelle: "Responsable données d'actifs / DSI", regles: ["E8", "E6"], criteres: ["Cohérence des référentiels", "Effort de correction", "Risque opérationnel"] },
  { id: "direction", libelle: "Direction (décisions stratégiques)", regles: [], criteres: ["Valeur", "Risque", "Capex/Opex", "Conformité", "Résilience"] },
];
