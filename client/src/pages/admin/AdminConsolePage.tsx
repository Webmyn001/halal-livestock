import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/common/Alert';
import { Button, Spinner } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Textarea } from '../../components/common/Textarea';
import { ApiRequestError } from '../../services/apiClient';
import { adminService, type ComplaintWithContact, type KycQueueEntry } from '../../services/adminService';
import type { AdminCounts, Dispute, Order, PlatformInfo, Settlement } from '../../types';
import { CATEGORY_LABELS, STATUS_LABELS as COMPLAINT_STATUS_LABELS } from '../../utils/complaintMeta';
import { formatDate, formatDateTime, formatNaira } from '../../utils/format';
import { UNIT_LABELS } from '../../utils/listingMeta';
import {
  DISPUTE_REASON_LABELS,
  KYC_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  orderStatusStyle,
  settlementStatusLabel,
  disputeStatusLabel,
} from '../../utils/orderMeta';

const TABS = ['Overview', 'Orders', 'Payouts', 'Cases', 'Farms', 'Complaints', 'Settings'] as const;
type Tab = (typeof TABS)[number];

export function AdminConsolePage() {
  const [tab, setTab] = useState<Tab>('Overview');

  return (
    <div className="page-shell py-10 sm:py-12">
      <header>
        <p className="eyebrow">Staff only</p>
        <h1 className="mt-2 text-2xl font-bold text-ink-900 sm:text-3xl">Admin console</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
          Every payout, every case and every verification decision runs through here. Money never moves on a timer, only
          on a ruling recorded by a person.
        </p>
      </header>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Admin sections">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              tab === name ? 'bg-brand-900 text-white' : 'bg-white text-ink-700 ring-1 ring-inset ring-stone-200 hover:ring-brand-300'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-7">
        {tab === 'Overview' ? <OverviewTab /> : null}
        {tab === 'Orders' ? <OrdersTab /> : null}
        {tab === 'Payouts' ? <PayoutsTab /> : null}
        {tab === 'Cases' ? <CasesTab /> : null}
        {tab === 'Farms' ? <FarmsTab /> : null}
        {tab === 'Complaints' ? <ComplaintsTab /> : null}
        {tab === 'Settings' ? <SettingsTab /> : null}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid place-items-center py-16 text-brand-600">
      <Spinner className="size-8" />
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <Alert tone="error" title="We could not open this">
      {message}
    </Alert>
  );
}

function OverviewTab() {
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminService
      .counts()
      .then((data) => !cancelled && setCounts(data))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiRequestError ? err.message : 'No numbers to show.'));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <LoadError message={error} />;
  if (!counts) return <Loading />;

  const ordersPlaced = Object.values(counts.orders).reduce((sum, value) => sum + value, 0);

  const tiles = [
    { label: 'Buyers', value: String(counts.buyers) },
    { label: 'Farmers', value: String(counts.farmers) },
    { label: 'Drivers', value: String(counts.drivers) },
    { label: 'Live listings', value: String(counts.activeListings) },
    { label: 'Open cases', value: String(counts.openDisputes) },
    { label: 'Verifications waiting', value: String(counts.kycWaiting) },
    { label: 'Complaints open', value: String(counts.openComplaints) },
    { label: 'Orders placed', value: String(ordersPlaced) },
  ];

  return (
    <div className="space-y-7">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-card bg-white px-5 py-4 ring-1 ring-stone-200 shadow-card">
            <dt className="text-xs text-ink-500">{tile.label}</dt>
            <dd className="mt-1 text-2xl font-bold text-ink-900">{tile.value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-card bg-brand-900 p-6 text-brand-100">
        <h2 className="font-display text-lg font-semibold text-white">Money on the platform</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-brand-200">Waiting to be released</dt>
            <dd className="mt-1 text-xl font-bold text-white">{formatNaira(counts.payouts.pendingKobo)}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-200">Held back</dt>
            <dd className="mt-1 text-xl font-bold text-white">{formatNaira(counts.payouts.heldKobo)}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-200">Paid out</dt>
            <dd className="mt-1 text-xl font-bold text-white">{formatNaira(counts.payouts.releasedKobo)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-brand-200">
          Held back means a case is open, or the farm has not finished verification. A payout only moves when it is
          released from the Payouts tab with a transfer reference.
        </p>
      </div>
    </div>
  );
}

function OrdersTab() {
  const [status, setStatus] = useState('');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setOrders(null);
    setError('');
    adminService
      .orders(status || undefined)
      .then(setOrders)
      .catch((err: unknown) => setError(err instanceof ApiRequestError ? err.message : 'No orders to show.'));
  }, [status]);

  useEffect(load, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="block">
          <span className="sr-only">Filter by status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12"
          >
            <option value="">Every status</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" size="sm" onClick={load}>
          Refresh
        </Button>
      </div>

      {error ? <LoadError message={error} /> : !orders ? <Loading /> : orders.length === 0 ? (
        <p className="rounded-card bg-white p-6 text-sm text-ink-500 ring-1 ring-stone-200">
          No order with that status yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center gap-3 rounded-card bg-white p-4 ring-1 ring-stone-200 shadow-card"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-900">{order.snapshot.title}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-500">
                  {order.orderCode} · {order.buyer?.fullName ?? 'Buyer'} to {order.farmer?.fullName ?? 'Farm'} ·{' '}
                  {order.quantity} {UNIT_LABELS[order.snapshot.unit]}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${orderStatusStyle(order.status)}`}>
                {ORDER_STATUS_LABELS[order.status]}
              </span>
              <span className="shrink-0 text-sm font-semibold text-ink-900">{formatNaira(order.totalKobo)}</span>
              <Link to={`/orders/${order.id}`}>
                <Button size="sm" variant="secondary">
                  Open
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PayoutsTab() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<Settlement[] | null>(null);
  const [error, setError] = useState('');
  const [problem, setProblem] = useState('');
  const [references, setReferences] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setRows(null);
    setError('');
    adminService
      .settlements(status || undefined)
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof ApiRequestError ? err.message : 'No payouts to show.'));
  }, [status]);

  useEffect(load, [load]);

  async function release(id: string, event: FormEvent) {
    event.preventDefault();
    const reference = (references[id] ?? '').trim();
    if (reference.length < 4) return;

    setBusyId(id);
    setProblem('');
    try {
      const settlement = await adminService.releaseSettlement(id, reference);
      setRows((current) => (current ?? []).map((row) => (row.id === settlement.id ? settlement : row)));
      setReferences((current) => ({ ...current, [id]: '' }));
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That payout stayed where it was.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {problem ? <Alert tone="error">{problem}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="block">
          <span className="sr-only">Filter payouts</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12"
          >
            <option value="">Every payout</option>
            <option value="pending">Ready to release</option>
            <option value="held">Held back</option>
            <option value="released">Paid out</option>
          </select>
        </label>
        <Button variant="secondary" size="sm" onClick={load}>
          Refresh
        </Button>
      </div>

      {error ? <LoadError message={error} /> : !rows ? <Loading /> : rows.length === 0 ? (
        <p className="rounded-card bg-white p-6 text-sm text-ink-500 ring-1 ring-stone-200">
          Nothing in this pile. A payout record is written the moment a handover is confirmed.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-card bg-white p-4 ring-1 ring-stone-200 shadow-card sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{row.farmerName ?? 'Farm'} · {row.orderCode}</p>
                  <p className="mt-1 text-xs text-ink-500">Created {formatDate(row.createdAt)}</p>
                  {(row.bank ?? row.farmerBank) ? (
                    <p className="mt-1 text-xs text-ink-700">
                      <span className="font-semibold">{row.bank ? 'Paid to' : 'Pay this account'}</span>{' '}
                      {(row.bank ?? row.farmerBank)!.bankName} · {(row.bank ?? row.farmerBank)!.accountName} ·{' '}
                      {(row.bank ?? row.farmerBank)!.accountNumber}
                    </p>
                  ) : null}
                  {row.note ? <p className="mt-1.5 text-xs text-amber-800">{row.note}</p> : null}
                  {row.reference ? (
                    <p className="mt-1.5 text-xs text-ink-500">Transfer reference {row.reference}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink-900">{formatNaira(row.netKobo)}</p>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    {formatNaira(row.grossKobo)} less {formatNaira(row.commissionKobo)}
                  </p>
                  <span className="mt-1.5 inline-flex rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-ink-700 ring-1 ring-inset ring-stone-200">
                    {settlementStatusLabel(row.status)}
                  </span>
                </div>
              </div>

              {row.status !== 'released' ? (
                <form onSubmit={(event) => release(row.id, event)} className="mt-4 flex flex-wrap items-end gap-3">
                  <Input
                    label="Transfer reference"
                    value={references[row.id] ?? ''}
                    onChange={(event) => setReferences((current) => ({ ...current, [row.id]: event.target.value }))}
                    hint="Send the money to the account above first. Nothing is paid automatically — this records the transfer identifier."
                    className="max-w-xs"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={busyId === row.id}
                    disabled={(references[row.id] ?? '').trim().length < 4}
                  >
                    Mark as paid out
                  </Button>
                  <Link to={`/orders/${row.orderId}`} className="self-center">
                    <Button size="sm" variant="ghost" type="button">
                      The order
                    </Button>
                  </Link>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CasesTab() {
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState<Dispute[] | null>(null);
  const [error, setError] = useState('');
  const [problem, setProblem] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setRows(null);
    setError('');
    adminService
      .disputes(status || undefined)
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof ApiRequestError ? err.message : 'No cases to show.'));
  }, [status]);

  useEffect(load, [load]);

  async function rule(id: string, outcome: 'refund' | 'release') {
    const note = (notes[id] ?? '').trim();
    if (note.length < 10) {
      setProblem('Write the reasoning first. Both sides read it.');
      return;
    }
    setBusyId(id);
    setProblem('');
    try {
      const dispute = await adminService.ruleDispute(id, outcome, note);
      setRows((current) => (current ?? []).map((row) => (row.id === dispute.id ? dispute : row)));
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That ruling was not recorded.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {problem ? <Alert tone="error">{problem}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="block">
          <span className="sr-only">Filter cases</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12"
          >
            <option value="">Every case</option>
            <option value="open">Open</option>
            <option value="in_review">Being reviewed</option>
            <option value="refund_agreed">Refunded</option>
            <option value="release_agreed">Released</option>
            <option value="rejected">Closed</option>
          </select>
        </label>
        <Button variant="secondary" size="sm" onClick={load}>
          Refresh
        </Button>
      </div>

      {error ? <LoadError message={error} /> : !rows ? <Loading /> : rows.length === 0 ? (
        <p className="rounded-card bg-white p-6 text-sm text-ink-500 ring-1 ring-stone-200">
          No case in this state. Open cases freeze the payout on the order until you rule.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-card bg-white p-5 ring-1 ring-stone-200 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{DISPUTE_REASON_LABELS[row.reason]}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {row.orderCode} · on {formatNaira(row.orderTotalKobo ?? 0)} · opened by{' '}
                    {row.openedByRole === 'buyer' ? 'the buyer' : 'the farm'} · {formatDateTime(row.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold text-ink-700 ring-1 ring-inset ring-stone-200">
                  {disputeStatusLabel(row.status)}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">{row.description}</p>

              {row.images.length > 0 ? (
                <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {row.images.map((image) => (
                    <li key={image.url} className="aspect-square overflow-hidden rounded-lg bg-stone-100">
                      <img src={image.url} alt="Evidence" loading="lazy" className="size-full object-cover" />
                    </li>
                  ))}
                </ul>
              ) : null}

              {row.resolutionNote ? (
                <p className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-xs leading-relaxed text-ink-700 ring-1 ring-inset ring-stone-200">
                  Ruling on file: {row.resolutionNote}
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  <Textarea
                    label="Ruling for both sides"
                    rows={3}
                    value={notes[row.id] ?? ''}
                    onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                    hint="At least ten characters. What you read, what you decided, and what happens to the money."
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      isLoading={busyId === row.id}
                      onClick={() => rule(row.id, 'refund')}
                    >
                      Refund the buyer
                    </Button>
                    <Button size="sm" variant="secondary" isLoading={busyId === row.id} onClick={() => rule(row.id, 'release')}>
                      Release to the farm
                    </Button>
                    <Link to={`/orders/${row.orderId}`}>
                      <Button size="sm" variant="ghost" type="button">
                        Read the messages
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FarmsTab() {
  const [status, setStatus] = useState('submitted');
  const [rows, setRows] = useState<KycQueueEntry[] | null>(null);
  const [error, setError] = useState('');
  const [problem, setProblem] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setRows(null);
    setError('');
    adminService
      .kycQueue(status)
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof ApiRequestError ? err.message : 'No farms to show.'));
  }, [status]);

  useEffect(load, [load]);

  async function decide(id: string, decision: 'approved' | 'rejected') {
    const note = (notes[id] ?? '').trim();
    if (note.length < 5) {
      setProblem('Add a short note. The farmer reads it.');
      return;
    }
    setBusyId(id);
    setProblem('');
    try {
      await adminService.reviewKyc(id, decision, note);
      setRows((current) => (current ?? []).filter((row) => row.id !== id));
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That decision was not saved.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {problem ? <Alert tone="error">{problem}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="block">
          <span className="sr-only">Filter verifications</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12"
          >
            {(['submitted', 'approved', 'rejected', 'none'] as const).map((value) => (
              <option key={value} value={value}>
                {KYC_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" size="sm" onClick={load}>
          Refresh
        </Button>
      </div>

      {error ? <LoadError message={error} /> : !rows ? <Loading /> : rows.length === 0 ? (
        <p className="rounded-card bg-white p-6 text-sm text-ink-500 ring-1 ring-stone-200">
          Nobody in this queue.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-card bg-white p-5 ring-1 ring-stone-200 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{row.profile?.farmName ?? row.fullName}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {row.fullName} · {row.email} · {row.phoneNumber}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {row.isEmailVerified ? 'Email confirmed' : 'Email not confirmed'} ·{' '}
                    {row.isPhoneVerified ? 'Phone confirmed' : 'Phone not confirmed'}
                  </p>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold text-ink-700 ring-1 ring-inset ring-stone-200">
                  {KYC_STATUS_LABELS[row.profile?.status ?? 'none']}
                </span>
              </div>

              <dl className="mt-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                <Line label="Address" value={`${row.profile?.address ?? ''}, ${row.profile?.town ?? ''}`} />
                <Line label="State" value={row.profile?.state ?? ''} />
                <Line label="ID" value={`${row.profile?.idType ?? ''} ${row.profile?.idNumber ?? ''}`} />
                <Line label="CAC" value={row.profile?.cacNumber ?? 'None'} />
                <Line label="Bank" value={row.profile?.bankName ?? ''} />
                <Line label="Account name" value={row.profile?.accountName ?? ''} />
                <Line label="Account number" value={row.profile?.accountNumber ?? ''} />
                <Line label="Business" value={row.profile?.businessName ?? 'None'} />
              </dl>

              {row.profile?.documentUrl ? (
                <a
                  href={row.profile.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block text-xs font-semibold text-brand-700 underline"
                >
                  Open the identity document
                </a>
              ) : (
                <p className="mt-3 text-xs text-amber-800">
                  No document photo was attached. You can still approve the details or ask for one in the note.
                </p>
              )}

              {row.profile?.status === 'submitted' ? (
                <div className="mt-4 space-y-3">
                  <Input
                    label="Note to the farmer"
                    value={notes[row.id] ?? ''}
                    onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                    hint="What you checked, and what they must fix if you are rejecting this."
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" isLoading={busyId === row.id} onClick={() => decide(row.id, 'approved')}>
                      Approve the farm
                    </Button>
                    <Button size="sm" variant="danger" isLoading={busyId === row.id} onClick={() => decide(row.id, 'rejected')}>
                      Send it back
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs text-ink-500">
                  {row.profile?.reviewNote ? `Last note: ${row.profile.reviewNote}` : 'Decision already recorded.'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-stone-100 pb-1">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-ink-900">{value || 'Not given'}</dd>
    </div>
  );
}

function ComplaintsTab() {
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState<ComplaintWithContact[] | null>(null);
  const [error, setError] = useState('');
  const [problem, setProblem] = useState('');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setRows(null);
    setError('');
    adminService
      .complaints(status)
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof ApiRequestError ? err.message : 'No complaints to show.'));
  }, [status]);

  useEffect(load, [load]);

  async function review(id: string, next: 'under_review' | 'resolved' | 'closed') {
    const response = (responses[id] ?? '').trim();
    if (response.length < 5) {
      setProblem('Write a short reply first.');
      return;
    }
    setBusyId(id);
    setProblem('');
    try {
      await adminService.reviewComplaint(id, next, response);
      setRows((current) => (current ?? []).filter((row) => row.id !== id));
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That reply was not saved.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {problem ? <Alert tone="error">{problem}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="block">
          <span className="sr-only">Filter complaints</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12"
          >
            <option value="open">Open</option>
            <option value="under_review">Being reviewed</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <Button variant="secondary" size="sm" onClick={load}>
          Refresh
        </Button>
      </div>

      {error ? <LoadError message={error} /> : !rows ? <Loading /> : rows.length === 0 ? (
        <p className="rounded-card bg-white p-6 text-sm text-ink-500 ring-1 ring-stone-200">
          Nothing waiting in this pile.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-card bg-white p-5 ring-1 ring-stone-200 shadow-card">
              <p className="text-sm font-semibold text-ink-900">{CATEGORY_LABELS[row.category]}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {row.reporterName ?? 'Anonymous'} · {row.reporterEmail}
                {row.reporterPhone ? ` · ${row.reporterPhone}` : ''} · {formatDateTime(row.createdAt)}
              </p>
              {row.orderReference ? <p className="mt-1 text-xs text-ink-500">Order {row.orderReference}</p> : null}
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">{row.message}</p>

              <div className="mt-4 space-y-3">
                <Textarea
                  label="Reply"
                  rows={2}
                  value={responses[row.id] ?? ''}
                  onChange={(event) => setResponses((current) => ({ ...current, [row.id]: event.target.value }))}
                  hint="The sender gets this by email."
                />
                <div className="flex flex-wrap gap-2">
                  {(['under_review', 'resolved', 'closed'] as const).map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant={next === 'under_review' ? 'secondary' : 'ghost'}
                      isLoading={busyId === row.id}
                      onClick={() => review(row.id, next)}
                    >
                      Mark {COMPLAINT_STATUS_LABELS[next]}
                    </Button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState<PlatformInfo | null>(null);
  const [error, setError] = useState('');
  const [problem, setProblem] = useState('');
  const [saved, setSaved] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminService
      .settings()
      .then((data) => !cancelled && setSettings(data))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiRequestError ? err.message : 'No settings to show.'));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setIsBusy(true);
    setProblem('');
    setSaved(false);
    try {
      setSettings(await adminService.saveSettings(settings));
      setSaved(true);
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That change was not saved.');
    } finally {
      setIsBusy(false);
    }
  }

  if (error) return <LoadError message={error} />;
  if (!settings) return <Loading />;

  return (
    <form onSubmit={handleSave} className="max-w-2xl space-y-5 rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink-900">Platform settings</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
          These apply to every order created after you save. Orders already on the ledger keep the rate written on them.
        </p>
      </div>

      {problem ? <Alert tone="error">{problem}</Alert> : null}
      {saved ? <Alert tone="success">Settings saved.</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Commission in basis points"
          value={String(settings.commissionBps)}
          onChange={(event) => setSettings({ ...settings, commissionBps: Number(event.target.value.replace(/\D/g, '')) || 0 })}
          inputMode="numeric"
          hint={`${(settings.commissionBps / 100).toFixed(2)} percent taken from each completed order.`}
        />
        <Input
          label="Dispute window in days"
          value={String(settings.disputeWindowDays)}
          onChange={(event) => setSettings({ ...settings, disputeWindowDays: Number(event.target.value.replace(/\D/g, '')) || 0 })}
          inputMode="numeric"
          hint="How long a buyer has after handover to open a case."
        />
        <Input
          label="Support email"
          value={settings.supportEmail}
          onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })}
        />
        <Input
          label="Support phone"
          value={settings.supportPhone}
          onChange={(event) => setSettings({ ...settings, supportPhone: event.target.value })}
        />
      </div>

      <Textarea
        label="Notice shown to buyers at checkout (optional)"
        rows={2}
        value={settings.maintenanceNote ?? ''}
        onChange={(event) => setSettings({ ...settings, maintenanceNote: event.target.value })}
      />

      <label className="flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3.5 ring-1 ring-inset ring-stone-200">
        <input
          type="checkbox"
          checked={settings.paymentsOpen}
          onChange={(event) => setSettings({ ...settings, paymentsOpen: event.target.checked })}
          className="size-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm text-ink-700">
          Payments are open
          <span className="block text-xs text-ink-500">
            Switch this off to stop new checkouts while you fix something, without taking listings down.
          </span>
        </span>
      </label>

      <Button type="submit" isLoading={isBusy}>
        Save settings
      </Button>
    </form>
  );
}
