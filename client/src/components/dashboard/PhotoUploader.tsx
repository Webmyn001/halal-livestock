import { useEffect, useMemo, useState } from 'react';
import { FaCloudArrowUp, FaXmark } from 'react-icons/fa6';
import { Alert } from '../common/Alert';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { ACCEPTED_TYPES, MAX_PHOTOS, MAX_TOTAL_BYTES, megabytes, uploadService } from '../../services/uploadService';
import { ApiRequestError } from '../../services/apiClient';

function reasonFrom(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

export function PhotoUploader() {
  const { user, refresh } = useAuth();

  const [picked, setPicked] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<'add' | 'remove' | null>(null);

  const previews = useMemo(() => picked.map((file) => URL.createObjectURL(file)), [picked]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  if (!user) return null;

  const photos = user.photos;
  const room = MAX_PHOTOS - photos.length;
  const pickedBytes = picked.reduce((total, file) => total + file.size, 0);

  function chooseFiles(list: FileList | null) {
    setError('');
    setNotice('');

    const incoming = Array.from(list ?? []);
    if (incoming.length === 0) {
      setPicked([]);
      return;
    }
    if (incoming.some((file) => !ACCEPTED_TYPES.includes(file.type))) {
      setError('Only JPEG, PNG and WebP images are accepted.');
      setPicked([]);
      return;
    }
    if (incoming.length > room) {
      setError(`You can add ${room} more ${room === 1 ? 'image' : 'images'}. Remove one first.`);
      setPicked([]);
      return;
    }
    const total = incoming.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      setError(`That selection is ${megabytes(total)}. Keep the whole set under ${megabytes(MAX_TOTAL_BYTES)}.`);
      setPicked([]);
      return;
    }

    setPicked(incoming);
  }

  async function handleUpload() {
    setError('');
    setNotice('');
    setBusy('add');
    try {
      await uploadService.upload(picked);
      setPicked([]);
      setNotice(`${picked.length} ${picked.length === 1 ? 'photo' : 'photos'} uploaded.`);
      await refresh();
    } catch (err) {
      setError(reasonFrom(err, 'The upload did not go through. Try again.'));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(publicId: string) {
    setError('');
    setNotice('');
    setBusy('remove');
    try {
      await uploadService.remove(publicId);
      await refresh();
    } catch (err) {
      setError(reasonFrom(err, 'That photo could not be removed. Try again.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
      <h2 className="font-display text-lg font-semibold text-ink-900">Farm photos</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">
        Clear photos of your animals and your pens are the fastest way to earn a buyer. Upload up to {MAX_PHOTOS} images
        at a time, {megabytes(MAX_TOTAL_BYTES)} for the whole set. Large files are resized and compressed for you.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <figure key={photo.publicId} className="group relative aspect-square overflow-hidden rounded-2xl bg-stone-100">
            <img
              src={photo.url}
              alt={`Farm photo ${index + 1} for ${user.fullName}`}
              loading="lazy"
              className="size-full object-cover"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-brand-900/70 px-2 py-1 text-[11px] text-white">
              {megabytes(photo.bytes)}
            </figcaption>
            <button
              type="button"
              onClick={() => handleRemove(photo.publicId)}
              disabled={busy !== null}
              aria-label={`Remove farm photo ${index + 1}`}
              className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-ink-700 shadow transition hover:bg-white hover:text-red-700 disabled:opacity-60"
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
              onChange={(event) => {
                chooseFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
        ) : null}
      </div>

      {photos.length === MAX_PHOTOS ? (
        <p className="mt-3 text-xs text-ink-500">
          All {MAX_PHOTOS} places are used. Remove a photo to make room for a new one.
        </p>
      ) : null}

      {previews.length > 0 ? (
        <div className="mt-5 rounded-2xl bg-stone-50 p-4 ring-1 ring-inset ring-stone-200">
          <p className="text-sm font-semibold text-ink-900">
            {picked.length} {picked.length === 1 ? 'photo' : 'photos'} ready, {megabytes(pickedBytes)}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {previews.map((url, index) => (
              <img
                key={url}
                src={url}
                alt={`Preview ${index + 1}`}
                className="size-16 rounded-xl object-cover ring-1 ring-stone-200"
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={handleUpload} isLoading={busy === 'add'}>
              Upload now
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked([])} disabled={busy !== null}>
              Start over
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
      </div>
    </section>
  );
}
