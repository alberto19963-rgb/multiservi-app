const { app } = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const { drizzle } = require("drizzle-orm/better-sqlite3");
const { migrate } = require("drizzle-orm/better-sqlite3/migrator");
const fs = require("fs");
const schema = require("./schema");

let db;
let sqlite;

function isDev() {
  // Check if we are in Electron main process
  return !app.isPackaged;
}

function initDB() {
  const dbPath = isDev()
    ? path.join(__dirname, "../../local.db")
    : path.join(app.getPath("userData"), "multiservi.db");

  console.log("Initializing DB at:", dbPath);

  sqlite = new Database(dbPath);
  db = drizzle(sqlite, { schema });

  // Auto-create tables (Simple migration for now)
  // In production, use real migrations. For MVP, we can run raw SQL or use push.
  // Since we are mocking, let's just create tables if not exist via raw SQL for simplicity in this step,
  // or use drizzle-kit push in dev.
  // For this environment, let's execute Raw SQL to ensure tables exist without external migration files.

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      code TEXT UNIQUE,
      stock REAL DEFAULT 0,
      unit TEXT DEFAULT 'UNI',
      price REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      min_stock REAL DEFAULT 10
    );
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rnc TEXT UNIQUE,
      type TEXT DEFAULT 'FINAL',
      address TEXT,
      phone TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS ncf_sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL UNIQUE,
      current INTEGER DEFAULT 0,
      "limit" INTEGER DEFAULT 0,
      expiry TEXT
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      client_id INTEGER REFERENCES clients(id),
      client_name TEXT,
      client_rnc TEXT,
      ncf_type TEXT,
      ncf TEXT UNIQUE,
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      itbis REAL DEFAULT 0,
      total REAL DEFAULT 0,
      items_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'PAID'
    );
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER REFERENCES invoices(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      total REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'CASHIER',
      name TEXT
    );
    -- Ensure Admin exists
    INSERT OR IGNORE INTO users (username, password, role, name) 
    VALUES ('admin', 'admin', 'ADMIN', 'Administrador');
    
    -- Force password update to 'admin' (User request)
    UPDATE users SET password = 'admin' WHERE username = 'admin';

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT DEFAULT 'GENERAL',
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS cash_closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      system_total REAL DEFAULT 0,
      real_total REAL DEFAULT 0,
      difference REAL DEFAULT 0,
      notes TEXT
    );

    -- --- Time Clock ---
    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        pin TEXT UNIQUE,
        nfc_code TEXT,
        job_title TEXT,
        salary REAL DEFAULT 0,
        bank_account TEXT,
        work_mode TEXT DEFAULT 'STANDARD',
        role TEXT DEFAULT 'EMPLEADO',
        active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS time_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        type TEXT NOT NULL,
        timestamp TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        cedula TEXT,
        phone TEXT,
        email TEXT,
        position_applied TEXT,
        status TEXT DEFAULT 'APPLIED',
        salary_offer REAL,
        interview_notes TEXT,
        form_data TEXT,
        resume_path TEXT,
        folder_path TEXT, 
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dgii_rncs (
        rnc TEXT PRIMARY KEY,
        name TEXT NOT NULL
    );

    -- =============================================
    --  SISTEMA DE VARIANTES E INVENTARIO AVANZADO
    -- =============================================

    -- Nivel 1: Familias / Categorías (Agua, Cloro, Desinfectante...)
    CREATE TABLE IF NOT EXISTS product_families (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        icon       TEXT DEFAULT '📦',
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        uuid       TEXT UNIQUE,
        node_id    TEXT,
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        deleted    INTEGER DEFAULT 0
    );

    -- Nivel 2: Variantes / Productos dentro de una familia (Agua Cristal, Clorox...)
    CREATE TABLE IF NOT EXISTS product_variants (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id   INTEGER REFERENCES product_families(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        brand       TEXT,
        description TEXT,
        active      INTEGER DEFAULT 1,
        created_at  TEXT DEFAULT (datetime('now', 'localtime')),
        uuid       TEXT UNIQUE,
        node_id    TEXT,
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        deleted    INTEGER DEFAULT 0
    );

    -- Nivel 3: Presentaciones / SKUs (Unidad 500ml, Fardo x24, Galón...)
    CREATE TABLE IF NOT EXISTS product_skus (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        variant_id   INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        barcode      TEXT UNIQUE,
        price        REAL DEFAULT 0,
        cost         REAL DEFAULT 0,
        stock        REAL DEFAULT 0,
        min_stock    REAL DEFAULT 5,
        unit         TEXT DEFAULT 'UNI',
        qty_per_pack REAL DEFAULT 1,
        active       INTEGER DEFAULT 1,
        created_at   TEXT DEFAULT (datetime('now', 'localtime')),
        uuid       TEXT UNIQUE,
        node_id    TEXT,
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        deleted    INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        start_time TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        end_time TEXT,
        status TEXT DEFAULT 'OPEN',
        base_amount REAL DEFAULT 0,
        total_cash REAL DEFAULT 0,
        total_card REAL DEFAULT 0,
        total_transfer REAL DEFAULT 0,
        total_check REAL DEFAULT 0,
        real_cash REAL DEFAULT 0,
        real_card REAL DEFAULT 0,
        notes TEXT,
        uuid       TEXT UNIQUE,
        node_id    TEXT,
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        deleted    INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoice_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER REFERENCES invoices(id),
        shift_id INTEGER REFERENCES shifts(id),
        method TEXT NOT NULL,
        amount REAL NOT NULL,
        received REAL,
        "change" REAL,
        date TEXT DEFAULT (datetime('now', 'localtime')),
        uuid       TEXT UNIQUE,
        node_id    TEXT,
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        deleted    INTEGER DEFAULT 0
    );
  `);

  // --- SYNC MIGRATION: Add columns if not exist ---
  const tables = [
    "products",
    "clients",
    "ncf_sequences",
    "invoices",
    "invoice_items",
    "users",
    "expenses",
    "cash_closings",
    "employees",
    "time_logs",
    "candidates",
    "shifts",
    "invoice_payments",
    "product_families",
    "product_variants",
    "product_skus"
  ];
  const columns = [
    "ADD COLUMN uuid TEXT",
    "ADD COLUMN node_id TEXT",
    "ADD COLUMN updated_at TEXT",
    "ADD COLUMN deleted INTEGER DEFAULT 0",
    "ADD COLUMN product_name TEXT",
  ];

  try {
    // Sync Columns Migration
    for (const table of tables) {
      for (const col of columns) {
        try {
          sqlite.exec(`ALTER TABLE ${table} ${col}`);
          console.log(`Migrated ${table}: ${col}`);
        } catch (e) {
          if (!e.message.includes("duplicate column name")) {
            console.error(`Migration error for ${table} ${col}:`, e);
          }
        }
      }
    }

    // HR Module Migration (New Columns)
    const hrColumns = [
      "ADD COLUMN nfc_code TEXT",
      "ADD COLUMN job_title TEXT",
      "ADD COLUMN salary REAL DEFAULT 0",
      "ADD COLUMN bank_account TEXT",
      "ADD COLUMN work_mode TEXT DEFAULT 'STANDARD'",
      // RD Specifics
      "ADD COLUMN cedula TEXT",
      "ADD COLUMN phone TEXT",
      "ADD COLUMN email TEXT",
      "ADD COLUMN address TEXT",
      "ADD COLUMN start_date TEXT",
      "ADD COLUMN emergency_contact TEXT",
      "ADD COLUMN blood_type TEXT",
      "ADD COLUMN department TEXT",
    ];

    for (const col of hrColumns) {
      try {
        sqlite.exec(`ALTER TABLE employees ${col}`);
      } catch (e) {
        if (!e.message.includes("duplicate column name")) {
          // console.error(`HR Migration error for employees ${col}:`, e);
        }
      }
    }

    // Candidates Migration (Fixing resume_path -> cv_path and added missing cols)
    const candidateColumns = [
      "ADD COLUMN cv_path TEXT",
      "ADD COLUMN application_data TEXT",
      "ADD COLUMN meeting_date TEXT",
    ];
    for (const col of candidateColumns) {
      try {
        sqlite.exec(`ALTER TABLE candidates ${col}`);
      } catch (e) {
        // ignore
      }
    }

    console.log("Database initialized successfully");
  } catch (e) {
    console.error("Migration transaction failed:", e);
  }

  return db;
}

function getDB() {
  if (!db) initDB();
  return db;
}

function getSQLite() {
  if (!sqlite) initDB();
  return sqlite;
}

module.exports = { initDB, getDB, getSQLite, isDev };
