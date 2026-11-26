/* =========================================================
   v6.1 · Mejoras de usabilidad
   1. Ficha de insumo con Kardex corrido
   2. Conteo ágil (Enter, pendientes, ir al siguiente)
   3. Merma express (frecuentes y repetir)
   4. Filtros con contadores
   5. Novedades desde tu último ingreso
   ========================================================= */

/* ---------- 1. Ficha de insumo ---------- */
function itemSheet(sku){
  const it = item(sku), k = kardexRow(sku), P = DB.points[sku];
  const typeLbl = {compra:"Compra recibida", venta:"Ventas POS", cortesia:"Cortesías POS", merma:"Merma", faltante:"Faltante con cargo", salida:"Consumo", ajuste:"Ajuste de inventario"};
  // movimientos en orden de fecha con saldo corrido
  const movs = DB.movs.map((m, i) => ({m:m, i:i})).filter(x => x.m.sku === sku)
    .sort((a, b) => a.m.date < b.m.date ? -1 : a.m.date > b.m.date ? 1 : a.i - b.i);
  let run = k.initial;
  const rows = movs.map(x => { run = r4(run + x.m.qty); return {m:x.m, run:run}; });
  const pts = ["alm","bar","coc"].filter(pt => P[pt]).map(pt => {
    const st = pointStock(sku, pt), min = P[pt].min;
    const c = st < min ? "bad" : st < min + DB.settings.yellow * P[pt].daily ? "warn" : "ok";
    return '<div><span>' + POINTS[pt] + '</span><b>' + num(st) + ' ' + it.unit + '</b>' + chip(c, c === "bad" ? "Bajo mínimo" : c === "warn" ? "Por reponer" : "OK", semIcon(c)) + ' <span>mín. ' + num(min) + '</span></div>';
  }).join("");
  const lots = DB.lots.filter(l => l.sku === sku && l.left > 0.0001);
  const uses = DB.products.filter(p => p.lines.some(l => l.sku === sku)).map(p => {
    const l = p.lines.find(x => x.sku === sku); return esc(p.name) + ' (' + num(recipeUse(p, l), 0) + ' ' + it.baseUnit + ')';
  });
  let h = '<div class="sh-head"><div><h3>' + esc(it.name) + '</h3><p class="muted small" style="margin:4px 0 0">' + it.sku + ' · ' + esc(it.cat) + ' · ' + esc(equiv(it)) + ' · costo prom. ' + money(it.cost) + '</p></div><button class="btn sm ghost" data-act="sheet-close">Cerrar</button></div>';
  h += '<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="kpi"><span class="k">Saldo teórico</span><span class="v">' + num(k.saldo) + ' ' + it.unit + '</span><span class="s">' + (it.factor !== 1 ? num(k.saldo * it.factor, 0) + ' ' + it.baseUnit : "&nbsp;") + '</span></div>' +
    '<div class="kpi"><span class="k">Valor</span><span class="v">' + money(k.saldo * it.cost) + '</span><span class="s">sin IGV</span></div>' +
    '<div class="kpi"><span class="k">Movimiento del mes</span><span class="v">+' + num(k.ent) + ' / −' + num(k.sal) + '</span><span class="s">entradas / salidas</span></div></div>';
  h += '<div class="ptstock">' + pts + '</div>';
  if (uses.length) h += '<p class="small" style="margin:10px 0 0"><span class="muted">Se usa en:</span> ' + uses.join(" · ") + '</p>';
  if (lots.length) h += '<p class="small" style="margin:6px 0 0"><span class="muted">Lotes:</span> ' + lots.map(l => { const s = lotStatus(l); return esc(l.code) + ' · ' + num(l.left) + ' ' + it.unit + ' · vence ' + fdate(l.exp) + ' ' + chip(s.c, s.k); }).join(" &nbsp; ") + '</p>';
  h += '<h3 class="sec">Kardex del insumo</h3><div class="tw" style="max-height:340px;overflow:auto"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th class="n">Entrada</th><th class="n">Salida</th><th class="n">Saldo</th></tr></thead><tbody>' +
    '<tr><td class="num">01/11/2026</td><td class="muted">Saldo inicial</td><td class="n"></td><td class="n"></td><td class="n"><b>' + num(k.initial) + '</b></td></tr>' +
    rows.map(r => '<tr><td class="num">' + fdate(r.m.date) + '</td><td>' + esc(typeLbl[r.m.type] || r.m.type) + '<div class="muted small">' + esc(r.m.note) + ' · ' + esc(USERS[r.m.user] ? USERS[r.m.user].name : r.m.user) + '</div></td><td class="n">' + (r.m.qty > 0 ? num(r.m.qty) : "") + '</td><td class="n">' + (r.m.qty < 0 ? num(-r.m.qty) : "") + '</td><td class="n"><b>' + num(r.run) + '</b></td></tr>').join("") +
    '</tbody></table></div>';
  const acts = [];
  if (can(SESSION.role, "compras_solicitar")) acts.push('<button class="btn sm" data-act="item-buy" data-sku="' + sku + '">' + ic("plus") + 'Solicitar compra</button>');
  if (can(SESSION.role, "mermas_reportar")) acts.push('<button class="btn sm ghost" data-act="item-merma" data-sku="' + sku + '">Reportar merma</button>');
  if (acts.length) h += '<div class="row" style="margin-top:14px">' + acts.join("") + '</div>';
  return h;
}
ACT["item"] = (el) => { if (!need("costos", "ver la ficha del insumo")) return; openSheet(itemSheet(el.dataset.sku), null, true); };
ACT["item-buy"] = (el) => { closeSheet(); UI.poNew = {lines:[{sku:el.dataset.sku, qty:""}], note:""}; go("compras-nueva"); };
ACT["item-merma"] = (el) => {
  closeSheet(); const V = view(SESSION.role);
  UI.mw = null; const w = mw(); w.kind = "insumo"; w.ref = el.dataset.sku; w.qty = 1; w.step = 2;
  const pts = V.items.find(i => i.sku === w.ref).points; w.point = SESSION.role === "alm" && pts.includes("alm") ? "alm" : pts[0];
  go("movimientos-merma");
};

/* ---------- 2. Conteo ágil: Enter pasa al siguiente campo ---------- */
document.addEventListener("keydown", e => {
  const el = e.target;
  if (e.key !== "Enter" || !el.matches || !el.matches('[data-in="count"],[data-in="dcount"]')) return;
  e.preventDefault();
  const all = Array.from(document.querySelectorAll('[data-in="' + el.dataset.in + '"]'));
  const next = all[all.indexOf(el) + 1];
  if (next){ next.focus(); next.select(); }
  else { const b = $("count-next") || document.querySelector('[data-act="count-review"]'); if (b) b.focus(); }
});
function firstPending(){
  for (const pt of ["bar","coc","alm"]){
    const it = DB.items.find(i => countPointsFor(i.sku).includes(pt) && DB.count.values[pt][i.sku] === undefined);
    if (it) return {pt:pt, sku:it.sku};
  }
  return null;
}
ACT["count-goto"] = () => {
  const f = firstPending();
  if (!f){ toast("Ya contaste todo. Puedes revisar y enviar."); return; }
  UI.conteoPt = f.pt; render();
  setTimeout(() => { const i = $("cnt-" + f.pt + "-" + f.sku); if (i){ i.scrollIntoView({block:"center"}); i.focus(); } }, 30);
};
ACT["count-filter"] = (el) => { UI.countFilter = el.dataset.f; render(); };

/* ---------- 3. Merma express ---------- */
function quickMermaHtml(V){
  const last = V.myMermas.length ? V.myMermas[V.myMermas.length - 1] : null;
  const label = (f) => f.kind === "producto" ? V.products.find(p => p.code === f.ref) : V.items.find(i => i.sku === f.ref);
  const thumb = (f) => { const o = label(f); return f.kind === "producto" && o.photo ? '<img src="' + o.photo + '" alt="">' : '<span class="qph">' + ic(f.kind === "producto" ? "glass" : o.cat) + '</span>'; };
  let h = "";
  if (last && label(last)) h += '<button type="button" class="repeat" data-act="mw-repeat">' + thumb(last) + '<span><b>Repetir último</b><span>' + esc(num(last.qty) + " × " + last.label + " · " + last.reason) + '</span></span></button>';
  V.frequent.forEach(f => { const o = label(f); h += '<button type="button" data-act="mw-quick" data-k="' + f.kind + '" data-ref="' + esc(f.ref) + '">' + thumb(f) + '<span><b>' + esc(o.name) + '</b><span>' + f.n + (f.n === 1 ? " reporte" : " reportes") + '</span></span></button>'; });
  return h ? '<p class="lbl" style="margin:0 0 8px">Frecuentes</p><div class="quick">' + h + '</div>' : "";
}
ACT["mw-quick"] = (el) => {
  const w = mw(); w.kind = el.dataset.k; w.q = "";
  ACT["mw-pick"]({dataset:{ref:el.dataset.ref}});
};
ACT["mw-repeat"] = () => {
  const V = view(SESSION.role), last = V.myMermas[V.myMermas.length - 1]; if (!last) return;
  UI.mw = {step:3, kind:last.kind, ref:last.ref, qty:last.qty, point:last.point, reason:last.reason, note:"", date:defaultDate(), q:""};
  UI.mwErr = null; render();
};
// ordena los mosaicos poniendo primero lo que más se reporta
function freqRank(kind){ const f = {}; DB.mermas.forEach(m => { if (m.kind === kind) f[m.ref] = (f[m.ref] || 0) + 1; }); return f; }

/* ---------- 4. Filtros con contadores ---------- */
const fchips = (key, list, def) => {
  const cur = UI[key] && list.some(c => c.id === UI[key]) ? UI[key] : def; UI[key] = cur;
  return '<div class="fchips" role="group">' + list.map(c => '<button type="button" class="' + (c.id === cur ? "on " : "") + (c.cls || "") + '" aria-pressed="' + (c.id === cur) + '" data-act="fchip" data-key="' + key + '" data-id="' + esc(c.id) + '">' + esc(c.label) + ' <b>' + c.n + '</b></button>').join("") + '</div>';
};
ACT["fchip"] = (el) => { UI[el.dataset.key] = el.dataset.id; render(); };
function itemFlags(sku){
  const P = DB.points[sku];
  const low = ["alm","bar","coc"].some(pt => P[pt] && pointStock(sku, pt) < P[pt].min);
  const lots = DB.lots.some(l => l.sku === sku && ["Vencido","Por vencer"].includes(lotStatus(l).k));
  return {low:low, lots:lots};
}
const LOG_CATS = [
  {id:"todo", label:"Todo", re:/./},
  {id:"accesos", label:"Accesos y seguridad", re:/Ingres|sesión|denegad|fallido|bloquead|Cambió a la cuenta/i},
  {id:"inventario", label:"Conteo e inventario", re:/conteo|inventario|tolerancia/i},
  {id:"movimientos", label:"Compras, mermas y despachos", re:/compra|merma|Despach|diario|Deshizo/i},
  {id:"carta", label:"Ventas y recetas", re:/ventas POS|lote de ventas|receta|producto|foto|Editó|Quitó|Agregó|Creó/i}
];

/* ---------- 5. Novedades desde tu último ingreso ---------- */
function computeNews(u, prev){
  const role = USERS[u].role, out = [];
  const who = (x) => USERS[x] ? USERS[x].name : "Alguien";
  const add = (roles, text, to) => { if (roles.indexOf(role) >= 0) out.push({text:text, to:to}); };
  DB.log.slice(prev).forEach(l => {
    if (l.user === u) return;
    const a = l.action; let m;
    if ((m = a.match(/^Reportó merma: ([^·]+)/))) add(["adm","ger"], who(l.user) + " reportó una merma: " + m[1].trim(), "movimientos-aprobar");
    else if ((m = a.match(/^Corrigió y reenvió la merma: ([^·]+)/))) add(["adm","ger"], who(l.user) + " corrigió y reenvió la merma de " + m[1].trim(), "movimientos-aprobar");
    else if ((m = a.match(/^(Aprobó) merma: ([^·]+)/))) add(["alm","adm","ger"], who(l.user) + " aprobó la merma de " + m[2].trim(), "movimientos-historial");
    else if ((m = a.match(/^Rechazó la merma[^:]*: ([^·]+)/))) add(["alm","adm","ger"], who(l.user) + " rechazó la merma de " + m[1].trim(), "movimientos-historial");
    else if ((m = a.match(/^Solicitó la compra (OC-\d+)/))) add(["adm","ger"], who(l.user) + " solicitó la compra " + m[1] + "; está por aprobar", "compras-aprobar");
    else if ((m = a.match(/^(Aprobó|Rechazó) la compra (OC-\d+)/))) add(["alm","adm","ger"], who(l.user) + " " + m[1].toLowerCase() + " la compra " + m[2], role === "alm" && m[1] === "Aprobó" ? "compras-recibir" : "compras-historial");
    else if ((m = a.match(/^Recibió la compra (OC-\d+)/))) add(["adm","ger"], who(l.user) + " recibió la compra " + m[1] + " y entró al almacén", "compras-historial");
    else if ((m = a.match(/^Envió el inventario diario de (.+?) \(/))) add(["adm","ger"], who(l.user) + " envió el inventario diario de " + m[1].toLowerCase(), "diario");
    else if (/^Envió el conteo/.test(a)) add(["adm","ger"], who(l.user) + " envió el conteo físico; está listo para comparar", "conteo");
    else if (/^Cerró el inventario/.test(a)) add(["aud","alm","adm","ger"], who(l.user) + " cerró el inventario", role === "aud" || role === "alm" ? "inicio" : "conteo");
    else if (/^Abrió un nuevo conteo/.test(a)) add(["aud","adm","ger"], who(l.user) + " abrió un nuevo conteo físico", "conteo");
    else if ((m = a.match(/^Registró compra: ([^·]+)/))) add(["alm","adm","ger"], who(l.user) + " registró una compra de " + m[1].trim(), "kardex");
    else if ((m = a.match(/^Cargó ventas POS: (\d+) filas/))) add(["adm","ger"], who(l.user) + " cargó " + m[1] + " ventas del POS", "pos");
    else if (/^Revirtió el lote/.test(a)) add(["adm","ger"], who(l.user) + " revirtió un lote de ventas del POS", "pos");
    else if ((m = a.match(/^Despachó (.+)$/))) add(["alm","adm","ger"], who(l.user) + " despachó " + m[1], role === "alm" ? "kardex" : "pedido");
    else if (/^Importó recetas/.test(a)) add(["adm","ger"], who(l.user) + " importó recetas", "recetas");
    else if (/denegad|fallido|bloquead/i.test(a)) add(["adm","ger"], "Intento sin permiso o ingreso fallido (" + (USERS[l.user] ? USERS[l.user].name : "usuario desconocido") + ")", "reportes-bitacora");
  });
  if (role === "op" || role === "alm"){
    DB.mermas.filter(m => m.by === u && m.decidedLog !== undefined && m.decidedLog >= prev).forEach(m => {
      const st = m.status === "aprobada" ? "fue aprobado" : m.status === "devuelta" ? "te lo devolvieron para corregir" : m.status === "rechazada" ? "fue rechazado" : null;
      if (st) out.push({text:"Tu reporte de " + m.label + " " + st, to:m.status === "devuelta" ? "movimientos-devueltas" : "movimientos-historial"});
    });
  }
  return out;
}
function newsHtml(){
  const n = UI.news;
  if (!n || !n.length) return "";
  const shown = n.slice(-6).reverse();
  return '<section class="news" aria-label="Novedades"><div class="news-head"><b>Desde tu último ingreso · ' + n.length + (n.length === 1 ? " novedad" : " novedades") + '</b><button class="btn sm ghost" data-act="news-ok">Entendido</button></div>' +
    shown.map(x => '<div class="alert-row"><div class="t"><b style="font-weight:500">' + esc(x.text) + '</b></div><button class="btn sm ghost" data-act="go" data-to="' + x.to + '">Ver</button></div>').join("") +
    (n.length > 6 ? '<div class="alert-row"><span class="muted small">y ' + (n.length - 6) + ' más en la bitácora.</span></div>' : "") + '</section>';
}
ACT["news-ok"] = () => { UI.news = []; render(); };
