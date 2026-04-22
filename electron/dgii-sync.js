const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { getDB } = require('./db/init');
const { dgiiRncs, config } = require('./db/schema');
const { eq } = require('drizzle-orm');

async function syncDGII(eventSender) {
  try {
    const db = getDB();
    const tempDir = path.join(require('electron').app.getPath('userData'), 'tmp_dgii');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const zipPath = path.join(tempDir, 'DGII_RNC.zip');

    // 1. Download
    eventSender.send('dgii:progress', { step: 'downloading', msg: 'Descargando Padrón DGII (20MB+)...' });
    
    // We use curl with User-Agent to bypass Cloudflare
    const curlCmd = `curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" --compressed -k -o "${zipPath}" https://dgii.gov.do/app/WebApps/Consultas/rnc/DGII_RNC.zip`;
    
    await new Promise((resolve, reject) => {
      exec(curlCmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
           console.error("CURL Error:", stderr);
           return reject(new Error("Error al descargar archivo de DGII"));
        }
        resolve();
      });
    });

    if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1000000) {
       throw new Error("El archivo descargado está corrupto o DGII bloqueó la IP temporalmente.");
    }

    // 2. Extract
    eventSender.send('dgii:progress', { step: 'extracting', msg: 'Descomprimiendo archivo...' });
    const unzipCmd = `unzip -o "${zipPath}" -d "${tempDir}"`;
    execSync(unzipCmd);

    // Find the text file recursively
    let txtPath = null;
    const findTxtFile = (dir) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
           if (item.toLowerCase().endsWith('.zip')) continue;
           const fullPath = path.join(dir, item);
           if (fs.statSync(fullPath).isDirectory()) {
               findTxtFile(fullPath);
           } else if (fullPath.toLowerCase().endsWith('.txt') || fullPath.toLowerCase().endsWith('.csv')) {
               txtPath = fullPath;
           }
        }
    };
    findTxtFile(tempDir);
    
    if (!txtPath) {
        throw new Error("No se encontró el archivo de texto dentro del ZIP");
    }

    // 3. Process and Insert
    eventSender.send('dgii:progress', { step: 'parsing', msg: 'Procesando Base de Datos (Esto tomará 1-2 minutos)...' });
    
    const fileStream = fs.createReadStream(txtPath, { encoding: 'latin1' }); // Usually ISO-8859-1
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let batch = [];
    const BATCH_SIZE = 10000;
    let totalProcessed = 0;

    // Create a raw SQLite transaction for super fast inserts because Drizzle ORM batch might be slower
    const sqliteDB = db.$client; 
    // Drizzle uses better-sqlite3 automatically. db.$client returns the better-sqlite3 instance.
    
    // Clear old data
    eventSender.send('dgii:progress', { step: 'cleaning', msg: 'Limpiando base local anterior...' });
    sqliteDB.exec('DELETE FROM dgii_rncs');
    
    const insertStmt = sqliteDB.prepare(`INSERT OR REPLACE INTO dgii_rncs (rnc, name) VALUES (?, ?)`);
    
    const insertBatch = sqliteDB.transaction((items) => {
      for (const item of items) {
        insertStmt.run(item.rnc, item.name);
      }
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      // DGII format: RNC|Razon Social|Nombre Comercial|Categoria|...
      const parts = line.split('|');
      const rnc = parts[0]?.trim();
      // Nombre Comercial is parts[2], Razon Social is parts[1]
      let name = parts[2]?.trim();
      if (!name || name === '') {
          name = parts[1]?.trim();
      }

      if (rnc && name) {
         batch.push({ rnc, name });
      }

      if (batch.length >= BATCH_SIZE) {
         insertBatch(batch);
         totalProcessed += batch.length;
         batch = [];
         eventSender.send('dgii:progress', { step: 'parsing_progress', msg: `Se han procesado ${totalProcessed} contribuyentes...` });
      }
    }

    if (batch.length > 0) {
       insertBatch(batch);
       totalProcessed += batch.length;
    }

    // Save success timestamp
    const now = new Date().toISOString();
    sqliteDB.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES ('dgii_last_sync', ?)`).run(now);

    eventSender.send('dgii:progress', { step: 'done', msg: `¡Listo! Se guardaron ${totalProcessed} registros locales.` });

    // Cleanup
    try {
        fs.unlinkSync(zipPath);
        fs.unlinkSync(txtPath);
    } catch(e) {}

    return { success: true, count: totalProcessed, date: now };
  } catch (err) {
    console.error("[SaaS Sync DGII] Error:", err);
    eventSender.send('dgii:progress', { step: 'error', msg: err.message });
    throw err;
  }
}

module.exports = { syncDGII };
