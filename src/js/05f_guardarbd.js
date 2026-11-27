/* =========================================================
   Guardar BD → webhook de Make → Google Sheets
   Envía un JSON con dos partes:
     cabecera: tienda, punto, responsable, fecha, hora…  → pestaña «Cabecera»
     detalle:  una fila por material contado o en stock   → pestaña «Detalle»
   Las columnas del detalle son siempre las mismas (vacías si no aplican
   o si el rol no puede ver costos ni saldos teóricos), para que en Make
   el mapeo se haga una sola vez.
   ========================================================= */
const BD_DETAIL_COLS = ["id_envio","linea","tipo","punto","sku","insumo","categoria","unidad","apertura","recibido","enviado","consumo_recetas","mermas","saldo_teorico","cantidad_contada","diferencia","costo_unitario","valor"];
const BD_TIPOS = {inventario_diario:"Inventario diario", conteo_fisico:"Conteo físico", kardex:"Kardex (saldos)"};
const makeUrl = () => (DB.settings.makeUrl || window.STRAGOS_MAKE || "").trim();
const storeName = () => DB.settings.store || "Stragos Ucello · San Borja";
const v4 = (n) => n === null || n === undefined || n === "" || isNaN(n) ? "" : r4(n);

function bdButton(tipo, ctx){
  return '<button class="btn sm" data-act="bd" data-tipo="' + tipo + '" data-ctx="' + esc(ctx || "") + '" title="Envía esta información a Google Sheets por Make">' + ic("cloud") + 'Guardar BD</button>';
}

/* arma {cabecera, detalle} según lo que el rol puede ver */
function bdPayload(tipo, ctx){
  const role = SESSION.role, costs = can(role, "costos"), now = new Date();
  const hora = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0") + ":" + String(now.getSeconds()).padStart(2, "0");
  const id = "ENV-" + DEMO_DATE.replace(/-/g, "") + "-" + hora.replace(/:/g, "") + "-" + SESSION.user;
  let punto = "Todos", responsable = USERS[SESSION.user].name, rows = [], err = null;
  const row = (o) => { const r = {}; BD_DETAIL_COLS.forEach(k => { r[k] = o[k] === undefined ? "" : o[k]; }); return r; };
  const base = (it, pt) => ({sku:it.sku, insumo:it.name, categoria:it.cat, unidad:it.unit, punto:POINTS[pt] || pt});

  if (tipo === "inventario_diario"){
    const pt = ctx === "coc" ? "coc" : "bar"; punto = POINTS[pt];
    const date = role === "op" ? DEMO_DATE : (UI.ddate || DEMO_DATE);
    const close = dailyOf(pt, date);
    if (!close) err = "Primero hay que enviar el cierre de turno de " + punto.toLowerCase() + ".";
    else {
      responsable = uname(close.by);
      if (role === "op"){
        const d = view("op").daily.find(x => x.pt === pt);
        rows = d.rows.map(r => { const it = item(r.sku); return row({...base(it, pt), apertura:v4(r.open), recibido:v4(r.inn), enviado:v4(r.out), mermas:v4(r.merma), cantidad_contada:v4(r.close)}); });
      } else {
        rows = dailyTheo(pt, date).map(r => {
          const c = close.counts[r.it.sku], diff = c !== undefined && r.theo != null ? r4(c - r.theo) : "";
          return row({...base(r.it, pt), apertura:v4(r.open), recibido:v4(r.inn), enviado:v4(r.out), consumo_recetas:v4(r.sold + r.court), mermas:v4(r.merma),
            saldo_teorico:v4(r.theo), cantidad_contada:v4(c), diferencia:diff, costo_unitario:r4(r.it.cost), valor:diff === "" ? "" : r2(diff * r.it.cost)});
        });
      }
    }
  } else if (tipo === "conteo_fisico"){
    const st = DB.count.status;
    if (role === "aud"){
      if (st !== "sent" && st !== "closed") err = "Primero envía el conteo físico.";
      else {
        responsable = uname(DB.count.by);
        ["bar","coc","alm"].forEach(pt => DB.items.forEach(it => {
          const v = DB.count.values[pt][it.sku];
          if (countPointsFor(it.sku).includes(pt)) rows.push(row({...base(it, pt), cantidad_contada:v4(v)}));
        }));
      }
    } else if (st === "sent"){
      responsable = uname(DB.count.by);
      rows = countComparison().map(r => row({...base(r.it, "Todos"), punto:"Todos", saldo_teorico:v4(r.theo), cantidad_contada:v4(r.counted), diferencia:v4(r.diff), costo_unitario:r4(r.it.cost), valor:r2(r.value)}));
    } else if (DB.lastCount){
      responsable = uname(DB.lastCount.by);
      rows = DB.lastCount.rows.map(r => { const it = item(r.sku); return row({...base(it, "Todos"), punto:"Todos", saldo_teorico:v4(r.theo), cantidad_contada:v4(r.counted), diferencia:v4(r.diff), costo_unitario:r4(r.cost), valor:r2(r.diff * r.cost)}); });
    } else err = "No hay un conteo enviado ni cerrado para guardar.";
  } else if (tipo === "kardex"){
    if (!costs) err = "Tu rol no puede guardar los saldos del Kardex.";
    else DB.items.forEach(it => ["alm","bar","coc"].forEach(pt => {
      const s = pointStock(it.sku, pt); if (s === null) return;
      rows.push(row({...base(it, pt), saldo_teorico:v4(s), costo_unitario:r4(it.cost), valor:r2(s * it.cost)}));
    }));
  } else err = "Tipo de envío desconocido.";

  rows.forEach((r, i) => { r.id_envio = id; r.linea = i + 1; r.tipo = tipo; });
  return {err:err, payload:{
    origen:"stragos-inventarios", version:7, id_envio:id, tipo:tipo,
    cabecera:{id_envio:id, tipo:BD_TIPOS[tipo] || tipo, tienda:storeName(), punto:punto, responsable:responsable,
      enviado_por:USERS[SESSION.user].name, rol:ROLES[role].label, fecha:DEMO_DATE, hora:hora, total_items:rows.length, enviado_en:now.toISOString()},
    detalle:rows
  }};
}

/* POST JSON al webhook. Make acepta llamadas del navegador (CORS); si el navegador
   la bloquea igual, se reintenta sin leer respuesta (no-cors). */
async function postWebhook(url, payload){
  const body = JSON.stringify(payload);
  try {
    const r = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body:body});
    const text = await r.text();
    return {ok:r.ok, confirmed:true, status:r.status, text:text.slice(0, 120)};
  } catch(e){
    try { await fetch(url, {method:"POST", mode:"no-cors", headers:{"Content-Type":"text/plain"}, body:body}); return {ok:true, confirmed:false}; }
    catch(e2){ return {ok:false, confirmed:false, error:String(e2 && e2.message || e2)}; }
  }
}

async function guardarBD(tipo, ctx, btn){
  const url = makeUrl();
  if (!url){
    toast(can(SESSION.role, "reportes") ? "Falta la URL del webhook de Make. Pégala en Reportes → Guardar BD." : "Todavía no está configurado el webhook. Pide a administración que lo configure en Reportes → Guardar BD.", "warn");
    return;
  }
  const {err, payload} = bdPayload(tipo, ctx);
  if (err){ toast(err, "warn"); return; }
  if (btn){ btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.textContent = "Enviando…"; }
  const r = await postWebhook(url, payload);
  if (btn){ btn.disabled = false; btn.innerHTML = btn.dataset.label; }
  DB.sends = DB.sends || [];
  DB.sends.push({id:payload.id_envio, ts:nowTs(), tipo:tipo, punto:payload.cabecera.punto, items:payload.detalle.length, user:SESSION.user, ok:r.ok, confirmed:r.confirmed, status:r.status || null});
  if (DB.sends.length > 100) DB.sends.splice(0, DB.sends.length - 100);
  if (r.ok){
    logEv("Guardó en BD (Make): " + (BD_TIPOS[tipo] || tipo) + " · " + payload.cabecera.punto + " · " + payload.detalle.length + " filas · " + payload.id_envio);
    toast(r.confirmed ? "Guardado: Make recibió " + payload.detalle.length + " filas (" + payload.id_envio + ")." : "Enviado a Make (" + payload.detalle.length + " filas). El navegador no permitió leer la confirmación: revisa la hoja.");
  } else {
    logEv("Falló el envío a BD (Make): " + (BD_TIPOS[tipo] || tipo) + (r.status ? " · HTTP " + r.status : ""));
    toast(r.status === 404 ? "Make no encontró ese webhook (404). Revisa la URL en Reportes → Guardar BD." :
      r.status ? "Make respondió con error " + r.status + ". Revisa que el escenario esté activo." :
      "No se pudo conectar con Make. Revisa tu internet; en el artefacto de Claude los envíos externos están bloqueados: usa el link de GitHub Pages.", "err");
  }
  if (CURRENT === "reportes") render();
}
ACT["bd"] = (el) => { guardarBD(el.dataset.tipo, el.dataset.ctx, el); };

/* --- configuración (Reportes → Guardar BD) --- */
function bdConfigHtml(){
  const editable = can(SESSION.role, "reportes"), url = makeUrl(), sends = (DB.sends || []).slice().reverse().slice(0, 20);
  let h = '<div class="cols-2"><div class="card"><h4>Webhook de Make</h4><p class="muted small" style="margin:0 0 12px">El botón «Guardar BD» de Inventario diario, Conteo físico y Kardex envía la información a este webhook. Make la escribe en Google Sheets en las pestañas Cabecera y Detalle.</p>' +
    '<div class="field"><label for="bd-url">URL del webhook</label><input class="input" id="bd-url" data-ch="bd-url" placeholder="https://hook.us1.make.com/…" value="' + esc(url) + '"' + (editable ? "" : " readonly") + '><p class="help">Se copia en Make, en el módulo «Webhooks → Custom webhook».</p></div>' +
    '<div class="field" style="margin-top:12px"><label for="bd-store">Nombre de la tienda</label><input class="input" id="bd-store" data-ch="bd-store" maxlength="60" value="' + esc(storeName()) + '"' + (editable ? "" : " readonly") + '><p class="help">Va en la columna «tienda» de la cabecera.</p></div>' +
    '<div class="row" style="margin-top:14px"><button class="btn" data-act="bd-test"' + (url ? "" : " disabled") + '>' + ic("cloud") + 'Enviar prueba (Kardex)</button>' + (url ? chip("ok", "Configurado", "check") : chip("warn", "Sin configurar", "alert")) + '</div>' +
    '<p class="muted small" style="margin:10px 0 0">La primera prueba le enseña a Make la estructura del JSON. Después puedes mapear las columnas en Google Sheets.</p></div>';
  h += '<div class="card"><h4>Qué se envía</h4><p class="small" style="margin:0 0 6px"><b>Cabecera</b> (una fila por envío): id_envio, tipo, tienda, punto, responsable, enviado_por, rol, fecha, hora, total_items, enviado_en.</p>' +
    '<p class="small" style="margin:0 0 6px"><b>Detalle</b> (una fila por material): ' + BD_DETAIL_COLS.join(", ") + '.</p>' +
    '<p class="muted small" style="margin:0">El operario y el auditor no envían costos ni saldos teóricos: esas columnas van vacías.</p></div></div>';
  h += '<h3 class="sec">Últimos envíos</h3>' + (sends.length ? '<div class="tw"><table><thead><tr><th>Fecha y hora</th><th>Tipo</th><th>Punto</th><th class="n">Filas</th><th>Usuario</th><th>Resultado</th><th>ID</th></tr></thead><tbody>' +
    sends.map(s => '<tr><td class="num">' + esc(s.ts) + '</td><td>' + esc(BD_TIPOS[s.tipo] || s.tipo) + '</td><td>' + esc(s.punto) + '</td><td class="n">' + s.items + '</td><td class="small">' + esc(uname(s.user)) + '</td><td>' +
      (s.ok ? chip(s.confirmed ? "ok" : "warn", s.confirmed ? "Recibido" : "Enviado sin confirmación", s.confirmed ? "check" : "alert") : chip("bad", "Error" + (s.status ? " " + s.status : ""), "alert")) + '</td><td class="sku">' + esc(s.id) + '</td></tr>').join("") + '</tbody></table></div>'
    : '<div class="empty"><b>Todavía no hay envíos</b>Usa «Enviar prueba» o el botón «Guardar BD» de cada pantalla.</div>');
  return h;
}
INPUT["bd-url"] = (el) => {
  if (!need("reportes", "configurar el webhook")) return;
  const v = el.value.trim();
  if (v && !/^https:\/\/[^\s]+$/i.test(v)){ toast("La URL debe empezar con https://", "err"); render(); return; }
  if (v && !/make\.com\//i.test(v)) toast("Ojo: la URL no parece de Make (hook.…make.com). Se guarda igual.", "warn");
  withUndo("Cambiar el webhook de Make", false, () => { DB.settings.makeUrl = v; logEv(v ? "Configuró el webhook de Make" : "Quitó el webhook de Make"); return true; });
  render();
};
INPUT["bd-store"] = (el) => {
  if (!need("reportes", "cambiar el nombre de la tienda")) return;
  const v = el.value.trim().slice(0, 60); if (!v){ render(); return; }
  withUndo("Cambiar el nombre de la tienda", false, () => { DB.settings.store = v; logEv("Cambió el nombre de la tienda: " + v); return true; });
  render();
};
ACT["bd-test"] = (el) => { guardarBD("kardex", "", el); };
