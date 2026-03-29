<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::with('category')->where('is_archived', false);

        if ($request->filled('category')) {
            $query->whereHas('category', function ($q) use ($request) {
                $q->where('name', $request->category);
            });
        }

        $products = $query->get()->map(function ($p) {
            return [
                'id' => $p->id,
                'name' => $p->name,
                'slug' => $p->slug,
                'price' => (float) $p->price,
                'category' => $p->category ? $p->category->name : null,
                'category_id' => $p->category_id,
                'image' => $p->image,
                'sizes' => $p->sizes ?? [],
                'color' => $p->color,
                'stock' => $p->stock,
                'description' => $p->description,
            ];
        });

        return response()->json($products);
    }

    public function show($id)
    {
        $product = Product::with(['category', 'seller:id,name,email'])
            ->where('is_archived', false)
            ->find($id);
        if (!$product) {
            return response()->json(['message' => 'Product not found'], 404);
        }
        return response()->json([
            'id' => $product->id,
            'name' => $product->name,
            'slug' => $product->slug,
            'price' => (float) $product->price,
            'category' => $product->category ? $product->category->name : null,
            'category_id' => $product->category_id,
            'image' => $product->image,
            'sizes' => $product->sizes ?? [],
            'color' => $product->color,
            'stock' => $product->stock,
            'description' => $product->description,
            'seller_id' => $product->seller_id,
            'seller' => $product->seller ? ['id' => $product->seller->id, 'name' => $product->seller->name] : null,
        ]);
    }
}
