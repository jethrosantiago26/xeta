<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CartItemRequest;
use App\Http\Resources\CartItemResource;
use App\Services\CartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CartController extends Controller
{
    public function __construct(
        private readonly CartService $cartService,
    ) {}

    /**
     * Get the user's cart.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $items = $this->cartService->getCart($user);
        $calculation = $this->cartService->calculateDetailedCart(
            $user,
            $items,
        );

        $pricingByItemId = collect($calculation['items'])->keyBy('cart_item_id');
        $items->each(function ($item) use ($pricingByItemId): void {
            $item->setAttribute('pricing', $pricingByItemId->get($item->id));
        });

        return response()->json([
            'items' => CartItemResource::collection($items),
            'totals' => $calculation['totals'],
            'promotions' => $calculation['applied_promotions'],
        ]);
    }

    /**
     * Add an item to the cart.
     */
    public function store(CartItemRequest $request): JsonResponse
    {
        try {
            $cartItem = $this->cartService->addItem(
                $request->user(),
                $request->validated('variant_id'),
                $request->validated('quantity'),
            );

            return response()->json([
                'message' => 'Item added to cart',
                'item' => new CartItemResource($cartItem),
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Update a cart item's quantity.
     */
    public function update(Request $request, int $cartItem): JsonResponse
    {
        $validated = $request->validate(['quantity' => ['required', 'integer', 'min:1', 'max:99']]);

        try {
            $updated = $this->cartService->updateItem(
                $request->user(),
                $cartItem,
                $validated['quantity'],
            );

            return response()->json([
                'message' => 'Cart updated',
                'item' => new CartItemResource($updated),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Remove an item from the cart.
     */
    public function destroy(Request $request, int $cartItem): JsonResponse
    {
        $this->cartService->removeItem($request->user(), $cartItem);

        return response()->json(['message' => 'Item removed from cart']);
    }

    /**
     * Merge guest cart with server cart.
     */
    public function merge(Request $request): JsonResponse
    {
        $request->validate([
            'items' => ['required', 'array'],
            'items.*.variant_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        $this->cartService->mergeCart($request->user(), $request->input('items'));

        return response()->json(['message' => 'Cart merged']);
    }
}
