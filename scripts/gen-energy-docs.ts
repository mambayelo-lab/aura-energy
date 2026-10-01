// Génère docs/energie/REGLES-CAUSALES.md et MATRICE-ALERTES-DONNEES.md depuis le code (source unique).
import { writeFileSync } from "node:fs";
import { ENERGY_RULES, alertDataMatrix } from "../src/lib/energy/rules";
import { ENERGY_OBJECTS, ENERGY_RELATIONS } from "../src/lib/energy/ontology";
import { DECIDER_PROFILES, ENERGY_QUESTIONNAIRE } from "../src/lib/energy/studio";

const head = "> SI et données fictifs (Héliade Énergies). Aucun lien avec un opérateur réel. Fichier généré par `npx tsx scripts/gen-energy-docs.ts`.\n\n";
writeFileSync("docs/energie/REGLES-CAUSALES.md", "# Catalogue des règles causales Énergie\n\n" + head +
  "Chaque règle compare des valeurs **lues** dans le SI ; Aura ne recalcule rien et n'émet aucune consigne. Les leviers sont des options soumises à Décider.\n\n" +
  ENERGY_RULES.map(r => `## ${r.id} — ${r.label}\n\n- **Gravité** : ${r.gravite}\n${r.reference ? `- **Source** : ${r.reference}\n` : ""}${r.options ? `- **Options Décider** : ${r.options.join(" / ")}\n- **Indicateurs** : ${r.indicateurs?.join(", ")}\n` : ""}- **SI** ${r.si}\n- **ALORS** ${r.alors}\n- **Données lues** : ${r.donneesLues.map(d => "`" + d + "`").join(", ")}\n- **Objets** : ${r.objets.join(", ")}\n- **Décideur** : ${r.decideur}\n- **Question de décision** : ${r.decisionQuestion}\n- **Leviers Décider** : ${r.leviers.join(" ; ")}\n`).join("\n"));
const rules = ENERGY_RULES.map(r => r.id);
writeFileSync("docs/energie/MATRICE-ALERTES-DONNEES.md", "# Matrice alertes × données\n\n" + head +
  `| Outil Héliade | ${rules.join(" | ")} |\n|---|${rules.map(() => ":-:").join("|")}|\n` +
  alertDataMatrix().map(m => `| ${m.outil} | ${rules.map(id => m.regles.includes(id) ? "●" : "").join(" | ")} |`).join("\n") + "\n");
writeFileSync("docs/energie/ONTOLOGIE.md", "# Ontologie Énergie\n\n" + head +
  "| Objet | Clé | Outil maître | Description |\n|---|---|---|---|\n" + ENERGY_OBJECTS.map(o => `| ${o.libelle} | \`${o.cle}\` | ${o.maitre} | ${o.description} |`).join("\n") +
  "\n\n## Relations\n\n" + ENERGY_RELATIONS.map(([a, v, b]) => `- ${a} *${v}* ${b}`).join("\n") + "\n");
writeFileSync("docs/energie/STUDIO-ET-PROFILS.md", "# Questionnaire Studio et profils Décider\n\n" + head +
  "## Questionnaire Studio\n\n" + ENERGY_QUESTIONNAIRE.map(q => `- **${q.id}** ${q.question} *(alimente ${q.alimente.join(", ")})*`).join("\n") +
  "\n\n## Profils Décider\n\n| Profil | Règles suivies | Critères qualitatifs |\n|---|---|---|\n" + DECIDER_PROFILES.map(p => `| ${p.libelle} | ${p.regles.join(", ") || "décisions stratégiques"} | ${p.criteres.join(", ")} |`).join("\n") + "\n");
