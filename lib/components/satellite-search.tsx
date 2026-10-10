"use client";

import { useMemo, useState } from "react";
import { CATEGORY_COLORS } from "@/lib/assets/categories";
import { useI18n } from "@/lib/components/i18n";
import type { SatelliteMeta } from "@/lib/globe/orbit-math";

const MAX_RESULTS = 8;
// Familiar names people type that do not match the catalogue spelling.
const ALIASES: Record<string, string> = {
  ISS: "ISS (ZARYA)",
  HUBBLE: "HST",
  TIANGONG: "CSS (TIANHE)",
};

type Props = { meta: SatelliteMeta[]; onPick: (index: number) => void };

export function SatelliteSearch({ meta, onPick }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const raw = query.trim().toUpperCase();
    if (raw.length < 2) return [];
    const q = ALIASES[raw] ?? raw;
    const starts: number[] = [];
    const contains: number[] = [];
    meta.forEach((m, i) => {
      const name = m.name.toUpperCase();
      if (name.startsWith(q)) starts.push(i);
      else if (name.includes(q) || String(m.noradId) === q) contains.push(i);
    });
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [query, meta]);

  return (
    <section>
      <label
        htmlFor="sat-search"
        className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted"
      >
        {t("search.label")}
      </label>
      <input
        id="sat-search"
        type="search"
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search.placeholder")}
        maxLength={40}
        className="surface w-full rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/60"
      />
      {query.trim().length >= 2 && (
        <ul className="mt-1.5 flex flex-col">
          {results.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-muted">
              {t("search.empty")}
            </li>
          )}
          {results.map((i) => (
            <li key={meta[i].noradId}>
              <button
                type="button"
                onClick={() => {
                  onPick(i);
                  setQuery("");
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: CATEGORY_COLORS[meta[i].category] }}
                />
                <span className="flex-1 truncate">{meta[i].name}</span>
                <span className="font-mono text-[11px] text-muted">
                  {meta[i].noradId}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
