import { Link } from 'react-router-dom';
import { Alert } from '../../components/common/Alert';
import { Button } from '../../components/common/Button';

const STEPS = [
  {
    title: 'Browse verified livestock',
    body: 'Explore sheep, goats, poultry, and rabbits from verified farm producers. View clear photos, transparent pricing, and distinct categories for live stock and halal-processed cuts. Any listing currently in progress or sold is tagged boldly so you never order unavailable stock.',
  },
  {
    title: 'Pay securely — funds held in escrow',
    body: 'Checkout securely through Paystack. Your payment is held safely in escrow by Halal Livestocks under our Buyer Protection terms. The farmer sees the order is funded, but funds are never disbursed until you inspect and accept your consignment.',
  },
  {
    title: 'Coordinate delivery in in-app chat',
    body: 'Communicate directly with the farmer in our real-time chat. Agree on delivery timing, destination, and the delivery fee between yourselves. We are currently active in Ibadan, but delivery can extend to other states across Nigeria depending on the delivery terms agreed in chat.',
  },
  {
    title: 'Inspect & tap "Received" — no codes',
    body: 'No cumbersome verification codes needed. Once your stock arrives, inspect and verify the count and condition. When satisfied, simply tap "I received the livestock" on your order page to conclude tracking and disburse the payout to the farmer.',
  },
  {
    title: 'Report issues directly to admin',
    body: 'If your consignment never arrives or differs significantly from what was agreed, tap "I did not receive the livestock" or report the issue. Your payment remains locked and safe with the platform while an Admin investigates fairly. If a refund is approved, order funds are returned to you (less payment gateway transaction and service fees).',
  },
];

const HALAL_RULES = [
  'Live stock and halal-processed cuts are strictly segregated so buyers always know what is being delivered.',
  'Every farmer completes identity and farm verification before receiving our verified seller badge.',
  'Admins actively review all complaints and take down any listing that misrepresents livestock quality or origin.',
  'Buyer funds stay locked in escrow until the customer inspects and confirms the delivery.',
];

export function HowItWorksPage() {
  return (
    <div className="page-shell py-16 sm:py-20">
      <p className="eyebrow">Buyer protection & marketplace guide</p>
      <h1 className="mt-2 max-w-3xl text-balance text-4xl font-bold text-ink-900">
        How Halal Livestocks works
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-500">
        Direct trade between verified farmers and buyers with escrow protection, in-app delivery planning, and guaranteed security.
      </p>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="rounded-card bg-white p-7 ring-1 ring-stone-200 shadow-card flex flex-col justify-between">
            <div>
              <span className="grid size-10 place-items-center rounded-full bg-brand-600 font-display text-lg font-semibold text-white">
                {index + 1}
              </span>
              <h2 className="mt-5 text-lg font-semibold text-ink-900">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{step.body}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="mt-14 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold text-ink-900">Marketplace standards</h2>
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
          <h2 className="text-2xl font-bold text-ink-900">How held payments & refunds work</h2>
          <Alert tone="info" title="Your money stays safe with the platform">
            Payments are collected securely to our platform account and held in escrow. Payouts to farmers only happen after the buyer confirms receipt of the livestock. If an issue is reported, funds remain frozen while the Admin investigates. Approved refunds are credited back via Paystack (payment processing fee and platform service fee are deducted).
          </Alert>
          <div className="pt-2">
            <Link to="/register">
              <Button size="lg">Create a free account</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
