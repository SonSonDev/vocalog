export type SkeletonVariant = 'home' | 'member' | 'day' | 'week' | 'month' | 'year';

const FIGURES: Record<SkeletonVariant, number> = { home: 4, member: 5, day: 3, week: 4, month: 4, year: 5 };

/**
 * The height of the real cards at three widths (wide screens, tablets, phones), measured on the demo data, so the page
 * does not jump when the data arrives. A real page with more or fewer members differs a little; that is fine.
 */
type Heights = readonly [wide: number, medium: number, small: number];

const CARDS: Record<SkeletonVariant, { span: string; heights: Heights; rows: number }[]> = {
  home: [
    { span: 'col-7', heights: [483, 483, 815], rows: 6 },
    { span: 'col-5', heights: [483, 300, 250], rows: 7 },
    { span: 'col-12', heights: [644, 644, 636], rows: 12 },
    { span: 'col-6', heights: [225, 285, 277], rows: 3 },
    { span: 'col-6', heights: [225, 285, 192], rows: 2 },
  ],
  member: [
    { span: 'col-7', heights: [300, 257, 219], rows: 3 },
    { span: 'col-5', heights: [300, 300, 250], rows: 3 },
    { span: 'col-12', heights: [255, 203, 195], rows: 3 },
    { span: 'col-6', heights: [397, 520, 512], rows: 5 },
    { span: 'col-6', heights: [397, 520, 344], rows: 4 },
    { span: 'col-6', heights: [391, 518, 510], rows: 5 },
    { span: 'col-6', heights: [391, 518, 354], rows: 5 },
    { span: 'col-6', heights: [272, 285, 277], rows: 3 },
    { span: 'col-6', heights: [272, 285, 264], rows: 4 },
  ],
  day: [{ span: 'col-12', heights: [455, 455, 690], rows: 6 }],
  week: [{ span: 'col-12', heights: [421, 421, 666], rows: 6 }],
  month: [{ span: 'col-12', heights: [567, 567, 451], rows: 6 }],
  // The year opens on the contribution-style grid (the twelve month calendars are taller, about 1 000 to 1 300 px).
  year: [{ span: 'col-12', heights: [278, 226, 218], rows: 4 }],
};

/** Placeholder blocks shaped like a page: grey, calm, and read as "loading" by a screen reader. */
export function PageSkeleton({ variant, withHeader = false }: { variant: SkeletonVariant; withHeader?: boolean }) {
  return (
    <>
      {withHeader && (
        <div class="skeleton-header" aria-hidden="true">
          <div class="skeleton-bar">
            <span class="sk sk-picker" />
            <span class="sk sk-picker sk-narrow" />
          </div>
          <span class="sk sk-h1" />
        </div>
      )}
      <div class="content skeleton-page" role="status" aria-busy="true">
        <span class="sr-only">Chargement…</span>
        {variant !== 'home' && variant !== 'member' && <span class={variant === 'month' || variant === 'year' ? 'sk sk-nav' : 'sk sk-nav sk-nav-split'} aria-hidden="true" />}
        <div class={`figures skeleton-figures n${FIGURES[variant]}`} aria-hidden="true">
          {Array.from({ length: FIGURES[variant] }, (_, index) => (
            <div class="figure" key={index}>
              <span class="sk sk-line sk-short" />
              <span class="sk sk-value" />
              <span class="sk sk-line sk-medium" />
            </div>
          ))}
        </div>
        <div class="dashboard" aria-hidden="true">
          {CARDS[variant].map((card, index) => (
            <div class={card.span} key={index}>
              <section class="card skeleton-card" style={{ '--h': `${card.heights[0]}px`, '--hm': `${card.heights[1]}px`, '--hs': `${card.heights[2]}px` }}>
                <span class="sk sk-title" />
                {Array.from({ length: card.rows }, (_, row) => (
                  <span class="sk sk-line" key={row} style={{ width: `${70 + ((row * 13) % 30)}%` }} />
                ))}
              </section>
            </div>
          ))}
        </div>
        <span class="sk sk-line sk-medium skeleton-foot" aria-hidden="true" />
      </div>
    </>
  );
}
