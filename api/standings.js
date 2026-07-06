// Función serverless de Vercel (Node, sin dependencias externas — así no
// hace falta ningún build ni npm install para el resto del sitio, que
// sigue siendo estático).
//
// Este es el ÚNICO archivo de "servidor" de todo el proyecto. Existe
// porque el navegador de cada jugador no puede pedirle datos directamente
// a otro sitio web (política de CORS) — hace falta que alguien del lado
// del servidor los pida y se los pase a la app.
//
// La página de la liga (vascogermana.com.ar) arma su tabla de posiciones
// con JavaScript, pidiéndole los datos "en crudo" a una API pública propia
// de la plataforma que usan (Alenta). Pedimos esos mismos datos
// directamente ahí — es más simple y confiable que tratar de leer la
// tabla ya armada en HTML.
//
// No guarda nada por su cuenta: el cliente (ya logueado como admin) es
// quien guarda el resultado en Firestore después de llamar a esta función.

const https = require("https");

const POSITIONS_URL = "https://api.alenta.me/widgets/categories/11976/positions";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function fetchJson(targetUrl, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return reject(new Error("URL inválida: " + targetUrl));
    }
    const req = https.get(
      targetUrl,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          Referer: "http://www.vascogermana.com.ar/torneo/11976",
        },
        timeout: 15000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
          const next = new URL(res.headers.location, targetUrl).toString();
          res.resume();
          return resolve(fetchJson(next, redirectsLeft - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("La liga respondió con estado " + res.statusCode));
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("La liga devolvió una respuesta que no se pudo interpretar."));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Se agotó el tiempo de espera contactando a la liga."));
    });
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const json = await fetchJson(POSITIONS_URL);
    const teams = json && Array.isArray(json.teams) ? json.teams : null;
    if (!teams || teams.length === 0) {
      res.status(502).json({ error: "La liga no devolvió ningún equipo en la tabla de posiciones." });
      return;
    }
    const rows = teams
      .map((t) => ({
        pos: Number(t.position) || 0,
        team: String(t.name || "").trim(),
        pts: Number(t.points) || 0,
        pj: Number(t.matches_played) || 0,
        pg: Number(t.matches_won) || 0,
        pe: Number(t.matches_drawn) || 0,
        pp: Number(t.matches_lost) || 0,
        gf: Number(t.goals_for) || 0,
        gc: Number(t.goals_against) || 0,
        dg:
          t.goals_difference !== undefined
            ? Number(t.goals_difference) || 0
            : (Number(t.goals_for) || 0) - (Number(t.goals_against) || 0),
      }))
      .sort((a, b) => a.pos - b.pos);
    res.status(200).json({ rows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: (err && err.message) || "Error desconocido consultando la liga." });
  }
};
