# Inventarios Stragos Ucello

Prototipo académico de control de inventarios para un karaoke-bar (San Borja, Lima): ingreso por usuario y contraseña, pantallas por rol, compras con aprobación, mermas con flujo de rechazo, inventario diario de barra y cocina, conteo físico a ciego, ventas POS con cortesías y promociones, recetas con food cost y reportes. **Datos ficticios.**

## Cómo funciona

```
GitHub Pages (docs/index.html)  ──fetch──▶  Google Apps Script (/exec)  ──▶  archivo JSON en Google Drive
        la página que abre el equipo           doGet ?accion=cargar · doPost       los datos compartidos
```

- La página vive en GitHub Pages, así que abre en cualquier navegador aunque tenga varias cuentas de Google abiertas.
- Apps Script solo guarda y entrega los datos. Si dos personas guardan a la vez, la segunda recarga los datos más recientes en lugar de pisarlos.
- El mismo Apps Script también sigue mostrando la app en su propio link `/exec`.

## Carpetas

| Carpeta o archivo | Contenido |
|---|---|
| `docs/index.html` | Página publicada en GitHub Pages (se genera, no se edita a mano). |
| `apps-script/` | `Code.gs`, `index.html`, `appsscript.json` y la guía `LEEME.md` para Google Apps Script. |
| `src/` | Código fuente: `app.css`, `shell.html` y `js/` dividido por módulo (núcleo, lógica, pantallas, compras, diario, control…). |
| `img/` | Fotos de la carta (4:3, con logotipo) y logotipo blanco. |
| `datos-prueba/` | Excel y CSV de ventas con cortesías y promociones, y el script que los genera. |
| `make/` | Botón «Guardar BD»: guía para armar el escenario de Make, plantilla de Google Sheets (Cabecera y Detalle) y un JSON de ejemplo. |
| `config.json` | URL `/exec` del Apps Script que usa la versión de GitHub Pages. |
| `build.py` | Junta todo en un solo HTML para el artefacto, Apps Script y GitHub Pages. |

## Hacer un cambio

1. Edita el archivo de `src/` que corresponda (por ejemplo `src/js/05c_compras.js` para Compras).
2. Genera las páginas: `python build.py` (requiere Python con Pillow: `pip install pillow`).
3. Sube el cambio a GitHub. GitHub Pages se actualiza solo en uno o dos minutos.
4. Si cambiaste `Code.gs` o quieres actualizar la copia de Apps Script: pega el archivo en el editor y crea una **Nueva versión** de la implementación (el link `/exec` no cambia).

Para trabajar varias personas a la vez: cada una edita módulos distintos de `src/js/` en su propia rama y abre un *pull request*; así los cambios se juntan sin pisarse.

## Cuentas de demo

| Persona | Usuario | Contraseña | Rol |
|---|---|---|---|
| Juan Diego | `jdiego` | 5555 | Gerente general |
| Christopher Castillo | `ccastillo` | 4444 | Administrador |
| Lindsay Robles | `lrobles` | 3333 | Encargado de almacén |
| Sadae | `sadae` | 2222 | Auditor de inventario |
| Equipo de barra | `barra` | 1111 | Operario de barra/cocina |

> Simulación: las contraseñas viven en la página y el servicio de datos acepta a cualquiera que tenga el link. Antes de usar datos reales hay que validar a las personas en el servidor (fase 2).
