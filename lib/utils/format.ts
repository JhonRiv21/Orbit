import type { Lang } from "@/lib/assets/i18n";

const locale = (lang: Lang) => (lang === "es" ? "es-CO" : "en-US");

export function formatAgo(
  timeMs: number,
  lang: Lang,
  now = Date.now(),
): string {
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: "auto" });
  const minutes = Math.round((timeMs - now) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

export function formatNumber(value: number, lang: Lang, digits = 0): string {
  return value.toLocaleString(locale(lang), {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function formatClock(timeMs: number, lang: Lang): string {
  return new Date(timeMs).toLocaleString(locale(lang), {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLatLon(latDeg: number, lonDeg: number): string {
  const lat = `${Math.abs(latDeg).toFixed(1)}° ${latDeg >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(lonDeg).toFixed(1)}° ${lonDeg >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}
