# Inventarios Stragos Ucello como web app en Google Apps Script

Con estos pasos la misma aplicación del artefacto queda publicada en un enlace de Google y **todo el equipo comparte los mismos datos** (se guardan en un archivo de Google Drive del dueño del proyecto), en lugar de que cada navegador tenga los suyos.

Archivos de esta carpeta:

| Archivo | Para qué sirve |
|---|---|
| `Code.gs` | Servidor: muestra la página y guarda o lee los datos en Drive. Agrega el menú «Stragos» en la hoja. |
| `index.html` | La aplicación completa (la misma del artefacto, con las fotos incluidas). |
| `appsscript.json` | Configuración del proyecto: zona horaria de Lima y ajustes de la web app. |

## Paso a paso

### 1. Crear la hoja del proyecto
1. Entra a [sheets.new](https://sheets.new) con la cuenta de Google que será dueña del sistema (idealmente una cuenta del grupo, no personal).
2. Ponle de nombre **Stragos · Inventarios (BD)**.

### 2. Abrir el editor de Apps Script
1. En la hoja: **Extensiones → Apps Script**.
2. Arriba a la izquierda, cambia «Proyecto sin título» por **Stragos Inventarios**.

### 3. Pegar el servidor (`Code.gs`)
1. En el editor ya existe `Código.gs`. Borra su contenido.
2. Abre `Code.gs` de esta carpeta, copia todo y pégalo.
3. Guarda con **Ctrl+S**.

### 4. Agregar la página (`index.html`)
1. En el panel de archivos, pulsa **+ → HTML** y llámalo exactamente **`index`** (el editor le agrega `.html`).
2. Borra el contenido de ejemplo.
3. Abre `index.html` de esta carpeta con el Bloc de notas o VS Code, selecciona todo (**Ctrl+A**), copia y pégalo en el editor.
4. Guarda con **Ctrl+S**. Pesa unos 830 KB porque trae las 8 fotos; puede tardar unos segundos.

> Si el editor no deja guardar por el tamaño, avísame y separo las fotos en archivos aparte (se cargan desde Drive) para que la página quede liviana.

### 5. Ajustar la configuración (`appsscript.json`)
1. Ve a **Configuración del proyecto** (ícono de engranaje) y activa **Mostrar el archivo de manifiesto «appsscript.json» en el editor**.
2. Vuelve al editor, abre `appsscript.json`, reemplaza su contenido por el de esta carpeta y guarda.

### 6. Autorizar el acceso a Drive (una sola vez)
1. Arriba, en el selector de funciones, elige **`cargarEstado`** y pulsa **Ejecutar**.
2. Google pedirá permisos: **Revisar permisos → elige la cuenta → Avanzado → Ir a Stragos Inventarios (no seguro) → Permitir**. Sale como «no seguro» porque es un script propio que Google no ha verificado.
3. Se crea en tu Drive el archivo `stragos-inventarios-estado.json`, donde quedarán los datos.

### 7. Publicar la web app
1. Pulsa **Implementar → Nueva implementación**.
2. En «Seleccionar tipo», elige **Aplicación web**.
3. Completa:
   - **Descripción:** v7.
   - **Ejecutar como:** *Yo* (así todos leen y escriben en el mismo archivo de Drive).
   - **Quién tiene acceso:** *Cualquier usuario con una cuenta de Google*. Si todos usan correo de la universidad, puedes elegir solo tu dominio.
4. Pulsa **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`). Ese es el enlace para compartir.

### 8. Probar
1. Abre la URL en una ventana de incógnito e ingresa con `jdiego` / `5555`.
2. Carga el ejemplo de ventas, ciérralo y entra desde otro navegador con `ccastillo` / `4444`: debes ver las mismas ventas. Eso confirma que los datos se comparten.

### 9. Ver los datos en la hoja
1. Recarga la hoja de cálculo. Aparece el menú **Stragos**.
2. **Stragos → Actualizar hojas con los datos del sistema** crea o actualiza las pestañas Insumos, Movimientos, Ventas, Mermas, Compras y Bitácora, listas para tablas dinámicas o gráficos.

### 10. Publicar cambios futuros sin cambiar el enlace
1. Reemplaza `index.html` (o `Code.gs`) con la versión nueva y guarda.
2. **Implementar → Gestionar implementaciones →** lápiz de editar **→ Versión: Nueva versión → Implementar**.
3. La URL `/exec` sigue siendo la misma.

## Usarlo desde GitHub Pages (recomendado)

Google no abre bien las apps de `script.google.com` cuando el navegador tiene varias cuentas abiertas. Por eso la página principal vive en GitHub Pages y Apps Script queda como servicio de datos:

1. Reemplaza `Code.gs` en el editor por la versión de esta carpeta (trae `doPost` y `?accion=cargar`) y guarda.
2. **Implementar → Gestionar implementaciones → lápiz → Versión: Nueva versión → Implementar.** Verifica que *Quién tiene acceso* diga **Cualquier usuario** (sin «con cuenta de Google»): la página de GitHub entra sin iniciar sesión.
3. Comprueba el servicio abriendo `TU_URL/exec?accion=ping`. Debe mostrar algo como `{"ok":true,"ver":3}`.
4. La URL `/exec` va en `config.json` del repositorio; `python build.py` la pone dentro de `docs/index.html`.

## Lo que hay que saber

- **«Restablecer demo» borra los datos de todo el equipo**, porque ahora el archivo es compartido. Úsalo solo para empezar de cero.
- **Dos personas al mismo tiempo:** si alguien guarda justo antes que tú, la aplicación recarga los datos más recientes y te pide repetir tu última acción. No se pisan los cambios.
- **Seguridad:** usuarios y contraseñas siguen siendo de demo y viven en la página. Para datos reales, la fase 2 debe validar a cada persona en el servidor con su cuenta de Google (`Session.getActiveUser()`) y una pestaña «Usuarios» con su rol, y aplicar los permisos también en `Code.gs`.
- **Cuotas de Google:** una cuenta gratuita tiene límites diarios de ejecuciones y de uso de Drive. Para un bar con 5 usuarios alcanza de sobra, pero conviene usar una cuenta del grupo y no una personal.
- **Opción avanzada:** con [clasp](https://github.com/google/clasp) (`npm i -g @google/clasp`, luego `clasp login`, `clasp create --type sheets` y `clasp push` dentro de esta carpeta) se suben los tres archivos sin copiar y pegar.
