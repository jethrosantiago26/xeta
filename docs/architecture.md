# XETA Architecture — Overview

## High-level components

- Frontend: React + Vite (deployed on Vercel)
- Auth: Clerk (client SDK + server-side JWT validation)
- Backend API: Laravel (API-only) deployed on Railway
- Database: MySQL (Railway managed)
- Storage: S3-compatible for product images
- CI/CD: GitHub -> Vercel (frontend) / Railway (backend)

## ASCII diagram

```
[User Browser]
     |
     |  (1) React + Clerk (Vercel)
     v
[Frontend (Vite)] ---(API calls w/ Clerk JWT)---> [Laravel API (Railway)]
                                              |         |
                                              |         +--> MySQL (orders, products, users)
                                              |
                                              +--> S3 storage (images)

Auth flow: Clerk issues JWT -> Frontend sends JWT to Laravel -> Laravel verifies via Clerk SDK or introspection -> Laravel creates/attaches local `users` row if missing
```

## Data model highlights

- `users`: id, clerk_id, email, name, role
- `products`: id, sku, title, description, price, stock, metadata
- `orders`: id, user_id, total, status, payment_method, shipping_address
- `order_items`: id, order_id, product_id, qty, unit_price
- `images`: id, model_type, model_id, url

## Operational notes

- Keep Clerk client origins configured for local dev (http://localhost:5173) and production domains.
- Use environment-specific secrets on Railway and Vercel; never commit `.env` values.
- Add basic logging + monitoring (Railway logs, Vercel logs); consider Sentry for errors.

---

If you'd like, I can generate a PNG diagram (SVG) next for inclusion in slides or README.
