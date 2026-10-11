"use client";

import { useI18n } from "@/lib/components/i18n";

const ZOOM_STEP = 1.45;

// Stacked + / − like a map's navigation control.
export function ZoomControls({ onZoom }: { onZoom: (factor: number) => void }) {
  const { t } = useI18n();
  const button =
    "flex h-9 w-9 cursor-pointer items-center justify-center text-lg leading-none text-foreground transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent";
  return (
    <div
      role="group"
      aria-label={t("zoom.label")}
      data-globe-occluder
      className="glass-soft pointer-events-auto flex flex-col overflow-hidden rounded-full"
    >
      <button
        type="button"
        onClick={() => onZoom(1 / ZOOM_STEP)}
        aria-label={t("zoom.in")}
        className={button}
      >
        +
      </button>
      <span className="mx-2 h-px bg-white/10" aria-hidden="true" />
      <button
        type="button"
        onClick={() => onZoom(ZOOM_STEP)}
        aria-label={t("zoom.out")}
        className={button}
      >
        −
      </button>
    </div>
  );
}
