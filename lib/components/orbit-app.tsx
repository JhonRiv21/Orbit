"use client";

/**
 * @license
 * Orbit — live 3D globe of every active satellite. Developed by Jhon Rivero.
 * https://github.com/JhonRiv21/Orbit · https://jhon.riverogz.com/
 * SPDX-License-Identifier: MIT
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/assets/categories";
import { useI18n, LanguageSelector } from "@/lib/components/i18n";
import { CategoryLegend } from "@/lib/components/category-legend";
import { SatelliteSearch } from "@/lib/components/satellite-search";
import { SatelliteCard } from "@/lib/components/satellite-card";
import { AboveMe } from "@/lib/components/above-me";
import { FullscreenButton } from "@/lib/components/fullscreen-button";
import { feedMeta, type SatelliteMeta } from "@/lib/globe/orbit-math";
import { formatAgo, formatNumber } from "@/lib/utils/format";
import type { Details, GlobeEngine, Sky } from "@/lib/globe/engine";
import type { Observer } from "@/lib/globe/protocol";
import type { Category, SatelliteFeed } from "@/lib/types/satellite";

type Status = "loading" | "ready" | "error";
type Hover = { index: number; x: number; y: number } | null;

export function OrbitApp() {
  const { t, lang } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GlobeEngine | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const [meta, setMeta] = useState<SatelliteMeta[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<Category>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [hover, setHover] = useState<Hover>(null);
  const [sky, setSky] = useState<Sky | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // The only effect: the 3D engine and its data live outside React.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const controller = new AbortController();
    let engine: GlobeEngine | null = null;

    (async () => {
      try {
        const [{ GlobeEngine }, response] = await Promise.all([
          import("@/lib/globe/engine"),
          fetch("/api/satellites", { signal: controller.signal }),
        ]);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const feed = (await response.json()) as SatelliteFeed;
        if (controller.signal.aborted) return;
        const list = feedMeta(feed);
        engine = new GlobeEngine(container, {
          onReady: () => setStatus("ready"),
          onHover: (index, x, y) =>
            setHover(index === null ? null : { index, x, y }),
          onSelect: (index) => {
            setSelected(index);
            setDetails(null);
          },
          onDetails: setDetails,
          onSky: setSky,
        });
        engine.load(feed, list);
        engineRef.current = engine;
        setMeta(list);
        setUpdatedAt(feed.updatedAt);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[orbit] failed to start", error);
        setStatus("error");
      }
    })();

    return () => {
      controller.abort();
      engine?.dispose();
      engineRef.current = null;
    };
  }, [attempt]);

  const counts = useMemo(() => {
    const result = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<
      Category,
      number
    >;
    for (const m of meta) result[m.category]++;
    return result;
  }, [meta]);

  const toggleCategory = useCallback((category: Category) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      engineRef.current?.setFilter((m) => !next.has(m.category));
      return next;
    });
  }, []);

  const pick = useCallback((index: number) => {
    engineRef.current?.focus(index);
    setSelected(index);
    setDetails(null);
    setPanelOpen(false);
  }, []);

  const locate = useCallback(
    (observer: Observer) => engineRef.current?.locate(observer),
    [],
  );

  const closeCard = useCallback(() => {
    engineRef.current?.select(null);
    setSelected(null);
  }, []);

  const retry = () => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  };

  return (
    <div className="relative h-dvh overflow-hidden">
      <div
        ref={containerRef}
        className="absolute inset-0 [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full"
      />

      {hover && hover.index !== selected && meta[hover.index] && (
        <div
          className="glass-soft pointer-events-none fixed z-30 rounded-full px-3 py-1 text-xs"
          style={{ left: hover.x + 14, top: hover.y - 12 }}
        >
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full"
            style={{ background: CATEGORY_COLORS[meta[hover.index].category] }}
          />
          {meta[hover.index].name}
        </div>
      )}

      <div className="pointer-events-none relative z-10 flex h-full flex-col">
        <header className="pointer-events-auto flex shrink-0 items-center justify-between gap-2 px-3 pt-4 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              aria-expanded={panelOpen}
              aria-label={t(panelOpen ? "panel.close" : "panel.open")}
              className="glass flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-sm transition-colors hover:text-accent lg:hidden"
            >
              {panelOpen ? "✕" : "☰"}
            </button>
            <div className="glass flex min-w-0 items-center gap-2 rounded-full px-4 py-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" />
              <span className="text-sm font-semibold tracking-tight">
                Orbit
              </span>
              <span className="hidden truncate text-sm text-muted sm:inline">
                {t("brand.tagline")}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSelector />
            <FullscreenButton />
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 gap-4 p-3 sm:p-4">
          <aside
            className={`glass pointer-events-auto absolute inset-x-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] flex-col gap-5 overflow-y-auto rounded-2xl p-4 transition-transform duration-300 ease-out lg:static lg:w-80 lg:translate-x-0 ${
              panelOpen ? "translate-x-0" : "-translate-x-[110%]"
            }`}
          >
            <div>
              <p className="text-lg font-semibold tracking-tight">
                {meta.length
                  ? t("stats.count", { count: formatNumber(meta.length, lang) })
                  : t("status.loading")}
              </p>
              {updatedAt && (
                <p className="text-xs text-muted">
                  {t("stats.updated", {
                    ago: formatAgo(Date.parse(updatedAt), lang),
                  })}
                </p>
              )}
            </div>
            {meta.length > 0 && (
              <>
                <SatelliteSearch meta={meta} onPick={pick} />
                <CategoryLegend
                  counts={counts}
                  hidden={hidden}
                  onToggle={toggleCategory}
                />
                <AboveMe
                  meta={meta}
                  sky={sky}
                  onLocate={locate}
                  onPick={pick}
                />
              </>
            )}
          </aside>

          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-end sm:static sm:ml-auto sm:mt-auto">
            {selected !== null && meta[selected] && (
              <SatelliteCard
                meta={meta[selected]}
                details={details}
                onClose={closeCard}
              />
            )}
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pb-3 text-[11px] text-muted">
          <span>{status === "ready" ? t("hint") : ""}</span>
          <span className="pointer-events-auto">
            {t("brand.data")} ·{" "}
            <a
              href="https://jhon.riverogz.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-accent"
            >
              {t("brand.credit")}{" "}
              <span className="font-medium text-foreground/80">
                Jhon Rivero
              </span>
            </a>
          </span>
        </footer>
      </div>

      {status !== "ready" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70">
          <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-5 text-sm">
            {status === "loading" ? (
              <>
                <span className="h-2 w-2 animate-ping rounded-full bg-accent" />
                <p>{t("status.loading")}</p>
              </>
            ) : (
              <>
                <p>{t("status.error")}</p>
                <button
                  type="button"
                  onClick={retry}
                  className="cursor-pointer rounded-full bg-accent/15 px-4 py-1.5 font-semibold text-accent hover:bg-accent/25"
                >
                  {t("status.retry")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
