# Halal Livestocks

A digital marketplace connecting livestock farmers with buyers (wholesalers, butchers, restaurants, caterers and
households) in **Ibadan, Oyo State, Nigeria** — with verified farmers, strict halal segregation of live animals and
processed products, and payment protection on every order.

**Current status: the full trading loop is implemented** — project scaffolding, environment configuration, centralized
error handling, accounts with role-based auth, the login/register/session UI, image-led dashboards, a support desk,
livestock listings with photos, orders with a checkout held by the platform, delivery guarded by a six digit handover
code, a settlement ledger with commission, disputes with photo evidence, in app chat between buyer and farmer, farmer
KYC with an approval queue, and an admin console over all of it including `PlatformSettings`.

Two providers are still switched off by default and need keys before a launch: image storage (`cloudinary`) and money
(`paystack`). Both are refused when `NODE_ENV=production`, so the app cannot go live on the local/mock paths by
accident. See [Environment checklist](#environment-checklist).

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
| make a staff account | `npm run seed:account -- --role admin …` | — |

## API

All responses use one envelope: `{ success: true, data }` or
`{ success: false, error: { code, message, details? } }`. A failed zod check answers `400` with
`details: [{ field, message }]`, which the client turns into per-field errors under the inputs.

### Accounts, listings and support

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
| POST | `/api/v1/auth/phone/send-code` | Bearer, rate limited | Email a six digit code to the address on the account |
| POST | `/api/v1/auth/phone/confirm` | Bearer, rate limited | Verify the number with that code |
| PUT | `/api/v1/users/profile` | Bearer | Update own name/phone only |
| GET | `/api/v1/listings` | — | Public marketplace page: filters by `species`, `type`, `q`, `sort`, `page` |
| GET | `/api/v1/listings/mine` | Farmer Bearer | Every listing on the caller's own account, including sold and taken down ones |
| GET | `/api/v1/listings/:id` | Optional Bearer | One listing. `removed` ones are only visible to their owner |
| POST | `/api/v1/listings` | Farmer Bearer, rate limited | Create a listing as multipart form data with **1 to 4 photos, 3 MB for the set** |
| PATCH | `/api/v1/listings/:id` | Farmer Bearer, rate limited | Change the text, price, quantity or status of own listing |
| POST | `/api/v1/listings/:id/photos` | Farmer Bearer, rate limited | Add photos to a listing that still has room |
| DELETE | `/api/v1/listings/:id/photos` | Farmer Bearer, rate limited | Remove one photo by its storage key. The last photo is protected |
| POST | `/api/v1/support/complaints` | optional Bearer, rate limited | Log a complaint to the admin (guest or signed in) |
| GET | `/api/v1/support/complaints` | Bearer | The caller's own reports, newest first |
| GET | `/api/v1/platform` | — | Public settings: commission, dispute window, support contacts, `paymentsOpen` |

### Orders and checkout

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/orders` | Bearer | Own orders, newest first. Buyer, farmer, driver and admin each see their side |
| GET | `/api/v1/orders/:id` | Bearer on the order | One order, with the parties and money shown per role |
| GET | `/api/v1/orders/:id/thread` | Buyer or farmer on the order | The chat thread attached to an order, created with it |
| POST | `/api/v1/orders` | Buyer Bearer, rate limited | Reserve stock and open an order. Oversell answers `409` |
| POST | `/api/v1/orders/:id/pay` | Buyer Bearer | Ask the provider for a checkout URL for this order |
| POST | `/api/v1/orders/:id/payment-check` | Buyer Bearer | Re-read the reference and mark the order funded when the money is in |
| POST | `/api/v1/orders/:id/accept` | Farmer Bearer | Farmer accepts the order and moves it to `preparing` |
| POST | `/api/v1/orders/:id/cancel` | Buyer or admin Bearer | Cancel before handover and put the quantity back on the listing |
| POST | `/api/v1/payments/webhook` | Paystack signature | Provider callback. Sits ahead of auth because the HMAC is checked over the raw body |
| POST | `/api/v1/payments/mock/complete` | Buyer Bearer | Settles a `mock` checkout so the loop is testable without a card |

### Delivery, disputes, chat and KYC

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/deliveries/mine` | Driver Bearer | The runs assigned to the signed in driver |
| GET | `/api/v1/deliveries/drivers` | Admin Bearer | Active driver accounts, for the dispatch picker |
| POST | `/api/v1/deliveries/:id/dispatch` | Admin Bearer | Assign a driver, issue the six digit handover code, notify the buyer |
| POST | `/api/v1/deliveries/:id/handover` | Driver Bearer | Driver enters the code the buyer read out. Five wrong tries locks it |
| POST | `/api/v1/disputes` | Buyer or farmer, rate limited | Open a case with 1 to 4 photos, 3 MB for the set |
| GET | `/api/v1/disputes` | Buyer or farmer Bearer | Own cases, newest first |
| GET | `/api/v1/disputes/:id` | Party on the case | One case with its evidence |
| POST | `/api/v1/disputes/:id/evidence` | Party on the case, rate limited | Add photos to an open case |
| DELETE | `/api/v1/disputes/:id/evidence` | Author of the photo | Take own photo back down, by storage key |
| GET | `/api/v1/conversations` | Buyer or farmer Bearer | Own threads, most recent message first, with unread counts |
| GET | `/api/v1/conversations/:id` | Party on the thread | Read a thread and clear the caller's unread count |
| POST | `/api/v1/conversations/:id/messages` | Party on the thread, rate limited | Send a message to the other side |
| POST | `/api/v1/kyc` | Farmer Bearer | Submit farm, ID and bank details, with an optional document photo |
| DELETE | `/api/v1/kyc/document` | Farmer Bearer | Withdraw the document photo |

### Admin console

Everything below is `requireSessionRole('admin')`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/admin/counts` | Dashboard numbers: users, listings, orders, held money, open cases, KYC queue |
| GET | `/api/v1/admin/users` | Search accounts by name, email or phone; filter by role, paged |
| GET | `/api/v1/admin/complaints` | Support desk queue |
| PATCH | `/api/v1/admin/complaints/:id` | Move a complaint to `under_review`, `resolved` or `closed` with a written reply |
| GET | `/api/v1/admin/kyc` | Farmers waiting to be verified, with the bank details masked |
| POST | `/api/v1/admin/kyc/:userId` | Approve or reject a KYC submission. Approval promotes the farm and frees its payout |
| GET | `/api/v1/admin/orders` | Every order, filterable by status |
| GET | `/api/v1/admin/settlements` | The payout ledger |
| POST | `/api/v1/admin/settlements/:id/release` | Pay a farmer out. Refuses while a dispute is open or the KYC is unapproved |
| GET | `/api/v1/admin/disputes` | Every case, open first |
| POST | `/api/v1/admin/disputes/:id/rule` | Rule a case: refund the buyer, release the payout, or reject |
| POST | `/api/v1/admin/listings/:id/moderate` | Take a listing down with a reason, or put a taken down one back up. A sold lot cannot be restored |
| GET / PUT | `/api/v1/admin/settings` | Read or write `PlatformSettings` |

Notes on the decisions encoded here:

- **Passwords** are bcrypt-hashed at cost 12 and never selected or serialized.
- **Phone numbers** are stored in E.164 (`+234…`); local `0803…` input is normalized on the way in, for both
  registration and login. Changing the number through the profile endpoint resets its verified flag.
- **Login failures** return the same `Invalid credentials` message for unknown accounts and wrong passwords, so the
  API does not confirm which emails or numbers are registered. The recovery endpoints answer `202 accepted` whether or
  not the identifier exists, and the same for a suspended or already verified account.
- **`role: 'admin'` and `role: 'driver'` cannot be self-registered** — the register endpoint only accepts `buyer` and
  `farmer`. Staff accounts come from `npm run seed:account` (see [Roles and staff accounts](#roles-and-staff-accounts)).
- **JWT** carries `{ userId, role, tokenVersion }` and every role-gated route runs through
  `requireSessionRole(...)`, which re-reads the account before the handler. A farmer cannot call a buyer endpoint, a
  driver cannot open `/conversations`, and an outsider gets `403` on an order or a thread rather than a `404` that
  leaks whether the id exists. A suspension or a password reset takes effect at once rather than at token expiry: reset
  bumps `tokenVersion`, which invalidates the older stateless tokens.
- **Complaints** may be filed by anyone, but a signed-in report always stores the account's own name, email and phone
  rather than whatever the form was filled with, so a report cannot be pointed at somebody else. Guests must supply a
  name and an email address. An invalid bearer token is rejected instead of being treated as a guest.

## Emails, codes and providers

Verification links, reset links and confirmation codes share one design: the value is generated randomly, only its
SHA-256 digest is stored in `verificationtokens`, each row carries an `expiresAt` with a MongoDB TTL index (so abandoned
links clean themselves up), and a row is deleted the moment it is used. Issuing a new token for the same purpose deletes
the older one, which is why "resend" invalidates the previous email. Lifetimes are 24 hours for email confirmation,
30 minutes for a password reset and 10 minutes for a confirmation code; a code also dies after 5 wrong guesses.

Email is the only outbound channel. There is no SMS provider, no sender ID and no per-message telecom cost:
verification codes, handover codes and payout notices are all delivered by Brevo. Delivery goes through
`server/src/services/notificationService.ts` and is chosen by environment variable:

| Variable | Values | Notes |
| --- | --- | --- |
| `MAIL_PROVIDER` | `console` (default), `brevo` | `console` prints the message to the server log. It is refused when `NODE_ENV=production`. |
| `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` | required with `brevo` | Boot fails with a named variable if they are missing. |
| `PUBLIC_APP_URL` | default `http://localhost:5173` | Base URL used inside the emailed links. |

Provider failures are logged and swallowed: a Brevo outage must not turn `forgot-password` into a way to test which
addresses are registered. Emails are built as HTML in `server/src/services/authMessages.ts`, with the user's name
escaped and a plain text part alongside.

To switch to real delivery: verify the sending domain in the Brevo dashboard, then set `MAIL_PROVIDER=brevo` plus
`BREVO_API_KEY` and `MAIL_FROM_EMAIL`. That is the whole list.

## Images and storage

Pictures belong to a **listing**, not to the account. A farmer cannot publish stock without at least one photo, and the
listing holds at most four. Uploads go through `server/src/services/imageStore.ts`, which accepts a batch of
**4 images, 3 MB for the whole set**, in JPEG, PNG or WebP. The same limits are checked twice: multer stops a file that
is too large or a fifth slot on the way in, and `assertBatch` in the listing controller totals the set and refuses a
listing that would end up with no photo or too many.

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
  them. The farmer never has to resize anything themselves.
- **Ownership.** Every storage key starts with the owner path (`halal-livestocks/listings/<farmerId>/…`), and a delete is
  refused unless the key sits inside the caller's own prefix **and** is on the listing being edited. A guessed key
  cannot remove somebody else's file.
- **Failure hygiene.** If the third image in a batch is rejected, the two that already landed are deleted again, so a
  partial upload never leaves orphaned files behind.
- **Removal.** Deleting a photo takes it out of the listing and out of storage in the same request. The last photo on a
  listing cannot be removed: the farmer adds a replacement first, because a listing without a picture is not sellable.
- **What the public sees.** `toPublicListing` returns the image URL, size and format to everyone, but the storage key
  only to the farmer who owns the listing, since that key is what a delete request is made of.

`helmet` is configured with `Cross-Origin-Resource-Policy: cross-origin` because the images are read by the web app on
a different port to the API.

## Listings

`server/src/models/Listing.ts` keeps the price in **kobo** (`priceKobo`), so no float ever sits on the money path; the
client sends `priceNaira` and the server multiplies by 100. Species is one of `rabbit`, `poultry`, `sheep`, `goat`, the
form is `live` or `halal_processed`, and the status moves between `active`, `sold` and `removed`.

`GET /api/v1/listings` filters on status, species and form, searches title, breed, town and description with a regex
(the user's text is escaped first), sorts by newest or price, and pages at 12 per request. Only `active` listings reach
the marketplace; a `removed` one stays readable for its owner.

## Orders, money and delivery

`server/src/services/orderFlow.ts` holds the whole state machine, so no controller can invent a transition.

```
awaiting_payment → funded → preparing → out_for_delivery → confirmed → completed
        ↘ cancelled  (before handover)   ↘ refunded  (dispute ruled for the buyer)
```

Money has its own field (`paymentState`: `unpaid`, `held`, `refunded`) so a hold does not rewrite delivery history, and
payouts live in a separate ledger (`Settlement`: `pending`, `held`, `released`).

- **Stock is reserved, not promised.** `POST /orders` takes quantity with a conditional `$inc`
  (`status: 'active'` and `quantity >= n`). Two buyers on the last animal means one `409` saying how many are left, and
  the loser never goes negative. A cancel puts the same quantity back.
- **The total is snapshotted.** An order stores the title, species, form, unit, price, cover image and town at the
  moment it was written, so a farmer editing the listing afterwards cannot change what the buyer agreed to.
- **Fund checks the amount.** `markFunded` refuses a payment that does not equal `totalKobo` and treats the second
  report of the same payment as a no-op, because the webhook and the browser can both arrive.
- **The handover code is the only key.** Dispatch generates six digits, stores them with `select: false`, emails them
  to the buyer, and never returns them to the driver. The buyer reads them out at the roadside; the driver
  types them into `/deliveries/:id/handover`. Five wrong tries locks the code until support dispatches a new one. The
  payload only carries the code to the buyer or an admin while the order is `out_for_delivery`, and a replay is stopped
  by the state machine itself: handover requires `out_for_delivery`, which a confirmed order has already left.
- **Confirming opens the payout.** Handover moves the order to `confirmed` and writes a `Settlement` row in the same
  call, using `splitCommission(totalKobo, commissionBps)`. The floor goes to the farmer, so a payout can never add up
  to more than the buyer actually paid. 500 bps on ₦15,000 is ₦750 to the platform and ₦14,250 to the farm.

## Payments: mock and Paystack

`PAYMENT_PROVIDER` chooses the implementation behind `server/src/services/paymentService.ts`.

| Variable | Values | Notes |
| --- | --- | --- |
| `PAYMENT_PROVIDER` | `mock` (default), `paystack` | `mock` settles an order the moment its checkout link is opened, which is how the loop is tested without a card. **Refused when `NODE_ENV=production`.** |
| `PAYSTACK_SECRET_KEY` | required with `paystack` | Server side: initialize transaction, verify reference. Never reaches the browser. |
| `PAYSTACK_WEBHOOK_SECRET` | required with `paystack` | The secret Paystack generates for the endpoint, copied out of its dashboard. Needed for the signature check on `POST /api/v1/payments/webhook`. |

There is deliberately no Paystack public key in this project. The browser is sent the hosted checkout URL that this API
builds, so only the server holds a Paystack credential. A future inline popup integration would need a `VITE_` public
key, and nothing today does.

The webhook is mounted before authentication and before any body rewriting, because Paystack signs the raw bytes with
HMAC-SHA512 and `rawBody` is captured for that check. A reference is only trusted after `verifyTransaction` returns it,
so a browser claiming to have paid cannot fund an order on its own.

Paystack is a licensed PSSP and merchant acquirer, **not** an escrow trustee, and it exposes no end-user escrow API. The
design therefore collects payment to the platform merchant account and releases farmer payouts from an internal
settlement ledger after delivery confirmation or expiry of the dispute window. Product copy must keep saying
"payment received and safely held by Halal Livestocks under Buyer Protection terms" — never "licensed escrow".
See `client/src/pages/public/HowItWorks.tsx`.

## Disputes, chat and what stops a payout

A thread is created with the order and belongs to its buyer and farmer only; drivers and admins are not parties to it.
Unread counts are per side and reading a thread clears the reader's own.

A case is opened with `reason`, a written account and **1 to 4 photos, 3 MB for the set** — the same batch rules as
listings, enforced in the same service. Evidence is stored under `disputes/<userId>/`, deliberately apart from the
listing folder so taking a listing down cannot delete the proof against it, and a photo can only be removed by the
account that uploaded it.

While a case is open, `order.disputeOpen` freezes the payout and any release attempt answers `409`. Ruling a case does
one of three things: refund the buyer (money goes back, the settlement is marked `held` with the reason), release the
payout, or reject the case and put a frozen payout back on the queue. Only a payout that this case froze goes back to
`pending` — one that was sitting on unapproved bank details stays where it was.

New cases are allowed from the moment the payment is held until `confirmedAt + disputeWindowDays`, then the window
closes and the app points the buyer at the chat or support instead.

## Farmer KYC and payouts

`POST /api/v1/kyc` collects farm name, address, town, state, an ID type (`nin`, `passport`, `drivers_license`, `vusv`),
ID number, optional CAC number, and the bank name, account name and a 10 or 11 digit account number. The document photo
is optional because farmers photograph IDs badly on phones; an admin can ask for it later.

The admin queue shows the submissions with the account number masked. Approving one stamps the farm as verified and
frees any payout held for that reason; rejecting it needs a written note the farmer can read. A payout cannot be
released to an unapproved account at all — that is the guard that keeps a mis-keyed account number from sending money
nowhere.

## Platform settings

One document (`PlatformSettings`, keyed by `default`) holds the tunables, read once at boot and editable from the admin
console. A fresh cluster gets the document on first use.

| Setting | Default | What it does |
| --- | --- | --- |
| `commissionBps` | 500 (5%) | Share of the order value the platform keeps, in basis points. Rounded in the farmer's favour |
| `disputeWindowDays` | 7 | Days after handover in which a case can still be opened |
| `paymentsOpen` | `true` | Turning it off stops new checkouts while leaving existing orders readable |
| `supportEmail` / `supportPhone` | placeholder | What the buyer and farmer screens tell people to contact |
| `maintenanceNote` | empty | A short note the admin can leave. Only the console reads it back today |

`GET /api/v1/platform` is public, so the farmer dashboard can state the real commission instead of a hardcoded number,
and the same call is what a landing page notice would use later.

## Roles and staff accounts

Four roles: `buyer`, `farmer`, `driver`, `admin`. The first two self-register; the last two are made with a script,
because nobody should be able to ask the API for an admin account.

```bash
cd server
npm run seed:account -- --role admin --email you@example.com --name "Your Name" --phone 08031234567
npm run seed:account -- --role driver --email driver@example.com --name "Driver Name" --phone 08098765432 --activate
```

Omit `--password` and a one time password is printed once, which should be changed after signing in. Staff skip the
email and phone confirmation loop because there is no one left to approve them. `--activate` promotes an existing
account in place and ends its older sessions, so a farmer who joins the team does not need a second row.

## UI routes

Public: `/` landing page, `/marketplace` (filters, search, sort and paging over live listings), `/marketplace/:id`
(photo gallery, price, farmer card, order panel), `/how-it-works`, `/contact` (support desk), `/register`, `/login`,
`/forgot-password`, `/verify-email?token=…`, `/reset-password?token=…`, `/checkout/mock` (the stand in for the
provider's payment page while `PAYMENT_PROVIDER=mock`).

Signed in, any role: `/orders` (the list, whichever side of the deal the caller is on) and `/orders/:id` (progress
strip, money on the order, the dispatch card for an admin, the code box for a driver, the chat and dispute panels for
buyer and farmer).

Per role: `/buyer/dashboard`, `/farmer/dashboard`, `/farmer/post-livestock`, `/farmer/verify-farm` (KYC form and its
status), `/deliveries` (the driver's runs and the code entry), `/admin/dashboard` (one console with tabs for the
numbers, users, complaints, KYC, orders, payouts, cases, moderation and settings). `ProtectedRoute` redirects anonymous
visitors to `/login` and remembers where they were heading; the session is restored from the stored token on reload via
`/auth/me`, and a signed in account on the wrong route gets a plain "Not available for your account" notice rather than
somebody else's console.

The dashboards carry an "Account checks" card for the two confirmations: a resend button for the email link and a code
entry for the phone number. The farmer dashboard also carries "My listings": every listing on the account with its
status, the photo strip (add while there is room, remove any but the last) and the buttons that mark a lot sold, put a
taken down one back up or open the buyer's view of it. `/verify-email` and `/reset-password` are reachable while signed
in or out, because a person arrives at them from an email. A successful password reset clears the stored token locally,
since the server has just invalidated it.

Order screens are written to the same rule as the API: a buyer sees the handover code, the driver sees a box to type it
in and never the code, and the payout bank details only reach the farmer who owns them.

Every page is checked at 360, 640, 768, 1024 and 1440 px for horizontal overflow. Below `md` the navigation collapses
into a menu button.

## Environment checklist

Only these two files belong in git: `server/.env.example` and `client/.env.example`. Copy them, fill the values, and
never commit the result.

**Server (`server/.env`)** — the boot refuses to start on a missing or malformed value and names the key that failed:

| Key | Needed for | Notes |
| --- | --- | --- |
| `MONGODB_URI` | always | Atlas connection string. Create a database user rather than using the cluster owner |
| `JWT_SECRET` | always | 64 hex characters: `node -p "require('crypto').randomBytes(32).toString('hex')"` |
| `CLIENT_ORIGIN` | always | Comma separated browser origins allowed to call the API |
| `MAIL_PROVIDER` + `BREVO_API_KEY`, `MAIL_FROM_EMAIL` | everything that reaches a user | The only outbound channel: codes, handover codes, reset links. `console` prints mail and is refused in production |
| `PUBLIC_APP_URL` | always | Base URL inside emailed links. Set to the deployed web app |
| `PAYMENT_PROVIDER` + `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET` | taking money | `mock` is refused in production. Test keys first, live keys at launch |
| `STORAGE_PROVIDER` + `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | real images | `local` writes under `server/uploads` and is refused in production, because a container has no durable disk |
| `PUBLIC_API_URL` | `STORAGE_PROVIDER=local` | Base URL the image links are built from |

**Client (`client/.env`)** — leave `VITE_API_BASE_URL` empty when a reverse proxy serves `/api/v1` from the same origin
as the app, which is the usual deployment. Set it to the full versioned URL (`https://api.example.com/api/v1`) only when
the API lives on another host. The dev server already proxies `/api` to `http://localhost:4000`, so nothing is needed
locally.

After the first boot: `GET /api/v1/platform` should answer, then create an admin and a driver with
`npm run seed:account`, then set the real commission, dispute window and support contacts in the admin console before
any farmer is invited.

## Deploying

The backend is deployable now: `npm run build` produces `dist/`, `npm start` runs it, `/health` answers for a load
balancer, the process exits with a named error when the environment is wrong rather than booting half ready, and it
connects to Atlas with `retryWrites` and a timeout. Nothing here needs Docker or a container of your own making — any
Node 22 host that can read the environment will run it. Before taking traffic, note what production actually refuses:
`MAIL_PROVIDER=console`, `STORAGE_PROVIDER=local` and `PAYMENT_PROVIDER=mock` all fail the boot, so Brevo, Cloudinary and
Paystack keys are required. With `MAIL_PROVIDER=console` the code is printed to the log instead of emailed, which is
usable for a test and useless to a real buyer.

The frontend is a static build: `npm run build` in `client/` typechecks then produces `dist/` (about 151 kB gzipped of JS
plus the 8 marketing photos under `public/images`). Point the host at `index.html` for all routes, because the app is a
single page application and a deep link to `/orders/123` must not 404.

Not yet in place, and worth doing before a public launch: backups of the Atlas cluster, a shared rate limit store (the
limiters are in process memory, so more than one instance multiplies every limit), log shipping, and a real SSL
termination in front of both.

## Deploying to Render

`render.yaml` at the repo root is a Render blueprint that creates both services in one pass. Push the branch, then in the
Render dashboard choose **New > Blueprint**, connect the GitHub repository, and Render reads that file. Secrets marked
`sync: false` are asked for in the dashboard form, so no key ever sits in git. A `NODE_VERSION` of 22 is pinned because
Vite 8 needs Node 22.12 or later, and Render would otherwise pick its own default.

**Order matters.** The web service is created first, so create it, wait for its URL, then set the two values that point
at each other:

| Where | Variable | Value |
| --- | --- | --- |
| API web service | `CLIENT_ORIGIN` | The static site URL exactly as Render gives it, e.g. `https://halallivestocks.onrender.com`. No trailing slash and no path |
| API web service | `PUBLIC_APP_URL` | Same static site URL. Email links are built from it |
| API web service | `PUBLIC_API_URL` | The API URL, e.g. `https://halal-livestocks-api.onrender.com`. Only matters for image URLs |
| Static site | `VITE_API_BASE_URL` | The API URL **plus** `/api/v1`, e.g. `https://halal-livestocks-api.onrender.com/api/v1` |

`VITE_API_BASE_URL` is baked into the bundle when Vite builds, not read at runtime, so changing it needs a redeploy of
the static site. `CLIENT_ORIGIN` is read when the API boots, so a restart is enough there.

The blueprint also declares the SPA rewrite (`/*` → `/index.html`, rewrite 200), so deep links such as `/marketplace`
and `/orders/:id` resolve without a manual dashboard step. A rewrite keeps the address in the browser intact; a redirect
would change it to `/index.html` and make the app render from the wrong URL.

**Then open Atlas.** The API's egress address has to be in the cluster's IP access list, or every request dies with a
connection timeout rather than an application error. The addresses are on the web service page under **Connect >
Outbound**. Free instances share addresses that can change after a redeploy, so re-check the list when the API suddenly
cannot reach the database; a paid instance gives you addresses that do not move.

**Then the webhook.** In the Paystack dashboard add `https://<api-url>/api/v1/payments/webhook` and turn on the
`charge.success` and `charge.complete` events, which are the two this handler reads. Copy the secret Paystack generates
into `PAYSTACK_WEBHOOK_SECRET` and restart the API. The signature check has nothing to compare against until that value
matches Paystack's, and an order can also be funded by the buyer's own `POST /orders/:id/payment-check` call, so a
missing webhook delays the loop rather than breaking it.

Two things to expect from the free tier: an idle API sleeps and the first request after a pause waits about 50 seconds,
and the deploy health check is `/health` at the root, not under `/api/v1`.

### If you would rather not use the blueprint

Both services can be made by hand with the same values.

| Setting | API (Render Web Service) | Web app (Render Static Site) |
| --- | --- | --- |
| Repository | `Webmyn001/halal-livestock` | same |
| Root directory | `server` | `client` |
| Runtime | Node | static |
| Build command | `npm ci && npm run build` | `npm ci && npm run build` |
| Start command | `npm start` | — |
| Publish directory | — | `dist` |
| Health check path | `/health` | — |
| Environment | the whole `server/.env` list, with `NODE_ENV=production` | `VITE_API_BASE_URL` |

`npm ci` works because both `package-lock.json` files are committed, and Render's own `PORT` is honored: the server
binds `env.PORT` and exits cleanly on `SIGTERM`, so Render's restart cycle does not orphan a Mongo connection. Render
terminates SSL for its own `onrender.com` addresses, so the SSL line above is about a custom domain in front of your own
host, not about this setup.

## Open product decisions

The commission (default 5%, configurable) and the dispute window (default 7 days, configurable) are live
`PlatformSettings` values, so the sign-off is a settings change rather than a release. Still open: who pays platform
delivery fees, transit mortality liability per delivery model, and who qualifies as an authorized halal slaughterer for
the MVP. Automatic payout release when the dispute window closes without a case is **not** implemented — the admin
releases by hand, which is the safer default while the ledger is small.
