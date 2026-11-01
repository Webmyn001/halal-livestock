import { z } from 'zod';

export const removeImageSchema = z.object({
  publicId: z.string().trim().min(4, 'Missing image reference').max(300, 'Image reference is too long'),
});

export type RemoveImageInput = z.infer<typeof removeImageSchema>;
