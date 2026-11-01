import { Link } from 'react-router-dom';
import { Alert } from '../../components/common/Alert';
import { Button } from '../../components/common/Button';

const STEPS = [
  {
    title: 'Register and browse',
    body: 'Buyers and farmers join for free. Listings keep live animals separate from slaughtered, dressed, chilled, frozen and packaged products.',
  },
  {
    title: 'Pay through the platform',
    body: 'Checkout runs on Paystack. Your payment is received and safely held by Halal Livestocks under Buyer Protection terms until you inspect the delivery.',
  },
  {
    title: 'Inspect, then release',
    body: 'At handover you give the driver your six digit confirmation code. Only then does the order complete and the farmer earn a payout.',
  },
  {
    title: 'Raise a dispute if something is wrong',
    body: 'Death in transit, wrong animal, short quantity or no delivery at all can be disputed with photo evidence inside the 24 hour window. The payout stays locked while an admin reviews it.',
  },
];

const HALAL_RULES = [
  'Processed listings must name the slaughterer, the date and the place of slaughter.',
  'A seller cannot mix live stock and dressed meat in one listing.',
  'Farmers who fail the identity check keep the unverified label and lose access to the verified badge.',
];

export function HowItWorksPage() {
  return (
    <div className="page-shell py-16 sm:py-20">
      <p className="eyebrow">Buyer protection</p>
      <h1 className="mt-2 max-w-3xl text-balance text-4xl font-bold text-ink-900">
        How Halal Livestocks keeps both sides honest
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-500">
        The livestock trade runs on trust that is easy to claim and hard to prove. We put the proof in the process.
      </p>

      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {STEPS.map((step, index) => (
          <div key={step.title} className="rounded-card bg-white p-7 ring-1 ring-stone-200 shadow-card">
            <span className="grid size-10 place-items-center rounded-full bg-brand-600 font-display text-lg font-semibold text-white">
              {index + 1}
            </span>
            <h2 className="mt-5 text-lg font-semibold text-ink-900">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">{step.body}</p>
          </div>
        ))}
      </div>

      <section className="mt-14 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold text-ink-900">What we insist on for halal claims</h2>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-ink-700">
            {HALAL_RULES.map((rule) => (
              <li key={rule} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-500" />
                {rule}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-5">
          <h2 className="text-2xl font-bold text-ink-900">How a held payment works</h2>
          <Alert tone="info" title="Read this before you move money">
            Halal Livestocks is a marketplace operator. Payments are collected to our merchant account and released to
            farmers from an internal settlement ledger after delivery is confirmed or the dispute window closes.
            Refunds go back through Paystack.
          </Alert>
          <Link to="/register">
            <Button size="lg">Create a free account</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
