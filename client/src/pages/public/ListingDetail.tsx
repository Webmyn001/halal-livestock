import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  FaArrowLeftLong,
  FaLocationDot,
  FaRegCalendar,
  FaUserCheck,
  FaEye,
  FaShareNodes,
  FaCheck,
} from 'react-icons/fa6';
import { Alert } from '../../components/common/Alert';
import { Button, Spinner } from '../../components/common/Button';
import { OrderPanel } from '../../components/marketplace/OrderPanel';
import { ChatPanel } from '../../components/order/ChatPanel';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { ApiRequestError } from '../../services/apiClient';
import { listingService } from '../../services/listingService';
import type { Listing } from '../../types';
import { formatDate, formatNaira } from '../../utils/format';
import { listingIdFromParam, listingPath, listingShareUrl } from '../../utils/listingUrl';
import { LISTING_TYPE_LABELS, SPECIES_LABELS, UNIT_LABELS } from '../../utils/listingMeta';

const PROTECTION = [
  'Pay on the platform, never by a direct transfer to a personal account.',
  'The money stays with Halal Livestocks until you confirm the livestock arrived as described.',
  'Report a problem inside the dispute window and an admin looks at the photos before any payout.',
];

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-inset ring-stone-200">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}

export function ListingDetailPage() {
  const { id: rawId = '' } = useParams();
  const id = listingIdFromParam(rawId);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [moderation, setModeration] = useState('');
  const [isModerating, setIsModerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const threadParam = new URLSearchParams(location.search).get('thread') ?? undefined;

  useEffect(() => {
    if (threadParam) setChatOpen(true);
  }, [threadParam]);

  useEffect(() => {
    if (!listing) return;
    const canonical = listingPath(listing);
    if (window.location.pathname !== canonical) {
      navigate(canonical, { replace: true });
    }
  }, [listing, navigate]);

  // Set Open Graph & Twitter meta tags for social media previews
  useEffect(() => {
    if (!listing) return;

    document.title = `${listing.title} — ${formatNaira(listing.priceKobo)} | Halal Livestocks`;

    const setMeta = (nameOrProperty: string, content: string) => {
      let tag = document.querySelector(`meta[property="${nameOrProperty}"]`) || document.querySelector(`meta[name="${nameOrProperty}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        if (nameOrProperty.startsWith('og:')) {
          tag.setAttribute('property', nameOrProperty);
        } else {
          tag.setAttribute('name', nameOrProperty);
        }
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    const firstImg = listing.images[0]?.url || `${window.location.origin}/favicon.png`;
    const desc = `${formatNaira(listing.priceKobo)} per ${UNIT_LABELS[listing.unit]} in ${listing.town}, ${listing.state}. ${listing.description.slice(0, 160)}`;

    setMeta('og:type', 'product');
    setMeta('og:site_name', 'Halal Livestocks Marketplace');
    setMeta('og:title', `${listing.title} — ${formatNaira(listing.priceKobo)}`);
    setMeta('og:description', desc);
    setMeta('og:image', firstImg);
    setMeta('og:image:secure_url', firstImg);
    setMeta('og:url', window.location.href);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', `${listing.title} — ${formatNaira(listing.priceKobo)}`);
    setMeta('twitter:description', desc);
    setMeta('twitter:image', firstImg);
  }, [listing]);

  async function handleShare() {
    if (!listing) return;
    const shareUrl = listingShareUrl(listing);
    const shareData = {
      title: `${listing.title} — Halal Livestocks`,
      text: `Check out ${listing.title} on Halal Livestocks Marketplace: ${formatNaira(listing.priceKobo)} per ${UNIT_LABELS[listing.unit]}`,
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Ignore
    }
  }

  async function handleDeleteListing() {
    if (!listing) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${listing.title}"? This cannot be undone.`)) {
      return;
    }
    setIsModerating(true);
    try {
      await listingService.delete(listing.id);
      navigate('/marketplace', { replace: true });
    } catch (err) {
      setModeration(err instanceof ApiRequestError ? err.message : 'Could not delete listing.');
      setIsModerating(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setListing(null);
    setActiveImage(0);

    listingService
      .get(id)
      .then((data) => {
        if (!cancelled) setListing(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err : new ApiRequestError('Could not open that listing', 'UNKNOWN'));
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="page-shell py-16">
        <div className="mx-auto max-w-lg space-y-6">
          <Alert tone="error" title="That listing is not here">
            {error.message}
          </Alert>
          <Link to="/marketplace">
            <Button variant="secondary">
              <FaArrowLeftLong aria-hidden="true" className="size-3.5" />
              Back to the marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-brand-600">
        <Spinner className="size-8" />
      </div>
    );
  }

  const [cover] = listing.images;
  const shown = listing.images[activeImage] ?? cover;
  const isAdmin = user?.role === 'admin';

  async function moderate(action: 'restore' | 'remove') {
    setIsModerating(true);
    setModeration('');
    try {
      await adminService.moderateListing(
        id,
        action,
        action === 'remove' ? 'Taken down by the review team' : undefined
      );
      setListing(await listingService.get(id));
    } catch (err) {
      setModeration(err instanceof ApiRequestError ? err.message : 'That change did not save.');
    } finally {
      setIsModerating(false);
    }
  }

  return (
    <div className="page-shell py-8 sm:py-12">
      <Link
        to="/marketplace"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-brand-700"
      >
        <FaArrowLeftLong aria-hidden="true" className="size-3.5" />
        All listings
      </Link>

      {/* Bold status banner — shown before anything else for non-active listings */}
      {listing.status !== 'active' || listing.quantity === 0 ? (
        <div
          className={`mt-5 rounded-2xl px-6 py-5 ring-2 shadow-sm ${
            listing.status === 'sold' || (listing.status === 'active' && listing.quantity === 0)
              ? 'bg-red-50 ring-red-400'
              : listing.status === 'under_process'
                ? 'bg-amber-50 ring-amber-400'
                : 'bg-stone-100 ring-stone-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-block size-3 rounded-full ${
                listing.status === 'sold' || (listing.status === 'active' && listing.quantity === 0)
                  ? 'bg-red-600'
                  : listing.status === 'under_process'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-stone-600'
              }`}
            />
            <p
              className={`text-xl font-black uppercase tracking-wider ${
                listing.status === 'sold' || (listing.status === 'active' && listing.quantity === 0)
                  ? 'text-red-700'
                  : listing.status === 'under_process'
                    ? 'text-amber-800'
                    : 'text-stone-700'
              }`}
            >
              {listing.status === 'sold' || (listing.status === 'active' && listing.quantity === 0)
                ? '🔴 THIS LIVESTOCK IS SOLD'
                : listing.status === 'under_process'
                  ? '⏳ ORDER UNDER PROCESS'
                  : '🚫 THIS LISTING IS UNAVAILABLE'}
            </p>
          </div>
          <p
            className={`mt-2 text-sm font-medium leading-relaxed ${
              listing.status === 'sold' || (listing.status === 'active' && listing.quantity === 0)
                ? 'text-red-800'
                : listing.status === 'under_process'
                  ? 'text-amber-900'
                  : 'text-stone-700'
            }`}
          >
            {listing.status === 'sold' || (listing.status === 'active' && listing.quantity === 0)
              ? 'Another buyer has already purchased this livestock. It is no longer available for order.'
              : listing.status === 'under_process'
                ? 'An order is currently in progress for this livestock item. It cannot be purchased by another buyer.'
                : 'This listing has been removed. The farmer keeps it here for their records.'}
          </p>
          <Link
            to="/marketplace"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800 transition"
          >
            Browse other available listings →
          </Link>
        </div>
      ) : null}

      <div className="mt-6 grid gap-9 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-card bg-stone-100 ring-1 ring-stone-200">
            {shown ? (
              <img
                src={shown.url}
                alt={`${listing.title}, photo ${activeImage + 1} of ${listing.images.length}`}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : null}
          </div>

          {listing.images.length > 1 ? (
            <div role="group" aria-label="Photos" className="mt-3 grid grid-cols-4 gap-3">
              {listing.images.map((image, index) => (
                <button
                  key={image.url}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`Show photo ${index + 1}`}
                  aria-current={index === activeImage}
                  className={`aspect-square overflow-hidden rounded-xl ring-2 transition ${
                    index === activeImage ? 'ring-brand-600' : 'ring-transparent hover:ring-stone-300'
                  }`}
                >
                  <img src={image.url} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          <section className="mt-8 rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card sm:p-8">
            <h2 className="font-display text-lg font-semibold text-ink-900">About this offering</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">{listing.description}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Fact label="Animal" value={SPECIES_LABELS[listing.species]} />
              <Fact label="Form" value={LISTING_TYPE_LABELS[listing.listingType]} />
              <Fact label="Breed" value={listing.breed || 'Not stated by the farmer'} />
              <Fact label="Quantity on the farm" value={`${listing.quantity} ${UNIT_LABELS[listing.unit]}`} />
            </div>
          </section>

          <section className="mt-8 rounded-card bg-brand-900 p-6 text-brand-100 sm:p-8">
            <h2 className="font-display text-lg font-semibold text-white">Buyer protection on this order</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed">
              {PROTECTION.map((line) => (
                <li key={line} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-300" />
                  {line}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <div className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
              {SPECIES_LABELS[listing.species]}
              {listing.breed ? ` · ${listing.breed}` : ''}
            </p>
            <h1 className="mt-2 text-balance text-2xl font-bold text-ink-900">{listing.title}</h1>

            {/* Status alert for sidebar — only for active so the full page banner is enough for sold/removed */}
            {listing.status === 'active' && listing.quantity === 0 ? (
              <div className="mt-4">
                <Alert tone="info" title="Out of stock">
                  This farmer has no stock left at this listing. Similar listings are in the marketplace.
                </Alert>
              </div>
            ) : null}

            <p className="mt-5 text-3xl font-bold text-ink-900">
              {formatNaira(listing.priceKobo)}
              <span className="ml-1.5 text-sm font-medium text-ink-500">per {UNIT_LABELS[listing.unit]}</span>
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {listing.quantity > 1
                ? `${listing.quantity} ${UNIT_LABELS[listing.unit]}s available at this price.`
                : `One ${UNIT_LABELS[listing.unit]} available at this price.`}
            </p>

            <div className="mt-5 space-y-2 text-sm text-ink-700">
              <p className="inline-flex items-center gap-2">
                <FaLocationDot aria-hidden="true" className="size-3.5 text-stone-400" />
                {listing.town}, {listing.state}
              </p>
              <p className="inline-flex items-center gap-2">
                <FaRegCalendar aria-hidden="true" className="size-3.5 text-stone-400" />
                Posted {formatDate(listing.createdAt)}
              </p>
              <p className="inline-flex items-center gap-2 text-ink-600">
                <FaEye aria-hidden="true" className="size-3.5 text-stone-400" />
                <span className="font-semibold text-ink-900">{listing.views ?? 0}</span> {(listing.views ?? 0) === 1 ? 'view' : 'views'}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={handleShare}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-stone-50/80 px-3.5 py-2 text-xs font-semibold text-ink-700 transition hover:bg-stone-100 hover:text-brand-700 shadow-xs"
              >
                {copied ? (
                  <>
                    <FaCheck aria-hidden="true" className="size-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Link copied! Ready to share on WhatsApp</span>
                  </>
                ) : (
                  <>
                    <FaShareNodes aria-hidden="true" className="size-3.5 text-stone-500" />
                    <span>Share listing on WhatsApp & Socials</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-6 space-y-4" id="order-panel">
              <OrderPanel listing={listing} />
              <Link to="/how-it-works" className="block text-center text-xs font-medium text-brand-700 underline">
                How the payment is held
              </Link>
            </div>

            {isAdmin ? (
              <div className="mt-6 space-y-3 rounded-xl bg-stone-50 p-4 ring-1 ring-inset ring-stone-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Staff controls</p>
                {moderation ? <Alert tone="error">{moderation}</Alert> : null}
                <div className="flex flex-wrap gap-2">
                  {listing.status === 'active' ? (
                    <Button size="sm" variant="secondary" isLoading={isModerating} onClick={() => moderate('remove')}>
                      Take down
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" isLoading={isModerating} onClick={() => moderate('restore')}>
                      Put it back up
                    </Button>
                  )}
                  <Button size="sm" variant="danger" isLoading={isModerating} onClick={handleDeleteListing}>
                    Delete listing
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card">
            <h2 className="font-display text-lg font-semibold text-ink-900">Have questions about this livestock?</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Chat directly with the farmer to discuss availability, condition, delivery arrangements, and other important details before making payment.
            </p>
            {!user ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-ink-500">Sign in as a buyer to chat with the farmer.</p>
                <Link to="/login" state={{ from: location.pathname }}><Button className="w-full">Sign in to chat</Button></Link>
              </div>
            ) : user.role === 'buyer' ? (
              <div className="mt-4">
                {!chatOpen ? (
                  <Button className="w-full" onClick={() => setChatOpen(true)}>Chat with Farmer</Button>
                ) : (
                  <div className="space-y-3">
                    <ChatPanel listingId={listing.id} threadId={threadParam} myRole="buyer" compact />
                    <Button variant="secondary" className="w-full" onClick={() => { document.getElementById('order-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Proceed to Order</Button>
                  </div>
                )}
              </div>
            ) : user.role === 'farmer' && user.id === listing.farmer?.id ? (
              <div className="mt-4">
                {threadParam ? (
                  <ChatPanel threadId={threadParam} myRole="farmer" compact />
                ) : (
                  <p className="text-sm text-ink-500">
                    Buyer inquiries for this listing appear in <Link to="/notifications" className="font-semibold text-brand-700 underline">Messages &amp; notifications</Link>.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-500">Only buyers can start a chat with the farmer from this listing.</p>
            )}
          </div>

          <div className="rounded-card bg-white p-6 ring-1 ring-stone-200 shadow-card">
            <h2 className="font-display text-base font-semibold text-ink-900">The farmer</h2>
            {listing.farmer ? (
              <>
                <p className="mt-2 text-sm font-medium text-ink-900">{listing.farmer.fullName}</p>
                {listing.farmer.isVerified ? (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">
                    <FaUserCheck aria-hidden="true" className="size-3" />
                    Farm account verified
                  </p>
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-ink-500">
                    This farmer has not finished the account checks yet. Take extra care and keep the conversation on the
                    platform.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-500">The account that posted this listing is no longer active.</p>
            )}
            <p className="mt-4 text-xs leading-relaxed text-ink-500">
              Photos, prices and the livestock described here belong to the farmer. Halal Livestocks checks every account
              and reviews reports, but the farm gives the final word on weight and health.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
