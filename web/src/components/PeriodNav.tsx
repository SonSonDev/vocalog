import { Link } from './Link.tsx';

interface Target {
  to: string;
  label: string;
  onPrefetch?: () => void;
}

/**
 * Previous and next of a day, a week or a month, with links to the larger periods that contain it in the middle. At either
 * end of the data the button stays, greyed, with the reason, so the layout does not move.
 */
export function PeriodNav({ prev, next, prevEnd, nextEnd, middle = [] }: { prev: Target | null; next: Target | null; prevEnd: string; nextEnd: string; middle?: Target[] }) {
  return (
    <nav class="day-nav" aria-label="Changer de période">
      {prev ? (
        <Link to={prev.to} class="day-nav-link" onPrefetch={prev.onPrefetch}>
          ← {prev.label}
        </Link>
      ) : (
        <span class="day-nav-link disabled" aria-disabled="true">
          ← {prevEnd}
        </span>
      )}
      {middle.length > 0 && (
        <span class="day-nav-center">
          {middle.map((target) => (
            <Link key={target.to} to={target.to} class="day-nav-link" onPrefetch={target.onPrefetch}>
              {target.label}
            </Link>
          ))}
        </span>
      )}
      {next ? (
        <Link to={next.to} class="day-nav-link" onPrefetch={next.onPrefetch}>
          {next.label} →
        </Link>
      ) : (
        <span class="day-nav-link disabled" aria-disabled="true">
          {nextEnd} →
        </span>
      )}
    </nav>
  );
}
