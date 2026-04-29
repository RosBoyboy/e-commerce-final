# Technical Architecture: Layout & Routing System

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         _app.jsx                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Context Providers (Global - Never Unmount)                  ││
│  │ ├─ AuthProvider {user, loading, logout}                    ││
│  │ ├─ CartProvider {items, addItem, removeItem}               ││
│  │ ├─ WishlistProvider {wishlist, addToWishlist}              ││
│  │ ├─ ToastProvider {showToast}                               ││
│  │ └─ MessageUnreadProvider {unreadCount}                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                             ↓                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │             Layout.jsx (Smart Router)                       ││
│  │  Analyzes: router.pathname, user.role                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                             ↓                                     │
│           ┌─────────────────┼─────────────────┐                 │
│           ↓                 ↓                 ↓                  │
│    ┌────────────┐   ┌─────────────┐   ┌─────────────┐          │
│    │ Dashboard  │   │   Shop      │   │   Public    │          │
│    │  Routes    │   │   Routes    │   │   Routes    │          │
│    │            │   │             │   │             │          │
│    │ /dashboard │   │ /products   │   │ /           │          │
│    │ /dashboard │   │ /product/:id│   │ /about      │          │
│    │   /admin   │   │             │   │             │          │
│    │ /dashboard │   │             │   │             │          │
│    │ /customer  │   │             │   │             │          │
│    └────────────┘   └─────────────┘   └─────────────┘          │
│           ↓                 ↓                 ↓                  │
│    ┌────────────┐   ┌─────────────┐   ┌─────────────┐          │
│    │ Page's Own │   │ Layout.jsx  │   │ Standard    │          │
│    │   Shell    │   │ wraps with  │   │ Layout with │          │
│    │            │   │ CustomerShell│  │ Navbar +    │          │
│    │ AdminShell │   │    (IF auth) │   │ Footer      │          │
│    │ Customer   │   │             │   │             │          │
│    │   Shell    │   │ "shop" key  │   │             │          │
│    │ RiderLayout│   │  activeKey  │   │             │          │
│    └────────────┘   └─────────────┘   └─────────────┘          │
│           ↓                 ↓                 ↓                  │
│    ┌────────────┐   ┌─────────────┐   ┌─────────────┐          │
│    │  Sidebar   │   │   Sidebar   │   │ Navigation  │          │
│    │  (Dark)    │   │ (Customer)  │   │   + Footer  │          │
│    │            │   │             │   │             │          │
│    │ Dashboard  │   │ Overview    │   │ Home, About │          │
│    │ Orders     │   │ Orders      │   │ Products    │          │
│    │ Products   │   │ Wishlist    │   │ Contact     │          │
│    │ Analytics  │   │ Profile     │   │             │          │
│    │ Settings   │   │ Shop ← NEW  │   │             │          │
│    │ Messages   │   │ Messages    │   │             │          │
│    │            │   │             │   │             │          │
│    └────────────┘   └─────────────┘   └─────────────┘          │
│           ↓                 ↓                 ↓                  │
│    ┌────────────┐   ┌─────────────┐   ┌─────────────┐          │
│    │   Page     │   │   Page      │   │   Page      │          │
│    │  Content   │   │  Content    │   │  Content    │          │
│    │            │   │             │   │             │          │
│    │ admin.jsx  │   │products.jsx │   │ index.jsx   │          │
│    │            │   │product/[id].│   │ about.jsx   │          │
│    │customer.jsx│   │ jsx         │   │             │          │
│    │            │   │             │   │             │          │
│    └────────────┘   └─────────────┘   └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Route Detection Logic (Layout.jsx)

```javascript
┌─ Route Request Comes In
│
├─ Check: router.pathname
│  ├─ Is it a dashboard route? (/dashboard/*)
│  │  └─ YES: Let page handle with its own shell
│  │         (AdminShell, CustomerShell, RiderLayout)
│  │
│  ├─ Is it a messaging route? (/messages)
│  │  └─ YES: Let page handle with its own wrapper
│  │
│  └─ Is it a shop route? (/products, /product/:id)
│     ├─ YES:
│     │  └─ Check: Is user authenticated?
│     │     ├─ NO: Render standard layout (navbar + footer)
│     │     │
│     │     └─ YES: Check user role
│     │        ├─ Is admin?
│     │        │  └─ YES: Standard layout (admins don't use customer shell)
│     │        │
│     │        └─ Not admin?
│     │           └─ YES: Wrap in CustomerShell ✓
│     │               └─ activeKey = "shop"
│     │
│     └─ NO: Public route
│        └─ Standard layout (navbar + footer)
│
└─ Render appropriate layout
```

## Data Flow During Navigation

### Example: Dashboard → Shop → Dashboard

```
STEP 1: User at /dashboard/customer
┌─────────────────────────────┐
│ CustomerShell (from page)   │  ← Rendered by customer.jsx
│ ├─ Sidebar (active: overview)
│ └─ Page content             │
└─────────────────────────────┘
Context: {user, cart, wishlist} - ACTIVE


STEP 2: User clicks "Shop" link
router.push('/products')
│
↓ Navigation begins (no context unmount)
│
Context: {user, cart, wishlist} - STILL ACTIVE ✓


STEP 3: Route transitions to /products
Layout.jsx evaluates:
├─ isShopPage? YES
├─ user exists? YES
└─ user.role = 'customer'? YES
│
↓ Decision: Wrap in CustomerShell


STEP 4: New render
┌─────────────────────────────┐
│ Layout.jsx                  │  ← Smart wrapper
│ └─ CustomerShell (new)      │  ← Wraps page content
│    ├─ Sidebar (active: shop)   ← "Shop" now active
│    └─ Page content             ← products.jsx
└─────────────────────────────┘
Context: {user, cart, wishlist} - STILL ACTIVE ✓

✅ Sidebar PERSISTS (no visual shift)
✅ Theme context PRESERVED (no re-initialization)


STEP 5: User clicks "Overview" in sidebar
router.push('/dashboard/customer')
│
↓ Navigation begins (no context unmount)
│
Context: {user, cart, wishlist} - STILL ACTIVE ✓


STEP 6: Route transitions back to /dashboard/customer
Layout.jsx evaluates:
├─ isDashboard? YES
│
↓ Decision: Let page handle its own shell


STEP 7: Final render
┌─────────────────────────────┐
│ customer.jsx (page)         │  ← Page's own wrapper
│ └─ CustomerShell (from page)│  
│    ├─ Sidebar (active: overview)
│    └─ Page content
└─────────────────────────────┘
Context: {user, cart, wishlist} - STILL ACTIVE ✓

✅ Sidebar remains visible (consistent experience)
✅ Theme context preserved throughout journey
```

## Props Flowing Through Shell

```
Layout.jsx
  │
  ├─ Pass children (page content)
  │
  └─ Pass activeKey prop
     │
     ├─ When on dashboard: activeKey from page
     │  (e.g., "overview", "orders")
     │
     └─ When on shop: activeKey = "shop"
        │
        ↓
     CustomerShell receives:
     ├─ children (products.jsx or product/[id].jsx)
     ├─ activeKey = "shop"
     │
     └─ Renders:
        ├─ Sidebar with all nav items
        ├─ "Shop" link highlighted (activeKey match)
        └─ children content
```

## Context Isolation

```
All providers at _app.jsx level mean:

┌─ user.js (AuthContext)
│  └─ Mounted ONCE at app boot
│  └─ Persists across ALL routes
│  └─ Route changes don't remount
│  └─ User data always available
│
├─ cart.js (CartContext)
│  └─ Mounted ONCE at app boot
│  └─ Items persist across routes
│  └─ Route changes don't clear cart
│  └─ Add to cart on shop → persists to dashboard
│
├─ wishlist.js (WishlistContext)
│  └─ Mounted ONCE at app boot
│  └─ Wishlist persists across routes
│  └─ Route changes don't clear wishlist
│
└─ theme/toast (ToastProvider)
   └─ Mounted ONCE at app boot
   └─ Toast notifications work everywhere
   └─ One toast system for all routes

✅ NO re-initialization on route change
✅ NO data loss on navigation
✅ NO provider remounting
✅ UNIFIED state across app
```

## Fallback Behavior

```
What happens if edge cases occur?

Scenario 1: User NOT authenticated, on /products
├─ isAuthenticatedOnShop = false (user is null)
└─ Render: Standard layout with navbar + footer
   └─ User sees public shop view ✓

Scenario 2: Admin user on /products
├─ isAuthenticatedOnShop = false (admin role excluded)
└─ Render: Standard layout with navbar + footer
   └─ Admin sees public shop view (no customer shell) ✓

Scenario 3: Rider user on /products
├─ isAuthenticatedOnShop = false (not customer role)
└─ Render: Standard layout with navbar + footer
   └─ Rider sees public shop view ✓

Scenario 4: Customer navigates directly to URL /products
├─ isAuthenticatedOnShop = true
└─ Render: Wrapped in CustomerShell automatically
   └─ Sidebar appears ✓

Scenario 5: Session expires while on /products
├─ AuthContext updates (user = null)
├─ Layout re-evaluates
├─ isAuthenticatedOnShop = false
└─ Layout switches to public view gracefully ✓
```

## Performance Implications

```
Route Navigation Performance:

BEFORE (Broken):
  Old Page Unmount → Remove shell → Mount Layout → Mount navbar/footer
  → New Page Mount → New Page renders shell → Add sidebar
  = Multiple visual shifts, flashes, re-layouts

AFTER (Fixed):
  Old Page Unmount → Keep Context ✓ → Keep Providers ✓
  → Layout detects route → Apply appropriate wrapper
  → New Page Mount → Render in pre-existing shell
  = Smooth, consistent rendering


Re-render Optimization:
  Layout.jsx only re-evaluates:
  ├─ On route change (router.pathname)
  ├─ On user change (user object)
  └─ On user role change (user.role)
  
  = Minimal re-renders
  = No unnecessary wrapper unmounting
  = Efficient context preservation
```
