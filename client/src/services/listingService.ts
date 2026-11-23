import { request } from './apiClient';
import type {
  Listing,
  ListingFilters,
  ListingPage,
  ListingPatch,
  NewListingPayload,
} from '../types';

export const MAX_PHOTOS = 4;
export const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Total for a picked set, so the form can complain before the browser starts uploading. */
export function totalBytes(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}

function listingFrom(data: { listing: Listing }): Listing {
  return data.listing;
}

function pageParams(filters: ListingFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (filters.species) params.species = filters.species;
  if (filters.type) params.type = filters.type;
  if (filters.q) params.q = filters.q;
  if (filters.sort) params.sort = filters.sort;
  if (filters.page && filters.page > 1) params.page = filters.page;
  return params;
}

function photoForm(files: File[]): FormData {
  const form = new FormData();
  files.forEach((file) => form.append('images', file));
  return form;
}

function listingForm(payload: NewListingPayload): FormData {
  const form = new FormData();
  form.append('title', payload.title);
  form.append('description', payload.description);
  form.append('species', payload.species);
  form.append('listingType', payload.listingType);
  form.append('quantity', String(payload.quantity));
  form.append('unit', payload.unit);
  form.append('priceNaira', String(payload.priceNaira));
  form.append('town', payload.town);
  if (payload.breed) form.append('breed', payload.breed);
  return form;
}

export const listingService = {
  async list(filters: ListingFilters): Promise<ListingPage> {
    return request<ListingPage>({ method: 'GET', url: '/listings', params: pageParams(filters) });
  },

  async mine(): Promise<Listing[]> {
    const data = await request<{ listings: Listing[] }>({ method: 'GET', url: '/listings/mine' });
    return data.listings;
  },

  async get(id: string): Promise<Listing> {
    return listingFrom(await request<{ listing: Listing }>({ method: 'GET', url: `/listings/${id}` }));
  },

  async create(payload: NewListingPayload, files: File[]): Promise<Listing> {
    const form = listingForm(payload);
    files.forEach((file) => form.append('images', file));
    return listingFrom(await request<{ listing: Listing }>({ method: 'POST', url: '/listings', data: form }));
  },

  async update(id: string, patch: ListingPatch): Promise<Listing> {
    return listingFrom(
      await request<{ listing: Listing }>({ method: 'PATCH', url: `/listings/${id}`, data: patch })
    );
  },

  async addPhotos(id: string, files: File[]): Promise<Listing> {
    return listingFrom(
      await request<{ listing: Listing }>({
        method: 'POST',
        url: `/listings/${id}/photos`,
        data: photoForm(files),
      })
    );
  },

  async removePhoto(id: string, publicId: string): Promise<Listing> {
    return listingFrom(
      await request<{ listing: Listing }>({
        method: 'DELETE',
        url: `/listings/${id}/photos`,
        data: { publicId },
      })
    );
  },

  async delete(id: string): Promise<void> {
    await request<{ success: boolean }>({
      method: 'DELETE',
      url: `/listings/${id}`,
    });
  },
};
