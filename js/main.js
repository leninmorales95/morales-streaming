const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwAQ0A4yEQtve0BlVAF7GK-FErxOCa3hb4ZhEajlfJ5y6YrMCktVVc4CUDb7AxMpMXfdA/exec";
const CATALOG_CACHE_KEY = "morales_streaming_cache_v2";
const CATALOG_CACHE_TTL = 5 * 60 * 1000;

try {
  const currentPageUrl = new URL(window.location.href);
  if (currentPageUrl.searchParams.get("sync") === "1") {
    document.documentElement.classList.add("skip-welcome");
    currentPageUrl.searchParams.delete("sync");
    window.history.replaceState(null, "", currentPageUrl.toString());
  }
} catch (error) {
  console.warn("No se pudo aplicar la recarga rápida:", error);
}

let siteConfig = {
  whatsapp_numero: "51935111590",
  whatsapp_general: "Hola Morales Streaming, deseo más información."
};
let availableCoupons = [];
let appliedCoupon = null;
let flashOfferEnabled = false;
let flashOffer2Enabled = false;
let flashOfferTimer = null;

function isSettingEnabled(value, fallback = true) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  return ["activo", "activa", "si", "sí", "true", "1", "mostrar"].includes(String(value).trim().toLowerCase());
}

function scheduleFlashOffer(delaySeconds = 35) {
  clearTimeout(flashOfferTimer);
  const flashCard = document.getElementById("flashOffer");
  if (!flashCard || !flashOfferEnabled) return;

  const safeDelay = Math.max(0, Number(delaySeconds) || 0) * 1000;
  flashOfferTimer = setTimeout(() => {
    if (flashOfferEnabled) flashCard.style.setProperty("display", "block", "important");
  }, safeDelay);
}

function getWhatsappNumber() {
  return String(siteConfig.whatsapp_numero || "51935111590").replace(/\D/g, "");
}

function createWhatsappLink(message) {
  return `https://api.whatsapp.com/send?phone=${getWhatsappNumber()}&text=${encodeURIComponent(message)}`;
}

function updateWhatsappNumbers() {
  document.querySelectorAll('a[href*="api.whatsapp.com/send"]').forEach(link => {
    try {
      const url = new URL(link.href);
      url.searchParams.set("phone", getWhatsappNumber());
      link.href = url.toString();
    } catch (error) {
      console.warn("No se pudo actualizar un enlace de WhatsApp:", error);
    }
  });
}

let rawProductosData = [];
const searchInput = document.getElementById("searchInput");
let cards = document.querySelectorAll(".card");
const categoryChips = document.querySelectorAll(".category-chip");
const noResultsMsg = document.getElementById("noResultsMsg");

let currentCategory = "top";

const platformDetails = {
  netflix: { name: "Netflix", description: "Películas, series y estrenos en máxima resolución 4K.", price: "S/16.00", note: "Garantía completa del mes. Entrega al instante.", features: ["Calidad 4K Ultra HD + HDR", "Descargas ilimitadas offline", "Sin anuncios ni interrupciones", "Audio espacial inmersivo Dolby", "Garantía y soporte Morales Streaming"] },
  disney: { name: "Disney+ Premium", description: "Contenido familiar, Marvel, Star Wars y ESPN.", price: "S/12.00", note: "Amantes del fútbol y eventos en vivo.", features: ["Todos los canales de ESPN en vivo", "Eventos deportivos PPV exclusivos", "Series de Marvel y Star Wars", "Resolución 4K UHD con Dolby Vision", "Descargas permitidas para viajes"] },
  movistar: { name: "Movistar TV", description: "Señal de televisión digital de cable con canales locales.", price: "S/20.00", note: "Televisión en vivo estable.", features: ["Más de 130 canales digitales HD", "Transmisiones en vivo sin retrasos", "Sección de noticias y TV nacional", "Acceso multidispositivo en Smart TV", "Servicio fluido 100% garantizado"] },
  directvgo: { name: "DIRECTV GO", description: "La mejor señal deportiva, canales premium en vivo.", price: "S/30.00", note: "Señal HD para ligas extranjeras.", features: ["Liga 1 Max para fútbol peruano", "Canales de cable premium en vivo", "Contenido exclusivo de DIRECTV Sports", "Resolución de alta definición estable", "Soporte dedicado 24/7"] },
  youtube: { name: "YouTube Premium", description: "Navegación libre de comerciales con música offline.", price: "S/8.00", note: "Activación en tu cuenta personal.", features: ["Videos ilimitados sin publicidad", "YouTube Music Premium incluido", "Reproducción en segundo plano nativa", "Descargas de videos en alta calidad", "Activación directa con tu correo"] },
  max: { name: "HBO Max", description: "Blockbusters de Warner Bros y series exclusivas.", price: "S/8.00", note: "Resolución premium garantizada.", features: ["Series originales galardonadas de HBO", "Películas de estreno tras cartelera", "Resolución 4K Ultra HD estable", "Universo completo de DC y Warner", "Cuentas estables con perfil propio"] },
  iptv: { name: "IPTV Premium", description: "Miles de canales internacionales en vivo.", price: "S/10.00", note: "Requiere conexión estable a internet.", features: ["Canales de todo el mundo en vivo", "Parrilla de deportes internacionales", "Biblioteca gigante de películas y series", "Compatible con Smart TV y celulares", "Servidores estables sin caídas"] },
  paramount: { name: "Paramount+", description: "Series exclusivas, estrenos y contenido infantil.", price: "S/15.00", note: "Catálogo completo mensual.", features: ["Series icónicas y estrenos de cine", "Contenido infantil con Nickelodeon", "Eventos en vivo seleccionados", "Transmisión en Full HD nítida", "Entrega inmediata de credenciales"] },
  crunchyroll: { name: "Crunchyroll", description: "Anime, temporadas populares y simulcasts.", price: "S/7.00", note: "Contenido oficial sin publicidad.", features: ["Simulcasts una hora después de Japón", "Todo el catálogo sin publicidad", "Calidad de video en Full HD", "Acceso a mangas digitales", "Uso ilimitado durante el mes"] },
  universal: { name: "Universal+", description: "Producciones de Universal, series y canales.", price: "S/7.00", note: "Variedad de cine para casa.", features: ["Canales premium de Universal en vivo", "Series exclusivas americanas", "Catálogo variado de cine familiar", "Resolución de alta definición", "Activación veloz y garantizada"] },
  prime: { name: "Prime Video", description: "Películas, series y Amazon Originals.", price: "S/7.00", note: "Resolución de alta fidelidad.", features: ["Contenido original exclusivo de Amazon", "Películas y series en alta definición", "Soporte multidispositivo integrado", "Descarga de capítulos para llevar", "Garantía completa de Morales Streaming"] },
  chatgpt: { name: "ChatGPT AI", description: "Herramientas de IA para estudio y trabajo.", price: "S/12.00", note: "Productividad y redacción pro.", features: ["Modelos avanzados IA", "Ideal para trabajo/estudio", "Respuestas rápidas", "Asistente ideal para tareas y oficina", "Soporte garantizado del servicio"] },
  vix: { name: "Vix Premium", description: "Novelas, series y fútbol latino.", price: "S/5.00", note: "Entretenimiento 100% en español.", features: ["La colección más grande de novelas", "Partidos seleccionados de fútbol latino", "Películas y series en español", "Acceso económico mensual", "Atención rápida por WhatsApp"] },
  spotify: { name: "Spotify Premium", description: "Música sin anuncios y saltos ilimitados.", price: "S/10.00", note: "Audio de alta fidelidad.", features: ["Música ilimitada sin comerciales", "Descargas de canciones y playlists", "Saltos de canción ilimitados", "Calidad de audio extrema y nítida", "Soporte Morales Streaming"] },
  appletv: { name: "Apple TV", description: "Producciones originales de Apple.", price: "S/6.00", note: "Calidad de video cinematográfica.", features: ["Series y películas galardonadas exclusivas", "Máxima fidelidad 4K HDR de la industria", "Interfaz limpia y de carga rápida", "Audio espacial inmersivo Dolby Atmos", "Atención inmediata para activar"] },
  viki: { name: "Viki Rakuten", description: "Doramas coreanos y series asiáticas.", price: "S/7.00", note: "Ideal para fanáticos de Asia.", features: ["Gran catálogo de doramas y k-dramas", "Traducciones y subtítulos oficiales", "Resolución HD sin comerciales", "Estrenos populares exclusivos", "Acceso premium garantizado"] },
  mubi: { name: "Mubi", description: "Cine seleccionado de autor e independiente.", price: "S/7.00", note: "Perfecto para cinéfilos exigentes.", features: ["Catálogo curado por expertos en cine", "Películas independientes e internacionales", "Transmisiones estables en alta fidelidad", "Sin anuncios ni interrupciones comerciales", "Entrega veloz y soporte rápido"] },
  office: { name: "Microsoft Office", description: "Ofimática completa Word, Excel, PowerPoint.", price: "S/30.00", note: "Productividad comercial y escolar.", features: ["Aplicaciones oficiales completas de Office", "Acceso a Word, Excel y PowerPoint", "Herramientas esenciales de productividad", "Soporte Morales Streaming continuo", "Activación coordinada y segura"] },
  canva: { name: "Canva Pro", description: "Diseño gráfico premium y kits de marca.", price: "S/5.00", note: "Kit completo para creadores.", features: ["Acceso ilimitado a plantillas premium", "Herramienta pro de remoción de fondos", "Elementos gráficos y tipografías exclusivas", "Kit de marca para organizar diseños", "Atención fluida y rápida"] },
  onedrive: { name: "OneDrive", description: "Almacenamiento en la nube seguro.", price: "S/5.00", note: "Copia de seguridad multidispositivo.", features: ["Espacio de almacenamiento seguro en la nube", "Respaldos automáticos de fotos y archivos", "Acceso seguro multidispositivo", "Soporte dedicado Morales Streaming", "Renovación sencilla mes a mes"] }
};

const modalThemes = {
  netflix: { color: "#e50914" }, disney: { color: "#7fdcff" }, movistar: { color: "#2aa7f4" },
  directvgo: { color: "#ff8a00" }, youtube: { color: "#ff0000" }, max: { color: "#b95cff" },
  iptv: { color: "#7b2cff" }, paramount: { color: "#3c82ff" }, crunchyroll: { color: "#ff640a" },
  universal: { color: "#8ecbff" }, prime: { color: "#00a8e1" }, chatgpt: { color: "#20c997" },
  vix: { color: "#ff2d75" }, spotify: { color: "#1db954" }, appletv: { color: "#ffffff" },
  viki: { color: "#00b4d8" }, mubi: { color: "#fff200" }, office: { color: "#f97316" },
  canva: { color: "#00c4cc" }, onedrive: { color: "#0078d4" }
};

async function cargarCatalogoDesdeSheets() {
  const datosGuardados = localStorage.getItem(CATALOG_CACHE_KEY);
  let cacheValida = false;
  if (datosGuardados) {
    try {
      const cache = JSON.parse(datosGuardados);
      if (cache && cache.data) {
        procesarDatosDeLaWeb(cache.data);
        cacheValida = Date.now() - Number(cache.savedAt || 0) < CATALOG_CACHE_TTL;
      }
    } catch (e) { console.error("Error leyendo caché:", e); }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(SHEET_API_URL, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Apps Script respondió ${response.status}`);
    const data = await response.json();
    if (data && !data.error) {
      localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
      procesarDatosDeLaWeb(data);
    } else if (data && data.error) {
      throw new Error(data.error);
    }
  } catch (error) {
    console.warn(cacheValida ? "Usando caché reciente:" : "No se pudo actualizar el catálogo:", error);
  }
}

function aplicarFiltros() {
  const searchVal = searchInput.value.toLowerCase().trim();
  const isSearching = searchVal !== "";

  if (isSearching) {
    document.body.classList.add("search-active");
  } else {
    document.body.classList.remove("search-active");
  }

  let matchCount = 0;

  cards.forEach(card => {
    if (card.classList.contains("more-platforms-card")) {
      if (currentCategory === "top" && !isSearching) {
        card.classList.remove("hide-card");
      } else {
        card.classList.add("hide-card");
      }
      return;
    }

    const name = card.dataset.name || "";
    let pasaBusqueda = name.includes(searchVal);

    if (pasaBusqueda) {
      matchCount++;
      if (currentCategory === "top" && !isSearching) {
        if (matchCount <= 6) {
          card.classList.remove("hide-card");
        } else {
          card.classList.add("hide-card");
        }
      } else {
        card.classList.remove("hide-card");
      }
    } else {
      card.classList.add("hide-card");
    }
  });

  if (isSearching && matchCount === 0) {
    noResultsMsg.style.setProperty("display", "block", "important");
  } else {
    noResultsMsg.style.setProperty("display", "none", "important");
  }
}

categoryChips.forEach(chip => {
  chip.addEventListener("click", () => {
    categoryChips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    currentCategory = chip.dataset.categoryFilter || "top";
    aplicarFiltros();
  });
});

// 🚀 Debounce en el buscador para mejor rendimiento
let searchDebounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(aplicarFiltros, 150);
});

function generarComboItems() {
  const comboGrid = document.getElementById("comboBuilderGrid");
  if (!comboGrid) return;
  comboGrid.innerHTML = "";

  cards.forEach(card => {
    if (card.classList.contains("sold-out")) return;

    const titleEl = card.querySelector(".plan-title");
    const priceEl = card.querySelector(".current-price-val") || card.querySelector(".price-tag");
    const imgEl = card.querySelector(".brand-logo-card img");

    if (!titleEl || !priceEl || !imgEl) return;

    const name = titleEl.textContent.trim();
    const priceText = priceEl.textContent;
    const priceMatch = priceText.match(/\d+(\.\d+)?/);
    const priceNum = priceMatch ? parseFloat(priceMatch[0]) : 0;
    const imgSrc = imgEl.src;

    comboGrid.innerHTML += `
      <div class="combo-item" data-name="${name}" data-price="${priceNum}" onclick="toggleComboItem(this)">
        <div class="combo-item-img-wrap"><img src="${imgSrc}" alt="${name}" loading="lazy"></div>
        <span class="combo-item-name">${name}</span>
        <span class="combo-item-price">S/${priceNum}</span>
      </div>
    `;
  });
}

let selectedComboPlatforms = [];
function toggleComboItem(element) {
  element.classList.toggle("selected");
  const name = element.dataset.name;
  const price = parseFloat(element.dataset.price);

  const index = selectedComboPlatforms.findIndex(item => item.name === name);
  if (index > -1) {
    selectedComboPlatforms.splice(index, 1);
  } else {
    selectedComboPlatforms.push({ name, price });
  }

  updateComboSummary();
}

function updateComboSummary() {
  const countSpan = document.getElementById("selectedCount");
  const listText = document.getElementById("selectedListText");
  const priceSpan = document.getElementById("comboTotalPrice");
  const oldPriceSpan = document.getElementById("oldPriceStrike");
  const discountBadge = document.getElementById("discountBadge");
  const btnWhatsapp = document.getElementById("btnSendCustomCombo");

  const count = selectedComboPlatforms.length;
  countSpan.textContent = count;

  if (count === 0) {
    listText.textContent = "Ninguna plataforma elegida";
    priceSpan.textContent = "S/0.00";
    oldPriceSpan.style.display = "none";
    discountBadge.style.display = "none";
    btnWhatsapp.href = createWhatsappLink("Hola Morales Streaming, quiero armar un combo");
    return;
  }

  const rawPriceSum = selectedComboPlatforms.reduce((sum, p) => sum + p.price, 0);
  let discount = count === 2 ? 3 : count === 3 ? 6 : count === 4 ? 9 : count >= 5 ? 12 : 0;
  const finalPrice = Math.max(0, rawPriceSum - discount);
  listText.textContent = selectedComboPlatforms.map(p => p.name).join(", ");

  if (discount > 0) {
    oldPriceSpan.style.display = "inline";
    oldPriceSpan.textContent = `S/${rawPriceSum.toFixed(2)}`;
    discountBadge.style.display = "inline-block";
    discountBadge.textContent = `🔥 ¡AHORRAS S/${discount}.00!`;
    priceSpan.textContent = `S/${finalPrice.toFixed(2)}`;
  } else {
    oldPriceSpan.style.display = "none";
    discountBadge.style.display = "none";
    priceSpan.textContent = `S/${rawPriceSum.toFixed(2)}`;
  }

  const itemsFormatted = selectedComboPlatforms.map(p => `➡️ *${p.name}*`).join("\n");
  const discountNote = discount > 0 ? `\n🎉 *¡Ahorro aplicado:* -S/${discount}.00` : "";
  const rawText = `🐱‍👤 ¡Hola! Vengo de tu página web 🌐\n\n🛠️ *¡Armé mi Combo Personalizado!*\n${itemsFormatted}${discountNote}\n💳 *Total a pagar:* S/${finalPrice.toFixed(2)}\n\n¿Me brindas los métodos de pago para activarlo?`;

  btnWhatsapp.href = createWhatsappLink(rawText);
}

const detailView = document.getElementById("detailView");
const detailPanel = document.getElementById("detailPanel");
const detailClose = document.getElementById("detailClose");
const detailName = document.getElementById("detailName");
const detailDescription = document.getElementById("detailDescription");
const detailFeatures = document.getElementById("detailFeatures");
const detailPrice = document.getElementById("detailPrice");
const detailNote = document.getElementById("detailNote");
const detailAddCart = document.getElementById("detailAddCart");
const detailGoCart = document.getElementById("detailGoCart");
let currentDetailProduct = null;

function openDetail(platformKey) {
  const cardElement = document.querySelector(`.card[data-platform="${platformKey}"]`);
  if (cardElement && cardElement.classList.contains("sold-out")) return;

  const sheetData = rawProductosData.find(p => p.id === platformKey);
  const staticData = platformDetails[platformKey] || {};

  const name = sheetData ? sheetData.nombre : staticData.name;
  const description = (sheetData && sheetData.descripcion) ? sheetData.descripcion : staticData.description;
  const priceVal = sheetData ? sheetData.precio_oferta : (staticData.price ? staticData.price.replace("S/", "").replace(".00", "") : "");
  const oldPriceVal = sheetData ? sheetData.precio_tachado : null;
  const note = (sheetData && sheetData.nota) ? sheetData.nota : staticData.note;
  const numericPrice = Number(String(priceVal).replace(/[^0-9.]/g, "")) || 0;
  currentDetailProduct = { name, price: numericPrice };

  let featuresArray = sheetData && sheetData.caracteristicas ? String(sheetData.caracteristicas).split(",").map(f => f.trim()).filter(f => f !== "") : (staticData.features || []);
  const originalImgElement = cardElement ? cardElement.querySelector('.brand-logo-card img') : null;

  let brandColor = sheetData && sheetData.color_tema ? sheetData.color_tema : (modalThemes[platformKey]?.color || "#00d4ff");

  detailPanel.style.setProperty("--modal-glow", `color-mix(in srgb, ${brandColor} 25%, transparent)`);
  detailPanel.style.setProperty("--modal-glow-2", `color-mix(in srgb, ${brandColor} 12%, transparent)`);
  detailPanel.style.setProperty("--modal-mark", brandColor);

  const customBgContainer = document.getElementById("detailCustomBg");
  let customBgUrl = "";
  if (sheetData && sheetData.imagen_fondo && sheetData.imagen_fondo.trim() !== "") {
    customBgUrl = sheetData.imagen_fondo.trim();
  } else if (originalImgElement) {
    customBgUrl = originalImgElement.src;
  }

  if (customBgContainer && customBgUrl) {
    customBgContainer.innerHTML = `<img src="${customBgUrl}" alt="Background Custom">`;
  } else if (customBgContainer) {
    customBgContainer.innerHTML = "";
  }

  detailName.textContent = name;
  detailDescription.textContent = description;

  if (oldPriceVal) {
    detailPrice.innerHTML = `<span style="font-size:1.2rem; color:#ff4d6d; text-decoration:line-through; margin-right:10px; font-weight:700;">S/${oldPriceVal}.00</span> S/${priceVal}.00`;
  } else {
    detailPrice.textContent = `S/${priceVal}.00`;
  }

  detailNote.textContent = note || "Entrega rápida y soporte garantizado.";

  detailFeatures.innerHTML = featuresArray.map(item => `<li><i class="fa-solid fa-circle-check" style="color:${brandColor};"></i> ${item}</li>`).join("");

  detailView.classList.add("active");
  detailView.scrollTop = 0;
  detailPanel.scrollTop = 0;
  document.body.style.overflow = "hidden";
  document.body.classList.add("detail-open");
}

function closeDetail() {
  detailView.classList.remove("active");
  document.body.style.overflow = "";
  document.body.classList.remove("detail-open");
}

function prepararTarjetasInteractivas() {
  document.querySelectorAll("#cardsContainer .card:not(.more-platforms-card)").forEach(card => {
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", card.classList.contains("sold-out") ? "-1" : "0");
    card.setAttribute("aria-label", `Ver detalles de ${card.querySelector(".plan-title")?.textContent || "producto"}`);

    const cartButton = card.querySelector(".add-to-cart-btn");
    if (cartButton && !cartButton.querySelector(".cart-button-label")) {
      cartButton.insertAdjacentHTML("beforeend", '<span class="cart-button-label">Agregar al carrito</span>');
      cartButton.setAttribute("aria-label", `Agregar ${card.querySelector(".plan-title")?.textContent || "producto"} al carrito`);
    }
  });
}

// Toda la tarjeta abre sus detalles; los productos agotados quedan desactivados.
document.getElementById("cardsContainer").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card || card.classList.contains("more-platforms-card") || card.classList.contains("sold-out")) return;

  const cartButton = e.target.closest(".add-to-cart-btn");
  if (cartButton) {
    e.stopPropagation();
    const name = card.querySelector(".plan-title")?.textContent.trim() || "Producto";
    const priceText = card.querySelector(".current-price-val")?.textContent || "0";
    const price = Number((priceText.match(/\d+(\.\d+)?/) || [0])[0]);
    agregarAlCarrito(name, price);
    return;
  }

  openDetail(card.dataset.platform);
});

document.getElementById("cardsContainer").addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest(".card");
  if (!card || card.classList.contains("more-platforms-card") || card.classList.contains("sold-out")) return;
  e.preventDefault();
  openDetail(card.dataset.platform);
});

if (detailAddCart) {
  detailAddCart.addEventListener("click", () => {
    if (!currentDetailProduct) return;
    agregarAlCarrito(currentDetailProduct.name, currentDetailProduct.price, false);
  });
}

if (detailGoCart) {
  detailGoCart.addEventListener("click", () => {
    closeDetail();
    abrirCarrito();
  });
}

detailClose.addEventListener("click", closeDetail);
detailView.addEventListener("click", e => { if (e.target === detailView) closeDetail(); });

const paymentModal = document.getElementById("paymentModal");
const paymentModalTitle = document.getElementById("paymentModalTitle");
const paymentModalQr = document.getElementById("paymentModalQr");
let paymentContext = "generic";

function openPaymentModal(type, context = "generic") {
  paymentContext = context;
  const button = document.querySelector(`.payment-choice[data-payment="${type}"]`) || document.querySelector('.payment-choice[data-payment="yape"]');
  selectPaymentOption(type || "yape", button);
  paymentModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function selectPaymentOption(type, button) {
  const qrBox = document.getElementById("paymentQrBox");
  const phoneBox = document.getElementById("paymentPhoneBox");
  const transferText = document.getElementById("paymentTransferText");
  const paymentWhatsapp = document.getElementById("paymentWhatsapp");
  const qrZoomButton = document.getElementById("paymentQrZoomButton");
  const productName = document.getElementById("paymentProductName");
  const productTotal = document.getElementById("paymentProductTotal");
  const instructionTotal = document.getElementById("paymentInstructionTotal");
  const instructions = document.querySelector(".payment-instructions");

  document.querySelectorAll(".payment-choice").forEach(item => item.classList.remove("active"));
  if (button) button.classList.add("active");

  const labels = { yape: "Yape", plin: "Plin", transferencia: "Transferencia bancaria" };
  selectedPayMethod = labels[type] || "Yape";

  if (type === "transferencia") {
    paymentModalTitle.textContent = "Pago por transferencia";
    qrBox.style.display = "none";
    phoneBox.style.display = "none";
    transferText.style.display = "block";
    qrZoomButton.style.display = "none";
    instructions.style.display = "none";
  } else {
    paymentModalTitle.textContent = `Pago con ${labels[type]}`;
    paymentModalQr.src = type === "plin" ? "https://i.postimg.cc/QxMC4FQK/plin.jpg" : "https://i.postimg.cc/W36zKrYH/yape.jpg";
    paymentModalQr.alt = `QR de ${labels[type]}`;
    qrZoomButton.style.display = "inline-flex";
    instructions.style.display = "block";
    qrBox.style.display = "flex";
    phoneBox.style.display = "flex";
    transferText.style.display = "none";
  }

  let summaryName = "Servicio seleccionado";
  let summaryTotal = "Consultar";
  let whatsappMessage = `Hola, quiero consultar y pagar un servicio mediante ${selectedPayMethod}.`;

  if (paymentContext === "cart" && carrito.length > 0) {
    const totals = calcularTotalesCarrito();
    summaryName = `${carrito.length} ${carrito.length === 1 ? "servicio" : "servicios"} en el carrito`;
    summaryTotal = `S/${totals.finalTotal.toFixed(2)}`;
    const itemLines = carrito.map(item => `• ${item.name} (S/${item.price.toFixed(2)})`).join("\n");
    const discount = totals.automaticDiscount + totals.couponDiscount;
    const discountLine = discount > 0 ? `\n🎉 Ahorro aplicado: -S/${discount.toFixed(2)}` : "";
    const couponLine = appliedCoupon && totals.couponDiscount > 0 ? `\n🎟️ Cupón: ${appliedCoupon.codigo || appliedCoupon.cupon}` : "";
    whatsappMessage = `Hola Morales Streaming, quiero confirmar y pagar este pedido mediante ${selectedPayMethod}:\n\n${itemLines}${discountLine}${couponLine}\n\nTotal: ${summaryTotal}`;
  } else if (paymentContext === "product" && currentDetailProduct) {
    summaryName = currentDetailProduct.name;
    summaryTotal = `S/${currentDetailProduct.price.toFixed(2)}`;
    whatsappMessage = `Hola, quiero confirmar disponibilidad y pagar ${currentDetailProduct.name} por ${summaryTotal} mediante ${selectedPayMethod}.`;
  }

  productName.textContent = summaryName;
  productTotal.textContent = summaryTotal;
  instructionTotal.textContent = summaryTotal;
  paymentWhatsapp.href = createWhatsappLink(whatsappMessage);
}

function closePaymentModal() {
  paymentModal.classList.remove("active");
  document.body.style.overflow = "";
}

const qrZoomModal = document.getElementById("qrZoomModal");
const qrZoomImage = document.getElementById("qrZoomImage");
const qrZoomClose = document.getElementById("qrZoomClose");
const qrZoomButton = document.getElementById("paymentQrZoomButton");

function closeQrZoom() {
  qrZoomModal.classList.remove("active");
}

if (qrZoomButton) {
  qrZoomButton.addEventListener("click", () => {
    qrZoomImage.src = paymentModalQr.src;
    qrZoomModal.classList.add("active");
  });
}
if (qrZoomClose) qrZoomClose.addEventListener("click", closeQrZoom);
if (qrZoomModal) qrZoomModal.addEventListener("click", event => { if (event.target === qrZoomModal) closeQrZoom(); });

function copyNumber() {
  const phone = getWhatsappNumber().replace(/^51/, "");
  navigator.clipboard.writeText(phone);
  mostrarToast("¡Número copiado al portapapeles!");
}

paymentModal.addEventListener("click", e => { if (e.target === paymentModal) closePaymentModal(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeDetail(); closePaymentModal(); closeQrZoom(); }
});

document.addEventListener("DOMContentLoaded", () => {
  const bannerEl = document.getElementById("globalBanner");
  if (bannerEl) {
    bannerEl.textContent = "🔥 ¡Atención rápida hoy por WhatsApp con entrega inmediata! 🚀";
    bannerEl.style.display = "inline-block";
  }

  generarComboItems();
  aplicarFiltros();

  setTimeout(() => {
    const loader = document.getElementById("loader");
    if (loader) loader.classList.add("hide");
  }, 1600);

  cargarCatalogoDesdeSheets()
    .then(() => {
      generarComboItems();
      aplicarFiltros();
    })
    .catch(e => console.error("Error al cargar:", e));

});

function closeFlashOffer() {
  const flash1 = document.getElementById("flashOffer");
  if (flash1) flash1.style.display = "none";
}

const customComboModal = document.getElementById("customComboModal");
function openCustomComboModal() {
  if (customComboModal) {
    customComboModal.classList.add("active");
    document.body.style.overflow = "hidden";
    generarComboItems();
  }
}

function closeCustomComboModal() {
  if (customComboModal) {
    customComboModal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

if (customComboModal) {
  customComboModal.addEventListener("click", e => {
    if (e.target === customComboModal) closeCustomComboModal();
  });
}

function normalizeStockBadge(product) {
  const hasExplicitStock = product.stock !== undefined && product.stock !== null && String(product.stock).trim() !== "";
  const raw = String(hasExplicitStock ? product.stock : (product.badge_mini ?? "")).trim();
  const explicitStock = Number(product.stock);
  const numberMatch = raw.match(/\d+/);
  const amount = Number.isFinite(explicitStock) && hasExplicitStock
    ? Math.max(0, Math.floor(explicitStock))
    : (numberMatch ? Math.max(0, Number(numberMatch[0])) : null);

  if (/agotado|sin stock/i.test(raw) || amount === 0) return { text: "Agotado", tone: "red" };
  if (amount === 1) return { text: "Último 1", tone: "red" };
  if (amount === 2 || amount === 3) return { text: `Últimos ${amount}`, tone: "yellow" };
  if (amount >= 4) return { text: `${amount} disponibles`, tone: "green" };
  return { text: raw, tone: "yellow" };
}

function procesarDatosDeLaWeb(data) {
  if (!data || typeof data !== "object") return;
  siteConfig = { ...siteConfig, ...(data.config || {}) };
  availableCoupons = Array.isArray(data.cupones) ? data.cupones : [];
  updateWhatsappNumbers();
  const listaProductos = data.productos || (Array.isArray(data) ? data : []);

  if (listaProductos.length > 0) {
    rawProductosData = listaProductos;
    const container = document.getElementById("cardsContainer");
    container.innerHTML = "";

    const productCards = rawProductosData.map(p => {
      const isSoldOut = String(p.estado).toLowerCase() === "agotado";
      const cardClass = isSoldOut ? "card sold-out" : "card";
      const tagText = isSoldOut ? "🔴 Sin Stock" : (p.etiqueta || "🟢 Disponible");
      const btnText = isSoldOut ? '<i class="fa-solid fa-ban"></i> Agotado' : '<i class="fa-solid fa-eye"></i> Ver Detalles';
      const btnDisabled = isSoldOut ? "disabled" : "";

      const normalizedStock = normalizeStockBadge(p);
      const miniBadgeHtml = (normalizedStock.text && !isSoldOut)
        ? `<span class="card-mini-badge stock-${normalizedStock.tone}">${normalizedStock.text}</span>`
        : "";

      const cardHtml = `
        <article class="${cardClass}" data-name="${p.nombre.toLowerCase()} ${p.categoria}" data-platform="${p.id}" data-category="${p.categoria}">
          <div class="card-inner">
            <span class="card-tag">${tagText}</span>
            ${miniBadgeHtml}
            <div class="logo-wrap">
              <div class="brand-logo-card">
                <img src="${p.logo_url}" alt="${p.nombre}" loading="lazy">
              </div>
            </div>
            <div class="info-block">
              <div class="text-group"><div class="plan-title">${p.nombre}</div><div class="plan-duration">${p.duracion}</div></div>
              <div class="price-container-card">
                <span class="old-price-card">S/${p.precio_tachado}.00</span>
                <div class="price-tag"><span class="current-price-val">S/${p.precio_oferta}</span></div>
              </div>
            </div>
            <div class="card-buttons-wrapper">
              <button class="btn-buy" ${btnDisabled}>${btnText}</button>
              <button class="add-to-cart-btn" ${btnDisabled} title="Añadir al carrito">
                <i class="fa-solid fa-cart-plus"></i>
              </button>
            </div>
          </div>
        </article>
      `;
      return cardHtml;
    });

    // 🚀 Tarjeta del "+" al final del catálogo (una sola vez)
    const moreCardHtml = `
      <article class="card more-platforms-card" onclick="verTodasLasPlataformas()" data-category="top">
        <div class="card-inner" style="justify-content: center; align-items: center; text-align: center; background: radial-gradient(circle at center, rgba(0,212,255,0.15), rgba(18,22,45,0.98));">
          <div style="width: 65px; height: 65px; border-radius: 50%; background: linear-gradient(135deg, #6a11cb, #2575fc, #00d4ff); display: grid; place-items: center; margin-bottom: 14px; box-shadow: 0 0 20px rgba(0,212,255,0.4);">
            <i class="fa-solid fa-plus" style="font-size: 1.8rem; color: #ffffff;"></i>
          </div>
          <h3 class="plan-title" style="font-size: 1.1rem !important; margin-bottom: 4px;">Ver más plataformas</h3>
          <p class="plan-duration" style="color: var(--text-gray) !important;">Explora todo el catálogo</p>
        </div>
      </article>
    `;
    container.innerHTML = productCards.join("") + moreCardHtml;

    cards = document.querySelectorAll(".card");
    prepararTarjetasInteractivas();

    generarComboItems();
    aplicarFiltros();
  }

  if (data.combos && Array.isArray(data.combos) && data.combos.length > 0) {
    const comboGrid = document.querySelector(".combo-premium-grid");
    if (comboGrid) {
      comboGrid.innerHTML = "";
      const comboCards = data.combos.map(c => {
        const waLink = createWhatsappLink(`🐱‍👤 ¡Hola! Vengo de la página web 🌐\n\n${c.whatsapp_text}\n\n💳 ¿Me compartes los métodos de pago por favor?`);

        let comboBgStyle = "";
        if (c.imagen_fondo && c.imagen_fondo.trim() !== "") {
          comboBgStyle = `background-image: linear-gradient(145deg, rgba(22, 27, 51, 0.88), rgba(9, 12, 34, 0.94)), url("${c.imagen_fondo.trim()}"); background-size: cover; background-position: center;`;
        }

        const comboHtml = `
          <article class="combo-premium-card" style="${comboBgStyle}">
            <span class="combo-label">${c.etiqueta}</span>
            <h3>${c.titulo}</h3>
            <p>${c.descripcion}</p>
            <div class="combo-price-mini">S/${c.precio}</div>
            <a class="combo-action" href="${waLink}" target="_blank">Solicitar combo <i class="fab fa-whatsapp"></i></a>
          </article>
        `;
        return comboHtml;
      });

      // 🚀 Tarjeta "Arma tu Combo" al final
      const customComboCardHtml = `
        <article class="combo-premium-card" onclick="openCustomComboModal()" style="cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; background: radial-gradient(circle at center, rgba(0,212,255,0.15), rgba(18,22,45,0.98));">
          <div style="width: 45px; height: 45px; border-radius: 50%; background: linear-gradient(135deg, #6a11cb, #2575fc, #00d4ff); display: grid; place-items: center; margin-top: 5px; box-shadow: 0 0 15px rgba(0,212,255,0.4);">
            <i class="fa-solid fa-plus" style="font-size: 1.3rem; color: #ffffff;"></i>
          </div>
          <div>
            <h3 style="font-size: 1.05rem !important; margin-bottom: 4px;">Arma tu Combo</h3>
            <p style="font-size: 0.75rem !important; color: var(--text-gray) !important; margin: 0 !important;">Elige las plataformas que quieras y ahorra más.</p>
          </div>
          <span class="custom-card-btn">
            Personalizar <i class="fa-solid fa-wand-magic-sparkles"></i>
          </span>
        </article>
        `;
      comboGrid.innerHTML = comboCards.join("") + customComboCardHtml;
    }
  }

  if (data.config) {
    const cfg = data.config;
    const phone = getWhatsappNumber();
    flashOfferEnabled = isSettingEnabled(cfg.flash_activo, true);
    flashOffer2Enabled = isSettingEnabled(cfg.flash_activo2, true);

    const bannerEl = document.getElementById("globalBanner");
    if (bannerEl && cfg.anuncio_banner) {
      bannerEl.textContent = cfg.anuncio_banner;
      bannerEl.style.display = "inline-block";
    }

    const floatBtn = document.querySelector(".whatsapp-float");
    if (floatBtn && cfg.whatsapp_general) {
      floatBtn.href = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(cfg.whatsapp_general)}`;
    }

    const titularEl = document.querySelector("#paymentModal p strong");
    if (titularEl && cfg.titular_pago) {
      titularEl.textContent = cfg.titular_pago;
    }

    const flashCard1 = document.getElementById("flashOffer");
    if (flashOfferEnabled && cfg.flash_titulo && cfg.flash_titulo.toLowerCase() !== "no" && cfg.flash_titulo.trim() !== "") {
      document.getElementById("flashTitle").textContent = cfg.flash_titulo;
      document.getElementById("flashSub").textContent = cfg.flash_subtitulo || "¡Solo por hoy!";
      document.getElementById("flashOldPrice").textContent = "S/" + Number(cfg.flash_precio_viejo || 0).toFixed(2);
      document.getElementById("flashNewPrice").textContent = "S/" + Number(cfg.flash_precio_nuevo || 0).toFixed(2);

      const flashMsg = cfg.flash_whatsapp || `¡Hola! Quiero aprovechar la Oferta Flash de ${cfg.flash_titulo} a S/${cfg.flash_precio_nuevo}`;
      document.getElementById("flashWhatsappBtn").href = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(flashMsg)}`;
      scheduleFlashOffer(cfg.flash_retraso_segundos || 35);
    } else if (flashCard1) {
      clearTimeout(flashOfferTimer);
      flashCard1.style.setProperty("display", "none", "important");
    }

    const titulo2 = cfg.flash_titulo2 || cfg.flash_tituloo2;
    const flashCard2 = document.getElementById("flashOffer2");
    if (flashCard2 && flashOffer2Enabled && titulo2 && titulo2.toLowerCase() !== "no" && titulo2.trim() !== "") {
      document.getElementById("flashTitle2").textContent = titulo2;
      document.getElementById("flashSub2").textContent = cfg.flash_subtituloo2 || cfg.flash_subtitulo2 || "¡Promoción por tiempo limitado!";
      document.getElementById("flashOldPrice2").textContent = "S/" + Number(cfg.flash_precio_viejo2 || 0).toFixed(2);
      document.getElementById("flashNewPrice2").textContent = "S/" + Number(cfg.flash_precio_nuevo2 || 0).toFixed(2);

      const flashMsg2 = cfg.flash_whatsapp2 || `¡Hola! Quiero aprovechar la Oferta Flash de ${titulo2} a S/${cfg.flash_precio_nuevo2}`;
      const btnFlash2 = document.getElementById("flashWhatsappBtn2");
      if (btnFlash2) {
        btnFlash2.href = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(flashMsg2)}`;
      }
    } else if (flashCard2) {
      flashCard2.style.setProperty("display", "none", "important");
    }
  }
}

const clearSearchBtn = document.getElementById("clearSearchBtn");
if (searchInput && clearSearchBtn) {
  searchInput.addEventListener("input", () => {
    if (searchInput.value.trim() !== "") {
      clearSearchBtn.style.display = "block";
    } else {
      clearSearchBtn.style.display = "none";
    }
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.style.display = "none";
    aplicarFiltros();
    searchInput.focus();
  });
}

function toggleFaq(button) {
  const item = button.parentElement;
  const isActive = item.classList.contains("active");
  document.querySelectorAll(".faq-item").forEach(el => el.classList.remove("active"));
  if (!isActive) {
    item.classList.add("active");
  }
}

let selectedPayMethod = "Yape";
function verTodasLasPlataformas() {
  const btnTodo = document.querySelector('.category-chip[data-category-filter="all"]');
  if (btnTodo) {
    btnTodo.click();
    document.getElementById("planes").scrollIntoView({ behavior: 'smooth' });
  }
}

// 🚀 Lógica de aparición y acción del botón Scroll To Top
const scrollTopBtn = document.getElementById("scrollTopBtn");

window.addEventListener("scroll", () => {
  if (!scrollTopBtn) return;
  const scrollTotal = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  const currentScroll = window.scrollY;

  if (scrollTotal > 0 && (currentScroll / scrollTotal) >= 0.35) {
    scrollTopBtn.classList.add("show");
  } else {
    scrollTopBtn.classList.remove("show");
  }
});

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// ==========================================================
// 🎉 TOAST GENÉRICO REUTILIZABLE
// ==========================================================
function mostrarToast(texto) {
  const toast = document.getElementById("toastNotification");
  const toastText = document.getElementById("toastText");
  if (!toast) return;
  if (toastText) toastText.textContent = texto;
  toast.style.transform = "translateX(-50%) translateY(0)";
  toast.style.opacity = "1";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.style.transform = "translateX(-50%) translateY(100px)";
    toast.style.opacity = "0";
  }, 2200);
}

// ==========================================================
// 🛒 CARRITO DE COMPRAS — con persistencia, anti-duplicados,
//    descuento automático y aviso de siguiente nivel
// ==========================================================
let carrito = [];
try {
  carrito = JSON.parse(localStorage.getItem('morales_carrito') || '[]');
} catch (e) {
  carrito = [];
}

function guardarCarrito() {
  try {
    localStorage.setItem('morales_carrito', JSON.stringify(carrito));
  } catch (e) {
    console.warn("No se pudo guardar el carrito:", e);
  }
}

function animarContadorCarrito() {
  const contadores = [document.getElementById('cart-count'), document.getElementById('mobile-cart-count')].filter(Boolean);
  if (!contadores.length) return;
  contadores.forEach(contador => {
    contador.style.transition = 'transform 0.25s ease';
    contador.style.transform = 'scale(1.5)';
  });
  setTimeout(() => contadores.forEach(contador => { contador.style.transform = 'scale(1)'; }), 250);
}

function abrirCarrito() {
  const modal = document.getElementById('cart-modal');
  if (modal) modal.style.right = '0';
}

function agregarAlCarrito(nombre, precio, abrirDespues = true) {
  const yaExiste = carrito.some(item => item.name === nombre);
  if (yaExiste) {
    mostrarToast(`⚠️ ${nombre} ya está en tu carrito`);
    if (abrirDespues) abrirCarrito();
    return;
  }

  carrito.push({ name: nombre, price: Number(precio) });
  guardarCarrito();
  renderizarCarrito();
  mostrarToast(`✅ ${nombre} añadido al carrito`);
  animarContadorCarrito();

  if (abrirDespues) abrirCarrito();
}

function removerDelCarrito(index) {
  carrito.splice(index, 1);
  guardarCarrito();
  renderizarCarrito();
}

function calcularDescuento(count) {
  return count === 2 ? 3 : count === 3 ? 6 : count === 4 ? 9 : count >= 5 ? 12 : 0;
}

function calcularTotalesCarrito() {
  const rawTotal = carrito.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const automaticDiscount = calcularDescuento(carrito.length);
  const afterAutomatic = Math.max(0, rawTotal - automaticDiscount);
  let couponDiscount = 0;

  if (appliedCoupon) {
    const minimum = Number(appliedCoupon.compra_minima || appliedCoupon.minimo || 0);
    const value = Number(appliedCoupon.descuento || appliedCoupon.valor || 0);
    const type = String(appliedCoupon.tipo || "fijo").toLowerCase();
    if (afterAutomatic >= minimum) {
      couponDiscount = type.includes("porcent") ? afterAutomatic * (value / 100) : value;
      couponDiscount = Math.min(afterAutomatic, Math.max(0, couponDiscount));
    }
  }

  return {
    rawTotal,
    automaticDiscount,
    couponDiscount,
    finalTotal: Math.max(0, afterAutomatic - couponDiscount)
  };
}

function aplicarCupon() {
  const input = document.getElementById("cart-coupon-input");
  const message = document.getElementById("cart-coupon-message");
  const code = String(input?.value || "").trim().toUpperCase();
  if (!code) return;

  const coupon = availableCoupons.find(item => String(item.codigo || item.cupon || "").trim().toUpperCase() === code);
  const status = String(coupon?.estado || "activo").toLowerCase();
  const isActive = coupon && !["inactivo", "agotado", "no"].includes(status);

  if (!isActive) {
    appliedCoupon = null;
    message.textContent = "Cupón no válido o inactivo.";
    message.className = "coupon-message error";
    renderizarCarrito();
    return;
  }

  const subtotal = calcularTotalesCarrito().rawTotal - calcularDescuento(carrito.length);
  const minimum = Number(coupon.compra_minima || coupon.minimo || 0);
  if (subtotal < minimum) {
    appliedCoupon = null;
    message.textContent = `Este cupón requiere una compra mínima de S/${minimum.toFixed(2)}.`;
    message.className = "coupon-message error";
    renderizarCarrito();
    return;
  }

  appliedCoupon = coupon;
  renderizarCarrito();
  message.textContent = `Cupón ${code} aplicado correctamente.`;
  message.className = "coupon-message success";
  mostrarToast(`🎟️ Cupón ${code} aplicado`);
}

function renderizarCarrito() {
  const contador = document.getElementById('cart-count');
  const contadorMovil = document.getElementById('mobile-cart-count');
  const contenedor = document.getElementById('cart-items-container');
  const totalSpan = document.getElementById('cart-total');
  const oldTotalSpan = document.getElementById('cart-old-total');
  const discountBadge = document.getElementById('cart-discount-badge');
  const discountText = document.getElementById('cart-discount-text');
  const nextTierBox = document.getElementById('cart-next-tier');

  if (contador) contador.textContent = carrito.length;
  if (contadorMovil) contadorMovil.textContent = carrito.length;

  if (carrito.length === 0) {
    if (contenedor) contenedor.innerHTML = '<p style="color: var(--text-gray); text-align: center; margin-top: 50px;">Tu carrito está vacío</p>';
    if (totalSpan) totalSpan.textContent = 'Total: S/0.00';
    if (oldTotalSpan) oldTotalSpan.style.display = 'none';
    if (discountBadge) discountBadge.style.display = 'none';
    if (nextTierBox) nextTierBox.style.display = 'none';
    return;
  }

  let html = '';
  let rawTotal = 0;

  carrito.forEach((item, index) => {
    rawTotal += item.price;
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05);">
        <div>
          <h4 style="color: #fff; margin: 0 0 4px 0; font-size: 0.9rem;">${item.name}</h4>
          <span style="color: var(--accent, #00d4ff); font-size: 0.8rem; font-weight: 600;">S/${item.price.toFixed(2)}</span>
        </div>
        <button onclick="removerDelCarrito(${index})" style="background: none; border: none; color: #ff5252; cursor: pointer; font-size: 1rem;"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
  });

  if (contenedor) contenedor.innerHTML = html;

  const count = carrito.length;
  const totals = calcularTotalesCarrito();
  const discount = totals.automaticDiscount + totals.couponDiscount;
  const finalTotal = totals.finalTotal;

  if (discount > 0) {
    if (oldTotalSpan) {
      oldTotalSpan.style.display = 'inline';
      oldTotalSpan.textContent = `S/${rawTotal.toFixed(2)}`;
    }
    if (discountBadge) discountBadge.style.display = 'block';
    if (discountText) discountText.textContent = `🔥 ¡Ahorras S/${discount.toFixed(2)}!`;
    if (totalSpan) totalSpan.textContent = `Total: S/${finalTotal.toFixed(2)}`;
  } else {
    if (oldTotalSpan) oldTotalSpan.style.display = 'none';
    if (discountBadge) discountBadge.style.display = 'none';
    if (totalSpan) totalSpan.textContent = `Total: S/${finalTotal.toFixed(2)}`;
  }

  // 🎯 Aviso de siguiente nivel de descuento
  if (nextTierBox) {
    let mensaje = '';
    if (count === 1) mensaje = '➕ Añade 1 más y ahorra S/3';
    else if (count === 2) mensaje = '➕ Añade 1 más y ahorra S/6 (en vez de S/3)';
    else if (count === 3) mensaje = '➕ Añade 1 más y ahorra S/9 (en vez de S/6)';
    else if (count === 4) mensaje = '➕ Añade 1 más y ahorra S/12 (en vez de S/9)';

    if (mensaje) {
      nextTierBox.style.display = 'block';
      nextTierBox.textContent = mensaje;
    } else {
      nextTierBox.style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  prepararTarjetasInteractivas();
  const btnAbrir = document.getElementById('cart-btn');
  const btnAbrirMovil = document.getElementById('mobile-cart-btn');
  const btnCerrar = document.getElementById('close-cart');
  const modal = document.getElementById('cart-modal');
  const btnClearCart = document.getElementById('clear-cart');
  const btnApplyCoupon = document.getElementById('apply-coupon');
  const couponInput = document.getElementById('cart-coupon-input');

  if (btnAbrir && modal) {
    btnAbrir.addEventListener('click', (e) => {
      e.preventDefault();
      modal.style.right = '0';
    });
  }

  if (btnAbrirMovil && modal) {
    btnAbrirMovil.addEventListener('click', (e) => {
      e.preventDefault();
      modal.style.right = '0';
    });
  }

  document.querySelectorAll('.mobile-nav-item[href]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
    });
  });

  if (btnCerrar && modal) {
    btnCerrar.addEventListener('click', () => {
      modal.style.right = '-400px';
    });
  }

  if (btnClearCart) {
    btnClearCart.addEventListener('click', () => {
      if (carrito.length === 0) return;
      if (confirm('¿Vaciar todo el carrito?')) {
        carrito = [];
        appliedCoupon = null;
        guardarCarrito();
        renderizarCarrito();
      }
    });
  }

  if (btnApplyCoupon) btnApplyCoupon.addEventListener('click', aplicarCupon);
  if (couponInput) {
    couponInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') aplicarCupon();
    });
  }

  const btnCheckout = document.getElementById('checkout-whatsapp');
  if (btnCheckout) {
    btnCheckout.addEventListener('click', () => {
      if (carrito.length === 0) return alert('Tu carrito está vacío');
      modal.style.right = '-400px';
      openPaymentModal('yape', 'cart');
    });
  }

  renderizarCarrito();
});

// ======================================================
// BUSCADOR EXPANDIBLE EN CELULAR
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
  const topBar = document.querySelector('.top-bar');
  const mobileSearchBtn = document.getElementById('mobileSearchBtn');
  const searchInputMobile = document.getElementById('searchInput');
  const clearSearchBtnMobile = document.getElementById('clearSearchBtn');

  if (!topBar || !mobileSearchBtn || !searchInputMobile) return;

  mobileSearchBtn.addEventListener('click', () => {
    topBar.classList.add('search-open');
    setTimeout(() => searchInputMobile.focus(), 220);
  });

  if (clearSearchBtnMobile) {
    clearSearchBtnMobile.addEventListener('click', (e) => {
      if (window.innerWidth > 650) return;
      e.preventDefault();
      e.stopPropagation();

      if (searchInputMobile.value.trim() !== '') {
        searchInputMobile.value = '';
        searchInputMobile.dispatchEvent(new Event('input', { bubbles: true }));
        searchInputMobile.focus();
        return;
      }

      topBar.classList.remove('search-open');
      searchInputMobile.blur();
    });
    document.addEventListener('click', (e) => {
  if (window.innerWidth > 650) return;

  const searchBox = document.getElementById('searchBox');
  const buscadorAbierto = topBar.classList.contains('search-open');

  if (!buscadorAbierto) return;

  const clickDentroBuscador = searchBox && searchBox.contains(e.target);
  const clickEnLupa = mobileSearchBtn && mobileSearchBtn.contains(e.target);

  if (clickDentroBuscador || clickEnLupa) return;

  // Si está vacío, tocar fuera lo cierra
  if (searchInputMobile.value.trim() === '') {
    topBar.classList.remove('search-open');
    searchInputMobile.blur();
  }
});
  }

  searchInputMobile.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.innerWidth <= 650) {
      searchInputMobile.value = '';
      searchInputMobile.dispatchEvent(new Event('input', { bubbles: true }));
      topBar.classList.remove('search-open');
      searchInputMobile.blur();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 650) topBar.classList.remove('search-open');
  });
});
// ======================================================
// TOAST DE ACTIVIDAD — NÚMERO VARIABLE
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
  const toast = document.getElementById('liveViewersToast');
  const text = document.getElementById('liveViewersText');

  if (!toast || !text) return;

  let ultimoNumero = null;
  let hideTimer = null;
  let nextTimer = null;

  function numeroAleatorio() {
    // Rango visual/promocional: 6 a 18
    let numero;
    do {
      numero = Math.floor(Math.random() * 13) + 6;
    } while (numero === ultimoNumero);

    ultimoNumero = numero;
    return numero;
  }

  function mostrarLiveViewers() {
    const numero = numeroAleatorio();

    text.textContent = `${numero} personas viendo ahora`;
    toast.classList.add('show');

    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      toast.classList.remove('show');

      // La próxima aparición varía entre 14 y 24 segundos.
      const espera = Math.floor(Math.random() * 10000) + 14000;
      clearTimeout(nextTimer);
      nextTimer = setTimeout(mostrarLiveViewers, espera);
    }, 7000);
  }

  // Primera aparición, sin molestar apenas abre la página.
  setTimeout(mostrarLiveViewers, 6500);
});
