/**
 * Stragos Ucello · Inventarios (v7) — Web app en Google Apps Script
 *
 * - doGet() sirve la página index.html, o los datos en JSON con ?accion=cargar.
 * - doPost() recibe los cambios desde la página publicada en GitHub Pages.
 * - cargarEstado() / guardarEstado() guardan todos los datos del sistema en un
 *   archivo JSON de Google Drive, para que todo el equipo vea lo mismo.
 * - Menú «Stragos» en la hoja: vuelca los datos a pestañas para analizarlos.
 *
 * Seguridad: las contraseñas de demo siguen en la página. Antes de usar datos
 * reales hay que validar a las personas en el servidor (ver la guía, fase 2).
 */

const ARCHIVO_ESTADO = 'stragos-inventarios-estado.json';

/**
 * GET sin parámetros: muestra la aplicación (sigue funcionando desde script.google.com).
 * GET ?accion=cargar: devuelve los datos en JSON para la página de GitHub Pages.
 */
function doGet(e) {
  const accion = e && e.parameter ? e.parameter.accion : '';
  if (accion === 'cargar') return json_(cargarEstado());
  if (accion === 'ping') return json_(JSON.stringify({ ok: true, ver: versionActual_() }));
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Inventarios Stragos Ucello')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/**
 * POST desde GitHub Pages. Cuerpo (texto JSON): {accion:"guardar", json:"<estado>", ver:<número>}.
 * Se envía como text/plain para que el navegador no haga consulta previa de CORS.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.accion === 'guardar') return json_(guardarEstado(body.json, body.ver));
    return json_(JSON.stringify({ ok: false, error: 'Acción desconocida' }));
  } catch (err) {
    return json_(JSON.stringify({ ok: false, error: String(err && err.message || err) }));
  }
}

function json_(texto) {
  return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- estado compartido en Drive ---------- */
function archivoEstado_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ESTADO_ID');
  if (id) {
    try { return DriveApp.getFileById(id); } catch (e) { /* se borró: se crea otro */ }
  }
  const f = DriveApp.createFile(ARCHIVO_ESTADO, 'null', MimeType.PLAIN_TEXT);
  props.setProperty('ESTADO_ID', f.getId());
  props.setProperty('ESTADO_VER', '0');
  return f;
}

function versionActual_() {
  return Number(PropertiesService.getScriptProperties().getProperty('ESTADO_VER') || 0);
}

/** La página lo llama al ingresar. Devuelve {ver, estado} como texto JSON. */
function cargarEstado() {
  const txt = archivoEstado_().getBlob().getDataAsString('UTF-8');
  return JSON.stringify({ ver: versionActual_(), estado: txt || 'null' });
}

/**
 * La página lo llama después de cada cambio.
 * Si otra persona guardó antes (versión distinta), no sobrescribe: devuelve
 * los datos más recientes para que la página los recargue.
 */
function guardarEstado(json, verBase) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ver = versionActual_();
    if (Number(verBase) !== ver) {
      return JSON.stringify({ ok: false, conflicto: true, ver: ver, estado: archivoEstado_().getBlob().getDataAsString('UTF-8') });
    }
    JSON.parse(json); // valida que sea JSON antes de guardar
    archivoEstado_().setContent(json);
    PropertiesService.getScriptProperties().setProperty('ESTADO_VER', String(ver + 1));
    return JSON.stringify({ ok: true, ver: ver + 1 });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- volcado a Google Sheets para análisis ---------- */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Stragos')
    .addItem('Actualizar hojas con los datos del sistema', 'volcarHojas')
    .addItem('Abrir la aplicación', 'mostrarEnlace')
    .addToUi();
}

function mostrarEnlace() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(url ? 'Aplicación publicada en:\n' + url : 'Todavía no hay una implementación web. Ve a Implementar > Nueva implementación.');
}

function volcarHojas() {
  const txt = archivoEstado_().getBlob().getDataAsString('UTF-8');
  if (!txt || txt === 'null') {
    SpreadsheetApp.getUi().alert('Aún no hay datos: entra a la aplicación y haz al menos un cambio.');
    return;
  }
  const db = JSON.parse(txt);
  const nombre = (u) => u || '';

  const saldo = {};
  db.items.forEach(it => { saldo[it.sku] = it.initial; });
  db.movs.forEach(m => { saldo[m.sku] = (saldo[m.sku] || 0) + m.qty; });

  escribir_('Insumos', ['SKU', 'Insumo', 'Unidad', 'Categoría', 'Saldo teórico', 'Costo promedio', 'Valor sin IGV'],
    db.items.map(it => [it.sku, it.name, it.unit, it.cat, round_(saldo[it.sku]), round_(it.cost), round_(saldo[it.sku] * it.cost)]));
  escribir_('Movimientos', ['Fecha', 'SKU', 'Tipo', 'Cantidad', 'Neto compra', 'Detalle', 'Usuario'],
    db.movs.map(m => [m.date, m.sku, m.type, round_(m.qty), m.net || '', m.note || '', nombre(m.user)]));
  escribir_('Ventas', ['Fecha', 'Código POS', 'Tipo', 'Cantidad', 'Precio unit.', 'Venta neta', 'Costo', 'Detalle'],
    db.sales.map(s => [s.date, s.code, s.type || 'venta', s.qty, s.unit || '', round_(s.net), round_(s.cost), s.detail || '']));
  escribir_('Mermas', ['Fecha', 'Qué', 'Cantidad', 'Punto', 'Motivo', 'Estado', 'Resolución', 'Reportó', 'Resolvió'],
    db.mermas.map(m => [m.date, m.label, m.qty, m.point, m.reason, m.status, m.resolution || '', nombre(m.by), nombre(m.approvedBy)]));
  escribir_('Compras', ['Orden', 'Fecha', 'Estado', 'Estimado', 'Recibido neto', 'Solicitó', 'Aprobó', 'Recibió'],
    (db.pos || []).map(p => [p.id, p.date, p.status, p.total, p.net || '', nombre(p.by), nombre(p.approvedBy), nombre(p.receivedBy)]));
  escribir_('Bitacora', ['Fecha y hora', 'Usuario', 'Rol', 'Acción'],
    db.log.map(l => [l.ts, l.user, l.role, l.action]));
  SpreadsheetApp.getActive().toast('Hojas actualizadas con los datos del sistema.', 'Stragos');
}

function escribir_(nombre, cabecera, filas) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  sh.clearContents();
  sh.getRange(1, 1, 1, cabecera.length).setValues([cabecera]).setFontWeight('bold');
  if (filas.length) sh.getRange(2, 1, filas.length, cabecera.length).setValues(filas);
  sh.setFrozenRows(1);
}

function round_(n) { return Math.round((Number(n) || 0) * 100) / 100; }
