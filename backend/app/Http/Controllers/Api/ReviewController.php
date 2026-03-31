<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReviewRequest;
use App\Http\Resources\ReviewResource;
use App\Models\Order;
use App\Models\Product;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    /**
     * Create a review for a product (verified buyer only).
     */
    public function store(StoreReviewRequest $request, Product $product): JsonResponse
    {
        $user = $request->user();
        $orderId = $request->validated('order_id');
        $variantId = $request->validated('variant_id');

        // Verify the selected variant belongs to this product and was purchased in the given order.
        $hasPurchased = Order::where('id', $orderId)
            ->where('user_id', $user->id)
            ->where('status', '!=', 'cancelled')
            ->whereHas('items', function ($q) use ($product, $variantId) {
                $q->where('variant_id', $variantId)
                    ->whereHas('variant', fn ($q2) => $q2->where('product_id', $product->id));
            })
            ->exists();

        if (!$hasPurchased) {
            return response()->json([
                'message' => 'You can only review products you have purchased',
            ], 403);
        }

        // Enforce one review per purchased variant.
        $existingReview = Review::where('user_id', $user->id)
            ->where('variant_id', $variantId)
            ->exists();

        if ($existingReview) {
            return response()->json([
                'message' => 'You have already reviewed this variant. Please edit your existing review.',
            ], 409);
        }

        $review = Review::create([
            'user_id' => $user->id,
            'product_id' => $product->id,
            'variant_id' => $variantId,
            'order_id' => $orderId,
            'rating' => $request->validated('rating'),
            'comment' => $request->validated('comment'),
            'is_anonymous' => $request->boolean('is_anonymous'),
            'is_approved' => true, // Auto-approve; change to false for moderation
        ]);

        return response()->json([
            'message' => 'Review submitted',
            'review' => new ReviewResource($review->load(['user', 'variant'])),
        ], 201);
    }

    /**
     * Update an existing review for a product.
     */
    public function update(Request $request, Product $product, Review $review): JsonResponse
    {
        $user = $request->user();

        if ($review->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($review->product_id !== $product->id) {
            return response()->json(['message' => 'Review does not belong to this product'], 400);
        }

        $validated = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
            'is_anonymous' => ['nullable', 'boolean'],
        ]);

        $review->update([
            'rating' => $validated['rating'],
            'comment' => $validated['comment'] ?? null,
            'is_anonymous' => $request->boolean('is_anonymous'),
        ]);

        return response()->json([
            'message' => 'Review updated successfully',
            'review' => new ReviewResource($review->load(['user', 'variant'])),
        ]);
    }
}
