// Prüft, wann der Instagram-Token abläuft. Gibt die Resttage aus (GITHUB_OUTPUT: tage=<n>, leer = läuft nicht ab).
// Bricht nie den Lauf ab: Wenn die Abfrage scheitert, steht das nur im Log.
import fs from "node:fs";

const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ausgabe = (zeilen) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, zeilen);

try {
  if (!TOKEN) throw new Error("INSTAGRAM_ACCESS_TOKEN fehlt");
  const res = await fetch(`https://graph.facebook.com/debug_token?${new URLSearchParams({ input_token: TOKEN, access_token: TOKEN })}`);
  const d = (await res.json()).data;
  if (!d) throw new Error(`debug_token: ${res.status}`);
  if (!d.is_valid) {
    console.log("Token ist ungültig.");
    ausgabe("tage=0\n");
  } else if (!d.expires_at) {
    console.log("Token läuft nicht ab.");
  } else {
    const tage = Math.floor((d.expires_at * 1000 - Date.now()) / 86400000);
    console.log(`Token läuft in ${tage} Tagen ab (${new Date(d.expires_at * 1000).toISOString().slice(0, 10)}).`);
    ausgabe(`tage=${tage}\n`);
  }
} catch (err) {
  console.log(`Token-Prüfung übersprungen: ${err.message}`);
}
