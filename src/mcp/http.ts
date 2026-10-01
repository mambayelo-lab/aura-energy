/**
 * Aura Décision — serveur MCP, transport HTTP (Streamable HTTP).
 *
 * Pour les clients MCP distants : connecteurs ChatGPT (mode développeur),
 * clients web, intégrations d'entreprise. Mode STATELESS : un serveur et un
 * transport par requête — déployable derrière n'importe quel load-balancer
 * (Railway, Render, Fly.io, VM). La persistance reste le fichier JSON
 * (AURA_MCP_STORE) : pointez-le vers un volume persistant en production.
 *
 * Build  : npm run mcp:build:http
 * Lancer : npm run mcp:http           (PORT, défaut 3333 — endpoint /mcp)
 * Santé  : GET /healthz
 */
process.env.AURA_MCP_HTTP = "1";

import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const { createAuraServer } = await import("./server");

const PORT = Number(process.env.PORT ?? 3333);

const httpServer = createServer(async (req, res) => {
  // CORS permissif pour les connecteurs web ; à restreindre en production.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }

  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "aura-decision-mcp" }));
    return;
  }
  if (!req.url?.startsWith("/mcp")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Endpoint MCP : POST /mcp" }));
    return;
  }

  try {
    const server = createAuraServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: String(e) }, id: null }));
    }
  }
});

httpServer.listen(PORT, () => {
  console.error(`Aura Décision MCP server — prêt (HTTP, port ${PORT}, endpoint /mcp).`);
});
