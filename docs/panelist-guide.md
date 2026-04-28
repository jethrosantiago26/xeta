# Panelist Guide — XETA Final Project Presentation

Team: <Your Name(s)>
Contact: <email@example.com>

Purpose: Quick reference for panelists during the live demo. Use this to follow the agenda, run the demo, and ask informed questions.

---

## Elevator pitch (15s)

XETA is a direct-to-consumer e-commerce platform for computer peripherals that enables sellers to list products quickly and buyers to checkout using cash-on-delivery.

---

## Recommended timing (total: 10 minutes)

- Intro & problem: 1m
- Demo (buyer + admin): 4m
- Architecture & tech highlights: 2m
- Wrap-up + Q&A: 3m

Adjust to your allotted slot.

---

## Agenda & roles (sample)

- Presenter A (Intro, problem, solution) — 60s
- Presenter B (Live demo: buyer flow, checkout) — 2.5–3m
- Presenter A (Admin flow, architecture, security) — 2m
- Presenter B (Wrap-up, next steps) — 30s
- Q&A — remaining time

Suggested script snippets:
- Intro: “We built XETA to simplify local sales of computer peripherals…”
- Demo start: “I’ll place a sample order as a buyer, then we’ll process it from the admin dashboard.”
- Architecture: “Frontend is React + Vite; backend is Laravel API; auth via Clerk with server-side JWT verification.”

---

## Key talking points (keep them short)

- Problem: fragmented local marketplace and no simple storefront for sellers.
- MVP solution: product catalog, cart, COD checkout, and a simple admin panel for order management.
- Security: Clerk handles authentication; server verifies JWTs and creates local `users` records (fields: `id`, `clerk_id`, `email`, `name`, `role`).
- Deploy & infra: Vercel for frontend, Railway for backend, MySQL for data, S3-compatible storage for images.

---

## Demo flow (brief)

Follow the detailed steps in the runbook: [Demo Runbook](demo-runbook.md).

High-level:
1. Buyer: sign in, browse, add to cart, checkout (choose COD).
2. Admin: sign in to admin view, find order, update status to processing → delivered.
3. Verify order presence in order list / DB.

---

## What to show (URLs & routes)

- Frontend root: `http://localhost:5173/` (or deployed URL)
- Product page: open any product and show images, price, variants
- Cart & checkout: show COD option and confirmation with order ID
- Admin dashboard: `http://localhost:5173/admin` (orders list)

---

## Pre-demo checklist

- Backend: dependencies installed, `.env` configured (`DB_*`, `CLERK_*`), migrations run
- Frontend: `npm install` and `npm run dev` running
- Open two browser windows: buyer and admin (incognito for separate sessions)
- Have seeded/demo accounts ready (or Clerk test mode configured)

Quick commands (run from project root):

```bash
# Backend
cd backend
composer install
cp .env.example .env
# edit .env: set DB and CLERK keys
php artisan key:generate
php artisan migrate --seed
php artisan serve --port=8000

# Frontend
cd ../frontend
npm install
npm run dev
```

---

## Troubleshooting (quick fixes)

- Auth errors: confirm `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in backend `.env`; check allowed origins in Clerk dashboard.
- DB errors: re-run `php artisan migrate --seed` and check `.env` DB connection settings.
- Missing images: confirm storage keys or use local storage fallback in dev.
- If live services fail: fall back to recorded demo or screenshots in `docs/`.

---

## Questions panelists might ask (and short answers)

- Why Clerk? — Quick, secure auth with client SDK + server verification; reduces engineering time for auth.
- Why COD only? — Local preference for initial MVP; payments planned as future work.
- How do you handle uploads? — S3-compatible signed uploads in production; local storage in dev.

---

## References

- Demo runbook: [docs/demo-runbook.md](demo-runbook.md)
- API spec: [docs/api-spec.md](api-spec.md)
- Architecture: [docs/architecture.md](architecture.md)
- Presentation notes: [docs/final-presentation.md](final-presentation.md)

---

Thanks — ready to demo.