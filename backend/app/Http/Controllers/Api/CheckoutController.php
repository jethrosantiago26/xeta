<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly OrderService $orderService,
    ) {}

    /**
     * Create a cash on delivery order.
     */
    public function createOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'shipping_address' => ['required', 'array'],
            'shipping_address.name' => ['required', 'string', 'max:255'],
            'shipping_address.phone' => ['nullable', 'string', 'max:30'],
            'shipping_address.line1' => ['required', 'string', 'max:255'],
            'shipping_address.line2' => ['nullable', 'string', 'max:255'],
            'shipping_address.city' => ['required', 'string', 'max:255'],
            'shipping_address.state' => ['nullable', 'string', 'max:255'],
            'shipping_address.postal_code' => ['required', 'string', 'max:50'],
            'shipping_address.country' => ['required', 'string', 'size:2'],
            'shipping_address.timezone' => ['nullable', 'string', 'max:120'],
            'shipping_address.location_name' => ['nullable', 'string', 'max:255'],
            'shipping_address.latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'shipping_address.longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        try {
            $order = $this->orderService->createFromCart(
                $request->user(),
                $validated['shipping_address'] ?? null,
            );

            return response()->json([
                'message' => 'Order placed with cash on delivery',
                'order' => $order,
                'payment_method' => 'cash_on_delivery',
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
