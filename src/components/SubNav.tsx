"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SubNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="clay-subnav">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto py-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`clay-nav-link px-4 py-2.5 text-sm font-medium whitespace-nowrap ${
                active ? "clay-nav-link-active" : "text-grey hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
