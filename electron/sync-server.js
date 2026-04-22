const express = require("express");
const cors = require("cors");
const { app } = require("electron");
const { getDB } = require("./db/init");
const {
  invoices,
  products,
  clients,
  users,
  expenses,
  cashClosings,
  employees,
  timeLogs,
  invoiceItems,
  ncfSequences,
} = require("./db/schema");
const { eq, gt, or, and, isNull } = require("drizzle-orm");
const { sql } = require("drizzle-orm");

let server;
let nodeId = null; // Will be set from settings

const tablesMap = {
  products,
  clients,
  invoices,
  invoice_items: invoiceItems,
  users,
  expenses,
  cash_closings: cashClosings,
  employees,
  time_logs: timeLogs,
  ncf_sequences: ncfSequences,
};

function startSyncServer(port = 4000, myNodeId) {
  if (server) return; // Already running
  nodeId = myNodeId;

  const api = express();
  api.use(cors());
  api.use(express.json());

  // --- PULL ENDPOINT: Peer asks for data changed since X ---
  api.get("/api/v1/sync/pull", async (req, res) => {
    const { since } = req.query; // Timestamp string
    const db = getDB();
    const changes = {};

    try {
      for (const [tableName, tableObj] of Object.entries(tablesMap)) {
        let query = db.select().from(tableObj);

        if (since) {
          query = query.where(gt(tableObj.updatedAt, since));
        }

        const data = query.all();
        if (data.length > 0) {
          changes[tableName] = data;
        }
      }
      res.json({ success: true, nodeId: nodeId, changes });
    } catch (e) {
      console.error("Sync Pull Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- PUSH ENDPOINT: Peer sends data (less common in simple mesh, usually pull-only is safer, but push useful for instant notify) ---
  // For this MVP, we will rely on PULL. We can implement a "notify" endpoint later.

  // --- HELLO ENDPOINT ---
  api.get("/api/v1/hello", (req, res) => {
    res.json({ nodeId: nodeId, status: "online" });
  });

  server = api.listen(port, "0.0.0.0", () => {
    console.log(`Sync Server running on port ${port} with Node ID: ${nodeId}`);
  });
}

function stopSyncServer() {
  if (server) {
    server.close();
    server = null;
  }
}

module.exports = { startSyncServer, stopSyncServer };
