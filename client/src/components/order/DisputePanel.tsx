import { useEffect, useState, type FormEvent } from 'react';
import { Alert } from '../common/Alert';
import { Button, Spinner } from '../common/Button';
import { Textarea } from '../common/Textarea';
import { PhotoPicker } from '../marketplace/PhotoPicker';
import { ApiRequestError } from '../../services/apiClient';
import { disputeService } from '../../services/disputeService';
import { DISPUTE_REASONS, type Dispute, type DisputeReason } from '../../types';
import { formatDateTime, formatNaira } from '../../utils/format';
import { DISPUTE_REASON_LABELS, disputeStatusLabel } from '../../utils/orderMeta';

interface DisputePanelProps {
  orderId: string;
  orderCode: string;
  totalKobo: number;
  /** A case can only be opened once the money is held or the livestock has arrived. */
  canOpen: boolean;
  /** Whether the viewer is the buyer (affects wording). */
  isBuyer?: boolean;
  /** Pre-select a dispute reason. */
  defaultReason?: DisputeReason;
  /** Compact mode — hides the intro paragraph and auto-opens the form. */
  compact?: boolean;
  onChanged?: () => void;
}

export function DisputePanel({ orderId, orderCode, totalKobo, canOpen, isBuyer = false, defaultReason, compact = false, onChanged }: DisputePanelProps) {
  const [dispute, setDispute] = useState<Dispute | null | 'loading'>('loading');
  const [isFormOpen, setIsFormOpen] = useState(compact);
  const [reason, setReason] = useState<DisputeReason>(defaultReason ?? 'not_as_described');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<'create' | 'evidence' | 'remove' | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let cancelled = false;
    disputeService
      .mine()
      .then((all) => {
        if (!cancelled) setDispute(all.find((entry) => entry.orderId === orderId) ?? null);
      })
      .catch(() => {
        if (!cancelled) setDispute(null);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setProblem('');
    setBusy('create');
    try {
      setDispute(await disputeService.create({ orderId, reason, description }, files));
      setIsFormOpen(false);
      setDescription('');
      setFiles([]);
      onChanged?.();
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That case could not be opened.');
    } finally {
      setBusy(null);
    }
  }

  async function handleEvidence(event: FormEvent) {
    event.preventDefault();
    if (!dispute || dispute === 'loading' || files.length === 0) return;
    setProblem('');
    setBusy('evidence');
    try {
      setDispute(await disputeService.addEvidence(dispute.id, files));
      setFiles([]);
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'Those photos did not attach.');
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(publicId: string) {
    if (!dispute || dispute === 'loading') return;
    setProblem('');
    setBusy('remove');
    try {
      setDispute(await disputeService.removeEvidence(dispute.id, publicId));
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That photo is still part of the case.');
    } finally {
      setBusy(null);
    }
  }

  if (dispute === 'loading') {
    return (
      <div className="grid place-items-center py-6 text-brand-600">
        <Spinner className="size-6" />
      </div>
    );
  }

  const open = dispute !== null;
  const settled = dispute?.status === 'refund_agreed' || dispute?.status === 'release_agreed' || dispute?.status === 'rejected';

  return (
    <div className="space-y-4">
      {problem ? <Alert tone="error">{problem}</Alert> : null}

      {open && dispute ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-stone-50 px-4 py-3.5 ring-1 ring-inset ring-stone-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink-900">{DISPUTE_REASON_LABELS[dispute.reason]}</p>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-stone-200">
                {disputeStatusLabel(dispute.status)}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Opened by {dispute.openedByRole === 'buyer' ? 'the buyer' : 'the farm'} on {formatDateTime(dispute.createdAt)}
            </p>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">{dispute.description}</p>
          </div>

          {dispute.images.length > 0 ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {dispute.images.map((image) => (
                <li key={image.url} className="relative aspect-square overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200">
                  <img src={image.url} alt="Evidence photo" loading="lazy" className="size-full object-cover" />
                  {image.publicId ? (
                    <button
                      type="button"
                      onClick={() => handleRemove(image.publicId!)}
                      disabled={busy !== null || settled}
                      aria-label="Remove this evidence photo"
                      className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white/90 text-xs font-bold text-ink-700 shadow transition hover:bg-white hover:text-red-700 disabled:opacity-50"
                    >
                      &times;
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {dispute.resolutionNote ? (
            <Alert tone="info" title="Decision from the admin">
              {dispute.resolutionNote}
            </Alert>
          ) : (
            <p className="text-xs leading-relaxed text-ink-500">
              Your report on order {orderCode} for {formatNaira(totalKobo)} is under review. Your money stays safe with the platform while this is open. The admin will investigate and decide.
            </p>
          )}

          {!settled ? (
            <form onSubmit={handleEvidence} className="space-y-4">
              <PhotoPicker files={files} onChange={setFiles} error={undefined} />
              <Button type="submit" variant="secondary" isLoading={busy === 'evidence'} disabled={files.length === 0}>
                Add these photos to the case
              </Button>
            </form>
          ) : null}
        </div>
      ) : canOpen ? (
        isFormOpen ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-500">
              Say what went wrong and attach a photo of what you received. A case without a photo cannot be judged, so it
              will not be accepted.
            </p>
            <label className="block">
              <span className="block text-sm font-medium text-ink-700">What went wrong</span>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value as DisputeReason)}
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-ink-900 shadow-sm transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12"
              >
                {DISPUTE_REASONS.map((value) => (
                  <option key={value} value={value}>
                    {DISPUTE_REASON_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <Textarea
              label="What happened"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              hint="At least a sentence. Weights, counts, and the time the livestock arrived."
            />
            <PhotoPicker files={files} onChange={setFiles} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" isLoading={busy === 'create'} disabled={files.length === 0 || description.trim().length < 20}>
                Open the case
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-ink-500">
              {isBuyer
                ? "Didn't receive what you paid for? Report it and the admin will investigate. Your money stays safe."
                : 'Something wrong with this order? Report it and an admin will review.'}
            </p>
            <Button variant="secondary" onClick={() => setIsFormOpen(true)}>
              Report a problem
            </Button>
          </div>
        )
      ) : (
        <p className="text-sm leading-relaxed text-ink-500">
          A case can be opened from the moment the payment is held until the payout is made. If that window has passed,
          message the other side here or contact the admin.
        </p>
      )}
    </div>
  );
}
