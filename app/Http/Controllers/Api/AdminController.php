<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\StoreSetting;
use App\Models\User;
use App\Models\Order;
use App\Models\Rider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    private function ensureAdmin(Request $request)
    {
        if (!$request->user() || !$request->user()->hasRole('admin')) {
            abort(403, 'Only admins can access this resource.');
        }
    }

    private function ensureCustomerAccount(User $user): void
    {
        if (!$user->hasRole('customer')) {
            abort(422, 'Only customer accounts can be managed here.');
        }
    }

    /**
     * Get dashboard statistics
     */
    public function stats(Request $request)
    {
        $this->ensureAdmin($request);
        $stats = [
            'totalUsers' => User::where('is_archived', false)->count(),
            'totalOrders' => Order::count(),
            'totalRevenue' => Order::sum('total_amount'),
        ];

        return response()->json([
            'stats' => $stats,
        ], 200);
    }

    /**
     * Get all users
     */
    public function users(Request $request)
    {
        $this->ensureAdmin($request);
        $users = User::with('role')
            ->where('is_archived', false)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'users' => $users,
        ], 200);
    }

    /**
     * Update user
     */
    public function updateUser(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $user = User::findOrFail($id);

        $validated = $request->validate(
            [
                'name' => 'nullable|string|max:255',
                'email' => 'nullable|string|email|max:255|unique:users,email,' . $id,
                'phone' => 'nullable|string|max:20',
                'address' => 'nullable|string',
                'role_id' => 'nullable|exists:roles,id',
            ],
            [
                'email.unique' => 'This email is already in use.',
            ]
        );

        $user->update(array_filter($validated));

        return response()->json([
            'message' => 'User updated successfully',
            'user' => $user->load('role'),
        ], 200);
    }

    /**
     * Delete user
     */
    public function deleteUser(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $user = User::findOrFail($id);
        $this->ensureCustomerAccount($user);
        if ((int) $user->id === (int) $request->user()->id) {
            abort(422, 'Invalid operation.');
        }
        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully',
        ], 200);
    }

    /**
     * Get all orders (admin)
     */
    public function orders(Request $request)
    {
        $this->ensureAdmin($request);
        $orders = Order::with([
            'customer:id,name,email,phone,address',
            'items.product:id,name,image,slug,seller_id',
            'rider.user:id,name,email',
        ])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['orders' => $orders], 200);
    }

    /**
     * Update any order status (admin)
     */
    public function updateOrderStatus(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $order = Order::with([
            'customer:id,name,email',
            'items.product:id,name,image,slug,seller_id',
        ])->findOrFail($id);
        $validated = $request->validate([
            // Delivered is set only by the assigned rider (RiderOrderController).
            'status' => 'required|string|in:pending,confirmed,processing,shipped,cancelled',
        ]);

        $newStatus = strtolower($validated['status']);
        $riderIdBefore = $order->rider_id;

        $payload = ['status' => $newStatus];
        if (!in_array($newStatus, ['shipped', 'delivered'], true) && $riderIdBefore) {
            $payload['rider_id'] = null;
        }
        $order->update($payload);
        Rider::syncAvailability($riderIdBefore, $order->fresh()->rider_id);

        return response()->json([
            'message' => 'Order status updated.',
            'order' => $order->fresh(['customer', 'items.product', 'rider.user']),
        ], 200);
    }

    /**
     * Built-in fleet riders (manage contact info).
     */
    public function riders(Request $request)
    {
        $this->ensureAdmin($request);
        $list = Rider::with('user:id,name,email')
            ->orderBy('id')
            ->get()
            ->map(fn (Rider $r) => [
                'id' => $r->id,
                'user_id' => $r->user_id,
                'name' => $r->user ? $r->user->name : null,
                'email' => $r->user ? $r->user->email : null,
                'phone' => $r->phone,
                'vehicle_plate' => $r->vehicle_plate,
                'address' => $r->address,
                'status' => $r->status,
            ]);

        return response()->json(['riders' => $list], 200);
    }

    public function updateRider(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $rider = Rider::with('user')->findOrFail($id);
        $validated = $request->validate([
            'name' => 'sometimes|nullable|string|max:255',
            'phone' => 'sometimes|nullable|string|max:32',
            'vehicle_plate' => 'sometimes|nullable|string|max:32',
            'address' => 'sometimes|nullable|string|max:2000',
        ]);

        if (!empty($validated['name']) && $rider->user) {
            $rider->user->update(['name' => $validated['name']]);
        }
        if (array_key_exists('phone', $validated)) {
            $rider->phone = $validated['phone'];
        }
        if (array_key_exists('vehicle_plate', $validated)) {
            $rider->vehicle_plate = $validated['vehicle_plate'];
        }
        if (array_key_exists('address', $validated)) {
            $rider->address = $validated['address'];
        }
        $rider->save();

        $rider->load('user:id,name,email');

        return response()->json([
            'message' => 'Rider updated.',
            'rider' => [
                'id' => $rider->id,
                'user_id' => $rider->user_id,
                'name' => $rider->user ? $rider->user->name : null,
                'email' => $rider->user ? $rider->user->email : null,
                'phone' => $rider->phone,
                'vehicle_plate' => $rider->vehicle_plate,
                'address' => $rider->address,
                'status' => $rider->status,
            ],
        ], 200);
    }

    public function assignOrderRider(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $order = Order::findOrFail($id);
        if (strtolower($order->status ?? '') !== 'shipped') {
            return response()->json(['message' => 'Assign a rider only when the order is shipped.'], 422);
        }
        $validated = $request->validate([
            'rider_id' => 'required|exists:riders,id',
        ]);
        $prev = $order->rider_id;
        $order->update(['rider_id' => $validated['rider_id']]);
        Rider::syncAvailability($prev, (int) $validated['rider_id']);

        return response()->json([
            'message' => 'Rider assigned.',
            'order' => $order->fresh(['customer', 'items.product', 'rider.user']),
        ], 200);
    }

    /**
     * Per-product stock, units sold (non-cancelled orders), line revenue, and store-wide sold totals.
     */
    public function inventoryReport(Request $request)
    {
        $this->ensureAdmin($request);

        $soldAgg = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.status', '!=', 'cancelled')
            ->selectRaw('
                order_items.product_id,
                COALESCE(SUM(order_items.quantity), 0) as units_sold,
                COALESCE(SUM(order_items.quantity * order_items.price), 0) as revenue
            ')
            ->groupBy('order_items.product_id')
            ->get()
            ->keyBy('product_id');

        $grandRevenue = (float) (DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.status', '!=', 'cancelled')
            ->selectRaw('COALESCE(SUM(order_items.quantity * order_items.price), 0) as t')
            ->value('t') ?? 0);

        $grandUnits = (int) (DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.status', '!=', 'cancelled')
            ->selectRaw('COALESCE(SUM(order_items.quantity), 0) as u')
            ->value('u') ?? 0);

        $products = Product::with('category:id,name')
            ->where('is_archived', false)
            ->orderBy('name')
            ->get();

        $rows = $products->map(function ($p) use ($soldAgg) {
            $row = $soldAgg->get($p->id) ?? $soldAgg->get((string) $p->id);

            return [
                'id' => $p->id,
                'name' => $p->name,
                'category' => $p->category ? $p->category->name : null,
                'stock' => (int) $p->stock,
                'unit_price' => round((float) $p->price, 2),
                'units_sold' => $row ? (int) $row->units_sold : 0,
                'sales_total' => $row ? round((float) $row->revenue, 2) : 0.0,
            ];
        });

        return response()->json([
            'products' => $rows->values(),
            'totals' => [
                'total_units_sold' => $grandUnits,
                'total_sales_amount' => round($grandRevenue, 2),
            ],
        ], 200);
    }

    /**
     * Get all products (admin)
     */
    public function products(Request $request)
    {
        $this->ensureAdmin($request);
        $products = Product::with(['category:id,name', 'seller:id,name,email'])
            ->where('is_archived', false)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['products' => $products], 200);
    }

    public function archivedProducts(Request $request)
    {
        $this->ensureAdmin($request);
        $products = Product::with(['category:id,name', 'seller:id,name,email'])
            ->where('is_archived', true)
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json(['products' => $products], 200);
    }

    public function archiveProduct(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $product = Product::findOrFail($id);
        $product->update(['is_archived' => true]);

        return response()->json(['message' => 'Product archived.', 'product' => $product->fresh(['category', 'seller'])], 200);
    }

    public function restoreProduct(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $product = Product::findOrFail($id);
        if (!$product->is_archived) {
            abort(422, 'Product is not archived.');
        }
        $product->update(['is_archived' => false]);

        return response()->json(['message' => 'Product restored.', 'product' => $product->fresh(['category', 'seller'])], 200);
    }

    public function permanentDeleteProduct(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $product = Product::findOrFail($id);
        if (!$product->is_archived) {
            abort(422, 'Only archived products can be permanently deleted.');
        }
        $product->delete();

        return response()->json(['message' => 'Product permanently deleted.'], 200);
    }

    public function archiveProductsBatch(Request $request)
    {
        $this->ensureAdmin($request);
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:products,id',
        ]);
        Product::whereIn('id', $validated['ids'])->update(['is_archived' => true]);

        return response()->json(['message' => 'Selected products archived.'], 200);
    }

    public function permanentDeleteProductsBatch(Request $request)
    {
        $this->ensureAdmin($request);
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:products,id',
        ]);
        $deleted = Product::whereIn('id', $validated['ids'])
            ->where('is_archived', true)
            ->delete();

        return response()->json(['message' => 'Archived products permanently deleted.', 'deleted' => $deleted], 200);
    }

    public function storeProduct(Request $request)
    {
        $this->ensureAdmin($request);
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'stock' => 'required|integer|min:0',
            'category_id' => 'required|exists:categories,id',
            'image' => 'nullable|string',
            'seller_id' => 'nullable|exists:users,id',
            'is_active' => 'nullable|boolean',
            'sizes' => 'nullable|array',
            'sizes.*' => 'string|max:20',
            'sales_cap_quantity' => 'nullable|integer|min:1',
            'sales_cap_period' => 'required_with:sales_cap_quantity|nullable|in:month,year',
        ]);

        $sizes = isset($validated['sizes'])
            ? array_values(array_filter(array_map('trim', $validated['sizes'])))
            : null;

        $capQty = $validated['sales_cap_quantity'] ?? null;
        $capPeriod = $validated['sales_cap_period'] ?? null;
        if (!$capQty) {
            $capPeriod = null;
        }

        $sellerId = $validated['seller_id'] ?? $request->user()->id;

        $product = Product::create([
            'name' => $validated['name'],
            'slug' => $this->uniqueProductSlug($validated['name']),
            'description' => $validated['description'] ?? null,
            'price' => $validated['price'],
            'stock' => $validated['stock'],
            'image' => $validated['image'] ?? null,
            'category_id' => $validated['category_id'],
            'seller_id' => $sellerId,
            'is_active' => $validated['is_active'] ?? true,
            'is_archived' => false,
            'sizes' => $sizes,
            'approval_status' => Product::APPROVAL_PENDING,
            'sales_cap_quantity' => $capQty,
            'sales_cap_period' => $capPeriod,
        ]);

        return response()->json([
            'message' => 'Product submitted for approval. It will appear in the store after an admin publishes it.',
            'product' => $product->load(['category:id,name', 'seller:id,name,email']),
        ], 201);
    }

    public function approveProduct(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $product = Product::findOrFail($id);
        if ($product->approval_status === Product::APPROVAL_APPROVED) {
            return response()->json(['message' => 'Product is already live.', 'product' => $product->fresh(['category', 'seller'])], 200);
        }
        if ($product->approval_status === Product::APPROVAL_REJECTED) {
            abort(422, 'Rejected products cannot be approved. Edit the product or create a new one.');
        }
        $product->update([
            'approval_status' => Product::APPROVAL_APPROVED,
            'slug' => $this->uniqueProductSlug($product->name, $product->id),
        ]);

        return response()->json([
            'message' => 'Product is now visible to customers.',
            'product' => $product->fresh(['category', 'seller']),
        ], 200);
    }

    public function rejectProduct(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $product = Product::findOrFail($id);
        if ($product->approval_status !== Product::APPROVAL_PENDING) {
            abort(422, 'Only pending products can be rejected.');
        }
        $product->update(['approval_status' => Product::APPROVAL_REJECTED]);

        return response()->json([
            'message' => 'Product rejected. It will stay hidden from the store.',
            'product' => $product->fresh(['category', 'seller']),
        ], 200);
    }

    private function uniqueProductSlug(string $name, ?int $ignoreProductId = null): string
    {
        $base = Str::slug($name);
        $slug = $base ?: 'product';
        $n = 0;
        while (Product::where('slug', $slug)
            ->when($ignoreProductId, fn ($q) => $q->where('id', '!=', $ignoreProductId))
            ->exists()) {
            $n++;
            $slug = ($base ?: 'product').'-'.$n;
        }

        return $slug;
    }

    public function updateProduct(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $product = Product::findOrFail($id);
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'stock' => 'nullable|integer|min:0',
            'category_id' => 'nullable|exists:categories,id',
            'image' => 'nullable|string',
            'seller_id' => 'nullable|exists:users,id',
            'is_active' => 'nullable|boolean',
            'sizes' => 'nullable|array',
            'sizes.*' => 'string|max:20',
            'sales_cap_quantity' => 'nullable|integer|min:1',
            'sales_cap_period' => 'required_with:sales_cap_quantity|nullable|in:month,year',
        ]);

        if (array_key_exists('sizes', $validated)) {
            $validated['sizes'] = array_values(array_filter(array_map('trim', $validated['sizes'])));
        }
        if (isset($validated['name'])) {
            $validated['slug'] = $this->uniqueProductSlug($validated['name'], (int) $product->id);
        }

        if (array_key_exists('sales_cap_quantity', $validated) && !$validated['sales_cap_quantity']) {
            $validated['sales_cap_period'] = null;
        }

        $product->update(array_filter($validated, fn ($v) => $v !== null));

        return response()->json(['message' => 'Product updated.', 'product' => $product->fresh(['category', 'seller'])], 200);
    }

    public function deleteProduct(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $product = Product::findOrFail($id);
        $product->delete();

        return response()->json(['message' => 'Product deleted.'], 200);
    }

    public function archivedUsers(Request $request)
    {
        $this->ensureAdmin($request);
        $users = User::with('role')
            ->where('is_archived', true)
            ->whereHas('role', fn ($q) => $q->where('name', 'customer'))
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json(['users' => $users], 200);
    }

    public function archiveUser(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $user = User::with('role')->findOrFail($id);
        $this->ensureCustomerAccount($user);
        if ((int) $user->id === (int) $request->user()->id) {
            abort(422, 'You cannot archive your own account.');
        }
        $user->update(['is_archived' => true]);
        $user->tokens()->delete();

        return response()->json(['message' => 'Customer archived.', 'user' => $user->fresh('role')], 200);
    }

    public function restoreUser(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $user = User::with('role')->findOrFail($id);
        $this->ensureCustomerAccount($user);
        if (!$user->is_archived) {
            abort(422, 'User is not archived.');
        }
        $user->update(['is_archived' => false]);

        return response()->json(['message' => 'Customer restored.', 'user' => $user->fresh('role')], 200);
    }

    public function permanentDeleteUser(Request $request, $id)
    {
        return $this->deleteUser($request, $id);
    }

    public function archiveUsersBatch(Request $request)
    {
        $this->ensureAdmin($request);
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:users,id',
        ]);
        $adminId = (int) $request->user()->id;
        $ids = array_values(array_filter($validated['ids'], fn ($i) => (int) $i !== $adminId));
        $users = User::with('role')->whereIn('id', $ids)->get();
        foreach ($users as $user) {
            if (!$user->hasRole('customer')) {
                continue;
            }
            $user->update(['is_archived' => true]);
            $user->tokens()->delete();
        }

        return response()->json(['message' => 'Selected customers archived.'], 200);
    }

    public function permanentDeleteUsersBatch(Request $request)
    {
        $this->ensureAdmin($request);
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:users,id',
        ]);
        $deleted = User::whereIn('id', $validated['ids'])
            ->where('is_archived', true)
            ->whereHas('role', fn ($q) => $q->where('name', 'customer'))
            ->where('id', '!=', $request->user()->id)
            ->delete();

        return response()->json(['message' => 'Archived customers permanently deleted.', 'deleted' => $deleted], 200);
    }

    /**
     * Categories (admin)
     */
    public function categories(Request $request)
    {
        $this->ensureAdmin($request);
        $categories = Category::orderBy('name')->get();
        return response()->json(['categories' => $categories], 200);
    }

    public function storeCategory(Request $request)
    {
        $this->ensureAdmin($request);
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'image' => 'nullable|string',
        ]);

        $category = Category::create([
            'name' => $validated['name'],
            'slug' => Str::slug($validated['name']),
            'description' => $validated['description'] ?? null,
            'image' => $validated['image'] ?? null,
        ]);

        return response()->json(['message' => 'Category created.', 'category' => $category], 201);
    }

    public function updateCategory(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $category = Category::findOrFail($id);
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'image' => 'nullable|string',
        ]);
        if (isset($validated['name'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }
        $category->update(array_filter($validated, fn ($v) => $v !== null));

        return response()->json(['message' => 'Category updated.', 'category' => $category], 200);
    }

    public function deleteCategory(Request $request, $id)
    {
        $this->ensureAdmin($request);
        $category = Category::findOrFail($id);
        $category->delete();
        return response()->json(['message' => 'Category deleted.'], 200);
    }

    /**
     * Store settings (single row)
     */
    public function settings(Request $request)
    {
        $this->ensureAdmin($request);
        $settings = StoreSetting::first();
        if (!$settings) {
            $settings = StoreSetting::create([
                'store_name' => 'urbanNxt',
                'support_email' => $request->user()->email,
                'description' => 'Premium urban clothing brand for the modern generation.',
                'brand_primary' => '#4f46e5',
                'brand_accent' => '#2563eb',
                'banner_text' => 'Redefine Your Style',
                'banner_enabled' => true,
                'maintenance_mode' => false,
                'enable_coupons' => true,
                'enable_2fa' => false,
                'email_on_new_order' => true,
                'sms_alerts' => false,
            ]);
        }

        return response()->json(['settings' => $settings], 200);
    }

    public function updateSettings(Request $request)
    {
        $this->ensureAdmin($request);
        $validated = $request->validate([
            'store_name' => 'nullable|string|max:255',
            'support_email' => 'nullable|email|max:255',
            'description' => 'nullable|string',
            'logo_data_url' => 'nullable|string',
            'brand_primary' => 'nullable|string|max:20',
            'brand_accent' => 'nullable|string|max:20',
            'banner_text' => 'nullable|string|max:255',
            'banner_enabled' => 'nullable|boolean',
            'maintenance_mode' => 'nullable|boolean',
            'enable_coupons' => 'nullable|boolean',
            'enable_2fa' => 'nullable|boolean',
            'email_on_new_order' => 'nullable|boolean',
            'sms_alerts' => 'nullable|boolean',
        ]);

        $settings = StoreSetting::first();
        if (!$settings) {
            $settings = StoreSetting::create([]);
        }

        $settings->update(array_filter($validated, fn ($v) => $v !== null));

        return response()->json(['message' => 'Settings updated.', 'settings' => $settings->fresh()], 200);
    }
}
