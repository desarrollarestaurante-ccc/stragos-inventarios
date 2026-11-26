/* =========================================================
   Mermas y cortesías contra objetivo + 3 motivos más frecuentes
   y objetivos de la empresa (editables por admin y gerencia).
   ========================================================= */
SCREENS.control = () => {
  const M = metrics(), s = DB.settings;
  const vs = (val, obj) => val == null ? chip("", "Sin ventas para medir") : val <= obj ? chip("ok", "Dentro del objetivo", "check") : chip("bad", "Sobre el objetivo", "alert");
  const mer = DB.mermas.filter(m => m.status === "aprobada" && nov(m.date));
  const cor = DB.sales.filter(x => x.type === "cortesia" && nov(x.date));
  const charges = DB.charges.filter(c => nov(c.date));
  let h = phead("Mermas y cortesías", "¿Estamos dentro del objetivo? Noviembre 2026, valorizado a costo sin IGV y medido sobre la venta neta.");
  h += '<div class="kpis">' +
    '<div class="kpi"><span class="k">Mermas aprobadas</span><span class="v' + (M.mermasPct != null && M.mermasPct > s.mermaObj ? " bad" : "") + '">' + money(M.mermasMes) + '</span><span class="s">' + (M.mermasPct == null ? "" : pct(M.mermasPct, 2) + " de la venta · ") + 'objetivo ≤ ' + pct(s.mermaObj) + '</span>' + vs(M.mermasPct, s.mermaObj) + '</div>' +
    '<div class="kpi"><span class="k">Cortesías</span><span class="v' + (M.cortPct != null && M.cortPct > s.cortObj ? " bad" : "") + '">' + money(M.cortesias) + '</span><span class="s">' + (M.cortPct == null ? "" : pct(M.cortPct, 2) + " de la venta · ") + 'objetivo ≤ ' + pct(s.cortObj) + '</span>' + vs(M.cortPct, s.cortObj) + '</div>' +
    '<div class="kpi"><span class="k">Cortesías a precio de carta</span><span class="v">' + money(M.cortesiasLista) + '</span><span class="s">venta que se dejó de cobrar, sin IGV</span></div>' +
    '<div class="kpi"><span class="k">Cargos a responsables</span><span class="v">' + money(M.cargos) + '</span><span class="s">' + charges.length + (charges.length === 1 ? " merma rechazada" : " mermas rechazadas") + ' con cargo</span></div></div>';
  if (M.ventaNeta <= 0) h += '<div class="box-warn" style="margin-top:12px">Sin ventas POS cargadas no se puede medir el % contra el objetivo. Carga el Excel de prueba en «Ventas POS».</div>';
  // 3 motivos más frecuentes
  const top3 = (arr, key, val) => {
    const g = {}; arr.forEach(x => { const k = key(x) || "Sin motivo"; g[k] = g[k] || {k:k, n:0, v:0}; g[k].n++; g[k].v += val(x); });
    return Object.values(g).sort((a, b) => b.n - a.n || b.v - a.v).slice(0, 3);
  };
  const tm = top3(mer, m => m.reason, mermaValue), tc = top3(cor, c => c.detail, c => c.cost);
  const bars = (list, total, color) => list.length ? '<div class="hbars">' + list.map((x, i) => '<div class="hbar"><span><b>' + (i + 1) + '.</b> ' + esc(x.k) + '</span><div class="track"><div class="fill" style="background:' + color + ';width:' + Math.max(4, x.n / list[0].n * 100) + '%"></div></div><span class="val">' + x.n + ' · ' + money(x.v) + '</span></div>').join("") + '</div>' : '<div class="empty">Sin registros este mes.</div>';
  h += '<div class="cols-2" style="margin-top:20px"><div class="card"><h4>Mermas: 3 motivos más frecuentes</h4><p class="muted small" style="margin:0 0 12px">Veces que se repite · valor a costo</p>' + bars(tm, mer.length, "var(--bad)") + '</div>' +
    '<div class="card"><h4>Cortesías: 3 motivos más frecuentes</h4><p class="muted small" style="margin:0 0 12px">Veces que se repite · costo de las recetas</p>' + bars(tc, cor.length, "var(--warn)") + '</div></div>';
  // por semana
  const wk = [0,1,2].map(i => ({v:0, m:0, c:0}));
  DB.sales.filter(x => nov(x.date)).forEach(x => { const w = weekOf(x.date); if (w < 0) return; if (x.type === "cortesia") wk[w].c += x.cost; else wk[w].v += x.net; });
  mer.forEach(m => { const w = weekOf(m.date); if (w >= 0) wk[w].m += mermaValue(m); });
  const pc = (a, b) => b > 0 ? pct(a / b * 100, 2) : "—";
  h += '<h3 class="sec">Semana a semana</h3><div class="tw"><table><thead><tr><th>Semana</th><th class="n">Venta neta</th><th class="n">Mermas</th><th class="n">% venta</th><th class="n">Cortesías</th><th class="n">% venta</th></tr></thead><tbody>' +
    wk.map((w, i) => '<tr><td>Sem ' + (i + 1) + ' · ' + ["1–7","8–14","15–20"][i] + '</td><td class="n">' + money(w.v) + '</td><td class="n">' + money(w.m) + '</td><td class="n">' + pc(w.m, w.v) + '</td><td class="n">' + money(w.c) + '</td><td class="n">' + (w.v > 0 ? chip(w.c / w.v * 100 <= s.cortObj ? "ok" : "bad", pc(w.c, w.v)) : "—") + '</td></tr>').join("") + '</tbody></table></div>';
  // detalle de cortesías por producto
  const byP = {}; cor.forEach(c => { const p = product(c.code); const k = p ? p.name : c.code; byP[k] = byP[k] || {n:0, v:0}; byP[k].n += c.qty; byP[k].v += c.cost; });
  const pl = Object.keys(byP).map(k => ({k:k, ...byP[k]})).sort((a, b) => b.v - a.v).slice(0, 5);
  if (pl.length) h += '<h3 class="sec">Productos más regalados</h3><div class="tw"><table><thead><tr><th>Producto</th><th class="n">Unidades</th><th class="n">Costo</th></tr></thead><tbody>' + pl.map(p => '<tr><td>' + esc(p.k) + '</td><td class="n">' + num(p.n) + '</td><td class="n">' + money(p.v) + '</td></tr>').join("") + '</tbody></table></div>';
  if (charges.length) h += '<h3 class="sec">Cargos a responsables</h3><div class="tw"><table><thead><tr><th>Fecha</th><th>Qué</th><th>Responsable</th><th class="n">Monto a costo</th><th>Registró</th></tr></thead><tbody>' + charges.map(c => '<tr><td class="num">' + fdate(c.date) + '</td><td>' + esc(c.label) + '</td><td>' + esc(c.responsable) + '</td><td class="n">' + money(c.amount) + '</td><td class="small">' + esc(uname(c.by)) + '</td></tr>').join("") + '</tbody></table></div>';
  // objetivos
  const f = (k, label, unit, help) => '<div class="field"><label for="obj-' + k + '">' + label + '</label><div class="row" style="gap:6px;flex-wrap:nowrap"><input class="input" id="obj-' + k + '" inputmode="decimal" data-ch="obj" data-k="' + k + '" value="' + s[k] + '" style="max-width:120px"><span class="muted">' + unit + '</span></div><p class="help">' + help + '</p></div>';
  h += '<h3 class="sec">Objetivos de la empresa</h3><div class="card"><div class="grid-form">' +
    f("fcObj", "Food cost objetivo", "%", "Se usa en el dashboard y en promociones.") +
    f("ratioObj", "Compras ÷ ventas objetivo", "%", "Máximo de compras sobre la venta neta.") +
    f("mermaObj", "Mermas objetivo", "% de la venta", "Mermas aprobadas, a costo.") +
    f("cortObj", "Cortesías objetivo", "% de la venta", "Cortesías del POS, a costo.") +
    f("buyLimit", "Compras que aprueba Gerencia", "S/ desde", "Por encima de este monto aprueba Gerencia general.") +
    '</div><p class="muted small" style="margin:10px 0 0">Cada empresa puede tener sus propios objetivos. Los cambios quedan en la bitácora.</p></div>';
  return h;
};
INPUT["obj"] = (el) => {
  const k = el.dataset.k, v = Number(el.value.replace(",", "."));
  const max = k === "buyLimit" ? 1e7 : 100;
  if (!(v >= 0 && v <= max)){ toast(k === "buyLimit" ? "Usa un monto válido." : "Usa un porcentaje entre 0 y 100.", "err"); render(); return; }
  const old = DB.settings[k];
  withUndo("Cambiar objetivo: " + k, false, () => { DB.settings[k] = v; logEv("Cambió el objetivo " + k + ": " + old + " → " + v); return true; });
  render();
};
