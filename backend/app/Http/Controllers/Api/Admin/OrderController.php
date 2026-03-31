<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateOrderStatusRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrderController extends Controller
{
    public function __construct(
        private readonly OrderService $orderService,
    ) {}

    /**
     * List all orders (admin view).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = $this->orderService->getAllOrders(
            $request->input('status'),
            $request->integer('per_page', 20),
        );

        return OrderResource::collection($orders);
    }

    /**
     * Update an order's status.
     */
    public function update(UpdateOrderStatusRequest $request, int $order): JsonResponse
    {
        $orderModel = Order::findOrFail($order);
        $this->orderService->updateStatus($orderModel, $request->validated('status'));

        return response()->json([
            'message' => 'Order status updated',
            'order' => new OrderResource($orderModel->load('items.variant.product.images')),
        ]);
    }
}
