export interface Property {
  slug: string;
  title: string;
  type: "Apartment" | "Villa" | "Plot" | "Penthouse";
  bedrooms: number;
  bathrooms: number;
  sizeSqft: number;
  priceInr: number;
  locality: string;
  city: string;
  nearbyLandmarks: string[];
  description: string;
  imageUrl: string;
  features: string[];
}

export const PROPERTIES: Property[] = [
  {
    slug: "2bhk-whitefield-itpl",
    title: "2BHK Apartment near ITPL",
    type: "Apartment",
    bedrooms: 2,
    bathrooms: 2,
    sizeSqft: 1180,
    priceInr: 8_500_000,
    locality: "Whitefield",
    city: "Bangalore",
    nearbyLandmarks: ["ITPL", "Whitefield Metro", "Forum Shantiniketan"],
    description:
      "Bright 2BHK in the heart of Whitefield's tech corridor. Walking distance to Whitefield metro and a short drive to ITPL. Society has a pool, gym and 24/7 security.",
    imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200",
    features: ["Pool", "Gym", "24/7 Security", "Power Backup"],
  },
  {
    slug: "3bhk-sarjapur-villa",
    title: "3BHK Villa in Sarjapur",
    type: "Villa",
    bedrooms: 3,
    bathrooms: 3,
    sizeSqft: 2100,
    priceInr: 17_500_000,
    locality: "Sarjapur",
    city: "Bangalore",
    nearbyLandmarks: ["Wipro Sarjapur", "Decathlon", "Greenwood High School"],
    description:
      "Standalone 3BHK villa with a private garden, just off Sarjapur main road. Great for families — proximity to international schools and tech offices.",
    imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200",
    features: ["Private Garden", "Covered Parking", "Modular Kitchen"],
  },
  {
    slug: "1bhk-electronic-city",
    title: "1BHK near Electronic City Phase 1",
    type: "Apartment",
    bedrooms: 1,
    bathrooms: 1,
    sizeSqft: 720,
    priceInr: 4_200_000,
    locality: "Electronic City",
    city: "Bangalore",
    nearbyLandmarks: ["Infosys Campus", "Wipro EC", "Neeladri Road"],
    description:
      "Compact 1BHK perfect for IT professionals. Walking distance to Infosys Phase 1 and reliable BMTC connectivity.",
    imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200",
    features: ["Lift", "Covered Parking", "Power Backup"],
  },
  {
    slug: "4bhk-koramangala-penthouse",
    title: "4BHK Penthouse in Koramangala",
    type: "Penthouse",
    bedrooms: 4,
    bathrooms: 4,
    sizeSqft: 3400,
    priceInr: 42_000_000,
    locality: "Koramangala",
    city: "Bangalore",
    nearbyLandmarks: ["Forum Mall", "Sony World Junction", "Jyoti Nivas College"],
    description:
      "Top-floor penthouse with a wraparound terrace. The most central location in Bangalore — minutes from HSR, Indiranagar, and BTM.",
    imageUrl: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200",
    features: ["Terrace", "Smart Home", "Private Lift", "Gym"],
  },
  {
    slug: "2bhk-indiranagar-100ft-road",
    title: "2BHK on 100 Feet Road, Indiranagar",
    type: "Apartment",
    bedrooms: 2,
    bathrooms: 2,
    sizeSqft: 1320,
    priceInr: 13_500_000,
    locality: "Indiranagar",
    city: "Bangalore",
    nearbyLandmarks: ["Indiranagar Metro", "100ft Road", "Toit"],
    description:
      "Quiet 2BHK off 100ft road, walking distance to Indiranagar metro and the city's best cafe culture.",
    imageUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200",
    features: ["Modular Kitchen", "Reserved Parking", "Lift"],
  },
  {
    slug: "plot-devanahalli",
    title: "Residential Plot in Devanahalli",
    type: "Plot",
    bedrooms: 0,
    bathrooms: 0,
    sizeSqft: 2400,
    priceInr: 9_000_000,
    locality: "Devanahalli",
    city: "Bangalore",
    nearbyLandmarks: ["Kempegowda International Airport", "Aerospace SEZ"],
    description:
      "Premium gated-community plot near the airport. BMRDA approved, road-facing, ready for construction.",
    imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200",
    features: ["BMRDA Approved", "Gated Community", "Road-facing"],
  },
];

export function findProperty(slug: string): Property | undefined {
  return PROPERTIES.find((p) => p.slug === slug);
}

export const LOCALITIES = Array.from(
  new Set(PROPERTIES.map((p) => p.locality)),
).sort();
