(function(){
"use strict";

/* =========================================================
   Stragos Ucello · Inventarios v7
   Núcleo: constantes, usuarios, matriz de permisos, datos de
   ejemplo, persistencia (navegador o Google Apps Script) y utilidades.
   ========================================================= */

const DEMO_DATE = "2026-11-20";
const IGV = 0.18;
const LS_KEY = "stragos_inv_v7";
const LS_USER = "stragos_inv_v6_user";
const IMG = window.STRAGOS_IMG || {};
/* Datos compartidos por todo el equipo en un archivo de Google Drive:
   - dentro de Apps Script, por google.script.run;
   - desde GitHub Pages (u otro sitio), por fetch a la URL /exec del Apps Script (window.STRAGOS_API).
   Sin ninguno de los dos, los datos quedan solo en este navegador. */
const GAS_RUN = !!(window.google && window.google.script && window.google.script.run);
const API_URL = (!GAS_RUN && window.STRAGOS_API) || "";
const GAS = GAS_RUN || !!API_URL;
function callRemote(action, payload, ok, ko){
  if (GAS_RUN){
    const run = window.google.script.run.withSuccessHandler(ok).withFailureHandler(ko);
    return action === "cargar" ? run.cargarEstado() : run.guardarEstado(payload.json, payload.ver);
  }
  // text/plain sin cabeceras propias: el navegador no hace consulta previa (CORS) y no envía cookies,
  // así funciona aunque haya varias cuentas de Google abiertas.
  const req = action === "cargar"
    ? fetch(API_URL + (API_URL.indexOf("?") < 0 ? "?" : "&") + "accion=cargar&t=" + Date.now(), {method:"GET", redirect:"follow"})
    : fetch(API_URL, {method:"POST", redirect:"follow", body:JSON.stringify({accion:"guardar", json:payload.json, ver:payload.ver})});
  req.then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }).then(ok).catch(ko);
}

const ROLES = {
  op:  {label:"Operario de barra/cocina", short:"operario"},
  aud: {label:"Auditor de inventario",    short:"auditor"},
  alm: {label:"Encargado de almacén",     short:"almacén"},
  adm: {label:"Administrador",            short:"administrador"},
  ger: {label:"Gerente general",          short:"gerente"}
};

/* Cuentas de demo. Para reasignar personas a roles basta con editar este objeto. */
const USERS = {
  barra:     {pass:"1111", role:"op",  name:"Equipo de barra",      hello:"equipo de barra"},
  sadae:     {pass:"2222", role:"aud", name:"Sadae",                hello:"Sadae"},
  lrobles:   {pass:"3333", role:"alm", name:"Lindsay Robles",       hello:"Lindsay"},
  ccastillo: {pass:"4444", role:"adm", name:"Christopher Castillo", hello:"Christopher"},
  jdiego:    {pass:"5555", role:"ger", name:"Juan Diego",           hello:"Juan Diego"}
};

/* ÚNICA matriz de permisos: toda pantalla, menú y botón la consulta. */
const PERMS = {
  inicio:            ["op","aud","alm","adm","ger"],
  dashboard:         ["adm","ger"],
  control:           ["adm","ger"],
  movimientos:       ["op","alm","adm","ger"],
  mermas_reportar:   ["op","alm","adm","ger"],
  mermas_aprobar:    ["adm","ger"],
  compras:           ["alm","adm","ger"],
  compras_solicitar: ["alm","adm","ger"],
  compras_aprobar:   ["adm","ger"],
  compras_recibir:   ["alm"],
  diario_contar:     ["op"],
  diario_comparar:   ["adm","ger"],
  conteo_contar:     ["aud"],
  conteo_comparar:   ["adm","ger"],
  conteo_cerrar:     ["ger"],
  kardex:            ["alm","adm","ger"],
  pedido:            ["adm","ger"],
  pos:               ["adm","ger"],
  recetas:           ["adm","ger"],
  reportes:          ["adm","ger"],
  costos:            ["alm","adm","ger"]
};
const PERM_LABELS = {
  inicio:"Inicio", dashboard:"Dashboard gerencial", control:"Mermas y cortesías (objetivos)",
  movimientos:"Mermas (reportar y seguir)", mermas_reportar:"Reportar mermas", mermas_aprobar:"Aprobar, devolver o rechazar mermas",
  compras:"Compras", compras_solicitar:"Solicitar compras", compras_aprobar:"Aprobar compras", compras_recibir:"Recibir compras (entra el stock)",
  diario_contar:"Inventario diario: contar cierre de turno", diario_comparar:"Inventario diario: comparar con el teórico",
  conteo_contar:"Conteo: contar a ciego", conteo_comparar:"Conteo: comparar con el teórico", conteo_cerrar:"Conteo: cerrar inventario",
  kardex:"Kardex, catálogo y lotes", pedido:"Pedido, transferencias y despacho", pos:"Ventas POS",
  recetas:"Catálogo y recetas", reportes:"Reportes y bitácora", costos:"Ver costos y saldos teóricos"
};
const can = (role, p) => !!(role && PERMS[p] && PERMS[p].indexOf(role) >= 0);

const ROUTES = [
  {id:"inicio",      label:"inicio",                  perm:["inicio"],                          icon:"home"},
  {id:"dashboard",   label:"dashboard",               perm:["dashboard"],                       icon:"chart"},
  {id:"control",     label:"mermas y cortesías",      perm:["control"],                         icon:"target"},
  {id:"movimientos", label:"mermas",                  perm:["movimientos"],                     icon:"drop"},
  {id:"diario",      label:"inventario diario",       perm:["diario_contar","diario_comparar"], icon:"cal"},
  {id:"compras",     label:"compras",                 perm:["compras"],                         icon:"cart"},
  {id:"conteo",      label:"conteo físico",           perm:["conteo_contar","conteo_comparar"], icon:"clip"},
  {id:"kardex",      label:"kardex y lotes",          perm:["kardex"],                          icon:"box"},
  {id:"pedido",      label:"pedido y transferencias", perm:["pedido"],                          icon:"truck"},
  {id:"pos",         label:"ventas pos",              perm:["pos"],                             icon:"receipt"},
  {id:"recetas",     label:"catálogo y recetas",      perm:["recetas"],                         icon:"glass"},
  {id:"reportes",    label:"reportes y bitácora",     perm:["reportes"],                        icon:"file"}
];
const canRoute = (role, id) => {
  const r = ROUTES.find(x => x.id === id);
  return !!r && r.perm.some(p => can(role, p));
};

const POINTS = {alm:"Almacén central", bar:"Barra principal", coc:"Cocina"};
/* Las cortesías se registran en el POS (tipo «cortesia» con su motivo), no como merma. */
const MERMA_REASONS = ["Rotura","Derrame","Vencido","Error de preparación","Otro"];
const SALE_TYPES = {venta:"Venta", cortesia:"Cortesía", promo:"Promoción"};

/* ---------------- datos de ejemplo ---------------- */
// sku, insumo, unidad, categoría, inicial (al 01/11), salidas 01–19/11, costo sin IGV, unidad base, factor, porciones por unidad
const SEED_ITEMS = [
  ["LIC-001","Ron añejo 750 ml","bot","Licores",40,22,48.50,"ml",750,4],
  ["LIC-002","Pisco quebranta 700 ml","bot","Licores",36,20,39.00,"ml",700,4],
  ["LIC-003","Whisky 12 años 750 ml","bot","Licores",24,14,95.00,"ml",750,4],
  ["VIN-001","Vino tinto 750 ml","bot","Licores",24,10,38.00,"ml",750,5],
  ["CER-001","Cerveza lager 330 ml","bot","Bebidas",240,150,3.40,"und",1,1],
  ["BEB-001","Gaseosa cola 500 ml","bot","Bebidas",120,70,1.90,"ml",500,4],
  ["INS-001","Limón","kg","Cocina",30,18,5.20,"g",1000,4],
  ["INS-002","Hielo en bolsa 5 kg","bolsa","Hielo",60,40,4.50,"g",5000,4],
  ["COC-001","Pollo entero","kg","Cocina",45,32,9.80,"g",1000,4]
];
const PORTION_LABEL = {"VIN-001":"copa"};
// stock por punto: [stock, mínimo, consumo diario]; almacén: [mínimo, consumo diario]
const SEED_POINTS = {
  "LIC-001":{bar:[6,8,2], alm:[4,0.5]},
  "LIC-002":{bar:[8,6,1.5], alm:[3,0.3]},
  "LIC-003":{bar:[3,4,0.8], alm:[2,0.2]},
  "VIN-001":{bar:[6,4,1.2], alm:[3,0.2]},
  "CER-001":{bar:[35,40,24], alm:[20,0]},
  "BEB-001":{bar:[18,20,10], alm:[10,0]},
  "INS-001":{bar:[4,3,1.5], coc:[1,2,1], alm:[2,0]},
  "INS-002":{bar:[6,10,5], coc:[4,4,2], alm:[4,0]},
  "COC-001":{coc:[10,8,4], alm:[3,0]}
};
// compras del mes ya recibidas (forman parte del saldo de la tabla original)
const SEED_PURCHASES = [
  {date:"2026-11-03", sku:"CER-001", qty:120, net:408.00},
  {date:"2026-11-09", sku:"COC-001", qty:5,   net:49.00, lot:"L1109-001", exp:"2026-11-23"},
  {date:"2026-11-10", sku:"LIC-001", qty:12,  net:582.00},
  {date:"2026-11-12", sku:"INS-001", qty:4,   net:20.80, lot:"L1112-001", exp:"2026-11-27"},
  {date:"2026-11-17", sku:"BEB-001", qty:60,  net:114.00},
  {date:"2026-11-19", sku:"COC-001", qty:6,   net:58.80, lot:"L1119-001", exp:"2026-11-24"}
];
const SEED_PRODUCTS = [
  {code:"P001", name:"Ron cola",            point:"bar", price:18, yield:1, merma:0,  lines:[["LIC-001",45],["BEB-001",250],["INS-002",100]]},
  {code:"P002", name:"Pisco sour",          point:"bar", price:22, yield:1, merma:0,  lines:[["LIC-002",49],["INS-001",30],["INS-002",100]]},
  {code:"P003", name:"Whisky en las rocas", point:"bar", price:30, yield:1, merma:0,  lines:[["LIC-003",45],["INS-002",100]]},
  {code:"P004", name:"Cerveza lager",       point:"bar", price:12, yield:1, merma:0,  lines:[["CER-001",1]]},
  {code:"P005", name:"Gaseosa cola",        point:"bar", price:7,  yield:1, merma:0,  lines:[["BEB-001",500]]},
  {code:"P006", name:"Alitas de pollo",     point:"coc", price:28, yield:1, merma:10, lines:[["COC-001",400],["INS-001",20]]},
  {code:"P007", name:"Chilcano",            point:"bar", price:20, yield:1, merma:0,  lines:[["LIC-002",42],["INS-001",40],["INS-002",100]]},
  {code:"P008", name:"Copa de vino tinto",  point:"bar", price:16, yield:1, merma:0,  lines:[["VIN-001",150]]}
];
// último inventario cerrado (31/10/2026): diferencias contado − teórico
const SEED_LAST_COUNT = [
  ["LIC-001",-1.5],["LIC-002",-0.75],["LIC-003",-0.5],["VIN-001",-0.4],["CER-001",-6],["BEB-001",-2],["INS-001",-0.8],["INS-002",1],["COC-001",-1.2]
];

function seedState(){
  const s = {
    v:7, seq:1000, rev:0,
    settings:{cover:3, yellow:2, tolOk:2, tolRev:5, fcObj:30, ratioObj:35, mermaObj:1, cortObj:1.5, buyLimit:1000},
    closing:"2026-10-31",
    items:[], points:{}, movs:[], lots:[], products:[], mermas:[], sales:[], batches:[], dispatches:[], log:[],
    pos:[], daily:[], charges:[],
    count:{status:"none", values:{alm:{},bar:{},coc:{}}, by:null, at:null, date:null},
    lastCount:null
  };
  const nid = () => "m" + (++s.seq);
  SEED_ITEMS.forEach(r => {
    const bought = SEED_PURCHASES.filter(p => p.sku === r[0]).reduce((a,p) => a + p.qty, 0);
    s.items.push({sku:r[0], name:r[1], unit:r[2], cat:r[3], initial:r[4] - bought, cost:r[6], baseUnit:r[7], factor:r[8], portions:r[9], portionLabel:PORTION_LABEL[r[0]] || null});
    const pt = SEED_POINTS[r[0]], o = {};
    if (pt.bar) o.bar = {stock:pt.bar[0], min:pt.bar[1], daily:pt.bar[2]};
    if (pt.coc) o.coc = {stock:pt.coc[0], min:pt.coc[1], daily:pt.coc[2]};
    o.alm = {min:pt.alm[0], daily:pt.alm[1]};
    s.points[r[0]] = o;
  });
  SEED_PURCHASES.forEach(p => {
    s.movs.push({id:nid(), date:p.date, sku:p.sku, type:"compra", qty:p.qty, net:p.net, note:"Compra recibida" + (p.lot ? " · lote " + p.lot : ""), user:"lrobles"});
    if (p.exp) s.lots.push({id:"l" + (++s.seq), sku:p.sku, code:p.lot, qty:p.qty, left:p.qty, buy:p.date, exp:p.exp});
  });
  // merma aprobada del mes (2 cervezas rotas) + consumo acumulado
  s.mermas.push({id:"w" + (++s.seq), date:"2026-11-12", point:"bar", reason:"Rotura", note:"Caja golpeada al descargar", label:"Cerveza lager 330 ml",
    kind:"insumo", ref:"CER-001", qty:2, lines:[{sku:"CER-001", qty:2}], status:"aprobada", by:"barra", approvedBy:"ccastillo",
    history:[{ts:"12/11/2026 23:10", user:"barra", action:"Reportó"},{ts:"13/11/2026 10:02", user:"ccastillo", action:"Aprobó"}]});
  s.movs.push({id:nid(), date:"2026-11-12", sku:"CER-001", type:"merma", qty:-2, note:"Merma aprobada · Rotura", user:"ccastillo"});
  SEED_ITEMS.forEach(r => {
    const q = r[0] === "CER-001" ? r[5] - 2 : r[5];
    s.movs.push({id:nid(), date:"2026-11-19", sku:r[0], type:"salida", qty:-q, note:"Consumo acumulado 01–19/11", user:"sistema"});
  });
  // merma pendiente de aprobación
  s.mermas.push({id:"w" + (++s.seq), date:"2026-11-19", point:"bar", reason:"Derrame", note:"Se cayó la botella abierta", label:"Pisco quebranta 700 ml",
    kind:"insumo", ref:"LIC-002", qty:0.25, lines:[{sku:"LIC-002", qty:0.25}], status:"pendiente", by:"barra",
    history:[{ts:"19/11/2026 23:45", user:"barra", action:"Reportó"}]});
  SEED_PRODUCTS.forEach(p => s.products.push({
    code:p.code, name:p.name, point:p.point, price:p.price, yield:p.yield, merma:p.merma,
    lines:p.lines.map(l => ({sku:l[0], qty:l[1]})), photo:"seed:" + p.code
  }));
  s.lastCount = {date:"2026-10-31", by:"sadae", values:null, rows:SEED_LAST_COUNT.map(r => {
    const it = s.items.find(i => i.sku === r[0]);
    const counted = SEED_ITEMS.find(x => x[0] === r[0])[4]; // el conteo del 31/10 es el inicial de noviembre
    return {sku:r[0], theo:Math.round((counted - r[1]) * 100) / 100, counted:counted, diff:r[1], cost:it.cost};
  })};
  // solicitudes de compra: una aprobada por recibir y otra por aprobar
  s.pos.push({id:"OC-0101", date:"2026-11-19", by:"lrobles", status:"aprobada", approvedBy:"ccastillo", approvedAt:"19/11/2026 18:20", note:"Reposición de cerveza para el fin de semana",
    lines:[{sku:"CER-001", qty:120, est:408.00}], total:408.00});
  s.pos.push({id:"OC-0102", date:"2026-11-20", by:"lrobles", status:"solicitada", note:"Pollo y limón para alitas y pisco sour",
    lines:[{sku:"COC-001", qty:10, est:98.00},{sku:"INS-001", qty:6, est:31.20}], total:129.20});
  // cierre de turno del 19/11 en barra y cocina (apertura del 20/11)
  ["bar","coc"].forEach(pt => {
    const counts = {};
    s.items.forEach(it => { if (s.points[it.sku][pt]) counts[it.sku] = s.points[it.sku][pt].stock; });
    s.daily.push({id:"d" + (++s.seq), date:"2026-11-19", point:pt, by:"barra", at:"19/11/2026 23:55", counts:counts});
  });
  s.log.push({ts:"31/10/2026 23:40", user:"jdiego", role:"ger", action:"Cerró el inventario del 31/10/2026"});
  s.seen = {};  // posición de la bitácora en el último ingreso de cada persona
  Object.keys(USERS).forEach(u => { s.seen[u] = s.log.length; });
  return s;
}

/* ---------------- persistencia ---------------- */
let DB = load();
let REMOTE = {ready:!GAS, ver:0, timer:null, saving:false};
function load(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw){ const d = JSON.parse(raw); if (d && d.v === 7){ d.seen = d.seen || {}; return d; } }
  } catch(e){}
  return seedState();
}
function save(){
  DB.rev = (DB.rev || 0) + 1;
  let ok = true;
  try { localStorage.setItem(LS_KEY, JSON.stringify(DB)); }
  catch(e){ ok = false; if (!GAS) toast("No se pudo guardar en este navegador (almacenamiento lleno o bloqueado). Los cambios siguen en pantalla.", "warn"); }
  if (GAS) remoteSave();
  return ok || GAS;
}
/* ---- Google Apps Script: estado compartido en un archivo de Drive ---- */
function remoteLoad(cb){
  if (!GAS){ cb && cb(); return; }
  callRemote("cargar", null, txt => {
    try {
      const r = JSON.parse(txt);
      if (r.error) throw new Error(r.error);
      REMOTE.ver = r.ver || 0;
      if (r.estado && r.estado !== "null"){ const d = JSON.parse(r.estado); if (d && d.v === 7){ d.seen = d.seen || {}; DB = d; } }
      REMOTE.ok = true;
    } catch(e){ toast("La respuesta de Google Drive no es válida. Se usan los datos del navegador.", "warn"); }
    REMOTE.ready = true; cb && cb();
  }, () => { REMOTE.ready = true; toast("No se pudo leer los datos compartidos de Google Drive. Se usan los del navegador.", "warn"); cb && cb(); });
}
function remoteSave(){
  clearTimeout(REMOTE.timer);
  REMOTE.timer = setTimeout(() => {
    callRemote("guardar", {json:JSON.stringify(DB), ver:REMOTE.ver}, txt => {
      let r = {}; try { r = JSON.parse(txt); } catch(e){}
      if (r.ok){ REMOTE.ver = r.ver; return; }
      if (r.conflicto){
        try { const d = JSON.parse(r.estado); if (d && d.v === 7){ d.seen = d.seen || {}; DB = d; } } catch(e){}
        REMOTE.ver = r.ver;
        toast("Otra persona guardó cambios al mismo tiempo. Se cargaron los datos más recientes: repite tu última acción.", "warn");
        if (typeof render === "function" && SESSION) render();
        return;
      }
      toast("Google Drive no aceptó el guardado" + (r.error ? ": " + r.error : "") + ".", "err");
    }, () => toast("No se pudo guardar en Google Drive. Revisa tu conexión.", "err"));
  }, 700);
}
function resetDemo(){ DB = seedState(); try { localStorage.removeItem(LS_KEY); } catch(e){} save(); }
const nextId = (p) => (p || "x") + (++DB.seq);

/* ---------------- utilidades ---------------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const r2 = (n) => Math.round((+n || 0) * 100) / 100;
const r4 = (n) => Math.round((+n || 0) * 10000) / 10000;
const money = (n) => (n < 0 ? "−" : "") + "S/ " + Math.abs(r2(n)).toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2});
const num = (n, d) => { const v = Number((+n || 0).toFixed(d == null ? 2 : d)); return (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-US", {maximumFractionDigits:d == null ? 2 : d}); };
const pct = (n, d) => num(n, d == null ? 1 : d) + " %";
const fdate = (s) => s ? s.slice(8,10) + "/" + s.slice(5,7) + "/" + s.slice(0,4) : "—";
const validISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T00:00:00").getTime()) && new Date(s + "T00:00:00").toISOString().slice(0,10) === s;
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
const nowTs = () => { const d = new Date(); return fdate(DEMO_DATE) + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); };
const item = (sku) => DB.items.find(i => i.sku === sku);
const product = (code) => DB.products.find(p => p.code === code);
const photoOf = (p) => !p ? "" : (p.photo && p.photo.indexOf("seed:") === 0 ? (IMG[p.photo.slice(5)] || "") : (p.photo || ""));
const equiv = (it) => "1 " + it.unit + " = " + num(it.factor, 0) + " " + it.baseUnit + (it.portionLabel ? " = " + it.portions + " " + it.portionLabel + "s" : "");
const qtyTxt = (it, q) => num(q) + " " + it.unit + (it.factor !== 1 ? " · " + num(q * it.factor, 0) + " " + it.baseUnit : "");
/* fracciones para botellas abiertas: cuartos por defecto; el vino va en quintos (5 copas por botella) */
const FRAC_TXT = {4:["0","¼","½","¾"], 5:["0","0.2","0.4","0.6","0.8"]};
function fracsOf(it){
  const n = it.portions || 1; if (n <= 1) return [];
  return Array.from({length:n}, (_, i) => ({v:r4(i / n), t:(FRAC_TXT[n] || [])[i] || num(i / n, 2), title:it.portionLabel ? i + " " + it.portionLabel + (i === 1 ? "" : "s") : ""}));
}
const fracHint = (it) => it.portionLabel ? "1 " + it.portionLabel + " = " + num(1 / it.portions, 2) + " " + it.unit + " (" + num(it.factor / it.portions, 0) + " " + it.baseUnit + "). Ej.: 2 copas = 0.4 " + it.unit + "." : (it.portions > 1 ? "Para una unidad abierta usa ¼, ½ o ¾." : "");

/* ---------------- bitácora ---------------- */
let SESSION = null; // {user, role}
function logEv(action, who){
  const u = who || (SESSION ? SESSION.user : "—");
  const role = USERS[u] ? USERS[u].role : "—";
  DB.log.push({ts:nowTs(), user:u, role:role, action:action});
  if (DB.log.length > 800) DB.log.splice(0, DB.log.length - 800);
  save();
}
/* Cada función sensible vuelve a verificar el permiso. */
function need(perm, what){
  if (SESSION && can(SESSION.role, perm)) return true;
  logEv("Acción denegada: " + (what || PERM_LABELS[perm] || perm));
  toast("Tu rol no tiene permiso para " + (what || "esta acción") + ".", "err");
  return false;
}
