const { sqliteTable, text, integer, real } = require("drizzle-orm/sqlite-core");
const { sql } = require("drizzle-orm");

// --- SYNC HELPER ---
const syncColumns = {
  uuid: text("uuid").unique(),
  nodeId: text("node_id"),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
  deleted: integer("deleted").default(0),
};

const products = sqliteTable("products", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  code: text("code"),
  stock: real("stock").default(0),
  unit: text("unit").default("UNI"),
  price: real("price").default(0),
  cost: real("cost").default(0),
  minStock: real("min_stock").default(10),
  ...syncColumns,
});

const clients = sqliteTable("clients", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  rnc: text("rnc"),
  type: text("type").default("FINAL"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  ...syncColumns,
});

const ncfSequences = sqliteTable("ncf_sequences", {
  id: integer("id").primaryKey(),
  type: text("type").notNull().unique(),
  current: integer("current").default(0),
  limit: integer("limit").default(0),
  expiry: text("expiry"),
  ...syncColumns,
});

const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey(),
  date: text("date").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  clientId: integer("client_id"),
  clientName: text("client_name"), // De-normalized for simplicity
  clientRnc: text("client_rnc"),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  ncfType: text("ncf_type"),
  ncf: text("ncf").unique(),
  subtotal: real("subtotal").default(0),
  itbis: real("itbis").default(0),
  total: real("total").default(0),
  itemsCount: integer("items_count"),
  status: text("status").default("PAID"),
  ...syncColumns,
});

const invoiceItems = sqliteTable("invoice_items", {
  id: integer("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  productId: integer("product_id"),
  productName: text("product_name"),
  quantity: real("quantity").notNull(),
  price: real("price").notNull(),
  tax: real("total").notNull(),
  ...syncColumns,
});

const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  role: text("role").default("CASHIER"),
  name: text("name"),
  ...syncColumns,
});

const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  category: text("category").default("GENERAL"),
  date: text("date").default("sql`(CURRENT_TIMESTAMP)`"),
  userId: integer("user_id"),
  ...syncColumns,
});

const cashClosings = sqliteTable("cash_closings", {
  id: integer("id").primaryKey(),
  date: text("date").default("sql`(CURRENT_TIMESTAMP)`"),
  userId: integer("user_id"),
  systemTotal: real("system_total").default(0),
  realTotal: real("real_total").default(0),
  difference: real("difference").default(0),
  notes: text("notes"),
  ...syncColumns,
});

const employees = sqliteTable("employees", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  pin: text("pin").unique(), // PIN can be null if using NFC only, but let's keep it
  nfcCode: text("nfc_code"), // The Card UID
  cedula: text("cedula").unique(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  startDate: text("start_date"), // YYYY-MM-DD
  emergencyContact: text("emergency_contact"),
  bloodType: text("blood_type"),
  department: text("department"),
  jobTitle: text("job_title"),
  salary: real("salary").default(0), // Monthly Fixed Salary
  bankAccount: text("bank_account"),
  workMode: text("work_mode").default("STANDARD"), // STANDARD | FIELD
  role: text("role").default("EMPLEADO"),
  active: integer("active").default(1),
  ...syncColumns,
});

const candidates = sqliteTable("candidates", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  cedula: text("cedula"),
  phone: text("phone"),
  email: text("email"),
  positionApplied: text("position_applied"),
  status: text("status").default("APPLIED"), // APPLIED, INTERVIEW, OFFER, HIRED, REJECTED
  salaryOffer: real("salary_offer"),
  interviewNotes: text("interview_notes"),
  formData: text("form_data"), // JSON string of the "30 questions"
  resumePath: text("resume_path"),
  folderPath: text("folder_path"), // Path to their local folder
  createdAt: text("created_at").default("sql`(CURRENT_TIMESTAMP)`"),
  ...syncColumns,
});

const timeLogs = sqliteTable("time_logs", {
  id: integer("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id),
  type: text("type").notNull(), // 'IN' or 'OUT'
  timestamp: text("timestamp").default("sql`(CURRENT_TIMESTAMP)`"),
  ...syncColumns,
});

const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

const shifts = sqliteTable("shifts", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  startTime: text("start_time").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  endTime: text("end_time"),
  status: text("status").default("OPEN"), // OPEN, CLOSED
  baseAmount: real("base_amount").default(0),
  totalCash: real("total_cash").default(0),
  totalCard: real("total_card").default(0),
  totalTransfer: real("total_transfer").default(0),
  totalCheck: real("total_check").default(0),
  realCash: real("real_cash").default(0),
  realCard: real("real_card").default(0),
  notes: text("notes"),
  ...syncColumns,
});

const invoicePayments = sqliteTable("invoice_payments", {
  id: integer("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  shiftId: integer("shift_id").references(() => shifts.id),
  method: text("method").notNull(), // CASH, CARD, CHECK, TRANSFER
  amount: real("amount").notNull(),
  received: real("received"), // For cash, to calc change
  change: real("change"), 
  date: text("date").default("sql`(CURRENT_TIMESTAMP)`"),
  ...syncColumns,
});
const dgiiRncs = sqliteTable("dgii_rncs", {
  rnc: text("rnc").primaryKey(),
  name: text("name").notNull(),
});

const productFamilies = sqliteTable("product_families", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").default("📦"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  ...syncColumns,
});

const productVariants = sqliteTable("product_variants", {
  id: integer("id").primaryKey(),
  familyId: integer("family_id").references(() => productFamilies.id),
  name: text("name").notNull(),
  brand: text("brand"),
  description: text("description"),
  active: integer("active").default(1),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  ...syncColumns,
});

const productSkus = sqliteTable("product_skus", {
  id: integer("id").primaryKey(),
  variantId: integer("variant_id").references(() => productVariants.id),
  name: text("name").notNull(),
  barcode: text("barcode").unique(),
  price: real("price").default(0),
  cost: real("cost").default(0),
  stock: real("stock").default(0),
  minStock: real("min_stock").default(5),
  unit: text("unit").default("UNI"),
  qtyPerPack: real("qty_per_pack").default(1),
  active: integer("active").default(1),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  ...syncColumns,
});

module.exports = {
  products,
  clients,
  ncfSequences,
  invoices,
  invoiceItems,
  invoicePayments,
  users,
  expenses,
  cashClosings,
  shifts,
  employees,
  timeLogs,
  candidates,
  config,
  dgiiRncs,
  productFamilies,
  productVariants,
  productSkus,
};
