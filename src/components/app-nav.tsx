import { Link } from "@tanstack/react-router";

const ITEMS = [
  { id: "warn", to: "/", label: "行車警示" },
  { id: "search", to: "/search", label: "地圖搜尋" },
] as const;

export function AppNav({ current }: { current: "warn" | "search" }) {
  return (
    <nav className="flex gap-2" aria-label="功能">
      {ITEMS.map((item) => {
        const on = item.id === current;
        return (
          <Link
            key={item.id}
            to={item.to}
            className={
              on
                ? "inline-flex h-11 items-center rounded-xl bg-amber px-4 text-sm font-bold text-amber-ink"
                : "inline-flex h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-fg"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
