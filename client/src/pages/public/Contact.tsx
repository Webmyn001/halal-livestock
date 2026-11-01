import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FaEnvelope, FaPhone } from 'react-icons/fa6';
import { Alert } from '../../components/common/Alert';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Textarea } from '../../components/common/Textarea';
import { useAuth } from '../../hooks/useAuth';
import { ApiRequestError } from '../../services/apiClient';
import { supportService } from '../../services/supportService';
import { CATEGORY_LABELS } from '../../utils/complaintMeta';
import { COMPLAINT_CATEGORIES, type ComplaintCategory, type ComplaintPayload } from '../../types';

const CONTACT_EMAIL = 'hello@halallivestocks.ng';
const CONTACT_PHONE = '+234 803 000 0000';

const EXPECTATIONS = [
  'A person on the support team reads every report, not an auto reply.',
  'We answer within one working day, and sooner when animals are at risk.',
  'If money or a delivery is involved, the order is held until it is settled.',
];

export function ContactPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState<ComplaintCategory>('listing_quality');
  const [message, setMessage] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [reporterName, setReporterName] = useState(user?.fullName ?? '');
  const [reporterEmail, setReporterEmail] = useState(user?.email ?? '');
  const [reporterPhone, setReporterPhone] = useState(user?.phoneNumber ?? '');
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setTicket(null);
    setIsSending(true);

    const payload: ComplaintPayload = {
      category,
      message,
      orderReference: orderReference.trim() || undefined,
      ...(!user && {
        reporterName: reporterName.trim() || undefined,
        reporterEmail: reporterEmail.trim() || undefined,
        reporterPhone: reporterPhone.trim() || undefined,
      }),
    };

    try {
      const complaint = await supportService.submit(payload);
      setTicket(complaint.id);
      setMessage('');
      setOrderReference('');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not send your report', 'UNKNOWN'));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div>
      <section className="border-b border-stone-200 bg-stone-50">
        <div className="page-shell py-12 sm:py-16">
          <p className="eyebrow">Talk to the team</p>
          <h1 className="mt-3 max-w-2xl text-balance text-3xl font-bold text-ink-900 sm:text-4xl">
            Contact the admin and log a complaint
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-500">
            Something went wrong with a listing, a payment or a delivery. Tell us what happened and we will put it in
            front of the team that handles it.
          </p>
        </div>
      </section>

      <div className="page-shell grid gap-10 py-14 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-9">
          {ticket ? (
            <Alert tone="success" title="Your report is with us">
              Reference {ticket.slice(-6).toUpperCase()}. We will reply to {user?.email || reporterEmail || CONTACT_EMAIL}.
            </Alert>
          ) : null}
          {error ? (
            <Alert tone="error" title="We could not send that">
              {error.errorFor('message') ?? error.message}
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className={ticket ? 'mt-8' : ''}>
            <fieldset>
              <legend className="text-sm font-medium text-ink-700">What is your report about</legend>
              <div role="radiogroup" aria-label="Report topic" className="mt-3 flex flex-wrap gap-2">
                {COMPLAINT_CATEGORIES.map((value) => {
                  const selected = value === category;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setCategory(value)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        selected
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-stone-100 text-ink-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-200'
                      }`}
                    >
                      {CATEGORY_LABELS[value]}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-7 space-y-5">
              <Textarea
                label="What happened"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={7}
                maxLength={2000}
                required
                error={error?.errorFor('message')}
                hint={`${message.trim().length} of 2000 characters. Two or three sentences are usually enough.`}
                placeholder="Tell us the animal, the town, the date and what you expected versus what happened."
              />

              <Input
                label="Order number"
                value={orderReference}
                onChange={(event) => setOrderReference(event.target.value)}
                error={error?.errorFor('orderReference')}
                hint="Optional. Leave blank if the order has not started yet."
                placeholder="HL 2026 89412"
              />

              {!user ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Input
                    label="Your name"
                    value={reporterName}
                    onChange={(event) => setReporterName(event.target.value)}
                    error={error?.errorFor('reporterName')}
                    autoComplete="name"
                  />
                  <Input
                    label="Email for the reply"
                    type="email"
                    value={reporterEmail}
                    onChange={(event) => setReporterEmail(event.target.value)}
                    error={error?.errorFor('reporterEmail')}
                    autoComplete="email"
                  />
                  <Input
                    label="Phone number"
                    value={reporterPhone}
                    onChange={(event) => setReporterPhone(event.target.value)}
                    error={error?.errorFor('reporterPhone')}
                    hint="Optional, but faster when we need to call."
                    autoComplete="tel"
                    placeholder="08031234567"
                    className="sm:col-span-2"
                  />
                  <p className="text-xs leading-relaxed text-ink-500 sm:col-span-2">
                    You can send a report without an account.{' '}
                    <Link to="/login" className="font-medium text-brand-700 underline underline-offset-2">
                      Sign in
                    </Link>{' '}
                    instead and we will attach it to your profile so you can follow it later.
                  </p>
                </div>
              ) : (
                <p className="text-xs leading-relaxed text-ink-500">
                  This report will be saved against {user.email} so you can follow it from your dashboard.
                </p>
              )}

              <div className="pt-1">
                <Button type="submit" size="lg" isLoading={isSending}>
                  Send report
                </Button>
              </div>
            </div>
          </form>
        </div>

        <aside className="space-y-6">
          <div className="rounded-card bg-brand-900 p-7 text-brand-100">
            <h2 className="font-display text-lg font-semibold text-white">What happens next</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed">
              {EXPECTATIONS.map((line) => (
                <li key={line} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-300" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-card bg-white p-7 ring-1 ring-stone-200 shadow-card">
            <h2 className="font-display text-base font-semibold text-ink-900">Reach us directly</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-2.5 text-ink-700 hover:text-brand-700">
                  <FaEnvelope aria-hidden="true" className="size-3.5 shrink-0 text-brand-600" />
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="inline-flex items-center gap-2.5 text-ink-700 hover:text-brand-700">
                  <FaPhone aria-hidden="true" className="size-3.5 shrink-0 text-brand-600" />
                  {CONTACT_PHONE}
                </a>
              </li>
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-ink-500">
              Support hours are Monday to Saturday, 8 in the morning to 6 in the evening, West Africa time.
            </p>
          </div>

          <div className="overflow-hidden rounded-card ring-1 ring-stone-200 shadow-card">
            <img
              src="/images/market.jpg"
              alt="Sheep tied to wooden pens at a livestock market in Kaduna"
              loading="lazy"
              width="1200"
              height="800"
              className="size-full object-cover"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
