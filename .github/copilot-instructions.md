# XETA Project Guidelines

## Project Scope
- XETA is a D2C e-commerce system for computer peripherals.
- Frontend: React with Vite, npm, Clerk authentication.
- Backend: Laravel API-only application.
- Payments: cash on delivery.
- Deployment targets: frontend on Vercel, backend on Railway.

## Working Style
- Work incrementally and follow the agreed phase order.
- After completing a step, stop and wait for confirmation before continuing.
- Always generate real code, not pseudo code.
- Clearly state every file path that is created or modified.
- Prefer focused changes that solve the root cause.

## Required Architecture
- Clerk handles authentication in the React frontend.
- Laravel verifies Clerk JWT tokens on the backend.
- If a user does not exist, create it in the database and attach it to the request.
- Store users with `id`, `clerk_id`, `email`, `name`, and `role` (`admin` or `customer`).
- Keep frontend code in `frontend/` and backend code in `backend/`.

## Implementation Order
1. Project setup
2. Authentication
3. Database and models
4. Core APIs
5. Frontend pages
6. Admin panel
7. Cash on delivery checkout
8. Optimization and security

## Backend Expectations
- Use Laravel migrations, Eloquent models, form requests, API resources, controllers, services, and middleware.
- Keep API logic separate from presentation concerns.
- Use role-protected admin routes and middleware for administrative features.

## Frontend Expectations
- Build the UI in React with Vite.
- Use Clerk for sign-in and protected routes.
- Keep API access centralized behind a client that attaches the Clerk token.
- Build reusable product, cart, and layout components before page composition.

## File Discipline
- Favor small, deliberate edits over broad rewrites.
- Do not mix unrelated backend and frontend refactors in the same step unless the current phase requires it.
- Update documentation and environment files when configuration changes.

## Response Pattern
- Present work in step form.
- Include the files to create or modify for the current step.
- Stop after each completed step and wait for approval before proceeding.
