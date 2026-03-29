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

        // Verify the user actually purchased this product
        $hasPurchased = Order::where('id', $orderId)
            ->where('user_id', $user->id)
            ->where('status', '!=', 'cancelled')
            ->whereHas('items', function ($q) use ($product) {
                $q->whereHas('variant', fn ($q2) => $q2->where('product_id', $product->id));
            })
            ->exists();

        if (!$hasPurchased) {
            return response()->json([
                'message' => 'You can only review products you have purchased',
            ], 403);
        }

        // Check for existing review
        $existingReview = Review::where('user_id', $user->id)
            ->where('product_id', $product->id)
            ->where('order_id', $orderId)
            ->exists();

        if ($existingReview) {
            return response()->json([
                'message' => 'You have already reviewed this product for this order',
            ], 409);
        }

        $review = Review::create([
            'user_id' => $user->id,
            'product_id' => $product->id,
            'order_id' => $orderId,
            'rating' => $request->validated('rating'),
            'comment' => $request->validated('comment'),
            'is_approved' => true, // Auto-approve; change to false for moderation
        ]);

        return response()->json([
            'message' => 'Review submitted',
            'review' => new ReviewResource($review),
        ], 201);
    }
}
