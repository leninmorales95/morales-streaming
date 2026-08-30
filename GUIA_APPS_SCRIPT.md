# Conexión de la tienda con Google Sheets

## Hojas necesarias

La primera hoja debe llamarse `Productos` y conservar estos encabezados:

`id`, `nombre`, `categoria`, `estado`, `etiqueta`, `badge_mini`, `logo_url`, `duracion`, `precio_tachado`, `precio_oferta`, `descripcion`, `nota`, `caracteristicas`, `color_tema`, `imagen_fondo`

La hoja `Combos` usa:

`etiqueta`, `titulo`, `descripcion`, `precio`, `whatsapp_text`, `imagen_fondo`

La hoja `Config` usa dos columnas: `clave` y `valor`. Las claves reconocidas actualmente son:

- `whatsapp_numero`
- `whatsapp_general`
- `anuncio_banner`
- `titular_pago`
- `flash_activo`, `flash_retraso_segundos`, `flash_titulo`, `flash_subtitulo`, `flash_precio_viejo`, `flash_precio_nuevo`, `flash_whatsapp`
- `flash_activo2`, `flash_titulo2`, `flash_subtitulo2`, `flash_precio_viejo2`, `flash_precio_nuevo2`, `flash_whatsapp2`

Usa `activo` o `inactivo` en `flash_activo` y `flash_activo2`. Una oferta inactiva permanece completamente oculta, incluso cuando se cumple el temporizador de aparición.

`flash_retraso_segundos` indica cuánto debe esperar la página antes de mostrar la primera oferta. Por ejemplo: `10` para diez segundos, `30` para medio minuto o `60` para un minuto.

La hoja `Cupones` usa estos encabezados:

`codigo`, `tipo`, `descuento`, `compra_minima`, `estado`

En `tipo` utiliza `fijo` para descontar una cantidad en soles o `porcentaje` para descontar un porcentaje. Ejemplos:

- `BIENVENIDA10 | porcentaje | 10 | 20 | activo`
- `AHORRA5 | fijo | 5 | 25 | activo`

## Publicación

1. Abre el Apps Script vinculado a la hoja.
2. Sustituye el código anterior por el contenido de `Code.gs`.
3. En **Implementar > Nueva implementación**, selecciona **Aplicación web**.
4. Ejecuta como propietario y permite acceso a cualquier usuario con el enlace.
5. Copia la nueva URL terminada en `/exec` y reemplaza `SHEET_API_URL` en `js/main.js`.

Si el script no está vinculado directamente a la hoja, copia el ID de Google Sheets en `SPREADSHEET_ID` antes de implementarlo.

La API guarda la respuesta durante cinco minutos para acelerar las visitas. Al editar `Productos`, `Combos` o `Config`, `onEdit` elimina esa caché automáticamente.
