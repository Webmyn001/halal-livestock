import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/common/Alert';
import { Button } from '../../components/common/Button';
import { AccountPanel } from '../../components/dashboard/AccountPanel';
import { Checklist } from '../../components/dashboard/Checklist';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { ImageTiles, type ImageTile } from '../../components/dashboard/ImageTiles';
import { MyListings } from '../../components/dashboard/MyListings';
import { RecentOrders } from '../../components/dashboard/RecentOrders';
import { ReportsCard } from '../../components/dashboard/ReportsCard';
import { VerificationCard } from '../../components/dashboard/VerificationCard';
import { useAuth } from '../../hooks/useAuth';
import { platformService } from '../../services/platformService';
import type { PlatformInfo } from '../../types';
import { formatNaira } from '../../utils/format';
import { KYC_STATUS_LABELS } from '../../utils/orderMeta';

const TILES: ImageTile[] = [
  {
    to: '/farmer/post-livestock',
    title: 'Post livestock',
    body: 'One to four photos, a price and a description.',
    image: '/images/sheep.jpg',
    alt: 'A flock of sheep being walked home',
  },
  {
    to: '/farmer/verify-farm',
    title: 'Verify your farm',
    body: 'An ID, a bank account in your own name, and a person reads it.',
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
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    platformService
      .info()
      .then((data) => {
        if (!cancelled) setPlatform(data);
      })
      .catch(() => {
        if (!cancelled) setPlatform(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  const profile = user.farmerProfile ?? null;
  const kycStatus = profile?.status ?? 'none';
  const verified = kycStatus === 'approved';
  const commission = platform ? `${(platform.commissionBps / 100).toFixed(0)} percent` : '5 percent';

  return (
    <div>
      <DashboardHeader
        eyebrow="Farmer account"
        title={`Welcome back, ${user.fullName.split(' ')[0]}`}
        caption="Verification comes first. Once a person checks your ID and your bank details, the verified badge and the payouts unlock."
        image="/images/farm.jpg"
        alt="Broilers crowded inside a Nigerian poultry house"
        aside={[
          { label: 'Account', value: user.isActive ? 'Active' : 'Suspended' },
          { label: 'Verification', value: KYC_STATUS_LABELS[kycStatus] },
          { label: 'Commission', value: commission },
        ]}
      />

      <div className="page-shell grid gap-8 py-12 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="min-w-0 space-y-9">
          <RecentOrders perspective="farmer" />

          <ImageTiles heading="Where to start" tiles={TILES} />

          <MyListings />

          <VerificationCard />

          {!verified ? (
            <Alert tone="info" title="Payouts wait on verification">
              You can post stock today, but a completed order is only paid out to a farm that finished the checks.{' '}
              <Link to="/farmer/verify-farm" className="font-semibold underline">
                Verify your farm
              </Link>
            </Alert>
          ) : null}

          <Checklist
            title="Earn the verified badge"
            caption="A person reviews every submission. Nothing here is charged, and the badge is what buyers filter by."
            items={[
              {
                label: 'Confirm your email address',
                done: user.isEmailVerified,
                note: 'The decision from the review team is sent here.',
              },
              {
                label: 'Confirm your phone number',
                done: user.isPhoneVerified,
                note: 'A driver calls this number when they collect.',
              },
              {
                label: 'Send your ID and bank details',
                done: kycStatus === 'submitted' || verified,
                note: verified ? 'Approved. Buyers see the badge.' : 'One photo of the ID and a NUBAN account in your own name.',
              },
              {
                label: 'Post your first stock',
                done: false,
                note: 'Live animals and halal processed products are listed apart.',
              },
            ]}
          />
          <Link to="/farmer/verify-farm" className="inline-block">
            <Button variant={verified ? 'ghost' : 'primary'}>
              {verified ? 'See the details on file' : 'Verify your farm'}
            </Button>
          </Link>

          <section className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-7">
            <h2 className="font-display text-lg font-semibold text-ink-900">What you keep</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Registration, listings and messages cost nothing. The platform keeps a commission of{' '}
              {commission} on a completed order, so a sale of {formatNaira(10_000_000)} pays you{' '}
              {formatNaira(10_000_000 - Math.floor((10_000_000 * (platform?.commissionBps ?? 500)) / 10_000))} once the
              buyer hands over the code. The rate applied to each order is written on the payout record.
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
