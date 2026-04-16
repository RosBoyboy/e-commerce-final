<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Models\Product;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function index(Request $request)
    {
        $items = CartItem::where('user_id', $request->user()->id)
            ->with(['product.category', 'product.seller:id,name,email'])
            ->get()
            ->filter(function (CartItem $row) {
                $p = $row->product;
                return $p && !$p->is_archived && $p->isVisibleOnStorefront();
            });

        return response()->json([
            'items' => $items->map(fn (CartItem $row) => $this->serializeLine($row))->values(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity'   => 'required|integer|min:1|max:100',
            'size'       => 'nullable|string|max:64',
        ]);

        $productRow = Product::find($validated['product_id']);
        if (!$productRow || !$productRow->isVisibleOnStorefront()) {
            return response()->json(['message' => 'This product is not available.'], 422);
        }

        $stock = $productRow->effectiveAvailableQuantity();
        if ($stock < 1) {
            return response()->json(['message' => 'This product is out of stock.'], 422);
        }

        $user = $request->user();
        $size = $validated['size'] ?? '';

        $cartItem = CartItem::where('user_id', $user->id)
            ->where('product_id', $validated['product_id'])
            ->where('size', $size)
            ->first();

        $existingQty = $cartItem ? (int) $cartItem->quantity : 0;
        $newQty = $existingQty + (int) $validated['quantity'];
        if ($newQty > $stock) {
            return response()->json([
                'message' => $stock === 1
                    ? 'Only 1 item left in stock.'
                    : "Not enough stock. Only {$stock} available for this product.",
            ], 422);
        }
        if ($newQty > 100) {
            return response()->json(['message' => 'Maximum 100 units per line item.'], 422);
        }

        if ($cartItem) {
            $cartItem->update([
                'quantity' => $newQty,
            ]);
        } else {
            $cartItem = CartItem::create([
                'user_id'    => $user->id,
                'product_id' => $validated['product_id'],
                'quantity'   => (int) $validated['quantity'],
                'size'       => $size,
            ]);
        }

        $cartItem->load(['product.category', 'product.seller:id,name,email']);

        return response()->json($this->serializeLine($cartItem), 201);
    }

    public function update(Request $request, CartItem $cartItem)
    {
        $this->assertOwnsCartItem($request, $cartItem);

        $validated = $request->validate([
            'quantity' => 'required|integer|min:1|max:100',
        ]);

        $cartItem->load('product');
        $product = $cartItem->product;
        if (!$product || !$product->isVisibleOnStorefront()) {
            return response()->json(['message' => 'This product is not available.'], 422);
        }
        $stock = $product->effectiveAvailableQuantity();
        if ($stock < 1) {
            return response()->json(['message' => 'This product is out of stock.'], 422);
        }
        if ((int) $validated['quantity'] > $stock) {
            return response()->json([
                'message' => $stock === 1
                    ? 'Only 1 item left in stock.'
                    : "Not enough stock. Only {$stock} available for this product.",
            ], 422);
        }

        $cartItem->update($validated);
        $cartItem->load(['product.category', 'product.seller:id,name,email']);

        return response()->json($this->serializeLine($cartItem));
    }

    public function destroy(Request $request, CartItem $cartItem)
    {
        $this->assertOwnsCartItem($request, $cartItem);
        $cartItem->delete();

        return response()->json(['message' => 'Removed']);
    }

    private function assertOwnsCartItem(Request $request, CartItem $cartItem): void
    {
        if ((int) $cartItem->user_id !== (int) $request->user()->id) {
            abort(403, 'Forbidden');
        }
    }

    private function serializeLine(CartItem $row): array
    {
        $p = $row->product;
        $sizeStr = (string) ($row->size ?? '');

        $product = [
            'id'            => $p->id,
            'name'          => $p->name,
            'slug'          => $p->slug,
            'price'         => (float) $p->price,
            'category'      => $p->category ? $p->category->name : null,
            'category_id'   => $p->category_id,
            'image'         => $p->image,
            'sizes'         => $p->sizes ?? [],
            'color'         => $p->color,
            'stock'         => $p->effectiveAvailableQuantity(),
            'description'   => $p->description,
            'seller_id'     => $p->seller_id,
            'seller'        => $p->seller ? ['id' => $p->seller->id, 'name' => $p->seller->name] : null,
        ];

        return [
            'id'         => $row->id,
            'product_id' => $row->product_id,
            'quantity'   => $row->quantity,
            'size'       => $sizeStr === '' ? null : $sizeStr,
            'key'        => $row->product_id.'-'.$sizeStr,
            'product'    => $product,
        ];
    }
}
