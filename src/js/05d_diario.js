/* =========================================================
   Inventario diario de barra y cocina
   Operario: cuenta su punto al cierre del turno (a ciego) y ve su
   Kardex físico. Admin y gerencia: comparan con el teórico por
   recetas y con el conteo del auditor (sobrantes y faltantes).
   ========================================================= */
SCREENS.diario = (V) => SESSION.role === "op" ? dailyOpHtml(V) : dailyAdminHtml();

function dailyOpHtml(V){
  const pt = UI.dpt === "coc" ? "coc" : "bar"; UI.dpt = pt;
  const d = V.daily.find(x => x.pt === pt);
  let h = phead("Inventario diario", "Al cerrar el turno, cuenta lo que queda en tu punto. Es a ciego: no ves lo que el sistema espera según las ventas.");
  h += '<div class="tabs">' + V.daily.map(x => '<button type="button" class="' + (x.pt === pt ? "on" : "") + '" data-act="dpt" data-pt="' + x.pt + '">' + POINTS[x.pt] + (x.sent ? " · enviado" : " · por contar") + '</button>').join("") + '</div>';
  const its = V.items.filter(i => d.rows.some(r => r.sku === i.sku));
  if (!d.sent){
    UI.dcounts = UI.dcounts || {}; const C = UI.dcounts[pt] = UI.dcounts[pt] || {};
    const done = its.filter(i => C[i.sku] !== undefined && C[i.sku] !== "").length;
    h += '<p class="muted small" style="margin:0 0 10px">Cierre del ' + fdate(DEMO_DATE) + ' · <span id="dc-done">' + done + ' de ' + its.length + '</span> contados · escribe la cantidad y presiona Enter para pasar al siguiente.</p>';
    h += '<div class="count-list">' + its.map(i => {
      const v = C[i.sku], has = v !== undefined && v !== "";
      return '<div class="count-item' + (has ? " done" : "") + '"><span class="cat">' + ic(i.cat) + '</span><div class="nm"><b>' + esc(i.name) + '</b><span>Cuenta en ' + esc(i.unit) + (i.factor !== 1 ? ' · ' + esc(equiv(i)) : "") + '</span></div>' +
        '<div class="inp"><input class="input" inputmode="decimal" enterkeyhint="next" data-in="dcount" data-sku="' + i.sku + '" id="dc-' + i.sku + '" value="' + (has ? esc(v) : "") + '" placeholder="—" aria-label="Cantidad de ' + esc(i.name) + '">' +
        (i.portions > 1 ? '<div class="fracs">' + fracButtons(i, "dc-frac", 'data-sku="' + i.sku + '"', has ? +v : null) + '</div>' : "") + '</div></div>';
    }).join("") + '</div>';
    h += UI.dAsk ? '<div class="box-warn" style="margin-top:16px;max-width:640px"><b>¿Enviar el cierre de ' + POINTS[pt].toLowerCase() + '?</b><p style="margin:6px 0">Al enviarlo queda registrado con tu usuario y la hora, y ya no se puede corregir.</p><div class="row"><button class="btn" data-act="d-send">Sí, enviar cierre</button><button class="btn ghost" data-act="d-ask" data-v="0">Volver</button></div></div>'
      : '<div class="row" style="margin-top:16px"><button class="btn" id="dc-ask" data-act="d-ask" data-v="1"' + (done < its.length ? " disabled" : "") + '>Revisar y enviar cierre</button><span class="muted small" id="dc-left">' + (done < its.length ? 'Faltan ' + (its.length - done) + ' insumos.' : "") + '</span></div>';
  } else {
    h += '<div class="box-ok" style="margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:220px">' + ic("lock") + ' Cierre de ' + POINTS[pt].toLowerCase() + ' enviado el ' + esc(d.at) + '. Gerencia lo comparará con lo vendido según recetas.</span>' + bdButton("inventario_diario", pt) + '</div>';
    h += '<h3 class="sec">Mi Kardex del día · ' + POINTS[pt] + '</h3><div class="tw"><table><thead><tr><th>Insumo</th><th class="n">Apertura</th><th class="n">+ Recibido</th><th class="n">− Enviado</th><th class="n">− Mermas</th><th class="n">= Cierre contado</th><th class="n">Consumo real</th></tr></thead><tbody>' +
      d.rows.map(r => { const it = its.find(i => i.sku === r.sku), use = r.open == null ? null : r.open + r.inn - r.out - r.merma - r.close;
        return '<tr><td>' + esc(it.name) + '</td><td class="n">' + (r.open == null ? "—" : num(r.open)) + '</td><td class="n">' + num(r.inn) + '</td><td class="n">' + num(r.out) + '</td><td class="n">' + num(r.merma) + '</td><td class="n"><b>' + num(r.close) + '</b></td><td class="n">' + (use == null ? "—" : num(use) + ' ' + it.unit) + '</td></tr>'; }).join("") +
      '</tbody></table></div><p class="note" style="margin-top:12px">Apertura = tu cierre del ' + fdate(d.openDate) + '. Consumo real = apertura + recibido − enviado − mermas aprobadas − cierre. Es lo que salió por ventas, cortesías o pérdidas sin reportar.</p>';
  }
  if (V.history.length) h += '<h3 class="sec">Mis cierres anteriores</h3><div class="alerts">' + V.history.slice(0, 6).map(x => '<div class="alert-row"><div class="t"><b>' + POINTS[x.point] + ' · ' + fdate(x.date) + '</b><span>Enviado ' + esc(x.at) + '</span></div>' + chip("ok", "Enviado", "check") + '</div>').join("") + '</div>';
  return h;
}
ACT["dpt"] = (el) => { UI.dpt = el.dataset.pt; UI.dAsk = false; render(); };
INPUT["dcount"] = (el) => {
  const raw = el.value.replace(",", ".").trim(), pt = UI.dpt;
  if (raw !== "" && (isNaN(+raw) || +raw < 0)){ el.setAttribute("aria-invalid", "true"); return; }
  el.removeAttribute("aria-invalid");
  UI.dcounts[pt][el.dataset.sku] = raw;
  el.closest(".count-item").classList.toggle("done", raw !== "");
  // actualiza el avance y habilita el envío sin volver a dibujar (no se pierde el foco)
  const total = document.querySelectorAll('[data-in="dcount"]').length;
  const done = Array.from(document.querySelectorAll('[data-in="dcount"]')).filter(i => UI.dcounts[pt][i.dataset.sku] !== undefined && UI.dcounts[pt][i.dataset.sku] !== "").length;
  if ($("dc-done")) $("dc-done").textContent = done + " de " + total;
  if ($("dc-ask")) $("dc-ask").disabled = done < total;
  if ($("dc-left")) $("dc-left").textContent = done < total ? "Faltan " + (total - done) + " insumos." : "";
};
ACT["dc-frac"] = (el) => { const C = UI.dcounts[UI.dpt]; C[el.dataset.sku] = String(r4(Math.floor(+C[el.dataset.sku] || 0) + +el.dataset.f)); render(); };
ACT["d-ask"] = (el) => { UI.dAsk = el.dataset.v === "1"; render(); };
ACT["d-send"] = () => {
  const pt = UI.dpt, r = submitDaily(pt, UI.dcounts[pt] || {});
  if (!r.ok){ toast(r.err || "No se pudo enviar.", "err"); UI.dAsk = false; render(); return; }
  irreversible(); UI.dAsk = false; delete UI.dcounts[pt]; render();
  toast("Cierre de " + POINTS[pt].toLowerCase() + " enviado. No se puede deshacer.");
};

function dailyAdminHtml(){
  const dates = Array.from(new Set(DB.daily.map(d => d.date).concat([DEMO_DATE]))).sort().reverse();
  const date = UI.ddate && dates.includes(UI.ddate) ? UI.ddate : DEMO_DATE; UI.ddate = date;
  const pt = UI.dpt2 === "coc" ? "coc" : "bar"; UI.dpt2 = pt;
  const close = dailyOf(pt, date), audit = auditFor(pt, date), rows = dailyTheo(pt, date);
  let h = phead("Inventario diario", "Cierre de turno de barra y cocina frente a lo que debería quedar según las ventas del día. Lo cuenta el operario a ciego.");
  h += '<div class="row" style="margin-bottom:12px"><div class="tabs" style="margin:0">' + ["bar","coc"].map(p => '<button type="button" class="' + (p === pt ? "on" : "") + '" data-act="dpt2" data-pt="' + p + '">' + POINTS[p] + '</button>').join("") + '</div>' +
    '<label class="row small" style="gap:8px">Día <select class="input" style="width:auto;min-height:40px" data-ch="ddate">' + dates.map(d => '<option value="' + d + '"' + (d === date ? " selected" : "") + '>' + fdate(d) + (dailyOf(pt, d) ? "" : " · sin cierre") + '</option>').join("") + '</select></label>' +
    (close ? '<span class="spacer"></span>' + bdButton("inventario_diario", pt) : "") + '</div>';
  const tol = (r) => Math.max(0.05, Math.abs(r.theo || 0) * DB.settings.tolOk / 100);
  let falt = 0, sobr = 0, nDiff = 0, nAud = 0, nAudOk = 0;
  const body = rows.map(r => {
    const c = close ? close.counts[r.it.sku] : undefined, diff = c !== undefined && r.theo != null ? r4(c - r.theo) : null;
    let st = chip("", "Pendiente"), cls = "";
    if (diff != null){
      if (Math.abs(diff) <= tol(r)) st = chip("ok", "OK", "check");
      else if (diff < 0){ st = chip("bad", "Faltante", "alert"); cls = "hl"; falt += -diff * r.it.cost; nDiff++; }
      else { st = chip("warn", "Sobrante", "alert"); cls = "hw"; sobr += diff * r.it.cost; nDiff++; }
    }
    const a = audit ? audit[r.it.sku] : undefined;
    let ax = '<td class="n muted">—</td><td></td>';
    if (a !== undefined){
      nAud++;
      const dd = c !== undefined ? r4(c - a) : null, ok = dd != null && Math.abs(dd) <= 0.05;
      if (ok) nAudOk++;
      ax = '<td class="n">' + num(a) + '</td><td>' + (dd == null ? "" : ok ? chip("ok", "Coincide", "check") : chip("bad", "Difiere " + (dd > 0 ? "+" : "") + num(dd), "alert")) + '</td>';
    }
    return '<tr class="' + cls + '"><td>' + ilink(r.it) + '</td><td class="n">' + (r.open == null ? "—" : num(r.open)) + '</td><td class="n">' + num(r.inn) + '</td><td class="n">' + num(r.out) + '</td><td class="n">' + num(r.sold) + '</td><td class="n">' + num(r.court) + '</td><td class="n">' + num(r.merma) + '</td>' +
      '<td class="n"><b>' + (r.theo == null ? "—" : num(r.theo)) + '</b></td><td class="n">' + (c === undefined ? "—" : num(c)) + '</td><td class="n">' + (diff == null ? "—" : (diff > 0 ? "+" : "") + num(diff)) + '</td><td class="n">' + (diff == null ? "—" : money(diff * r.it.cost)) + '</td><td>' + st + '</td>' + ax + '</tr>';
  }).join("");
  h += '<div class="kpis" style="margin-bottom:16px"><div class="kpi"><span class="k">Faltantes</span><span class="v' + (falt > 0 ? " bad" : "") + '">' + money(falt) + '</span><span class="s">a costo, sin IGV</span></div>' +
    '<div class="kpi"><span class="k">Sobrantes</span><span class="v">' + money(sobr) + '</span><span class="s">pueden ser ventas sin registrar en caja</span></div>' +
    '<div class="kpi"><span class="k">Insumos con diferencia</span><span class="v">' + (close ? nDiff + " de " + rows.length : "—") + '</span><span class="s">' + (close ? "cierre enviado por " + esc(uname(close.by)) + " · " + esc(close.at) : "el operario aún no envía el cierre") + '</span></div>' +
    '<div class="kpi"><span class="k">Cruce con el auditor</span><span class="v">' + (audit ? nAudOk + " de " + nAud : "—") + '</span><span class="s">' + (audit ? "insumos donde operario y auditor coinciden" : "sin conteo del auditor ese día") + '</span></div></div>';
  if (!close) h += '<div class="box-warn" style="margin-bottom:12px">El operario todavía no envía el cierre de ' + POINTS[pt].toLowerCase() + ' del ' + fdate(date) + '. Abajo ves lo que debería quedar.</div>';
  h += '<div class="tw"><table class="wf"><thead><tr><th>Insumo</th><th class="n">Apertura</th><th class="n">+ Recibido</th><th class="n">− Enviado</th><th class="n">− Vendido</th><th class="n">− Cortesías</th><th class="n">− Mermas</th><th class="n">= Teórico</th><th class="n">Contado</th><th class="n">Dif.</th><th class="n">Valor</th><th>Estado</th><th class="n">Auditor</th><th>Operario vs auditor</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  h += '<p class="note" style="margin-top:12px">Teórico = apertura (cierre contado del día anterior) + recibido por despachos − enviado − consumo por recetas de lo vendido y de las cortesías − mermas descontadas. Se toma como OK una diferencia de hasta ' + pct(DB.settings.tolOk, 0) + ' (mínimo 0.05). Solo administración y gerencia ven esta comparación.</p>';
  return h;
}
ACT["dpt2"] = (el) => { UI.dpt2 = el.dataset.pt; render(); };
INPUT["ddate"] = (el) => { UI.ddate = el.value; render(); };
