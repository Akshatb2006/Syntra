import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900">
          Bangalore Homes
        </Link>
        <nav className="flex gap-6 text-sm text-zinc-700">
          <Link href="/listings" className="hover:text-zinc-900">
            Listings
          </Link>
          <Link href="/about" className="hover:text-zinc-900">
            About
          </Link>
          <Link href="/contact" className="hover:text-zinc-900">
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-zinc-200 bg-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-zinc-600">
        <p>© 2026 Bangalore Homes. All rights reserved.</p>
      </div>
    </footer>
  );
}
