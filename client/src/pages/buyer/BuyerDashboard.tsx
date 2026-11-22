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
    body: 'Sheep, goats, poultry and rabbit from verified farms around Ibadan.',
    image: '/images/market.jpg',
    alt: 'Sheep tied to wooden pens at a livestock market',
  },
  {
    to: '/orders',
    title: 'My orders',
    body: 'Track each order, chat with the farmer, and confirm receipt when your stock arrives.',
    image: '/images/poultry.jpg',
    alt: 'Broiler chickens inside a poultry house',
  },
  {
    to: '/how-it-works',
    title: 'How an order runs',
    body: 'Pay safely, agree delivery in chat, then confirm receipt to release the farmer\'s payout.',
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
        caption="Order from any listing and the money stays with the platform until you confirm you have received the livestock."
        image="/images/buyer.jpg"
        alt="A trader selling frozen chicken at a market stall"
        aside={[
          { label: 'Account', value: user.isActive ? 'Active' : 'Suspended' },
          { label: 'Email', value: user.isEmailVerified ? 'Confirmed' : 'Not confirmed' },
        ]}
      />

      <div className="page-shell grid gap-8 py-12 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="min-w-0 space-y-9">
          <RecentOrders perspective="buyer" />

          <ImageTiles heading="Where to start" tiles={TILES} />

          <VerificationCard />

          <Checklist
            title="Get ready to order"
            caption="Confirming your email takes under a minute and costs nothing."
            items={[
              {
                label: 'Confirm your email address',
                done: user.isEmailVerified,
                note: 'Every order update and payment receipt goes here.',
              },
              {
                label: 'Agree delivery in the order chat',
                done: false,
                note: 'Open any order and use the built-in chat to fix the time, place and delivery fee with the farmer.',
              },
              {
                label: 'Confirm receipt when your livestock arrives',
                done: false,
                note: 'Tap "Mark as received" on the order page to release the farmer\'s payout. If something is wrong, report it instead.',
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
