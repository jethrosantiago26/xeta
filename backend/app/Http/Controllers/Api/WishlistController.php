<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
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
            ->with([
                'variant.product' => function ($query) {
                    $query->active()
                        ->with([
                            'category',
                            'variants' => fn ($variantQuery) => $variantQuery->active()->where('condition', 'new'),
                            'images',
                        ])
                        ->withCount([
                            'reviews as review_count' => fn ($reviewQuery) => $reviewQuery->approved(),
                        ])
                        ->withAvg([
                            'reviews as average_rating' => fn ($reviewQuery) => $reviewQuery->approved(),
                        ], 'rating')
                        ->withMin([
                            'variants as lowest_price' => fn ($variantQuery) => $variantQuery->active()->where('condition', 'new'),
                        ], 'price');
                },
            ])
            ->latest()
            ->get()
            ->filter(fn (WishlistItem $item) => $item->variant?->product !== null)
            ->unique(fn (WishlistItem $item) => $item->variant->product->id)
            ->values()
            ->map(function (WishlistItem $item) use ($request) {
                return [
                    'id' => $item->id,
                    'variant_id' => $item->variant_id,
                    // Resolve the resource payload so nested MissingValue placeholders are stripped.
                    'product' => ProductResource::make($item->variant->product)->resolve($request),
                    'added_at' => $item->created_at?->toISOString(),
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
        $variantId = (int) $request->input('variant_id');

        $variant = ProductVariant::query()
            ->whereKey($variantId)
            ->where('is_active', true)
            ->where('condition', 'new')
            ->whereHas('product', fn ($query) => $query->active())
            ->first();

        if (!$variant) {
            return response()->json(['message' => 'Selected variant is not available'], 422);
        }

        // Wishlist UI is product-level. Keep only one saved entry per product for each user.
        $existing = WishlistItem::query()
            ->where('user_id', $user->id)
            ->whereHas('variant', fn ($query) => $query->where('product_id', $variant->product_id))
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Already in wishlist',
                'item_id' => $existing->id,
            ]);
        }

        $item = WishlistItem::create([
            'user_id' => $user->id,
            'variant_id' => $variantId,
        ]);

        return response()->json([
            'message' => 'Added to wishlist',
            'item_id' => $item->id,
        ], 201);
    }

    /**
     * Remove an item from the wishlist.
     */
    public function destroy(Request $request, int $wishlistItem): JsonResponse
    {
        $userId = $request->user()->id;

        $item = WishlistItem::query()
            ->where('user_id', $userId)
            ->with('variant')
            ->findOrFail($wishlistItem);

        $productId = $item->variant?->product_id;

        if ($productId === null) {
            $item->delete();
        } else {
            WishlistItem::query()
                ->where('user_id', $userId)
                ->whereHas('variant', fn ($query) => $query->where('product_id', $productId))
                ->delete();
        }

        return response()->json(['message' => 'Removed from wishlist']);
    }
}
