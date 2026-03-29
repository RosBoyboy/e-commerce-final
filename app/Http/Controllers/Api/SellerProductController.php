<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SellerProductController extends Controller
{
    private function ensureSeller(Request $request)
    {
        if (!$request->user()->hasRole('seller')) {
            abort(403, 'Only sellers can access this resource.');
        }
    }

    /**
     * Get seller products
     */
    public function index(Request $request)
    {
        $this->ensureSeller($request);
        $products = Product::where('seller_id', $request->user()->id)
            ->where('is_archived', false)
            ->with('category')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'products' => $products,
        ], 200);
    }

    /**
     * Store a new product
     */
    public function store(Request $request)
    {
        $this->ensureSeller($request);
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'stock' => 'required|integer|min:0',
            'category_id' => 'required|exists:categories,id',
            'image' => 'nullable|string',
            'sizes' => 'nullable|array',
            'sizes.*' => 'string|max:20',
        ]);
        $sizes = isset($validated['sizes']) ? array_values(array_filter(array_map('trim', $validated['sizes']))) : null;

        $product = Product::create([
            'name' => $validated['name'],
            'slug' => Str::slug($validated['name']),
            'description' => $validated['description'],
            'price' => $validated['price'],
            'stock' => $validated['stock'],
            'image' => $validated['image'] ?? null,
            'category_id' => $validated['category_id'],
            'seller_id' => $request->user()->id,
            'sizes' => $sizes,
        ]);

        return response()->json([
            'message' => 'Product created successfully',
            'product' => $product,
        ], 201);
    }

    /**
     * Update a product
     */
    public function update(Request $request, $id)
    {
        $this->ensureSeller($request);
        $product = Product::where('id', $id)
            ->where('seller_id', $request->user()->id)
            ->firstOrFail();

        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'stock' => 'nullable|integer|min:0',
            'category_id' => 'nullable|exists:categories,id',
            'image' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'sizes' => 'nullable|array',
            'sizes.*' => 'string|max:20',
        ]);
        if (array_key_exists('sizes', $validated)) {
            $validated['sizes'] = array_values(array_filter(array_map('trim', $validated['sizes'])));
        }
        $product->update(array_filter($validated));

        return response()->json([
            'message' => 'Product updated successfully',
            'product' => $product,
        ], 200);
    }

    /**
     * Delete a product
     */
    public function destroy(Request $request, $id)
    {
        $this->ensureSeller($request);
        $product = Product::where('id', $id)
            ->where('seller_id', $request->user()->id)
            ->firstOrFail();

        $product->delete();

        return response()->json([
            'message' => 'Product deleted successfully',
        ], 200);
    }
}
