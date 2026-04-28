# XETA API Spec — High-level

All API requests/response use JSON. Protected endpoints require `Authorization: Bearer <Clerk_JWT>` (server verifies Clerk JWT and ensures a local `users` record exists).

## Auth

- POST /api/auth/verify
  - Description: Server endpoint to validate Clerk JWT and return local user profile (creates user if not exists).
  - Headers: `Authorization: Bearer <Clerk_JWT>`
  - Response: `{ "user": { "id": 1, "clerk_id": "clerk_abc", "email": "user@example.com", "name": "User", "role": "customer" } }`

## Products

- GET /api/products
  - Query: `?page=1&per_page=12&search=keyboard&category=mouse`
  - Response: `{ "data": [ { "id": 1, "sku": "KB-001", "title": "Mechanical Keyboard", "price": 2999, "images": ["https://..."], "stock": 12 }, ... ], "meta": {"total": 42} }

- GET /api/products/{id}
  - Response: product object with description, variants, images.

- POST /api/admin/products (admin only)
  - Body: `{ "title": "...", "sku": "...", "price": 2999, "stock": 10, "description": "..." }`
  - Response: created product object

- PUT /api/admin/products/{id}
- DELETE /api/admin/products/{id}

## Cart

- GET /api/cart
  - Returns current user/cart items

- POST /api/cart/items
  - Body: `{ "product_id": 1, "quantity": 2, "variant_id": null }`

- PUT /api/cart/items/{id}
- DELETE /api/cart/items/{id}

## Checkout / Orders

- POST /api/checkout
  - Body example for COD:
    {
      "cart_id": 123,
      "shipping": { "name": "Juan Dela Cruz", "address": "123 Main St" },
      "payment_method": "COD"
    }
  - Response: `{ "order": { "id": 501, "status": "pending", "total": 3299 } }`

- GET /api/orders (user)
- GET /api/admin/orders (admin view)
- GET /api/orders/{id}

## Uploads

- POST /api/uploads
  - Multipart/form-data, returns `{ "url": "https://..." }`

## Notes & Conventions

- Use standard HTTP status codes (200 OK, 201 Created, 401 Unauthorized, 403 Forbidden, 422 Validation Error)
- All write operations require authenticated user; admin operations require `role=admin`
- Pagination uses `page` & `per_page` and returns `meta` with `total` count

## Example: Product List Response

```
{
  "data": [
    {
      "id": 1,
      "title": "Mechanical Keyboard",
      "sku": "KB-001",
      "price": 2999,
      "currency": "PHP",
      "stock": 12,
      "images": ["https://.../kb1.jpg"]
    }
  ],
  "meta": { "page": 1, "per_page": 12, "total": 42 }
}
```

If you want, I can convert this to an OpenAPI YAML/JSON file next.  
