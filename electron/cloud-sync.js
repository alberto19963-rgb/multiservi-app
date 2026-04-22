const { supabase } = require("./supabase-client");
const { getDB } = require("./db/init");
const { products, config, productFamilies, productVariants, productSkus } = require("./db/schema");
const { eq } = require("drizzle-orm");
const { sql } = require("drizzle-orm");

function getCompanyCode() {
  const db = getDB();
  const compCode = db.select().from(config).where(eq(config.key, "company_code")).get();
  return compCode ? compCode.value : null;
}

// 1. PUSH: Cuando creas un producto localmente, lo mandamos a la Nube.
async function pushProductToCloud(localProduct) {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  try {
    const { error } = await supabase.from("cloud_products").insert({
      company_code: companyCode,
      local_id: localProduct.id,
      name: localProduct.name,
      type: localProduct.type,
      code: localProduct.code,
      stock: localProduct.stock,
      price: localProduct.price,
      cost: localProduct.cost,
    });
    if (error) {
      console.error("[SaaS Sync] Error pushing product to cloud:", error.message);
    } else {
      console.log(`[SaaS Sync] Producto '${localProduct.name}' empujado a la Nube con éxito.`);
    }
  } catch (err) {
    console.error("[SaaS Sync] Exception:", err);
  }
}

// 1.5. PUSH UPDATE: Cuando editas un producto, lo actualizamos.
async function pushUpdateToCloud(localProduct) {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  try {
    const { error } = await supabase.from("cloud_products")
      .update({
        name: localProduct.name,
        type: localProduct.type,
        code: localProduct.code,
        stock: localProduct.stock,
        price: localProduct.price,
        cost: localProduct.cost,
      })
      .eq("company_code", companyCode)
      .eq("local_id", localProduct.id);
      
    if (error) {
      console.error("[SaaS Sync] Error updating product in cloud:", error.message);
    } else {
      console.log(`[SaaS Sync] Producto '${localProduct.name}' ACTUALIZADO en la Nube con éxito.`);
    }
  } catch (err) {
    console.error("[SaaS Sync] Exception (update):", err);
  }
}

// 1.7. PUSH DELETE: Cuando eliminas un producto, lo quitamos de la nube.
async function pushDeleteToCloud(localId) {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  try {
    const { error } = await supabase.from("cloud_products")
      .delete()
      .eq("company_code", companyCode)
      .eq("local_id", localId);
      
    if (error) {
      console.error("[SaaS Sync] Error deleting product from cloud:", error.message);
    } else {
      console.log(`[SaaS Sync] Producto #${localId} ELIMINADO de la Nube con éxito.`);
    }
  } catch (err) {
    console.error("[SaaS Sync] Exception (delete):", err);
  }
}

// 1.8. PUSH ALL (Mass Sync)
async function pushAllProductsToCloud() {
  if (!supabase) return { success: false, msg: "Sin conexión" };
  const companyCode = getCompanyCode();
  if (!companyCode) return { success: false, msg: "Falta código" };

  try {
    const db = getDB();
    const allProducts = db.select().from(products).all();
    let pushed = 0;
    
    for (const p of allProducts) {
      const { error } = await supabase.from("cloud_products").upsert({
        company_code: companyCode,
        local_id: p.id,
        name: p.name,
        type: p.type,
        code: p.code,
        stock: p.stock,
        price: p.price,
        cost: p.cost,
        uuid: p.uuid,
      }, { onConflict: "company_code, local_id" });
      
      if (!error) pushed++;
    }
    
    return { success: true, pushed };
  } catch(e) {
    console.error(e);
    return { success: false, msg: e.message };
  }
}

// 3. PUSH INVOICE
async function pushInvoiceToCloud(localInvoice) {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  try {
    const { error } = await supabase.from("cloud_invoices").insert({
      company_code: companyCode,
      local_id: localInvoice.id,
      date: localInvoice.date,
      client_name: localInvoice.client_name,
      client_rnc: localInvoice.client_rnc,
      ncf: localInvoice.ncf,
      subtotal: localInvoice.subtotal,
      tax: localInvoice.tax,
      total: localInvoice.total,
    });
    if (error) {
       console.error("[SaaS Sync] Error pushing invoice to cloud:", error.message);
    } else {
       console.log(`[SaaS Sync] Venta #${localInvoice.id} sincronizada a la nube.`);
    }
  } catch (err) {
    console.error("[SaaS Sync] Exception (invoice):", err);
  }
}

// 4. PULL INVENTORY (Families -> Variants -> SKUs)
async function pullInventoryFromCloud() {
  if (!supabase) return { success: false, msg: 'Sin conexión a Supabase' };
  const companyCode = getCompanyCode();
  if (!companyCode) return { success: false, msg: 'Falta código de empresa' };

  console.log("[Cloud Pull] Iniciando descarga completa de inventario...");

  try {
    const db = getDB();

    // A. Pull Families
    const { data: fams, error: ef } = await supabase.from('cloud_families').select('*').eq('company_code', companyCode);
    if (!ef && fams) {
      for (const f of fams) {
        const exists = db.select().from(productFamilies).where(eq(productFamilies.name, f.name)).get();
        if (!exists) {
          db.insert(productFamilies).values({
            id: f.local_id,
            name: f.name,
            icon: f.icon || '📦',
            uuid: f.id,
          }).run();
        }
      }
    }

    // B. Pull Variants
    const { data: vars, error: ev } = await supabase.from('cloud_variants').select('*').eq('company_code', companyCode);
    if (!ev && vars) {
      for (const v of vars) {
        const exists = db.select().from(productVariants).where(eq(productVariants.name, v.name)).get();
        if (!exists) {
          const fam = db.select().from(productFamilies).where(eq(productFamilies.name, v.family_name)).get();
          db.insert(productVariants).values({
            id: v.local_id,
            familyId: fam ? fam.id : null,
            name: v.name,
            brand: v.brand || '',
            description: v.description || '',
            uuid: v.id,
          }).run();
        }
      }
    }

    // C. Pull SKUs
    const { data: skus, error: es } = await supabase.from('cloud_skus').select('*').eq('company_code', companyCode);
    if (!es && skus) {
      for (const s of skus) {
        const exists = db.select().from(productSkus).where(eq(productSkus.barcode, s.barcode)).get();
        if (!exists) {
          const v = db.select().from(productVariants).where(eq(productVariants.name, s.variant_name)).get();
          db.insert(productSkus).values({
            id: s.local_id,
            variantId: v ? v.id : null,
            name: s.name,
            barcode: s.barcode,
            price: s.price || 0,
            cost: s.cost || 0,
            stock: s.stock || 0,
            minStock: s.min_stock || 5,
            unit: s.unit || 'UNI',
            qtyPerPack: s.qty_per_pack || 1,
            uuid: s.id,
          }).run();
        }
      }
    }

    console.log("[Cloud Pull] Descarga de inventario completada.");
    
    // Notify Frontend to refresh UI after mass pull
    const { BrowserWindow } = require("electron");
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send("cloud:sync-refresh", "inventory-full");
    });

    return { success: true };
  } catch (e) {
    console.error('[Cloud Pull Error]', e);
    return { success: false, msg: e.message };
  }
}

// 5. PULL V1 PRODUCTS
async function pullProductsFromCloud() {
  if (!supabase) return { success: false, msg: 'Sin conexión a Supabase' };
  const companyCode = getCompanyCode();
  if (!companyCode) return { success: false, msg: 'Falta código de empresa' };

  try {
    const { data, error } = await supabase.from('cloud_products').select('*').eq('company_code', companyCode);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return { success: true, pulled: 0 };
    const db = getDB();
    let pulled = 0;
    for (const p of data) {
      const exists = db.select().from(products).where(eq(products.id, p.local_id)).get();
      if (!exists) {
        db.insert(products).values({ name: p.name, type: p.type || 'FISICO', stock: p.stock || 0, price: p.price || 0, uuid: p.id }).run();
        pulled++;
      }
    }
    return { success: true, pulled };
  } catch(e) {
    return { success: false, msg: e.message };
  }
}

// Realtime Listener
function startCloudSyncListener() {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;

  const db = getDB();
  const { BrowserWindow } = require("electron");

  supabase.channel('families-sync').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cloud_families' }, (payload) => {
    if (payload.new.company_code !== companyCode) return;
    const exists = db.select().from(productFamilies).where(eq(productFamilies.name, payload.new.name)).get();
    if (!exists) {
      db.insert(productFamilies).values({ name: payload.new.name, icon: payload.new.icon, uuid: payload.new.id }).run();
      BrowserWindow.getAllWindows()[0]?.webContents.send("cloud:sync-refresh", "families");
    }
  }).subscribe();

  // B. Escuchar Variantes
  supabase.channel('variants-sync').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cloud_variants' }, (payload) => {
    if (payload.new.company_code !== companyCode) return;
    const exists = db.select().from(productVariants).where(eq(productVariants.name, payload.new.name)).get();
    if (!exists) {
      const fam = db.select().from(productFamilies).where(eq(productFamilies.name, payload.new.family_name)).get();
      db.insert(productVariants).values({ familyId: fam?.id, name: payload.new.name, brand: payload.new.brand, uuid: payload.new.id }).run();
      BrowserWindow.getAllWindows()[0]?.webContents.send("cloud:sync-refresh", "variants");
    }
  }).subscribe();

  // C. Escuchar SKUs
  supabase.channel('skus-sync').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cloud_skus' }, (payload) => {
    if (payload.new.company_code !== companyCode) return;
    const exists = db.select().from(productSkus).where(eq(productSkus.barcode, payload.new.barcode)).get();
    if (!exists) {
      const v = db.select().from(productVariants).where(eq(productVariants.name, payload.new.variant_name)).get();
      db.insert(productSkus).values({
        variantId: v?.id,
        name: payload.new.name,
        barcode: payload.new.barcode,
        price: payload.new.price,
        stock: payload.new.stock,
        uuid: payload.new.id 
      }).run();
      BrowserWindow.getAllWindows()[0]?.webContents.send("cloud:sync-refresh", "skus");
    }
  }).subscribe();
  supabase.channel('products-sync').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cloud_products' }, (payload) => {
    if (payload.new.company_code !== companyCode) return;
    const exists = db.select().from(products).where(eq(products.name, payload.new.name)).get();
    if (!exists) {
      db.insert(products).values({ name: payload.new.name, price: payload.new.price, stock: payload.new.stock, uuid: payload.new.id }).run();
      BrowserWindow.getAllWindows()[0]?.webContents.send("cloud:sync-refresh", "products");
    }
  }).subscribe();
}

async function pushFamilyToCloud(family) {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;
  try {
    await supabase.from("cloud_families").upsert({
      company_code: companyCode,
      local_id: family.id,
      name: family.name,
      icon: family.icon || "📦",
    }, { onConflict: "company_code, local_id" });
  } catch (e) {
    console.error("[SaaS Sync] pushFamilyToCloud error:", e.message);
  }
}

async function pushVariantToCloud(variant, familyName) {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;
  try {
    await supabase.from("cloud_variants").upsert({
      company_code: companyCode,
      local_id: variant.id,
      family_name: familyName || "",
      name: variant.name,
      brand: variant.brand || "",
      description: variant.description || "",
    }, { onConflict: "company_code, local_id" });
  } catch (e) {
    console.error("[SaaS Sync] pushVariantToCloud error:", e.message);
  }
}

async function pushSkuToCloud(sku, variantName, familyName) {
  if (!supabase) return;
  const companyCode = getCompanyCode();
  if (!companyCode) return;
  try {
    await supabase.from("cloud_skus").upsert({
      company_code: companyCode,
      local_id: sku.id,
      family_name: familyName || "",
      variant_name: variantName || "",
      name: sku.name,
      barcode: sku.barcode || null,
      price: sku.price || 0,
      cost: sku.cost || 0,
      stock: sku.stock || 0,
      min_stock: sku.min_stock || 5,
      unit: sku.unit || "UNI",
      qty_per_pack: sku.qty_per_pack || 1,
    }, { onConflict: "company_code, local_id" });
  } catch (e) {
    console.error("[SaaS Sync] pushSkuToCloud error:", e.message);
  }
}

module.exports = { 
  pushProductToCloud, 
  pushUpdateToCloud, 
  startCloudSyncListener,
  pushAllProductsToCloud,
  pushInvoiceToCloud,
  pullProductsFromCloud,
  pullInventoryFromCloud,
  pushFamilyToCloud,
  pushVariantToCloud,
  pushSkuToCloud,
  pushDeleteToCloud,
};
