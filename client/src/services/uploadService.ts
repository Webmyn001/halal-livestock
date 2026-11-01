import { request } from './apiClient';
import type { StoredPhoto } from '../types';

export const MAX_PHOTOS = 4;
export const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const uploadService = {
  async upload(files: File[]): Promise<StoredPhoto[]> {
    const form = new FormData();
    files.forEach((file) => form.append('images', file));
    const data = await request<{ photos: StoredPhoto[] }>({ method: 'POST', url: '/uploads/images', data: form });
    return data.photos;
  },

  async remove(publicId: string): Promise<StoredPhoto[]> {
    const data = await request<{ photos: StoredPhoto[] }>({
      method: 'DELETE',
      url: '/uploads/images',
      data: { publicId },
    });
    return data.photos;
  },
};
