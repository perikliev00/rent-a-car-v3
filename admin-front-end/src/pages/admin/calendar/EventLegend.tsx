import { EVENT_TYPE_STYLE, LEGEND_ITEMS } from './eventStyles';

export function EventLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
      data-testid="calendar-legend"
      aria-label="Event type legend"
    >
      {LEGEND_ITEMS.map((type) => {
        const style = EVENT_TYPE_STYLE[type];
        return (
          <span key={type} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-sm border-l-2 ${style.bar}`}
              aria-hidden
            />
            {style.label}
          </span>
        );
      })}
    </div>
  );
}
