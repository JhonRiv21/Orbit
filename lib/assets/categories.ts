import type { Category } from "@/lib/types/satellite";

// Name rules, checked in order: the first match wins. CelesTrak publishes the
// same objects in overlapping groups and asks not to download several of them,
// so one "active" download is split here by name instead.
export const CATEGORY_RULES: [Category, RegExp][] = [
  [
    "stations",
    /^(ISS |CSS |TIANZHOU|SHENZHOU|PROGRESS|SOYUZ|CREW DRAGON|DRAGON|CYGNUS|STARLINER|HTV)/,
  ],
  ["starlink", /^STARLINK/],
  [
    "navigation",
    /^(NAVSTAR|GPS |GSAT0\d{3}|GALILEO|GLONASS|BEIDOU|IRNSS|NVS-|QZS)/,
  ],
  [
    "comms",
    /^(ONEWEB|KUIPER|QIANFAN|HULIANWANG|IRIDIUM|GLOBALSTAR|ORBCOMM|O3B|SPACEMOBILE|BLUEBIRD|INTELSAT|SES|EUTELSAT|GALAXY|TELSTAR|VIASAT|INMARSAT|AMAZONAS|HISPASAT|ASTRA|ECHOSTAR|TDRS|SKYNET|YAMAL|EXPRESS|GONETS|TIANQI|LYNK|KINEIS|SIRIUS|XM-)/,
  ],
  [
    "earth",
    /^(NOAA|GOES|METEOSAT|METOP|FENGYUN|HIMAWARI|SENTINEL|LANDSAT|TERRA|AQUA|SUOMI|JPSS|FLOCK|LEMUR|SKYSAT|ICEYE|JILIN|GAOFEN|SUPERVIEW|WORLDVIEW|PLEIADES|SPOT |GRUS|YAOGAN|CAPELLA|SATELLOGIC|NUSAT|RADARSAT|COSMO-SKYMED|TANDEM|TERRASAR|DMSP|ELEKTRO|METEOR|GCOM|GOSAT|CBERS|RESURS|KOMPSAT|CARTOSAT|OCEANSAT|RISAT|EOS-|HAIYANG|YUNHAI|TIANHUI|ZIYUAN)/,
  ],
  [
    "science",
    /^(HST|SWIFT|FERMI|NUSTAR|TESS|CHANDRA|CXO|XMM|INTEGRAL|GAIA|NICER|CHEOPS|HXMT|EINSTEIN PROBE|SVOM|XRISM|IXPE|ICESAT|GRACE|CALIPSO|CLOUDSAT|SMAP|SORCE|TIMED|AIM|IRIS|HINODE|SDO|PROBA)/,
  ],
];

export const CATEGORIES: Category[] = [
  "starlink",
  "comms",
  "navigation",
  "earth",
  "stations",
  "science",
  "other",
];

// Point colors on the globe. Starlink is two thirds of the sky, so it gets the
// quietest tone; the rarer categories carry the saturated ones.
export const CATEGORY_COLORS: Record<Category, string> = {
  starlink: "#7d8aa3",
  comms: "#4fb3ff",
  navigation: "#ffc94d",
  earth: "#5ee08a",
  stations: "#ff6b5e",
  science: "#c48bff",
  other: "#b9c2cf",
};

// Visual weight per category: [point size, opacity]. The two mega-groups are
// dust that shows the shape of the shells; the rest are drawn as objects.
export const CATEGORY_WEIGHT: Record<Category, [number, number]> = {
  starlink: [1.1, 0.55],
  other: [1.2, 0.6],
  comms: [1.8, 0.9],
  earth: [1.9, 0.95],
  navigation: [2.6, 1],
  science: [2.6, 1],
  stations: [3, 1],
};

// Labelled on the globe, in order of how widely known they are: that order
// decides which label stays when two overlap. All fly in low orbit, close to
// the planet: a label far out (GPS, geostationary) swings across the screen
// whenever the globe turns. Found by catalogue name.
export const LANDMARKS: { name: string; label: string }[] = [
  { name: "ISS (ZARYA)", label: "ISS" },
  { name: "CSS (TIANHE)", label: "Tiangong" },
  { name: "HST", label: "Hubble" },
  { name: "LANDSAT 9", label: "Landsat 9" },
  { name: "TERRA", label: "Terra" },
  { name: "AQUA", label: "Aqua" },
  { name: "SENTINEL-6A", label: "Sentinel-6" },
  { name: "SUOMI NPP", label: "Suomi NPP" },
  { name: "NOAA 21 (JPSS-2)", label: "NOAA 21" },
  { name: "ICESAT-2", label: "ICESat-2" },
];
