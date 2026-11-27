/* =========================================================
   Pantallas: Conteo físico, Kardex y lotes, Pedido y transferencias
   ========================================================= */

/* ---------------- CONTEO ---------------- */
SCREENS.conteo = (V) => SESSION.role === "aud" ? countAuditor(V) : countCompare(V);

function countAuditor(V){
  const c = V.count;
  let h = phead("Conteo físico", "Cuenta lo que ves, punto por punto. No verás el saldo del sistema: así el conteo es a ciego.");
  if (c.status === "sent") return h + '<div class="box-ok" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' + ic("lock") + '<div style="flex:1;min-width:220px"><b>Conteo enviado el ' + esc(c.at) + ' por ' + esc(USERS[c.by] ? USERS[c.by].name : c.by) + '.</b><br>Quedó bloqueado. La administración lo comparará con el teórico.</div>' + bdButton("conteo_fisico") + '</div>';
  if (c.status === "closed") return h + '<div class="empty"><b>No hay un conteo abierto</b>El último inventario ya se cerró. Gerencia abrirá el siguiente conteo.</div>';
  const pr = countProgress();
  const pt = UI.conteoPt && pr.byPt[UI.conteoPt] ? UI.conteoPt : "bar";
  UI.conteoPt = pt;
  if (UI.countReview) return h + countReview(V, pr);
  h += '<div class="tabs">' + ["bar","coc","alm"].map(p => '<button type="button" class="' + (p === pt ? "on" : "") + '" data-act="count-tab" data-pt="' + p + '">' + POINTS[p] + ' · ' + pr.byPt[p].done + '/' + pr.byPt[p].total + '</button>').join("") + '</div>';
  h += '<div class="row" style="margin-bottom:12px"><div style="flex:1;min-width:200px"><div class="prog"><i id="count-bar" style="width:' + (pr.total ? pr.done / pr.total * 100 : 0) + '%"></i></div></div><span class="muted small" id="count-txt">' + pr.done + ' de ' + pr.total + ' registros · borrador guardado</span></div>';
  const all = V.items.filter(i => i.points.indexOf(pt) >= 0);
  const pend = all.filter(i => c.values[pt][i.sku] === undefined);
  h += '<div class="row" style="justify-content:space-between;gap:8px">' + fchips("countFilter", [{id:"all", label:"Todos", n:all.length},{id:"pending", label:"Sin contar", n:pend.length, cls:pend.length ? "bad" : ""}], "all") +
    '<button class="btn sm ghost" data-act="count-goto" style="margin-bottom:12px">Ir al siguiente sin contar</button></div>';
  const list = UI.countFilter === "pending" ? pend : all;
  if (!list.length) h += '<div class="empty"><b>Todo contado en ' + POINTS[pt] + '</b>Pasa al siguiente punto o revisa y envía.</div>';
  h += '<p class="muted small" style="margin:0 0 8px">Consejo: escribe la cantidad y presiona Enter para pasar al siguiente insumo.</p>';
  h += '<div class="count-list">' + list.map(i => {
    const v = c.values[pt][i.sku], has = v !== undefined;
    const frac = has ? r2(v - Math.floor(v)) : null;
    return '<div class="count-item' + (has ? " done" : "") + '" id="ci-' + pt + '-' + i.sku + '"><span class="cat">' + ic(i.cat) + '</span>' +
      '<div class="nm"><b>' + esc(i.name) + '</b><span>Cuenta en ' + esc(i.unit) + (i.factor !== 1 ? ' · ' + esc(equiv(i)) : "") + (i.portionLabel ? ' · ' + esc(fracHint(i)) : "") + '</span></div>' +
      '<div class="inp"><input class="input" inputmode="decimal" enterkeyhint="next" data-in="count" data-pt="' + pt + '" data-sku="' + i.sku + '" id="cnt-' + pt + '-' + i.sku + '" value="' + (has ? v : "") + '" placeholder="—" aria-label="Cantidad contada de ' + esc(i.name) + ' en ' + esc(i.unit) + '">' +
      (i.portions > 1 ? '<div class="fracs" aria-label="Fracción">' + fracButtons(i, "count-frac", 'data-pt="' + pt + '" data-sku="' + i.sku + '"', has ? v : null) + '</div>' : "") +
      '</div></div>';
  }).join("") + '</div>';
  const nextPt = {bar:"coc", coc:"alm", alm:null}[pt];
  h += '<div class="row" style="margin-top:18px">' + (nextPt ? '<button class="btn ghost" id="count-next" data-act="count-tab" data-pt="' + nextPt + '">Siguiente: ' + POINTS[nextPt] + '</button>' : "") + '<span class="spacer"></span><button class="btn" data-act="count-review">Revisar y enviar</button></div>';
  return h;
}
function countReview(V, pr){
  const miss = [];
  ["bar","coc","alm"].forEach(pt => V.items.forEach(i => { if (i.points.indexOf(pt) >= 0 && V.count.values[pt][i.sku] === undefined) miss.push(i.name + " · " + POINTS[pt]); }));
  let h = '<div class="card" style="max-width:720px"><h4>Antes de enviar</h4><p class="muted small">Llevas ' + pr.done + ' de ' + pr.total + ' registros. Al enviar, el conteo queda bloqueado y ya no podrás corregirlo.</p>';
  h += miss.length ? '<div class="box-warn"><b>Sin contar (' + miss.length + '):</b><ul>' + miss.map(m => "<li>" + esc(m) + "</li>").join("") + '</ul>Se tomarán como 0.</div>' : '<div class="box-ok">Contaste todos los insumos de los tres puntos.</div>';
  h += '<div class="row" style="margin-top:16px"><button class="btn ghost" data-act="count-back">Volver a contar</button><button class="btn" data-act="count-send">Enviar conteo y bloquear</button></div></div>';
  return h;
}
ACT["count-tab"] = (el) => { UI.conteoPt = el.dataset.pt; render(); window.scrollTo(0, 0); };
ACT["count-review"] = () => { UI.countReview = true; render(); };
ACT["count-back"] = () => { UI.countReview = false; render(); };
ACT["count-send"] = () => { if (submitCount()){ irreversible(); UI.countReview = false; toast("Conteo enviado. Quedó bloqueado y no se puede deshacer."); render(); } };
function countRefresh(pt, sku){
  const pr = countProgress(), el = $("ci-" + pt + "-" + sku), v = DB.count.values[pt][sku];
  if (el) el.classList.toggle("done", v !== undefined);
  if ($("count-bar")) $("count-bar").style.width = (pr.total ? pr.done / pr.total * 100 : 0) + "%";
  if ($("count-txt")) $("count-txt").textContent = pr.done + " de " + pr.total + " registros · borrador guardado";
  document.querySelectorAll('[data-act="count-frac"][data-pt="' + pt + '"][data-sku="' + sku + '"]').forEach(b => {
    b.classList.toggle("on", v !== undefined && Math.abs(r2(v - Math.floor(v)) - +b.dataset.f) < 0.001);
  });
  document.querySelectorAll('[data-act="count-tab"]').forEach(b => { const p = b.dataset.pt; if (pr.byPt[p] && b.closest(".tabs")) b.textContent = POINTS[p] + " · " + pr.byPt[p].done + "/" + pr.byPt[p].total; });
}
INPUT["count"] = (el) => {
  const raw = el.value.replace(",", ".").trim();
  const v = raw === "" ? "" : Number(raw);
  if (raw !== "" && (isNaN(v) || v < 0)){ el.setAttribute("aria-invalid", "true"); return; }
  el.removeAttribute("aria-invalid");
  setCountValue(el.dataset.pt, el.dataset.sku, v);
  countRefresh(el.dataset.pt, el.dataset.sku);
};
ACT["count-frac"] = (el) => {
  const pt = el.dataset.pt, sku = el.dataset.sku, cur = DB.count.values[pt][sku];
  const v = Math.floor(cur || 0) + +el.dataset.f;
  setCountValue(pt, sku, v);
  const inp = $("cnt-" + pt + "-" + sku); if (inp) inp.value = v;
  countRefresh(pt, sku);
};

function countCompare(V){
  const c = V.count, s = DB.settings;
  let h = phead("Conteo físico", "Compara lo que contó el auditor con el saldo teórico del Kardex y cierra el inventario.", c.status === "sent" || (c.status === "closed" && DB.lastCount) || (c.status === "none" && DB.lastCount) ? bdButton("conteo_fisico") : "");
  if (c.status === "none" || c.status === "draft"){
    h += '<div class="empty"><b>' + (c.status === "draft" ? "El auditor está contando" : "Todavía no hay un conteo en curso") + '</b>Verás el conteo cuando el auditor lo envíe. Antes de eso no se muestra ningún número, para que sea a ciego.</div>';
    return h + lastCountHtml();
  }
  if (c.status === "closed"){
    h += '<div class="box-ok">Inventario cerrado el ' + fdate(DB.closing) + '. Los registros con fecha igual o anterior quedan bloqueados.</div>';
    if (can(SESSION.role, "conteo_cerrar")) h += '<div class="row" style="margin-top:12px"><button class="btn ghost" data-act="count-reopen">Abrir un nuevo conteo</button></div>';
    return h + lastCountHtml();
  }
  const rows = countComparison();
  const totTheo = rows.reduce((a, r) => a + r.theo * r.it.cost, 0), totCnt = rows.reduce((a, r) => a + r.counted * r.it.cost, 0), totDiff = rows.reduce((a, r) => a + r.value, 0);
  h += '<div class="row" style="margin-bottom:14px"><span class="muted">Enviado por <b>' + esc(USERS[c.by] ? USERS[c.by].name : c.by) + '</b> el ' + esc(c.at) + '.</span><span class="spacer"></span>' +
    '<label class="row small" style="gap:6px">OK hasta <input class="input" style="width:72px;min-height:36px" inputmode="decimal" data-ch="tol" data-k="tolOk" value="' + s.tolOk + '" aria-label="Tolerancia OK en %"> %</label>' +
    '<label class="row small" style="gap:6px">Revisar hasta <input class="input" style="width:72px;min-height:36px" inputmode="decimal" data-ch="tol" data-k="tolRev" value="' + s.tolRev + '" aria-label="Tolerancia Revisar en %"> %</label></div>';
  h += '<div class="tw"><table><thead><tr><th>Insumo</th><th class="n">Teórico</th><th class="n">Contado</th><th class="n">Diferencia</th><th class="n">%</th><th class="n">Valor</th><th>Semáforo</th></tr></thead><tbody>' +
    rows.map(r => '<tr class="' + (r.sem.c === "bad" ? "hl" : r.sem.c === "warn" ? "hw" : "") + '"><td>' + ilink(r.it) + '<div class="sku">' + r.it.sku + (r.missing ? " · sin contar" : "") + '</div></td><td class="n">' + num(r.theo) + ' ' + r.it.unit + '</td><td class="n">' + num(r.counted) + ' ' + r.it.unit + '</td><td class="n">' + (r.diff > 0 ? "+" : "") + num(r.diff) + '</td><td class="n">' + pct(r.pct) + '</td><td class="n">' + money(r.value) + '</td><td>' + chip(r.sem.c, r.sem.k, semIcon(r.sem.c)) + '</td></tr>').join("") +
    '</tbody><tfoot><tr><td>Total valorizado</td><td class="n">' + money(totTheo) + '</td><td class="n">' + money(totCnt) + '</td><td class="n" colspan="2"></td><td class="n">' + money(totDiff) + '</td><td></td></tr></tfoot></table></div>';
  if (can(SESSION.role, "conteo_cerrar")){
    if (!UI.closeAsk) h += '<div class="row" style="margin-top:18px"><button class="btn" data-act="close-ask">Cerrar inventario…</button><span class="muted small">Ajusta el Kardex a lo contado y bloquea registros con fecha hasta el ' + fdate(DEMO_DATE) + '.</span></div>';
    else h += '<div class="box-warn" style="margin-top:18px;max-width:720px"><b>Confirmar cierre del inventario</b><p style="margin:6px 0">Se registrarán ajustes por ' + money(totDiff) + ' y no se aceptarán compras, mermas, ventas ni despachos con fecha igual o anterior al ' + fdate(DEMO_DATE) + '.</p>' +
      '<label class="check"><input type="checkbox" id="close-chk" data-ch="close-chk"' + (UI.closeChk ? " checked" : "") + '> Entiendo que el cierre no se puede deshacer</label>' +
      '<div class="row" style="margin-top:8px"><button class="btn danger" data-act="close-yes"' + (UI.closeChk ? "" : " disabled") + '>Sí, cerrar inventario</button><button class="btn ghost" data-act="close-no">Cancelar</button></div></div>';
  } else h += '<p class="note" style="margin-top:18px">Solo gerencia puede cerrar el inventario.</p>';
  return h;
}
function lastCountHtml(){
  const lc = DB.lastCount; if (!lc) return "";
  const dev = lc.rows.reduce((a, r) => a + r.diff * r.cost, 0);
  return '<h3 class="sec">Último inventario cerrado · ' + fdate(lc.date) + '</h3><div class="tw"><table><thead><tr><th>Insumo</th><th class="n">Teórico</th><th class="n">Contado</th><th class="n">Diferencia</th><th class="n">Valor</th></tr></thead><tbody>' +
    lc.rows.map(r => { const it = item(r.sku); return '<tr><td>' + esc(it.name) + '</td><td class="n">' + num(r.theo) + '</td><td class="n">' + num(r.counted) + '</td><td class="n">' + (r.diff > 0 ? "+" : "") + num(r.diff) + ' ' + it.unit + '</td><td class="n">' + money(r.diff * r.cost) + '</td></tr>'; }).join("") +
    '</tbody><tfoot><tr><td colspan="4">Desviación total</td><td class="n">' + money(dev) + '</td></tr></tfoot></table></div>';
}
INPUT["tol"] = (el) => {
  const v = Number(el.value.replace(",", "."));
  if (!(v >= 0 && v <= 100)){ toast("La tolerancia debe estar entre 0 y 100 %.", "err"); render(); return; }
  irreversible();
  DB.settings[el.dataset.k] = v;
  if (DB.settings.tolRev < DB.settings.tolOk) DB.settings.tolRev = DB.settings.tolOk;
  logEv("Cambió tolerancias de conteo: OK ≤ " + DB.settings.tolOk + " %, Revisar ≤ " + DB.settings.tolRev + " %");
  render();
};
ACT["close-ask"] = () => { UI.closeAsk = true; UI.closeChk = false; render(); };
ACT["close-no"] = () => { UI.closeAsk = false; render(); };
INPUT["close-chk"] = (el) => { UI.closeChk = el.checked; render(); };
ACT["close-yes"] = () => {
  if (!UI.closeChk) return;
  const r = closeInventory();
  if (r.ok) irreversible();
  UI.closeAsk = false;
  if (r.ok) toast("Inventario cerrado al " + fdate(DEMO_DATE) + ". El Kardex quedó ajustado a lo contado.");
  else if (r.err) toast(r.err, "err");
  render();
};
ACT["count-reopen"] = () => { if (reopenCount()){ toast("Nuevo conteo abierto. El auditor ya puede empezar."); render(); } };

/* ---------------- KARDEX Y LOTES ---------------- */
SCREENS.kardex = (V) => {
  let h = phead("Kardex y lotes", "Saldo inicial + entradas − salidas = saldo teórico. Costos a promedio ponderado, sin IGV.", bdButton("kardex"));
  const fl = DB.items.map(i => ({it:i, f:itemFlags(i.sku)}));
  const cats = {}; DB.items.forEach(i => { cats[i.cat] = (cats[i.cat] || 0) + 1; });
  h += fchips("kxf", [{id:"all", label:"Todos", n:DB.items.length},
    {id:"low", label:"Bajo mínimo", n:fl.filter(x => x.f.low).length, cls:"bad"},
    {id:"lots", label:"Lotes por vencer", n:fl.filter(x => x.f.lots).length, cls:"bad"}]
    .concat(Object.keys(cats).map(c => ({id:"cat:" + c, label:c, n:cats[c]}))), "all");
  h += '<div class="row" style="margin-bottom:12px"><div class="field" style="flex:1;max-width:420px"><input class="input" id="kx-q" data-in="kx-q" placeholder="Buscar por nombre, SKU o categoría…" value="' + esc(UI.kxq || "") + '" aria-label="Buscar insumo"></div>' +
    '<label class="row small" style="gap:8px">Ordenar por <select class="input" style="width:auto;min-height:40px" data-ch="kx-sort" aria-label="Ordenar tabla"><option value="name"' + (UI.kxs === "name" || !UI.kxs ? " selected" : "") + '>Nombre</option><option value="value"' + (UI.kxs === "value" ? " selected" : "") + '>Valor (mayor primero)</option><option value="out"' + (UI.kxs === "out" ? " selected" : "") + '>Más salidas</option></select></label>' +
    '<span class="muted small">Toca un insumo para ver su Kardex completo.</span></div>';
  h += '<div class="tw"><table><thead><tr><th>Insumo</th><th>Equivalencia</th><th class="n">Inicial</th><th class="n">Entradas</th><th class="n">Salidas</th><th class="n">Saldo teórico</th><th class="n">Almacén</th><th class="n">Barra</th><th class="n">Cocina</th><th class="n">Costo prom.</th><th class="n">Valor</th></tr></thead><tbody id="kx-body">' + kxRows(V) + '</tbody></table></div>';
  const lots = DB.lots.slice().sort((a, b) => a.exp < b.exp ? -1 : 1);
  h += '<h3 class="sec">Lotes y vencimientos</h3>';
  h += lots.length ? '<div class="tw"><table><thead><tr><th>Insumo</th><th>Lote</th><th class="n">Comprado</th><th class="n">Queda</th><th>Compra</th><th>Vence</th><th>Estado</th></tr></thead><tbody>' +
    lots.map(l => { const it = item(l.sku), s = lotStatus(l); return '<tr><td>' + esc(it.name) + '</td><td class="sku">' + esc(l.code) + '</td><td class="n">' + num(l.qty) + ' ' + it.unit + '</td><td class="n">' + num(l.left) + ' ' + it.unit + '</td><td class="num">' + fdate(l.buy) + '</td><td class="num">' + fdate(l.exp) + (s.d !== null ? ' <span class="muted small">(' + (s.d < 0 ? "hace " + (-s.d) + " d" : s.d + " d") + ')</span>' : "") + '</td><td>' + chip(s.c, s.k, s.c ? semIcon(s.c) : null) + '</td></tr>'; }).join("") + '</tbody></table></div>'
    : '<div class="empty"><b>Sin lotes controlados</b>Registra una compra con fecha de vencimiento para controlar su lote.</div>';
  h += '<p class="note" style="margin-top:16px">Los lotes se consumen primero los que vencen antes. Solo se controlan las compras registradas con vencimiento.</p>';
  return h;
};
function kxRows(V){
  const q = (UI.kxq || "").trim().toLowerCase(), f = UI.kxf || "all";
  const list = V.items.filter(i => !q || (i.name + " " + i.sku + " " + i.cat).toLowerCase().indexOf(q) >= 0).filter(i => {
    if (f === "all") return true;
    if (f === "low") return itemFlags(i.sku).low;
    if (f === "lots") return itemFlags(i.sku).lots;
    return f === "cat:" + i.cat;
  });
  if (UI.kxs === "value") list.sort((a, b) => b.saldo * b.cost - a.saldo * a.cost);
  else if (UI.kxs === "out") list.sort((a, b) => b.sal - a.sal);
  else list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (!list.length) return '<tr><td colspan="11" class="muted">Ningún insumo coincide con el filtro' + (q ? " «" + esc(q) + "»" : "") + '.</td></tr>';
  return list.map(i => {
    const P = DB.points[i.sku];
    const cell = (pt) => i.stock[pt] === null ? '<td class="n muted">—</td>' : '<td class="n' + (i.stock[pt] < P[pt].min ? '" style="color:var(--bad);font-weight:600' : "") + '">' + num(i.stock[pt]) + '</td>';
    return '<tr><td>' + ilink(i) + '<div class="sku">' + i.sku + ' · ' + esc(i.cat) + '</div></td><td class="small">' + esc(equiv(i)) + '</td><td class="n">' + num(i.initial) + '</td><td class="n">' + num(i.ent) + '</td><td class="n">' + num(i.sal) + '</td>' +
      '<td class="n"><b>' + num(i.saldo) + ' ' + i.unit + '</b>' + (i.factor !== 1 ? '<div class="muted small">' + num(i.saldo * i.factor, 0) + ' ' + i.baseUnit + '</div>' : "") + '</td>' + cell("alm") + cell("bar") + cell("coc") +
      '<td class="n">' + money(i.cost) + '</td><td class="n">' + money(i.saldo * i.cost) + '</td></tr>';
  }).join("");
}
INPUT["kx-q"] = (el) => { UI.kxq = el.value; $("kx-body").innerHTML = kxRows(view(SESSION.role)); };
INPUT["kx-sort"] = (el) => { UI.kxs = el.value; $("kx-body").innerHTML = kxRows(view(SESSION.role)); };

/* ---------------- PEDIDO Y TRANSFERENCIAS ---------------- */
SCREENS.pedido = () => {
  const s = DB.settings, R = replenishment();
  let h = phead("Pedido y transferencias", "Primero se mueve lo que sobra entre puntos; lo que todavía falta para el objetivo va al pedido sugerido.");
  h += '<div class="card" style="margin-bottom:18px"><div class="row" style="gap:12px 24px">' +
    '<label class="row" style="gap:8px">Días de cobertura <input class="input" style="width:80px" inputmode="decimal" data-ch="rp" data-k="cover" value="' + s.cover + '"></label>' +
    '<label class="row" style="gap:8px">Amarillo bajo mínimo + <input class="input" style="width:80px" inputmode="decimal" data-ch="rp" data-k="yellow" value="' + s.yellow + '"> días</label>' +
    '<span class="muted small">' + (R.dc.fromPos ? "Consumo diario de barra y cocina calculado con " + R.dc.days + (R.dc.days === 1 ? " día" : " días") + " de ventas POS." : "Sin ventas POS cargadas: se usan los consumos diarios de ejemplo.") + '</span></div>' +
    '<p class="muted small" style="margin:10px 0 0">Stock objetivo = mínimo + consumo diario × ' + num(s.cover) + ' días. Rojo: bajo el mínimo · Amarillo: menos de mínimo + ' + num(s.yellow) + ' días de consumo (no recibe transferencia, se cubre con el pedido) · Verde: el resto.</p></div>';

  h += '<h3 class="sec">Transferencias sugeridas</h3>';
  if (R.transfers.length){
    h += '<div class="alerts">' + R.transfers.map((t, i) => { const it = item(t.sku); return '<div class="alert-row">' + ic("truck") + '<div class="t"><b>' + num(t.qty) + ' ' + it.unit + ' de ' + esc(it.name) + '</b><span>' + POINTS[t.from] + ' → ' + POINTS[t.to] + '</span></div><button class="btn sm" data-act="disp" data-i="' + i + '">Despachar</button></div>'; }).join("") + '</div>';
    h += '<div class="row" style="margin-top:10px"><button class="btn ghost" data-act="disp-all">Despachar todas (' + R.transfers.length + ')</button></div>';
  } else h += '<div class="empty"><b>No hay transferencias posibles</b>Ningún punto de servicio está bajo su mínimo con excedente disponible en otro punto.</div>';

  h += '<h3 class="sec">Semáforo por punto</h3><div class="tw"><table><thead><tr><th>Insumo</th><th>Punto</th><th class="n">Stock</th><th class="n">Mínimo</th><th class="n">Consumo/día</th><th class="n">Objetivo</th><th>Estado</th></tr></thead><tbody>' +
    R.rows.map(r => r.pts.map((p, j) => '<tr class="' + (p.sem.c === "bad" ? "hl" : "") + '">' + (j === 0 ? '<td rowspan="' + r.pts.length + '">' + ilink(r.it) + '<div class="sku">' + r.it.sku + '</div></td>' : "") +
      '<td>' + POINTS[p.pt] + '</td><td class="n">' + num(p.stock) + ' ' + r.it.unit + '</td><td class="n">' + num(p.min) + '</td><td class="n">' + num(p.daily) + '</td><td class="n">' + num(p.target) + '</td><td>' + chip(p.sem.c, p.sem.k, semIcon(p.sem.c)) + '</td></tr>').join("")).join("") +
    '</tbody></table></div>';

  const total = R.order.reduce((a, o) => a + o.value, 0);
  h += '<h3 class="sec">Pedido sugerido al proveedor</h3>';
  if (R.order.length){
    h += '<div class="tw"><table><thead><tr><th>Insumo</th><th class="n">Cantidad</th><th class="n">Costo prom.</th><th class="n">Valor estimado</th></tr></thead><tbody>' +
      R.order.map(o => '<tr><td>' + esc(o.it.name) + '</td><td class="n">' + num(o.qty) + ' ' + o.it.unit + '</td><td class="n">' + money(o.it.cost) + '</td><td class="n">' + money(o.value) + '</td></tr>').join("") +
      '</tbody><tfoot><tr><td colspan="3">Total sin IGV</td><td class="n">' + money(total) + '</td></tr></tfoot></table></div>' +
      '<div class="row" style="margin-top:10px">' + (can(SESSION.role, "compras_solicitar") ? '<button class="btn" data-act="order-po">Crear solicitud de compra con este pedido</button>' : "") + '<button class="btn ghost" data-act="copy-order">Copiar pedido</button></div>';
  } else h += '<div class="empty"><b>No hace falta pedir</b>Después de las transferencias todos los puntos llegan a su objetivo.</div>';

  h += '<h3 class="sec">Despachos realizados</h3>';
  h += DB.dispatches.length ? '<div class="tw"><table><thead><tr><th>Fecha y hora</th><th>Insumo</th><th class="n">Cantidad</th><th>Ruta</th><th>Usuario</th></tr></thead><tbody>' +
    DB.dispatches.slice().reverse().map(d => { const it = item(d.sku); return '<tr><td class="num">' + esc(d.ts) + '</td><td>' + esc(it.name) + '</td><td class="n">' + num(d.qty) + ' ' + it.unit + '</td><td>' + POINTS[d.from] + ' → ' + POINTS[d.to] + '</td><td class="small">' + esc(USERS[d.user] ? USERS[d.user].name : d.user) + '</td></tr>'; }).join("") + '</tbody></table></div>'
    : '<div class="empty"><b>Sin despachos todavía</b>Los despachos quedan registrados aquí y en la bitácora.</div>';
  return h;
};
INPUT["rp"] = (el) => {
  const v = Number(el.value.replace(",", "."));
  if (!(v >= 0 && v <= 30)){ toast("Usa un número de días entre 0 y 30.", "err"); render(); return; }
  withUndo("Cambiar parámetro de reposición", false, () => { DB.settings[el.dataset.k] = v; save(); return true; }); render();
};
ACT["disp"] = (el) => {
  const t = replenishment().transfers[+el.dataset.i]; if (!t) return;
  const it = item(t.sku);
  const r = withUndo("Despacho de " + num(t.qty) + " " + it.unit + " de " + it.name, true, () => dispatch(t));
  if (r.ok) toast("Despacho registrado: " + num(t.qty) + " " + it.unit + " de " + it.name + ".", "", {label:"Deshacer", fn:askUndo});
  else if (r.err) toast(r.err, "err");
  render();
};
ACT["disp-all"] = () => {
  let n = 0, err = null;
  withUndo("Despachar todas las transferencias", true, () => {
    for (let guard = 0; guard < 40; guard++){
      const t = replenishment().transfers[0]; if (!t) break;
      const r = dispatch(t); if (!r.ok){ err = r.err; break; } n++;
    }
    return n > 0;
  });
  if (n) toast(n + (n === 1 ? " despacho registrado." : " despachos registrados."), "", {label:"Deshacer", fn:askUndo});
  if (err) toast(err, "err");
  render();
};
ACT["order-po"] = () => {
  const R = replenishment();
  const r = withUndo("Solicitud de compra desde el pedido sugerido", false, () => createPO(R.order.map(o => ({sku:o.it.sku, qty:o.qty})), "Generada desde el pedido sugerido"));
  if (!r.ok){ if (r.err) toast(r.err, "err"); return; }
  toast("Solicitud " + r.po.id + " creada por " + money(r.po.total) + ". Queda por aprobar.", "", {label:"Deshacer", fn:askUndo});
  go("compras-historial");
};
ACT["copy-order"] = () => {
  const R = replenishment();
  const txt = "Pedido sugerido · Stragos Ucello · " + fdate(DEMO_DATE) + "\n" + R.order.map(o => "- " + o.it.name + ": " + num(o.qty) + " " + o.it.unit + " (aprox. " + money(o.value) + ")").join("\n") +
    "\nTotal estimado sin IGV: " + money(R.order.reduce((a, o) => a + o.value, 0));
  copyText(txt, "Pedido");
};
