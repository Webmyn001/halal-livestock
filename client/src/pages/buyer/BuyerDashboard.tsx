import { AccountPanel } from '../../components/dashboard/AccountPanel';
import { Checklist } from '../../components/dashboard/Checklist';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { ImageTiles, type ImageTile } from '../../components/dashboard/ImageTiles';
import { ReportsCard } from '../../components/dashboard/ReportsCard';
import { VerificationCard } from '../../components/dashboard/VerificationCard';
import { useAuth } from '../../hooks/useAuth';

const TILES: ImageTile[] = [
  {
    to: '/',
    title: 'Browse the marketplace',
    body: 'Sheep, poultry and rabbit from farms around Ibadan.',
    image: '/images/market.jpg',
    alt: 'Sheep tied to wooden pens at a livestock market',
  },
  {
    to: '/how-it-works',
    title: 'How an order runs',
    body: 'Reserve, pay, inspect, then release with your code.',
    image: '/images/poultry.jpg',
    alt: 'Broiler chickens inside a poultry house',
  },
  {
    to: '/contact',
    title: 'Contact the admin',
    body: 'Report a listing, a payment or a delivery problem.',
    image: '/images/rabbit.jpg',
    alt: 'A rabbit doe resting with her young',
  },
];

export function BuyerDashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      <DashboardHeader
        eyebrow="Buyer account"
        title={`Welcome back, ${user.fullName.split(' ')[0]}`}
        caption="Your account is open. Checkout, saved farms and messages to farmers switch on with the marketplace build."
        image="/images/buyer.jpg"
        alt="A trader selling frozen chicken at a market stall"
        aside={[
          { label: 'Account', value: user.isActive ? 'Active' : 'Suspended' },
          { label: 'Email', value: user.isEmailVerified ? 'Confirmed' : 'Not confirmed' },
          { label: 'Phone', value: user.isPhoneVerified ? 'Confirmed' : 'Not confirmed' },
        ]}
      />

      <div className="page-shell grid gap-8 py-12 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="min-w-0 space-y-9">
          <ImageTiles heading="Where to start" tiles={TILES} />

          <VerificationCard />

          <Checklist
            title="Get ready to order"
            caption="Two of these finish today. The rest arrive with checkout."
            items={[
              {
                label: 'Confirm your email address',
                done: user.isEmailVerified,
                note: 'Delivery codes and payout receipts go here.',
              },
              {
                label: 'Confirm your phone number',
                done: user.isPhoneVerified,
                note: 'A driver calls this number when they reach you.',
              },
              { label: 'Add a delivery address', done: false, note: 'Opens with checkout.' },
              { label: 'Shortlist the farms you buy from', done: false, note: 'Save any listing with one tap.' },
            ]}
          />

          <ReportsCard />
        </div>

        <AccountPanel />
      </div>
    </div>
  );
}
