/* =========================================================
   Compras: solicitud (almacén) → aprobación (administración o
   gerencia sobre el umbral; nadie aprueba lo suyo) → recepción
   (almacén: recién aquí entra el stock y cambia el costo promedio).
   ========================================================= */
const poChip = (s) => s === "solicitada" ? chip("warn", "Por aprobar", "alert") : s === "aprobada" ? chip("acc", "Aprobada · por recibir", "cart") : s === "recibida" ? chip("ok", "Recibida", "check") : chip("bad", "Rechazada", "alert");

SCREENS.compras = () => {
  const role = SESSION.role, list = [];
  const pend = DB.pos.filter(p => p.status === "solicitada").length, toRecv = DB.pos.filter(p => p.status === "aprobada").length;
  if (can(role, "compras_solicitar")) list.push({id:"nueva", label:"Solicitar compra"});
  if (can(role, "compras_aprobar")) list.push({id:"aprobar", label:"Por aprobar", count:pend || 0});
  if (can(role, "compras_recibir")) list.push({id:"recibir", label:"Por recibir", count:toRecv || 0});
  list.push({id:"historial", label:"Historial"});
  const def = role === "alm" ? (toRecv ? "recibir" : "nueva") : (pend ? "aprobar" : "historial");
  let h = phead("Compras", "Toda compra pasa por tres pasos. El stock solo entra cuando almacén registra la recepción con la factura.");
  h += '<div class="card tight" style="margin-bottom:16px"><div class="cols-3">' +
    '<div><b>1. Solicitud</b><p class="small muted" style="margin:4px 0 0">Almacén (o administración) pide lo que falta, por ejemplo desde el pedido sugerido.</p></div>' +
    '<div><b>2. Aprobación</b><p class="small muted" style="margin:4px 0 0">Administración aprueba hasta ' + money(DB.settings.buyLimit) + '; por encima, Gerencia general. Nadie aprueba su propia solicitud.</p></div>' +
    '<div><b>3. Recepción</b><p class="small muted" style="margin:4px 0 0">Almacén registra lo que llegó, el costo de factura, lote y vencimiento. Recién ahí entra el stock.</p></div></div></div>';
  h += tabs("comprasTab", list, def);
  const t = UI.comprasTab;
  if (t === "nueva") h += poNewHtml();
  else if (t === "aprobar") h += poApproveHtml();
  else if (t === "recibir") h += poReceiveHtml();
  else h += poHistoryHtml();
  return h;
};

/* --- solicitud --- */
function poNew(){ if (!UI.poNew) UI.poNew = {lines:[{sku:"", qty:""}], note:""}; return UI.poNew; }
function poNewHtml(){
  const P = poNew();
  const cats = {}; DB.items.forEach(i => { (cats[i.cat] = cats[i.cat] || []).push(i); });
  const opts = (sel) => '<option value="">Elige un insumo…</option>' + Object.keys(cats).map(c => '<optgroup label="' + esc(c) + '">' + cats[c].map(i => '<option value="' + i.sku + '"' + (sel === i.sku ? " selected" : "") + '>' + esc(i.name) + ' (' + i.unit + ')</option>').join("") + '</optgroup>').join("");
  let total = 0;
  let h = '<div class="card"><div class="tw" style="border:0"><table><thead><tr><th>Insumo</th><th class="n">Cantidad</th><th class="n">Costo prom.</th><th class="n">Estimado sin IGV</th><th></th></tr></thead><tbody>' +
    P.lines.map((l, i) => { const it = item(l.sku), est = it && +l.qty > 0 ? +l.qty * it.cost : 0; total += est;
      return '<tr><td><select class="input" style="min-width:200px" data-ch="pon" data-i="' + i + '" data-k="sku" aria-label="Insumo">' + opts(l.sku) + '</select></td><td class="n"><input class="input qty" inputmode="decimal" data-ch="pon" data-i="' + i + '" data-k="qty" value="' + esc(l.qty) + '" aria-label="Cantidad"> ' + (it ? it.unit : "") + '</td><td class="n">' + (it ? money(it.cost) : "—") + '</td><td class="n">' + (est ? money(est) : "—") + '</td><td>' + (P.lines.length > 1 ? '<button class="btn sm danger" data-act="pon-del" data-i="' + i + '">Quitar</button>' : "") + '</td></tr>'; }).join("") +
    '</tbody><tfoot><tr><td colspan="3">Total estimado</td><td class="n">' + money(total) + '</td><td></td></tr></tfoot></table></div>' +
    '<div class="row" style="margin-top:10px"><button class="btn sm ghost" data-act="pon-add">' + ic("plus") + 'Agregar insumo</button>' + (total > DB.settings.buyLimit ? chip("warn", "Supera " + money(DB.settings.buyLimit) + ": la aprueba Gerencia", "alert") : "") + '</div>' +
    '<div class="field" style="margin-top:14px"><label for="pon-note">Motivo o comentario</label><input class="input" id="pon-note" data-in="pon-note" maxlength="200" value="' + esc(P.note) + '" placeholder="Ej.: reposición para el fin de semana"></div>' +
    '<div class="row" style="margin-top:14px"><button class="btn" data-act="pon-send">Enviar solicitud</button><button class="btn ghost" data-act="pon-clear">Limpiar</button></div></div>';
  return h;
}
INPUT["pon"] = (el) => { const l = poNew().lines[+el.dataset.i]; l[el.dataset.k] = el.dataset.k === "qty" ? el.value.replace(",", ".") : el.value; render(); };
INPUT["pon-note"] = (el) => { poNew().note = el.value; };
ACT["pon-add"] = () => { poNew().lines.push({sku:"", qty:""}); render(); };
ACT["pon-del"] = (el) => { poNew().lines.splice(+el.dataset.i, 1); render(); };
ACT["pon-clear"] = () => { UI.poNew = null; render(); };
ACT["pon-send"] = () => {
  const P = poNew();
  const r = withUndo("Solicitud de compra", false, () => createPO(P.lines.map(l => ({sku:l.sku, qty:+l.qty})), P.note));
  if (!r.ok){ if (r.err) toast(r.err, "err"); return; }
  UI.poNew = null; UI.comprasTab = "historial"; render();
  toast("Solicitud " + r.po.id + " enviada por " + money(r.po.total) + ". Queda por aprobar.", "", {label:"Deshacer", fn:askUndo});
};

/* --- aprobación --- */
function poLinesTable(po, extra){
  return '<div class="tw" style="margin-top:10px"><table><thead><tr><th>Insumo</th><th class="n">Cantidad</th><th class="n">Estimado</th>' + (extra || "") + '</tr></thead><tbody>' +
    po.lines.map(l => { const it = item(l.sku); return '<tr><td>' + ilink(it) + '</td><td class="n">' + num(l.qty) + ' ' + it.unit + '</td><td class="n">' + money(l.est) + '</td></tr>'; }).join("") +
    '</tbody><tfoot><tr><td colspan="2">Total estimado sin IGV</td><td class="n">' + money(po.total) + '</td></tr></tfoot></table></div>';
}
function poApproveHtml(){
  const list = DB.pos.filter(p => p.status === "solicitada");
  if (!list.length) return '<div class="empty"><b>No hay compras por aprobar</b>Las solicitudes de almacén aparecerán aquí.</div>';
  return '<div class="stack">' + list.map(po => {
    const own = po.by === SESSION.user, ger = poNeedsGer(po), blocked = own || (ger && SESSION.role !== "ger");
    const rj = UI.poRej && UI.poRej.id === po.id;
    return '<div class="card"><div class="row" style="justify-content:space-between"><div><b>' + po.id + '</b> · ' + fdate(po.date) + ' · solicitó ' + esc(uname(po.by)) + '</div>' + poChip(po.status) + '</div>' +
      (po.note ? '<p class="muted small" style="margin:6px 0 0">«' + esc(po.note) + '»</p>' : "") + poLinesTable(po) +
      (own ? '<p class="box-warn" style="margin-top:10px">Es tu propia solicitud: debe aprobarla otra persona.</p>' : ger && SESSION.role !== "ger" ? '<p class="box-warn" style="margin-top:10px">Supera ' + money(DB.settings.buyLimit) + ': la aprueba Gerencia general.</p>' : "") +
      (rj ? '<div class="field" style="margin-top:12px"><label for="po-rj">Motivo del rechazo</label><input class="input" id="po-rj" data-in="po-rj" maxlength="200" value="' + esc(UI.poRej.reason || "") + '" placeholder="Ej.: aún hay stock en barra"></div><div class="row" style="margin-top:10px"><button class="btn danger" data-act="po-no" data-id="' + po.id + '">Rechazar solicitud</button><button class="btn ghost" data-act="po-rj-cancel">Cancelar</button></div>'
        : '<div class="row" style="margin-top:12px"><button class="btn ok" data-act="po-ok" data-id="' + po.id + '"' + (blocked ? " disabled" : "") + '>' + ic("check") + 'Aprobar</button><button class="btn danger" data-act="po-rj" data-id="' + po.id + '"' + (own ? " disabled" : "") + '>Rechazar…</button></div>') + '</div>';
  }).join("") + '</div>';
}
ACT["po-ok"] = (el) => {
  const r = withUndo("Aprobar la compra " + el.dataset.id, true, () => decidePO(el.dataset.id, true));
  if (r.ok) toast("Compra " + el.dataset.id + " aprobada. Almacén ya puede recibirla.", "", {label:"Deshacer", fn:askUndo}); else if (r.err) toast(r.err, "err");
  render();
};
ACT["po-rj"] = (el) => { UI.poRej = {id:el.dataset.id, reason:""}; render(); setTimeout(() => { const i = $("po-rj"); if (i) i.focus(); }, 30); };
ACT["po-rj-cancel"] = () => { UI.poRej = null; render(); };
INPUT["po-rj"] = (el) => { UI.poRej.reason = el.value; };
ACT["po-no"] = (el) => {
  const r = withUndo("Rechazar la compra " + el.dataset.id, true, () => decidePO(el.dataset.id, false, UI.poRej.reason));
  if (r.ok){ UI.poRej = null; toast("Solicitud rechazada.", "warn", {label:"Deshacer", fn:askUndo}); } else if (r.err) toast(r.err, "err");
  render();
};

/* --- recepción --- */
function rcv(po){
  UI.rcv = UI.rcv || {};
  if (!UI.rcv[po.id]) UI.rcv[po.id] = {date:defaultDate(), igv:true, rows:po.lines.map(l => ({sku:l.sku, qty:l.qty, total:r2(l.est * (1 + IGV)), lot:"", exp:""}))};
  return UI.rcv[po.id];
}
function poReceiveHtml(){
  const list = DB.pos.filter(p => p.status === "aprobada");
  if (!list.length) return '<div class="empty"><b>No hay compras por recibir</b>Cuando administración apruebe una solicitud, aparecerá aquí.</div>';
  return '<div class="stack">' + list.map(po => {
    const R = rcv(po);
    return '<div class="card"><div class="row" style="justify-content:space-between"><div><b>' + po.id + '</b> · aprobó ' + esc(uname(po.approvedBy)) + ' el ' + esc(po.approvedAt) + '</div>' + poChip(po.status) + '</div>' +
      '<div class="row" style="margin-top:12px"><label class="row small" style="gap:8px">Fecha de recepción <input class="input" type="date" style="width:auto" data-ch="rcv" data-po="' + po.id + '" data-k="date" value="' + esc(R.date) + '"></label>' +
      '<label class="check"><input type="checkbox" data-ch="rcv" data-po="' + po.id + '" data-k="igv"' + (R.igv ? " checked" : "") + '> Los costos de factura incluyen IGV</label></div>' +
      '<div class="tw" style="margin-top:10px"><table><thead><tr><th>Insumo</th><th class="n">Pedido</th><th class="n">Recibido</th><th class="n">Costo factura (S/)</th><th>Lote</th><th>Vence</th></tr></thead><tbody>' +
      R.rows.map((r, i) => { const it = item(r.sku), ord = po.lines[i].qty; return '<tr><td>' + esc(it.name) + '</td><td class="n">' + num(ord) + ' ' + it.unit + '</td>' +
        '<td class="n"><input class="input qty" inputmode="decimal" data-ch="rcvr" data-po="' + po.id + '" data-i="' + i + '" data-k="qty" value="' + r.qty + '" aria-label="Cantidad recibida de ' + esc(it.name) + '">' + (+r.qty !== ord ? '<div class="small" style="color:var(--warn)">' + (+r.qty < ord ? "Llegó menos" : "Llegó más") + '</div>' : "") + '</td>' +
        '<td class="n"><input class="input qty" inputmode="decimal" data-ch="rcvr" data-po="' + po.id + '" data-i="' + i + '" data-k="total" value="' + r.total + '" aria-label="Costo de factura de ' + esc(it.name) + '"></td>' +
        '<td><input class="input" style="width:120px" data-ch="rcvr" data-po="' + po.id + '" data-i="' + i + '" data-k="lot" value="' + esc(r.lot) + '" placeholder="Opcional" aria-label="Lote"></td>' +
        '<td><input class="input" type="date" style="width:auto" data-ch="rcvr" data-po="' + po.id + '" data-i="' + i + '" data-k="exp" value="' + esc(r.exp) + '" aria-label="Vencimiento"></td></tr>'; }).join("") +
      '</tbody></table></div><div class="row" style="margin-top:12px"><button class="btn" data-act="rcv-go" data-po="' + po.id + '">Registrar recepción y entrar al almacén</button></div></div>';
  }).join("") + '</div>';
}
INPUT["rcv"] = (el) => { const R = rcv(DB.pos.find(p => p.id === el.dataset.po)); R[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; };
INPUT["rcvr"] = (el) => { const R = rcv(DB.pos.find(p => p.id === el.dataset.po)), r = R.rows[+el.dataset.i], k = el.dataset.k; r[k] = k === "qty" || k === "total" ? el.value.replace(",", ".") : el.value; if (k === "qty") render(); };
ACT["rcv-go"] = (el) => {
  const po = DB.pos.find(p => p.id === el.dataset.po), R = rcv(po);
  const r = withUndo("Recepción de la compra " + po.id, true, () => receivePO(po.id, R.date, R.rows.map(x => ({sku:x.sku, qty:+x.qty, total:+x.total, igv:R.igv, lot:x.lot, exp:x.exp}))));
  if (!r.ok){ if (r.err) toast(r.err, "err"); return; }
  delete UI.rcv[po.id]; render();
  toast("Compra " + po.id + " recibida: " + money(r.net) + " sin IGV entró al almacén.", "", {label:"Deshacer", fn:askUndo});
};

/* --- historial --- */
function poHistoryHtml(){
  if (!DB.pos.length) return '<div class="empty"><b>Sin compras registradas</b></div>';
  return '<div class="tw"><table><thead><tr><th>Orden</th><th>Fecha</th><th>Insumos</th><th class="n">Estimado</th><th class="n">Recibido sin IGV</th><th>Estado</th><th>Recorrido</th></tr></thead><tbody>' +
    DB.pos.slice().reverse().map(po => '<tr><td class="sku">' + po.id + '</td><td class="num">' + fdate(po.date) + '</td><td class="small">' + po.lines.map(l => esc(item(l.sku).name) + " × " + num(l.qty)).join("<br>") + '</td><td class="n">' + money(po.total) + '</td><td class="n">' + (po.net != null ? money(po.net) : "—") + '</td><td>' + poChip(po.status) + '</td>' +
      '<td class="small muted">Solicitó ' + esc(uname(po.by)) + (po.approvedBy ? ' → ' + (po.status === "rechazada" ? "rechazó " : "aprobó ") + esc(uname(po.approvedBy)) + (po.reason ? ' («' + esc(po.reason) + '»)' : "") : "") + (po.receivedBy ? ' → recibió ' + esc(uname(po.receivedBy)) + ' el ' + fdate(po.receivedDate) : "") + '</td></tr>').join("") +
    '</tbody></table></div>';
}
