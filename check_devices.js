const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  console.log("--- BUSCANDO DISPOSITIVOS ---");
  const { data, error } = await supabase.from('devices').select('*').limit(5);
  if (error) {
    console.error("ERROR:", error.message);
    return;
  }
  console.log("RESULTADOS:", JSON.stringify(data, null, 2));
}

check();
