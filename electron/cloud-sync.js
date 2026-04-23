const { supabase } = require("./supabase-client");
const { getDB } = require("./db/init");
const { 
  products, clients, ncfSequences, invoices, invoiceItems, 
  config, productFamilies, productVariants, productSkus 
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

async function pushProductToCloud(localProduct) {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  try {
    await supabase.from("cloud_products").upsert({
      company_code: companyCode,
      local_id: localProduct.id,
      name: localProduct.name,
      type: localProduct.type,
      code: localProduct.code,
      stock: localProduct.stock,
      price: localProduct.price,
      cost: localProduct.cost,
      min_stock: localProduct.minStock,
      uuid: localProduct.uuid
    }, { onConflict: "company_code, local_id" });
  } catch (err) { console.error("[Sync] Push Product Error:", err); }
}

async function pushInvoiceToCloud(invoice, items = []) {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  try {
    // A. Subir Cabecera
    const { data: cloudInv, error } = await supabase.from("cloud_invoices").upsert({
      company_code: companyCode,
      local_id: invoice.id,
      date: invoice.date,
      client_name: invoice.clientName,
      client_rnc: invoice.clientRnc,
      client_email: invoice.clientEmail,
      client_phone: invoice.clientPhone,
      ncf_type: invoice.ncfType,
      ncf: invoice.ncf,
      subtotal: invoice.subtotal,
      tax: invoice.itbis,
      total: invoice.total,
      status: invoice.status,
      uuid: invoice.uuid
    }, { onConflict: "company_code, local_id" }).select().single();

    if (error) throw error;

    // B. Subir Items
    if (items.length > 0) {
      const itemsToPush = items.map(item => ({
        company_code: companyCode,
        invoice_id: cloudInv.id, // ID de la nube
        product_name: item.productName,
        quantity: item.quantity,
        price: item.price,
        tax: item.tax,
        uuid: item.uuid
      }));
      await supabase.from("cloud_invoice_items").upsert(itemsToPush, { onConflict: "uuid" });
    }
  } catch (err) { console.error("[Sync] Push Invoice Error:", err); }
}

async function pushConfigToCloud(key, value) {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  try {
    await supabase.from("cloud_config").upsert({
      company_code: companyCode,
      key: key,
      value: value
    }, { onConflict: "company_code, key" });
  } catch (err) { console.error("[Sync] Push Config Error:", err); }
}

async function pushNCFSequenceToCloud(seq) {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  try {
    await supabase.from("cloud_ncf_sequences").upsert({
      company_code: companyCode,
      type: seq.type,
      current_number: seq.current,
      max_limit: seq.limit,
      expiry_date: seq.expiry,
      uuid: seq.uuid
    }, { onConflict: "company_code, type" });
  } catch (err) { console.error("[Sync] Push NCF Error:", err); }
}

// --- 2. PULL LOGIC (DE NUBE A PC) ---

async function fullSyncFromCloud() {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  console.log(`[Sync] Iniciando descarga masiva para compañía: ${companyCode}`);
  const db = getDB();

  try {
    // A. Configuración (Logo, Colores)
    const { data: configs } = await supabase.from("cloud_config").select("*").eq("company_code", companyCode);
    if (configs) {
      for (const c of configs) {
        db.insert(config).values({ key: c.key, value: c.value }).onConflictDoUpdate({
          target: config.key,
          set: { value: c.value }
        }).run();
      }
    }

    // B. Secuencias NCF
    const { data: ncfData } = await supabase.from("cloud_ncf_sequences").select("*").eq("company_code", companyCode);
    if (ncfData) {
      for (const s of ncfData) {
        db.insert(ncfSequences).values({
          type: s.type,
          current: s.current_number,
          limit: s.max_limit,
          expiry: s.expiry_date,
          uuid: s.id
        }).onConflictDoUpdate({
          target: ncfSequences.type,
          set: { current: s.current_number, limit: s.max_limit }
        }).run();
      }
    }

    // C. Productos
    const { data: cloudProds } = await supabase.from("cloud_products").select("*").eq("company_code", companyCode);
    if (cloudProds) {
      for (const p of cloudProds) {
        db.insert(products).values({
          name: p.name,
          type: p.type || 'FISICO',
          code: p.code,
          stock: p.stock,
          price: p.price,
          cost: p.cost,
          minStock: p.min_stock,
          uuid: p.uuid
        }).onConflictDoUpdate({
          target: products.uuid,
          set: { name: p.name, stock: p.stock, price: p.price, cost: p.cost }
        }).run();
      }
    }

    // D. Facturas (Solo las últimas 100 para no saturar)
    const { data: cloudInvs } = await supabase.from("cloud_invoices").select("*").eq("company_code", companyCode).order('date', { ascending: false }).limit(100);
    if (cloudInvs) {
      for (const i of cloudInvs) {
        db.insert(invoices).values({
          date: i.date,
          clientName: i.client_name,
          clientRnc: i.client_rnc,
          ncf: i.ncf,
          ncfType: i.ncf_type,
          total: i.total,
          status: i.status,
          uuid: i.uuid
        }).onConflictDoIgnore().run();
      }
    }

    notifyRefresh();
    console.log("[Sync] Descarga inicial completada.");
  } catch (err) { console.error("[Sync] Full Pull Error:", err); }
}

// --- 3. REALTIME LISTENERS (ESCUCHA ACTIVA) ---

function startCloudSyncListener() {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  const db = getDB();

  // A. Escuchar cambios en Config (Logo/Colores)
  supabase.channel('config-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'cloud_config' }, (payload) => {
    if (payload.new.company_code !== companyCode) return;
    db.insert(config).values({ key: payload.new.key, value: payload.new.value }).onConflictDoUpdate({
      target: config.key,
      set: { value: payload.new.value }
    }).run();
    notifyRefresh("config");
  }).subscribe();

  // B. Escuchar cambios en NCF
  supabase.channel('ncf-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'cloud_ncf_sequences' }, (payload) => {
    if (!payload.new || payload.new.company_code !== companyCode) return;
    db.insert(ncfSequences).values({
      type: payload.new.type,
      current: payload.new.current_number,
      limit: payload.new.max_limit,
      uuid: payload.new.id
    }).onConflictDoUpdate({
      target: ncfSequences.uuid, // Usamos UUID como ancla más segura
      set: { current: payload.new.current_number, limit: payload.new.max_limit }
    }).run();
    notifyRefresh("ncf");
  }).subscribe();

  // C. Escuchar Productos
  supabase.channel('products-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'cloud_products' }, (payload) => {
    if (!payload.new || payload.new.company_code !== companyCode) return;
    db.insert(products).values({
      name: payload.new.name,
      type: payload.new.type || 'FISICO', // Fix: Agregamos el tipo para cumplir el NOT NULL
      price: payload.new.price,
      stock: payload.new.stock,
      uuid: payload.new.uuid
    }).onConflictDoUpdate({
      target: products.uuid, // Usamos UUID como ancla universal
      set: { 
        name: payload.new.name, 
        price: payload.new.price, 
        stock: payload.new.stock 
      }
    }).run();
    notifyRefresh("products");
  }).subscribe();
}

// --- 4. MASIVE SYNC (SUBIR TODO LO QUE TENGO) ---
async function pushAllDataToCloud() {
  if (!supabase) return { success: false, msg: "Sin conexión a la nube" };
  const companyCode = getCompanyCode();
  if (!companyCode) return { success: false, msg: "Falta el Código de Compañía" };

  console.log(`[Sync] Iniciando subida masiva para: ${companyCode}`);
  const db = getDB();
  let pushedCount = 0;
  let errors = [];
  
  try {
    // A. Subir Productos
    const allProds = db.select().from(products).all();
    for (const p of allProds) {
      const { error } = await supabase.from("cloud_products").upsert({
        company_code: companyCode,
        local_id: p.id,
        name: p.name,
        type: p.type,
        code: p.code,
        stock: p.stock,
        price: p.price,
        cost: p.cost,
        min_stock: p.minStock,
        uuid: p.uuid
      }, { onConflict: "company_code, local_id" });
      if (error) errors.push(`Producto ${p.name}: ${error.message}`);
      else pushedCount++;
    }

    // B. Subir Clientes
    const allClients = db.select().from(clients).all();
    for (const c of allClients) {
      const { error } = await supabase.from("cloud_clients").upsert({
        company_code: companyCode,
        local_id: c.id,
        name: c.name,
        rnc: c.rnc,
        type: c.type,
        uuid: c.uuid
      }, { onConflict: "company_code, local_id" });
      if (error) errors.push(`Cliente ${c.name}: ${error.message}`);
      else pushedCount++;
    }

    // C. Subir Secuencias NCF
    const allSeqs = db.select().from(ncfSequences).all();
    for (const s of allSeqs) {
      const { error } = await supabase.from("cloud_ncf_sequences").upsert({
        company_code: companyCode,
        type: s.type,
        current_number: s.current,
        max_limit: s.limit,
        expiry_date: s.expiry,
        uuid: s.uuid
      }, { onConflict: "company_code, type" });
      if (error) errors.push(`NCF ${s.type}: ${error.message}`);
      else pushedCount++;
    }

    if (errors.length > 0) {
      console.error("[Sync] Errores encontrados:", errors);
      return { success: false, msg: `Sincronización parcial. Errores: ${errors[0]}` };
    }

    return { success: true, count: pushedCount };
  } catch (err) {
    console.error("[Sync] Critical Sync Error:", err);
    return { success: false, msg: err.message };
  }
}

module.exports = { 
  startCloudSyncListener,
  fullSyncFromCloud,
  pushAllDataToCloud,
  pushProductToCloud, 
  pushInvoiceToCloud,
  pushConfigToCloud,
  pushNCFSequenceToCloud
};
