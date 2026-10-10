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
