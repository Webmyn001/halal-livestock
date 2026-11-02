import { AccountPanel } from '../../components/dashboard/AccountPanel';
import { Checklist } from '../../components/dashboard/Checklist';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { ImageTiles, type ImageTile } from '../../components/dashboard/ImageTiles';
import { RecentOrders } from '../../components/dashboard/RecentOrders';
import { ReportsCard } from '../../components/dashboard/ReportsCard';
import { VerificationCard } from '../../components/dashboard/VerificationCard';
import { useAuth } from '../../hooks/useAuth';

const TILES: ImageTile[] = [
  {
    to: '/marketplace',
    title: 'Browse the marketplace',
    body: 'Sheep, poultry and rabbit from farms around Ibadan.',
    image: '/images/market.jpg',
    alt: 'Sheep tied to wooden pens at a livestock market',
  },
  {
    to: '/orders',
    title: 'My orders',
    body: 'Payment state, the driver, and your collection code in one place.',
    image: '/images/poultry.jpg',
    alt: 'Broiler chickens inside a poultry house',
  },
  {
    to: '/how-it-works',
    title: 'How an order runs',
    body: 'Pay, inspect, then release with your code.',
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
        caption="Order from any listing and the money stays with the platform until you hand your collection code to the driver."
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
          <RecentOrders perspective="buyer" />

          <ImageTiles heading="Where to start" tiles={TILES} />

          <VerificationCard />

          <Checklist
            title="Get ready to order"
            caption="Both confirmations finish today and cost nothing."
            items={[
              {
                label: 'Confirm your email address',
                done: user.isEmailVerified,
                note: 'Your collection code and every receipt go here.',
              },
              {
                label: 'Confirm your phone number',
                done: user.isPhoneVerified,
                note: 'A driver calls this number when they reach you.',
              },
              {
                label: 'Keep the collection code private',
                done: false,
                note: 'Read it to the driver only after you have checked the animals.',
              },
              {
                label: 'Open a case in time if something is wrong',
                done: false,
                note: 'The window is counted from the handover and set by the review team.',
              },
            ]}
          />

          <ReportsCard />
        </div>

        <AccountPanel />
      </div>
    </div>
  );
}
