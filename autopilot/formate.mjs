// HTML-Vorlagen der Post-Formate (1080x1350). Jede Vorlage kennt zwei Stufen:
// "a" zeigt nur das Setup, "b" den ganzen Post. Das Reel schneidet von a auf b, die Pause dazwischen trägt den Deadpan.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const SARG = (voll) => `<svg width="62" height="86" viewBox="0 0 62 86"><path d="M18 2h26l16 22-10 60H12L2 24z" fill="${voll ? "#FF4FA3" : "none"}" stroke="#FF4FA3" stroke-width="4"/><path d="M31 22v34M21 34h20" stroke="#120A10" stroke-width="5"/></svg>`;

function seite(css, inhalt, { schrift, handle, hell }) {
  const fonts = [["400", "Regular"], ["500", "Medium"], ["600", "SemiBold"], ["700", "Bold"], ["800", "ExtraBold"]]
    .map(([w, n]) => `@font-face{font-family:I;font-weight:${w};src:url(${schrift(`Inter-${n}.otf`)})}`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
html,body{margin:0}
.f{width:1080px;height:1350px;box-sizing:border-box;position:relative;overflow:hidden;font-family:I,sans-serif}
.handle{position:absolute;left:70px;bottom:70px;font:700 30px I;color:${hell ? "#120A10" : "rgba(255,255,255,.75)"}}
.handle b{color:#FF4FA3}
${css}</style></head><body><div class="f">${inhalt}<div class="handle">@<b>${esc(handle.split(".")[0])}</b>${esc(handle.slice(handle.split(".")[0].length))}</div></div></body></html>`;
}

function antwort(i, o) {
  const hell = o.hell;
  const css = `${hell ? ".f{background:#efe7ec}.fig{position:absolute;bottom:-30px;right:-40px;height:1140px;mix-blend-mode:multiply}" : ".f{background:#000}.fig{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}"}
.reply{position:absolute;top:110px;left:70px;width:680px;background:#fff;border-radius:22px;padding:26px 30px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.reply small{display:block;font:500 25px I;color:#8a8a8a;margin-bottom:10px}.reply p{margin:0;font:600 36px/1.25 I;color:#161616}
.boxen{position:absolute;left:70px;right:70px;top:${i.zeilen.length > 2 ? 820 : 760}px;display:flex;flex-direction:column;align-items:flex-start;gap:16px}
.box{font:800 52px/1.2 I;color:#fff;background:#120A10;border-radius:14px;padding:12px 22px}`;
  const zeilen = o.stufe === "a" ? "" : `<div class="boxen">${i.zeilen.map((z) => `<div class="box">${esc(z)}</div>`).join("")}</div>`;
  return seite(css, `<img class="fig" src="${o.bild}"><div class="reply"><small>Antwort auf den Kommentar von ${esc(i.von)}</small><p>${esc(i.kommentar)}</p></div>${zeilen}`, o);
}

function notiz(i, o) {
  const css = `.f{background:#000;color:#fff;padding:90px 80px}.top{display:flex;justify-content:space-between;font:500 38px I;color:#E8B23A}
.dat{text-align:center;font:500 27px I;color:#8d8d92;margin:70px 0 40px}h1{font:800 72px I;margin:0 0 34px}
p{font:400 44px/1.4 I;margin:0 0 28px;color:#f2f2f2}.st{position:absolute;right:70px;bottom:60px;width:260px;border-radius:50%;transform:rotate(-8deg)}`;
  const absaetze = o.stufe === "a" ? i.absaetze.slice(0, -1) : i.absaetze;
  return seite(css, `<div class="top"><span>‹ Notizen</span><span>Fertig</span></div><div class="dat">${esc(o.zeitstempel)}</div><h1>${esc(i.titel)}</h1>${absaetze.map((a) => `<p>${esc(a)}</p>`).join("")}<img class="st" src="${o.gesicht}">`, o);
}

function bewertung(i, o) {
  const css = `.f{background:#0b0b10}.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.55)}
.lab{position:absolute;top:90px;left:70px;font:800 34px I;letter-spacing:.12em;color:#fff;background:#FF4FA3;padding:10px 20px;border-radius:10px}
.card{position:absolute;left:60px;right:60px;bottom:170px;background:#1f1f24;border-radius:30px;padding:44px 48px;color:#e8e8ec;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.kopf{display:flex;gap:24px;align-items:center}.kopf img{width:104px;height:104px;border-radius:50%;background:#2d2430}
.kopf b{font:700 40px I;display:block}.kopf span{font:400 28px I;color:#9a9aa3}.ort{font:600 32px I;color:#FF9ACB;margin:30px 0 14px}
.saerge{display:flex;gap:14px;align-items:center;margin-bottom:24px}.saerge span{font:400 28px I;color:#9a9aa3;margin-left:14px}p{font:400 42px/1.38 I;margin:0}`;
  const saerge = Array.from({ length: 5 }, (_, n) => SARG(n < i.saerge)).join("");
  const rest = o.stufe === "a" ? "" : `<div class="saerge">${saerge}<span>vor 2 Stunden</span></div><p>${esc(i.text)}</p>`;
  return seite(css, `<img class="bg" src="${o.bild}"><div class="lab">SARG-BEWERTUNG #${i.nr}</div><div class="card"><div class="kopf"><img src="${o.gesicht}"><div><b>Resi Requiem</b><span>Local Guide · ${i.nr + 24} Rezensionen</span></div></div><div class="ort">${esc(i.ort)}</div>${rest}</div>`, o);
}

function chat(i, o) {
  const css = `.f{background:#0b0b0d;color:#fff}.kopfz{display:flex;align-items:center;gap:22px;padding:70px 60px 34px;border-bottom:1px solid #222}
.kopfz .av{width:90px;height:90px;border-radius:50%;background:#FFD7E8;display:flex;align-items:center;justify-content:center;font:800 40px I;color:#c2185b}
.kopfz b{font:700 40px I;display:block}.kopfz span{font:400 26px I;color:#8d8d92}
.verlauf{padding:50px 60px;display:flex;flex-direction:column;gap:22px}
.m{max-width:720px;font:500 42px/1.3 I;padding:22px 30px;border-radius:34px}
.sie{align-self:flex-start;background:#26262b;border-bottom-left-radius:10px}.ich{align-self:flex-end;background:#FF4FA3;color:#120A10;border-bottom-right-radius:10px;font-weight:600}
.zeit{align-self:center;font:500 26px I;color:#6d6d72;margin:10px 0}`;
  let n = i.nachrichten;
  if (o.stufe === "a") {
    // Setup: alles bis zu Resis letzter Antwort, die kommt erst nach der Pause
    let ende = n.length;
    while (ende > 1 && n[ende - 1].wer === "ich") ende--;
    if (ende < n.length) n = n.slice(0, ende);
  }
  const blasen = n.map((m) => (m.wer === "zeit" ? `<div class="zeit">${esc(m.text)}</div>` : `<div class="m ${m.wer}">${esc(m.text)}</div>`)).join("");
  return seite(css, `<div class="kopfz"><div class="av">${esc(i.name[0])}</div><div><b>${esc(i.name)}</b><span>online</span></div></div><div class="verlauf">${blasen}</div>`, o);
}

function szene(i, o) {
  const g = o.hell ? "#efe7ec" : "#0d0a0d";
  const css = `.f{background:${g};color:${o.hell ? "#120A10" : "#fff"}}.bild{position:absolute;top:0;left:0;width:1080px;height:800px;object-fit:cover;object-position:50% ${o.hell ? "25%" : "50%"}}
.verlauf{position:absolute;top:560px;left:0;right:0;height:240px;background:linear-gradient(transparent,${g})}
.t{position:absolute;left:80px;right:80px;top:820px}.t p{margin:0 0 30px;font:800 54px/1.22 I}.k{font:600 44px/1.3 I;color:${o.hell ? "#E0337F" : "#FF4FA3"};margin:0 0 10px}`;
  const klammern = o.stufe === "a" ? "" : i.klammern.map((k) => `<div class="k">[${esc(k)}]</div>`).join("");
  return seite(css, `<img class="bild" src="${o.bild}"><div class="verlauf"></div><div class="t"><p>${esc(i.satz)}</p>${klammern}</div>`, o);
}

export const FORMATE = { antwort, notiz, bewertung, chat, szene };
// Formate ohne Bild aus der Bibliothek
export const OHNE_BILD = new Set(["notiz", "chat"]);
