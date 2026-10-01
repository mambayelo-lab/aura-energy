import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { deflateRawSync } from "node:zlib";
import { chunkText, diagramToText, formatOf, parseArchimate, parseBpmn, parseDrawio, parseSvg, parseVsdx, pptxText, unsupportedMessage, xmlFlavor } from "../doc-formats";
import { extractFiles } from "../doc-extract";
import { DRAWIO } from "../../../test/fixtures/diagrams";


describe("formats lus dans le navigateur", () => {
  it("reconnaît les formats et explique ceux qui ne se lisent pas", () => {
    expect(["a.pdf", "a.pptx", "a.drawio", "a.bpmn", "a.archimate", "a.vsdx", "a.svg", "a.json", "a.md", "a.zip", "a.PNG"].map(formatOf)).toEqual(["pdf", "pptx", "drawio", "bpmn", "archimate", "vsdx", "svg", "json", "text", "zip", "image"]);
    expect(formatOf("a.doc")).toBe("unsupported");
    expect(unsupportedMessage("vieux.doc")).toMatch(/non lisible.*\.docx/);
  });
  it("draw.io : éléments et flux, libellé d'arête porté par une étiquette enfant", async () => {
    const d = await parseDrawio(DRAWIO);
    expect(d.nodes.map(n => n.label)).toEqual(["SAP S/4HANA", "Manhattan WMS", "Data lake"]);
    expect(d.edges).toEqual([{ from: "b", to: "c", label: "stock" }, { from: "a", to: "b", label: "commandes d'achat" }]);
    expect(diagramToText(d)).toContain("SAP S/4HANA → Manhattan WMS : commandes d'achat");
  });
  it("draw.io compressé (deflate + base64)", async () => {
    const inner = DRAWIO.match(/<mxGraphModel>[\s\S]*<\/mxGraphModel>/)![0];
    const packed = deflateRawSync(Buffer.from(encodeURIComponent(inner))).toString("base64");
    const d = await parseDrawio(`<mxfile><diagram id="d">${packed}</diagram></mxfile>`);
    expect(d.nodes).toHaveLength(3);
  });
  it("BPMN : couloirs, tâches, objets et flux de messages", () => {
    const d = parseBpmn(`<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"><collaboration><participant id="p1" name="OMS"/><participant id="p2" name="WMS"/><messageFlow id="m" sourceRef="p1" targetRef="p2" name="commande client"/></collaboration><process><task id="t" name="Préparer la commande"/><dataObjectReference id="o" name="Stock"/></process></definitions>`);
    expect(xmlFlavor(`<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">`)).toBe("bpmn");
    expect(d.nodes.map(n => `${n.label}:${n.type}`)).toEqual(["OMS:participant", "WMS:participant", "Préparer la commande:activité", "Stock:objet"]);
    expect(d.edges[0]).toEqual({ from: "p1", to: "p2", label: "commande client" });
  });
  it("ArchiMate (format d'échange) : composants applicatifs et relations", () => {
    const d = parseArchimate(`<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><elements><element identifier="e1" xsi:type="ApplicationComponent"><name>SAP ECC</name></element><element identifier="e2" xsi:type="ApplicationComponent"><name>Akeneo PIM</name></element></elements><relationships><relationship identifier="r" source="e2" target="e1" xsi:type="Flow"><name>articles</name></relationship></relationships></model>`);
    expect(d.nodes.map(n => n.label)).toEqual(["SAP ECC", "Akeneo PIM"]);
    expect(d.edges[0]).toMatchObject({ from: "e2", to: "e1", label: "Flow · articles" });
  });
  it("Visio (.vsdx) : formes et connecteurs", async () => {
    const zip = new JSZip();
    zip.file("visio/pages/page1.xml", `<PageContents><Shapes><Shape ID="1"><Text>TMS</Text></Shape><Shape ID="2"><Text>OMS</Text></Shape><Shape ID="3"><Text>expéditions</Text></Shape></Shapes><Connects><Connect FromSheet="3" FromCell="BeginX" ToSheet="2"/><Connect FromSheet="3" FromCell="EndX" ToSheet="1"/></Connects></PageContents>`);
    const d = await parseVsdx(await JSZip.loadAsync(await zip.generateAsync({ type: "uint8array" })));
    expect(d.nodes.map(n => n.label)).toEqual(["TMS", "OMS"]);
    expect(d.edges).toEqual([{ from: "1:2", to: "1:1", label: "expéditions" }]);
  });
  it("PowerPoint et SVG : textes", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide2.xml", `<p:sld><a:p><a:r><a:t>Risques</a:t></a:r></a:p></p:sld>`);
    zip.file("ppt/slides/slide1.xml", `<p:sld><a:p><a:r><a:t>Double </a:t></a:r><a:r><a:t>sourcing</a:t></a:r></a:p></p:sld>`);
    expect(await pptxText(await JSZip.loadAsync(await zip.generateAsync({ type: "uint8array" })))).toBe("Diapositive 1\nDouble sourcing\n\nDiapositive 2\nRisques");
    expect(parseSvg(`<svg xmlns="http://www.w3.org/2000/svg"><text>ERP</text><text>WMS</text></svg>`).texts).toEqual(["ERP", "WMS"]);
  });
  it("découpe les textes longs en morceaux", () => {
    const parts = chunkText("a".repeat(30_000), 12_000);
    expect(parts.map(p => p.length)).toEqual([12_000, 12_000, 6_000]);
  });
  it("plusieurs fichiers et archive .zip : état par fichier (lu, non lisible)", async () => {
    const zip = new JSZip();
    zip.file("si.drawio", DRAWIO); zip.file("notes.md", "# Contexte\nSUP-003 livre 62 %."); zip.file("vieux.doc", "binaire"); zip.file("__MACOSX/._si.drawio", "x");
    const archive = new File([await zip.generateAsync({ type: "uint8array" }) as BlobPart], "dossier.zip");
    const rs = await extractFiles([archive, new File(['{"a":1}'], "config.json")]);
    expect(rs.map(r => [r.name, r.status])).toEqual([["dossier.zip › si.drawio", "lu"], ["dossier.zip › notes.md", "lu"], ["dossier.zip › vieux.doc", "non lisible"], ["config.json", "lu"]]);
    expect(rs[0].diagram?.nodes).toHaveLength(3);
    expect(rs[2].note).toMatch(/\.docx/);
  });
  it("garde-fou large : 500 Mo au total, message clair", async () => {
    const big = { name: "enorme.csv", size: 501 * 1024 * 1024 } as File;
    const rs = await extractFiles([big]);
    expect(rs[0].status).toBe("non lisible");
    expect(rs[0].note).toMatch(/500 Mo/);
  });
});
