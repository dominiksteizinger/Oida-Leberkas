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
  const klammern = o.stufe === "a" ? "" : i.klammern.map((k) => `<div class="k">${esc(k)}</div>`).join("");
  return seite(css, `<img class="bild" src="${o.bild}"><div class="verlauf"></div><div class="t"><p>${esc(i.satz)}</p>${klammern}</div>`, o);
}

// Handy-Oberflächen über dem Bild (Dominik 19.10.2026). Das Bild bleibt hell und sichtbar,
// die Karte sitzt unten oder seitlich und verdeckt nie das Gesicht.
const UI = `.f{background:#120A10;color:#fff}.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.fade{position:absolute;left:0;right:0;bottom:0;height:300px;background:linear-gradient(transparent,rgba(18,10,16,.8))}
.lab{position:absolute;top:90px;left:70px;z-index:3;font:700 36px I;letter-spacing:.14em;color:#fff;background:#FF4FA3;padding:12px 18px;border-radius:10px}
.card{position:absolute;z-index:3;background:rgba(31,29,34,.95);border-radius:28px;box-shadow:0 10px 40px rgba(0,0,0,.55)}
.unten{left:90px;right:90px;bottom:150px;padding:30px 36px}.schmal{left:150px;right:150px;bottom:170px;padding:32px 36px}
.pink{color:#FF8FC7}.lav{color:#B9A3FF}.grau{color:#a9a3b0}`;
const ui = (o, label, inhalt, css = "") => seite(UI + css, `<img class="bg" src="${o.bild}"><div class="fade"></div><div class="lab">${esc(label)}</div>${inhalt}`, o);
const b = (o) => o.stufe !== "a"; // ganzer Post statt nur Setup

function mitteilungen(i, o) {
  const css = `.stapel{position:absolute;z-index:3;left:90px;right:90px;bottom:140px}
.n{background:rgba(42,39,48,.96);border-radius:24px;padding:20px 24px;margin-bottom:12px}.n .k{display:flex;justify-content:space-between;font:500 22px I;color:#a9a3b0}
.n .k b{color:#FF8FC7;letter-spacing:.06em}.n .t{font:700 30px I;margin-top:6px}.n p{margin:2px 0 0;font:400 28px/1.3 I;color:#ddd}`;
  const liste = b(o) ? i.mitteilungen : i.mitteilungen.slice(0, -1);
  return ui(o, "MITTEILUNGEN", `<div class="stapel">${liste.map((m) => `<div class="n"><div class="k"><b>${esc(m.app.toUpperCase())}</b><span>${esc(m.zeit)}</span></div><div class="t">${esc(m.titel)}</div><p>${esc(m.text)}</p></div>`).join("")}</div>`, css);
}

function termin(i, o) {
  const css = `.card{border-left:12px solid #FF4FA3}.d{font:400 26px I;color:#a9a3b0}.t{font:700 52px I;margin:6px 0 4px}.z{font:600 32px I;color:#FF8FC7}
.zeilen{margin-top:22px;font:400 28px/1.6 I;color:#ddd}`;
  const zeilen = b(o) ? `<div class="zeilen">${i.zeilen.map((z) => esc(z)).join("<br>")}</div>` : "";
  return ui(o, "TERMIN", `<div class="card unten"><div class="d">${esc(i.datum)}</div><div class="t">${esc(i.titel)}</div><div class="z">${esc(i.zeit)}</div>${zeilen}</div>`, css);
}

function wetter(i, o) {
  const css = `.w{left:70px;top:180px;width:360px;padding:30px;background:linear-gradient(160deg,rgba(58,47,82,.95),rgba(31,29,34,.95))}
.o{font:600 30px I}.g{font:300 120px/1.05 I}.l{font:600 30px I}.gf{font:600 30px I;color:#FF8FC7;margin-top:8px}.z{font:400 22px I;color:#a9a3b0;margin-top:14px}`;
  const pointe = b(o) ? `<div class="gf">Gefühlt: ${esc(i.gefuehlt)}</div>` : "";
  return ui(o, "WETTER", `<div class="card w"><div class="o">${esc(i.ort)}</div><div class="g">${esc(i.temperatur)}</div><div class="l">${esc(i.lage)}</div>${pointe}<div class="z">${esc(i.zusatz)}</div></div>`, css);
}

function umfrage(i, o) {
  const css = `.q{font:700 40px I;text-align:center}.opt{position:relative;background:rgba(255,255,255,.13);border-radius:18px;height:72px;margin-top:14px;overflow:hidden}
.opt i{position:absolute;inset:0;background:rgba(185,163,255,.55)}.opt.top i{background:#FF4FA3}
.opt div{position:relative;display:flex;justify-content:space-between;align-items:center;height:72px;padding:0 24px;font:700 32px I}.opt.top div{color:#120A10}
.fuss{font:400 22px I;color:#a9a3b0;text-align:center;margin-top:16px}`;
  const max = Math.max(...i.optionen.map((x) => x.prozent));
  const opt = i.optionen.map((x) => b(o)
    ? `<div class="opt${x.prozent === max ? " top" : ""}"><i style="width:${x.prozent}%"></i><div><span>${esc(x.text)}</span><span>${x.prozent} %</span></div></div>`
    : `<div class="opt"><div><span>${esc(x.text)}</span></div></div>`).join("");
  return ui(o, "UMFRAGE", `<div class="card schmal"><div class="q">${esc(i.frage)}</div>${opt}${b(o) ? `<div class="fuss">${esc(i.fuss)}</div>` : ""}</div>`, css);
}

function wiedergabe(i, o) {
  const css = `.zeile{display:flex;gap:24px;align-items:center}.cover{width:120px;height:120px;border-radius:16px;flex:none;background:linear-gradient(135deg,#3a2f52,#FF4FA3)}
.k{font:600 22px I;letter-spacing:.1em;color:#a9a3b0}.t{font:700 34px/1.2 I;margin-top:4px}.a{font:400 26px I;color:#B9A3FF;margin-top:4px}
.bar{height:8px;background:rgba(255,255,255,.13);border-radius:4px;margin-top:26px}.bar i{display:block;height:8px;background:#FF4FA3;border-radius:4px}
.zeit{display:flex;justify-content:space-between;font:400 22px I;color:#a9a3b0;margin-top:8px}.knoepfe{display:flex;justify-content:center;gap:70px;font-size:40px;margin-top:6px}`;
  const titel = b(o) ? `<div class="t">${esc(i.titel)}</div><div class="a">${esc(i.kuenstler)}</div>` : `<div class="t">…</div>`;
  return ui(o, "WIEDERGABE", `<div class="card unten"><div class="zeile"><div class="cover"></div><div><div class="k">GERADE LÄUFT</div>${titel}</div></div>
<div class="bar"><i style="width:${i.fortschritt}%"></i></div><div class="zeit"><span>${esc(i.position)}</span><span>${esc(i.dauer)}</span></div><div class="knoepfe"><span>⏮</span><span class="pink">⏸</span><span>⏭</span></div></div>`, css);
}

// Wellenform aus festen Höhen, damit derselbe Post immer gleich aussieht
const welle = (n, farbe, saat) => Array.from({ length: n }, (_, k) => `<span style="display:inline-block;width:6px;margin-right:4px;border-radius:3px;background:${farbe};height:${Math.round(10 + 34 * Math.abs(Math.sin(k * 1.7 + saat) * Math.cos(k * 0.45)))}px"></span>`).join("");

function sprachnachricht(i, o) {
  const css = `.sp{position:absolute;z-index:3;left:90px;right:90px;bottom:150px}.von{font:400 24px I;color:#a9a3b0;margin-bottom:8px}
.m{display:flex;align-items:center;gap:18px;padding:20px 26px;font:500 24px I}.m .w{display:flex;align-items:center;height:48px}.m .p{font-size:34px}
.sie{background:rgba(58,54,66,.96);border-radius:28px 28px 28px 8px;width:82%}.ich{background:#FF4FA3;color:#120A10;border-radius:28px 28px 8px 28px;width:42%;margin:22px 0 0 auto;font-weight:700}
.tr{text-align:right;font:italic 400 28px I;color:#FF8FC7;margin-top:10px}`;
  const antwort = b(o) ? `<div class="m ich"><span class="p">▶</span><span class="w">${welle(5, "#120A10", 2)}</span><span>${esc(i.dauer_ich)}</span></div><div class="tr">Transkript: „${esc(i.transkript)}“</div>` : "";
  return ui(o, "SPRACHNACHRICHT", `<div class="sp"><div class="von">${esc(i.name)}</div><div class="m sie"><span class="p">▶</span><span class="w">${welle(38, "#B9A3FF", 1)}</span><span>${esc(i.dauer_sie)}</span></div>${antwort}</div>`, css);
}

function suchverlauf(i, o) {
  const css = `.feld{background:rgba(255,255,255,.08);border-radius:40px;padding:16px 26px;font:400 32px I;margin-bottom:12px}
.v{display:flex;gap:20px;align-items:center;padding:14px 0;border-top:2px solid rgba(255,255,255,.08);font:400 30px I}.v b{font-weight:700}`;
  const vorschlaege = b(o) ? i.vorschlaege.map((v) => `<div class="v"><span class="grau">🕓</span><span>${esc(i.eingabe)} <b>${esc(v)}</b></span></div>`).join("") : "";
  return ui(o, "SUCHVERLAUF", `<div class="card unten"><div class="feld">🔍 ${esc(i.eingabe)}<span class="pink">|</span></div>${vorschlaege}</div>`, css);
}

function fehlermeldung(i, o) {
  const css = `.card{text-align:center;background:rgba(38,35,41,.96)}.t{font:700 38px I}.x{font:400 29px/1.4 I;margin-top:12px;color:#ddd}
.kn{display:flex;gap:14px;margin-top:26px}.kn div{flex:1;padding:16px;border-radius:16px;font:600 26px I;background:rgba(255,255,255,.1)}.kn .ja{background:#FF4FA3;color:#120A10;font-weight:700}`;
  const knoepfe = b(o) ? `<div class="kn"><div>${esc(i.knopf_links)}</div><div class="ja">${esc(i.knopf_rechts)}</div></div>` : "";
  return ui(o, "SYSTEM", `<div class="card schmal"><div class="t">${esc(i.titel)}</div><div class="x">${esc(i.text)}</div>${knoepfe}</div>`, css);
}

function todo(i, o) {
  const css = `.t{font:700 40px I;margin-bottom:10px}.p{display:flex;gap:22px;align-items:center;padding:13px 0;border-top:2px solid rgba(255,255,255,.08);font:400 34px I}
.p svg{width:34px;height:47px;flex:none}.p.ok span{color:#8d8794;text-decoration:line-through}.fz{font:600 30px I;color:#FF8FC7;margin-top:14px}`;
  const punkte = i.punkte.map((p) => `<div class="p${p.erledigt ? " ok" : ""}">${SARG(p.erledigt)}<span>${esc(p.text)}</span></div>`).join("");
  return ui(o, "TO-DO", `<div class="card unten"><div class="t">${esc(i.titel)}</div>${punkte}${b(o) ? `<div class="fz">${esc(i.fazit)}</div>` : ""}</div>`, css);
}

function beleg(i, o) {
  const css = `.bon{left:60px;top:190px;width:400px;padding:30px;border-radius:14px;font-family:"DejaVu Sans Mono",monospace}
.h{text-align:center;font-size:30px;font-weight:700;letter-spacing:3px}.u{text-align:center;font-size:20px;color:#a9a3b0;margin:4px 0 16px}
.l{border-top:2px dashed rgba(255,255,255,.25);padding-top:12px}.r{display:flex;justify-content:space-between;font-size:27px;padding:5px 0}
.s{border-top:2px dashed rgba(255,255,255,.25);margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;font-size:30px;font-weight:700;color:#FF8FC7}
.d{text-align:center;font-size:20px;color:#a9a3b0;margin-top:18px;line-height:1.4}`;
  const ende = b(o) ? `<div class="s"><span>SUMME</span><span>${esc(i.summe)}</span></div><div class="d">${esc(i.fuss)}</div>` : "";
  return ui(o, "BELEG", `<div class="card bon"><div class="h">${esc(i.titel.toUpperCase())}</div><div class="u">${esc(i.untertitel)}</div><div class="l">${i.posten.map((p) => `<div class="r"><span>${esc(p.name)}</span><span>${esc(p.menge)}</span></div>`).join("")}</div>${ende}</div>`, css);
}

// Bausteine für die Formate 11–30
const knopf = (t, an) => `<div class="kn${an ? " an" : ""}">${esc(t)}</div>`;
const zeile = (a, w, farbe = "#fff") => `<div class="ze"><span>${esc(a)}</span><span style="color:${farbe};font-weight:600">${esc(w)}</span></div>`;
const BAU = `.kne{display:flex;gap:12px;margin-top:22px}.kn{flex:1;text-align:center;padding:15px;border-radius:14px;font:600 26px I;background:rgba(255,255,255,.1)}
.kn.an{background:#FF4FA3;color:#120A10;font-weight:700}.ze{display:flex;justify-content:space-between;font:400 29px I;padding:12px 0;border-top:2px solid rgba(255,255,255,.08)}
.tt{font:700 36px I}.ut{font:400 24px I;color:#a9a3b0}.fz{font:600 28px/1.35 I;color:#FF8FC7;margin-top:14px}.mitte{text-align:center}`;
const karte = (o, label, klasse, inhalt, css = "") => ui(o, label, `<div class="card ${klasse}">${inhalt}</div>`, BAU + css);
const ohneLetzte = (o, liste) => (b(o) ? liste : liste.slice(0, -1));

function storyfrage(i, o) {
  const css = `.sf{position:absolute;z-index:3;left:150px;right:150px;bottom:170px;border-radius:30px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.55);text-align:center}
.sf .k{background:linear-gradient(90deg,#FF4FA3,#B9A3FF);padding:26px 30px;font:700 30px I;color:#120A10}.sf .q{background:#fff;color:#120A10;padding:30px;font:600 38px/1.3 I}
.ant{position:absolute;z-index:3;left:90px;right:90px;bottom:560px;font:800 46px/1.25 I}.ant span{background:#120A10;padding:6px 16px;border-radius:12px;box-decoration-break:clone;-webkit-box-decoration-break:clone}`;
  const antwort = b(o) ? `<div class="ant"><span>${esc(i.antwort)}</span></div>` : "";
  return ui(o, "FRAGEN", `<div class="sf"><div class="k">Stell mir eine Frage</div><div class="q">${esc(i.frage)}</div></div>${antwort}`, css);
}

function aktivitaet(i, o) {
  const farben = ["#FF4FA3", "#B9A3FF", "#8be0ff"];
  const ring = (r, c, p) => `<circle cx="110" cy="110" r="${r}" fill="none" stroke="${c}33" stroke-width="22"/><circle cx="110" cy="110" r="${r}" fill="none" stroke="${c}" stroke-width="22" stroke-linecap="round" stroke-dasharray="${(6.283 * r * Math.max(p, 1)) / 100} 999" transform="rotate(-90 110 110)"/>`;
  const ringe = i.ringe.map((x, n) => ring(95 - n * 29, farben[n], x.prozent)).join("");
  const werte = i.ringe.map((x, n) => `<div><b style="color:${farben[n]}">${esc(x.name)}</b> ${esc(x.wert)}</div>`).join("");
  return karte(o, "AKTIVITÄT", "unten", `<div style="display:flex;gap:34px;align-items:center"><svg width="220" height="220">${ringe}</svg><div style="font:400 30px/1.55 I">${werte}</div></div>${b(o) ? `<div class="fz" style="color:#fff">${esc(i.fazit)}</div>` : ""}`);
}

function akku(i, o) {
  const css = `.bat{width:150px;height:72px;border:5px solid #fff;border-radius:16px;position:relative;padding:6px;flex:none}.bat i{display:block;height:100%;background:#ff4f5e;border-radius:6px}
.bat:after{content:"";position:absolute;right:-16px;top:20px;width:10px;height:22px;background:#fff;border-radius:0 4px 4px 0}.tx{font:400 30px/1.4 I;margin-top:20px;color:#ddd}`;
  const knoepfe = b(o) ? `<div class="kne">${knopf(i.knopf_links)}${knopf(i.knopf_rechts, true)}</div>` : "";
  return karte(o, "AKKU", "unten", `<div style="display:flex;align-items:center;gap:24px"><div class="bat"><i style="width:${Math.max(i.prozent, 3)}%"></i></div><div><div class="tt">${esc(i.name)}: ${i.prozent} %</div><div class="ut">Stromsparmodus aktiv</div></div></div><div class="tx">${esc(i.text)}</div>${knoepfe}`, css);
}

function abwesenheit(i, o) {
  const zeilen = ohneLetzte(o, i.zeilen).map((z) => esc(z)).join("<br>");
  return karte(o, "AUTOMATISCHE ANTWORT", "unten", `<div style="display:flex;justify-content:space-between" class="ut"><span>Von: Resi Requiem</span><span>08:00</span></div>
<div class="tt" style="margin:10px 0 14px">Abwesend: ${esc(i.betreff)}</div><div style="font:400 31px/1.45 I;color:#e6e6e6">${zeilen}</div>${b(o) ? `<div class="fz">${esc(i.gruss)}</div>` : ""}`);
}

function sendung(i, o) {
  const schritt = (s, letzter) => `<div style="display:flex;gap:20px"><div style="display:flex;flex-direction:column;align-items:center"><div style="width:26px;height:26px;border-radius:50%;background:${s.erledigt ? "#FF4FA3" : "#3a3642"};border:4px solid #1f1d22;box-shadow:0 0 0 3px ${s.erledigt ? "#FF4FA3" : "#3a3642"}"></div>${letzter ? "" : `<div style="width:4px;flex:1;background:#3a3642;min-height:40px"></div>`}</div>
<div style="padding-bottom:16px"><div style="font:${s.erledigt ? 700 : 500} 30px I;color:${s.erledigt ? "#fff" : "#8d8794"}">${esc(s.text)}</div><div class="ut" style="font-size:22px">${esc(s.zeit)}</div></div></div>`;
  const schritte = ohneLetzte(o, i.schritte);
  return karte(o, "SENDUNG", "unten", `<div class="ut">Sendung ${esc(i.nummer)}</div><div class="tt" style="margin:4px 0 20px">${esc(i.titel)}</div>${schritte.map((s, n) => schritt(s, n === schritte.length - 1)).join("")}`);
}

function horoskop(i, o) {
  const werte = i.werte.map((w) => `<span>${esc(w.name)} ${"✝".repeat(w.saerge)}<span style="opacity:.3">${"✝".repeat(5 - w.saerge)}</span></span>`).join("");
  const text = b(o) ? `<div style="font:700 38px/1.3 I;margin:16px 0">${esc(i.text)}</div>` : `<div style="height:20px"></div>`;
  return karte(o, "HOROSKOP", "unten mitte", `<div style="font:64px 'DejaVu Sans',sans-serif;color:#B9A3FF">${esc(i.symbol)}&#xFE0E;</div><div style="font:700 26px I;letter-spacing:.15em;color:#B9A3FF">${esc(i.zeichen.toUpperCase())} · HEUTE</div>${text}<div style="display:flex;justify-content:space-around;font:400 24px I;margin-top:10px" class="grau">${werte}</div>`);
}

function uebersetzer(i, o) {
  const css = `.box{border-radius:18px;padding:22px 24px}.von{background:rgba(255,255,255,.06);font:400 34px I}.nach{background:#FF4FA3;color:#120A10;font:800 40px I;margin-top:14px}`;
  const nach = b(o) ? `<div class="box nach">„${esc(i.uebersetzung)}“</div><div class="ut" style="font-size:22px;margin-top:12px;text-align:right">Übersetzung sicher · 100 %</div>` : "";
  return karte(o, "ÜBERSETZER", "unten", `<div style="display:flex;justify-content:space-between;font:700 26px I;margin-bottom:18px"><span>${esc(i.von)}</span><span class="pink">⇄</span><span class="pink">${esc(i.nach)}</span></div><div class="box von">„${esc(i.original)}“</div>${nach}`, css);
}

function ladebalken(i, o) {
  return karte(o, "LÄDT", "schmal", `<div class="tt">${esc(i.titel)}</div><div style="height:20px;background:rgba(255,255,255,.12);border-radius:10px;margin:24px 0 12px;overflow:hidden"><div style="width:${i.prozent}%;height:100%;background:linear-gradient(90deg,#FF4FA3,#B9A3FF)"></div></div>
<div style="display:flex;justify-content:space-between;font:400 26px I" class="grau"><span>${i.prozent} %</span><span>${esc(i.rest)}</span></div>${b(o) ? `<div class="fz">${esc(i.fuss)}</div>` : ""}`);
}

function navigation(i, o) {
  return karte(o, "ROUTE", "unten", `<div style="display:flex;gap:24px;align-items:center"><div style="font-size:70px;line-height:1" class="pink">↰</div><div><div style="font:800 44px I">${esc(i.anweisung)}</div>${b(o) ? `<div class="ut" style="font-size:26px">${esc(i.detail)}</div>` : ""}</div></div>
<div style="display:flex;justify-content:space-between;border-top:2px solid rgba(255,255,255,.08);margin-top:22px;padding-top:18px;font:400 28px I"><span><b>${esc(i.ankunft)}</b> Ankunft</span><span class="lav">${esc(i.info)}</span></div>`);
}

function passwort(i, o) {
  const regel = (r) => `<div style="display:flex;gap:16px;font:400 28px I;padding:6px 0;color:${r.erfuellt ? "#9be7a8" : "#ff7a86"}"><span>${r.erfuellt ? "✓" : "✕"}</span><span>${esc(r.text)}</span></div>`;
  return karte(o, "NEUES PASSWORT", "unten", `<div style="font:700 32px I;margin-bottom:14px">Passwort festlegen</div><div style="background:rgba(255,255,255,.07);border:2px solid ${b(o) ? "#ff7a86" : "#B9A3FF"};border-radius:14px;padding:16px 20px;font:400 34px I;letter-spacing:6px">••••••••••</div>
<div style="margin-top:14px">${ohneLetzte(o, i.regeln).map(regel).join("")}</div>`);
}

function notfallkontakt(i, o) {
  const farben = ["#a9a3b0", "#B9A3FF", "#FF8FC7", "#FF8FC7"];
  return karte(o, "NOTFALLKONTAKT", "unten", `<div style="display:flex;gap:22px;align-items:center;margin-bottom:12px"><div style="width:90px;height:90px;border-radius:50%;background:#3a2f52;display:flex;align-items:center;justify-content:center;font-size:48px">${esc(i.symbol)}</div><div><div style="font:700 38px I">${esc(i.name)}</div><div class="ut">${esc(i.untertitel)}</div></div></div>
${ohneLetzte(o, i.zeilen).map((z, n) => zeile(z.name, z.wert, farben[n])).join("")}`);
}

function fokus(i, o) {
  return karte(o, "FOKUS", "schmal", `<div style="display:flex;gap:20px;align-items:center"><div style="font-size:54px">🌙</div><div><div class="tt">${esc(i.titel)}</div><div class="lav" style="font:400 26px I">${esc(i.status)}</div></div></div>
<div style="font:400 29px/1.45 I;margin-top:18px;color:#ddd">${esc(i.text)}</div>${b(o) ? `<div style="font:400 29px I;margin-top:12px"><span class="grau">Ausnahmen:</span> <b class="pink">${esc(i.ausnahmen)}</b></div>` : ""}`);
}

function gruppe(i, o) {
  const letzte = i.knoepfe.length - 1;
  return karte(o, "GRUPPE", "unten", `<div class="tt">${esc(i.name)}</div><div class="ut" style="margin-bottom:16px">${esc(i.neu)}</div><div style="font:400 28px I;margin-bottom:8px">${esc(i.frage)}</div>
<div class="kne" style="margin-top:0">${i.knoepfe.map((k, n) => knopf(k, b(o) && n === letzte)).join("")}</div>`);
}

function speicher(i, o) {
  const farben = ["#FF4FA3", "#B9A3FF", "#8be0ff", "#9be7a8", "#FFD27A"];
  const posten = ohneLetzte(o, i.posten).map((p, n) => `<div style="margin-top:14px"><div style="display:flex;justify-content:space-between;font:400 27px I"><span>${esc(p.name)}</span><span class="grau">${esc(p.groesse)}</span></div>
<div style="height:12px;background:rgba(255,255,255,.08);border-radius:6px;margin-top:6px"><div style="width:${Math.max(p.prozent, 1)}%;height:12px;border-radius:6px;background:${farben[n]}"></div></div></div>`).join("");
  return karte(o, "SPEICHER", "unten", `<div class="tt">${esc(i.titel)}</div><div class="ut">${esc(i.belegt)}</div>${posten}`);
}

function timer(i, o) {
  return karte(o, "TIMER", "schmal mitte", `<div class="ut" style="font-size:26px;letter-spacing:.12em">${esc(i.label.toUpperCase())}</div><div style="font:300 110px/1.1 I;letter-spacing:2px;font-variant-numeric:tabular-nums">${esc(i.zeit)}</div>${b(o) ? `<div class="fz">${esc(i.fuss)}</div>` : ""}`);
}

function konto(i, o) {
  const umsaetze = i.umsaetze.map((u) => zeile(u.name, u.betrag, u.betrag.trim().startsWith("+") ? "#9be7a8" : "#ff7a86")).join("");
  return karte(o, "KONTO", "unten", `<div class="ut">Kontostand</div><div style="font:700 64px I;margin:4px 0 10px">${esc(i.stand)}</div>${umsaetze}${b(o) ? `<div class="fz">${esc(i.fuss)}</div>` : ""}`);
}

function einladung(i, o) {
  return karte(o, "EINLADUNG", "unten", `<div class="ut">${esc(i.von)} lädt dich ein</div><div style="font:700 38px I;margin:6px 0 2px">${esc(i.titel)}</div><div class="lav" style="font:400 27px I">${esc(i.details)}</div>
<div class="kne">${knopf("Zusagen")}${knopf("Vielleicht")}${knopf("Absagen", b(o))}</div>${b(o) ? `<div class="fz">Grund der Absage: ${esc(i.grund)}</div>` : ""}`);
}

function update(i, o) {
  const zeilen = i.zeilen.map((z) => `<b class="lav">${esc(z.name)}:</b> ${esc(z.wert)}`).join("<br>");
  return karte(o, "UPDATE", "schmal", `<div class="tt">${esc(i.titel)}</div><div style="font:400 27px/1.55 I;margin-top:14px;color:#ddd">${zeilen}</div>${b(o) ? `<div class="kne">${knopf(i.knopf_links)}${knopf(i.knopf_rechts, true)}</div>` : ""}`);
}

function serie(i, o) {
  return karte(o, "SERIE", "schmal mitte", `<div style="font-size:84px;line-height:1">🔥</div><div style="font:800 72px I;margin-top:4px">${esc(i.zahl)}</div><div style="font:600 30px I;margin-top:6px">${esc(i.text)}</div>${b(o) ? `<div class="fz">${esc(i.fuss)}</div>` : ""}`);
}

function captcha(i, o) {
  const css = `.cap{left:260px;right:260px;bottom:150px;padding:0;overflow:hidden}.cap .k{background:#FF4FA3;color:#120A10;padding:20px 24px}
.raster{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:16px}.raster div{aspect-ratio:1;border-radius:10px;background:#3a3642;display:flex;align-items:center;justify-content:center;font-size:36px}`;
  const fuss = b(o) ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:0 20px 18px"><span class="grau" style="font:400 22px I">${esc(i.fuss)}</span><span style="background:#FF4FA3;color:#120A10;font:700 24px I;padding:10px 22px;border-radius:10px">${esc(i.knopf)}</span></div>` : "";
  return karte(o, "CAPTCHA", "cap", `<div class="k"><div style="font:400 22px I">Wähle alle Bilder mit</div><div style="font:800 36px I">${esc(i.aufgabe)}</div></div><div class="raster">${i.symbole.map((s) => `<div>${esc(s)}</div>`).join("")}</div>${fuss}`, css);
}

export const FORMATE = { antwort, notiz, bewertung, chat, szene, mitteilungen, termin, wetter, umfrage, wiedergabe, sprachnachricht, suchverlauf, fehlermeldung, todo, beleg,
  storyfrage, aktivitaet, akku, abwesenheit, sendung, horoskop, uebersetzer, ladebalken, navigation, passwort,
  notfallkontakt, fokus, gruppe, speicher, timer, konto, einladung, update, serie, captcha };
// Formate ohne Bild aus der Bibliothek
export const OHNE_BILD = new Set(["notiz", "chat"]);
