import Link from "next/link";
import type { Property } from "@/data/properties";

function inrFormat(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link
      href={`/listings/${property.slug}`}
      className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
        {/* deliberately raw <img> — no next/image, no width/height set */}
        <img
          src={property.imageUrl}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {property.type}
          </span>
          <span className="text-base font-semibold text-zinc-900">
            {inrFormat(property.priceInr)}
          </span>
        </div>
        <h3 className="line-clamp-1 text-base font-semibold text-zinc-900">
          {property.title}
        </h3>
        <p className="text-sm text-zinc-600">
          {property.locality} · {property.city}
        </p>
        <div className="flex gap-3 text-xs text-zinc-500">
          {property.bedrooms > 0 && <span>{property.bedrooms} BHK</span>}
          {property.bathrooms > 0 && <span>{property.bathrooms} Bath</span>}
          <span>{property.sizeSqft.toLocaleString()} sq ft</span>
        </div>
      </div>
    </Link>
  );
}
