export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-[18px] px-2 pt-7 pb-3 text-center">
      <svg width="168" height="120" viewBox="0 0 168 120" aria-hidden="true">
        <polygon points="52,22 74,35 74,61 52,74 30,61 30,35" fill="oklch(0.85 0.1 150)" />
        <polygon points="96,22 118,35 118,61 96,74 74,61 74,35" fill="oklch(0.89 0.11 95)" />
        <polygon points="74,61 96,74 96,100 74,113 52,100 52,74" fill="oklch(0.85 0.1 150)" opacity=".7" />
        <polygon points="118,61 140,74 140,100 118,113 96,100 96,74" fill="oklch(0.76 0.12 35)" opacity=".75" />
        <circle cx="74" cy="48" r="13" fill="var(--ink)" />
        <circle cx="74" cy="48" r="5" fill="var(--panel)" />
        <circle cx="138" cy="30" r="7" fill="var(--accent)" />
        <circle cx="24" cy="92" r="5" fill="var(--accent)" opacity=".6" />
      </svg>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-xl font-bold tracking-[-0.01em]">Find a home that gives you time back</h1>
        <p className="m-0 text-[15px] leading-normal text-pretty text-muted">
          Add the places you go each week and we’ll colour the map by how many hours you’d spend getting there from each
          spot.
        </p>
      </div>
    </div>
  );
}
