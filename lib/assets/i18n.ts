export type Lang = "en" | "es";

// Lives here and not in the provider: a server component cannot import real
// values from a "use client" module (Next turns them into references).
export const LANG_COOKIE = "orbit-lang";

// Saved choice first; otherwise the browser's language, where anything that
// is not Spanish falls back to English.
export function resolveLang(
  cookie?: string,
  acceptLanguage?: string | null,
): Lang {
  if (cookie === "es" || cookie === "en") return cookie;
  const preferred = acceptLanguage?.split(",")[0]?.trim().toLowerCase() ?? "";
  return preferred.startsWith("es") ? "es" : "en";
}

export const MESSAGES = {
  "brand.tagline": { en: "· live satellites", es: "· satélites en vivo" },
  "brand.credit": { en: "Built by", es: "Creado por" },
  "brand.data": {
    en: "Orbital data: CelesTrak · Imagery: NASA",
    es: "Datos orbitales: CelesTrak · Imágenes: NASA",
  },

  "lang.label": { en: "Language", es: "Idioma" },
  "fullscreen.on": { en: "Full screen", es: "Pantalla completa" },
  "fullscreen.off": {
    en: "Exit full screen",
    es: "Salir de pantalla completa",
  },
  "panel.open": { en: "Open panel", es: "Abrir panel" },
  "panel.close": { en: "Close panel", es: "Cerrar panel" },

  "status.loading": {
    en: "Loading orbital data…",
    es: "Cargando datos orbitales…",
  },
  "status.error": {
    en: "The orbital data could not be loaded.",
    es: "No se pudieron cargar los datos orbitales.",
  },
  "status.retry": { en: "Retry", es: "Reintentar" },
  "stats.count": {
    en: "{count} active satellites",
    es: "{count} satélites activos",
  },
  "stats.updated": {
    en: "Elements updated {ago}",
    es: "Elementos actualizados {ago}",
  },
  hint: {
    en: "Drag to rotate · click a satellite",
    es: "Arrastra para girar · toca un satélite",
  },

  "categories.title": { en: "What is up there", es: "Qué hay allá arriba" },
  "categories.toggle": {
    en: "Show or hide {label}",
    es: "Mostrar u ocultar {label}",
  },
  "category.starlink": { en: "Starlink", es: "Starlink" },
  "category.comms": { en: "Communications", es: "Comunicaciones" },
  "category.navigation": {
    en: "Navigation (GPS, Galileo…)",
    es: "Navegación (GPS, Galileo…)",
  },
  "category.earth": { en: "Earth & weather", es: "Tierra y clima" },
  "category.stations": { en: "Stations & crewed", es: "Estaciones y naves" },
  "category.science": { en: "Science", es: "Ciencia" },
  "category.other": { en: "Other", es: "Otros" },

  "orbit.leo": { en: "Low Earth orbit", es: "Órbita baja" },
  "orbit.meo": { en: "Medium Earth orbit", es: "Órbita media" },
  "orbit.geo": { en: "Geostationary", es: "Geoestacionaria" },
  "orbit.heo": { en: "Highly elliptical", es: "Muy elíptica" },

  "search.label": { en: "Search a satellite", es: "Buscar un satélite" },
  "search.placeholder": {
    en: "ISS, Hubble, Starlink…",
    es: "ISS, Hubble, Starlink…",
  },
  "search.empty": { en: "No matches", es: "Sin resultados" },

  "detail.close": { en: "Close", es: "Cerrar" },
  "detail.altitude": { en: "Altitude", es: "Altitud" },
  "detail.speed": { en: "Speed", es: "Velocidad" },
  "detail.period": { en: "One orbit", es: "Una vuelta" },
  "detail.inclination": { en: "Inclination", es: "Inclinación" },
  "detail.position": { en: "Over", es: "Sobre" },
  "detail.launched": { en: "Launched", es: "Lanzado" },
  "detail.norad": { en: "NORAD ID", es: "ID NORAD" },
  "detail.elements": { en: "Elements from {ago}", es: "Elementos de {ago}" },

  "above.button": { en: "What is above me?", es: "¿Qué hay sobre mí?" },
  "above.locating": { en: "Locating…", es: "Ubicando…" },
  "above.denied": {
    en: "Location unavailable. Allow it in the browser to try again.",
    es: "Ubicación no disponible. Permítela en el navegador para intentarlo de nuevo.",
  },
  "above.privacy": {
    en: "Your location never leaves this device.",
    es: "Tu ubicación nunca sale de este dispositivo.",
  },
  "above.count": {
    en: "{count} satellites above your horizon right now",
    es: "{count} satélites sobre tu horizonte en este momento",
  },
  "above.highest": {
    en: "Highest in your sky",
    es: "Los más altos en tu cielo",
  },
  "above.iss": { en: "Next ISS pass", es: "Próximo paso de la ISS" },
  "above.issWhen": {
    en: "{time} · up to {elevation}° high",
    es: "{time} · hasta {elevation}° de altura",
  },
  "above.issNone": {
    en: "No ISS pass above 10° in the next 24 h.",
    es: "Sin pasos de la ISS sobre 10° en las próximas 24 h.",
  },
} as const satisfies Record<string, Record<Lang, string>>;

export type MessageKey = keyof typeof MESSAGES;
