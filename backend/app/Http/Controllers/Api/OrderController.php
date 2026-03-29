<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Services\OrderService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrderController extends Controller
{
    public function __construct(
        private readonly OrderService $orderService,
    ) {}

    /**
     * List the user's orders.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = $this->orderService->getUserOrders(
            $request->user(),
            $request->integer('per_page', 10),
        );

        return OrderResource::collection($orders);
    }

    /**
     * Get a single order for the authenticated user.
     */
    public function show(Request $request, int $order): OrderResource
    {
        $orderModel = $request->user()
            ->orders()
            ->with('items')
            ->findOrFail($order);

        return new OrderResource($orderModel);
    }
}
