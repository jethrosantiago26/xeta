<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ReviewController extends Controller
{
    /**
     * List all reviews for moderation.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Review::with(['user', 'product'])->orderByDesc('created_at');

        if ($request->filled('status')) {
            $status = $request->input('status');
            if ($status === 'approved') {
                $query->where('is_approved', true);
            } elseif ($status === 'pending') {
                $query->where('is_approved', false);
            }
        }

        $reviews = $query->paginate($request->integer('per_page', 20));

        // Let's create an anonymous inline array transformation so the admin sees the product data,
        // Since original ReviewResource doesn't include product details by default.
        return ReviewResource::collection($reviews);
    }

    /**
     * Update a review's approval status.
     */
    public function update(Request $request, Review $review): JsonResponse
    {
        $validated = $request->validate([
            'is_approved' => ['required', 'boolean'],
        ]);

        $review->update([
            'is_approved' => $validated['is_approved'],
        ]);

        return response()->json([
            'message' => 'Review updated successfully',
            'review' => new ReviewResource($review->load(['user', 'product'])),
        ]);
    }

    /**
     * Delete a review.
     */
    public function destroy(Review $review): JsonResponse
    {
        $review->delete();

        return response()->json([
            'message' => 'Review deleted successfully',
        ]);
    }
}
