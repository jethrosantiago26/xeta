<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WishlistItem;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    /**
     * Get the user's wishlist.
     */
    public function index(Request $request): JsonResponse
    {
        $items = $request->user()
            ->wishlistItems()
            ->with(['variant.product.images' => fn ($q) => $q->where('is_primary', true)])
            ->get()
            ->map(function ($item) {
                $variant = $item->variant;
                $product = $variant->product;
                return [
                    'id' => $item->id,
                    'variant' => [
                        'id' => $variant->id,
                        'name' => $variant->name,
                        'price' => (float) $variant->price,
                        'compare_at_price' => $variant->compare_at_price ? (float) $variant->compare_at_price : null,
                        'in_stock' => $variant->isInStock(),
                        'condition' => $variant->condition,
                    ],
                    'product' => [
                        'id' => $product->id,
                        'name' => $product->name,
                        'slug' => $product->slug,
                        'image' => $product->images->firstWhere('is_primary', true)?->url
                            ?? $product->images->first()?->url,
                    ],
                    'added_at' => $item->created_at,
                ];
            });

        return response()->json(['items' => $items]);
    }

    /**
     * Add a variant to the wishlist.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'variant_id' => ['required', 'exists:product_variants,id'],
        ]);

        $user = $request->user();
        $variantId = $request->input('variant_id');

        $existing = WishlistItem::where('user_id', $user->id)
            ->where('variant_id', $variantId)
            ->first();

        if ($existing) {
            return response()->json(['message' => 'Already in wishlist'], 409);
        }

        WishlistItem::create([
            'user_id' => $user->id,
            'variant_id' => $variantId,
        ]);

        return response()->json(['message' => 'Added to wishlist'], 201);
    }

    /**
     * Remove an item from the wishlist.
     */
    public function destroy(Request $request, int $wishlistItem): JsonResponse
    {
        WishlistItem::where('user_id', $request->user()->id)
            ->findOrFail($wishlistItem)
            ->delete();

        return response()->json(['message' => 'Removed from wishlist']);
    }
}
