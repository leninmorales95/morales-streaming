/**
 * API optimizada para la tienda.
 * Pega este archivo en Apps Script y vuelve a implementar la aplicación web.
 */
const SPREADSHEET_ID = ""; // Opcional: pega aquí el ID para no depender del archivo activo.
const API_CACHE_KEY = "tienda_catalogo_v2";
const API_CACHE_SECONDS = 300;

function doGet() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(API_CACHE_KEY);
    if (cached) return jsonOutput_(cached);

    const ss = SPREADSHEET_ID
      ? SpreadsheetApp.openById(SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) throw new Error("No se encontró la hoja. Configura SPREADSHEET_ID en Code.gs.");

    const productosSheet = ss.getSheetByName("Productos") || ss.getSheets()[0];
    const result = {
      productos: sheetToObjects_(productosSheet),
      combos: sheetToObjects_(ss.getSheetByName("Combos")),
      cupones: sheetToObjects_(ss.getSheetByName("Cupones")),
      config: configToObject_(ss.getSheetByName("Config")),
      actualizado: new Date().toISOString()
    };

    const payload = JSON.stringify(result);
    cache.put(API_CACHE_KEY, payload, API_CACHE_SECONDS);
    return jsonOutput_(payload);
  } catch (error) {
    return jsonOutput_(JSON.stringify({ error: error.message }));
  }
}

function sheetToObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];

  const values = sheet
    .getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
    .getDisplayValues();
  const headers = values.shift().map(value => String(value).trim());

  return values
    .filter(row => row.some(value => String(value).trim() !== ""))
    .map(row => headers.reduce((item, header, index) => {
      if (header) item[header] = row[index];
      return item;
    }, {}));
}

function configToObject_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return {};

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues();
  return values.reduce((config, row) => {
    const key = String(row[0] || "").trim();
    if (key) config[key] = row[1];
    return config;
  }, {});
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

/** Borra la caché al editar una de las hojas administrables. */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheetName = e.range.getSheet().getName();
  if (["Productos", "Combos", "Cupones", "Config"].includes(sheetName)) {
    CacheService.getScriptCache().remove(API_CACHE_KEY);
  }
}

/** También puedes ejecutar esta función manualmente desde Apps Script. */
function limpiarCache() {
  CacheService.getScriptCache().remove(API_CACHE_KEY);
}
