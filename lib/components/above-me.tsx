"use client";

import { useState } from "react";
import { CATEGORY_COLORS } from "@/lib/assets/categories";
import { useI18n } from "@/lib/components/i18n";
import { formatClock, formatNumber } from "@/lib/utils/format";
import type { SatelliteMeta } from "@/lib/globe/orbit-math";
import type { Observer } from "@/lib/globe/protocol";
import type { Sky } from "@/lib/globe/engine";

type Props = {
  meta: SatelliteMeta[];
  sky: Sky | null;
  onLocate: (observer: Observer) => void;
  onPick: (index: number) => void;
};

type State = "idle" | "locating" | "denied";

// The position is read in the browser and handed to the worker; it is never
// sent to the server or stored.
export function AboveMe({ meta, sky, onLocate, onPick }: Props) {
  const { t, lang } = useI18n();
  const [state, setState] = useState<State>("idle");

  function locate() {
    if (!navigator.geolocation) {
      setState("denied");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState("idle");
        onLocate({
          latDeg: position.coords.latitude,
          lonDeg: position.coords.longitude,
        });
      },
      () => setState("denied"),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={locate}
        disabled={state === "locating"}
        className="cursor-pointer rounded-lg bg-accent/15 px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/25 disabled:cursor-wait disabled:opacity-60"
      >
        {state === "locating" ? t("above.locating") : t("above.button")}
      </button>
      <p className="text-[11px] text-muted">
        {state === "denied" ? t("above.denied") : t("above.privacy")}
      </p>

      {sky && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">
            {t("above.count", { count: formatNumber(sky.overhead, lang) })}
          </p>
          <div>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t("above.iss")}
            </h3>
            <p className="text-sm">
              {sky.issPass
                ? t("above.issWhen", {
                    time: formatClock(sky.issPass.rise, lang),
                    elevation: Math.round(sky.issPass.maxElevationDeg),
                  })
                : t("above.issNone")}
            </p>
          </div>
          <div>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t("above.highest")}
            </h3>
            <ul className="flex flex-col">
              {sky.highest.map((object) => {
                const m = meta[object.index];
                return (
                  <li key={m.noradId}>
                    <button
                      type="button"
                      onClick={() => onPick(object.index)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-white/5"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: CATEGORY_COLORS[m.category] }}
                      />
                      <span className="flex-1 truncate">{m.name}</span>
                      <span className="font-mono text-xs tabular-nums text-muted">
                        {Math.round(object.elevationDeg)}°
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
