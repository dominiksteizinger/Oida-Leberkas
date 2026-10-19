// Wortfilter vor dem Posten: Leberkäse und Semmel kommen in Text, Caption und Hashtags nicht vor (Dominik, 19.10.2026, regeln.md).
// Erlaubt bleibt das Bild (Easter Egg), deshalb wird `bild` nicht geprüft. Gilt für den gesamten Eintrag, auch für Namen wie `von` im Chat.
export const VERBOTEN = /leberk|lebakas|semmel|🥖/i;

const SKIP = new Set(["bild", "slot", "ab", "bis", "mechanik", "musik", "quelle", "id", "datum", "trend"]);

function texte(wert, pfad, aus) {
  if (typeof wert === "string") aus.push([pfad, wert]);
  else if (Array.isArray(wert)) wert.forEach((w, i) => texte(w, `${pfad}[${i}]`, aus));
  else if (wert && typeof wert === "object") for (const [k, w] of Object.entries(wert)) if (!SKIP.has(k)) texte(w, pfad ? `${pfad}.${k}` : k, aus);
  return aus;
}

// Gibt die Fundstellen zurück: [{ feld, wort }]. Leer = sauber.
export function wortfilter(eintrag) {
  const treffer = [];
  for (const [feld, text] of texte(eintrag, "", [])) {
    const m = text.match(VERBOTEN);
    if (m) treffer.push({ feld, wort: m[0] });
  }
  return treffer;
}

export function pruefeWortfilter(eintrag) {
  const t = wortfilter(eintrag);
  if (t.length) throw new Error(`Verbotenes Wort (Leberkäse/Semmel nur im Bild, nie im Text): ${t.map((x) => `„${x.wort}“ in ${x.feld}`).join(", ")}`);
}
