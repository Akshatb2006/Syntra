"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppHeader() {
  const pathname = usePathname();
  const isRunDetail = pathname?.startsWith("/runs/") && pathname !== "/runs/new";

  return (
    <header className="header">
      <div className="header-brand">
        <div className="brand-mark">S</div>
        <div className="brand-text">Syntra</div>
      </div>
      <nav className="nav">
        <Link href="/" className={pathname === "/" ? "current" : ""}>Runs</Link>
        <Link href="/runs/new" className={pathname === "/runs/new" ? "current" : ""}>New Run</Link>
        <Link href="/connect" className={pathname === "/connect" ? "current" : ""}>Connect</Link>
      </nav>

      {/* Portal target — run detail page injects run-specific info here */}
      {isRunDetail && (
        <>
          <div className="divider-v"></div>
          <div
            id="header-portal-target"
            style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}
          />
        </>
      )}
    </header>
  );
}
