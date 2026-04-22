const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "local.db");
console.log("Opening DB at:", dbPath);
const sqlite = new Database(dbPath);

try {
  // 1. Create table if not exists (just to be sure)
  sqlite.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

  const key = "test_key";
  const value1 = "initial_value";
  const value2 = "updated_value";

  // 2. Clear previous test
  sqlite.prepare("DELETE FROM config WHERE key = ?").run(key);

  // 3. Insert
  console.log("Testing Insert...");
  const existing = sqlite
    .prepare("SELECT * FROM config WHERE key = ?")
    .get(key);
  if (existing) {
    sqlite
      .prepare("UPDATE config SET value = ? WHERE key = ?")
      .run(value1, key);
  } else {
    sqlite
      .prepare("INSERT INTO config (key, value) VALUES (?, ?)")
      .run(key, value1);
  }

  // 4. Verify Insert
  const row1 = sqlite.prepare("SELECT * FROM config WHERE key = ?").get(key);
  console.log("Read after Insert:", row1);
  if (row1.value !== value1) throw new Error("Insert failed");

  // 5. Update
  console.log("Testing Update...");
  const existing2 = sqlite
    .prepare("SELECT * FROM config WHERE key = ?")
    .get(key);
  if (existing2) {
    sqlite
      .prepare("UPDATE config SET value = ? WHERE key = ?")
      .run(value2, key);
  } else {
    sqlite
      .prepare("INSERT INTO config (key, value) VALUES (?, ?)")
      .run(key, value2);
  }

  // 6. Verify Update
  const row2 = sqlite.prepare("SELECT * FROM config WHERE key = ?").get(key);
  console.log("Read after Update:", row2);
  if (row2.value !== value2) throw new Error("Update failed");

  console.log("SUCCESS: Database persistence is working correctly.");
} catch (e) {
  console.error("FAILURE:", e);
}
