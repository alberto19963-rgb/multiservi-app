const { supabase } = require("./supabase-client");
const { getDB } = require("./db/init");
const { 
  products, clients, ncfSequences, invoices, invoiceItems, 
  config, productFamilies, productVariants, productSkus, expenses,
  employees, shifts, timeLogs, invoicePayments
} = require("./db/schema");
const { eq, sql } = require("drizzle-orm");

function getCompanyCode() {
  const db = getDB();
  const compCode = db.select().from(config).where(eq(config.key, "company_code")).get();
  return compCode ? compCode.value : null;
}

// --- UTILIDADES DE NOTIFICACIÓN ---
function notifyRefresh(type = "all") {
  const { BrowserWindow } = require("electron");
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send("cloud:sync-refresh", type);
  });
}

// --- 1. PUSH LOGIC (DE PC A NUBE) ---

async function pushToCloud(tableName, data) {
  if (!supabase) {
    console.error(`[Sync] Supabase no está inicializado para ${tableName}`);
    return;
  }
  const companyCode = getCompanyCode();
  if (!companyCode) {
    console.error(`[Sync] Falta company_code, abortando subida de ${tableName}`);
    return;
  }

  console.log(`[Sync] Intentando subir ${tableName}:`, data.name || data.uuid || "unnamed");

  // MAPEO DE NOMBRES: Asegurar que el nombre local coincida con la tabla en Supabase
  const tableMapping = {
    'productFamilies': 'families',
    'productVariants': 'variants',
    'productSkus': 'skus',
    'ncfSequences': 'ncf_sequences',
    'invoice_items': 'invoice_items',
    'invoicePayments': 'payments',
    'timeLogs': 'time_logs',
    'employees': 'employees',
    'shifts': 'shifts',
    'trial_history': 'trial_history'
  };

  const targetName = tableMapping[tableName] || tableName;
  const cloudTable = `cloud_${targetName}`;

  try {
    // GENERACIÓN AUTOMÁTICA DE UUID
    if (!data.uuid) {
      if (data.name && tableName !== 'config') {
        const { data: existing } = await supabase
          .from(cloudTable)
          .select('uuid')
          .eq('company_code', companyCode)
          .eq('name', data.name)
          .maybeSingle();
        
        if (existing) {
          data.uuid = existing.uuid;
        }
      }

      if (!data.uuid) {
        const crypto = require("crypto");
        data.uuid = crypto.randomUUID();
      }

      const db = getDB();
      try {
        const tableMap = { 
          products, clients, expenses, invoices, 
          productFamilies, productVariants, productSkus,
          ncfSequences, config, employees, shifts,
          timeLogs, invoicePayments
        };
        const table = tableMap[tableName];
        if (table && data.id) {
          db.update(table).set({ uuid: data.uuid }).where(eq(table.id, data.id)).run();
        }
      } catch (e) { /* silent */ }
    }

    const { error } = await supabase.from(cloudTable).upsert({
      ...data,
      company_code: companyCode
    }, { onConflict: "uuid" });
    
    if (error) {
      console.error(`[Sync] Error en ${tableName}:`, error.message);
      throw error;
    }
    return data.uuid;
  } catch (err) { 
    console.error(`[Sync] Fallo Crítico en ${tableName}:`, err.message || err);
    return data.uuid;
  }
}

// Helpers específicos
async function pushProductToCloud(p) { 
  return await pushToCloud("products", { 
    name: p.name, type: p.type || 'FISICO', code: p.code || '', stock: p.stock || 0, 
    price: p.price || 0, cost: p.cost || 0, unit: p.unit || 'UD', min_stock: p.minStock || 0, uuid: p.uuid 
  }); 
}
async function pushClientToCloud(c) { await pushToCloud("clients", { name: c.name, rnc: c.rnc, type: c.type, address: c.address, phone: c.phone, email: c.email, notes: c.notes, uuid: c.uuid }); }
async function pushExpenseToCloud(e) { await pushToCloud("expenses", { description: e.description, amount: e.amount, category: e.category, date: e.date, uuid: e.uuid }); }
async function pushQuotationToCloud(q) { await pushToCloud("quotations", { date: q.date, client_name: q.clientName, total: q.total, status: q.status, uuid: q.uuid }); }
async function pushInvoiceToCloud(i) { await pushToCloud("invoices", { date: i.date, client_name: i.clientName, ncf: i.ncf, ncf_type: i.ncf_type, total: i.total, subtotal: i.subtotal, itbis: i.itbis, status: i.status, uuid: i.uuid }); }
async function pushInvoiceItemToCloud(ii) { await pushToCloud("invoice_items", { invoice_uuid: ii.invoiceUuid, product_name: ii.productName, quantity: ii.quantity, price: ii.price, tax: ii.tax, uuid: ii.uuid }); }
async function pushConfigToCloud(key, value) { await pushToCloud("config", { key: key, value: value, uuid: `${getCompanyCode()}-${key}` }); }
async function pushNCFSequenceToCloud(seq) { await pushToCloud("ncf_sequences", { type: seq.type, current_number: seq.current, max_limit: seq.limit, expiry_date: seq.expiry, uuid: seq.uuid }); }

// HR y Turnos
async function pushEmployeeToCloud(e) { await pushToCloud("employees", { name: e.name, pin: e.pin, nfc_code: e.nfcCode, job_title: e.jobTitle, salary: e.salary, active: e.active, uuid: e.uuid }); }
async function pushShiftToCloud(s) { await pushToCloud("shifts", { user_id_local: s.userId, start_time: s.startTime, end_time: s.endTime, status: s.status, base_amount: s.baseAmount, total_cash: s.totalCash, uuid: s.uuid }); }
async function pushPaymentToCloud(p) { await pushToCloud("invoicePayments", { invoice_uuid: p.invoiceUuid, shift_uuid: p.shiftUuid, method: p.method, amount: p.amount, uuid: p.uuid }); }
async function pushTimeLogToCloud(l) { 
  const db = getDB();
  const emp = db.select().from(employees).where(eq(employees.id, l.employeeId)).get();
  await pushToCloud("timeLogs", { employee_uuid: emp?.uuid, type: l.type, timestamp: l.timestamp, uuid: l.uuid }); 
}

// Inventario Avanzado
async function pushFamilyToCloud(f) { await pushToCloud("families", { name: f.name, icon: f.icon, uuid: f.uuid }); }
async function pushVariantToCloud(v) { 
  const db = getDB();
  const family = db.select().from(productFamilies).where(eq(productFamilies.id, v.familyId)).get();
  await pushToCloud("variants", { name: v.name, brand: v.brand, family_uuid: family?.uuid, uuid: v.uuid }); 
}
async function pushSkuToCloud(s) { 
  const db = getDB();
  const variant = db.select().from(productVariants).where(eq(productVariants.id, s.variantId)).get();
  await pushToCloud("skus", { name: s.name, barcode: s.barcode, price: s.price, cost: s.cost, stock: s.stock, unit: s.unit, variant_uuid: variant?.uuid, uuid: s.uuid }); 
}

// --- 2. PULL LOGIC (DE NUBE A PC) ---

async function fullSyncFromCloud() {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  console.log(`[Sync] Iniciando Sincronización TOTAL para: ${companyCode}`);
  const db = getDB();

  try {
    // 1. Configuración y NCF
    const { data: cloudCfg } = await supabase.from("cloud_config").select("*").eq("company_code", companyCode);
    if (cloudCfg) {
      for (const c of cloudCfg) {
        db.insert(config).values({ key: c.key, value: c.value }).onConflictDoUpdate({ target: config.key, set: { value: c.value } }).run();
      }
    }

    const { data: cloudNcf } = await supabase.from("cloud_ncf_sequences").select("*").eq("company_code", companyCode);
    if (cloudNcf) {
      for (const n of cloudNcf) {
        db.insert(ncfSequences).values({ type: n.type, current: n.current_number, limit: n.max_limit, expiry: n.expiry_date, uuid: n.uuid })
          .onConflictDoUpdate({ target: ncfSequences.uuid, set: { current: n.current_number, limit: n.max_limit } }).run();
      }
    }

    // 2. Inventario y Productos
    const { data: cloudF } = await supabase.from("cloud_families").select("*").eq("company_code", companyCode);
    if (cloudF) {
      for (const f of cloudF) {
        db.insert(productFamilies).values({ name: f.name, icon: f.icon, uuid: f.uuid })
          .onConflictDoUpdate({ target: productFamilies.uuid, set: { name: f.name, icon: f.icon } }).run();
      }
    }

    const { data: cloudV } = await supabase.from("cloud_variants").select("*").eq("company_code", companyCode);
    if (cloudV) {
      for (const v of cloudV) {
        const family = db.select().from(productFamilies).where(eq(productFamilies.uuid, v.family_uuid)).get();
        db.insert(productVariants).values({ name: v.name, brand: v.brand, familyId: family?.id, uuid: v.uuid })
          .onConflictDoUpdate({ target: productVariants.uuid, set: { name: v.name, brand: v.brand, familyId: family?.id } }).run();
      }
    }

    const { data: cloudS } = await supabase.from("cloud_skus").select("*").eq("company_code", companyCode);
    if (cloudS) {
      for (const s of cloudS) {
        const variant = db.select().from(productVariants).where(eq(productVariants.uuid, s.variant_uuid)).get();
        db.insert(productSkus).values({ name: s.name, barcode: s.barcode, price: s.price, stock: s.stock, cost: s.cost || 0, unit: s.unit || 'UND', variantId: variant?.id, uuid: s.uuid })
          .onConflictDoUpdate({ target: productSkus.uuid, set: { name: s.name, stock: s.stock, price: s.price, variantId: variant?.id } }).run();
      }
    }

    const { data: cloudProds } = await supabase.from("cloud_products").select("*").eq("company_code", companyCode);
    if (cloudProds) {
      for (const p of cloudProds) {
        db.insert(products).values({ name: p.name, type: p.type || 'FISICO', code: p.code, stock: p.stock, price: p.price, uuid: p.uuid })
          .onConflictDoUpdate({ target: products.uuid, set: { name: p.name, stock: p.stock, price: p.price } }).run();
      }
    }

    // 3. Personas y Gastos
    const { data: cloudClients } = await supabase.from("cloud_clients").select("*").eq("company_code", companyCode);
    if (cloudClients) {
      for (const c of cloudClients) {
        db.insert(clients).values({ name: c.name, rnc: c.rnc, address: c.address, phone: c.phone, email: c.email, uuid: c.uuid })
          .onConflictDoUpdate({ target: clients.uuid, set: { name: c.name, rnc: c.rnc, address: c.address, phone: c.phone, email: c.email } }).run();
      }
    }

    const { data: cloudEmployees } = await supabase.from("cloud_employees").select("*").eq("company_code", companyCode);
    if (cloudEmployees) {
      for (const e of cloudEmployees) {
        db.insert(employees).values({ name: e.name, pin: e.pin, nfcCode: e.nfc_code, jobTitle: e.job_title, salary: e.salary, active: e.active, uuid: e.uuid })
          .onConflictDoUpdate({ target: employees.uuid, set: { name: e.name, pin: e.pin, nfcCode: e.nfc_code, active: e.active } }).run();
      }
    }

    const { data: cloudExps } = await supabase.from("cloud_expenses").select("*").eq("company_code", companyCode);
    if (cloudExps) {
      for (const e of cloudExps) {
        db.insert(expenses).values({ description: e.description, amount: e.amount, category: e.category, date: e.date, uuid: e.uuid })
          .onConflictDoUpdate({ target: expenses.uuid, set: { amount: e.amount, description: e.description } }).run();
      }
    }

    // 4. Ventas y Turnos
    const { data: cloudShifts } = await supabase.from("cloud_shifts").select("*").eq("company_code", companyCode);
    if (cloudShifts) {
      for (const s of cloudShifts) {
        db.insert(shifts).values({ startTime: s.start_time, endTime: s.end_time, status: s.status, baseAmount: s.base_amount, uuid: s.uuid })
          .onConflictDoUpdate({ target: shifts.uuid, set: { status: s.status, endTime: s.end_time } }).run();
      }
    }

    const { data: cloudQuotes } = await supabase.from("cloud_quotations").select("*").eq("company_code", companyCode);
    if (cloudQuotes) {
      for (const q of cloudQuotes) {
        db.insert(invoices).values({ date: q.date, clientName: q.client_name, total: q.total || 0, status: q.status || 'QUOTE', uuid: q.uuid })
          .onConflictDoUpdate({ target: invoices.uuid, set: { status: q.status || 'QUOTE', total: q.total || 0 } }).run();
      }
    }

    const { data: cloudInvs } = await supabase.from("cloud_invoices").select("*").eq("company_code", companyCode);
    if (cloudInvs) {
      for (const i of cloudInvs) {
        db.insert(invoices).values({ date: i.date, clientName: i.client_name, ncf: i.ncf, ncfType: i.ncf_type, total: i.total, subtotal: i.subtotal, itbis: i.itbis, status: i.status, uuid: i.uuid })
          .onConflictDoUpdate({ target: invoices.uuid, set: { status: i.status, total: i.total } }).run();
      }
    }

    // 5. Items y Pagos (Relaciones complejas)
    const { data: cloudItems } = await supabase.from("cloud_invoice_items").select("*").eq("company_code", companyCode);
    if (cloudItems) {
      for (const item of cloudItems) {
        const inv = db.select().from(invoices).where(eq(invoices.uuid, item.invoice_uuid)).get();
        if (inv) {
          db.insert(invoiceItems).values({ invoiceId: inv.id, productName: item.product_name, quantity: item.quantity, price: item.price, tax: item.tax, uuid: item.uuid })
            .onConflictDoUpdate({ target: invoiceItems.uuid, set: { quantity: item.quantity, price: item.price } }).run();
        }
      }
    }

    const { data: cloudPayments } = await supabase.from("cloud_payments").select("*").eq("company_code", companyCode);
    if (cloudPayments) {
      for (const p of cloudPayments) {
        const inv = db.select().from(invoices).where(eq(invoices.uuid, p.invoice_uuid)).get();
        const sh = db.select().from(shifts).where(eq(shifts.uuid, p.shift_uuid)).get();
        if (inv) {
          db.insert(invoicePayments).values({ invoiceId: inv.id, shiftId: sh?.id, method: p.method, amount: p.amount, uuid: p.uuid })
            .onConflictDoUpdate({ target: invoicePayments.uuid, set: { amount: p.amount, method: p.method } }).run();
        }
      }
    }

    const { data: cloudTime } = await supabase.from("cloud_time_logs").select("*").eq("company_code", companyCode);
    if (cloudTime) {
      for (const l of cloudTime) {
        const emp = db.select().from(employees).where(eq(employees.uuid, l.employee_uuid)).get();
        if (emp) {
          db.insert(timeLogs).values({ employeeId: emp.id, type: l.type, timestamp: l.timestamp, uuid: l.uuid })
            .onConflictDoUpdate({ target: timeLogs.uuid, set: { type: l.type, timestamp: l.timestamp } }).run();
        }
      }
    }

    notifyRefresh();
    console.log("[Sync] Sincronización TOTAL completada.");
    return { success: true };
  } catch (err) { 
    console.error("[Sync] Full Pull Error:", err); 
    return { success: false, msg: err.message };
  }
}

// --- 3. REALTIME LISTENERS ---

function startCloudSyncListener() {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  const db = getDB();
  const syncTables = [
    "products", "clients", "expenses", "quotations", "invoices", 
    "ncf_sequences", "config", "families", "variants", "skus",
    "employees", "shifts", "payments", "time_logs", "invoice_items"
  ];
  
  syncTables.forEach(table => {
    supabase.channel(`${table}-channel`).on('postgres_changes', { event: '*', schema: 'public', table: `cloud_${table}` }, (payload) => {
      if (!payload.new || payload.new.company_code !== companyCode) return;
      const item = payload.new;
      
      try {
        if (table === "products") {
          db.insert(products).values({ name: item.name, type: item.type, code: item.code, stock: item.stock, price: item.price, uuid: item.uuid })
            .onConflictDoUpdate({ target: products.uuid, set: { name: item.name, stock: item.stock, price: item.price } }).run();
        } else if (table === "employees") {
          db.insert(employees).values({ name: item.name, pin: item.pin, active: item.active, uuid: item.uuid })
            .onConflictDoUpdate({ target: employees.uuid, set: { name: item.name, pin: item.pin, active: item.active } }).run();
        } else if (table === "families") {
          db.insert(productFamilies).values({ name: item.name, icon: item.icon, uuid: item.uuid })
            .onConflictDoUpdate({ target: productFamilies.uuid, set: { name: item.name, icon: item.icon } }).run();
        } else if (table === "clients") {
          db.insert(clients).values({ name: item.name, rnc: item.rnc, uuid: item.uuid })
            .onConflictDoUpdate({ target: clients.uuid, set: { name: item.name, rnc: item.rnc } }).run();
        } else if (table === "skus") {
          const v = db.select().from(productVariants).where(eq(productVariants.uuid, item.variant_uuid)).get();
          db.insert(productSkus).values({ name: item.name, barcode: item.barcode, price: item.price, stock: item.stock, variantId: v?.id, uuid: item.uuid })
            .onConflictDoUpdate({ target: productSkus.uuid, set: { name: item.name, stock: item.stock, price: item.price } }).run();
        }
      } catch (e) {
        console.error(`[Sync Realtime] Error actualizando base local (${table}):`, e);
      }
      notifyRefresh(table);
    }).subscribe();
  });
}

// --- 4. MASIVE PUSH (SUBIR TODO) ---
async function pushAllDataToCloud() {
  if (!supabase) return { success: false, msg: "Sin conexión a la nube" };
  const companyCode = getCompanyCode();
  if (!companyCode) return { success: false, msg: "Falta el Código de Compañía" };

  const db = getDB();
  let pushedCount = 0;
  
  try {
    const configData = db.select().from(config).all();
    for (const c of configData) { await pushConfigToCloud(c.key, c.value); pushedCount++; }

    const ncfData = db.select().from(ncfSequences).all();
    for (const n of ncfData) { await pushNCFSequenceToCloud(n); pushedCount++; }

    const familyData = db.select().from(productFamilies).all();
    for (const f of familyData) { await pushFamilyToCloud(f); pushedCount++; }

    const variantData = db.select().from(productVariants).all();
    for (const v of variantData) { await pushVariantToCloud(v); pushedCount++; }

    const skuData = db.select().from(productSkus).all();
    for (const s of skuData) { await pushSkuToCloud(s); pushedCount++; }

    const clientData = db.select().from(clients).all();
    for (const c of clientData) { await pushClientToCloud(c); pushedCount++; }

    const empData = db.select().from(employees).all();
    for (const e of empData) { await pushEmployeeToCloud(e); pushedCount++; }

    const expenseData = db.select().from(expenses).all();
    for (const e of expenseData) { await pushExpenseToCloud(e); pushedCount++; }

    const shiftData = db.select().from(shifts).all();
    for (const s of shiftData) { await pushShiftToCloud(s); pushedCount++; }

    const invoiceData = db.select().from(invoices).all();
    for (const i of invoiceData) {
      if (i.status === "QUOTE") await pushQuotationToCloud(i);
      else await pushInvoiceToCloud(i);
      pushedCount++;
      
      const items = db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, i.id)).all();
      for (const ii of items) await pushInvoiceItemToCloud({ ...ii, invoiceUuid: i.uuid });

      const pms = db.select().from(invoicePayments).where(eq(invoicePayments.invoiceId, i.id)).all();
      for (const p of pms) {
        const sh = db.select().from(shifts).where(eq(shifts.id, p.shiftId)).get();
        await pushPaymentToCloud({ ...p, invoiceUuid: i.uuid, shiftUuid: sh?.uuid });
      }
    }

    const timeLogData = db.select().from(timeLogs).all();
    for (const l of timeLogData) { await pushTimeLogToCloud(l); pushedCount++; }

    return { success: true, count: pushedCount };
  } catch (err) {
    console.error("[Sync] Massive Push Error:", err);
    return { success: false, msg: err.message };
  }
}

module.exports = { 
  startCloudSyncListener, fullSyncFromCloud, pushAllDataToCloud,
  pushInvoiceToCloud, pushQuotationToCloud, pushConfigToCloud,
  pushNCFSequenceToCloud, pushClientToCloud, pushExpenseToCloud, pushFamilyToCloud,
  pushVariantToCloud, pushSkuToCloud, pushEmployeeToCloud, pushShiftToCloud,
  pushPaymentToCloud, pushTimeLogToCloud, pushInvoiceItemToCloud
};
