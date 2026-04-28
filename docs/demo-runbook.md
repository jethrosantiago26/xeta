# Demo Runbook — XETA

Purpose: Step-by-step instructions to prepare and run the live demo (buyer + admin flows). Keep these steps visible during the presentation.

---

## Pre-demo environment

Requirements:
- PHP 8.x, Composer
- Node 18+ and npm
- MySQL (or Railway connection)
- Clerk account with dev keys (or Clerk test mode)

Ports used in local dev:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

---

## Prepare backend (run from project root)

```bash
cd backend
composer install
cp .env.example .env
# Edit .env and set DB_* and CLERK_* variables
php artisan key:generate
php artisan migrate --seed
php artisan serve --port=8000
```

Notes:
- If you use an external DB, set `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` in `.env`.
- Ensure Clerk keys are set: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (or Clerk local/test config).

---

## Prepare frontend

```bash
cd ../frontend
npm install
npm run dev
# open http://localhost:5173
```

---

## Creating demo users (optional)

If you need a local admin record, you can create one via tinker:

```bash
cd backend
php artisan tinker
>>> \App\Models\User::create([ 'clerk_id' => 'demo-admin', 'email' => 'admin@example.com', 'name' => 'Admin', 'role' => 'admin' ]);
```

Adjust fields to match your `User` model.

---

## Demo script (step-by-step)

1. Buyer flow (2–3 minutes)
   - Open buyer window; sign in via Clerk or continue as seeded demo user.
   - Browse products; open a product detail.
   - Add to cart → Checkout → Select `COD` → Place order.
   - Copy the displayed order ID for admin verification.

2. Admin flow (1–2 minutes)
   - Open admin window (incognito to keep sessions separate).
   - Sign in as admin.
   - Navigate to Orders → find the order by ID → change status to `processing` then `delivered`.
   - Show status change reflected in the UI.

3. Data verification (optional, 30s)
   - Use `php artisan tinker` or a DB client to `select * from orders where id = <order_id>`.

---

## Troubleshooting checklist

- Frontend blank or CORS errors: check Clerk origins and `VITE_*` keys in frontend config.
- 500 errors: check `storage/logs/laravel.log` and backend console output.
- Seed data missing: run `php artisan migrate --seed` again.

---

## Fallbacks

- If Clerk is unavailable, use seeded demo users and bypass external auth for the demo.
- If backend deployment is unstable, show a recorded screen capture or screenshots located in `docs/`.

---

## Timing suggestions (when rehearsing)

- Run through the entire demo once to validate times: the buyer + admin flows should fit in ~5 minutes.
- Reserve 2–3 minutes for architecture + Q&A.

---

References: [docs/panelist-guide.md](panelist-guide.md), [docs/api-spec.md](api-spec.md), [docs/architecture.md](architecture.md)
