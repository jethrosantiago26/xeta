# XETA — D2C E‑commerce Platform

Team: <Your Name(s)>
Course: Final Project
Date: April 2026

---

## Elevator pitch

XETA is a direct-to-consumer e-commerce platform for computer peripherals that connects small-batch sellers with end users via a simple storefront and lightweight admin panel.

Notes: Keep the opening one-liner punchy and audience-focused.

---

## Problem & Opportunity

- Fragmented local marketplace for computer peripherals
- Sellers lack a simple storefront + order management
- Buyers want reliable product info, stock visibility, and simple checkout (COD preferred locally)

Notes: Use a quick real-world example to ground the problem.

---

## Target Users & Goals

- Primary: Consumers buying peripherals (key goals: discoverability, trust, quick checkout)
- Secondary: Store owners / admins (key goals: easy product management, order tracking)

Success metrics: conversion rate, average order value, time-to-list a product.

---

## Proposed Solution

- Responsive React storefront with search, filters, and product pages
- Secure Clerk-based authentication (JWT validated server-side)
- Laravel API with role-based admin routes
- Cash-on-delivery checkout flow for local convenience
- Simple admin panel for products and orders

---

## Core Features (MVP)

- Public product catalog (list / detail / images / variants)
- Shopping cart + COD checkout
- User sign-in (Clerk) and persistent user records
- Admin: product CRUD, order dashboard, order status updates
- Image uploads and basic inventory fields

---

## Demo Flow (3–5 minutes)

1. Sign in with Clerk (or continue as guest if allowed)
2. Browse and filter products
3. Add product to cart and checkout (select COD)
4. Admin: accept order and mark as processing/delivered

Notes: Keep demo short—show 1 buyer flow and 1 admin flow.

---

## Architecture (high-level)

- Frontend: React + Vite (deployed on Vercel)
- Backend: Laravel API (deployed on Railway)
- Auth: Clerk (client + server JWT verification)
- Data: MySQL (Railway) + S3-compatible storage for images
- CI/CD: GitHub -> Vercel/Railway

See full architecture notes: [docs/architecture.md](architecture.md)

---

## API (overview)

Key endpoints and contract summary: see [docs/api-spec.md](api-spec.md).

(Short examples: public GET /api/products, POST /api/checkout for COD.)

---

## Tech Stack

- Frontend: React, Vite, Clerk, Axios
- Backend: Laravel, Eloquent, MySQL
- Deployment: Vercel (frontend), Railway (backend)
- Auth: Clerk JWT validation server-side

---

## Security & Auth

- Authorization: `Authorization: Bearer <Clerk_JWT>` for protected endpoints
- Server verifies Clerk token and creates the `users` row if missing (fields: `id`, `clerk_id`, `email`, `name`, `role`)
- Admin-only routes protected via middleware

---

## Run locally (recommended demo commands)

Backend (Laravel):

```
cd backend
composer install
cp .env.example .env
# configure DB and CLERK env vars in .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --port=8000
```

Frontend (Vite):

```
cd frontend
npm install
npm run dev
# open http://localhost:5173
```

Notes: ensure Clerk env vars are set locally and allowed origins configured in Clerk dashboard.

---

## Timeline & Milestones

- Weeks 1–2: project scaffolding, auth integration, DB modeling
- Weeks 3–4: product catalog, cart, checkout
- Week 5: admin panel, order management
- Week 6: polish, testing, deploy, final report

---

## Risks & Mitigations

- Integration complexity with Clerk → write small token verification tests
- Image uploads/storage → use signed uploads and fallback to local storage in dev
- Migrations/data loss → use seeders and DB snapshots during demos

---

## Future Work

- Payment gateway (cards) and refunds
- Vendor onboarding + multi-tenant features
- Analytics dashboard and recommendations

---

## Questions

Thank you — ready to demo now.
