# Halal Livestocks

A digital marketplace connecting livestock farmers with buyers (wholesalers, butchers, restaurants, caterers and
households) in **Ibadan and Oyo State, Nigeria** — with verified farmers, strict halal segregation of live animals and
processed products, and payment protection on every order.

**Current status: Phase 1 (Foundation) is implemented** — project scaffolding, environment configuration, centralized
error handling, accounts with role-based auth, the login/register/session UI, image-led buyer and farmer dashboards, and
a support desk where anyone can log a complaint to the admin. Marketplace listings, messaging, orders, Paystack checkout,
delivery and disputes arrive in later phases.

## Repository layout

```
client/   React 19 + TypeScript + Tailwind CSS 4 (Vite)
server/   Node.js + Express 5 + TypeScript + Mongoose
```

## Prerequisites

- Node.js 22+
- A MongoDB Atlas free cluster (M0) — the server needs its connection string

## 1. Run the API

```bash
cd server
npm install
cp .env.example .env     # then paste your Atlas string into MONGODB_URI
npm run dev              # http://localhost:4000
```

`JWT_SECRET` must be a long random value — `openssl rand -base64 48` works. The server refuses to boot if any
environment variable is missing or too weak, and tells you exactly which one.

## 2. Run the web app

```bash
cd client
npm install
npm run dev              # http://localhost:5173 (5174 if 5173 is already taken)
```

The Vite dev server proxies `/api` to `http://localhost:4000`, so no CORS setup is needed locally.

## Scripts

| Command | Server | Client |
| --- | --- | --- |
| dev | `npm run dev` (tsx watch) | `npm run dev` (vite) |
| typecheck | `npm run typecheck` | `npm run typecheck` |
| build | `npm run build` → `dist/` | `npm run build` → `dist/` |
| run prod | `npm start` | `npm run preview` |

## API (Phase 1)

All responses use one envelope: `{ success: true, data }` or
`{ success: false, error: { code, message, details? } }`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | — | Liveness check |
| POST | `/api/v1/auth/register` | rate limited | Create a buyer or farmer account, returns JWT, sends the confirmation email |
| POST | `/api/v1/auth/login` | rate limited | Sign in with email **or** phone + password |
| GET | `/api/v1/auth/me` | Bearer | Current session user |
| POST | `/api/v1/auth/verify-email` | rate limited | Confirm an address from the emailed link (single use) |
| POST | `/api/v1/auth/resend-verification` | rate limited | Send a fresh link; the previous one stops working |
| POST | `/api/v1/auth/forgot-password` | rate limited | Email a reset link. Always 202 |
| POST | `/api/v1/auth/reset-password` | rate limited | Set a new password and end every older session |
| POST | `/api/v1/auth/phone/send-code` | Bearer, rate limited | SMS a six digit code to the number on the account |
| POST | `/api/v1/auth/phone/confirm` | Bearer, rate limited | Verify the number with that code |
| PUT | `/api/v1/users/profile` | Bearer | Update own name/phone only |
| POST | `/api/v1/uploads/images` | Bearer, rate limited | Upload up to 4 images (3 MB for the set) and attach them to the account |
| DELETE | `/api/v1/uploads/images` | Bearer, rate limited | Remove one image by its storage key |
| POST | `/api/v1/support/complaints` | optional Bearer, rate limited | Log a complaint to the admin (guest or signed in) |
| GET | `/api/v1/support/complaints` | Bearer | The caller's own reports, newest first |

Notes on the decisions encoded here:

- **Passwords** are bcrypt-hashed at cost 12 and never selected or serialized.
- **Phone numbers** are stored in E.164 (`+234…`); local `0803…` input is normalized on the way in, for both
  registration and login. Changing the number through the profile endpoint resets its verified flag.
- **Login failures** return the same `Invalid credentials` message for unknown accounts and wrong passwords, so the
  API does not confirm which emails or numbers are registered. The recovery endpoints answer `202 accepted` whether or
  not the identifier exists, and the same for a suspended or already verified account.
- **`role: 'admin'` cannot be self-registered** — the register endpoint only accepts `buyer` and `farmer`.
- **JWT** carries `{ userId, role, tokenVersion }` and `requireRole(...)` is available for the role-gated endpoints
  that come in Phase 2 (farmer KYC, admin verification). Every authenticated request re-reads the account, so a
  suspension or a password reset takes effect at once rather than at token expiry: reset bumps `tokenVersion`, which
  invalidates the older stateless tokens.
- **Complaints** may be filed by anyone, but a signed-in report always stores the account's own name, email and phone
  rather than whatever the form was filled with, so a report cannot be pointed at somebody else. Guests must supply a
  name and an email address. An invalid bearer token is rejected instead of being treated as a guest.

## Emails, codes and providers

Verification links, reset links and phone codes share one design: the value is generated randomly, only its SHA-256
digest is stored in `verificationtokens`, each row carries an `expiresAt` with a MongoDB TTL index (so abandoned links
clean themselves up), and a row is deleted the moment it is used. Issuing a new token for the same purpose deletes the
older one, which is why "resend" invalidates the previous email. Lifetimes are 24 hours for email confirmation,
30 minutes for a password reset and 10 minutes for an SMS code; a code also dies after 5 wrong guesses.

Delivery goes through `server/src/services/notificationService.ts` and is chosen by environment variable:

| Variable | Values | Notes |
| --- | --- | --- |
| `MAIL_PROVIDER` | `console` (default), `brevo` | `console` prints the message to the server log. It is refused when `NODE_ENV=production`. |
| `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` | required with `brevo` | Boot fails with a named variable if they are missing. |
| `SMS_PROVIDER` | `console` (default), `termii` | `console` prints the code so local testing can use it. |
| `TERMII_API_KEY`, `TERMII_SENDER_ID` | required with `termii` | The payload follows Termii's SMS v1 shape; re-check it against their docs before going live. |
| `PUBLIC_APP_URL` | default `http://localhost:5173` | Base URL used inside the emailed links. |

Provider failures are logged and swallowed: a Brevo outage must not turn `forgot-password` into a way to test which
addresses are registered. Emails are built as HTML in `server/src/services/authMessages.ts`, with the user's name
escaped and a plain text part alongside.

To switch to real delivery: set `MAIL_PROVIDER=brevo` plus `BREVO_API_KEY` and `MAIL_FROM_EMAIL` (verify the sending
domain in the Brevo dashboard first), and `SMS_PROVIDER=termii` with `TERMII_API_KEY`.

## Images and storage

Uploads go through `server/src/services/imageStore.ts`. The API accepts a batch of at most **4 images, 3 MB for the
whole set**, in JPEG, PNG or WebP. A signed-in account keeps its own list of photos on the `User` document, capped at
the same 4, so the limits hold whether files arrive in one batch or across several.

| Variable | Values | Notes |
| --- | --- | --- |
| `STORAGE_PROVIDER` | `local` (default), `cloudinary` | `local` writes under `server/uploads/` and serves them from this API, so the flow works before any key exists. Refused when `NODE_ENV=production`. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | required with `cloudinary` | Boot fails with a named variable if any is missing. |
| `UPLOAD_DIR` | default `uploads` | Folder used by the `local` provider, relative to the server working directory. |
| `PUBLIC_API_URL` | default `http://localhost:4000` | Base URL used to build local image URLs. |

What the service does with each file:

- **Compression and conversion.** Cloudinary receives the upload with a `1600x1600 limit` resize and `quality: auto:good`
  applied on the way in, so the stored master is already small. The URL handed back to the browser carries
  `fetch_format: auto` and `quality: auto`, which lets Cloudinary serve AVIF or WebP to the clients that understand
  them. The user never has to resize anything themselves.
- **Ownership.** Every storage key starts with the account id (`halal-livestocks/users/<id>/…`), and a delete is refused
  unless the key is both on that account's own photo list and inside its own prefix. A guessed key cannot remove
  somebody else's file.
- **Failure hygiene.** If the third image in a batch is rejected, the two that already landed are deleted again, so a
  partial upload never leaves orphaned files behind.
- **Removal.** Deleting a photo takes it out of the array and out of storage in the same request.

`helmet` is configured with `Cross-Origin-Resource-Policy: cross-origin` because the images are read by the web app on
a different port to the API.

## UI routes

`/` marketplace landing, `/how-it-works`, `/contact` (support desk), `/register`, `/login`, `/forgot-password`,
`/verify-email?token=…`, `/reset-password?token=…`, and role-guarded dashboards at `/buyer/dashboard`,
`/farmer/dashboard`, `/admin/dashboard`. `ProtectedRoute` redirects anonymous visitors to `/login` and remembers where
they were heading; the session is restored from the stored token on reload via `/auth/me`.

The dashboards carry an "Account checks" card for the two confirmations: a resend button for the email link and a code
entry for the phone number. The farmer dashboard also carries a "Farm photos" card that uploads, previews and removes
images against those storage limits. `/verify-email` and `/reset-password` are reachable while signed in or out, because
a person arrives at them from an email. A successful password reset clears the stored token locally, since the server
has just invalidated it.

Every page is checked at 360, 640, 768, 1024 and 1440 px for horizontal overflow. Below `md` the navigation collapses
into a menu button.

## Money handling: what this platform does *not* claim

Paystack is a licensed PSSP and merchant acquirer, **not** an escrow trustee, and it exposes no end-user escrow API.
The design therefore collects payment to the platform merchant account and releases farmer payouts from an internal
settlement ledger after delivery confirmation or expiry of the dispute window. Product copy must keep saying
"payment received and safely held by Halal Livestocks under Buyer Protection terms" — never "licensed escrow".
See `client/src/pages/public/HowItWorks.tsx`.

## Open product decisions

The commission default (5–8%, proposed 6.5%), who pays platform delivery fees, transit mortality liability per delivery
model, who qualifies as an authorized halal slaughterer for the MVP, and the auto-release window (proposed 24h) are
tracked as configurable `PlatformSettings` values and still need sign-off.
