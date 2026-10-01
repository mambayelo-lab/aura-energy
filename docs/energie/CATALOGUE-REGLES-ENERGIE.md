# Catalogue de règles causales — exploitant d'actifs renouvelables et flexibles

Principe : **Aura ne calcule rien**. Chaque règle compare des **valeurs lues dans le SI** (fournies par l'outil source : écarts, statuts, seuils, échéances) et ouvre une **question de décision** ; Décider compare qualitativement les options. **Aucun agent n'émet de consigne.** SI et données de démonstration fictifs (Héliade Énergies).

Classement : **Valeur** (V3 forte = sûreté, conformité, pénalités ; V2 ; V1) × **Faisabilité** (F3 = donnée habituellement exposée par un outil existant ; F2 = à exposer ; F1 = intégration lourde). Statut : ✅ implémentée dans `src/lib/energy/rules.ts`, ○ candidate.

## Règles implémentées (23)

| Id | SI (valeurs lues) … ALORS … | Données SI nécessaires | Gravité | V×F | Source | Leviers / options Décider |
|---|---|---|---|---|---|---|
| E1 ✅ | Acquittement consigne ABSENT au-delà du délai lu, ou écart consigne–télémesure lu > tolérance lue → consigne sans effet | orchestrateur.setpoints (acquittement, ageS, délai max, écart lu, tolérance) | critique | V3·F3 | Pratique des centres de conduite | Relance centre pays · report sur autre actif · déclaration d'écart |
| E2 ✅ | Puissance engagée aFRR/mFRR lue > capacité disponible lue, ou conflit d'indisponibilité lu → engagement intenable | planification.schedules ; indisponibilites | critique | V3·F3 | [SOGL 2017/1485](https://eur-lex.europa.eu/eli/reg/2017/1485/oj) ; [EBGL 2017/2195](https://eur-lex.europa.eu/eli/reg/2017/2195/oj) | Réaffecter · racheter · notifier le GRT |
| E3 ✅ | SoC lu incompatible avec SoC requis lu par le programme → programme irréalisable | temps-reel.socPct ; planification.socRequisPct | majeure | V3·F3 | Pratique BESS | Recharge anticipée · réduction · revente ID |
| E4 ✅ | UMM NON_PUBLIEE et échéance lue dépassée → non-conformité REMIT | remit.umm | critique | V3·F3 | [REMIT 1227/2011 art. 4](https://eur-lex.europa.eu/eli/reg/2011/1227/oj) ; [Transparence 543/2013 art. 15 (≤ 1 h)](https://eur-lex.europa.eu/eli/reg/2013/543/oj) | Publier puis mettre à jour · valider la durée · escalade |
| E5 ✅ | Qualité lue FIGEE et durée lue > seuil lu → télémesure non fiable | temps-reel ; historian | majeure | V2·F3 | Qualité de données SCADA ([IEC 61400-25](https://webstore.iec.ch/en/publication/62548) famille IEC 61400) | Mesure de secours · actif non contrôlable · astreinte |
| E6 ✅ | Lien centre–pays DOWN ou mode dégradé lu → actifs non pilotables depuis le centre | scada-pays.links ; monitoring-reseau | critique | V3·F3 | Pratique multi-centres ; IEC 60870-5-104 | Transfert au centre pays · gel des programmes · lien de secours |
| E7 ✅ | Consigne lue > limite locale lue (GMAO, quart) → consigne inexécutable | orchestrateur ; gmao ; journal-quart | majeure | V2·F3 | Pratique O&M | Aligner · lever la contrainte · répartir |
| E8 ✅ | Statut de rapprochement d'identifiants lu = ECART → données d'actif incohérentes | referentiel.crosswalk ; gmao | mineure | V2·F3 | Gouvernance des données | Corriger la source · table de correspondance · référentiel maître |
| E9 ✅ | Activation GRT lue EN_ATTENTE et âge lu > délai lu → activation non confirmée | tso.messages (type, acquittement, ageS, délai max) | critique | V3·F3 | [EBGL](https://eur-lex.europa.eu/eli/reg/2017/2195/oj) ; [PICASSO](https://www.entsoe.eu/news/2022/06/24/entso-e-welcomes-the-first-exchange-on-the-european-balancing-platform-picasso-as-an-important-step-for-increased-security-of-supply-reduced-costs-for-consumers) / [MARI](https://www.entsoe.eu/network_codes/eb/mari/) | Confirmer · reporter sur actif qualifié · signaler au GRT |
| E10 ✅ | Énergie disponible lue (EMS) < énergie requise lue par l'engagement → réserve non tenable sur la durée (réservoir limité) | bms.batteries (énergie disponible, énergie requise) | critique | V3·F2 | [SOGL art. 156 (LER, 15–30 min)](https://consultations.entsoe.eu/system-operations/rgce-fcr-with-ler-sogl-156-11/supporting_documents/210723%20%20Explanatory%20document%20to%20all%20TSOs%20proposal%20for%20the%20definition%20of%20Time%20Period%20%20Clean.pdf) | Recharger · réduire l'offre · réaffecter |
| E11 ✅ | Alarme gaz lue ou température cellule lue > seuil lu → précurseur d'emballement thermique | bms.batteries (alarmeGaz, tempCellule, seuil, rack) | critique | V3·F3 | [NFPA 855 / BESS — DOE](https://www.energy.gov/sites/default/files/2023-06/Battery%20Energy%20Storage%20System%20Fire%20Safety.pdf) ; [EPRI base d'incidents](https://restservice.epri.com/publicdownload/000000003002021208/0/Product) | Arrêt · isolement du rack · surveillance + intervention |
| E12 ✅ | SoH lu < seuil garanti lu → dégradation hors garantie | bms.batteries (SoH, seuil) ; contrats | majeure | V2·F3 | Contrats de garantie BESS | Recours garantie · moins de cyclage · augmentation de capacité |
| E13 ✅ | Débit restitué lu < débit réservé lu → débit minimal non respecté | hydro.ouvrages | critique | V3·F3 | [Code env. L214-18](https://www.legifrance.gouv.fr/codes/id/LEGIARTI000034083606/2017-02-26) | Rétablir · vérifier la mesure · informer l'administration |
| E14 ✅ | Cote lue hors [cote min lue ; cote max lue] → programme incompatible | hydro.ouvrages | majeure | V2·F3 | Règlements d'eau | Réduire le turbinage · retirer l'offre mFRR · décaler |
| E15 ✅ | Démarrages planifiés lus > démarrages restants lus → quota dépassé | thermique.unites | majeure | V2·F2 | Contrats constructeur (démarrages / heures équivalentes) | Regrouper · céder des périodes · négocier |
| E16 ✅ | NOx lu > VLE lue → dépassement de valeur limite | thermique.unites | critique | V3·F3 | [Directive 2010/75/UE](https://eur-lex.europa.eu/eli/dir/2010/75/oj) | Réduire la charge · arrêter · déclarer |
| E17 ✅ | Écart lu de périmètre hors ±seuil lu → exposition au prix de déséquilibre | equilibre.perimetres | majeure | V3·F3 | [EBGL — règlement des écarts](https://eur-lex.europa.eu/eli/reg/2017/2195/oj) | Rééquilibrer en ID · flexibilité interne · accepter |
| E18 ✅ | Écart lu production/productible < −tolérance lue → perte à expliquer | performance.actifs | majeure | V2·F2 | Bonnes pratiques O&M | Intervenir · réviser le programme · réclamer |
| E19 ✅ | Disponibilité lue < disponibilité garantie lue → garantie O&M en défaut | performance.actifs | majeure | V2·F2 | [IEC 61400-26-1](https://webstore.iec.ch/en/publication/62548) | Pénalités · plan d'action · renégocier |
| E20 ✅ | Mode de tension lu ≠ mode exigé lu (ex. cos φ fixe) → pas de contribution à la tenue de tension | conformite-reseau.raccordements | critique | V3·F2 | [NC RfG 2016/631](https://eur-lex.europa.eu/eli/reg/2016/631/oj) ; rapport final ENTSO-E 28/04/2025 ([synthèse](https://www.pv-magazine.com/2026/03/23/entso-e-report-finds-systemic-failures-behind-2025-iberian-blackout/), [détail](https://www.renewableenergyworld.com/power-grid/outage-management/final-entso-e-report-sheds-light-on-multiple-factors-that-caused-iberia-blackout)) | Basculer · planifier · dérogation |
| E21 ✅ | Réglage de protection surtension lu < seuil lu du code de réseau → déclenchement prématuré | conformite-reseau.raccordements | critique | V3·F2 | [NC RfG](https://eur-lex.europa.eu/eli/reg/2016/631/oj) ; [SolarPower Europe sur le rapport ENTSO-E](https://www.solarpowereurope.org/press-releases/joint-statement-entso-e-factual-report-on-the-iberian-blackout) | Corriger · vérifier · campagne parc |
| E22 ✅ | Événement OT lu HAUTE et NON_QUALIFIE (échéance lue) → incident potentiellement significatif | cyber-ot.evenements | critique | V3·F2 | [NIS2 2022/2555 art. 23 (24 h / 72 h)](https://eur-lex.europa.eu/eli/dir/2022/2555/oj) ; [ISA/IEC 62443](https://www.isa.org/standards-and-publications/isa-standards/isa-iec-62443-series-of-standards) | Isoler et notifier · qualifier d'abord · notifier sans isoler |
| E23 ✅ | Préqualification lue EXPIREE et engagement actif lu → réserve hors préqualification | conformite-reseau.prequalifications | majeure | V3·F3 | [SOGL art. 158–159](https://eur-lex.europa.eu/eli/reg/2017/1485/oj) | Retirer · requalifier · réaffecter |

## Règles candidates (non implémentées)

| Id | SI … ALORS … | Données SI | Gravité | V×F | Source |
|---|---|---|---|---|---|
| C24 ○ | Changement de disponibilité lu non publié sur la plateforme de transparence au-delà d'1 h → non-conformité transparence | indisponibilites ; publication transparence | critique | V3·F2 | [Règlement 543/2013 art. 15](https://eur-lex.europa.eu/eli/reg/2013/543/oj) |
| C25 ○ | Fin estimée lue d'une indisponibilité dépassée et UMM non mise à jour → information privilégiée obsolète | remit ; indisponibilites | majeure | V3·F3 | [REMIT](https://eur-lex.europa.eu/eli/reg/2011/1227/oj) |
| C26 ○ | Tension lue au point de livraison hors plage lue (ex. 380–420 kV) → risque système | temps-reel ; conformite-reseau | critique | V3·F2 | Rapport final ENTSO-E 28/04/2025 |
| C27 ○ | Réactif fourni lu < réactif demandé lu par le GRT → consigne de tension non tenue | tso ; temps-reel | critique | V3·F2 | Rapport final ENTSO-E 28/04/2025 |
| C28 ○ | Ordre d'écrêtement GRT lu sans compensation déclarée lue → perte non indemnisée | tso ; performance | majeure | V2·F2 | Bonnes pratiques O&M (curtailment) |
| C29 ○ | Taux de complétude lu des télémesures < seuil lu → reporting et règles peu fiables | historian | majeure | V2·F3 | Qualité de données SCADA |
| C30 ○ | Accès distant prestataire lu sans ticket d'intervention lu → accès non autorisé | cyber-ot ; gmao | critique | V3·F2 | [ISA/IEC 62443](https://www.isa.org/standards-and-publications/isa-standards/isa-iec-62443-series-of-standards) |
| C31 ○ | Correctif de sécurité OT critique lu non appliqué au-delà de l'échéance lue | cyber-ot | majeure | V2·F2 | NIS2 art. 21 ; IEC 62443 |
| C32 ○ | Injection lue d'un site hybride > puissance de raccordement lue | temps-reel ; referentiel | critique | V3·F3 | NC RfG / contrat de raccordement |
| C33 ○ | Prix lu négatif et production lue non écrêtée sur un actif sans soutien lu → perte de valeur | marché ; temps-reel ; contrats | majeure | V2·F3 | Pratique marché |
| C34 ○ | Allocation / quotas CO2 lus < émissions vérifiées lues → couverture à décider | thermique ; registre carbone | majeure | V2·F2 | [Directive 2003/87/CE (EU ETS)](https://eur-lex.europa.eu/eli/dir/2003/87/oj) |
| C35 ○ | Dispersion lue des tensions cellules > seuil lu (BMS) → déséquilibrage, dégradation | bms | mineure | V1·F3 | Pratique BESS |

## Méthode et limites

- Sources vérifiées par recherche web le 01/10/2026 ; les URL EUR-Lex utilisent l'identifiant ELI officiel. Les normes IEC/ISA sont payantes : seule la fiche de publication est citée.
- Les seuils (tolérances, délais, VLE, débits réservés, seuils SoH) sont **lus** dans l'outil source ou le contrat ; Aura ne les fixe pas et ne recalcule ni disponibilité, ni écart, ni pénalité.
- Valeur × faisabilité : jugement qualitatif sur la nature de l'enjeu (sûreté/conformité/pénalité) et sur l'exposition habituelle de la donnée ; à confirmer avec chaque exploitant.
