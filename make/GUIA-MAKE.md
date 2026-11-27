# Botón «Guardar BD» → Make → Google Sheets

El botón **Guardar BD** está en tres pantallas de la app:

| Pantalla | Quién lo usa | Qué guarda |
|---|---|---|
| Inventario diario | Operario (después de enviar el cierre) y admin/gerencia | Cierre de turno de barra o cocina, material por material |
| Conteo físico | Auditor (después de enviar) y admin/gerencia | Conteo a ciego; admin y gerencia agregan teórico, diferencia y valor |
| Kardex y lotes | Almacén, admin y gerencia | Saldo de cada material en almacén, barra y cocina, con costo y valor |

Cada clic envía **un JSON** al webhook de Make con dos partes:

- `cabecera`: una fila para la pestaña **Cabecera** → `id_envio, tipo, tienda, punto, responsable, enviado_por, rol, fecha, hora, total_items, enviado_en`.
- `detalle`: una lista con una fila por material para la pestaña **Detalle** → `id_envio, linea, tipo, punto, sku, insumo, categoria, unidad, apertura, recibido, enviado, consumo_recetas, mermas, saldo_teorico, cantidad_contada, diferencia, costo_unitario, valor`.

`id_envio` une cada cabecera con sus filas de detalle. Las columnas que no aplican (o que el rol no puede ver, como costos para el operario) llegan vacías. El archivo `ejemplo-envio.json` muestra un envío real.

## Paso a paso

### 1. Crear la hoja de Google Sheets
1. Sube `plantilla-BD-stragos.xlsx` a tu Google Drive.
2. Ábrela y elige **Archivo → Guardar como Hojas de cálculo de Google**. Queda con las pestañas **Cabecera** y **Detalle**, con los encabezados en la fila 1.
3. Ponle de nombre **Stragos · BD inventarios**.

### 2. Crear el webhook en Make
1. En [make.com](https://www.make.com), entra a **Scenarios → Create a new scenario**.
2. Pulsa el **+**, busca **Webhooks** y elige **Custom webhook**.
3. Pulsa **Add**, nómbralo `Stragos Guardar BD` y pulsa **Save**.
4. Pulsa **Copy address to clipboard**. Es una URL como `https://hook.us1.make.com/…`. Deja esa ventana abierta: Make queda escuchando.

### 3. Pegar la URL en la app y enviar una prueba
1. Abre la app y entra con `ccastillo` / `4444` (o `jdiego` / `5555`).
2. Ve a **Reportes y bitácora → Guardar BD (Make)**.
3. Pega la URL en **URL del webhook** y cambia el nombre de la tienda si quieres.
4. Pulsa **Enviar prueba (Kardex)**. En Make debe aparecer **Successfully determined**: ya conoce la estructura del JSON.

La URL queda guardada para todo el equipo, así que nadie más tiene que configurarla.

### 4. Guardar la cabecera
1. En Make, a la derecha del webhook, agrega **Google Sheets → Add a Row**.
2. Conecta tu cuenta de Google, elige la hoja **Stragos · BD inventarios** y la pestaña **Cabecera**. En **Table contains headers** elige **Yes**.
3. Mapea cada columna con el campo del mismo nombre dentro de **cabecera** (por ejemplo, `tienda` → `cabecera: tienda`).

### 5. Guardar el detalle
1. Después de «Add a Row», agrega **Flow Control → Iterator** y en **Array** elige **detalle**.
2. A continuación agrega otro **Google Sheets → Add a Row**, pestaña **Detalle**, con encabezados.
3. Mapea cada columna con el campo del mismo nombre que entrega el **Iterator**.

### 6. Activar
1. Pulsa **Save** (abajo a la izquierda).
2. Activa el interruptor **Scheduling** con la opción **Immediately as data arrives**.
3. Prueba en la app: **Kardex y lotes → Guardar BD**. En unos segundos aparecen 1 fila en Cabecera y unas 17 en Detalle.

## Lo que hay que saber

- **Operaciones de Make:** cada fila escrita cuenta como una operación. Un Kardex usa unas 19 (1 webhook + 1 cabecera + 17 de detalle). El plan gratuito trae un cupo mensual limitado; si se queda corto, reemplaza el paso 5 por **Array aggregator + Google Sheets → Bulk Add Rows (Advanced)**, que escribe todo el detalle en una sola operación.
- **Escenario apagado:** Make guarda los envíos en cola y los procesa cuando lo vuelves a activar.
- **Envíos repetidos:** cada clic genera un `id_envio` nuevo. Si alguien pulsa dos veces, verás dos envíos con distinto ID; filtra por `id_envio` para quedarte con uno.
- **Errores en la app:** «404» significa que la URL del webhook está mal o se borró. Si no hay conexión, la app lo avisa y no marca el envío como hecho. La pestaña **Guardar BD (Make)** muestra los últimos envíos y su resultado.
- **Artefacto de Claude:** ahí los envíos externos están bloqueados. Usa el link de GitHub Pages.
- **Seguridad:** quien tenga la URL del webhook puede enviarle datos. Para el prototipo con datos ficticios está bien; con datos reales conviene agregar en Make un filtro con una clave secreta.
