/* =========================================================
   Pantallas: Ventas POS, Catálogo y recetas, Reportes y bitácora
   ========================================================= */

/* ---------------- VENTAS POS ---------------- */
/* el ejemplo es el mismo contenido del Excel de prueba «ventas-prueba-con-cortesias.xlsx» */
const POS_HEAD = "fecha,codigo_pos,cantidad,tipo,precio_unit_con_igv,detalle";
const POS_EXAMPLE = window.STRAGOS_POS_EXAMPLE || POS_HEAD;
const POS_ERRORS = POS_HEAD + "\n2026-11-20,P001,3,venta,,\n20/11/2026,P002,2,venta,,\n2026-11-20,,4,venta,,\n2026-11-20,P004,0,venta,,\n2026-10-30,P005,2,venta,,\n2026-11-20,P002,1,regalo,,\n2026-11-20,P007,2,promo,,Happy hour Chilcano 2x1\n2026-11-20,P999,1,venta,,\n2026-11-20,P008,1,cortesia,0,";

function pos(){ if (!UI.pos) UI.pos = {text:"", prev:null, revertAsk:false}; return UI.pos; }
SCREENS.pos = () => {
  const P = pos();
  let h = phead("Ventas POS", "Sube el Excel o pega lo que exporta la caja. Ventas y promociones suman venta; las cortesías descuentan insumos pero no suman venta. Al confirmar se descuentan los insumos de cada receta en su punto y en el Kardex.");
  h += '<div class="card"><div class="field"><label for="pos-text">Ventas a cargar · columnas <code>' + POS_HEAD + '</code></label>' +
    '<textarea class="input" id="pos-text" data-in="pos-text" placeholder="2026-11-20,P001,8,venta,,">' + esc(P.text) + '</textarea>' +
    '<p class="help">tipo: <b>venta</b> (precio de carta), <b>promo</b> (precio cobrado en precio_unit_con_igv y nombre en detalle) o <b>cortesia</b> (sin cobro, motivo en detalle). Las 3 primeras columnas bastan para ventas normales.</p></div>' +
    '<div class="row" style="margin-top:12px"><label class="btn" for="pos-file">Elegir archivo (Excel o CSV)…</label><input type="file" id="pos-file" data-ch="pos-file" accept=".csv,.txt,.xlsx,.xls" hidden>' +
    '<button class="btn ghost" data-act="pos-prev">Previsualizar texto</button><button class="btn ghost" data-act="pos-ex" data-k="ok">Ejemplo con cortesías y promociones</button><button class="btn ghost" data-act="pos-ex" data-k="err">Ejemplo con errores</button><button class="btn ghost" data-act="pos-clear">Limpiar</button></div>' +
    (P.file ? '<p class="muted small" style="margin:8px 0 0">Archivo: ' + esc(P.file) + '</p>' : "") + '</div>';
  if (P.prev) h += posPreviewHtml(P.prev);
  h += '<h3 class="sec">Lotes de ventas cargados</h3>';
  if (DB.batches.length){
    h += '<div class="tw"><table><thead><tr><th>Lote</th><th>Cargado</th><th>Usuario</th><th class="n">Filas</th><th class="n">Venta neta</th><th class="n">Costo teórico</th></tr></thead><tbody>' +
      DB.batches.slice().reverse().map(b => { const ss = DB.sales.filter(s => s.batch === b.id); return '<tr><td class="sku">' + b.id + '</td><td class="num">' + esc(b.at) + '</td><td class="small">' + esc(USERS[b.user] ? USERS[b.user].name : b.user) + '</td><td class="n">' + ss.length + '</td><td class="n">' + money(ss.reduce((a, s) => a + s.net, 0)) + '</td><td class="n">' + money(ss.reduce((a, s) => a + s.cost, 0)) + '</td></tr>'; }).join("") + '</tbody></table></div>';
    h += P.revertAsk ? '<div class="box-warn" style="margin-top:12px;max-width:640px"><b>¿Revertir el lote ' + DB.batches[DB.batches.length - 1].id + '?</b><p style="margin:6px 0">Se restituyen exactamente el stock de cada punto, el Kardex y los lotes consumidos.</p><div class="row"><button class="btn danger" data-act="pos-revert-yes">Sí, revertir</button><button class="btn ghost" data-act="pos-revert-no">Cancelar</button></div></div>'
      : '<div class="row" style="margin-top:12px"><button class="btn ghost" data-act="pos-revert-ask">Revertir último lote…</button></div>';
  } else h += '<div class="empty"><b>Aún no hay ventas cargadas</b>Usa «Cargar ejemplo» para ver cómo se descuentan los insumos.</div>';
  return h;
};
function posPreviewHtml(pv){
  let h = '<h3 class="sec">Previsualización</h3><div class="badges" style="margin-bottom:12px">' + chip("", pv.rows.length + " filas") + chip(pv.errors.length ? "bad" : "ok", pv.errors.length + " errores", pv.errors.length ? "alert" : "check") + chip(pv.warnings.length ? "warn" : "", pv.warnings.length + " advertencias", pv.warnings.length ? "alert" : null) + '</div>';
  if (pv.errors.length) h += '<div class="box-err" style="margin-bottom:10px"><b>Errores que bloquean la carga</b><ul>' + pv.errors.map(e => '<li>Fila ' + e.fila + ' · columna <b>' + e.col + '</b>: ' + esc(e.msg) + '</li>').join("") + '</ul></div>';
  if (pv.warnings.length) h += '<div class="box-warn" style="margin-bottom:10px"><b>Advertencias</b><ul>' + pv.warnings.map(w => '<li>Fila ' + w.fila + ': ' + esc(w.msg) + '</li>').join("") + '</ul></div>';
  const issues = pv.rows.filter(r => r.err || r.warn);
  let rows = pv.rows;
  if (issues.length && issues.length < pv.rows.length){
    h += fchips("posRows", [{id:"issues", label:"Con problemas", n:issues.length, cls:"bad"},{id:"all", label:"Todas las filas", n:pv.rows.length}], "issues");
    if (UI.posRows === "issues") rows = issues;
  }
  const tchip = (t) => t === "cortesia" ? chip("warn", "Cortesía") : t === "promo" ? chip("acc", "Promoción") : t === "venta" ? chip("", "Venta") : chip("bad", "Tipo inválido");
  h += '<div class="tw"><table><thead><tr><th class="n">Fila</th><th>Fecha</th><th>Producto</th><th>Tipo</th><th class="n">Cantidad</th><th class="n">Precio</th><th class="n">Venta neta</th><th>Estado</th></tr></thead><tbody>' +
    rows.map(r => '<tr class="' + (r.err ? "hl" : r.warn ? "hw" : "") + '"><td class="n">' + r.fila + '</td><td class="num">' + (validISO(r.date) ? fdate(r.date) : esc(r.date)) + '</td><td>' +
      (r.product ? '<span class="row" style="gap:10px;flex-wrap:nowrap">' + (photoOf(r.product) ? '<img src="' + photoOf(r.product) + '" alt="" style="width:44px;height:33px;object-fit:cover;border-radius:4px">' : "") + '<span>' + esc(r.product.name) + ' <span class="sku">' + esc(r.code) + '</span></span></span>' : '<span class="sku">' + esc(r.code || "—") + '</span> <span class="muted small">sin receta</span>') +
      '</td><td>' + tchip(r.type) + (r.detail ? '<div class="muted small">' + esc(r.detail) + '</div>' : "") + '</td><td class="n">' + (isNaN(r.qty) ? "—" : num(r.qty)) + '</td><td class="n">' + (r.err ? "—" : money(r.unit || 0)) + '</td><td class="n">' + (r.product && !r.err ? money(r.qty * (r.unit || 0) / (1 + IGV)) : "—") + '</td><td>' + (r.err ? chip("bad", "Error", "alert") : r.warn ? chip("warn", "Advertencia", "alert") : chip("ok", "OK", "check")) + '</td></tr>').join("") + '</tbody></table></div>';
  h += '<div class="row" style="margin-top:12px">' + (pv.errors.length ? '<span class="muted small">Corrige los errores en el texto y vuelve a previsualizar.</span>' : '<button class="btn" data-act="pos-apply">Cargar ' + pv.valid.length + ' ventas</button>') + '<button class="btn ghost" data-act="pos-discard">Descartar</button></div>';
  return h;
}
INPUT["pos-text"] = (el) => { const P = pos(); P.text = el.value; if (P.prev){ P.prev = null; } };
ACT["pos-ex"] = (el) => { const P = pos(); P.file = null; P.text = el.dataset.k === "ok" ? POS_EXAMPLE : POS_ERRORS; P.prev = posPreview(P.text); render(); };
INPUT["pos-file"] = (el) => {
  const f = el.files && el.files[0]; el.value = ""; if (!f) return;
  const done = (cells) => { const P = pos(); P.file = f.name; P.text = cells.map(r => r.map(c => csvCell(c)).join(",")).join("\n"); P.prev = posPreview(P.text); render(); };
  if (/\.(xlsx|xls)$/i.test(f.name)){
    ensureXLSX().then(X => f.arrayBuffer().then(buf => {
      const wb = X.read(buf, {type:"array"}), sh = wb.Sheets[wb.SheetNames.indexOf("ventas") >= 0 ? "ventas" : wb.SheetNames[0]];
      done(X.utils.sheet_to_json(sh, {header:1, raw:false, defval:""}).filter(r => r.some(c => String(c).trim() !== "")));
    })).catch(() => toast("No se pudo leer el Excel: el lector (SheetJS) no cargó. Guarda el archivo como CSV y vuelve a intentarlo.", "err"));
  } else {
    const rd = new FileReader(); rd.onload = () => done(parseRows(String(rd.result)).map(r => r.cells)); rd.onerror = () => toast("No se pudo leer el archivo.", "err"); rd.readAsText(f);
  }
};
ACT["pos-prev"] = () => { const P = pos(); if (!P.text.trim()){ toast("Pega primero las ventas o usa un ejemplo.", "warn"); return; } P.prev = posPreview(P.text); render(); };
ACT["pos-clear"] = () => { UI.pos = null; render(); };
ACT["pos-discard"] = () => { pos().prev = null; render(); };
ACT["pos-apply"] = () => {
  const P = pos(); const pv = posPreview(P.text);
  const r = withUndo("Carga de " + pv.valid.length + " ventas POS", true, () => applyPos(pv));
  if (!r.ok){ if (r.err) toast(r.err, "err"); P.prev = pv; render(); return; }
  UI.pos = null; render();
  toast("Ventas cargadas: " + r.batch.rows.length + " filas. Se descontaron los insumos y los lotes por vencimiento.", "", {label:"Deshacer", fn:askUndo});
};
ACT["pos-revert-ask"] = () => { pos().revertAsk = true; render(); };
ACT["pos-revert-no"] = () => { pos().revertAsk = false; render(); };
ACT["pos-revert-yes"] = () => { const r = withUndo("Revertir el último lote de ventas", true, () => revertLastBatch()); pos().revertAsk = false; if (r.ok) toast("Lote " + r.batch.id + " revertido. Stock, Kardex y lotes quedaron como antes."); else toast(r.err, "err"); render(); };

/* ---------------- CATÁLOGO Y RECETAS ---------------- */
const IMP_HEAD = ["codigo_pos","nombre_producto","precio_venta_con_igv","punto_despacho","rendimiento_porciones","merma_preparacion_pct","sku_insumo","cantidad_base"];
const IMP_WARN = IMP_HEAD.join(",") + "\nP002,,,,1,0,LIC-002,60\nP002,,,,1,0,INS-001,30\nP002,,,,1,0,INS-002,100\nP011,Cuba libre doble,26,bar,1,0,LIC-001,90\nP011,,,,1,0,BEB-001,250\nP011,,,,1,0,INS-001,15\nP011,,,,1,0,INS-002,150";
const IMP_ERR = IMP_HEAD.join(",") + "\nP001,,,,1,0,LIC-009,45\nP003,,,,0,0,LIC-003,45\nP004,,,,1,120,CER-001,1\nP005,,,,1,0,BEB-001,0\nP012,,,bar,1,0,LIC-002,40\nP013,Limonada,9,xyz,1,0,INS-001,60";

function importValidate(cells){
  let rows = cells.filter(r => r.some(c => String(c).trim() !== ""));
  let map = IMP_HEAD.map((h, i) => i);
  if (rows.length && String(rows[0][0]).trim().toLowerCase() === "codigo_pos"){
    const head = rows.shift().map(c => String(c).trim().toLowerCase());
    map = IMP_HEAD.map(h => head.indexOf(h));
  }
  const get = (r, k) => { const i = map[IMP_HEAD.indexOf(k)]; return i >= 0 && r[i] != null ? String(r[i]).trim() : ""; };
  const out = rows.map((r, i) => {
    const o = {fila:i + 1, code:get(r, "codigo_pos").toUpperCase(), name:get(r, "nombre_producto"), price:get(r, "precio_venta_con_igv"), point:get(r, "punto_despacho").toLowerCase(),
      yieldS:get(r, "rendimiento_porciones"), mermaS:get(r, "merma_preparacion_pct"), sku:get(r, "sku_insumo").toUpperCase(), qtyS:get(r, "cantidad_base"), errs:[], warns:[]};
    o.qty = Number(o.qtyS.replace(",", ".")); o.yield = o.yieldS === "" ? 1 : Number(o.yieldS.replace(",", ".")); o.merma = o.mermaS === "" ? 0 : Number(o.mermaS.replace(",", "."));
    if (!o.code) o.errs.push("código POS vacío");
    if (!item(o.sku)) o.errs.push("el insumo «" + (o.sku || "vacío") + "» no existe en el catálogo");
    if (!(o.qty > 0)) o.errs.push("cantidad_base debe ser mayor que 0");
    if (!(o.yield > 0)) o.errs.push("rendimiento debe ser mayor que 0");
    if (!(o.merma >= 0 && o.merma <= 99)) o.errs.push("merma de preparación fuera de 0 a 99 %");
    if (o.point && o.point !== "bar" && o.point !== "coc") o.errs.push("punto «" + o.point + "» inválido: usa bar o coc");
    return o;
  });
  const codes = {};
  out.forEach(o => { if (o.code) (codes[o.code] = codes[o.code] || []).push(o); });
  Object.keys(codes).forEach(code => {
    const g = codes[code], first = g[0], p = product(code);
    if (p){
      if (p.lines.length) first.warns.push("ya tiene receta con " + p.lines.length + " insumos; será reemplazada");
    } else {
      const nm = (g.find(o => o.name) || {}).name, pr = Number(((g.find(o => o.price) || {}).price || "").replace(",", ".")), pt = (g.find(o => o.point) || {}).point;
      if (!nm || !(pr > 0)) first.errs.push("producto nuevo sin nombre o precio");
      else if (!pt) first.errs.push("producto nuevo sin punto de despacho (bar o coc)");
      else first.warns.push("el código no existe en el menú; se creará el producto “" + nm + "”");
      g.forEach(o => { o.newName = nm; o.newPrice = pr; o.newPoint = pt; });
    }
  });
  out.forEach(o => { o.state = o.errs.length ? "Error" : o.warns.length ? "Advertencia" : "OK"; });
  return {rows:out, nErr:out.filter(o => o.errs.length).length, nWarn:out.filter(o => o.warns.length && !o.errs.length).length, codes:Object.keys(codes)};
}
function applyImport(res){
  if (!need("recetas", "importar recetas")) return false;
  if (res.nErr) return false;
  const codes = {};
  res.rows.forEach(o => { (codes[o.code] = codes[o.code] || []).push(o); });
  Object.keys(codes).forEach(code => {
    const g = codes[code];
    let p = product(code);
    if (!p){ p = {code:code, name:g[0].newName, price:g[0].newPrice, point:g[0].newPoint, yield:1, merma:0, lines:[], photo:null}; DB.products.push(p); }
    p.yield = g[0].yield; p.merma = g[0].merma;
    p.lines = g.map(o => ({sku:o.sku, qty:o.qty}));   // la foto se conserva
  });
  logEv("Importó recetas (" + res.rows.length + " filas): " + Object.keys(codes).join(", "));
  save(); return true;
}
let xlsxPromise = null;
function ensureXLSX(){
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxPromise) xlsxPromise = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => window.XLSX ? res(window.XLSX) : rej(new Error("sin XLSX"));
    s.onerror = () => { xlsxPromise = null; rej(new Error("no cargó")); };
    document.head.appendChild(s);
  });
  return xlsxPromise;
}

SCREENS.recetas = () => {
  if (!UI.rsel || !product(UI.rsel)) UI.rsel = DB.products[0] ? DB.products[0].code : null;
  let h = phead("Catálogo y recetas", "Cada producto de la carta con su foto, su receta y su food cost. Las cantidades van en la unidad base del insumo (ml, g o und).");
  h += importCard();
  h += '<div class="cols-side" style="margin-top:20px"><div><div class="row" style="justify-content:space-between;margin-bottom:10px"><b>Productos (' + DB.products.length + ')</b><button class="btn sm ghost" data-act="rp-new">' + ic("plus") + 'Nuevo producto</button></div><div class="plist">' +
    DB.products.map(p => { const fc = foodCost(p), ph = photoOf(p); return '<button type="button" class="pitem' + (p.code === UI.rsel ? " on" : "") + '" data-act="rp-sel" data-c="' + esc(p.code) + '">' + (ph ? '<img src="' + ph + '" alt="">' : '<span class="ph">' + ic("camera") + '</span>') +
      '<span style="min-width:0"><b>' + esc(p.name) + '</b><span>' + esc(p.code) + ' · ' + money(p.price) + '</span></span>' + (p.lines.length ? chip(fcClass(fc), pct(fc)) : chip("warn", "Sin receta")) + '</button>'; }).join("") +
    '</div><p class="muted small" style="margin-top:10px">Food cost: verde hasta 30 %, ámbar hasta 35 %, rojo más.</p></div><div>' + (UI.rsel ? recipeDetail(product(UI.rsel)) : '<div class="empty">Crea el primer producto.</div>') + '</div></div>';
  return h;
};
function importCard(){
  const I = UI.imp;
  let h = '<details class="card"' + (I ? " open" : "") + '><summary style="cursor:pointer;font-weight:600">Importar recetas por código POS (Excel o CSV)</summary><div class="stack" style="margin-top:12px">' +
    '<p class="muted small" style="margin:0">Una fila por insumo. Nombre, precio y punto solo hacen falta si el código es nuevo. Punto: <code>bar</code> o <code>coc</code>.</p>' +
    '<div class="row"><label class="btn ghost" for="imp-file">Elegir archivo…</label><input type="file" id="imp-file" data-ch="imp-file" accept=".csv,.txt,.xlsx,.xls" hidden>' +
    '<button class="btn ghost" data-act="imp-ex" data-k="w">Ejemplo con advertencias</button><button class="btn ghost" data-act="imp-ex" data-k="e">Ejemplo con errores</button><button class="btn ghost" data-act="imp-head">Copiar encabezados</button></div>';
  if (I && I.msg) h += '<div class="box-err">' + esc(I.msg) + '</div>';
  if (I && I.res){
    const R = I.res;
    h += '<div class="row"><b>' + esc(I.name) + '</b><div class="badges">' + chip("", R.rows.length + " filas") + chip(R.nErr ? "bad" : "ok", R.nErr + " errores", R.nErr ? "alert" : "check") + chip(R.nWarn ? "warn" : "", R.nWarn + " advertencias", R.nWarn ? "alert" : null) + '</div></div>';
    h += '<div class="tw"><table><thead><tr><th class="n">Fila</th><th>Código POS</th><th>Insumo</th><th class="n">Cantidad base</th><th class="n">Rend.</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>' +
      R.rows.map(o => { const it = item(o.sku); return '<tr class="' + (o.state === "Error" ? "hl" : o.state === "Advertencia" ? "hw" : "") + '"><td class="n">' + o.fila + '</td><td class="sku">' + esc(o.code || "—") + '</td><td>' + (it ? esc(it.name) : '<span class="sku">' + esc(o.sku || "—") + '</span>') + '</td><td class="n">' + esc(o.qtyS) + (it ? " " + it.baseUnit : "") + '</td><td class="n">' + esc(o.yieldS || "1") + '</td><td>' +
        chip(o.state === "Error" ? "bad" : o.state === "Advertencia" ? "warn" : "ok", o.state, o.state === "OK" ? "check" : "alert") + '</td><td class="small">' + esc(o.errs.concat(o.warns).join("; ")) + '</td></tr>'; }).join("") + '</tbody></table></div>';
    if (R.nErr) h += '<div class="row"><span class="muted small">Corrige los errores en el archivo para poder confirmar la carga.</span><button class="btn ghost" data-act="imp-discard">Descartar</button></div>';
    else if (!I.ask) h += '<div class="row"><button class="btn" data-act="imp-ask">Confirmar carga…</button><button class="btn ghost" data-act="imp-discard">Descartar</button></div>';
    else h += '<div class="box-warn"><b>¿Cargar ' + R.codes.length + (R.codes.length === 1 ? " receta" : " recetas") + ' (' + R.codes.join(", ") + ')?</b> Las recetas existentes se reemplazan; sus fotos se conservan.<div class="row" style="margin-top:8px"><button class="btn" data-act="imp-yes">Sí, cargar</button><button class="btn ghost" data-act="imp-no">Cancelar</button></div></div>';
  }
  return h + '</div></details>';
}
ACT["imp-ex"] = (el) => { UI.imp = {name:el.dataset.k === "w" ? "Ejemplo con advertencias" : "Ejemplo con errores", res:importValidate(parseRows(el.dataset.k === "w" ? IMP_WARN : IMP_ERR).map(r => r.cells))}; render(); };
ACT["imp-head"] = () => copyText(IMP_HEAD.join(","), "Encabezados");
ACT["imp-discard"] = () => { UI.imp = null; render(); };
ACT["imp-ask"] = () => { UI.imp.ask = true; render(); };
ACT["imp-no"] = () => { UI.imp.ask = false; render(); };
ACT["imp-yes"] = () => { const R = UI.imp.res; if (withUndo("Importar recetas " + R.codes.join(", "), true, () => applyImport(R))){ toast("Recetas cargadas: " + R.codes.join(", ") + "."); UI.rsel = R.codes[0]; UI.imp = null; } render(); };
INPUT["imp-file"] = (el) => {
  const f = el.files && el.files[0]; if (!f) return;
  const name = f.name;
  if (/\.(xlsx|xls)$/i.test(name)){
    ensureXLSX().then(X => f.arrayBuffer().then(buf => {
      const wb = X.read(buf, {type:"array"}); const sh = wb.Sheets[wb.SheetNames[0]];
      UI.imp = {name:name, res:importValidate(X.utils.sheet_to_json(sh, {header:1, raw:false, defval:""}))}; render();
    })).catch(() => { UI.imp = {name:name, msg:"No se pudo leer el Excel: el lector (SheetJS) no cargó en este navegador. Guarda el archivo como CSV y vuelve a intentarlo."}; render(); });
  } else {
    const rd = new FileReader();
    rd.onload = () => { UI.imp = {name:name, res:importValidate(parseRows(String(rd.result)).map(r => r.cells))}; render(); };
    rd.onerror = () => { UI.imp = {name:name, msg:"No se pudo leer el archivo."}; render(); };
    rd.readAsText(f);
  }
  el.value = "";
};

function recipeDetail(p){
  const ph = photoOf(p), cost = recipeCost(p), fc = foodCost(p), net = netPrice(p);
  const avail = DB.items.filter(i => !p.lines.some(l => l.sku === i.sku));
  let h = '<div class="card"><div class="detail-top"><div><div class="photo-box">' + (ph ? '<img class="ph-img" src="' + ph + '" alt="Foto de ' + esc(p.name) + '">' : '<img class="ph-logo" src="' + (IMG.logo || "") + '" alt=""><span>Sin foto</span>') + '</div>' +
    '<div class="row" style="margin-top:10px"><label class="btn sm ghost" for="rp-photo">' + ic("camera") + (ph ? "Cambiar foto" : "Subir foto") + '</label><input type="file" id="rp-photo" accept="image/*" data-ch="rp-photo" hidden><span class="muted small">Se recorta a 4:3 y lleva el logotipo arriba a la derecha.</span></div></div>' +
    '<div class="stack"><div class="field"><label for="rp-name">Nombre</label><input class="input" id="rp-name" data-ch="rp-f" data-k="name" maxlength="60" value="' + esc(p.name) + '"></div>' +
    '<div class="grid-form" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))"><div class="field"><span class="lbl">Código POS</span><input class="input" value="' + esc(p.code) + '" readonly aria-label="Código POS"></div>' +
    '<div class="field"><label for="rp-point">Punto</label><select class="input" id="rp-point" data-ch="rp-f" data-k="point"><option value="bar"' + (p.point === "bar" ? " selected" : "") + '>Barra</option><option value="coc"' + (p.point === "coc" ? " selected" : "") + '>Cocina</option></select></div>' +
    '<div class="field"><label for="rp-price">Precio con IGV (S/)</label><input class="input" id="rp-price" data-ch="rp-f" data-k="price" inputmode="decimal" value="' + p.price + '"></div>' +
    '<div class="field"><label for="rp-yield">Rendimiento (porciones)</label><input class="input" id="rp-yield" data-ch="rp-f" data-k="yield" inputmode="decimal" value="' + p.yield + '"></div>' +
    '<div class="field"><label for="rp-merma">Merma de preparación (%)</label><input class="input" id="rp-merma" data-ch="rp-f" data-k="merma" inputmode="decimal" value="' + p.merma + '"></div></div></div></div>';
  h += '<h3 class="sec">Insumos de la receta</h3>';
  h += p.lines.length ? '<div class="tw"><table><thead><tr><th>Insumo</th><th class="n">Cantidad (receta)</th><th class="n">Consumo por venta</th><th class="n">Costo</th><th></th></tr></thead><tbody>' +
    p.lines.map((l, i) => { const it = item(l.sku), use = recipeUse(p, l); return '<tr><td>' + esc(it.name) + '<div class="sku">' + it.sku + '</div></td><td class="n"><input class="input qty" inputmode="decimal" data-ch="rp-line" data-i="' + i + '" value="' + l.qty + '" aria-label="Cantidad de ' + esc(it.name) + ' en ' + it.baseUnit + '"> ' + it.baseUnit + '</td><td class="n">' + num(use, 1) + ' ' + it.baseUnit + '<div class="muted small">' + num(use / it.factor, 4) + ' ' + it.unit + '</div></td><td class="n">' + money(use / it.factor * it.cost) + '</td><td><button class="btn sm danger" data-act="rp-del" data-i="' + i + '">Quitar</button></td></tr>'; }).join("") +
    '</tbody></table></div>' : '<div class="empty"><b>Esta receta no tiene insumos</b>Mientras no tenga receta, sus ventas no descuentan inventario.</div>';
  h += '<div class="row" style="margin-top:12px"><select class="input" id="rp-add" style="max-width:320px" aria-label="Insumo para agregar"><option value="">Agregar insumo…</option>' + avail.map(i => '<option value="' + i.sku + '">' + esc(i.name) + ' (' + i.baseUnit + ')</option>').join("") + '</select><button class="btn ghost" data-act="rp-add">' + ic("plus") + 'Agregar</button></div>';
  h += '<p class="note" style="margin-top:14px">Consumo por venta = cantidad × (cantidad base ÷ rendimiento) ÷ (1 − merma de preparación). Food cost = costo de la receta ÷ precio sin IGV (' + money(p.price) + ' ÷ 1.18 = ' + money(net) + ').</p>';
  h += '<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:14px">' +
    '<div class="kpi"><span class="k">Costo de la receta</span><span class="v">' + money(cost) + '</span><span class="s">por porción, sin IGV</span></div>' +
    '<div class="kpi"><span class="k">Food cost</span><span class="v">' + pct(fc) + '</span><span class="s">' + chip(fcClass(fc), fc <= 30 ? "Saludable" : fc <= 35 ? "En el límite" : "Alto", semIcon(fcClass(fc))) + '</span></div>' +
    '<div class="kpi"><span class="k">Margen sin IGV</span><span class="v">' + money(net - cost) + '</span><span class="s">' + (net > 0 ? pct((net - cost) / net * 100) + " del precio neto" : "") + '</span></div></div>';
  return h + '</div>';
}
ACT["rp-sel"] = (el) => { UI.rsel = el.dataset.c; render(); };
ACT["rp-new"] = () => {
  if (!need("recetas", "crear productos")) return;
  let n = 1; while (product("P" + String(n).padStart(3, "0"))) n++;
  const code = "P" + String(n).padStart(3, "0");
  withUndo("Crear el producto " + code, false, () => { DB.products.push({code:code, name:"Nuevo producto", point:"bar", price:10, yield:1, merma:0, lines:[], photo:null}); logEv("Creó el producto " + code); return true; });
  UI.rsel = code; render();
  toast("Producto " + code + " creado. Ponle nombre, precio y receta.");
  setTimeout(() => { const i = $("rp-name"); if (i){ i.focus(); i.select(); } }, 30);
};
INPUT["rp-f"] = (el) => {
  if (!need("recetas", "editar recetas")) return;
  const p = product(UI.rsel), k = el.dataset.k; let v = el.value.trim();
  if (k === "name"){ if (!v){ toast("El nombre no puede quedar vacío.", "err"); render(); return; } }
  else if (k !== "point"){
    v = Number(v.replace(",", "."));
    if (k === "price" && !(v > 0)){ toast("El precio debe ser mayor que 0.", "err"); render(); return; }
    if (k === "yield" && !(v > 0)){ toast("El rendimiento debe ser mayor que 0.", "err"); render(); return; }
    if (k === "merma" && !(v >= 0 && v <= 99)){ toast("La merma de preparación va de 0 a 99 %.", "err"); render(); return; }
  }
  const old = p[k];
  withUndo("Editar " + p.name + " (" + k + ")", false, () => { p[k] = v; logEv("Editó " + p.code + ": " + k + " " + old + " → " + v); return true; });
  render();
};
INPUT["rp-line"] = (el) => {
  if (!need("recetas", "editar recetas")) return;
  const p = product(UI.rsel), v = Number(el.value.replace(",", "."));
  if (!(v > 0)){ toast("La cantidad debe ser mayor que 0. Usa «Quitar» para sacar el insumo.", "err"); render(); return; }
  const i = +el.dataset.i, l0 = p.lines[i];
  withUndo("Editar receta de " + p.name, false, () => { const l = product(UI.rsel).lines[i]; logEv("Editó receta " + p.code + ": " + l0.sku + " " + l0.qty + " → " + v); l.qty = v; return true; });
  render();
};
ACT["rp-del"] = (el) => { if (!need("recetas", "editar recetas")) return; const p = product(UI.rsel); withUndo("Quitar insumo de " + p.name, false, () => { const l = product(UI.rsel).lines.splice(+el.dataset.i, 1)[0]; logEv("Quitó " + l.sku + " de la receta " + p.code); return true; }); render(); toast("Insumo quitado.", "", {label:"Deshacer", fn:askUndo}); };
ACT["rp-add"] = () => {
  if (!need("recetas", "editar recetas")) return;
  const sku = $("rp-add").value; if (!sku){ toast("Elige un insumo para agregar.", "warn"); return; }
  const p = product(UI.rsel), it = item(sku);
  withUndo("Agregar insumo a " + p.name, false, () => { product(UI.rsel).lines.push({sku:sku, qty:it.baseUnit === "und" ? 1 : 30}); logEv("Agregó " + sku + " a la receta " + p.code); return true; }); render();
  toast("Insumo agregado con una cantidad inicial. Ajústala en la tabla.");
};

/* --- foto por receta: recorte 4:3 + logotipo arriba a la derecha --- */
const LOGO_IMG = new Image(); if (IMG.logo) LOGO_IMG.src = IMG.logo;
function brandPhoto(img){
  const W = 640, H = 480, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const r = Math.max(W / img.width, H / img.height), w = img.width * r, h = img.height * r;
  x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  const g = x.createRadialGradient(W * 0.88, 0, 10, W * 0.88, 0, W * 0.5);
  g.addColorStop(0, "rgba(0,0,0,0.62)"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (LOGO_IMG.complete && LOGO_IMG.naturalWidth){ const lw = W * 0.3, lh = lw * LOGO_IMG.naturalHeight / LOGO_IMG.naturalWidth; x.drawImage(LOGO_IMG, W - lw - W * 0.04, H * 0.045, lw, lh); }
  return c.toDataURL("image/jpeg", 0.82);
}
INPUT["rp-photo"] = (el) => {
  const f = el.files && el.files[0]; el.value = ""; if (!f) return;
  if (!/^image\//.test(f.type)){ toast("El archivo no es una imagen.", "err"); return; }
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const data = brandPhoto(img), code = UI.rsel;
      openSheet('<h3>Vista previa de la foto</h3><img src="' + data + '" alt="Vista previa" style="width:100%;border-radius:10px;display:block"><p class="muted small">640 × 480 px, con el logotipo de Stragos arriba a la derecha.</p><div class="row"><button class="btn" data-act="photo-save">Guardar foto</button><button class="btn ghost" data-act="sheet-close">Cancelar</button></div>');
      UI.pendingPhoto = {code:code, data:data};
    };
    img.onerror = () => toast("No se pudo abrir la imagen.", "err");
    img.src = String(rd.result);
  };
  rd.readAsDataURL(f);
};
ACT["photo-save"] = () => {
  const pp = UI.pendingPhoto; if (!pp || !need("recetas", "cambiar fotos")) return;
  const p = product(pp.code), old = p.photo;
  const r = withUndo("Cambiar la foto de " + p.name, false, () => { p.photo = pp.data; if (!save()){ p.photo = old; return false; } logEv("Cambió la foto de " + p.code + " · " + p.name); return true; });
  if (r) toast("Foto guardada.", "", {label:"Deshacer", fn:askUndo});
  UI.pendingPhoto = null; closeSheet(); render();
};

/* ---------------- REPORTES Y BITÁCORA ---------------- */
SCREENS.reportes = () => {
  let h = phead("Reportes y bitácora", "Reportes para copiar y pegar en Excel, la matriz de permisos y el registro de todo lo que pasó.");
  h += tabs("reportesTab", [{id:"lotes", label:"Lotes por vencer"},{id:"kardex", label:"Kardex valorizado"},{id:"permisos", label:"Matriz de permisos"},{id:"bitacora", label:"Bitácora"},{id:"bd", label:"Guardar BD (Make)"}], "lotes");
  const t = UI.reportesTab;
  if (t === "lotes"){
    const hz = UI.hz || 7;
    const rows = DB.lots.filter(l => l.left > 0.0001).map(l => ({l:l, s:lotStatus(l), it:item(l.sku)})).filter(x => x.s.d <= hz).sort((a, b) => a.l.exp < b.l.exp ? -1 : 1);
    const venc = rows.filter(x => x.s.d < 0).length, risk = rows.reduce((a, x) => a + x.l.left * x.it.cost, 0);
    h += '<div class="row" style="margin-bottom:14px"><span class="muted">Horizonte:</span><div class="tabs" style="margin:0">' + [7,15,30].map(d => '<button type="button" class="' + (hz === d ? "on" : "") + '" data-act="hz" data-d="' + d + '">' + d + ' días</button>').join("") + '</div></div>';
    h += '<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="kpi"><span class="k">Lotes en el horizonte</span><span class="v">' + rows.length + '</span></div><div class="kpi"><span class="k">Vencidos</span><span class="v' + (venc ? " bad" : "") + '">' + venc + '</span></div><div class="kpi"><span class="k">Valor en riesgo</span><span class="v">' + money(risk) + '</span><span class="s">Lo que queda, a costo promedio</span></div></div>';
    h += rows.length ? '<div class="tw" style="margin-top:14px"><table><thead><tr><th>Insumo</th><th>Lote</th><th class="n">Queda</th><th>Vence</th><th class="n">Días</th><th class="n">Valor</th><th>Estado</th></tr></thead><tbody>' +
      rows.map(x => '<tr><td>' + esc(x.it.name) + '</td><td class="sku">' + esc(x.l.code) + '</td><td class="n">' + num(x.l.left) + ' ' + x.it.unit + '</td><td class="num">' + fdate(x.l.exp) + '</td><td class="n">' + x.s.d + '</td><td class="n">' + money(x.l.left * x.it.cost) + '</td><td>' + chip(x.s.c, x.s.k, semIcon(x.s.c)) + '</td></tr>').join("") + '</tbody></table></div>'
      : '<div class="empty" style="margin-top:14px"><b>Ningún lote vence en ' + hz + ' días</b></div>';
    h += '<div class="row" style="margin-top:12px"><button class="btn ghost" data-act="csv-lotes">Copiar como CSV</button></div>';
  } else if (t === "kardex"){
    const rows = DB.items.map(it => kardexRow(it.sku));
    const tot = rows.reduce((a, r) => a + r.saldo * r.it.cost, 0);
    h += '<div class="tw"><table><thead><tr><th>SKU</th><th>Insumo</th><th>Unidad</th><th class="n">Inicial</th><th class="n">Entradas</th><th class="n">Salidas</th><th class="n">Saldo</th><th class="n">Costo prom.</th><th class="n">Valor</th></tr></thead><tbody>' +
      rows.map(r => '<tr><td class="sku">' + r.it.sku + '</td><td>' + esc(r.it.name) + '</td><td>' + r.it.unit + '</td><td class="n">' + num(r.initial) + '</td><td class="n">' + num(r.ent) + '</td><td class="n">' + num(r.sal) + '</td><td class="n">' + num(r.saldo) + '</td><td class="n">' + money(r.it.cost) + '</td><td class="n">' + money(r.saldo * r.it.cost) + '</td></tr>').join("") +
      '</tbody><tfoot><tr><td colspan="8">Valor total sin IGV</td><td class="n">' + money(tot) + '</td></tr></tfoot></table></div><div class="row" style="margin-top:12px"><button class="btn ghost" data-act="csv-kardex">Copiar como CSV</button></div>';
  } else if (t === "permisos"){
    const rk = Object.keys(ROLES);
    h += '<div class="tw"><table><thead><tr><th>Módulo o acción</th>' + rk.map(r => '<th>' + esc(ROLES[r].short) + '</th>').join("") + '</tr></thead><tbody>' +
      Object.keys(PERMS).map(p => '<tr><td>' + esc(PERM_LABELS[p]) + '</td>' + rk.map(r => '<td>' + (can(r, p) ? chip("ok", "Sí", "check") : '<span class="muted">No</span>') + '</td>').join("") + '</tr>').join("") + '</tbody></table></div>';
    h += '<h3 class="sec">Cuentas</h3><div class="tw"><table><thead><tr><th>Persona</th><th>Usuario</th><th>Rol</th></tr></thead><tbody>' + Object.keys(USERS).map(u => '<tr><td>' + esc(USERS[u].name) + '</td><td class="sku">' + u + '</td><td>' + esc(ROLES[USERS[u].role].label) + '</td></tr>').join("") + '</tbody></table></div>';
    h += '<p class="note" style="margin-top:14px">Esta tabla se genera desde la misma matriz que usan los menús, las rutas y cada botón.</p>';
  } else if (t === "bd"){
    h += bdConfigHtml();
  } else {
    h += fchips("btc", LOG_CATS.map(c => ({id:c.id, label:c.label, n:DB.log.filter(l => c.re.test(l.action)).length, cls:c.id === "accesos" ? "bad" : ""})), "todo");
    h += '<div class="row" style="margin-bottom:12px"><div class="field" style="flex:1;max-width:420px"><input class="input" id="bt-q" data-in="bt-q" placeholder="Filtrar por usuario o acción…" value="' + esc(UI.btq || "") + '" aria-label="Filtrar bitácora"></div><span class="muted small">Solo lectura · ' + DB.log.length + ' registros</span></div>';
    h += '<div class="tw"><table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Rol</th><th>Acción</th></tr></thead><tbody id="bt-body">' + logRows() + '</tbody></table></div>';
  }
  return h;
};
function logRows(){
  const q = (UI.btq || "").trim().toLowerCase();
  const cat = LOG_CATS.find(c => c.id === (UI.btc || "todo")) || LOG_CATS[0];
  const rows = DB.log.slice().reverse().filter(l => cat.re.test(l.action)).filter(l => !q || (l.user + " " + (USERS[l.user] ? USERS[l.user].name : "") + " " + l.action).toLowerCase().indexOf(q) >= 0).slice(0, 300);
  if (!rows.length) return '<tr><td colspan="4" class="muted">Sin registros para ese filtro.</td></tr>';
  return rows.map(l => '<tr class="' + (/denegad|fallido|bloquead/i.test(l.action) ? "hl" : "") + '"><td class="num" style="white-space:nowrap">' + esc(l.ts) + '</td><td>' + esc(USERS[l.user] ? USERS[l.user].name : l.user) + '</td><td class="small">' + esc(ROLES[l.role] ? ROLES[l.role].short : "—") + '</td><td>' + esc(l.action) + '</td></tr>').join("");
}
INPUT["bt-q"] = (el) => { UI.btq = el.value; $("bt-body").innerHTML = logRows(); };
ACT["hz"] = (el) => { UI.hz = +el.dataset.d; render(); };
ACT["csv-lotes"] = () => {
  const hz = UI.hz || 7;
  const rows = DB.lots.filter(l => l.left > 0.0001 && lotStatus(l).d <= hz).map(l => { const it = item(l.sku), s = lotStatus(l); return [it.sku, it.name, l.code, r4(l.left), it.unit, fdate(l.exp), s.d, r2(l.left * it.cost), s.k]; });
  copyText(toCSV([["sku","insumo","lote","queda","unidad","vence","dias","valor_sin_igv","estado"]].concat(rows)), "Reporte de lotes");
};
ACT["csv-kardex"] = () => {
  const rows = DB.items.map(it => { const k = kardexRow(it.sku); return [it.sku, it.name, it.unit, k.initial, k.ent, k.sal, k.saldo, r4(it.cost), r2(k.saldo * it.cost)]; });
  copyText(toCSV([["sku","insumo","unidad","inicial","entradas","salidas","saldo","costo_promedio","valor_sin_igv"]].concat(rows)), "Kardex valorizado");
};

/* ---------------- arranque ---------------- */
lgUser.value ? lgPass.focus({preventScroll:true}) : lgUser.focus({preventScroll:true});
if (GAS){ lgBtn.disabled = true; lgBtn.textContent = "Cargando datos del equipo…"; remoteLoad(() => { lgBtn.disabled = false; lgBtn.textContent = "Ingresar"; }); }
})();
