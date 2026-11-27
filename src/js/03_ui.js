/* =========================================================
   Interfaz base: íconos, avisos, hojas, copiar, acceso,
   inactividad, navegación y guardas de ruta.
   ========================================================= */

const ICONS = {
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  chart:'<path d="M4 20V11M10 20V5M16 20v-8M21 20H3"/>',
  swap:'<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
  clip:'<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  box:'<path d="M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10"/>',
  truck:'<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>',
  glass:'<path d="M4 4h16l-8 9zM12 13v7M8 20h8"/>',
  file:'<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>',
  more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  check:'<path d="M5 12l5 5 9-10"/>',
  alert:'<path d="M12 3l10 18H2zM12 10v5M12 18v.01"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  search:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  drop:'<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01"/>',
  cal:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M8 14h3M8 17h6"/>',
  cart:'<path d="M3 4h2l2.5 11h11l2-8H6.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  undo:'<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>',
  cloud:'<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18zM12 11v5M9.5 13.5 12 11l2.5 2.5"/>',
  Licores:'<path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3zM8 13h8"/>',
  Bebidas:'<path d="M7 5h10v15a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1zM8 5l1-2h6l1 2M7 9h10"/>',
  Cocina:'<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 10h20M9 6c0-1 1-2 1-3M14 6c0-1 1-2 1-3"/>',
  Hielo:'<path d="M12 2l9 5v10l-9 5-9-5V7zM12 12l9-5M12 12L3 7M12 12v10"/>'
};
const ic = (n, cls) => '<svg class="ic' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || "") + '</svg>';
const chip = (c, txt, icon) => '<span class="chip ' + (c || "") + '">' + (icon ? ic(icon) : (c ? '<span class="dot"></span>' : "")) + esc(txt) + '</span>';
const semIcon = (c) => c === "ok" ? "check" : "alert";
/* nombre de insumo que abre su ficha (solo para roles que ven saldos y costos) */
const ilink = (it) => SESSION && can(SESSION.role, "costos")
  ? '<button type="button" class="ilink" data-act="item" data-sku="' + it.sku + '" title="Ver ficha de ' + esc(it.name) + '">' + esc(it.name) + '</button>' : esc(it.name);

/* ---------- avisos ---------- */
function toast(msg, kind, action){
  const host = $("toasts"); if (!host) return;
  const el = document.createElement("div");
  el.className = "toast " + (kind || "");
  el.innerHTML = "<span>" + esc(msg) + "</span>";
  let timer;
  if (action){
    const b = document.createElement("button"); b.type = "button"; b.textContent = action.label;
    b.addEventListener("click", () => { clearTimeout(timer); el.remove(); action.fn(); });
    el.appendChild(b);
  }
  host.appendChild(el);
  timer = setTimeout(() => el.remove(), action ? (action.ms || 10000) : 4200);
}

/* ---------- hoja modal ---------- */
function openSheet(html, onMount, wide){
  $("sheet").classList.toggle("wide", !!wide);
  $("sheet").innerHTML = html;
  $("sheet-bg").hidden = false;
  if (onMount) onMount($("sheet"));
  const f = $("sheet").querySelector("button,input,select,a"); if (f) f.focus();
}
function closeSheet(){ $("sheet-bg").hidden = true; $("sheet").innerHTML = ""; }
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("sheet-bg").hidden) closeSheet(); });
$("sheet-bg").addEventListener("click", e => { if (e.target.id === "sheet-bg") closeSheet(); });

/* ---------- copiar (con respaldo si el portapapeles está bloqueado) ---------- */
function copyText(text, label){
  const fallback = () => {
    openSheet('<h3>Copia el texto</h3><p class="muted small">El navegador bloqueó el portapapeles. El texto ya está seleccionado: usa Ctrl+C (o Copiar en el celular).</p>' +
      '<textarea class="input" id="copy-ta" readonly style="min-height:220px"></textarea><div class="row" style="margin-top:12px"><button class="btn" data-act="sheet-close">Listo</button></div>',
      (s) => { const ta = s.querySelector("#copy-ta"); ta.value = text; ta.focus(); ta.select(); });
  };
  try {
    navigator.clipboard.writeText(text).then(() => toast((label || "Texto") + " copiado. Pégalo en Excel o en un mensaje."), fallback);
  } catch(e){ fallback(); }
}
const csvCell = (v) => { const s = String(v == null ? "" : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCSV = (rows) => rows.map(r => r.map(csvCell).join(",")).join("\n");

/* ---------- imágenes del armazón ---------- */
document.querySelectorAll("[data-img]").forEach(el => { if (IMG[el.dataset.img]) el.src = IMG[el.dataset.img]; });
if (IMG.banner) $("login-photo").style.backgroundImage = "url(" + IMG.banner + ")";

/* =========================================================
   ACCESO
   ========================================================= */
const MAX_TRIES = 5, LOCK_SECS = 30, IDLE_SECS = 300, IDLE_WARN = 30;
let tries = 0, lockUntil = 0, lockTimer = null;
const lgUser = $("lg-user"), lgPass = $("lg-pass"), lgBtn = $("lg-submit"), lgAlert = $("lg-alert");

(function initLogin(){
  let rem = null; try { rem = localStorage.getItem(LS_USER); } catch(e){}
  if (rem){ lgUser.value = rem; $("lg-remember").checked = true; }
  $("lg-accts").innerHTML = Object.keys(USERS).map(u =>
    '<button type="button" class="acct" data-u="' + u + '"><b>' + esc(USERS[u].name) + '</b><small>' + esc(ROLES[USERS[u].role].label) + '</small><code>' + u + ' · ' + USERS[u].pass + '</code></button>'
  ).join("");
})();
$("lg-accts").addEventListener("click", e => {
  const b = e.target.closest(".acct"); if (!b) return;
  lgUser.value = b.dataset.u; lgPass.value = USERS[b.dataset.u].pass;
  fieldErr(lgUser, "lg-user-err", ""); fieldErr(lgPass, "lg-pass-err", "");
  lgBtn.focus();
});
$("lg-reveal").addEventListener("click", function(){
  const show = lgPass.type === "password";
  lgPass.type = show ? "text" : "password";
  this.textContent = show ? "Ocultar" : "Mostrar";
  this.setAttribute("aria-pressed", String(show));
  lgPass.focus();
});
const caps = (e) => { if (e.getModifierState) $("lg-caps").hidden = !e.getModifierState("CapsLock"); };
lgPass.addEventListener("keydown", caps); lgPass.addEventListener("keyup", caps);
lgPass.addEventListener("blur", () => { $("lg-caps").hidden = true; });
function fieldErr(input, id, msg){
  const h = $(id);
  if (msg){ h.textContent = msg; h.hidden = false; input.setAttribute("aria-invalid", "true"); }
  else { h.hidden = true; input.removeAttribute("aria-invalid"); }
}
lgUser.addEventListener("input", () => fieldErr(lgUser, "lg-user-err", ""));
lgPass.addEventListener("input", () => fieldErr(lgPass, "lg-pass-err", ""));
const loginAlert = (msg) => { lgAlert.textContent = msg; lgAlert.hidden = !msg; };

function startLock(){
  lockUntil = Date.now() + LOCK_SECS * 1000; lgBtn.disabled = true;
  const tick = () => {
    const left = Math.ceil((lockUntil - Date.now()) / 1000);
    if (left <= 0){ clearInterval(lockTimer); lgBtn.disabled = false; lgBtn.textContent = "Ingresar"; tries = 0; loginAlert(""); return; }
    loginAlert("Demasiados intentos fallidos. Vuelve a intentarlo en " + left + " s.");
    lgBtn.textContent = "Bloqueado · " + left + " s";
  };
  tick(); lockTimer = setInterval(tick, 1000);
}
$("lg-form").addEventListener("submit", e => {
  e.preventDefault();
  if (Date.now() < lockUntil) return;
  const u = lgUser.value.trim().toLowerCase(), p = lgPass.value;
  fieldErr(lgUser, "lg-user-err", u ? "" : "Escribe tu usuario.");
  fieldErr(lgPass, "lg-pass-err", p ? "" : "Escribe tu contraseña.");
  if (!u || !p){ (u ? lgPass : lgUser).focus(); return; }
  lgBtn.disabled = true; lgBtn.textContent = "Ingresando…";
  setTimeout(() => {
    lgBtn.disabled = false; lgBtn.textContent = "Ingresar";
    const acc = USERS[u];
    if (acc && acc.pass === p){
      tries = 0; loginAlert("");
      try { if ($("lg-remember").checked) localStorage.setItem(LS_USER, u); else localStorage.removeItem(LS_USER); } catch(err){}
      const guided = $("lg-guided").checked;
      if (GAS){ lgBtn.disabled = true; lgBtn.textContent = "Cargando datos del equipo…"; remoteLoad(() => { lgBtn.disabled = false; lgBtn.textContent = "Ingresar"; startSession(u, guided); }); }
      else startSession(u, guided);
    } else {
      tries++;
      logEv("Ingreso fallido con el usuario «" + u.slice(0, 30) + "»", "—");
      lgPass.value = ""; lgPass.focus();
      if (tries >= MAX_TRIES){ logEv("Acceso bloqueado 30 s por 5 intentos fallidos", "—"); startLock(); }
      else { const left = MAX_TRIES - tries; loginAlert("Usuario o contraseña incorrectos. Te " + (left === 1 ? "queda 1 intento" : "quedan " + left + " intentos") + " antes del bloqueo de 30 s."); }
    }
  }, 450);
});
$("reset-ask").addEventListener("click", () => { $("reset-confirm").hidden = false; });
$("reset-no").addEventListener("click", () => { $("reset-confirm").hidden = true; });
$("reset-yes").addEventListener("click", () => { resetDemo(); $("reset-confirm").hidden = true; loginAlert(""); toast("Demo restablecida con los datos de ejemplo."); });

let GUIDED = false;
function startSession(u, guided){
  SESSION = {user:u, role:USERS[u].role};
  GUIDED = !!guided;
  UI = {}; UNDO = [];
  const prev = DB.seen[u];
  UI.news = prev === undefined ? [] : computeNews(u, prev);
  logEv("Ingresó al sistema");
  DB.seen[u] = DB.log.length; save();
  $("v-login").hidden = true; $("v-app").hidden = false; document.body.classList.add("in-app");
  $("tb-name").textContent = USERS[u].name;
  $("tb-role").textContent = ROLES[SESSION.role].label;
  const sw = $("tb-switch");
  sw.hidden = !GUIDED;
  if (GUIDED) sw.innerHTML = Object.keys(USERS).map(k => '<option value="' + k + '"' + (k === u ? " selected" : "") + '>' + esc(USERS[k].name + " · " + ROLES[USERS[k].role].short) + '</option>').join("");
  resetIdle();
  const h = (location.hash || "").slice(1);
  go(h && h !== "inicio" ? h : "inicio", true);
}
$("tb-switch").addEventListener("change", function(){
  const u = this.value; if (!USERS[u] || !SESSION) return;
  logEv("Cambió a la cuenta de " + USERS[u].name + " (demo guiada)");
  startSession(u, true);
});
function endSession(reason){
  if (SESSION) logEv(reason === "idle" ? "Sesión cerrada por inactividad" : "Cerró sesión");
  SESSION = null; UNDO = []; clearInterval(idleTimer); $("idle").hidden = true; $("toasts").innerHTML = "";
  closeSheet();
  $("v-app").hidden = true; $("v-login").hidden = false; document.body.classList.remove("in-app");
  $("main").innerHTML = "";
  lgPass.value = ""; lgPass.type = "password"; $("lg-reveal").textContent = "Mostrar";
  if (!$("lg-remember").checked) lgUser.value = "";
  loginAlert(reason === "idle" ? "Tu sesión se cerró por 5 minutos de inactividad. Vuelve a ingresar." : "");
  try { history.replaceState(null, "", location.pathname + location.search); } catch(e){}
}
$("tb-out").addEventListener("click", () => endSession("manual"));

/* ---------- inactividad: 5 min, aviso 30 s antes ---------- */
let idleTimer = null, idleLeft = IDLE_SECS;
function resetIdle(){
  idleLeft = IDLE_SECS; $("idle").hidden = true;
  clearInterval(idleTimer);
  idleTimer = setInterval(() => {
    if (!SESSION){ clearInterval(idleTimer); return; }
    idleLeft--;
    if (idleLeft <= IDLE_WARN){ $("idle").hidden = false; $("idle-s").textContent = Math.max(idleLeft, 0); }
    if (idleLeft <= 0) endSession("idle");
  }, 1000);
}
["pointerdown","keydown"].forEach(ev => document.addEventListener(ev, () => { if (SESSION && idleLeft > IDLE_WARN) idleLeft = IDLE_SECS; }, {passive:true}));
$("idle-keep").addEventListener("click", resetIdle);

/* =========================================================
   NAVEGACIÓN Y GUARDAS DE RUTA
   ========================================================= */
let UI = {};           // estado de pantalla (pestañas, selección, borradores)
let CURRENT = "inicio";
const SCREENS = {};    // id → función render(view)

function go(target, silent){
  if (!SESSION) return;
  let [id, sub] = String(target || "inicio").split("-");
  if (!ROUTES.find(r => r.id === id)) id = "inicio";
  if (!canRoute(SESSION.role, id)){
    logEv("Acceso denegado a «" + id + "» (por ruta o consola)");
    toast("Tu rol no tiene acceso a ese módulo. Te llevamos a Inicio.", "err");
    id = "inicio"; sub = null;
  }
  CURRENT = id;
  if (sub) UI[id + "Tab"] = sub;
  const h = "#" + id;
  if (location.hash !== h){ try { history.replaceState(null, "", h); } catch(e){ location.hash = h; } }
  renderNav();
  render();
  if (!silent){ window.scrollTo(0, 0); }
}
window.addEventListener("hashchange", () => { if (SESSION) go(location.hash.slice(1)); });
/* acceso por consola: también pasa por la guarda */
window.app = Object.freeze({ go:(r) => go(r), rol:() => SESSION ? ROLES[SESSION.role].label : "sin sesión" });

function renderNav(){
  const role = SESSION.role;
  const mods = ROUTES.filter(r => canRoute(role, r.id));
  const MAXTOP = 6;
  const top = mods.slice(0, mods.length > MAXTOP ? MAXTOP - 1 : MAXTOP), rest = mods.slice(top.length);
  let h = top.map(r => '<a href="#' + r.id + '"' + (r.id === CURRENT ? ' class="on" aria-current="page"' : "") + '>' + esc(r.label) + '</a>').join("");
  if (rest.length){
    const on = rest.some(r => r.id === CURRENT);
    h += '<div class="tb-more"><button type="button" data-act="more-top" aria-expanded="false"' + (on ? ' style="border-bottom-color:var(--accent)"' : "") + '>más ▾</button>' +
      '<div class="tb-menu" id="tb-menu" hidden>' + rest.map(r => '<a href="#' + r.id + '"' + (r.id === CURRENT ? ' class="on"' : "") + '>' + esc(r.label) + '</a>').join("") + '</div></div>';
  }
  $("tb-nav").innerHTML = h;
  // celular: hasta 4 accesos + «más»
  const bn = mods.length > 5 ? mods.slice(0, 4) : mods;
  let b = bn.map(r => '<a href="#' + r.id + '"' + (r.id === CURRENT ? ' class="on" aria-current="page"' : "") + '>' + ic(r.icon) + '<span>' + esc(shortLabel(r)) + '</span></a>').join("");
  if (mods.length > 5) b += '<button type="button" data-act="more-sheet">' + ic("more") + '<span>más</span></button>';
  $("bnav").innerHTML = b;
}
const shortLabel = (r) => ({"mermas y cortesías":"control","inventario diario":"diario","conteo físico":"conteo","kardex y lotes":"kardex","pedido y transferencias":"pedido","catálogo y recetas":"recetas","reportes y bitácora":"reportes","movimientos":"movim."}[r.label] || r.label);

function render(){
  const V = view(SESSION.role);
  const fn = SCREENS[CURRENT] || SCREENS.inicio;
  $("main").innerHTML = fn(V);
  if (SCREENS[CURRENT + "_mount"]) SCREENS[CURRENT + "_mount"](V);
  refreshUndo();
}

/* =========================================================
   DESHACER (Ctrl+Z)
   Acciones simples: se deshacen al instante.
   Acciones que mueven inventario o aprobaciones: piden confirmación.
   Siempre queda en la bitácora quién deshizo qué y cuándo.
   El cierre de inventario, el envío de conteos y el inventario diario no se deshacen.
   ========================================================= */
let UNDO = [];
function snapState(){ const o = Object.assign({}, DB); delete o.log; delete o.seen; return JSON.stringify(o); }
function withUndo(label, sensitive, fn){
  const before = snapState();
  const r = fn();
  if (r === true || (r && r.ok)){
    UNDO.push({label:label, sensitive:sensitive, snap:before, rev:DB.rev, user:SESSION.user});
    if (UNDO.length > 15) UNDO.shift();
  }
  refreshUndo();
  return r;
}
function irreversible(){ UNDO = []; refreshUndo(); }
function undoTop(){
  const t = UNDO[UNDO.length - 1]; if (!t || !SESSION) return null;
  if (t.rev !== DB.rev || t.user !== SESSION.user){ UNDO = []; return null; }  // hubo otros cambios después: ya no es seguro
  return t;
}
function refreshUndo(){
  const b = $("tb-undo"); if (!b) return;
  const t = undoTop(); b.hidden = !t;
  if (t) b.title = "Deshacer: " + t.label + " (Ctrl+Z)";
}
function askUndo(){
  const t = undoTop();
  if (!t){ toast("No hay nada que deshacer. Se puede deshacer tu última acción mientras nadie haya hecho otro cambio.", "warn"); refreshUndo(); return; }
  if (!t.sensitive){ doUndo(); return; }
  openSheet('<h3>¿Deshacer esta acción?</h3><p style="margin:0 0 8px"><b>' + esc(t.label) + '</b></p><p class="muted small">Esta acción movió inventario o una aprobación. Se revertirá y quedará en la bitácora con tu usuario y la hora, para no perder la trazabilidad.</p>' +
    '<div class="row" style="margin-top:14px"><button class="btn" data-act="undo-yes">Sí, deshacer</button><button class="btn ghost" data-act="sheet-close">Cancelar</button></div>');
}
function doUndo(){
  const t = undoTop(); if (!t) return;
  UNDO.pop();
  const keepLog = DB.log, keepSeen = DB.seen, keepSeq = DB.seq;
  DB = JSON.parse(t.snap); DB.log = keepLog; DB.seen = keepSeen; DB.seq = Math.max(DB.seq, keepSeq);
  logEv("Deshizo: " + t.label + (t.sensitive ? " (confirmado)" : ""));
  const n = UNDO[UNDO.length - 1]; if (n) n.rev = DB.rev;
  closeSheet(); toast("Se deshizo: " + t.label + ".");
  render();
}
document.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || (e.key !== "z" && e.key !== "Z") || !SESSION) return;
  if (e.target && e.target.closest && e.target.closest("input,textarea,select,[contenteditable]")) return; // en un campo, Ctrl+Z es el del navegador
  e.preventDefault(); askUndo();
});
function phead(title, sub, actions){
  return '<div class="phead"><div class="txt"><h1 class="bracket">' + esc(title) + '</h1><p>' + sub + '</p></div>' + (actions ? '<div class="actions">' + actions + '</div>' : "") + '</div>';
}
const tabs = (key, list, def) => {
  const cur = UI[key] && list.some(t => t.id === UI[key]) ? UI[key] : def;
  UI[key] = cur;
  return '<div class="tabs" role="tablist">' + list.map(t => '<button type="button" role="tab" aria-selected="' + (t.id === cur) + '" class="' + (t.id === cur ? "on" : "") + '" data-act="tab" data-key="' + key + '" data-id="' + t.id + '">' + esc(t.label) + (t.count ? ' <span class="count">' + t.count + '</span>' : "") + '</button>').join("") + '</div>';
};

/* ---------- despachador de acciones ---------- */
const ACT = {};
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) { const m = $("tb-menu"); if (m && !e.target.closest(".tb-more")) m.hidden = true; return; }
  const fn = ACT[el.dataset.act];
  if (fn){ e.preventDefault(); fn(el, e); }
});
const INPUT = {};
document.addEventListener("input", e => { const el = e.target.closest("[data-in]"); if (el && INPUT[el.dataset.in]) INPUT[el.dataset.in](el, e); });
document.addEventListener("change", e => { const el = e.target.closest("[data-ch]"); if (el && INPUT[el.dataset.ch]) INPUT[el.dataset.ch](el, e); });

ACT["sheet-close"] = () => closeSheet();
ACT["undo"] = () => askUndo();
ACT["undo-yes"] = () => doUndo();
ACT["go"] = (el) => go(el.dataset.to);
ACT["tab"] = (el) => { UI[el.dataset.key] = el.dataset.id; render(); };
ACT["more-top"] = (el) => { const m = $("tb-menu"); m.hidden = !m.hidden; el.setAttribute("aria-expanded", String(!m.hidden)); };
ACT["more-sheet"] = () => {
  const mods = ROUTES.filter(r => canRoute(SESSION.role, r.id));
  openSheet('<h3>Más módulos</h3><div class="sheet-nav">' + mods.map(r => '<a href="#' + r.id + '" data-act="sheet-go" data-to="' + r.id + '"' + (r.id === CURRENT ? ' class="on"' : "") + '>' + ic(r.icon) + esc(r.label) + '</a>').join("") + '</div>');
};
ACT["sheet-go"] = (el) => { closeSheet(); go(el.dataset.to); };
