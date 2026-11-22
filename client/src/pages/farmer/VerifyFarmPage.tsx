import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FaCircleCheck, FaPaperclip } from 'react-icons/fa6';
import { Alert } from '../../components/common/Alert';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { ACCEPTED_TYPES } from '../../services/listingService';
import { authService } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../services/apiClient';
import { kycService } from '../../services/kycService';
import type { IdType } from '../../types';
import { formatNaira } from '../../utils/format';
import { BANK_OPTIONS, ID_TYPE_LABELS, KYC_STATUS_LABELS } from '../../utils/orderMeta';

const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;

const ID_TYPES = Object.keys(ID_TYPE_LABELS) as IdType[];

export function VerifyFarmPage() {
  const { user, refresh } = useAuth();

  const [farmName, setFarmName] = useState(user?.farmerProfile?.farmName ?? '');
  const [businessName, setBusinessName] = useState(user?.farmerProfile?.businessName ?? '');
  const [address, setAddress] = useState(user?.farmerProfile?.address ?? '');
  const [town, setTown] = useState(user?.farmerProfile?.town ?? 'Ibadan');
  const [state, setState] = useState(user?.farmerProfile?.state ?? 'Oyo State');
  const [idType, setIdType] = useState<IdType>(user?.farmerProfile?.idType ?? 'nin');
  const [idNumber, setIdNumber] = useState(user?.farmerProfile?.idNumber ?? '');
  const [cacNumber, setCacNumber] = useState(user?.farmerProfile?.cacNumber ?? '');
  const [bankName, setBankName] = useState(user?.farmerProfile?.bankName ?? BANK_OPTIONS[0]!);
  const [accountName, setAccountName] = useState(user?.farmerProfile?.accountName ?? user?.fullName ?? '');
  const [accountNumber, setAccountNumber] = useState(user?.farmerProfile?.accountNumber?.replace(/•/g, '') ?? '');
  const [document, setDocument] = useState<File | null>(null);
  const [documentProblem, setDocumentProblem] = useState('');

  const [error, setError] = useState<ApiRequestError | null>(null);
  const [problem, setProblem] = useState('');
  const [done, setDone] = useState(false);
  const [isBusy, setIsBusy] = useState<'submit' | 'withdraw' | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailProblem, setEmailProblem] = useState('');

  if (!user) return null;

  const accountEmail = user.email;
  const profile = user.farmerProfile ?? null;
  const status = profile?.status ?? 'none';
  // The review team only reads forms from a confirmed address. The API enforces this too.
  const canSubmit = user.isEmailVerified && (status === 'none' || status === 'rejected');

  function chooseDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setDocumentProblem('');
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setDocumentProblem('The document photo has to be a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setDocumentProblem(`That photo is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Take it again in better light or shrink it below 3 MB.`);
      return;
    }
    setDocument(file);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setProblem('');
    setDone(false);
    setIsBusy('submit');
    try {
      await kycService.submit(
        {
          farmName,
          businessName: businessName.trim() || undefined,
          address,
          town,
          state,
          idType,
          idNumber,
          cacNumber: cacNumber.trim() || undefined,
          bankName,
          accountName,
          accountNumber,
        },
        document
      );
      await refresh();
      setDocument(null);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err);
        setProblem(err.fieldErrors.length > 0 ? 'Check the highlighted fields.' : err.message);
      } else {
        setProblem('That submission did not reach us.');
      }
    } finally {
      setIsBusy(null);
    }
  }

  async function handleResendEmail() {
    setEmailProblem('');
    setEmailBusy(true);
    try {
      await authService.resendVerification(accountEmail);
      setEmailSent(true);
    } catch (err) {
      setEmailProblem(err instanceof ApiRequestError ? err.message : 'Could not send the confirmation email.');
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleWithdraw() {
    setError(null);
    setProblem('');
    setIsBusy('withdraw');
    try {
      await kycService.withdrawDocument();
      await refresh();
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'That document is still on your account.');
    } finally {
      setIsBusy(null);
    }
  }

  return (
    <div className="page-shell grid gap-8 py-10 lg:grid-cols-[1.5fr_1fr] lg:items-start sm:py-12">
      <div className="min-w-0 space-y-6">
        <header>
          <p className="eyebrow">Farmer account</p>
          <h1 className="mt-2 text-2xl font-bold text-ink-900 sm:text-3xl">Verify your farm</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-500">
            A person reads every submission. Verification unlocks the badge buyers filter by, and it is the only way a
            payout can reach you.
          </p>
        </header>

        {status === 'approved' ? (
          <Alert tone="success" title="Your farm is verified">
            Buyers see the verified badge on your listings. If the bank details on file are no longer yours, contact the
            admin before the next payout.
          </Alert>
        ) : status === 'submitted' ? (
          <Alert tone="info" title="With the verification team">
            You will get an email the moment a decision is made. Nothing else needs doing right now.
            {profile?.reviewNote ? ` Note from the review: ${profile.reviewNote}` : ''}
          </Alert>
        ) : status === 'rejected' ? (
          <Alert tone="error" title="This needs a fix">
            {profile?.reviewNote ?? 'A reviewer could not confirm the details you sent. Correct them and send it again.'}
          </Alert>
        ) : null}

        {done ? (
          <Alert tone="success" title="Sent">
            Your details are with the review team.
          </Alert>
        ) : null}

        {!user.isEmailVerified ? (
          <Alert tone="info" title="Confirm your email first">
            Open the link we emailed you before you send your farm details. The review team only reads forms from
            confirmed addresses.
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm" variant="secondary" onClick={handleResendEmail} isLoading={emailBusy}>
                {emailSent ? 'Send again' : 'Send the link again'}
              </Button>
              {emailSent ? (
                <span className="text-xs text-ink-500">A new link is on its way. It works once and expires after 24 hours.</span>
              ) : null}
            </div>
            {emailProblem ? <p className="mt-2 text-xs font-medium text-red-600">{emailProblem}</p> : null}
          </Alert>
        ) : null}

        {canSubmit ? (
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7"
          >
            <div className="space-y-1.5">
              <h2 className="font-display text-base font-semibold text-ink-900">The farm</h2>
              <p className="text-xs text-ink-500">This is what buyers see next to your listings.</p>
            </div>

            {problem ? <Alert tone="error">{problem}</Alert> : null}

            <Input
              label="Farm name"
              value={farmName}
              onChange={(event) => setFarmName(event.target.value)}
              error={error?.errorFor('farmName')}
              placeholder="Arewa Poultry and Rabbit Farm"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Business name (optional)"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                error={error?.errorFor('businessName')}
                hint="Leave empty if the farm trades under your own name."
              />
              <Input
                label="CAC number (optional)"
                value={cacNumber}
                onChange={(event) => setCacNumber(event.target.value)}
                error={error?.errorFor('cacNumber')}
              />
            </div>
            <Input
              label="Farm address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              error={error?.errorFor('address')}
              hint="Street, area, and something easy to find."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Town" value={town} onChange={(event) => setTown(event.target.value)} error={error?.errorFor('town')} />
              <Input label="State" value={state} onChange={(event) => setState(event.target.value)} error={error?.errorFor('state')} />
            </div>

            <div className="space-y-1.5 pt-2">
              <h2 className="font-display text-base font-semibold text-ink-900">Your identity</h2>
              <p className="text-xs text-ink-500">The name on the ID has to match the name on the bank account.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="block text-sm font-medium text-ink-700">Document type</span>
                <select
                  value={idType}
                  onChange={(event) => setIdType(event.target.value as IdType)}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12"
                >
                  {ID_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {ID_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="ID number"
                value={idNumber}
                onChange={(event) => setIdNumber(event.target.value)}
                error={error?.errorFor('idNumber')}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-ink-700">Photo of the document</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                One clear shot of the front, under 3 MB. Only the review team sees it, and you can take it back down
                later.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-800 ring-1 ring-inset ring-brand-200 transition hover:bg-brand-50 focus-within:ring-2 focus-within:ring-brand-500">
                  <FaPaperclip aria-hidden="true" className="size-3.5" />
                  {document ? document.name : profile?.documentUrl ? 'Replace the document' : 'Choose the photo'}
                  <input
                    type="file"
                    accept={ACCEPTED_TYPES.join(',')}
                    className="sr-only"
                    onChange={chooseDocument}
                  />
                </label>
                {document ? <span className="text-xs text-ink-500">{(document.size / 1024).toFixed(0)} KB</span> : null}
                {!document && profile?.documentUrl ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                    <FaCircleCheck aria-hidden="true" className="size-3" />
                    A document is already on file
                  </span>
                ) : null}
              </div>
              {documentProblem ? <p role="alert" className="mt-2 text-xs font-medium text-red-600">{documentProblem}</p> : null}
              {error?.errorFor('document') ? (
                <p className="mt-2 text-xs font-medium text-red-600">{error.errorFor('document')}</p>
              ) : null}
            </div>

            <div className="space-y-1.5 pt-2">
              <h2 className="font-display text-base font-semibold text-ink-900">Where the money goes</h2>
              <p className="text-xs text-ink-500">A NUBAN account in your own name. Payouts never go to a third party.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="block text-sm font-medium text-ink-700">Bank</span>
                <select
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12"
                >
                  {BANK_OPTIONS.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Account name"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                error={error?.errorFor('accountName')}
              />
            </div>
            <Input
              label="Account number"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ''))}
              error={error?.errorFor('accountNumber')}
              inputMode="numeric"
              maxLength={11}
              hint="Ten or eleven digits."
              className="max-w-xs font-mono tracking-widest"
            />

            <div className="flex flex-wrap gap-3">
              <Button type="submit" size="lg" isLoading={isBusy === 'submit'}>
                Send for verification
              </Button>
              {status === 'rejected' ? <p className="self-center text-xs text-ink-500">You can correct and send again.</p> : null}
            </div>
          </form>
        ) : null}
      </div>

      <aside className="space-y-6 lg:sticky lg:top-24">
        <div className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card">
          <h2 className="font-display text-base font-semibold text-ink-900">Where you are</h2>
          <p className="mt-3 inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">
            {KYC_STATUS_LABELS[status]}
          </p>
          <dl className="mt-4 space-y-2.5 text-sm">
            <Row label="Email" value={user.isEmailVerified ? 'Confirmed' : 'Not confirmed'} />
            <Row label="Phone" value={`${user.phoneNumber} · checked by the review team`} />
            <Row label="Bank account" value={profile?.accountNumber ?? 'Not added'} />
            <Row label="Document" value={profile?.documentUrl ? 'On file' : 'Not added'} />
          </dl>
          {profile?.documentUrl ? (
            <Button variant="ghost" size="sm" isLoading={isBusy === 'withdraw'} onClick={handleWithdraw}>
              Take the document down
            </Button>
          ) : null}
        </div>

        <div className="rounded-card bg-brand-900 p-6 text-brand-100">
          <h2 className="font-display text-base font-semibold text-white">What verification costs you</h2>
          <p className="mt-3 text-sm leading-relaxed">
            Nothing. Registration, listings and messages stay free. The platform keeps a commission only on a completed
            order, so on {formatNaira(10_000_000)} a sale at 5 percent pays you {formatNaira(9_500_000)}.
          </p>
          <Link to="/how-it-works" className="mt-4 inline-block text-sm font-semibold text-gold-300">
            Read how the money is held
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="min-w-0 truncate font-medium text-ink-900">{value}</dd>
    </div>
  );
}
