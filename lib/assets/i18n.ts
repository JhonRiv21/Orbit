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
  "brand.tagline": { en: "Live satellites", es: "Satélites en vivo" },
  "brand.credit": { en: "Built by", es: "Creado por" },
  "brand.data": {
    en: "Orbital data from CelesTrak, imagery from NASA.",
    es: "Datos orbitales de CelesTrak, imágenes de la NASA.",
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
    en: "Drag to rotate, click a satellite to follow it.",
    es: "Arrastra para girar y toca un satélite para seguirlo.",
  },

  "categories.title": { en: "What is up there", es: "Qué hay allá arriba" },
  "categories.toggle": { en: "Highlight {label}", es: "Resaltar {label}" },
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

  "orbit.leo": { en: "in low Earth orbit", es: "en órbita baja" },
  "orbit.meo": { en: "in medium Earth orbit", es: "en órbita media" },
  "orbit.geo": {
    en: "in geostationary orbit",
    es: "en órbita geoestacionaria",
  },
  "orbit.heo": {
    en: "in a highly elliptical orbit",
    es: "en órbita muy elíptica",
  },

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

  "categories.hint": {
    en: "Choose a group to see where it flies.",
    es: "Elige un grupo para ver por dónde vuela.",
  },
  "categories.all": { en: "Show all", es: "Ver todos" },
  "shell.leo": {
    en: "Low orbit, up to 2,000 km",
    es: "Órbita baja, hasta 2.000 km",
  },
  "shell.meo": {
    en: "GPS and Galileo, 20,200 km",
    es: "GPS y Galileo, 20.200 km",
  },
  "shell.geo": {
    en: "Geostationary belt, 35,786 km",
    es: "Cinturón geoestacionario, 35.786 km",
  },
  "detail.illustration": {
    en: "Illustration of this kind of satellite.",
    es: "Ilustración de este tipo de satélite",
  },
} as const satisfies Record<string, Record<Lang, string>>;

export type MessageKey = keyof typeof MESSAGES;
