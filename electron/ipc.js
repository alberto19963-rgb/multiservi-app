const nodemailer = require("nodemailer");
const { ipcMain } = require("electron");
const { getDB, getSQLite } = require("./db/init");
const {
  products,
  clients,
  ncfSequences,
  invoices,
  invoiceItems,
  users,
  expenses,
  cashClosings,
  employees,
  timeLogs,
  candidates,
  config,
  shifts,
  invoicePayments,
  dgiiRncs,
} = require("./db/schema");
const { eq, sql, desc, like, or } = require("drizzle-orm");
const { v4: uuidv4 } = require("uuid");
const { getNextNCF, incrementNCF } = require("./ncf");
const { pushProductToCloud, pushUpdateToCloud, pushAllProductsToCloud, pushInvoiceToCloud, pullProductsFromCloud, pullInventoryFromCloud, pushFamilyToCloud, pushVariantToCloud, pushSkuToCloud, pushDeleteToCloud } = require("./cloud-sync");
const { syncDGII } = require("./dgii-sync");

const db = getDB();
const NODE_ID = "NODE-" + Math.floor(Math.random() * 1000); // TODO: Load from Config

// Helper to add metadata
const withMeta = (data) => ({
  ...data,
  uuid: uuidv4(),
  nodeId: NODE_ID,
  updatedAt: sql`(CURRENT_TIMESTAMP)`,
});

function setupIPC() {
  // --- PRODUCTS ---
  ipcMain.handle("db:get-products", async (event, query = "") => {
    try {
      if (query) {
        return db
          .select()
          .from(products)
          .where(
            or(
              like(products.name, `%${query}%`),
              like(products.code, `%${query}%`)
            )
          )
          .all();
      }
      return db.select().from(products).all();
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  ipcMain.handle("db:add-product", async (event, productData) => {
    try {
      const localProduct = db
        .insert(products)
        .values(withMeta(productData))
        .returning()
        .get();
      
      // Empujar a la nube silenciosamente de fondo
      pushProductToCloud(localProduct);

      return localProduct;
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  // --- DGII / RNC INTEGRATION ---
  ipcMain.handle("db:sync-dgii", async (event) => {
    return await syncDGII(event.sender);
  });

  ipcMain.handle("db:get-dgii-status", async () => {
    const { config } = require('./db/schema');
    try {
      const dbConfig = db.select().from(config).where(eq(config.key, 'dgii_last_sync')).get();
      return dbConfig ? dbConfig.value : null;
    } catch(e) { return null; }
  });

  ipcMain.handle("api:search-rnc", async (event, rnc) => {
    try {
      // 1. Check local DB first (Instant offline access!)
      const { dgiiRncs } = require('./db/schema');
      const localRnc = db.select().from(dgiiRncs).where(eq(dgiiRncs.rnc, rnc)).get();
      if (localRnc) {
          return { success: true, name: localRnc.name, source: 'local' };
      }

      // 2. Si el RNC tiene 11 dígitos, suele ser una cédula (Persona Física). Existe una API pública común.
      if (rnc && rnc.length === 11) {
          const response = await fetch(`https://api.adamix.net/apec/cedula/${rnc}`);
          if (response.ok) {
              const data = await response.json();
              if (data && data.Nombres) {
                  return { success: true, name: `${data.Nombres} ${data.Apellido1} ${data.Apellido2}`.trim(), source: 'api' };
              }
          }
      }
      
      // 3. Fallback
      return { 
          success: false, 
          message: "No encontrado en la Base Local ni en Internet."
      };
    } catch (e) {
      console.error(e);
      return { success: false, message: "Error al consultar internet" };
    }
  });

  ipcMain.handle("db:update-product", async (event, productData) => {
    try {
      console.log("[IPC] db:update-product called with:", productData);
      const { id, ...updateFields } = productData;
      const updatedProduct = db
        .update(products)
        .set({ ...updateFields, updatedAt: sql`(CURRENT_TIMESTAMP)` })
        .where(eq(products.id, id))
        .returning()
        .get();
      
      console.log("[IPC] update result:", updatedProduct);
      pushUpdateToCloud(updatedProduct);
      return updatedProduct;
    } catch (e) {
      console.error("[IPC] Error updating product:", e);
      throw e;
    }
  });

  ipcMain.handle("db:sync-all-cloud", async () => {
    return await pushAllProductsToCloud();
  });

  ipcMain.handle("db:pull-cloud", async () => {
    return await pullProductsFromCloud();
  });

  // --- CLIENTS ---
  ipcMain.handle("db:get-clients", async () => {
    return db.select().from(clients).all();
  });

  ipcMain.handle("db:add-client", async (event, clientData) => {
    return db.insert(clients).values(withMeta(clientData)).returning().get();
  });

  // --- NCF CONFIGURATION ---
  ipcMain.handle("db:get-ncf-sequences", async () => {
    return db.select().from(ncfSequences).all();
  });

  ipcMain.handle(
    "db:update-ncf-sequence",
    async (event, { type, current, limit, expiry }) => {
      // Upsert logic
      const existing = db
        .select()
        .from(ncfSequences)
        .where(eq(ncfSequences.type, type))
        .get();
      if (existing) {
        return db
          .update(ncfSequences)
          .set({ current, limit, expiry, updatedAt: sql`(CURRENT_TIMESTAMP)` })
          .where(eq(ncfSequences.type, type))
          .returning()
          .get();
      } else {
        return db
          .insert(ncfSequences)
          .values(withMeta({ type, current, limit, expiry }))
          .returning()
          .get();
      }
    }
  );

  // --- INVOICES / NCF ---
  ipcMain.handle(
    "db:create-invoice",
    async (event, { client, items, type, isQuote, payment, shiftId }) => {
      // type: 'FINAL' (B02), 'FISCAL' (B01), 'GOV' (B15)
      // payment: { method, received, change }

      const ncfTypeMap = {
        FINAL: "B02",
        FISCAL: "B01",
        GOV: "B15",
      };

      const ncfType = isQuote ? "QUOTE" : ncfTypeMap[type] || "B02";

      try {
        const result = db.transaction(() => {
          let ncf = null;

          if (!isQuote) {
            ncf = getNextNCF(ncfType);
            incrementNCF(ncfType);
          }

          const subtotal = items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );
          const itbis = subtotal * 0.18;
          const total = subtotal + itbis;

          const newInvoice = db
            .insert(invoices)
            .values(
              withMeta({
                clientId: client ? client.id : null,
                clientName: client ? client.name : "CONSUMIDOR FINAL",
                clientRnc: client ? client.rnc : null,
                ncf: ncf,
                ncfType: ncfType,
                total: total,
                subtotal: subtotal,
                itbis: itbis,
                itemsCount: items.length,
                status: isQuote ? "QUOTE" : "PAID",
              })
            )
            .returning()
            .get();

          // 4. Record Payment if NOT Quote
          if (!isQuote && payment) {
             db.insert(invoicePayments)
               .values(withMeta({
                  invoiceId: newInvoice.id,
                  shiftId: shiftId,
                  method: payment.method,
                  amount: total,
                  received: payment.received,
                  change: payment.change
               }))
               .run();
             
             // Update shift totals
             if (shiftId) {
               const column = payment.method === 'CASH' ? 'totalCash' 
                            : payment.method === 'CARD' ? 'totalCard'
                            : payment.method === 'TRANSFER' ? 'totalTransfer'
                            : 'totalCheck';
               
               db.update(shifts)
                 .set({ [column]: sql`${shifts[column]} + ${total}` })
                 .where(eq(shifts.id, shiftId))
                 .run();
             }
          }

          for (const item of items) {
            db.insert(invoiceItems)
              .values(
                withMeta({
                  invoiceId: newInvoice.id,
                  productId: item.id,
                  productName: item.name,
                  quantity: item.quantity,
                  price: item.price,
                  tax: item.price * 0.18,
                })
              )
              .run();

            if (!isQuote) {
              const currentProduct = db
                .select()
                .from(products)
                .where(eq(products.id, item.id))
                .get();
              if (currentProduct) {
                db.update(products)
                  .set({
                    stock: currentProduct.stock - item.quantity,
                    updatedAt: sql`(CURRENT_TIMESTAMP)`,
                  })
                  .where(eq(products.id, item.id))
                  .run();
              }
            }
          }

          return newInvoice;
        });

        const finalInvoice = result;
        if (!isQuote) {
            pushInvoiceToCloud(finalInvoice);
        }
        return finalInvoice;
      } catch (e) {
        console.error("Invoice Creation Error:", e);
        throw e;
      }
    }
  );

  ipcMain.handle("db:get-quotes", async () => {
    return db
      .select()
      .from(invoices)
      .where(eq(invoices.status, "QUOTE"))
      .orderBy(desc(invoices.id))
      .all();
  });

  ipcMain.handle("db:convert-quote-to-invoice", async (event, { quoteId, payment, shiftId }) => {
    try {
      const result = db.transaction(() => {
        // 1. Get Quote
        const quote = db
          .select()
          .from(invoices)
          .where(eq(invoices.id, quoteId))
          .get();
        if (!quote) throw new Error("Cotización no encontrada");
        if (quote.status !== "QUOTE")
          throw new Error("Esta cotización ya fue procesada");

        // 2. Determine NCF Type from user selection
        const ncfTypeMap = {
          FINAL: "B02",
          FISCAL: "B01",
          GOV: "B15",
        };
        const ncfType = ncfTypeMap[payment.type] || "B02";

        // 3. Generate NCF
        const ncf = getNextNCF(ncfType);
        incrementNCF(ncfType);

        // 4. Update Invoice Record
        db.update(invoices)
          .set({
            status: "PAID",
            ncf: ncf,
            ncfType: ncfType,
            date: sql`(CURRENT_TIMESTAMP)`,
          })
          .where(eq(invoices.id, quoteId))
          .run();

        // 5. Record Payment
        if (payment) {
           db.insert(invoicePayments)
             .values(withMeta({
                invoiceId: quoteId,
                shiftId: shiftId,
                method: payment.method,
                amount: quote.total,
                received: payment.received,
                change: payment.change
             }))
             .run();
           
           if (shiftId) {
             const column = payment.method === 'CASH' ? 'totalCash' 
                          : payment.method === 'CARD' ? 'totalCard'
                          : payment.method === 'TRANSFER' ? 'totalTransfer'
                          : 'totalCheck';
             
             db.update(shifts)
               .set({ [column]: sql`${shifts[column]} + ${quote.total}` })
               .where(eq(shifts.id, shiftId))
               .run();
           }
        }

        // 6. Deduct Stock
        const items = db
          .select()
          .from(invoiceItems)
          .where(eq(invoiceItems.invoiceId, quoteId))
          .all();

        for (const item of items) {
          const currentProduct = db
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .get();
          if (currentProduct) {
            db.update(products)
              .set({ stock: currentProduct.stock - item.quantity })
              .where(eq(products.id, item.productId))
              .run();
          }
        }

        return { success: true, ncf };
      });
      return result;
    } catch (e) {
      console.error("Quote Conversion Error:", e);
      throw e;
    }
  });

  // --- SHIFTS (Turns) ---
  ipcMain.handle("db:get-active-shift", async (event, userId) => {
    try {
      const { and, eq } = require("drizzle-orm");
      return db.select()
               .from(shifts)
               .where(and(eq(shifts.userId, userId), eq(shifts.status, 'OPEN')))
               .get() || null;
    } catch(e) { 
       console.error("[Shift] getActiveShift Error:", e);
       return null; 
    }
  });

  ipcMain.handle("db:open-shift", async (event, data) => {
    console.log("[Shift] Intentando abrir turno para usuario:", data.userId);
    try {
      const shiftData = withMeta({
        userId: data.userId,
        baseAmount: data.baseAmount,
        status: 'OPEN',
        startTime: new Date().toISOString(),
        totalCash: 0,
        totalCard: 0,
        totalTransfer: 0,
        totalCheck: 0
      });
      console.log("[Shift] Datos a insertar:", JSON.stringify(shiftData, null, 2));
      
      const result = db.insert(shifts).values(shiftData).returning().get();
      console.log("[Shift] Turno abierto exitosamente:", result.id);
      return result;
    } catch(e) { 
      console.error("[Shift] FATAL ERROR al abrir turno:", e);
      throw e; 
    }
  });

  ipcMain.handle("db:close-shift", async (event, { shiftId, realCash, realCard, notes }) => {
    try {
      console.log("[Shift] Cerrando turno:", shiftId);
      return db.update(shifts)
               .set({
                 status: 'CLOSED',
                 endTime: sql`(CURRENT_TIMESTAMP)`,
                 realCash,
                 realCard,
                 notes,
                 updatedAt: sql`(CURRENT_TIMESTAMP)`
               })
               .where(eq(shifts.id, shiftId))
               .returning()
               .get();
    } catch(e) { 
      console.error("[Shift] Error al cerrar turno:", e);
      throw e; 
    }
  });

  // --- USERS ---
  ipcMain.handle("db:login", async (event, { username, password }) => {
    try {
      const user = db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .get();
      if (user && user.password === password) {
        return {
          success: true,
          user: { id: user.id, name: user.name, role: user.role },
        };
      }
      return { success: false, message: "Credenciales inválidas" };
    } catch (e) {
      console.error(e);
      return { success: false, message: "Error de servidor" };
    }
  });

  ipcMain.handle("db:get-users", async () => {
    return db.select().from(users).all();
  });

  ipcMain.handle("db:add-user", async (event, userData) => {
    return db.insert(users).values(withMeta(userData)).returning().get();
  });

  // --- FINANCE ---
  ipcMain.handle("db:add-expense", async (event, data) => {
    return db.insert(expenses).values(withMeta(data)).returning().get();
  });

  // Removed startDate/endDate unused args
  ipcMain.handle("db:get-expenses", async () => {
    // Simple date filter or all for today
    // For MVP just return all recent
    return db
      .select()
      .from(expenses)
      .orderBy(desc(expenses.id))
      .limit(50)
      .all();
  });

  ipcMain.handle("db:get-daily-stats", async () => {
    try {
      // Filtrar facturas de hoy
      const todayInvoices = db
        .select()
        .from(invoices)
        .where(sql`date(${invoices.createdAt}) = date('now', 'localtime')`)
        .all();

      const totalSales = todayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

      // Filtrar gastos de hoy
      const todayExpenses = db
        .select()
        .from(expenses)
        .where(sql`date(${expenses.date}) = date('now', 'localtime')`)
        .all();

      const totalExpenses = todayExpenses.reduce(
        (sum, exp) => sum + (exp.amount || 0),
        0
      );

      return {
        sales: totalSales,
        expenses: totalExpenses,
        net: totalSales - totalExpenses,
      };
    } catch (e) {
      console.error("[Stats] Error fetching daily stats:", e);
      return { sales: 0, expenses: 0, net: 0 };
    }
  });

  ipcMain.handle("db:get-low-stock-count", async () => {
    try {
      const result = db.select({ count: sql`count(*)` })
        .from(products)
        .where(sql`${products.stock} <= ${products.minStock}`)
        .get();
      return result?.count || 0;
    } catch (e) {
      console.error("[Stats] Error fetching low stock count:", e);
      return 0;
    }
  });

  // --- CASH CLOSINGS (Added missing handler if needed, or keeping it clean of unused var warnings) ---
  // If cashClosings is unused, I should probably remove it from import or impl the handler.
  // Wait, I saw it imported but warnings said unused. I should add the handler back if it was deleted or just remove import.
  // Previous code had:
  /*
  ipcMain.handle("db:add-cash-closing", async (event, data) => {
      return db.insert(cashClosings).values(withMeta(data)).returning().get();
  });
  */
  // I will add it back to fix 'unused' warning and restore functionality.
  ipcMain.handle("db:add-cash-closing", async (event, data) => {
    return db.insert(cashClosings).values(withMeta(data)).returning().get();
  });

  // --- EMPLOYEES / TIME CLOCK ---
  ipcMain.handle("db:get-employees", async () => {
    return db.select().from(employees).all();
  });

  ipcMain.handle("db:add-employee", async (event, data) => {
    return db.insert(employees).values(withMeta(data)).returning().get();
  });

  ipcMain.handle("db:clock-action", async (event, { identifier, type }) => {
    // identifier can be PIN or NFC Code
    // Try finding by PIN first, then NFC
    // Note: or(...) syntax for Drizzle: or(eq(employees.pin, identifier), eq(employees.nfcCode, identifier))
    // We need to import 'or' from drizzle-orm if not present.
    // Instead of importing new operator, let's just run two queries or raw sql if needed.
    // Let's try finding by PIN first (most common manual), then NFC.

    let emp = db
      .select()
      .from(employees)
      .where(eq(employees.pin, identifier))
      .get();

    if (!emp) {
      emp = db
        .select()
        .from(employees)
        .where(eq(employees.nfcCode, identifier))
        .get();
    }

    if (!emp) return { success: false, message: "PIN o Carnet no reconocido" };

    // Log Action
    await db
      .insert(timeLogs)
      .values(
        withMeta({
          employeeId: emp.id,
          type: type,
        })
      )
      .run();

    return { success: true, employee: emp.name };
  });

  ipcMain.handle("db:get-time-logs", async () => {
    // Join logic simulation
    const logs = db
      .select()
      .from(timeLogs)
      .orderBy(desc(timeLogs.timestamp))
      .limit(50)
      .all();

    // Fetch employee names manually since we don't have join set up fully
    const logsWithNames = logs.map((log) => {
      const emp = db
        .select()
        .from(employees)
        .where(eq(employees.id, log.employeeId))
        .get();
      return {
        ...log,
        employeeName: emp ? emp.name : "Desconocido",
      };
    });

    return logsWithNames;
  });

  // --- PAYROLL ---
  ipcMain.handle("db:get-payroll-preview", async () => {
    const activeEmployees = db
      .select()
      .from(employees)
      .where(eq(employees.active, 1))
      .all();
    return activeEmployees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      salary: emp.salary,
      bankAccount: emp.bankAccount,
      amountToPay: (emp.salary || 0) / 2, // Quincenal default
    }));
  });

  // --- RECRUITMENT & HIRING ---
  const fs = require("fs");
  const path = require("path");
  const { app } = require("electron");

  ipcMain.handle("db:get-candidates", async () => {
    return db.select().from(candidates).orderBy(desc(candidates.id)).all();
  });

  ipcMain.handle("db:add-candidate", async (event, data) => {
    return db.insert(candidates).values(withMeta(data)).returning().get();
  });

  ipcMain.handle(
    "db:update-candidate-status",
    async (event, { id, status, notes }) => {
      return db
        .update(candidates)
        .set({
          status: status,
          interviewNotes: notes,
          updatedAt: sql`(CURRENT_TIMESTAMP)`,
        })
        .where(eq(candidates.id, id))
        .returning()
        .get();
    }
  );

  // THE MAGIC FUNCTION
  ipcMain.handle(
    "db:hire-candidate",
    async (
      event,
      { candidateId, salary, startDate, jobTitle, department, workMode, pin }
    ) => {
      try {
        // 1. Get Candidate
        const candidate = db
          .select()
          .from(candidates)
          .where(eq(candidates.id, candidateId))
          .get();
        if (!candidate) throw new Error("Candidato no encontrado");

        // 2. Create Employee Record
        const newEmp = db
          .insert(employees)
          .values(
            withMeta({
              name: candidate.name,
              cedula: candidate.cedula,
              phone: candidate.phone,
              email: candidate.email,
              salary: parseFloat(salary),
              startDate: startDate,
              jobTitle: jobTitle,
              department: department,
              workMode: workMode,
              pin: pin || candidate.cedula?.slice(-4) || "0000", // Default PIN
              status: "ACTIVE",
            })
          )
          .returning()
          .get();

        // 3. Update Candidate Status
        db.update(candidates)
          .set({ status: "HIRED", folderPath: "GENERATED" })
          .where(eq(candidates.id, candidateId))
          .run();

        // 4. Create Folder Structure
        const docsPath = path.join(
          app.getPath("documents"),
          "Multiservi_RRHH",
          "Empleados"
        );
        const safeName = candidate.name
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase();
        const empFolder = path.join(
          docsPath,
          `${safeName}_${candidate.cedula || "000"}`
        );

        if (!fs.existsSync(empFolder)) {
          fs.mkdirSync(empFolder, { recursive: true });
        }

        // 5. Generate Text Contract (Mock PDF for now)
        const contractContent = `
         CONTRATO DE TRABAJO
         -------------------
         EMPLEADO: ${candidate.name}
         CEDULA: ${candidate.cedula}
         CARGO: ${jobTitle}
         DEPARTAMENTO: ${department}
         SALARIO MENSUAL: RD$ ${salary}
         FECHA INICIO: ${startDate}
         
         Entre Multiservi Chavon SRL y ${candidate.name}, se acuerda...
         (Firma Empleado)               (Firma Empresa)
         `;

        fs.writeFileSync(
          path.join(empFolder, "CONTRATO_LABORAL.txt"),
          contractContent
        );

        // 6. Save Application Data
        fs.writeFileSync(
          path.join(empFolder, "SOLICITUD_EMPLEO.json"),
          JSON.stringify(candidate, null, 2)
        );

        return { success: true, path: empFolder, employee: newEmp };
      } catch (e) {
        console.error("Hiring Error:", e);
        throw e;
      }
    }
  );

  ipcMain.handle("db:open-folder", async (event, folderPath) => {
    // Logic to open folder in explorer/finder
    // Not implemented natively in node, but Electron shell.openPath works from main process
    const { shell } = require("electron");
    if (folderPath && fs.existsSync(folderPath)) {
      await shell.openPath(folderPath);
      return true;
    }
    // Fallback: Open Documents
    await shell.openPath(
      path.join(app.getPath("documents"), "Gestion Empresarial_RRHH")
    );
    return false;
  });
  // --- EMAIL & SETTINGS ---
  ipcMain.handle("db:save-setting", async (event, key, value) => {
    let safeValue =
      value === undefined || value === null ? "" : String(value).trim();

    if (key === "smtp_pass") {
      safeValue = safeValue.replace(/\s/g, "");
    }

    const existing = db.select().from(config).where(eq(config.key, key)).get();

    if (existing) {
      return db
        .update(config)
        .set({ value: safeValue })
        .where(eq(config.key, key))
        .run();
    } else {
      const result = db.insert(config).values({ key, value: safeValue }).run();
      
      // Auto-pull products when company_code is first activated
      if (key === 'company_code' && safeValue) {
        console.log('[SaaS] Nueva empresa activada, descargando inventario de la nube...');
        pullProductsFromCloud();
        pullInventoryFromCloud().then(res => {
          console.log('[SaaS] Pull avanzado automático result:', res);
        }).catch(e => console.error('[SaaS] Pull avanzado error:', e));
      }
      
      return result;
    }
  });

  ipcMain.handle("db:delete-product", async (event, productId) => {
    try {
      db.delete(products).where(eq(products.id, productId)).run();
      pushDeleteToCloud(productId);
      return { success: true };
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle("db:delete-candidate", async (event, id) => {
    try {
      db.delete(candidates).where(eq(candidates.id, id)).run();
      return { success: true };
    } catch (err) {
      console.error("Error deleting candidate:", err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("db:get-setting", async (event, key) => {
    const res = db.select().from(config).where(eq(config.key, key)).get();
    // console.log("Getting setting [IPC]:", key, res);
    return res ? res.value : "";
  });

  ipcMain.handle("mail:request-link", async (event, { email, companyName }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      // 1. Obtener o Registrar API KEY de Plataforma
      let apiKey = db.select().from(config).where(eq(config.key, "mail_engine_api_key")).get()?.value;
      
      if (!apiKey) {
        console.log("[MailEngine] Registrando esta App en el motor central...");
        const regRes = await fetch("http://mail-api.rosariogroupllc.com/api/admin/platforms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: "Multiservi Desktop App", 
            url: "http://mail-api.rosariogroupllc.com/auth/google/callback" 
          })
        });

        const regText = await regRes.text();
        let regData;
        try {
          regData = JSON.parse(regText);
        } catch (e) {
          throw new Error(`Error al registrar plataforma: El servidor no devolvió JSON. Respuesta: ${regText.substring(0, 50)}`);
        }

        if (regRes.ok && regData.apiKey) {
          apiKey = regData.apiKey;
          db.insert(config).values({ key: "mail_engine_api_key", value: apiKey }).run();
          console.log("[MailEngine] Plataforma registrada con éxito:", apiKey);
        } else {
          throw new Error(`Error al registrar plataforma: ${regData.error || regRes.statusText || "Respuesta incompleta"}`);
        }
      }

      // 2. Solicitar enlace
      const response = await fetch("http://mail-api.rosariogroupllc.com/api/external/request-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, companyName, apiKey }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error("[MailEngine] Respuesta no JSON:", responseText);
        return { success: false, message: `El servidor devolvió una respuesta no válida (no JSON). Inicio de respuesta: ${responseText.substring(0, 100)}` };
      }

      if (data.authUrl) {
        const { shell } = require("electron");
        shell.openExternal(data.authUrl);
        return { success: true };
      }
      return { success: false, message: data.error || "No se recibió URL de autenticación" };
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        return { success: false, message: "Tiempo de espera agotado al conectar con el Gestor de Mail" };
      }
      return { success: false, message: "Error de red: " + e.message };
    }
  });

  ipcMain.handle("mail:get-link-status", async (event, email) => {
    try {
      const response = await fetch(`http://mail-api.rosariogroupllc.com/api/external/status/${email}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle("email:send-invitation", async (event, { name, email }) => {
    try {
      // 1. Verificar si el nuevo motor está activo
      const isMailLinkActive = db.select().from(config).where(eq(config.key, "mail_link_active")).get()?.value === "true";
      const mailLinkEmail = db.select().from(config).where(eq(config.key, "mail_link_email")).get()?.value;

      const formUrl = db.select().from(config).where(eq(config.key, "recruitment_form_url")).get()?.value || "https://google.com";

      if (isMailLinkActive && mailLinkEmail) {
        console.log(`[MailEngine] Enviando invitación a ${email} vía motor nuevo...`);
        const apiKey = db.select().from(config).where(eq(config.key, "mail_engine_api_key")).get()?.value || 'test-api-key';
        
        const bodyHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <h2 style="color: #1e3a8a;">Hola ${name},</h2>
            <p style="font-size: 16px; color: #374151;">Gracias por tu interés en unirte a nuestro equipo.</p>
            <p style="font-size: 16px; color: #374151;">Para continuar con tu proceso de solicitud, por favor completa el siguiente formulario:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${formUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Completar Solicitud</a>
            </div>
            <p style="font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Este es un correo automático enviado por nuestro sistema de gestión.
            </p>
          </div>
        `;

        const response = await fetch("http://mail-api.rosariogroupllc.com/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: mailLinkEmail,
            recipient: email,
            subject: `Invitacion de Reclutamiento - ${name}`,
            bodyHtml,
            apiKey
          })
        });

        if (response.ok) return { success: true };
        const errData = await response.json();
        throw new Error(errData.error || "Error en el motor de correos");
      }

      throw new Error("No hay una cuenta de correo centralizada vinculada. Ve a Configuración para enlazar una.");
    } catch (e) {
      console.error("Email Error:", e);
      return { success: false, message: e.message };
    }
  });

  // --- PDF GENERATION ---
  ipcMain.handle("pdf:download", async (event, { filename }) => {
    try {
      const { BrowserWindow, shell } = require("electron");
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) throw new Error("No window found");

      const data = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: "A4",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const downloadsPath = app.getPath("downloads");
      const filePath = path.join(downloadsPath, filename || "documento.pdf");

      require("fs").writeFileSync(filePath, data);

      // Open folder
      shell.showItemInFolder(filePath);

      return { success: true, filePath };
    } catch (e) {
      console.error("PDF Error:", e);
      return { success: false, message: e.message };
    }
  });

  // --- WINDOW CONTROLS ---
  ipcMain.handle("app:toggle-fullscreen", () => {
    const { BrowserWindow } = require("electron");
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.setFullScreen(!win.isFullScreen());
    }
  });

  // =============================================
  //  INVENTARIO AVANZADO: FAMILIAS, VARIANTES, SKUS
  // =============================================

  // --- FAMILIAS ---
  ipcMain.handle("db:get-families", async () => {
    try {
      const sqlite = getSQLite();
      // Get families with count of active variants
      const rows = sqlite.prepare(`
        SELECT f.*, COUNT(v.id) as variant_count
        FROM product_families f
        LEFT JOIN product_variants v ON v.family_id = f.id AND v.active = 1
        GROUP BY f.id
        ORDER BY f.name ASC
      `).all();
      return rows;
    } catch (e) {
      console.error("[IPC] get-families error:", e);
      return [];
    }
  });

  ipcMain.handle("db:add-family", async (event, { name, icon }) => {
    try {
      const sqlite = getSQLite();
      const result = sqlite.prepare(
        "INSERT INTO product_families (name, icon) VALUES (?, ?)"
      ).run(name, icon || "📦");
      const newFamily = { id: result.lastInsertRowid, name, icon: icon || "📦" };
      // Sync to Supabase in background
      pushFamilyToCloud(newFamily);
      return { success: true, id: result.lastInsertRowid };
    } catch (e) {
      console.error("[IPC] add-family error:", e);
      throw e;
    }
  });

  ipcMain.handle("db:update-family", async (event, { id, name, icon }) => {
    try {
      const sqlite = getSQLite();
      sqlite.prepare("UPDATE product_families SET name=?, icon=? WHERE id=?").run(name, icon, id);
      pushFamilyToCloud({ id, name, icon });
      return { success: true };
    } catch (e) {
      console.error("[IPC] update-family error:", e);
      throw e;
    }
  });

  ipcMain.handle("db:delete-family", async (event, id) => {
    try {
      const sqlite = getSQLite();
      sqlite.prepare("DELETE FROM product_families WHERE id=?").run(id);
      return { success: true };
    } catch (e) {
      console.error("[IPC] delete-family error:", e);
      return { success: false, message: e.message };
    }
  });

  // --- VARIANTES ---
  ipcMain.handle("db:get-variants", async (event, familyId) => {
    try {
      const sqlite = getSQLite();
      const rows = sqlite.prepare(`
        SELECT v.*, COUNT(s.id) as sku_count,
               SUM(s.stock) as total_stock
        FROM product_variants v
        LEFT JOIN product_skus s ON s.variant_id = v.id AND s.active = 1
        WHERE v.family_id = ? AND v.active = 1
        GROUP BY v.id
        ORDER BY v.name ASC
      `).all(familyId);
      return rows;
    } catch (e) {
      console.error("[IPC] get-variants error:", e);
      return [];
    }
  });

  ipcMain.handle("db:add-variant", async (event, { familyId, name, brand, description }) => {
    try {
      const sqlite = getSQLite();
      const result = sqlite.prepare(
        "INSERT INTO product_variants (family_id, name, brand, description) VALUES (?, ?, ?, ?)"
      ).run(familyId, name, brand || "", description || "");
      // Get family name for sync
      const family = sqlite.prepare("SELECT name FROM product_families WHERE id=?").get(familyId);
      pushVariantToCloud({ id: result.lastInsertRowid, name, brand, description }, family?.name || "");
      return { success: true, id: result.lastInsertRowid };
    } catch (e) {
      console.error("[IPC] add-variant error:", e);
      throw e;
    }
  });

  ipcMain.handle("db:update-variant", async (event, { id, name, brand, description }) => {
    try {
      const sqlite = getSQLite();
      sqlite.prepare(
        "UPDATE product_variants SET name=?, brand=?, description=? WHERE id=?"
      ).run(name, brand || "", description || "", id);
      
      const v = sqlite.prepare("SELECT v.*, f.name as family_name FROM product_variants v JOIN product_families f ON v.family_id = f.id WHERE v.id = ?").get(id);
      if (v) pushVariantToCloud(v, v.family_name);
      
      return { success: true };
    } catch (e) {
      console.error("[IPC] update-variant error:", e);
      throw e;
    }
  });

  ipcMain.handle("db:delete-variant", async (event, id) => {
    try {
      const sqlite = getSQLite();
      sqlite.prepare("UPDATE product_variants SET active=0 WHERE id=?").run(id);
      return { success: true };
    } catch (e) {
      console.error("[IPC] delete-variant error:", e);
      return { success: false, message: e.message };
    }
  });

  // --- SKUs / PRESENTACIONES ---
  ipcMain.handle("db:get-skus", async (event, variantId) => {
    try {
      const sqlite = getSQLite();
      const rows = sqlite.prepare(`
        SELECT * FROM product_skus
        WHERE variant_id = ? AND active = 1
        ORDER BY name ASC
      `).all(variantId);
      return rows;
    } catch (e) {
      console.error("[IPC] get-skus error:", e);
      return [];
    }
  });

  ipcMain.handle("db:add-sku", async (event, { variantId, variantName, familyName, name, barcode, price, cost, stock, minStock, unit, qtyPerPack }) => {
    try {
      const sqlite = getSQLite();

      // 1. Insert into product_skus
      const result = sqlite.prepare(`
        INSERT INTO product_skus (variant_id, name, barcode, price, cost, stock, min_stock, unit, qty_per_pack)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(variantId, name, barcode || null, price || 0, cost || 0, stock || 0, minStock || 5, unit || "UNI", qtyPerPack || 1);

      const skuId = result.lastInsertRowid;

      // Sync to Supabase in background
      pushSkuToCloud(
        { id: skuId, name, barcode, price, cost, stock, min_stock: minStock, unit, qty_per_pack: qtyPerPack },
        variantName, familyName
      );

      // 2. Sync to legacy 'products' table so POS keeps working
      // Name format: "Familia - Variante - Presentación" (e.g. "Agua - Agua Cristal - Fardo x24")
      // We clean redundancy: if SKU name starts with Variant name, or Variant starts with Family, we strip them.
      let cleanVariant = variantName;
      if (variantName.toLowerCase().startsWith(familyName.toLowerCase())) {
          cleanVariant = variantName.slice(familyName.length).trim();
          if (cleanVariant.startsWith('-') || cleanVariant.startsWith(':')) cleanVariant = cleanVariant.slice(1).trim();
      }

      let cleanSku = name;
      if (name.toLowerCase().startsWith(variantName.toLowerCase())) {
          cleanSku = name.slice(variantName.length).trim();
          if (cleanSku.startsWith('-') || cleanSku.startsWith(':')) cleanSku = cleanSku.slice(1).trim();
      }

      const legacyName = [familyName, cleanVariant, cleanSku].filter(Boolean).filter(s => s.length > 0).join(" - ");
      try {
        sqlite.prepare(`
          INSERT INTO products (name, type, code, stock, price, cost, unit, min_stock)
          VALUES (?, 'FINISHED', ?, ?, ?, ?, ?, ?)
        `).run(legacyName, barcode || null, stock || 0, price || 0, cost || 0, unit || "UNI", minStock || 5);
      } catch (syncErr) {
        // If barcode conflict in legacy table, just skip sync but sku was created
        console.warn("[IPC] Legacy sync skipped (barcode conflict):", syncErr.message);
      }

      return { success: true, id: skuId };
    } catch (e) {
      console.error("[IPC] add-sku error:", e);
      throw e;
    }
  });

  ipcMain.handle("db:update-sku", async (event, { id, name, barcode, price, cost, stock, minStock, unit, qtyPerPack }) => {
    try {
      const sqlite = getSQLite();
      sqlite.prepare(`
        UPDATE product_skus
        SET name=?, barcode=?, price=?, cost=?, stock=?, min_stock=?, unit=?, qty_per_pack=?
        WHERE id=?
      `).run(name, barcode || null, price || 0, cost || 0, stock || 0, minStock || 5, unit || "UNI", qtyPerPack || 1, id);

      // Sync to cloud
      const s = sqlite.prepare(`
        SELECT s.*, v.name as variant_name, f.name as family_name 
        FROM product_skus s 
        JOIN product_variants v ON s.variant_id = v.id 
        JOIN product_families f ON v.family_id = f.id 
        WHERE s.id = ?
      `).get(id);
      if (s) pushSkuToCloud(s, s.variant_name, s.family_name);

      // Update legacy products table too
      if (barcode) {
        sqlite.prepare(
          "UPDATE products SET stock=?, price=?, cost=? WHERE code=?"
        ).run(stock || 0, price || 0, cost || 0, barcode);
      }

      return { success: true };
    } catch (e) {
      console.error("[IPC] update-sku error:", e);
      throw e;
    }
  });

  ipcMain.handle("db:delete-sku", async (event, id) => {
    try {
      const sqlite = getSQLite();
      sqlite.prepare("UPDATE product_skus SET active=0 WHERE id=?").run(id);
      return { success: true };
    } catch (e) {
      console.error("[IPC] delete-sku error:", e);
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("db:adjust-sku-stock", async (event, { id, delta, barcode }) => {
    try {
      const sqlite = getSQLite();
      // Adjust by delta (+ add, - subtract)
      sqlite.prepare(
        "UPDATE product_skus SET stock = MAX(0, stock + ?) WHERE id=?"
      ).run(delta, id);
      // Sync to legacy
      if (barcode) {
        sqlite.prepare(
          "UPDATE products SET stock = MAX(0, stock + ?) WHERE code=?"
        ).run(delta, barcode);
      }
      const updated = sqlite.prepare("SELECT stock FROM product_skus WHERE id=?").get(id);
      return { success: true, newStock: updated?.stock };
    } catch (e) {
      console.error("[IPC] adjust-sku-stock error:", e);
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("db:search-skus-global", async (event, query) => {
    try {
      const sqlite = getSQLite();
      const rows = sqlite.prepare(`
        SELECT 
            s.id, 
            s.name as sku_name, 
            s.barcode, 
            s.stock, 
            s.price, 
            s.unit,
            COALESCE(v.name, 'Sin Variante') as variant_name, 
            COALESCE(v.brand, '') as brand,
            COALESCE(f.name, 'Sin Familia') as family_name, 
            COALESCE(f.icon, '📦') as family_icon
        FROM product_skus s
        LEFT JOIN product_variants v ON s.variant_id = v.id
        LEFT JOIN product_families f ON v.family_id = f.id
        WHERE (s.barcode LIKE ? OR s.name LIKE ? OR v.name LIKE ? OR f.name LIKE ?)
        ORDER BY s.name ASC
        LIMIT 50
      `).all(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
      
      return rows;
    } catch (e) {
      console.error("[IPC] search-skus-global error:", e);
      return [];
    }
  });

  ipcMain.handle("db:get-invoice-items", async (event, invoiceId) => {
    try {
      return db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoiceId))
        .all();
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  // --- QUOTATION ACTIONS (PRINT/EMAIL) ---
  ipcMain.handle("db:print-quote", async (event, quoteId) => {
    try {
      const { quote, items, company } = await getQuotePrintData(quoteId);
      const html = generateDocumentHTML("COTIZACIÓN", quote, items, company);
      
      const { BrowserWindow } = require("electron");
      let win = new BrowserWindow({ show: false });
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      win.webContents.on("did-finish-load", () => {
        win.webContents.print({ silent: false, printBackground: true });
        // win.close(); 
      });
      return { success: true };
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle("db:email-quote", async (event, { quoteId, email }) => {
    try {
      const { quote, items, company } = await getQuotePrintData(quoteId);
      const html = generateDocumentHTML("COTIZACIÓN", quote, items, company);
      
      const isMailLinkActive = db.select().from(config).where(eq(config.key, "mail_link_active")).get()?.value === "true";
      const mailLinkEmail = db.select().from(config).where(eq(config.key, "mail_link_email")).get()?.value;

      if (isMailLinkActive && mailLinkEmail) {
        const apiKey = db.select().from(config).where(eq(config.key, "mail_engine_api_key")).get()?.value;
        const response = await fetch("http://mail-api.rosariogroupllc.com/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: mailLinkEmail,
            apiKey: apiKey,
            to: email,
            subject: `Cotización #${quote.id} - ${company.name}`,
            text: `Hola, adjuntamos la cotización solicitada. Total: $${quote.total}`,
            html: html
          })
        });
        const resData = await response.json();
        return { success: response.ok, message: resData.message || resData.error };
      } else {
        throw new Error("El sistema de correo no está configurado.");
      }
    } catch (e) {
      console.error(e);
      return { success: false, message: e.message };
    }
  });
}

async function getQuotePrintData(quoteId) {
  const quote = db.select().from(invoices).where(eq(invoices.id, quoteId)).get();
  const items = db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, quoteId)).all();
  
  const companyData = db.select().from(config).all();
  const company = {
    name: companyData.find(c => c.key === 'company_name')?.value || 'Multiservi Chavon',
    rnc: companyData.find(c => c.key === 'company_rnc')?.value || '',
    address: companyData.find(c => c.key === 'company_address')?.value || '',
    phone: companyData.find(c => c.key === 'company_phone')?.value || '',
  };

  return { quote, items, company };
}

function generateDocumentHTML(title, doc, items, company) {
  return `
    <html>
      <head>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .company-info h1 { margin: 0; color: #1e3a8a; }
          .doc-info { text-align: right; }
          .doc-info h2 { margin: 0; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 30px; }
          th { background: #f3f4f6; text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
          td { padding: 12px; border-bottom: 1px solid #eee; }
          .totals { margin-top: 30px; text-align: right; }
          .totals div { font-size: 18px; margin-bottom: 5px; }
          .footer { margin-top: 50px; font-size: 12px; color: #999; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h1>${company.name}</h1>
            <p>RNC: ${company.rnc}<br>${company.address}<br>Tel: ${company.phone}</p>
          </div>
          <div class="doc-info">
            <h2>${title}</h2>
            <p>#${doc.id}<br>Fecha: ${new Date(doc.date).toLocaleDateString()}</p>
            <p><strong>Cliente:</strong> ${doc.clientName}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Precio</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.productName}</td>
                <td>${item.quantity}</td>
                <td>$${item.price.toLocaleString()}</td>
                <td>$${(item.quantity * item.price).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div>Subtotal: $${doc.subtotal.toLocaleString()}</div>
          <div>ITBIS (18%): $${doc.itbis.toLocaleString()}</div>
          <div style="font-weight: bold; font-size: 24px; color: #1e3a8a;">TOTAL: $${doc.total.toLocaleString()}</div>
        </div>

        <div class="footer">
          Esta es una cotización informativa válida por 15 días.
        </div>
      </body>
    </html>
  `;
}

module.exports = { setupIPC };
