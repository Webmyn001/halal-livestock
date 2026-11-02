import { AccountPanel } from '../../components/dashboard/AccountPanel';
import { Checklist } from '../../components/dashboard/Checklist';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { ImageTiles, type ImageTile } from '../../components/dashboard/ImageTiles';
import { MyListings } from '../../components/dashboard/MyListings';
import { ReportsCard } from '../../components/dashboard/ReportsCard';
import { VerificationCard } from '../../components/dashboard/VerificationCard';
import { useAuth } from '../../hooks/useAuth';

const TILES: ImageTile[] = [
  {
    to: '/farmer/post-livestock',
    title: 'Post livestock',
    body: 'One to four photos, a price and a description.',
    image: '/images/sheep.jpg',
    alt: 'A flock of sheep being walked home',
  },
  {
    to: '/marketplace',
    title: 'See what other farms charge',
    body: 'Prices and wording from sellers across Oyo State.',
    image: '/images/market.jpg',
    alt: 'Sheep on sale at a livestock market',
  },
  {
    to: '/contact',
    title: 'Contact the admin',
    body: 'Ask about verification, payouts or a dispute.',
    image: '/images/broilers.jpg',
    alt: 'Young broilers inside a poultry house',
  },
];

export function FarmerDashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      <DashboardHeader
        eyebrow="Farmer account"
        title={`Welcome back, ${user.fullName.split(' ')[0]}`}
        caption="Verification comes first. Once a person checks your ID and your farm, the verified badge and the listing form unlock."
        image="/images/farm.jpg"
        alt="Broilers crowded inside a Nigerian poultry house"
        aside={[
          { label: 'Account', value: user.isActive ? 'Active' : 'Suspended' },
          { label: 'Verification', value: 'Not started' },
          { label: 'Commission', value: '5 to 8 percent' },
        ]}
      />

      <div className="page-shell grid gap-8 py-12 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="min-w-0 space-y-9">
          <ImageTiles heading="Where to start" tiles={TILES} />

          <MyListings />

          <VerificationCard />

          <Checklist
            title="Earn the verified badge"
            caption="A person reviews every submission. Nothing here is charged, and the badge is what buyers filter by."
            items={[
              {
                label: 'Submit an identity document',
                done: false,
                note: 'National ID, voters card, driver licence or passport.',
              },
              {
                label: 'Send photos or video of the farm',
                done: false,
                note: 'Two clear shots of the animals and the pens, taken at your location.',
              },
              {
                label: 'Add a NUBAN account in your own name',
                done: false,
                note: 'Payouts only move to an account that matches your ID.',
              },
              {
                label: 'Association reference',
                done: false,
                note: 'Optional. A membership number and a contact person speed up approval.',
              },
            ]}
          />

          <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
            <h2 className="font-display text-lg font-semibold text-ink-900">What you keep</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Registration, listings and messages cost nothing. The platform keeps a commission of 5 to 8 percent on a
              completed order, so a sale of ₦100,000 at 6.5 percent pays you ₦93,500 once the buyer accepts delivery.
              The rate applied to each order is shown before you confirm it.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Registration', value: 'Free' },
                { label: 'Listing stock', value: 'Free' },
                { label: 'Messages with buyers', value: 'Free' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-inset ring-stone-200">
                  <p className="text-xs text-ink-500">{item.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink-900">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <ReportsCard />
        </div>

        <AccountPanel />
      </div>
    </div>
  );
}
