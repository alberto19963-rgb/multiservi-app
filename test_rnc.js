const fetch = require('node-fetch'); // we can just use native fetch if node > 18
async function checkRNC(rnc) {
  const apis = [
    `https://api.adamix.net/apec/cedula/${rnc}`,
    `https://fcg.do/rutas/dgii/rnc/${rnc}`,
    `https://api.facturacion.do/rnc/${rnc}`
  ];
  for (const url of apis) {
    try {
      console.log('Trying', url);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.text();
        console.log('Success!', url, data.substring(0, 100));
      } else {
        console.log('Fail:', url, res.status);
      }
    } catch(e) { console.log('Error:', url, e.message); }
  }
}
checkRNC('131130429');
