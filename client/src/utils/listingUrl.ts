const OBJECT_ID_RE = /[a-f0-9]{24}$/i;

function slugPart(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type ListingPathInput = {
  id: string;
  title: string;
  species: string;
  breed?: string;
  town: string;
  state: string;
};

/** Readable, unique marketplace URL: title + breed + listing id for stable lookup. */
export function listingPath(listing: ListingPathInput): string {
  const parts = [listing.title, listing.breed].map(slugPart).filter(Boolean);
  const slug = parts.join('-').replace(/-+/g, '-').slice(0, 45).replace(/-+$/g, '');
  return `/marketplace/${slug ? `${slug}-${listing.id}` : listing.id}`;
}

export function listingShareUrl(listing: ListingPathInput): string {
  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
  const apiOrigin = apiBase.replace(/\/api\/v1$/i, '');
  const path = listingPath(listing);
  const id = listingIdFromParam(listing.id) || listing.id;
  const sharePath = `/share/listings/${path.split('/').pop() || id}`;
  return apiOrigin ? `${apiOrigin}${sharePath}` : `${window.location.origin}${path}`;
}

/** Accepts a plain id or a slug ending in a 24-char Mongo ObjectId. */
export function listingIdFromParam(param: string): string {
  const match = param.match(OBJECT_ID_RE);
  return match ? match[0] : param;
}
