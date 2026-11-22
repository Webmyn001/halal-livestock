import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { dashboardPath } from '../../components/layout/Navbar';

const HERO_CHIPS = ['No registration fee', 'No listing fee', 'No messaging fee'];

const CATEGORIES = [
  {
    name: 'Sheep',
    image: '/images/sheep.jpg',
    alt: 'A flock of sheep being walked home past rural buildings',
    body: 'Balami, Yankasa and dwarf breeds, sold live or halal processed.',
  },
  {
    name: 'Poultry',
    image: '/images/poultry.jpg',
    alt: 'Broiler chickens inside a well kept poultry house',
    body: 'Broilers, layers and noiler birds by the crate or carton, ready for dispatch.',
  },
  {
    name: 'Rabbit',
    image: '/images/rabbit.jpg',
    alt: 'A doe rabbit resting with her young in a hutch',
    body: 'Growers, does and litters from small stock raisers around Ibadan.',
  },
];

const STEPS = [
  {
    title: 'Choose from verified farmers',
    body: 'Every farmer submits identity, farm and bank details, and an admin approves them before the verified badge appears.',
  },
  {
    title: 'Pay once, safely',
    body: 'You pay through Paystack and we hold the money. The farmer sees the order is funded without ever needing to chase you.',
  },
  {
    title: 'Inspect, then confirm receipt',
    body: 'Once you check and count your animals, simply tap "Received" in the app. That confirmation is what releases the payout to the farmer.',
  },
];

const FARMER_POINTS = [
  'Your price stays yours. Set it per head, per crate or per kilogram.',
  'Get paid after delivery instead of chasing balances for weeks.',
  'Keep the buyer conversation inside the app, with a record of what was agreed.',
];

const BUYER_POINTS = [
  'See the farm, the town and the form of the animal on every listing, live or halal processed.',
  'Compare several farms in one town instead of relying on one middleman.',
  'Raise a dispute with photos if animals arrive injured, short or never.',
];

export function HomePage() {
  const { status, user } = useAuth();
  const accountLink = status === 'authenticated' && user ? dashboardPath(user.role) : '/register';

  return (
    <div>
      <section className="relative isolate overflow-hidden bg-brand-900">
        <img
          src="/images/hero.jpg"
          alt="A herd of sheep and goats sheltered on a farm"
          className="absolute inset-0 size-full object-cover opacity-45"
          width="1600"
          height="1067"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/85 to-brand-900/40" />

        <div className="page-shell relative py-24 sm:py-32">
          <p className="eyebrow text-gold-300">Ibadan, Oyo State, Nigeria</p>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-bold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
            Buy livestock direct from farmers you can actually verify
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-brand-100">
            Rabbits, poultry and sheep, sold live or halal processed. You deal with the farm that raised the animal, and
            the money only moves when the delivery is accepted.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to={accountLink}>
              <Button size="lg" variant="gold">
                {status === 'authenticated' ? 'Go to my dashboard' : 'Create free account'}
              </Button>
            </Link>
            <Link to="/marketplace">
              <Button size="lg" variant="secondary">
                Browse the marketplace
              </Button>
            </Link>
            <Link to="/how-it-works">
              <Button size="lg" variant="ghost" className="text-white hover:bg-white/10">
                See how it works
              </Button>
            </Link>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-100">
            {HERO_CHIPS.map((chip) => (
              <li key={chip} className="flex items-center gap-2">
                <CheckIcon className="size-4 text-gold-300" />
                {chip}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="page-shell py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">What we list</p>
            <h2 className="mt-2 text-3xl font-bold text-ink-900">Three kinds of stock, clearly separated</h2>
          </div>
          <p className="max-w-sm text-sm text-ink-500">
            Live animals and processed products never sit in the same category, so nobody has to guess what they are
            buying.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {CATEGORIES.map((category) => (
            <article
              key={category.name}
              className="group overflow-hidden rounded-card bg-white ring-1 ring-stone-200 shadow-card transition hover:shadow-lift"
            >
              <div className="aspect-[4/3] overflow-hidden bg-stone-100">
                <img
                  src={category.image}
                  alt={category.alt}
                  loading="lazy"
                  width="900"
                  height="675"
                  className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-ink-900">{category.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{category.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-stone-200 bg-stone-50 py-20">
        <div className="page-shell">
          <p className="eyebrow">How an order runs</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold text-ink-900">
            The buyer keeps control until the animals are handed over
          </h2>

          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="grid size-10 place-items-center rounded-full bg-brand-600 font-display text-lg font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="page-shell grid items-center gap-12 py-20 lg:grid-cols-2">
        <div className="overflow-hidden rounded-card shadow-lift">
          <img
            src="/images/market.jpg"
            alt="Sheep tied to wooden pens at the Monday livestock market in Kaduna"
            loading="lazy"
            width="1200"
            height="800"
            className="size-full object-cover"
          />
        </div>

        <div className="grid gap-10">
          <div>
            <p className="eyebrow">For farmers</p>
            <h2 className="mt-2 text-2xl font-bold text-ink-900">Sell at the price you set</h2>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink-700">
              {FARMER_POINTS.map((point) => (
                <li key={point} className="flex gap-3">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand-500" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow">For buyers</p>
            <h2 className="mt-2 text-2xl font-bold text-ink-900">Know what you are serving customers</h2>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink-700">
              {BUYER_POINTS.map((point) => (
                <li key={point} className="flex gap-3">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand-500" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="page-shell pb-20">
        <div className="rounded-card bg-brand-900 px-6 py-12 text-center sm:px-12">
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold text-white">
            We only earn when an order completes
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-brand-100">
            Registration, listings and messages cost nothing. The platform keeps one commission on completed orders, and
            the rate is published in your dashboard.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={accountLink}>
              <Button size="lg" variant="gold">
                {status === 'authenticated' ? 'Open my dashboard' : 'Start for free'}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 10.5 8 14.5 16 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
