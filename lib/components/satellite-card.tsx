"use client";

import { CATEGORY_COLORS } from "@/lib/assets/categories";
import { useI18n } from "@/lib/components/i18n";
import { orbitFigures, type SatelliteMeta } from "@/lib/globe/orbit-math";
import { formatAgo, formatLatLon, formatNumber } from "@/lib/utils/format";
import type { Details } from "@/lib/globe/engine";

type Props = {
  meta: SatelliteMeta;
  details: Details | null;
  onClose: () => void;
};

export function SatelliteCard({ meta, details, onClose }: Props) {
  const { t, lang } = useI18n();
  const figures = orbitFigures(meta);
  const period =
    figures.periodMin < 120
      ? `${formatNumber(figures.periodMin, lang)} min`
      : `${formatNumber(figures.periodMin / 60, lang, 1)} h`;

  const rows: [string, string][] = [
    [
      t("detail.altitude"),
      details ? `${formatNumber(details.altitudeKm, lang)} km` : "…",
    ],
    [
      t("detail.speed"),
      details ? `${formatNumber(details.speedKms * 3600, lang)} km/h` : "…",
    ],
    [t("detail.period"), period],
    [t("detail.inclination"), `${formatNumber(meta.inclination, lang, 1)}°`],
    [
      t("detail.position"),
      details ? formatLatLon(details.latDeg, details.lonDeg) : "…",
    ],
    [t("detail.launched"), meta.launchYear ? String(meta.launchYear) : "—"],
    [t("detail.norad"), String(meta.noradId)],
  ];

  return (
    <article className="glass pointer-events-auto w-full rounded-2xl p-4 sm:w-80">
      <header className="mb-3 flex items-start gap-3">
        <span
          className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
          style={{
            background: CATEGORY_COLORS[meta.category],
            boxShadow: `0 0 10px ${CATEGORY_COLORS[meta.category]}`,
          }}
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold tracking-tight">
            {meta.name}
          </h2>
          <p className="text-xs text-muted">
            {t(`category.${meta.category}`)} · {t(`orbit.${meta.orbitClass}`)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("detail.close")}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-foreground"
        >
          ✕
        </button>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className={
              label === t("detail.position") ? "col-span-2" : undefined
            }
          >
            <dt className="text-[11px] uppercase tracking-wider text-muted">
              {label}
            </dt>
            <dd className="font-mono text-sm tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-muted">
        {t("detail.elements", { ago: formatAgo(meta.epochMs, lang) })}
      </p>
    </article>
  );
}
