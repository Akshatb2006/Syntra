import { PROPERTIES } from "@/data/properties";
import { PropertyCard } from "@/components/PropertyCard";

// Same generic <title> as home — duplicated metadata, agent should fix.
export default function ListingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-zinc-900">All listings</h1>
      <p className="text-zinc-600">
        {PROPERTIES.length} properties across Bangalore.
      </p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PROPERTIES.map((p) => (
          <PropertyCard key={p.slug} property={p} />
        ))}
      </div>
    </div>
  );
}
