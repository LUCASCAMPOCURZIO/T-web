// Función serverless de Vercel (Node, sin dependencias externas — así no
// hace falta ningún build ni npm install para el resto del sitio, que
// sigue siendo estático).
//
// Este es el ÚNICO archivo de "servidor" de todo el proyecto, y existe
// solo porque el sitio de la liga (vascogermana.com.ar) tiene un
// certificado SSL con el nombre de host que no coincide, y además el
// navegador de cada jugador no puede leer directamente páginas de otro
// sitio (política de CORS) — hace falta que alguien del lado del servidor
// pida la página y se la devuelva ya "traducida" a JSON.
//
// No guarda nada por su cuenta: el cliente (ya logueado como admin) es
// quien guarda el resultado en Firestore después de llamar a esta función.

const https = require("https");
const http = require("http");

const TORNEO_URL = "https://www.vascogermana.com.ar/torneo/11976";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function fetchHtml(targetUrl, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return reject(new Error("URL inválida: " + targetUrl));
    }
    const client = parsed.protocol === "http:" ? http : https;
    const req = client.get(
      targetUrl,
      {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "es-AR,es;q=0.9" },
        // El sitio de la liga tiene un certificado con el hostname mal
        // configurado; sin esto, Node rechaza la conexión HTTPS.
        rejectUnauthorized: false,
        timeout: 15000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
          const next = new URL(res.headers.location, targetUrl).toString();
          res.resume();
          return resolve(fetchHtml(next, redirectsLeft - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("La liga respondió con estado " + res.statusCode));
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Se agotó el tiempo de espera contactando a la liga."));
    });
  });
}

function stripTags(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú").replace(/&ntilde;/g, "ñ")
    .replace(/\s+/g, " ")
    .trim();
}

// Busca, entre todas las tablas de la página, la que tiene una columna de
// encabezado "PTS" (puntos) — esa es la tabla de posiciones. No depende de
// nombres de clases CSS, así que aguanta mejor si la liga retoca el diseño.
function findStandingsTable(html) {
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  const tables = html.match(tableRe) || [];
  for (const table of tables) {
    if (/PTS/i.test(stripTags(table))) return table;
  }
  return null;
}

function parseRows(tableHtml) {
  const rowRe = /<tr[\s\S]*?<\/tr>/gi;
  const rows = tableHtml.match(rowRe) || [];
  const results = [];
  for (const row of rows) {
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells = [];
    let m;
    while ((m = cellRe.exec(row))) {
      cells.push(stripTags(m[1]));
    }
    if (cells.length < 9) continue; // fila de encabezado u otra cosa, no una fila de equipo
    const [pos, team, pts, pj, pg, pe, pp, gf, gc, dg] = cells;
    if (!/^\d+$/.test(pos.trim())) continue; // la fila de encabezado ("#") no matchea
    results.push({
      pos: Number(pos),
      team: team.trim(),
      pts: Number(pts) || 0,
      pj: Number(pj) || 0,
      pg: Number(pg) || 0,
      pe: Number(pe) || 0,
      pp: Number(pp) || 0,
      gf: Number(gf) || 0,
      gc: Number(gc) || 0,
      dg: dg !== undefined ? Number(dg) || 0 : Number(gf || 0) - Number(gc || 0),
    });
  }
  return results;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const html = await fetchHtml(TORNEO_URL);
    const table = findStandingsTable(html);
    if (!table) {
      res.status(502).json({ error: "No se encontró la tabla de posiciones en la página de la liga." });
      return;
    }
    const rows = parseRows(table);
    if (rows.length === 0) {
      res.status(502).json({ error: "Se encontró la tabla, pero no se pudieron leer las filas de equipos." });
      return;
    }
    res.status(200).json({ rows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: (err && err.message) || "Error desconocido consultando la liga." });
  }
};
