"use client";

import { CATEGORIES, CATEGORY_COLORS } from "@/lib/assets/categories";
import { useI18n } from "@/lib/components/i18n";
import { formatNumber } from "@/lib/utils/format";
import type { Category } from "@/lib/types/satellite";

type Props = {
  counts: Record<Category, number>;
  focus: Category | null;
  onFocus: (category: Category | null) => void;
};

// A lens, not a filter: the chosen group stands out and the rest stay as faint
// context, so its shape (a shell, a belt, a band) is what you see.
export function CategoryLegend({ counts, focus, onFocus }: Props) {
  const { t, lang } = useI18n();
  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{t("categories.title")}</h2>
        {focus && (
          <button
            type="button"
            onClick={() => onFocus(null)}
            className="cursor-pointer text-xs text-accent hover:underline"
          >
            {t("categories.all")}
          </button>
        )}
      </div>
      <p className="mb-2 text-xs text-muted">{t("categories.hint")}</p>
      <ul className="flex flex-col gap-0.5">
        {CATEGORIES.map((category) => {
          const label = t(`category.${category}`);
          const active = focus === category;
          const dimmed = focus !== null && !active;
          return (
            <li key={category}>
              <button
                type="button"
                onClick={() => onFocus(active ? null : category)}
                aria-pressed={active}
                aria-label={t("categories.toggle", { label })}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                  active ? "bg-white/10" : "hover:bg-white/5"
                } ${dimmed ? "text-muted" : ""}`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full transition-opacity"
                  style={{
                    background: CATEGORY_COLORS[category],
                    boxShadow: dimmed
                      ? "none"
                      : `0 0 8px ${CATEGORY_COLORS[category]}`,
                    opacity: dimmed ? 0.4 : 1,
                  }}
                />
                <span className="flex-1 truncate">{label}</span>
                <span className="text-xs tabular-nums text-muted">
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
