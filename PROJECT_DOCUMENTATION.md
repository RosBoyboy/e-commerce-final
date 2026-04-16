# UrbanNxt - E-Commerce System

## Overview
A full-stack e-commerce system for modern shopping experiences. The application is built with a **Laravel (API backend)** and a **Next.js (frontend)**, supporting **multi-role access** (Customer, Rider, Admin) and core e-commerce operations like products, categories, cart, orders, messaging, and order fulfillment.

## Requirements
- Backend: **PHP 8.1+** (project allows `^7.4|^8.1`, but PHP 8.1 is recommended), **Composer**
- Frontend: **Node.js 18+**, **npm**
- Database: **MySQL 8.0+**

## Development Frameworks
- Frontend: **Next.js 14** (React 18), Axios, Laravel Echo, Pusher JS
- Backend: **Laravel 8.x** (Sanctum auth, API routes, validation, CORS)
- Database: **MySQL**

## Tools and Services Used
| Tool / Service | Purpose |
|---|---|
| Railway | Backend deployment (Laravel API + MySQL) |
| InfinityFree (or similar) | Free backend hosting (PHP + MySQL) for demos |
| Vercel | Frontend deployment (Next.js) |
| Pusher | Real-time broadcasting for messaging |
| Laravel Echo | WebSocket client for real-time updates |
| MySQL | Relational database |
| Docker | Container setup for local deployment (see `Dockerfile`) |

## Project Structure
```text
ecommmerce-draft/  (Laravel backend - API)
├── app/               # Models, controllers, middleware, events
├── database/         # Migrations + seeders
├── routes/           # API routes (endpoints)
├── public/           # Laravel public entrypoint
├── storage/          # App storage
└── ...other Laravel files

frontend/            (Next.js frontend)
├── src/
│   ├── pages/       # Auth, dashboards, checkout, messages
│   ├── context/     # Auth context + token handling
│   ├── services/   # API client helpers
│   └── lib/         # Echo / realtime helpers
└── public/          # Frontend static assets
```

## Installation

### Prerequisites
1. Install **PHP**, **Composer**
2. Install **Node.js (18+)** and **npm**
3. Install and run **MySQL 8+**

### Backend Setup (Laravel API)
1. Go to the project root.
2. Install dependencies:
   ```bash
   composer install
   ```
3. Create `.env` from example:
   ```bash
   copy .env.example .env
   ```
4. Configure MySQL values in `.env`:
   - `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
5. Configure broadcasting (optional but recommended for real-time):
   - `BROADCAST_DRIVER=pusher`
   - `PUSHER_APP_KEY`, `PUSHER_APP_SECRET`, `PUSHER_APP_CLUSTER`
6. Generate Laravel app key:
   ```bash
   php artisan key:generate
   ```
7. Run migrations and seed demo data:
   ```bash
   php artisan migrate --seed
   ```
8. Start backend (local dev):
   ```bash
   php artisan serve --host=127.0.0.1 --port=8000
   ```

### Frontend Setup (Next.js)
1. Go to `frontend/`:
   ```bash
   cd frontend
   ```
2. Create `.env.local` from example (or edit `.env.example`):
   ```bash
   copy .env.example .env.local
   ```
3. Update environment variables if needed (the default example points to your local API):
   - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api`
4. Install frontend dependencies:
   ```bash
   npm install
   ```
5. Start frontend:
   ```bash
   npm run dev
   ```

## Features

### Customer Features
- Browse products and categories
- Manage cart (add/update/remove cart items)
- Checkout and place orders (creates orders via API)
- View customer orders
- Wishlist support
- Messaging via conversations and messages (unread count + mark-all-read)
- Apply checkout promo codes (frontend pricing adjustment)

### Rider Features
- View assigned/past rider orders
- View rider stats
- Update rider profile
- Mark orders as delivered and picked up

### Admin Features
- System statistics (dashboard metrics)
- User management:
  - List users, archive/restore/delete in batches
  - Archive/restore single users
- Orders management:
  - Update order status
  - Assign a rider
  - Inventory report
- Product and category management:
  - Approve/reject products
  - Archive/restore/delete products in batches
  - CRUD for categories
- Store settings management:
  - Enable/disable coupons, maintenance mode, email/sms options, and 2FA flag

## Default Login Credentials (from database seeders)
> Password is the same for all seeded demo accounts: `password123`

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `password123` |
| Customer | `customer@example.com` | `password123` |
| Seller | `seller@example.com` | `password123` |
| Rider | `marnel@rider.com` | `password123` |
| Rider | `jeban@rider.com` | `password123` |

## API Endpoints
**Base URL:** `http://localhost:8000/api`

### Authentication
1. `POST /auth/register`
2. `POST /auth/login`
3. `GET /auth/user` (protected)
4. `POST /auth/logout` (protected)

### Products / Categories (public)
1. `GET /products`
2. `GET /products/{id}`
3. `GET /categories`

### Customer Orders (protected)
1. `GET /orders`
2. `POST /orders`
3. `PATCH /orders/{id}/status`

### Cart (protected)
1. `GET /cart`
2. `POST /cart/items`
3. `PATCH /cart/items/{cartItem}`
4. `DELETE /cart/items/{cartItem}`

### Messaging / Conversations (protected)
1. `GET /conversations/unread-count`
2. `POST /conversations/mark-all-read`
3. `GET /conversations`
4. `GET /conversations/{id}`
5. `POST /conversations`
6. `POST /conversations/{id}/messages`

### Rider (protected)
1. `GET /rider/orders`
2. `GET /rider/stats`
3. `GET /rider/profile`
4. `PATCH /rider/profile`
5. `PATCH /rider/orders/{id}/deliver`
6. `PATCH /rider/orders/{id}/pickup`

### Admin (protected)
Dashboard / stats
1. `GET /admin/stats`

Users
1. `GET /admin/users`
2. `GET /admin/users/archived`
3. `POST /admin/users/archive-batch`
4. `POST /admin/users/permanent-batch`
5. `PATCH /admin/users/{id}/archive`
6. `PATCH /admin/users/{id}/restore`
7. `PUT /admin/users/{id}`
8. `DELETE /admin/users/{id}`

Orders / logistics
1. `GET /admin/orders`
2. `GET /admin/inventory-report`
3. `PATCH /admin/orders/{id}/status`
4. `PATCH /admin/orders/{id}/assign-rider`
5. `GET /admin/riders`
6. `PUT /admin/riders/{id}`

Products / categories
1. `GET /admin/products`
2. `POST /admin/products`
3. `PUT /admin/products/{id}`
4. `DELETE /admin/products/{id}`
5. `GET /admin/products/archived`
6. `POST /admin/products/archive-batch`
7. `POST /admin/products/permanent-batch`
8. `PATCH /admin/products/{id}/archive`
9. `PATCH /admin/products/{id}/restore`
10. `PATCH /admin/products/{id}/approve`
11. `PATCH /admin/products/{id}/reject`
12. `GET /admin/categories`
13. `POST /admin/categories`
14. `PUT /admin/categories/{id}`
15. `DELETE /admin/categories/{id}`

Settings
1. `GET /admin/settings`
2. `PUT /admin/settings`

## Security Features
- Token-based authentication using **Laravel Sanctum** (API routes are protected with `auth:sanctum`)
- Role-based access control:
  - Admin-only actions are guarded server-side
  - Messaging broadcast channel authorization checks access per conversation (seller/customer/admin)
- Input validation using Laravel `request->validate(...)` in controllers
- API throttling middleware: `throttle:api`
- CORS allowlist configuration (`config/cors.php`) with credentials enabled
- Real-time messaging security:
  - Broadcasting channels are authorized in `routes/channels.php`
  - Unauthorized access returns `403` where appropriate

## Database Schema (High-Level)
The system uses these core tables (from `database/ecommerce.dbml`):
- `roles`
- `users`
- `categories`
- `products`
- `riders`
- `orders`
- `order_items`
- `cart_items`
- `wishlists`
- `conversations`
- `messages`
- `store_settings`

## Quality Attributes (ISO/IEC 25010)
- Functional Suitability: Core e-commerce flows (catalog, cart, orders), multi-role dashboards, and messaging are implemented through defined API endpoints.
- Performance Efficiency: Optimized data access patterns via Eloquent queries and targeted endpoints per role.
- Compatibility: REST-style API design works cleanly with the Next.js frontend; CORS configuration supports common dev + deployment origins.
- Usability: Role-based routing and dashboard experiences make navigation predictable for each user type.
- Reliability: Middleware-based authorization, validation, and defensive checks reduce invalid state updates (e.g., access checks and 403 responses).
- Security: Sanctum auth, role-based controls, CORS allowlists, and protected broadcasting channels.
- Maintainability: Clean separation into `models/`, `routes/`, `controllers/`, `middleware/`, and `events/`.
- Portability: Docker support (`Dockerfile`) and standard PHP/Node toolchains simplify environment setup.

## Coupon Codes
> Promo codes are implemented in the frontend checkout flow (pricing adjustment). Discounts are calculated client-side before order creation.

| Code | Discount |
|---|---|
| `SAVE5` | 5% off |
| `WELCOME10` | 10% off |

