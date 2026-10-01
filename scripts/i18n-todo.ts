// Liste les textes français extraits des écrans principaux qui n'ont pas encore de traduction.
import { readFileSync, writeFileSync } from "node:fs";
import { translatePhrase } from "../src/lib/i18n-dom";
const [, , input, output] = process.argv;
const d: [string, string][] = JSON.parse(readFileSync(input, "utf8"));
const FR = /[éèêàùçôîâœ]|\b(le|la|les|des|du|de|un|une|et|ou|pour|avec|sans|sur|dans|par|aux?|est|sont|vos|votre|nos|notre|ce|cette|ces|qui|que|pas|plus|en|il|elle|leur|à)\b|\b[dl]'/i;
const out = d.filter(([s, scr]) => !scr.startsWith("studio-data") && FR.test(s) && translatePhrase(s) === null).map(([s]) => s);
writeFileSync(output, out.join("\n"));
console.log(out.length);
