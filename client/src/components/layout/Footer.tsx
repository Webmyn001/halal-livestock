import { Link } from 'react-router-dom';
import { FaEnvelope, FaFacebookF, FaInstagram, FaPhone, FaTwitter } from 'react-icons/fa6';

const CONTACT_EMAIL = 'hello@halallivestocks.ng';
const CONTACT_PHONE = '+234 803 000 0000';

const SOCIAL_LINKS = [
  { label: 'Facebook', href: 'https://www.facebook.com/halallivestocks', Icon: FaFacebookF },
  { label: 'Instagram', href: 'https://www.instagram.com/halallivestocks', Icon: FaInstagram },
  { label: 'Twitter', href: 'https://twitter.com/halallivestocks', Icon: FaTwitter },
];

export function Footer() {
  return (
    <footer className="bg-brand-900 text-brand-100">
      <div className="page-shell grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-white/10 font-display text-sm font-bold text-white">
              HL
            </span>
            <span className="font-display text-base font-semibold text-white">Halal Livestocks</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            A direct market for rabbits, poultry and sheep in Ibadan and the towns around it.
          </p>

          <ul className="mt-5 space-y-2 text-sm">
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-2.5 hover:text-white">
                <FaEnvelope aria-hidden="true" className="size-3.5 shrink-0 text-gold-300" />
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="inline-flex items-center gap-2.5 hover:text-white">
                <FaPhone aria-hidden="true" className="size-3.5 shrink-0 text-gold-300" />
                {CONTACT_PHONE}
              </a>
            </li>
          </ul>

          <div className="mt-6 flex items-center gap-2.5">
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Halal Livestocks on ${label}`}
                className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-gold-500 hover:text-brand-900"
              >
                <Icon aria-hidden="true" className="size-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Use the site</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link to="/marketplace" className="hover:text-white">
                Marketplace
              </Link>
            </li>
            <li>
              <Link to="/how-it-works" className="hover:text-white">
                How it works
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-white">
                Contact the admin
              </Link>
            </li>
            <li>
              <Link to="/register" className="hover:text-white">
                Create an account
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Trust and safety</h3>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed">
            <li>Farmers verify identity and bank details before listing</li>
            <li>Commission on completed orders only</li>
            <li>Payout released after the buyer hands over the code</li>
          </ul>
        </div>

      </div>

      <div className="border-t border-white/10">
        <div className="page-shell flex flex-col gap-2 py-6 text-xs text-brand-200 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Halal Livestocks is a marketplace operator. Buyer payments are received and safely held under our Buyer
            Protection terms until delivery is confirmed.
          </p>
          <p className="shrink-0">Ibadan, Oyo State, Nigeria</p>
        </div>
      </div>
    </footer>
  );
}
