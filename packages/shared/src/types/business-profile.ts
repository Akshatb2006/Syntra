/**
 * What kind of business a target site is. Detected from the crawl (and
 * optionally biased by an operator hint) so the whole pipeline adapts to any
 * industry instead of assuming real estate. This single abstraction is what
 * lets the engine run on SaaS, healthcare, e-commerce, real estate, etc.
 * without per-niche code paths.
 */
export interface BusinessProfile {
  /** Short industry label, e.g. "SaaS", "Healthcare", "E-commerce", "Real Estate". */
  industry: string;
  /**
   * True when the business serves customers in specific geographic places
   * (clinics, real estate, restaurants, local services). False for global /
   * online products (SaaS, blogs, most e-commerce). Gates the local-intel step.
   */
  locationBased: boolean;
  /** Relevant schema.org types, e.g. ["SoftwareApplication", "FAQPage"]. */
  schemaTypes: string[];
  /** One-line description of who the site serves (detected, optional). */
  audience?: string;
  /** One-line description of what the site is (detected, optional). */
  summary?: string;
}

/**
 * Optional operator-supplied bias for profile detection, collected on the
 * new-run form. Detection respects these when present and fills in the rest.
 */
export interface BusinessProfileHint {
  industry?: string;
  locationBased?: boolean;
}

/** Safe fallback when detection fails — niche-agnostic and non-local. */
export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  industry: "General",
  locationBased: false,
  schemaTypes: ["Organization", "WebSite", "FAQPage"],
};
