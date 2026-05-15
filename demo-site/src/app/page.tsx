import Link from "next/link";
import { PROPERTIES } from "@/data/properties";
import { PropertyCard } from "@/components/PropertyCard";

// Deliberately weak: same generic title across pages, no description, no schema.
export default function HomePage() {
  const featured = PROPERTIES.slice(0, 3);
  return (
    <div className="space-y-16">
      <section className="space-y-6">
        {/* Two H1s on the page — intentional accessibility/SEO issue */}
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Find your next home in Bangalore
        </h1>
        <h1 className="text-lg text-zinc-600">
          Apartments, villas, plots across Bangalore’s top neighborhoods.
        </h1>
        <div className="flex gap-3">
          <Link
            href="/listings"
            className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Browse listings
          </Link>
          <Link
            href="/contact"
            className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Talk to us
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-semibold text-zinc-900">
          Featured properties
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <PropertyCard key={p.slug} property={p} />
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-zinc-50 p-8">
        <h2 className="mb-2 text-xl font-semibold text-zinc-900">
          Why Bangalore Homes
        </h2>
        <p className="text-zinc-600">
          Curated listings. No middlemen. Transparent pricing across Whitefield, Sarjapur,
          Indiranagar, Koramangala, Electronic City and more.
        </p>
      </section>
    </div>
  );
}
