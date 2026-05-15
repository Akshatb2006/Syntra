import { notFound } from "next/navigation";
import Link from "next/link";
import { findProperty, PROPERTIES } from "@/data/properties";

interface Props {
  params: Promise<{ slug: string }>;
}

// No generateMetadata — every listing page inherits the generic root title.
// No structured data (RealEstateListing) — agent should add it.
// Images are raw <img>, not next/image.

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const property = findProperty(slug);
  if (!property) notFound();

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <Link href="/listings" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← All listings
        </Link>
        <h1 className="text-3xl font-bold text-zinc-900">{property.title}</h1>
        <p className="text-zinc-600">
          {property.locality}, {property.city}
        </p>
      </header>

      <img src={property.imageUrl} className="w-full rounded-xl object-cover" />

      <section className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 p-6 sm:grid-cols-4">
        <Stat label="Type" value={property.type} />
        <Stat
          label="Size"
          value={`${property.sizeSqft.toLocaleString()} sq ft`}
        />
        {property.bedrooms > 0 && (
          <Stat label="Bedrooms" value={String(property.bedrooms)} />
        )}
        {property.bathrooms > 0 && (
          <Stat label="Bathrooms" value={String(property.bathrooms)} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-zinc-900">About this property</h2>
        <p className="text-zinc-700">{property.description}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-zinc-900">Features</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm text-zinc-700 sm:grid-cols-3">
          {property.features.map((f) => (
            <li key={f} className="rounded-md bg-zinc-50 px-3 py-2">
              {f}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-zinc-900">Nearby</h2>
        <ul className="text-sm text-zinc-700">
          {property.nearbyLandmarks.map((l) => (
            <li key={l}>· {l}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

export async function generateStaticParams() {
  return PROPERTIES.map((p) => ({ slug: p.slug }));
}
