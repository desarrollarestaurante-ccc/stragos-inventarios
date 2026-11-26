/* =========================================================
   Pantallas: Inicio, Dashboard y Mermas
   ========================================================= */

const ROLE_INFO = {
  op:{does:["Cuentas tu punto al cierre del turno (inventario diario) y ves tu propio Kardex físico.","Reportas mermas en tres pasos y corriges las que te devuelvan."],
      hidden:["Costos, valor del inventario y el stock teórico por ventas.","Dashboard, compras, conteo general y reportes."]},
  aud:{does:["Cuentas a ciego barra, cocina y almacén, en el orden del recorrido.","Tu conteo se cruza con el cierre de turno del operario."],
      hidden:["Saldos teóricos y costos: así el conteo es realmente a ciego.","Compras, despachos y aprobaciones."]},
  alm:{does:["Solicitas compras y recibes las aprobadas: recién al recibir entra el stock.","Revisas el Kardex, el stock por punto y los lotes por vencer."],
      hidden:["Dashboard gerencial y ventas POS.","Aprobación de compras y de mermas."]},
  adm:{does:["Apruebas compras hasta " + "S/ 1,000" + " y resuelves mermas: aprobar, devolver o rechazar.","Cruzas el inventario diario con el teórico, cargas ventas del POS y mantienes recetas."],
      hidden:["El conteo del auditor hasta que lo envía.","El cierre del inventario (solo gerencia)."]},
  ger:{does:["Revisas food cost, mermas y cortesías contra objetivo, y las desviaciones.","Apruebas compras grandes y cierras el inventario con doble confirmación."],
      hidden:["El conteo del auditor hasta que lo envía."]}
};
const WEEKDAYS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const todayLabel = () => WEEKDAYS[new Date(DEMO_DATE + "T12:00:00").getDay()] + " " + fdate(DEMO_DATE);
function statusChip(s, res){
  if (s === "aprobada") return chip("ok", "Aprobada", "check");
  if (s === "rechazada") return chip("bad", res === "cargo" ? "Rechazada · con cargo" : "Rechazada · sin pérdida", "alert");
  if (s === "devuelta") return chip("acc", "Devuelta para corregir", "undo");
  if (s === "anulada") return chip("", "Anulada");
  return chip("warn", "Pendiente", "alert");
}
const fracButtons = (it, act, attrs, cur) => fracsOf(it).map(f => '<button type="button" class="' + (cur !== null && cur !== undefined && Math.abs(r2(cur - Math.floor(cur)) - f.v) < 0.001 ? "on" : "") + '" data-act="' + act + '" ' + attrs + ' data-f="' + f.v + '"' + (f.title ? ' title="' + esc(f.title) + '"' : "") + '>' + f.t + '</button>').join("");

/* ---------------- INICIO ---------------- */
SCREENS.inicio = (V) => {
  const u = USERS[SESSION.user], role = SESSION.role, info = ROLE_INFO[role];
  let h = '<section class="hero" style="background-image:url(' + (IMG.banner || "") + ')"><div><p class="date">' + esc(todayLabel()) + '</p>' +
    '<h2>Hola, ' + esc(u.hello) + '</h2><p>' + esc(ROLES[role].label) + ' · Stragos Ucello</p></div></section>';
  h += newsHtml();

  if (role === "op"){
    const dev = V.myMermas.filter(m => m.status === "devuelta");
    if (dev.length) h += '<div class="box-warn" style="margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:200px"><b>Te devolvieron ' + dev.length + (dev.length === 1 ? " reporte" : " reportes") + ' para corregir.</b> ' + esc(dev[0].returnComment || "") + '</span><button class="btn sm" data-act="go" data-to="movimientos-devueltas">Corregir</button></div>';
    const needs = V.items.filter(i => i.needs && i.needs.length);
    const pend = V.daily.filter(d => !d.sent);
    h += '<div class="bigbtns">' +
      '<button class="bigbtn primary" data-act="go" data-to="movimientos-merma">' + ic("drop", "ic-lg") + '<div><b>Reportar merma</b><span>Rotura, derrame o error</span></div></button>' +
      '<button class="bigbtn" data-act="go" data-to="diario">' + ic("cal", "ic-lg") + '<div><b>Inventario diario</b><span>' + (pend.length ? "Falta: " + pend.map(d => POINTS[d.pt]).join(" y ") : "Cierre de turno enviado") + '</span></div></button>' +
      '<a class="bigbtn" href="#inicio" data-act="scroll" data-to="repo">' + ic("box", "ic-lg") + '<div><b>Reposición</b><span>' + (needs.length ? needs.length + " insumos por pedir" : "Todo en orden") + '</span></div></a></div>';
    h += '<h3 class="sec" id="repo">Reposición pendiente</h3>';
    h += needs.length ? '<div class="alerts">' + needs.map(i => '<div class="alert-row">' + ic(i.cat) + '<div class="t"><b>' + esc(i.name) + '</b><span>' + i.needs.map(pt => POINTS[pt]).join(" y ") + '</span></div>' + chip("bad", "Pedir reposición", "alert") + '</div>').join("") + '</div>'
      : '<div class="empty"><b>No hay insumos por reponer</b>Cuando un insumo de tu punto baje del mínimo aparecerá aquí.</div>';
    h += myMermasHtml(V);
  }

  if (role === "aud"){
    const pr = countProgress(), st = V.count.status;
    if (st === "sent") h += '<div class="box-ok">' + ic("lock") + ' Conteo enviado el ' + esc(V.count.at) + '. Quedó bloqueado y lo revisará la administración.</div>';
    else if (st === "closed") h += '<div class="box-ok">El último inventario ya se cerró. Cuando gerencia abra un nuevo conteo podrás empezar.</div>';
    else h += '<div class="bigbtns"><button class="bigbtn primary" data-act="go" data-to="conteo">' + ic("clip", "ic-lg") + '<div><b>' + (st === "draft" ? "Continuar conteo" : "Empezar conteo") + '</b><span>' + pr.done + ' de ' + pr.total + ' registros</span></div></button></div>';
    h += '<h3 class="sec">Avance por punto</h3><div class="cols-3">' + ["bar","coc","alm"].map(pt => {
      const p = pr.byPt[pt], w = p.total ? Math.round(p.done / p.total * 100) : 0;
      return '<div class="card tight"><h4>' + POINTS[pt] + '</h4><p class="muted small" style="margin:0 0 8px">' + p.done + ' de ' + p.total + ' insumos contados</p><div class="prog"><i style="width:' + w + '%"></i></div>' +
        (st === "none" || st === "draft" ? '<button class="btn sm ghost" style="margin-top:12px" data-act="count-pt" data-pt="' + pt + '">Contar ' + POINTS[pt].toLowerCase() + '</button>' : "") + '</div>';
    }).join("") + '</div>';
  }

  if (role === "alm"){
    const toRecv = DB.pos.filter(p => p.status === "aprobada");
    h += '<div class="bigbtns">' +
      '<button class="bigbtn primary" data-act="go" data-to="compras-recibir">' + ic("cart", "ic-lg") + '<div><b>Recibir compras</b><span>' + (toRecv.length ? toRecv.length + " aprobadas por recibir" : "Nada por recibir") + '</span></div></button>' +
      '<button class="bigbtn" data-act="go" data-to="compras-nueva">' + ic("plus", "ic-lg") + '<div><b>Solicitar compra</b><span>Pasa a aprobación</span></div></button>' +
      '<button class="bigbtn" data-act="go" data-to="kardex">' + ic("box", "ic-lg") + '<div><b>Kardex y lotes</b><span>Saldos y vencimientos</span></div></button></div>';
    const lots = DB.lots.map(l => ({l:l, s:lotStatus(l)})).filter(x => x.s.k === "Vencido" || x.s.k === "Por vencer");
    h += '<h3 class="sec">Lotes por vencer (7 días o menos)</h3>' + (lots.length ? '<div class="cols-3">' + lots.map(x => lotCard(x.l, x.s)).join("") + '</div>' : '<div class="empty"><b>Ningún lote vence esta semana</b>Los lotes se crean al recibir compras con fecha de vencimiento.</div>');
    const low = V.items.filter(i => i.stock.alm < DB.points[i.sku].alm.min);
    h += '<h3 class="sec">Stock del almacén bajo el mínimo</h3>' + (low.length ? '<div class="alerts">' + low.map(i => '<div class="alert-row"><div class="t"><b>' + ilink(i) + '</b><span>Hay ' + esc(qtyTxt(i, i.stock.alm)) + ' · mínimo ' + num(DB.points[i.sku].alm.min) + ' ' + i.unit + '</span></div>' + chip("bad", "Bajo mínimo", "alert") + '</div>').join("") + '</div>' : '<div class="empty"><b>Todo sobre el mínimo</b>El almacén cubre los mínimos definidos.</div>');
  }

  if (role === "adm" || role === "ger"){
    h += '<h3 class="sec">Atención</h3>' + alertsHtml();
    h += '<h3 class="sec">Indicadores del mes</h3>' + kpisHtml(metrics());
    h += '<h3 class="sec">Mermas por resolver</h3>' + resolveListHtml();
  }

  h += '<details class="card" style="margin-top:26px"><summary style="cursor:pointer;font-weight:600">Qué haces aquí y qué no ves</summary><div class="cols-2" style="margin-top:12px"><div><p class="muted small" style="margin:0 0 4px">Haces</p><ul style="margin:0;padding-left:18px">' +
    info.does.map(t => "<li>" + esc(t) + "</li>").join("") + '</ul></div><div><p class="muted small" style="margin:0 0 4px">No ves</p><ul style="margin:0;padding-left:18px">' + info.hidden.map(t => "<li>" + esc(t) + "</li>").join("") + '</ul></div></div></details>';
  return h;
};
ACT["scroll"] = (el) => { const t = $(el.dataset.to); if (t) t.scrollIntoView({behavior:"smooth"}); };
ACT["count-pt"] = (el) => { UI.conteoPt = el.dataset.pt; go("conteo"); };

function myMermasHtml(V){
  const list = V.myMermas.slice().reverse().slice(0, 8);
  return '<h3 class="sec">Mis reportes</h3>' + (list.length ? '<div class="alerts">' + list.map(m => '<div class="alert-row"><div class="t"><b>' + esc(m.label) + ' · ' + num(m.qty) + '</b><span>' + esc(m.reason) + ' · ' + POINTS[m.point] + ' · ' + fdate(m.date) +
    (m.status === "devuelta" && m.returnComment ? ' · «' + esc(m.returnComment) + '»' : "") + (m.status === "rechazada" && m.rejectComment ? ' · «' + esc(m.rejectComment) + '»' : "") + '</span></div>' + statusChip(m.status, m.resolution) + '</div>').join("") + '</div>'
    : '<div class="empty"><b>Todavía no reportas mermas</b>Usa «Reportar merma» cuando algo se rompa, se derrame o se pierda.</div>');
}
function lotCard(l, s){
  const it = item(l.sku);
  const when = s.d < 0 ? "Venció hace " + (-s.d) + (s.d === -1 ? " día" : " días") : s.d === 0 ? "Vence hoy" : "Vence en " + s.d + (s.d === 1 ? " día" : " días");
  return '<div class="card tight"><div class="row" style="justify-content:space-between"><b>' + esc(it.name) + '</b>' + chip(s.c, s.k, semIcon(s.c)) + '</div>' +
    '<p class="muted small" style="margin:6px 0 0">Lote ' + esc(l.code) + ' · quedan ' + esc(qtyTxt(it, l.left)) + '</p><p class="small" style="margin:2px 0 0">' + when + ' (' + fdate(l.exp) + ')</p></div>';
}
function alertsHtml(){
  const a = alerts();
  if (!a.length) return '<div class="empty"><b>Sin alertas</b>Todo lo operativo está al día.</div>';
  return '<div class="alerts">' + a.map(x => '<div class="alert-row">' + chip(x.c, "Atención", "alert") + '<div class="t"><b>' + esc(x.t) + '</b><span>' + esc(x.d) + '</span></div><button class="btn sm ghost" data-act="go" data-to="' + x.go + '">Abrir</button></div>').join("") + '</div>';
}
function kpisHtml(M){
  const s = DB.settings, mc = M.mermasMes + M.cortesias, mcPct = M.ventaNeta > 0 ? mc / M.ventaNeta * 100 : null;
  return '<div class="kpis">' +
    '<div class="kpi"><span class="k">Valor total del inventario</span><span class="v">' + money(M.valor) + '</span><span class="s">A costo promedio, sin IGV</span></div>' +
    '<div class="kpi"><span class="k">Food cost del mes</span><span class="v' + (M.fcReal != null && M.fcReal > s.fcObj ? " bad" : "") + '">' + (M.fcReal == null ? "—" : pct(M.fcReal)) + '</span><span class="s">' +
      (M.fcReal == null ? "Carga ventas del POS para calcularlo" : "Real · teórico " + pct(M.fcTeo) + " · objetivo ≤ " + pct(s.fcObj, 0)) + '</span></div>' +
    '<div class="kpi"><span class="k">Mermas y cortesías</span><span class="v">' + money(mc) + '</span><span class="s">' + (mcPct == null ? "Sin ventas cargadas para el %" : pct(mcPct) + " de la venta neta · obj. ≤ " + pct(s.mermaObj + s.cortObj)) + '</span></div>' +
    '<div class="kpi"><span class="k">Desviación del último inventario</span><span class="v' + (M.desviacion < 0 ? " bad" : "") + '">' + money(M.desviacion) + '</span><span class="s">' + (M.lc ? pct(M.desvPct) + " del valor contado · " + fdate(M.lc.date) : "Sin inventario cerrado") + '</span></div>' +
    '</div>';
}

/* --- resolver mermas: aprobar, devolver o rechazar --- */
function resolveListHtml(){
  const pend = DB.mermas.filter(m => m.status === "pendiente");
  if (!pend.length) return '<div class="empty"><b>No hay mermas por resolver</b>Los reportes de barra, cocina y almacén aparecerán aquí.</div>';
  const R = UI.res || {};
  return '<div class="alerts">' + pend.map(m => {
    let h = '<div class="alert-row"><div class="t"><b>' + esc(m.label) + ' · ' + num(m.qty) + (m.kind === "producto" ? " und" : " " + item(m.ref).unit) + '</b><span>' +
      esc(m.reason) + ' · ' + POINTS[m.point] + ' · ' + fdate(m.date) + ' · reportó ' + esc(uname(m.by)) + (m.note ? ' · «' + esc(m.note) + '»' : "") + '</span><span>Valor ' + money(mermaValue(m)) + ' · al aprobar se descuenta del inventario</span></div>' +
      '<button class="btn sm ok" data-act="res-ok" data-id="' + m.id + '">' + ic("check") + 'Aprobar</button><button class="btn sm ghost" data-act="res-mode" data-id="' + m.id + '" data-m="devolver">Devolver…</button><button class="btn sm danger" data-act="res-mode" data-id="' + m.id + '" data-m="rechazar">Rechazar…</button></div>';
    if (R.id === m.id){
      h += '<div class="alert-row" style="background:var(--panel-2)"><div class="stack" style="flex:1;min-width:240px;gap:10px">';
      if (R.mode === "devolver"){
        h += '<div class="field"><label for="res-c">¿Qué debe corregir ' + esc(uname(m.by)) + '?</label><input class="input" id="res-c" data-in="res-c" maxlength="200" value="' + esc(R.comment || "") + '" placeholder="Ej.: fue media botella, no un cuarto"></div>' +
          '<p class="muted small" style="margin:0">Vuelve a quien la reportó. No toca el stock hasta que se apruebe.</p>' +
          '<div class="row"><button class="btn sm" data-act="res-go">Devolver para corregir</button><button class="btn sm ghost" data-act="res-cancel">Cancelar</button></div>';
      } else {
        h += '<div class="field"><label for="res-c">Motivo del rechazo</label><input class="input" id="res-c" data-in="res-c" maxlength="200" value="' + esc(R.comment || "") + '" placeholder="Ej.: la botella está completa en barra"></div>' +
          '<label class="check"><input type="radio" name="res-r" data-ch="res-r" value="sin_perdida"' + (R.resolution !== "cargo" ? " checked" : "") + '> No hubo pérdida: el producto sigue en stock (no se descuenta)</label>' +
          '<label class="check"><input type="radio" name="res-r" data-ch="res-r" value="cargo"' + (R.resolution === "cargo" ? " checked" : "") + '> Pérdida no justificada: se descuenta como faltante y se registra un cargo</label>' +
          (R.resolution === "cargo" ? '<div class="field" style="max-width:320px"><label for="res-p">Responsable del cargo</label><input class="input" id="res-p" data-in="res-p" maxlength="60" value="' + esc(R.resp == null ? uname(m.by) : R.resp) + '"><p class="help">Cargo de ' + money(mermaValue(m)) + ' a costo. La política de descuento la define RR. HH.</p></div>' : "") +
          '<div class="row"><button class="btn sm danger" data-act="res-go">Rechazar</button><button class="btn sm ghost" data-act="res-cancel">Cancelar</button></div>';
      }
      h += '</div></div>';
    }
    return h;
  }).join("") + '</div>';
}
ACT["res-ok"] = (el) => {
  const m = DB.mermas.find(x => x.id === el.dataset.id);
  const r = withUndo("Aprobar merma: " + (m ? m.label : ""), true, () => resolveMerma(el.dataset.id, "aprobar"));
  if (r.ok) toast("Merma aprobada y descontada del inventario.", "", {label:"Deshacer", fn:askUndo}); else if (r.err) toast(r.err, "err");
  render();
};
ACT["res-mode"] = (el) => { UI.res = {id:el.dataset.id, mode:el.dataset.m, comment:"", resolution:"sin_perdida", resp:null}; render(); setTimeout(() => { const i = $("res-c"); if (i) i.focus(); }, 30); };
ACT["res-cancel"] = () => { UI.res = null; render(); };
INPUT["res-c"] = (el) => { UI.res.comment = el.value; };
INPUT["res-p"] = (el) => { UI.res.resp = el.value; };
INPUT["res-r"] = (el) => { UI.res.resolution = el.value; render(); };
ACT["res-go"] = () => {
  const R = UI.res; if (!R) return;
  const m = DB.mermas.find(x => x.id === R.id);
  const label = (R.mode === "devolver" ? "Devolver merma: " : "Rechazar merma: ") + (m ? m.label : "");
  const r = withUndo(label, true, () => resolveMerma(R.id, R.mode, {comment:R.comment, resolution:R.resolution, responsable:R.resp == null ? undefined : R.resp}));
  if (!r.ok){ if (r.err) toast(r.err, "err"); return; }
  UI.res = null; render();
  toast(R.mode === "devolver" ? "Merma devuelta a " + uname(m.by) + " para corregir." : R.resolution === "cargo" ? "Merma rechazada con cargo al responsable. Se descontó como faltante." : "Merma rechazada. El stock no cambió.", R.mode === "devolver" ? "" : "warn", {label:"Deshacer", fn:askUndo});
};

/* ---------------- DASHBOARD ---------------- */
SCREENS.dashboard = () => {
  const M = metrics(), s = DB.settings;
  let h = phead("Dashboard gerencial", "Cómo va el inventario de noviembre. Valores sin IGV, a costo promedio.");
  h += '<h3 class="sec">Alertas operativas</h3>' + alertsHtml();
  h += '<h3 class="sec">Indicadores</h3>' + kpisHtml(M);
  h += '<div class="cols-2" style="margin-top:22px">';
  h += '<div class="card chart"><h4>Compras vs. ventas por semana</h4><p class="muted small" style="margin:0 0 8px">Noviembre 2026 · valores netos sin IGV</p>' + weeksSvg(M.weeks) +
    '<div class="legend"><span><i style="background:var(--accent)"></i>Compras</span><span><i style="background:var(--muted)"></i>Ventas</span></div>' +
    '<div class="badges" style="margin-top:12px">' + M.weeks.map((w, i) => { const r = w.ventas > 0 ? w.compras / w.ventas * 100 : null; return chip(r == null ? "" : r <= s.ratioObj ? "ok" : "bad", "Sem " + (i + 1) + ": " + (r == null ? "sin ventas" : pct(r, 0))); }).join("") +
      chip(M.ratio == null ? "" : M.ratio <= s.ratioObj ? "ok" : "bad", "Mes: " + (M.ratio == null ? "sin ventas" : pct(M.ratio, 0)), M.ratio == null ? null : semIcon(M.ratio <= s.ratioObj ? "ok" : "bad")) + '</div>' +
    '<p class="muted small" style="margin:8px 0 0">Ratio de compras = compras ÷ ventas netas. Objetivo de la empresa: ≤ ' + pct(s.ratioObj, 0) + ' (editable en «Mermas y cortesías»).</p></div>';
  h += '<div class="card"><h4>Top 10 faltantes del último conteo</h4><p class="muted small" style="margin:0 0 14px">' + (M.lc ? "Inventario del " + fdate(M.lc.date) + ", valorizado al costo promedio" : "") + '</p>';
  if (M.top.length){
    const max = Math.max.apply(null, M.top.map(t => t.value));
    h += '<div class="hbars">' + M.top.map(t => '<div class="hbar"><span>' + ilink(t.it) + '</span><div class="track"><div class="fill" style="width:' + Math.max(2, t.value / max * 100) + '%"></div></div><span class="val">' + money(t.value) + '</span></div>').join("") + '</div>';
  } else h += '<div class="empty"><b>Sin faltantes</b>El último conteo no tuvo diferencias negativas.</div>';
  h += '</div></div>';
  h += '<div class="card" style="margin-top:18px"><h4>Promociones e impacto en el food cost</h4><p class="muted small" style="margin:0 0 12px">Para cada promoción: food cost a precio de carta frente al food cost con el precio cobrado. Objetivo ≤ ' + pct(s.fcObj, 0) + '.</p>' + promosHtml(M) +
    '<p class="note" style="margin-top:12px">Propuesta inicial para validar con el equipo: hoy mide cuánto sube el food cost y cuánto descuento se otorga por promoción. Falta definir si también se compara el volumen vendido frente a días sin promoción.</p></div>';
  h += '<p class="note" style="margin-top:18px">Food cost real = (costo de recetas vendidas + cortesías + mermas aprobadas + faltantes del último conteo) ÷ venta neta. El teórico solo usa el costo de las recetas vendidas.</p>';
  return h;
};
function promosHtml(M){
  if (!M.promos.length) return '<div class="empty"><b>Sin promociones cargadas</b>Carga ventas con tipo «promo» (por ejemplo, el Excel de prueba) para ver su impacto.</div>';
  const obj = DB.settings.fcObj, max = Math.max(obj + 10, Math.max.apply(null, M.promos.map(p => p.fcPromo)) * 1.1);
  const W = 560, rowH = 46, L = 170, R = 56, T = 8, H = T + M.promos.length * rowH + 22;
  const x = (v) => L + (W - L - R) * v / max;
  let s = '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Food cost por promoción">';
  M.promos.forEach((p, i) => {
    const y = T + i * rowH;
    s += '<text x="' + (L - 8) + '" y="' + (y + 18) + '" text-anchor="end" font-size="12" fill="var(--fg)">' + esc(p.name.length > 24 ? p.name.slice(0, 23) + "…" : p.name) + '</text>';
    s += '<rect x="' + L + '" y="' + (y + 4) + '" width="' + Math.max(1, x(p.fcList) - L) + '" height="14" rx="3" fill="var(--muted)"><title>A precio de carta ' + pct(p.fcList) + '</title></rect>';
    s += '<text x="' + (x(p.fcList) + 6) + '" y="' + (y + 15) + '" font-size="11" fill="var(--muted)">' + pct(p.fcList, 0) + '</text>';
    s += '<rect x="' + L + '" y="' + (y + 22) + '" width="' + Math.max(1, x(p.fcPromo) - L) + '" height="14" rx="3" fill="' + (p.fcPromo > obj ? "var(--bad)" : "var(--accent)") + '"><title>Con promoción ' + pct(p.fcPromo) + '</title></rect>';
    s += '<text x="' + (x(p.fcPromo) + 6) + '" y="' + (y + 33) + '" font-size="11" fill="var(--fg)">' + pct(p.fcPromo, 0) + '</text>';
  });
  s += '<line x1="' + x(obj) + '" x2="' + x(obj) + '" y1="' + T + '" y2="' + (H - 18) + '" stroke="var(--fg)" stroke-dasharray="4 4" stroke-width="1"/>';
  s += '<text x="' + x(obj) + '" y="' + (H - 4) + '" text-anchor="middle" font-size="11" fill="var(--muted)">objetivo ' + pct(obj, 0) + '</text></svg></div>';
  s += '<div class="legend" style="margin:6px 0 12px"><span><i style="background:var(--muted)"></i>Food cost a precio de carta</span><span><i style="background:var(--accent)"></i>Con promoción</span><span><i style="background:var(--bad)"></i>Con promoción, sobre el objetivo</span></div>';
  s += '<div class="tw"><table><thead><tr><th>Promoción</th><th class="n">Unidades</th><th class="n">Venta neta</th><th class="n">Descuento otorgado</th><th class="n">Costo</th><th class="n">FC carta</th><th class="n">FC promo</th><th class="n">Margen</th></tr></thead><tbody>' +
    M.promos.map(p => '<tr><td>' + esc(p.name) + '<div class="sku">' + Object.keys(p.codes).join(", ") + '</div></td><td class="n">' + num(p.units) + '</td><td class="n">' + money(p.net) + '</td><td class="n">' + money(p.discount) + '</td><td class="n">' + money(p.cost) + '</td><td class="n">' + pct(p.fcList) + '</td><td class="n">' + chip(p.fcPromo > obj ? "bad" : "ok", pct(p.fcPromo)) + '</td><td class="n">' + money(p.margin) + '</td></tr>').join("") + '</tbody></table></div>';
  return s;
}
function niceMax(v){ if (v <= 0) return 100; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
function weeksSvg(weeks){
  const W = 560, H = 250, L = 70, R = 12, T = 14, B = 40;
  const max = niceMax(Math.max.apply(null, weeks.map(w => Math.max(w.compras, w.ventas))));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const labels = ["Sem 1 · 1–7","Sem 2 · 8–14","Sem 3 · 15–20"];
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Compras y ventas por semana">';
  for (let i = 0; i <= 4; i++){
    const v = max / 4 * i, yy = y(v);
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--line)" stroke-width="1"/>';
    s += '<text x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="12" fill="var(--muted)">S/ ' + Math.round(v).toLocaleString("en-US") + '</text>';
  }
  const gw = (W - L - R) / 3, bw = Math.min(46, gw * 0.3);
  weeks.forEach((w, i) => {
    const cx = L + gw * i + gw / 2;
    [["compras","var(--accent)",-1],["ventas","var(--muted)",1]].forEach(([k, col, side]) => {
      const v = w[k], x = side < 0 ? cx - bw - 3 : cx + 3, yy = y(v), hh = Math.max(0, H - B - yy);
      s += '<rect x="' + x + '" y="' + yy + '" width="' + bw + '" height="' + hh + '" rx="3" fill="' + col + '"><title>' + (k === "compras" ? "Compras " : "Ventas ") + money(v) + '</title></rect>';
      if (v > 0) s += '<text x="' + (x + bw / 2) + '" y="' + (yy - 5) + '" text-anchor="middle" font-size="11" fill="var(--fg)">' + Math.round(v).toLocaleString("en-US") + '</text>';
    });
    s += '<text x="' + cx + '" y="' + (H - B + 22) + '" text-anchor="middle" font-size="12" fill="var(--muted)">' + labels[i] + '</text>';
  });
  return s + '</svg>';
}

/* ---------------- MERMAS ---------------- */
SCREENS.movimientos = (V) => {
  const role = SESSION.role, list = [];
  if (can(role, "mermas_reportar")) list.push({id:"merma", label:"Reportar merma"});
  const pend = DB.mermas.filter(m => m.status === "pendiente").length;
  if (can(role, "mermas_aprobar")) list.push({id:"aprobar", label:"Por resolver", count:pend || 0});
  const dev = V.myMermas.filter(m => m.status === "devuelta").length;
  list.push({id:"devueltas", label:"Devueltas a mí", count:dev || 0});
  list.push({id:"historial", label:role === "op" ? "Mis reportes" : "Historial"});
  const def = role === "op" || role === "alm" ? (dev ? "devueltas" : "merma") : (pend ? "aprobar" : "merma");
  let h = phead("Mermas", "Lo que se pierde. Nada se descuenta del inventario hasta que la administración aprueba el reporte (o lo rechaza con cargo al responsable).");
  h += tabs("movimientosTab", list, def);
  const t = UI.movimientosTab;
  if (t === "merma") h += mermaWizard(V);
  else if (t === "aprobar") h += flowHtml() + resolveListHtml();
  else if (t === "devueltas") h += devueltasHtml(V);
  else h += historyHtml(V);
  return h;
};
function flowHtml(){
  return '<div class="card tight" style="margin-bottom:14px"><b>Qué pasa con cada decisión</b><div class="cols-3" style="margin-top:10px">' +
    '<div><div class="row" style="gap:6px">' + chip("ok", "Aprobar", "check") + '</div><p class="small muted" style="margin:6px 0 0">Se descuenta del inventario como merma, del punto donde pasó.</p></div>' +
    '<div><div class="row" style="gap:6px">' + chip("acc", "Devolver", "undo") + '</div><p class="small muted" style="margin:6px 0 0">Vuelve a quien la reportó con tu comentario. La corrige y la reenvía. El stock no cambia.</p></div>' +
    '<div><div class="row" style="gap:6px">' + chip("bad", "Rechazar", "alert") + '</div><p class="small muted" style="margin:6px 0 0">Sin pérdida: no se descuenta. Con cargo: se descuenta como faltante y se registra un cargo al responsable.</p></div></div></div>';
}
function devueltasHtml(V){
  const dev = V.myMermas.filter(m => m.status === "devuelta");
  if (!dev.length) return '<div class="empty"><b>No tienes reportes devueltos</b>Si la administración te pide corregir un reporte, aparecerá aquí con su comentario.</div>';
  return '<div class="stack">' + dev.map(m => {
    const e = (UI.fix && UI.fix[m.id]) || {qty:m.qty, reason:m.reason, note:m.note || ""};
    const it = m.kind === "insumo" ? item(m.ref) : null;
    return '<div class="card"><div class="row" style="justify-content:space-between"><b>' + esc(m.label) + '</b>' + statusChip("devuelta") + '</div>' +
      '<div class="box-warn" style="margin:10px 0">Comentario: «' + esc(m.returnComment || "") + '»</div>' +
      '<div class="grid-form"><div class="field"><label for="fx-q-' + m.id + '">Cantidad' + (it ? " (" + it.unit + ")" : " (und)") + '</label><input class="input" id="fx-q-' + m.id + '" inputmode="decimal" data-in="fx" data-id="' + m.id + '" data-k="qty" value="' + esc(e.qty) + '">' +
        (it && it.portions > 1 ? '<div class="fracs" style="margin-top:6px">' + fracButtons(it, "fx-frac", 'data-id="' + m.id + '"', +e.qty) + '</div><p class="help">' + esc(fracHint(it)) + '</p>' : "") + '</div>' +
      '<div class="field"><label for="fx-r-' + m.id + '">Motivo</label><select class="input" id="fx-r-' + m.id + '" data-ch="fx" data-id="' + m.id + '" data-k="reason">' + MERMA_REASONS.map(r => '<option' + (r === e.reason ? " selected" : "") + '>' + r + '</option>').join("") + '</select></div>' +
      '<div class="field"><label for="fx-n-' + m.id + '">Nota</label><input class="input" id="fx-n-' + m.id + '" data-in="fx" data-id="' + m.id + '" data-k="note" maxlength="200" value="' + esc(e.note) + '"></div></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" data-act="fx-send" data-id="' + m.id + '">Corregir y reenviar</button><button class="btn ghost" data-act="fx-cancel" data-id="' + m.id + '">Anular reporte</button></div></div>';
  }).join("") + '</div>';
}
function fx(id){ UI.fix = UI.fix || {}; if (!UI.fix[id]){ const m = DB.mermas.find(x => x.id === id); UI.fix[id] = {qty:m.qty, reason:m.reason, note:m.note || ""}; } return UI.fix[id]; }
INPUT["fx"] = (el) => { fx(el.dataset.id)[el.dataset.k] = el.dataset.k === "qty" ? el.value.replace(",", ".") : el.value; };
ACT["fx-frac"] = (el) => { const e = fx(el.dataset.id); e.qty = Math.floor(+e.qty || 0) + +el.dataset.f; render(); };
ACT["fx-send"] = (el) => {
  const e = fx(el.dataset.id), m = DB.mermas.find(x => x.id === el.dataset.id);
  const r = withUndo("Corregir merma: " + m.label, false, () => resubmitMerma(el.dataset.id, {qty:+e.qty, reason:e.reason, note:e.note}));
  if (!r.ok){ if (r.err) toast(r.err, "err"); return; }
  delete UI.fix[el.dataset.id]; render(); toast("Reporte corregido y reenviado para aprobación.", "", {label:"Deshacer", fn:askUndo});
};
ACT["fx-cancel"] = (el) => { const m = DB.mermas.find(x => x.id === el.dataset.id); const r = withUndo("Anular reporte: " + m.label, false, () => cancelMerma(el.dataset.id)); if (r.ok){ render(); toast("Reporte anulado.", "", {label:"Deshacer", fn:askUndo}); } };

/* --- asistente de merma en 3 pasos --- */
function mw(){ if (!UI.mw) UI.mw = {step:1, kind:"producto", ref:null, qty:1, point:SESSION.role === "alm" ? "alm" : "bar", reason:null, note:"", date:defaultDate(), q:""}; return UI.mw; }
function mermaWizard(V){
  const w = mw(), steps = ["Qué se perdió","Cuánto","Por qué"];
  let h = '<div class="steps">' + steps.map((s, i) => '<span class="' + (i + 1 === w.step ? "on" : i + 1 < w.step ? "done" : "") + '">' + (i + 1) + '. ' + s + '</span>').join("") + '</div>';
  if (w.step === 1){
    h += quickMermaHtml(V);
    h += '<div class="row" style="margin-bottom:14px"><div class="tabs" style="margin:0">' + [["producto","Producto de la carta"],["insumo","Insumo"]].map(k => '<button type="button" class="' + (w.kind === k[0] ? "on" : "") + '" data-act="mw-kind" data-k="' + k[0] + '">' + k[1] + '</button>').join("") + '</div>' +
      '<div class="field" style="flex:1;min-width:200px"><input class="input" id="mw-q" data-in="mw-q" placeholder="Buscar…" value="' + esc(w.q) + '" aria-label="Buscar producto o insumo"></div></div>';
    h += '<div class="tiles" id="mw-tiles">' + mwTiles(V) + '</div>';
    h += '<p class="muted small" style="margin-top:12px">Las cortesías no se reportan aquí: se registran en la caja (POS) con su motivo.</p>';
  } else {
    const sel = mwSelected(V);
    h += '<div class="card" style="display:flex;gap:14px;align-items:center;margin-bottom:16px;padding:10px">' +
      (sel.photo ? '<img src="' + sel.photo + '" alt="" style="width:96px;height:72px;object-fit:cover;border-radius:8px">' : '<span class="tile" style="width:96px;border:0"><span class="ph" style="height:72px">' + ic(sel.cat) + '</span></span>') +
      '<div style="flex:1;min-width:0"><b>' + esc(sel.name) + '</b><div class="muted small">' + esc(sel.sub) + '</div></div><button class="btn sm ghost" data-act="mw-step" data-s="1">Cambiar</button></div>';
    if (w.step === 2){
      const isIns = w.kind === "insumo", it = isIns ? V.items.find(x => x.sku === w.ref) : null;
      h += '<div class="stack"><div class="field"><span class="lbl">Cantidad' + (isIns ? " (" + esc(sel.unit) + ")" : " (unidades vendibles)") + '</span><div class="stepper">' +
        '<button class="btn ghost" data-act="mw-qty" data-d="-1" aria-label="Restar uno">' + ic("minus") + '</button>' +
        '<input class="input" id="mw-qty" data-in="mw-qty" inputmode="decimal" value="' + esc(w.qty) + '" aria-label="Cantidad">' +
        '<button class="btn ghost" data-act="mw-qty" data-d="1" aria-label="Sumar uno">' + ic("plus") + '</button>' +
        (it && it.portions > 1 ? '<div class="fracs" style="margin-left:6px">' + fracButtons(it, "mw-frac", "", +w.qty) + '</div>' : "") + '</div>' +
        (it ? '<p class="help">' + esc(equiv(it)) + '. ' + esc(fracHint(it)) + '</p>' : "") + '</div>';
      h += '<div class="field"><span class="lbl">Dónde pasó</span><div class="chips-sel">' + mwPoints(V).map(pt => '<button type="button" class="' + (w.point === pt ? "on" : "") + '" data-act="mw-pt" data-p="' + pt + '">' + POINTS[pt] + '</button>').join("") + '</div></div>';
      h += '<div class="row"><button class="btn ghost" data-act="mw-step" data-s="1">Atrás</button><button class="btn" data-act="mw-step" data-s="3">Siguiente</button></div></div>';
    } else {
      h += '<div class="stack"><div class="field"><span class="lbl">Motivo</span><div class="chips-sel">' + MERMA_REASONS.map(r => '<button type="button" class="' + (w.reason === r ? "on" : "") + '" data-act="mw-reason" data-r="' + r + '">' + r + '</button>').join("") + '</div></div>' +
        '<div class="grid-form"><div class="field"><label for="mw-note">Nota (opcional)</label><input class="input" id="mw-note" data-in="mw-note" maxlength="200" value="' + esc(w.note) + '" placeholder="Ej.: mesa 4, se cayó al servir"></div>' +
        '<div class="field"><label for="mw-date">Fecha</label><input class="input" type="date" id="mw-date" data-in="mw-date" value="' + esc(w.date) + '"></div></div>' +
        (UI.mwErr ? '<div class="box-err">' + esc(UI.mwErr) + '</div>' : "") +
        '<p class="muted small" style="margin:0">Resumen: ' + esc(num(w.qty)) + ' × ' + esc(sel.name) + ' · ' + POINTS[w.point] + (w.reason ? ' · ' + esc(w.reason) : "") + '. Queda pendiente hasta que la administración lo resuelva.</p>' +
        '<div class="row"><button class="btn ghost" data-act="mw-step" data-s="2">Atrás</button><button class="btn" data-act="mw-send"' + (w.reason ? "" : " disabled") + '>Enviar reporte</button></div></div>';
    }
  }
  return h;
}
function mwTiles(V){
  const w = mw(), q = w.q.trim().toLowerCase(), rank = freqRank(w.kind);
  const byUse = (key) => (a, b) => (rank[b[key]] || 0) - (rank[a[key]] || 0);
  if (w.kind === "producto"){
    const ps = V.products.filter(p => p.hasRecipe && (!q || (p.name + " " + p.code).toLowerCase().indexOf(q) >= 0)).sort(byUse("code"));
    return ps.length ? ps.map(p => '<button type="button" class="tile" data-act="mw-pick" data-ref="' + esc(p.code) + '">' + (p.photo ? '<img src="' + p.photo + '" alt="">' : '<span class="ph">' + ic("glass") + '</span>') + '<span class="tt"><b>' + esc(p.name) + '</b><span>' + esc(p.code) + ' · ' + (p.point === "coc" ? "Cocina" : "Barra") + '</span></span></button>').join("") : '<div class="empty" style="grid-column:1/-1">No hay productos con ese nombre.</div>';
  }
  const is = V.items.filter(i => !q || (i.name + " " + i.sku).toLowerCase().indexOf(q) >= 0).sort(byUse("sku"));
  return is.length ? is.map(i => '<button type="button" class="tile" data-act="mw-pick" data-ref="' + esc(i.sku) + '"><span class="ph">' + ic(i.cat) + '</span><span class="tt"><b>' + esc(i.name) + '</b><span>' + esc(i.cat) + ' · por ' + esc(i.unit) + (i.portionLabel ? " o " + i.portionLabel : "") + '</span></span></button>').join("") : '<div class="empty" style="grid-column:1/-1">No hay insumos con ese nombre.</div>';
}
function mwSelected(V){
  const w = mw();
  if (w.kind === "producto"){ const p = V.products.find(x => x.code === w.ref); return {name:p.name, sub:p.code + " · receta de " + (p.point === "coc" ? "cocina" : "barra"), photo:p.photo, unit:"und", factor:1, cat:"Licores"}; }
  const i = V.items.find(x => x.sku === w.ref); return {name:i.name, sub:i.sku + " · " + i.cat, photo:"", unit:i.unit, factor:i.factor, cat:i.cat};
}
function mwPoints(V){
  const w = mw();
  if (w.kind === "producto"){ const p = V.products.find(x => x.code === w.ref); return [p.point, "alm"].filter((v, i, a) => a.indexOf(v) === i); }
  return V.items.find(x => x.sku === w.ref).points;
}
ACT["mw-kind"] = (el) => { const w = mw(); w.kind = el.dataset.k; w.q = ""; render(); };
INPUT["mw-q"] = (el) => { mw().q = el.value; $("mw-tiles").innerHTML = mwTiles(view(SESSION.role)); };
ACT["mw-pick"] = (el) => {
  const w = mw(), V = view(SESSION.role);
  w.ref = el.dataset.ref; w.qty = 1; w.step = 2;
  const pts = mwPoints(V);
  w.point = SESSION.role === "alm" && pts.includes("alm") ? "alm" : pts.includes("bar") ? "bar" : pts[0];
  if (w.kind === "producto"){ const p = V.products.find(x => x.code === w.ref); w.point = p.point; }
  render();
};
ACT["mw-step"] = (el) => {
  const w = mw(), s = +el.dataset.s;
  if (s === 3 && !(+w.qty > 0)){ toast("La cantidad debe ser mayor que 0.", "err"); return; }
  w.step = s; UI.mwErr = null; render();
};
ACT["mw-qty"] = (el) => { const w = mw(); w.qty = Math.max(0, r2((+w.qty || 0) + +el.dataset.d)); render(); };
ACT["mw-frac"] = (el) => { const w = mw(); w.qty = r4(Math.floor(+w.qty || 0) + +el.dataset.f); render(); };
INPUT["mw-qty"] = (el) => { mw().qty = el.value.replace(",", "."); };
ACT["mw-pt"] = (el) => { mw().point = el.dataset.p; render(); };
ACT["mw-reason"] = (el) => { mw().reason = el.dataset.r; render(); };
INPUT["mw-note"] = (el) => { mw().note = el.value; };
INPUT["mw-date"] = (el) => { mw().date = el.value; };
ACT["mw-send"] = () => {
  const w = mw(), label = w.kind === "producto" ? (product(w.ref) || {}).name : (item(w.ref) || {}).name;
  const r = withUndo("Reportar merma: " + label, false, () => reportMerma({kind:w.kind, ref:w.ref, qty:+w.qty, point:w.point, reason:w.reason, note:w.note, date:w.date}));
  if (!r.ok){ UI.mwErr = r.err || "No se pudo enviar."; render(); return; }
  UI.mw = null; UI.mwErr = null; render();
  toast("Merma reportada. Queda pendiente de aprobación.", "", {label:"Deshacer", ms:10000, fn:askUndo});
};

function historyHtml(V){
  if (!V.showCost) return myMermasHtml(V);
  const tipo = {compra:["ok","Compra"], venta:["","Venta POS"], cortesia:["warn","Cortesía POS"], merma:["bad","Merma"], faltante:["bad","Faltante con cargo"], salida:["","Consumo"], ajuste:["warn","Ajuste"]};
  const rows = DB.movs.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0).slice(0, 60);
  let h = '<div class="tw"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Insumo</th><th class="n">Cantidad</th><th>Detalle</th><th>Usuario</th></tr></thead><tbody>' +
    rows.map(m => { const it = item(m.sku), t = tipo[m.type] || ["", m.type]; return '<tr><td class="num">' + fdate(m.date) + '</td><td>' + chip(t[0], t[1]) + '</td><td>' + ilink(it) + '</td><td class="n">' + (m.qty > 0 ? "+" : "") + num(m.qty) + ' ' + it.unit + '</td><td class="small">' + esc(m.note) + '</td><td class="small">' + esc(uname(m.user)) + '</td></tr>'; }).join("") +
    '</tbody></table></div>';
  const mer = DB.mermas.slice().reverse();
  h += '<h3 class="sec">Todas las mermas</h3><div class="tw"><table><thead><tr><th>Fecha</th><th>Qué</th><th class="n">Cantidad</th><th>Punto</th><th>Motivo</th><th>Reportó</th><th class="n">Valor</th><th>Estado</th><th>Recorrido</th></tr></thead><tbody>' +
    mer.map(m => '<tr><td class="num">' + fdate(m.date) + '</td><td>' + esc(m.label) + '</td><td class="n">' + num(m.qty) + '</td><td>' + POINTS[m.point] + '</td><td>' + esc(m.reason) + '</td><td class="small">' + esc(uname(m.by)) + '</td><td class="n">' + money(mermaValue(m)) + '</td><td>' + statusChip(m.status, m.resolution) + '</td><td class="small muted">' +
      (m.history || []).map(x => esc(x.action) + " (" + esc(uname(x.user)) + ")").join(" → ") + '</td></tr>').join("") + '</tbody></table></div>';
  return h;
}
