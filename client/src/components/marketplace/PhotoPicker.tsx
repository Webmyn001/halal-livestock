import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { FaCloudArrowUp, FaXmark } from 'react-icons/fa6';
import { ACCEPTED_TYPES, MAX_PHOTOS, MAX_TOTAL_BYTES, megabytes, totalBytes } from '../../services/listingService';

interface PhotoPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  /** Shrinks below the platform cap when a listing already carries some photos. */
  maxPhotos?: number;
  error?: string;
}

export function PhotoPicker({ files, onChange, maxPhotos = MAX_PHOTOS, error }: PhotoPickerProps) {
  const [problem, setProblem] = useState('');

  // The browser holds the bytes until upload, so previews come from object URLs.
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const room = maxPhotos - files.length;
  const pickedBytes = totalBytes(files);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (incoming.length === 0) return;

    const wrongType = incoming.find((file) => !ACCEPTED_TYPES.includes(file.type));
    if (wrongType) {
      setProblem(`That file is a ${wrongType.type || 'unknown format'}. Choose a JPEG, PNG or WebP image.`);
      return;
    }

    const merged = [...files, ...incoming].filter(
      (file, index, all) =>
        all.findIndex((other) => other.name === file.name && other.size === file.size) === index
    );

    if (merged.length > maxPhotos) {
      setProblem(`A listing carries ${maxPhotos} photos at most. You selected ${merged.length}.`);
      return;
    }

    const bytes = totalBytes(merged);
    if (bytes > MAX_TOTAL_BYTES) {
      setProblem(
        `That set is ${megabytes(bytes)}. Keep the whole batch under ${megabytes(MAX_TOTAL_BYTES)}. Your phone camera does not need the highest setting.`
      );
      return;
    }

    setProblem('');
    onChange(merged);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink-700">Photos of the animal</p>
        <p className="text-xs text-ink-500">
          {files.length} of {maxPhotos} · {megabytes(pickedBytes)} of {megabytes(MAX_TOTAL_BYTES)}
        </p>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">
        One photo is required and four is the maximum. The whole set stays under three megabytes, and the platform
        shrinks and compresses every picture for you.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {files.map((file, index) => (
          <figure key={`${file.name}-${index}`} className="group relative aspect-square overflow-hidden rounded-2xl bg-stone-100">
            <img src={previews[index]} alt={`Selected photo ${index + 1}`} className="size-full object-cover" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-brand-900/70 px-2 py-1 text-[11px] text-white">
              {megabytes(file.size)}
            </figcaption>
            <button
              type="button"
              onClick={() => onChange(files.filter((_, position) => position !== index))}
              aria-label={`Remove selected photo ${index + 1}`}
              className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-ink-700 shadow transition hover:bg-white hover:text-red-700"
            >
              <FaXmark aria-hidden="true" className="size-3.5" />
            </button>
          </figure>
        ))}

        {room > 0 ? (
          <label className="grid aspect-square cursor-pointer place-items-center gap-1 rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-ink-500 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 focus-within:ring-2 focus-within:ring-brand-500">
            <FaCloudArrowUp aria-hidden="true" className="size-6" />
            <span className="text-xs font-semibold">Add photo</span>
            <input
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              multiple
              className="sr-only"
              onChange={choose}
            />
          </label>
        ) : null}
      </div>

      {problem || error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-red-600">
          {problem || error}
        </p>
      ) : null}

      {files.length === maxPhotos ? (
        <p className="mt-3 text-xs text-ink-500">
          All {maxPhotos} places are used. Remove a photo to make room for a new one.
        </p>
      ) : null}
    </div>
  );
}
