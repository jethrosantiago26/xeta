<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePromotionRequest;
use App\Http\Requests\UpdatePromotionRequest;
use App\Http\Resources\PromotionResource;
use App\Models\Promotion;
use App\Services\PromotionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PromotionController extends Controller
{
    public function __construct(
        private readonly PromotionService $promotionService,
    ) {
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $promotions = $this->promotionService->paginateForAdmin(
            $request->integer('per_page', 20),
            $request->boolean('active_only'),
        );

        return PromotionResource::collection($promotions);
    }

    public function dashboard(): JsonResponse
    {
        $now = now();

        $activeCount = Promotion::query()->active()->count();

        $scheduledCount = Promotion::query()
            ->where('is_active', true)
            ->whereNotNull('starts_at')
            ->where('starts_at', '>', $now)
            ->count();

        $expiringSoonCount = Promotion::query()
            ->where('is_active', true)
            ->whereNotNull('ends_at')
            ->whereBetween('ends_at', [$now, $now->copy()->addDays(3)])
            ->count();

        return response()->json([
            'summary' => [
                'active_promotions' => $activeCount,
                'scheduled_promotions' => $scheduledCount,
                'expiring_soon' => $expiringSoonCount,
            ],
            'active' => PromotionResource::collection(
                Promotion::query()
                    ->active()
                    ->with(['products:id', 'categories:id'])
                    ->orderBy('priority')
                    ->orderBy('ends_at')
                    ->limit(12)
                    ->get(),
            ),
        ]);
    }

    public function show(int $promotion): PromotionResource
    {
        $model = Promotion::query()
            ->with(['products:id', 'categories:id', 'creator:id,name,email'])
            ->findOrFail($promotion);

        return new PromotionResource($model);
    }

    public function store(StorePromotionRequest $request): JsonResponse
    {
        $promotion = $this->promotionService->create($request->validated(), $request->user());

        return response()->json([
            'message' => 'Promotion created.',
            'promotion' => new PromotionResource($promotion),
        ], 201);
    }

    public function update(UpdatePromotionRequest $request, int $promotion): JsonResponse
    {
        $model = Promotion::findOrFail($promotion);
        $updated = $this->promotionService->update($model, $request->validated());

        return response()->json([
            'message' => 'Promotion updated.',
            'promotion' => new PromotionResource($updated),
        ]);
    }

    public function destroy(int $promotion): JsonResponse
    {
        $model = Promotion::findOrFail($promotion);
        $this->promotionService->destroy($model);

        return response()->json(['message' => 'Promotion deleted.']);
    }

    public function setActive(Request $request, int $promotion): JsonResponse
    {
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $model = Promotion::findOrFail($promotion);
        $updated = $this->promotionService->setActive($model, (bool) $validated['is_active']);

        return response()->json([
            'message' => $updated->is_active ? 'Promotion enabled.' : 'Promotion disabled.',
            'promotion' => new PromotionResource($updated),
        ]);
    }
}
