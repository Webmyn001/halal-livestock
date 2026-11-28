const OBJECT_ID_RE = /[a-f0-9]{24}$/i;

function slugPart(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Supports readable marketplace slugs that end with the listing ObjectId. */
export function listingIdFromParam(param: string): string {
  const match = param.match(OBJECT_ID_RE);
  return match ? match[0] : param;
}

export function listingSlugPath(listing: {
  _id: unknown;
  title: string;
  species: string;
  breed?: string;
  town: string;
  state: string;
}): string {
  const id = String(listing._id);
  const slug = [listing.title, listing.breed]
    .map(slugPart)
    .filter(Boolean)
    .join('-')
    .replace(/-+/g, '-')
    .slice(0, 45)
    .replace(/-+$/g, '');
  return `/marketplace/${slug ? `${slug}-${id}` : id}`;
}

