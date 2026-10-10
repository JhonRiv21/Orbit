"use client";

import { CATEGORIES, CATEGORY_COLORS } from "@/lib/assets/categories";
import { useI18n } from "@/lib/components/i18n";
import { formatNumber } from "@/lib/utils/format";
import type { Category } from "@/lib/types/satellite";

type Props = {
  counts: Record<Category, number>;
  hidden: Set<Category>;
  onToggle: (category: Category) => void;
};

export function CategoryLegend({ counts, hidden, onToggle }: Props) {
  const { t, lang } = useI18n();
  return (
    <section>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {t("categories.title")}
      </h2>
      <ul className="flex flex-col gap-0.5">
        {CATEGORIES.map((category) => {
          const label = t(`category.${category}`);
          const off = hidden.has(category);
          return (
            <li key={category}>
              <button
                type="button"
                onClick={() => onToggle(category)}
                aria-pressed={!off}
                aria-label={t("categories.toggle", { label })}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/5 ${off ? "opacity-40" : ""}`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    background: CATEGORY_COLORS[category],
                    boxShadow: off
                      ? "none"
                      : `0 0 8px ${CATEGORY_COLORS[category]}`,
                  }}
                />
                <span className="flex-1 truncate">{label}</span>
                <span className="font-mono text-xs tabular-nums text-muted">
                  {formatNumber(counts[category], lang)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
