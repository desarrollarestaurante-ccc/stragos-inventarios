/* =========================================================
   Lógica de negocio: Kardex, compras (solicitud → aprobación →
   recepción), mermas (aprobar / devolver / rechazar), conteo,
   inventario diario, POS con cortesías y promociones, recetas,
   transferencias, lotes e indicadores.
   ========================================================= */

/* ---------- Kardex ---------- */
function kardexRow(sku){
  const it = item(sku);
  let ent = 0, sal = 0;
  DB.movs.forEach(m => { if (m.sku === sku){ if (m.qty > 0) ent += m.qty; else sal += -m.qty; } });
  return {it:it, initial:it.initial, ent:r4(ent), sal:r4(sal), saldo:r4(it.initial + ent - sal)};
}
const saldo = (sku) => kardexRow(sku).saldo;
function pointStock(sku, pt){
  const p = DB.points[sku];
  if (pt === "alm") return r4(saldo(sku) - (p.bar ? p.bar.stock : 0) - (p.coc ? p.coc.stock : 0));
  return p[pt] ? r4(p[pt].stock) : null;
}
const inventoryValue = () => DB.items.reduce((a, it) => a + saldo(it.sku) * it.cost, 0);
const isBlocked = (date) => !!(DB.closing && date <= DB.closing);
const blockMsg = () => "El inventario está cerrado al " + fdate(DB.closing) + ". Solo se aceptan registros con fecha posterior.";
const defaultDate = () => {
  if (!isBlocked(DEMO_DATE)) return DEMO_DATE;
  const d = new Date(DB.closing + "T12:00:00"); d.setDate(d.getDate() + 1); return d.toISOString().slice(0,10);
};
const uname = (u) => USERS[u] ? USERS[u].name : (u || "—");

/* ---------- Compras: solicitud → aprobación → recepción ---------- */
function purchasePreview(sku, qty, total, withIgv){
  const it = item(sku); if (!it || !(qty > 0) || !(total > 0)) return null;
  const net = withIgv ? total / (1 + IGV) : total;
  const exist = Math.max(saldo(sku), 0);
  return {net:net, igv:withIgv ? total - net : 0, unit:net / qty, before:it.cost, after:(exist * it.cost + net) / (exist + qty)};
}
// sobre el umbral la aprueba Gerencia; si la solicitó Gerencia, la aprueba Administración
const poNeedsGer = (po) => po.total > DB.settings.buyLimit && !(USERS[po.by] && USERS[po.by].role === "ger");
function createPO(lines, note){
  if (!need("compras_solicitar", "solicitar compras")) return {ok:false};
  const clean = lines.filter(l => item(l.sku) && l.qty > 0);
  if (!clean.length) return {ok:false, err:"Agrega al menos un insumo con cantidad mayor que 0."};
  const ls = clean.map(l => ({sku:l.sku, qty:r4(l.qty), est:r2(l.qty * item(l.sku).cost)}));
  let n = 101; while (DB.pos.some(p => p.id === "OC-0" + n)) n++;
  const po = {id:"OC-0" + n, date:defaultDate(), by:SESSION.user, status:"solicitada", note:(note || "").slice(0,200), lines:ls, total:r2(ls.reduce((a, l) => a + l.est, 0))};
  DB.pos.push(po);
  logEv("Solicitó la compra " + po.id + " · " + ls.length + " insumos · estimado " + money(po.total) + " sin IGV");
  save(); return {ok:true, po:po};
}
function decidePO(id, ok, reason){
  if (!need("compras_aprobar", "aprobar compras")) return {ok:false};
  const po = DB.pos.find(p => p.id === id && p.status === "solicitada");
  if (!po) return {ok:false, err:"La solicitud ya no está pendiente."};
  if (po.by === SESSION.user) return {ok:false, err:"No puedes aprobar tu propia solicitud. La aprueba otra persona."};
  if (ok && poNeedsGer(po) && SESSION.role !== "ger") return {ok:false, err:"Supera " + money(DB.settings.buyLimit) + ": la aprueba Gerencia general."};
  if (!ok && !(reason || "").trim()) return {ok:false, err:"Escribe el motivo del rechazo."};
  po.status = ok ? "aprobada" : "rechazada"; po.approvedBy = SESSION.user; po.approvedAt = nowTs(); if (!ok) po.reason = reason.trim().slice(0,200);
  logEv((ok ? "Aprobó" : "Rechazó") + " la compra " + po.id + " · " + money(po.total) + (ok ? "" : " · motivo: " + po.reason));
  save(); return {ok:true};
}
function addPurchaseMovement(f, poId){
  const it = item(f.sku), pv = purchasePreview(f.sku, f.qty, f.total, f.igv);
  it.cost = r4(pv.after);
  let lot = (f.lot || "").trim();
  if (f.exp && !lot) lot = "L" + f.date.slice(5,7) + f.date.slice(8,10) + "-" + String(DB.seq % 1000).padStart(3,"0");
  DB.movs.push({id:nextId("m"), date:f.date, sku:f.sku, type:"compra", qty:f.qty, net:r2(pv.net), note:"Compra recibida" + (poId ? " · " + poId : "") + (lot ? " · lote " + lot : ""), user:SESSION.user});
  if (f.exp) DB.lots.push({id:nextId("l"), sku:f.sku, code:lot, qty:f.qty, left:f.qty, buy:f.date, exp:f.exp});
  return {net:pv.net, lot:lot};
}
function receivePO(id, date, rows){
  if (!need("compras_recibir", "recibir compras")) return {ok:false};
  const po = DB.pos.find(p => p.id === id && p.status === "aprobada");
  if (!po) return {ok:false, err:"La compra no está aprobada o ya se recibió."};
  if (!validISO(date)) return {ok:false, err:"Fecha de recepción inválida."};
  if (isBlocked(date)) return {ok:false, err:blockMsg()};
  for (const r of rows){
    if (!(r.qty >= 0)) return {ok:false, err:"Revisa las cantidades recibidas."};
    if (r.qty > 0 && !(r.total > 0)) return {ok:false, err:"Falta el costo de factura de " + item(r.sku).name + "."};
    if (r.exp && (!validISO(r.exp) || r.exp <= date)) return {ok:false, err:"El vencimiento de " + item(r.sku).name + " debe ser posterior a la recepción."};
  }
  if (!rows.some(r => r.qty > 0)) return {ok:false, err:"No hay cantidades recibidas."};
  let net = 0;
  rows.filter(r => r.qty > 0).forEach(r => { net += addPurchaseMovement({sku:r.sku, qty:r.qty, total:r.total, igv:r.igv, date:date, lot:r.lot, exp:r.exp}, po.id).net; });
  po.status = "recibida"; po.receivedBy = SESSION.user; po.receivedAt = nowTs(); po.receivedDate = date; po.net = r2(net);
  po.received = rows.map(r => ({sku:r.sku, qty:r.qty}));
  logEv("Recibió la compra " + po.id + " · " + money(net) + " sin IGV · entró al almacén");
  save(); return {ok:true, net:net};
}

/* ---------- Recetas ---------- */
function recipeUse(p, line){ return line.qty / (p.yield || 1) / (1 - (p.merma || 0) / 100); }
function recipeCost(p){
  return p.lines.reduce((a, l) => { const it = item(l.sku); return it ? a + recipeUse(p, l) / it.factor * it.cost : a; }, 0);
}
const netPrice = (p) => p.price / (1 + IGV);
const foodCost = (p) => netPrice(p) > 0 ? recipeCost(p) / netPrice(p) * 100 : 0;
const fcClass = (fc) => fc <= 30 ? "ok" : fc <= 35 ? "warn" : "bad";
function consumptionFor(p, qtySold){
  const out = {};
  p.lines.forEach(l => { const it = item(l.sku); if (it) out[l.sku] = (out[l.sku] || 0) + qtySold * recipeUse(p, l) / it.factor; });
  return out;
}

/* ---------- Lotes ---------- */
function lotStatus(l){
  if (l.left <= 0.0001) return {k:"Agotado", c:"", d:null};
  const d = daysBetween(DEMO_DATE, l.exp);
  if (d < 0) return {k:"Vencido", c:"bad", d:d};
  if (d <= 7) return {k:"Por vencer", c:"warn", d:d};
  return {k:"OK", c:"ok", d:d};
}
function consumeLots(sku, qty){
  const used = []; let rest = qty;
  DB.lots.filter(l => l.sku === sku && l.left > 0.0001).sort((a, b) => a.exp < b.exp ? -1 : a.exp > b.exp ? 1 : 0).forEach(l => {
    if (rest <= 0.0001) return;
    const take = Math.min(l.left, rest);
    l.left = r4(l.left - take); rest = r4(rest - take);
    used.push({id:l.id, qty:take});
  });
  return used;
}

/* ---------- Mermas ----------
   Flujo: Reportada (pendiente) → Aprobada: se descuenta del inventario.
                                → Devuelta: vuelve a quien la reportó para corregirla y reenviarla (no toca el stock).
                                → Rechazada «sin pérdida»: el producto sigue; no toca el stock.
                                → Rechazada «con cargo»: la pérdida no se justificó; se descuenta como faltante y se registra un cargo al responsable. */
function mermaLines(kind, ref, qty){
  if (kind === "producto"){
    const p = product(ref); if (!p) return [];
    const c = consumptionFor(p, qty);
    return Object.keys(c).map(sku => ({sku:sku, qty:r4(c[sku])}));
  }
  return [{sku:ref, qty:r4(qty)}];
}
function validMerma(f){
  if (!(f.qty > 0)) return "La cantidad debe ser mayor que 0.";
  if (MERMA_REASONS.indexOf(f.reason) < 0) return "Elige un motivo.";
  if (!validISO(f.date)) return "Fecha inválida.";
  if (isBlocked(f.date)) return blockMsg();
  return null;
}
function reportMerma(f){
  if (!need("mermas_reportar", "reportar mermas")) return {ok:false};
  const err = validMerma(f); if (err) return {ok:false, err:err};
  const lines = mermaLines(f.kind, f.ref, f.qty);
  if (!lines.length) return {ok:false, err:"El producto no tiene receta: elige el insumo directamente."};
  const label = f.kind === "producto" ? product(f.ref).name : item(f.ref).name;
  const m = {id:nextId("w"), date:f.date, point:f.point, reason:f.reason, note:(f.note || "").slice(0,200), label:label,
    kind:f.kind, ref:f.ref, qty:f.qty, lines:lines, status:"pendiente", by:SESSION.user, history:[{ts:nowTs(), user:SESSION.user, action:"Reportó"}]};
  DB.mermas.push(m);
  logEv("Reportó merma: " + label + " · " + num(f.qty) + " · " + f.reason + " · " + POINTS[f.point]);
  save(); return {ok:true, id:m.id};
}
function resubmitMerma(id, f){
  if (!need("mermas_reportar", "corregir mermas")) return {ok:false};
  const m = DB.mermas.find(x => x.id === id && x.status === "devuelta" && x.by === SESSION.user);
  if (!m) return {ok:false, err:"Ese reporte ya no está devuelto."};
  const err = validMerma({qty:f.qty, reason:f.reason, date:m.date}); if (err) return {ok:false, err:err};
  m.qty = f.qty; m.reason = f.reason; m.note = (f.note || "").slice(0,200); m.lines = mermaLines(m.kind, m.ref, f.qty); m.status = "pendiente";
  m.history.push({ts:nowTs(), user:SESSION.user, action:"Corrigió y reenvió"});
  logEv("Corrigió y reenvió la merma: " + m.label + " · " + num(f.qty) + " · " + f.reason);
  save(); return {ok:true};
}
function cancelMerma(id){
  const m = DB.mermas.find(x => x.id === id && (x.status === "devuelta" || x.status === "pendiente") && x.by === (SESSION && SESSION.user));
  if (!m) return {ok:false};
  m.status = "anulada"; m.history.push({ts:nowTs(), user:SESSION.user, action:"Anuló el reporte"});
  logEv("Anuló su reporte de merma: " + m.label);
  save(); return {ok:true};
}
function mermaValue(m){ return m.lines.reduce((a, l) => { const it = item(l.sku); return a + (it ? l.qty * it.cost : 0); }, 0); }
function checkStockFor(m){
  for (const l of m.lines){
    const it = item(l.sku);
    const avail = m.point === "alm" ? pointStock(l.sku, "alm") : (DB.points[l.sku][m.point] ? pointStock(l.sku, m.point) : saldo(l.sku));
    if (saldo(l.sku) - l.qty < -0.0001 || avail - l.qty < -0.0001) return "el saldo de " + it.name + " quedaría negativo";
  }
  return null;
}
function discountMerma(m, type, note){
  m.lines.forEach(l => {
    DB.movs.push({id:nextId("m"), date:m.date, sku:l.sku, type:type, qty:-l.qty, note:note, user:SESSION.user, merma:m.id});
    const pt = DB.points[l.sku][m.point];
    if (m.point !== "alm" && pt) pt.stock = r4(pt.stock - l.qty);
    consumeLots(l.sku, l.qty);
  });
}
function resolveMerma(id, action, o){
  o = o || {};
  if (!need("mermas_aprobar", "resolver mermas")) return {ok:false};
  const m = DB.mermas.find(x => x.id === id && x.status === "pendiente");
  if (!m) return {ok:false, err:"La merma ya no está pendiente."};
  const comment = (o.comment || "").trim().slice(0,200);
  if (action === "devolver"){
    if (!comment) return {ok:false, err:"Escribe qué debe corregir quien la reportó."};
    m.status = "devuelta"; m.decidedLog = DB.log.length; m.returnComment = comment;
    m.history.push({ts:nowTs(), user:SESSION.user, action:"Devolvió para corregir", comment:comment});
    logEv("Devolvió la merma para corregir: " + m.label + " · «" + comment + "»"); save(); return {ok:true};
  }
  if (action === "aprobar" || (action === "rechazar" && o.resolution === "cargo")){
    if (isBlocked(m.date)) return {ok:false, err:"No se puede: la fecha " + fdate(m.date) + " es igual o anterior al cierre. Pide un nuevo reporte."};
    const neg = checkStockFor(m); if (neg) return {ok:false, err:"No se puede " + (action === "aprobar" ? "aprobar" : "cargar") + ": " + neg + "."};
  }
  m.approvedBy = SESSION.user; m.decidedLog = DB.log.length;
  if (action === "aprobar"){
    discountMerma(m, "merma", "Merma aprobada · " + m.reason);
    m.status = "aprobada"; m.history.push({ts:nowTs(), user:SESSION.user, action:"Aprobó", comment:comment});
    logEv("Aprobó merma: " + m.label + " · " + money(mermaValue(m)));
  } else if (action === "rechazar"){
    if (!comment) return {ok:false, err:"Escribe el motivo del rechazo."};
    m.status = "rechazada"; m.resolution = o.resolution === "cargo" ? "cargo" : "sin_perdida"; m.rejectComment = comment;
    if (m.resolution === "cargo"){
      const who = (o.responsable || uname(m.by)).trim().slice(0,60);
      discountMerma(m, "faltante", "Pérdida no justificada · cargo a " + who);
      DB.charges.push({id:nextId("c"), date:m.date, merma:m.id, label:m.label, responsable:who, amount:r2(mermaValue(m)), status:"pendiente", by:SESSION.user});
      m.history.push({ts:nowTs(), user:SESSION.user, action:"Rechazó con cargo a " + who, comment:comment});
      logEv("Rechazó la merma con cargo al responsable: " + m.label + " · " + who + " · " + money(mermaValue(m)));
    } else {
      m.history.push({ts:nowTs(), user:SESSION.user, action:"Rechazó: el producto sigue en stock", comment:comment});
      logEv("Rechazó la merma (sin pérdida): " + m.label + " · «" + comment + "»");
    }
  } else return {ok:false, err:"Acción desconocida."};
  save(); return {ok:true};
}

/* ---------- Conteo físico (auditor) ---------- */
const countPointsFor = (sku) => ["bar","coc","alm"].filter(pt => pt === "alm" || DB.points[sku][pt]);
function countTotals(){
  const out = {};
  DB.items.forEach(it => {
    let t = 0, any = false;
    countPointsFor(it.sku).forEach(pt => { const v = DB.count.values[pt][it.sku]; if (v !== undefined && v !== "" && v !== null){ t += +v; any = true; } });
    out[it.sku] = any ? r4(t) : null;
  });
  return out;
}
function countProgress(){
  let done = 0, total = 0; const byPt = {};
  ["bar","coc","alm"].forEach(pt => {
    const skus = DB.items.filter(it => countPointsFor(it.sku).includes(pt)).map(i => i.sku);
    const d = skus.filter(s => DB.count.values[pt][s] !== undefined && DB.count.values[pt][s] !== "").length;
    byPt[pt] = {done:d, total:skus.length}; done += d; total += skus.length;
  });
  return {done:done, total:total, byPt:byPt};
}
function setCountValue(pt, sku, v){
  if (!need("conteo_contar", "registrar el conteo")) return false;
  if (DB.count.status === "sent" || DB.count.status === "closed") return false;
  if (DB.count.status === "none") DB.count.status = "draft";
  if (v === "" || v === null || isNaN(v)) delete DB.count.values[pt][sku];
  else DB.count.values[pt][sku] = r4(Math.max(0, +v));
  save(); return true;
}
function submitCount(){
  if (!need("conteo_contar", "enviar el conteo")) return false;
  if (DB.count.status === "sent") return false;
  DB.count.status = "sent"; DB.count.by = SESSION.user; DB.count.at = nowTs(); DB.count.date = DEMO_DATE;
  logEv("Envió el conteo físico a ciego (" + countProgress().done + " registros)");
  save(); return true;
}
function countComparison(){
  const tot = countTotals(), s = DB.settings;
  return DB.items.map(it => {
    const theo = saldo(it.sku), counted = tot[it.sku] == null ? 0 : tot[it.sku];
    const diff = r4(counted - theo);
    const p = theo !== 0 ? diff / theo * 100 : (counted > 0 ? 100 : 0);
    const a = Math.abs(p);
    const sem = a <= s.tolOk ? {k:"OK", c:"ok"} : a <= s.tolRev ? {k:"Revisar", c:"warn"} : {k:"Crítico", c:"bad"};
    return {it:it, theo:theo, counted:counted, missing:tot[it.sku] == null, diff:diff, pct:p, value:diff * it.cost, sem:sem};
  });
}
function closeInventory(){
  if (!need("conteo_cerrar", "cerrar el inventario")) return {ok:false};
  if (DB.count.status !== "sent") return {ok:false, err:"Solo se puede cerrar un conteo enviado por el auditor."};
  const rows = countComparison();
  rows.forEach(r => { if (Math.abs(r.diff) > 0.0001) DB.movs.push({id:nextId("m"), date:DEMO_DATE, sku:r.it.sku, type:"ajuste", qty:r.diff, note:"Ajuste por inventario físico", user:SESSION.user}); });
  DB.lastCount = {date:DEMO_DATE, by:DB.count.by, values:JSON.parse(JSON.stringify(DB.count.values)), rows:rows.map(r => ({sku:r.it.sku, theo:r.theo, counted:r.counted, diff:r.diff, cost:r.it.cost}))};
  DB.closing = DEMO_DATE; DB.count.status = "closed";
  logEv("Cerró el inventario del " + fdate(DEMO_DATE) + " · desviación " + money(rows.reduce((a, r) => a + r.value, 0)));
  save(); return {ok:true};
}
function reopenCount(){
  if (!need("conteo_cerrar", "abrir un nuevo conteo")) return false;
  DB.count = {status:"none", values:{alm:{},bar:{},coc:{}}, by:null, at:null, date:null};
  logEv("Abrió un nuevo conteo físico"); save(); return true;
}

/* ---------- Inventario diario de barra y cocina ----------
   El operario cuenta su punto al cierre del turno (a ciego).
   Teórico del día = apertura (cierre contado del día anterior) + recibido − enviado − consumo por recetas (ventas, promociones y cortesías) − mermas descontadas. */
const dailyOf = (pt, date) => DB.daily.find(d => d.point === pt && d.date === date);
function dailyOpening(pt, date){
  const prev = DB.daily.filter(d => d.point === pt && d.date < date).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  return prev ? {date:prev.date, counts:prev.counts} : null;
}
function dailyItems(pt){ return DB.items.filter(it => DB.points[it.sku][pt]); }
function dailyTheo(pt, date){
  const open = dailyOpening(pt, date);
  const rows = {};
  dailyItems(pt).forEach(it => { rows[it.sku] = {it:it, open:open && open.counts[it.sku] !== undefined ? open.counts[it.sku] : null, inn:0, out:0, sold:0, court:0, merma:0}; });
  DB.dispatches.filter(d => (d.date || DEMO_DATE) === date).forEach(d => {
    if (d.to === pt && rows[d.sku]) rows[d.sku].inn += d.qty;
    if (d.from === pt && rows[d.sku]) rows[d.sku].out += d.qty;
  });
  DB.sales.filter(s => s.date === date).forEach(s => {
    const p = product(s.code); if (!p || p.point !== pt) return;
    const c = consumptionFor(p, s.qty);
    Object.keys(c).forEach(sku => { if (rows[sku]){ if (s.type === "cortesia") rows[sku].court += c[sku]; else rows[sku].sold += c[sku]; } });
  });
  DB.movs.filter(m => m.date === date && (m.type === "merma" || m.type === "faltante") && m.merma).forEach(m => {
    const w = DB.mermas.find(x => x.id === m.merma);
    if (w && w.point === pt && rows[m.sku]) rows[m.sku].merma += -m.qty;
  });
  return Object.keys(rows).map(k => { const r = rows[k]; r.theo = r.open == null ? null : r4(r.open + r.inn - r.out - r.sold - r.court - r.merma); return r; });
}
function submitDaily(pt, counts){
  if (!need("diario_contar", "registrar el inventario diario")) return {ok:false};
  if (dailyOf(pt, DEMO_DATE)) return {ok:false, err:"El cierre de " + POINTS[pt] + " de hoy ya se envió."};
  const its = dailyItems(pt), missing = its.filter(it => counts[it.sku] === undefined || counts[it.sku] === "");
  if (missing.length) return {ok:false, err:"Falta contar: " + missing.map(i => i.name).join(", ") + "."};
  const c = {}; its.forEach(it => { c[it.sku] = r4(+counts[it.sku]); });
  DB.daily.push({id:nextId("d"), date:DEMO_DATE, point:pt, by:SESSION.user, at:nowTs(), counts:c});
  logEv("Envió el inventario diario de " + POINTS[pt] + " (" + its.length + " insumos)");
  save(); return {ok:true};
}
// conteo del auditor para ese punto y fecha (para cruzarlo con el del operario)
function auditFor(pt, date){
  if ((DB.count.status === "sent" || DB.count.status === "closed") && DB.count.date === date && DB.count.values[pt] && Object.keys(DB.count.values[pt]).length) return DB.count.values[pt];
  if (DB.lastCount && DB.lastCount.date === date && DB.lastCount.values) return DB.lastCount.values[pt];
  return null;
}

/* ---------- Ventas POS (venta, promoción y cortesía) ---------- */
function parseRows(text){
  const lines = String(text || "").replace(/\r/g, "").split("\n"), out = [];
  lines.forEach((ln, idx) => {
    if (!ln.trim()) return;
    const sep = ln.indexOf("\t") >= 0 ? "\t" : (ln.indexOf(";") >= 0 && ln.indexOf(",") < 0 ? ";" : ",");
    const cells = []; let cur = "", q = false;
    for (let i = 0; i < ln.length; i++){
      const ch = ln[i];
      if (q){ if (ch === '"'){ if (ln[i+1] === '"'){ cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep){ cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    out.push({line:idx + 1, cells:cells.map(c => c.trim())});
  });
  return out;
}
const normType = (t) => { const s = String(t || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); return s === "" ? "venta" : s === "cortesia" ? "cortesia" : s === "promo" || s === "promocion" ? "promo" : s === "venta" ? "venta" : null; };
function posPreviewRows(rows){
  if (rows.length && /fecha/i.test(rows[0].cells[0] || "")) rows.shift();
  const errors = [], warnings = [], parsed = [], seen = {};
  DB.sales.forEach(s => { seen[s.date + "|" + s.code + "|" + (s.type || "venta")] = true; });
  rows.forEach((r, i) => {
    const fila = i + 1;
    const date = r.cells[0] || "", code = (r.cells[1] || "").toUpperCase(), qty = Number(String(r.cells[2] || "").replace(",", "."));
    const typeRaw = r.cells[3] || "", type = normType(typeRaw), priceS = String(r.cells[4] || "").replace(",", "."), detail = (r.cells[5] || "").slice(0,60);
    const rowErr = [];
    if (!validISO(date)) rowErr.push({col:"fecha", msg:"formato inválido «" + date + "». Usa AAAA-MM-DD."});
    else if (isBlocked(date)) rowErr.push({col:"fecha", msg:"la fecha " + fdate(date) + " es igual o anterior al cierre del inventario (" + fdate(DB.closing) + ")."});
    if (!code) rowErr.push({col:"codigo_pos", msg:"código vacío."});
    if (!(qty > 0)) rowErr.push({col:"cantidad", msg:"la cantidad debe ser mayor que 0."});
    if (!type) rowErr.push({col:"tipo", msg:"«" + typeRaw + "» no es válido: usa venta, promo o cortesia."});
    const price = priceS === "" ? null : Number(priceS);
    if (type === "promo" && !(price > 0)) rowErr.push({col:"precio_unit_con_igv", msg:"una promoción necesita el precio cobrado (mayor que 0)."});
    rowErr.forEach(e => errors.push({fila:fila, col:e.col, msg:e.msg}));
    const p = code ? product(code) : null, rowWarn = [];
    if (code && !p) rowWarn.push("el código " + code + " no tiene receta; no descuenta insumos.");
    if (type === "cortesia" && !detail) rowWarn.push("cortesía sin motivo en la columna detalle.");
    if (type === "promo" && !detail) rowWarn.push("promoción sin nombre en la columna detalle.");
    if (type === "promo" && p && price >= p.price) rowWarn.push("el precio de la promoción no es menor que el de carta (" + money(p.price) + ").");
    const key = date + "|" + code + "|" + type;
    if (!rowErr.length && seen[key]) rowWarn.push("posible duplicado: ya hay " + (SALE_TYPES[type] || "").toLowerCase() + " de " + code + " el " + fdate(date) + ".");
    seen[key] = true;
    rowWarn.forEach(w => warnings.push({fila:fila, msg:w}));
    const unit = type === "cortesia" ? 0 : type === "promo" ? price : (p ? p.price : 0);
    parsed.push({fila:fila, date:date, code:code, qty:qty, type:type, unit:unit, detail:detail, product:p, err:rowErr.length > 0, warn:rowWarn.length > 0});
  });
  const usePt = {};
  parsed.filter(r => !r.err && r.product).forEach(r => {
    const c = consumptionFor(r.product, r.qty);
    Object.keys(c).forEach(sku => { const pt = DB.points[sku][r.product.point] ? r.product.point : "alm"; const k = sku + "|" + pt; usePt[k] = (usePt[k] || 0) + c[sku]; });
  });
  Object.keys(usePt).forEach(k => {
    const [sku, pt] = k.split("|"), it = item(sku), after = pointStock(sku, pt) - usePt[k];
    if (after < -0.0001) warnings.push({fila:"—", msg:"el stock de " + it.name + " en " + POINTS[pt] + " quedaría negativo (" + qtyTxt(it, after) + ")."});
  });
  return {rows:parsed, errors:errors, warnings:warnings, valid:parsed.filter(r => !r.err)};
}
const posPreview = (text) => posPreviewRows(parseRows(text));
function applyPos(preview){
  if (!need("pos", "cargar ventas del POS")) return {ok:false};
  if (preview.errors.length) return {ok:false, err:"Corrige los errores antes de cargar."};
  const batch = {id:nextId("b"), at:nowTs(), user:SESSION.user, rows:[], movs:[], pts:[], lots:[], unknown:0};
  const bySku = {};
  preview.valid.forEach(r => {
    const sale = {id:nextId("s"), batch:batch.id, date:r.date, code:r.code, qty:r.qty, type:r.type, detail:r.detail, unit:r.unit,
      net:r.qty * r.unit / (1 + IGV), listNet:r.product ? r.qty * netPrice(r.product) : 0, cost:0, hasRecipe:!!r.product};
    if (r.product){
      const c = consumptionFor(r.product, r.qty);
      Object.keys(c).forEach(sku => {
        const it = item(sku); sale.cost += c[sku] * it.cost;
        const pt = DB.points[sku][r.product.point] ? r.product.point : "alm";
        if (pt !== "alm"){ DB.points[sku][pt].stock = r4(DB.points[sku][pt].stock - c[sku]); batch.pts.push({sku:sku, pt:pt, qty:c[sku]}); }
        const k = r.date + "|" + sku + "|" + (r.type === "cortesia" ? "c" : "v"); bySku[k] = (bySku[k] || 0) + c[sku];
      });
    } else batch.unknown++;
    sale.cost = r4(sale.cost); sale.net = r4(sale.net); sale.listNet = r4(sale.listNet);
    DB.sales.push(sale); batch.rows.push(sale.id);
  });
  Object.keys(bySku).forEach(k => {
    const [date, sku, t] = k.split("|"), mid = nextId("m");
    DB.movs.push({id:mid, date:date, sku:sku, type:t === "c" ? "cortesia" : "venta", qty:-r4(bySku[k]), note:(t === "c" ? "Cortesías POS" : "Ventas POS") + " · lote " + batch.id, user:SESSION.user, batch:batch.id});
    batch.movs.push(mid);
    consumeLots(sku, bySku[k]).forEach(u => batch.lots.push(u));
  });
  DB.batches.push(batch);
  const nC = preview.valid.filter(r => r.type === "cortesia").length, nP = preview.valid.filter(r => r.type === "promo").length;
  logEv("Cargó ventas POS: " + batch.rows.length + " filas (lote " + batch.id + ")" + (nP ? " · " + nP + " promociones" : "") + (nC ? " · " + nC + " cortesías" : "") + (batch.unknown ? " · " + batch.unknown + " sin receta" : ""));
  save(); return {ok:true, batch:batch};
}
function revertLastBatch(){
  if (!need("pos", "revertir ventas del POS")) return {ok:false};
  const b = DB.batches[DB.batches.length - 1];
  if (!b) return {ok:false, err:"No hay lotes de ventas cargados."};
  if (b.rows.some(id => { const s = DB.sales.find(x => x.id === id); return s && isBlocked(s.date); }))
    return {ok:false, err:"No se puede revertir: el lote tiene ventas con fecha igual o anterior al cierre."};
  b.pts.forEach(p => { DB.points[p.sku][p.pt].stock = r4(DB.points[p.sku][p.pt].stock + p.qty); });
  b.lots.forEach(u => { const l = DB.lots.find(x => x.id === u.id); if (l) l.left = r4(l.left + u.qty); });
  DB.movs = DB.movs.filter(m => b.movs.indexOf(m.id) < 0);
  DB.sales = DB.sales.filter(s => s.batch !== b.id);
  DB.batches.pop();
  logEv("Revirtió el lote de ventas POS " + b.id + " (" + b.rows.length + " filas)");
  save(); return {ok:true, batch:b};
}

/* ---------- Pedido sugerido y transferencias ---------- */
function dailyConsumption(){
  const days = {}; DB.sales.forEach(s => { if (s.hasRecipe) days[s.date] = true; });
  const nDays = Object.keys(days).length;
  if (!nDays) return {fromPos:false, days:0, map:null};
  const map = {};
  DB.sales.forEach(s => {
    const p = product(s.code); if (!p) return;
    const c = consumptionFor(p, s.qty);
    Object.keys(c).forEach(sku => { const pt = DB.points[sku][p.point] ? p.point : "alm"; map[sku + "|" + pt] = (map[sku + "|" + pt] || 0) + c[sku]; });
  });
  Object.keys(map).forEach(k => { map[k] = map[k] / nDays; });
  return {fromPos:true, days:nDays, map:map};
}
function replenishment(){
  const s = DB.settings, dc = dailyConsumption(), rows = [], transfers = [], order = [];
  DB.items.forEach(it => {
    const P = DB.points[it.sku];
    const pts = ["alm","bar","coc"].filter(pt => P[pt]).map(pt => {
      const daily = pt !== "alm" && dc.fromPos ? r2(dc.map[it.sku + "|" + pt] || 0) : P[pt].daily;
      const stock = pointStock(it.sku, pt), min = P[pt].min, target = min + daily * s.cover;
      const sem = stock < min ? {k:"Bajo mínimo", c:"bad"} : stock < min + s.yellow * daily ? {k:"Por reponer", c:"warn"} : {k:"OK", c:"ok"};
      return {pt:pt, stock:stock, min:min, daily:daily, target:target, sem:sem, after:stock};
    });
    pts.filter(p => p.pt !== "alm" && p.sem.c === "bad").forEach(rcv => {
      let needQ = Math.ceil(rcv.target - rcv.after - 1e-9);
      pts.filter(d => d !== rcv).sort((a, b) => (a.pt === "alm" ? -1 : 1) - (b.pt === "alm" ? -1 : 1)).forEach(d => {
        if (needQ <= 0) return;
        const give = Math.min(needQ, Math.floor(d.after - d.min + 1e-9));
        if (give > 0){ d.after -= give; rcv.after += give; needQ -= give; transfers.push({sku:it.sku, from:d.pt, to:rcv.pt, qty:give}); }
      });
    });
    let miss = 0; pts.forEach(p => { miss += Math.max(0, p.target - p.after); });
    miss = Math.ceil(miss - 1e-9);
    if (miss > 0) order.push({it:it, qty:miss, value:miss * it.cost});
    rows.push({it:it, pts:pts});
  });
  return {rows:rows, transfers:transfers, order:order, dc:dc};
}
function dispatch(tr){
  if (!need("pedido", "despachar transferencias")) return {ok:false};
  const date = defaultDate();
  if (isBlocked(date)) return {ok:false, err:blockMsg()};
  const P = DB.points[tr.sku], avail = pointStock(tr.sku, tr.from);
  if (avail - tr.qty < (P[tr.from].min || 0) - 1e-9) return {ok:false, err:"El punto de origen ya no tiene excedente suficiente."};
  if (tr.from !== "alm") P[tr.from].stock = r4(P[tr.from].stock - tr.qty);
  if (tr.to !== "alm") P[tr.to].stock = r4(P[tr.to].stock + tr.qty);
  const it = item(tr.sku);
  DB.dispatches.push({id:nextId("d"), ts:nowTs(), date:date, sku:tr.sku, from:tr.from, to:tr.to, qty:tr.qty, user:SESSION.user});
  logEv("Despachó " + num(tr.qty) + " " + it.unit + " de " + it.name + ": " + POINTS[tr.from] + " → " + POINTS[tr.to]);
  save(); return {ok:true};
}

/* ---------- Indicadores ---------- */
function weekOf(d){ const day = +d.slice(8,10); return d.slice(0,7) !== "2026-11" ? -1 : day <= 7 ? 0 : day <= 14 ? 1 : 2; }
const nov = (d) => d && d.slice(0,7) === "2026-11";
function metrics(){
  const S = DB.sales.filter(s => nov(s.date));
  const paid = S.filter(s => s.type !== "cortesia"), court = S.filter(s => s.type === "cortesia");
  const ventaNeta = paid.reduce((a, s) => a + s.net, 0);
  const costoTeorico = paid.reduce((a, s) => a + s.cost, 0);
  const cortesias = court.reduce((a, s) => a + s.cost, 0);
  const cortesiasLista = court.reduce((a, s) => a + s.listNet, 0);
  const mermasMes = DB.mermas.filter(m => m.status === "aprobada" && nov(m.date)).reduce((a, m) => a + mermaValue(m), 0);
  const cargos = DB.charges.filter(c => nov(c.date)).reduce((a, c) => a + c.amount, 0);
  const lc = DB.lastCount;
  const faltantes = lc ? lc.rows.filter(r => r.diff < 0).reduce((a, r) => a + -r.diff * r.cost, 0) : 0;
  const desviacion = lc ? lc.rows.reduce((a, r) => a + r.diff * r.cost, 0) : 0;
  const contado = lc ? lc.rows.reduce((a, r) => a + r.counted * r.cost, 0) : 0;
  const weeks = [0,1,2].map(() => ({compras:0, ventas:0}));
  DB.movs.forEach(m => { if (m.type === "compra"){ const w = weekOf(m.date); if (w >= 0) weeks[w].compras += m.net || 0; } });
  paid.forEach(s => { const w = weekOf(s.date); if (w >= 0) weeks[w].ventas += s.net; });
  const top = lc ? lc.rows.filter(r => r.diff < 0).map(r => ({it:item(r.sku), qty:-r.diff, value:-r.diff * r.cost})).sort((a, b) => b.value - a.value).slice(0, 10) : [];
  const compras = weeks.reduce((a, w) => a + w.compras, 0);
  // promociones: food cost a precio de promoción vs. a precio de carta
  const promos = {};
  S.filter(s => s.type === "promo").forEach(s => {
    const k = s.detail || "Promoción sin nombre";
    const o = promos[k] || (promos[k] = {name:k, units:0, net:0, listNet:0, cost:0, codes:{}});
    o.units += s.qty; o.net += s.net; o.listNet += s.listNet; o.cost += s.cost; o.codes[s.code] = true;
  });
  const promoList = Object.values(promos).map(p => ({...p, fcPromo:p.net > 0 ? p.cost / p.net * 100 : 0, fcList:p.listNet > 0 ? p.cost / p.listNet * 100 : 0, discount:p.listNet - p.net, margin:p.net - p.cost}))
    .sort((a, b) => b.fcPromo - a.fcPromo);
  return {valor:inventoryValue(), ventaNeta:ventaNeta, costoTeorico:costoTeorico, cortesias:cortesias, cortesiasLista:cortesiasLista,
    mermasMes:mermasMes, cargos:cargos, faltantes:faltantes, desviacion:desviacion, desvPct:contado > 0 ? desviacion / contado * 100 : 0,
    fcTeo:ventaNeta > 0 ? costoTeorico / ventaNeta * 100 : null,
    fcReal:ventaNeta > 0 ? (costoTeorico + cortesias + mermasMes + faltantes) / ventaNeta * 100 : null,
    mermasPct:ventaNeta > 0 ? mermasMes / ventaNeta * 100 : null, cortPct:ventaNeta > 0 ? cortesias / ventaNeta * 100 : null,
    weeks:weeks, compras:compras, ratio:ventaNeta > 0 ? compras / ventaNeta * 100 : null, top:top, lc:lc, promos:promoList};
}
function alerts(){
  const out = [], low = [];
  DB.items.forEach(it => ["alm","bar","coc"].forEach(pt => { const P = DB.points[it.sku][pt]; if (P && pointStock(it.sku, pt) < P.min) low.push(it.name + " (" + POINTS[pt] + ")"); }));
  if (low.length) out.push({c:"bad", t:"Stock bajo el mínimo en " + low.length + " puntos", d:low.slice(0,4).join(", ") + (low.length > 4 ? "…" : ""), go:"pedido"});
  const poP = DB.pos.filter(p => p.status === "solicitada");
  if (poP.length) out.push({c:"warn", t:poP.length + (poP.length === 1 ? " compra por aprobar" : " compras por aprobar"), d:poP.map(p => p.id + " · " + money(p.total)).join(", "), go:"compras-aprobar"});
  if (DB.count.status === "sent") out.push({c:"warn", t:"Conteo físico pendiente de revisión", d:"Enviado por " + uname(DB.count.by) + " el " + DB.count.at, go:"conteo"});
  const pend = DB.mermas.filter(m => m.status === "pendiente");
  if (pend.length) out.push({c:"warn", t:pend.length + (pend.length === 1 ? " merma por resolver" : " mermas por resolver"), d:pend.map(m => m.label).slice(0,3).join(", "), go:"movimientos-aprobar"});
  ["bar","coc"].forEach(pt => {
    const d = dailyOf(pt, DEMO_DATE);
    if (!d) out.push({c:"warn", t:"Inventario diario de " + POINTS[pt].toLowerCase() + " sin enviar", d:"El operario aún no cuenta el cierre de turno del " + fdate(DEMO_DATE) + ".", go:"diario"});
    else {
      const miss = dailyTheo(pt, DEMO_DATE).filter(r => r.theo != null && d.counts[r.it.sku] !== undefined && d.counts[r.it.sku] - r.theo < -0.05);
      if (miss.length) out.push({c:"bad", t:"Faltantes en el cierre de " + POINTS[pt].toLowerCase(), d:miss.map(r => r.it.name).join(", "), go:"diario"});
    }
  });
  const M = metrics();
  if (M.cortPct != null && M.cortPct > DB.settings.cortObj) out.push({c:"bad", t:"Cortesías sobre el objetivo", d:pct(M.cortPct) + " de la venta neta · objetivo ≤ " + pct(DB.settings.cortObj), go:"control"});
  if (!DB.sales.some(s => s.date === DEMO_DATE)) out.push({c:"warn", t:"Ventas POS de hoy sin cargar", d:"No hay ventas con fecha " + fdate(DEMO_DATE) + ".", go:"pos"});
  const unk = {}; DB.sales.forEach(s => { if (!s.hasRecipe) unk[s.code] = true; });
  if (Object.keys(unk).length) out.push({c:"warn", t:"Códigos POS sin receta", d:Object.keys(unk).join(", ") + ": se vendieron sin descontar insumos.", go:"recetas"});
  const exp = DB.lots.filter(l => { const s = lotStatus(l); return s.k === "Vencido" || s.k === "Por vencer"; });
  if (exp.length) out.push({c:exp.some(l => lotStatus(l).k === "Vencido") ? "bad" : "warn", t:exp.length + (exp.length === 1 ? " lote vence" : " lotes vencen") + " en 7 días o menos",
    d:exp.map(l => item(l.sku).name + " · " + l.code + " · " + fdate(l.exp)).slice(0,3).join("; "), go:"kardex"});
  return out;
}

/* ---------- view(rol): solo los campos que cada rol puede recibir ---------- */
function view(role){
  const showCost = can(role, "costos");
  const items = DB.items.map(it => {
    const o = {sku:it.sku, name:it.name, unit:it.unit, cat:it.cat, baseUnit:it.baseUnit, factor:it.factor, portions:it.portions, portionLabel:it.portionLabel, points:countPointsFor(it.sku)};
    if (showCost){
      const k = kardexRow(it.sku);
      o.cost = it.cost; o.initial = k.initial; o.ent = k.ent; o.sal = k.sal; o.saldo = k.saldo;
      o.stock = {alm:pointStock(it.sku, "alm"), bar:pointStock(it.sku, "bar"), coc:pointStock(it.sku, "coc")};
    }
    if (role === "op") o.needs = ["bar","coc"].filter(pt => DB.points[it.sku][pt] && pointStock(it.sku, pt) < DB.points[it.sku][pt].min);
    return o;
  });
  const products = DB.products.map(p => {
    const o = {code:p.code, name:p.name, point:p.point, price:p.price, photo:photoOf(p), hasRecipe:p.lines.length > 0};
    if (showCost){ o.cost = recipeCost(p); o.fc = foodCost(p); }
    return o;
  });
  const v = {role:role, showCost:showCost, items:items, products:products};
  v.myMermas = DB.mermas.filter(m => m.by === (SESSION && SESSION.user)).map(m => ({id:m.id, date:m.date, label:m.label, qty:m.qty, kind:m.kind, ref:m.ref, reason:m.reason, note:m.note, point:m.point, status:m.status, resolution:m.resolution, returnComment:m.returnComment, rejectComment:m.rejectComment, history:m.history || []}));
  const freq = {};
  DB.mermas.forEach(m => { const k = m.kind + "|" + m.ref; freq[k] = (freq[k] || 0) + 1; });
  v.frequent = Object.keys(freq).map(k => { const [kind, ref] = k.split("|"); return {kind:kind, ref:ref, n:freq[k]}; })
    .filter(f => f.kind === "producto" ? (product(f.ref) && product(f.ref).lines.length) : item(f.ref)).sort((a, b) => b.n - a.n).slice(0, 4);
  if (role === "aud") v.count = {status:DB.count.status, values:DB.count.values, by:DB.count.by, at:DB.count.at};
  else if (can(role, "conteo_comparar")) v.count = {status:DB.count.status, by:DB.count.by, at:DB.count.at, values:DB.count.status === "sent" ? DB.count.values : null};
  if (role === "op"){
    // kardex físico del operario: apertura, recibido, mermas y cierre contado. Nunca el teórico por ventas.
    v.daily = ["bar","coc"].map(pt => {
      const open = dailyOpening(pt, DEMO_DATE), mine = dailyOf(pt, DEMO_DATE);
      const rows = dailyItems(pt).map(it => {
        const inn = DB.dispatches.filter(d => (d.date || DEMO_DATE) === DEMO_DATE && d.to === pt && d.sku === it.sku).reduce((a, d) => a + d.qty, 0);
        const out = DB.dispatches.filter(d => (d.date || DEMO_DATE) === DEMO_DATE && d.from === pt && d.sku === it.sku).reduce((a, d) => a + d.qty, 0);
        const mer = DB.mermas.filter(m => m.date === DEMO_DATE && m.point === pt && m.status === "aprobada").reduce((a, m) => a + (m.lines.find(l => l.sku === it.sku) || {qty:0}).qty, 0);
        return {sku:it.sku, open:open ? open.counts[it.sku] : null, inn:inn, out:out, merma:mer, close:mine ? mine.counts[it.sku] : null};
      });
      return {pt:pt, openDate:open ? open.date : null, sent:!!mine, at:mine ? mine.at : null, rows:rows};
    });
    v.history = DB.daily.filter(d => d.by === SESSION.user).map(d => ({date:d.date, point:d.point, at:d.at})).reverse();
  }
  return v;
}
