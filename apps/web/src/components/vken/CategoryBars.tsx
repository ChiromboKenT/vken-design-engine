import type { CSSProperties } from 'react';
import type { VkenProblemCategoryBreakdown, VkenProblemCategoryId } from '@open-design/contracts';

const CATEGORY_COLORS: Record<VkenProblemCategoryId, string> = {
  tokens: 'var(--vken-chart-1)',
  spacing: 'var(--vken-chart-2)',
  contrast: 'var(--vken-chart-3)',
  repetition: 'var(--vken-chart-4)',
};

export function CategoryBars({
  categories,
  activeCategory,
  onSelectCategory,
}: {
  categories: VkenProblemCategoryBreakdown[];
  activeCategory: VkenProblemCategoryId | null;
  onSelectCategory: (category: VkenProblemCategoryId | null) => void;
}) {
  const max = Math.max(1, ...categories.map((category) => category.total));

  return (
    <section className="vken-category-bars" aria-label="Problem categories">
      <div className="vken-category-head">
        <span>Problem load</span>
        {activeCategory ? (
          <button type="button" onClick={() => onSelectCategory(null)}>
            Clear filter
          </button>
        ) : null}
      </div>
      <div className="vken-category-list">
        {categories.map((category) => {
          const totalWidth = Math.max(0, Math.round((category.total / max) * 100));
          const remainingWidth =
            category.total === 0 ? 0 : Math.max(0, Math.round((category.remaining / category.total) * 100));
          const fixedWidth = 100 - remainingWidth;
          const title = evidenceTitle(category);
          return (
            <button
              type="button"
              key={category.category}
              className={`vken-category-row${activeCategory === category.category ? ' active' : ''}`}
              onClick={() => onSelectCategory(activeCategory === category.category ? null : category.category)}
              title={title}
              style={
                {
                  '--category-color': CATEGORY_COLORS[category.category],
                  '--category-total-width': `${totalWidth}%`,
                  '--category-remaining-width': `${remainingWidth}%`,
                  '--category-fixed-width': `${fixedWidth}%`,
                } as CSSProperties
              }
            >
              <span className="vken-category-label">{category.label}</span>
              <span className="vken-category-track" aria-hidden>
                <span className="vken-category-meter">
                  <span className="vken-category-fixed" />
                  <span className="vken-category-remaining" />
                </span>
              </span>
              <span className="vken-category-counts">
                <span>{category.total}</span>
                <span aria-hidden>-&gt;</span>
                <span>{category.remaining}</span>
              </span>
              <span className="vken-category-status">
                {category.fixed > 0 ? `${category.fixed} fixed` : `${category.queued} queued`}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function evidenceTitle(category: VkenProblemCategoryBreakdown): string {
  if (category.evidence.length === 0) return `${category.label}: no file evidence yet`;
  return category.evidence
    .slice(0, 8)
    .map((item) => {
      const line = item.line == null ? '' : `:${item.line}`;
      const value = item.value ? ` (${item.value})` : '';
      return `${item.file}${line} - ${item.label}${value}`;
    })
    .join('\n');
}
