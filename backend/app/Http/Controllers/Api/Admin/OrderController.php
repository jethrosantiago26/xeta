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
     * Perform bulk actions on orders.
     */
    public function bulkAction(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_ids' => ['required', 'array'],
            'order_ids.*' => ['integer'],
            'action' => ['required', 'string', 'in:status_pending,status_processing,status_shipped,status_delivered,status_cancelled,archive,restore,force_delete'],
        ]);

        $orderIds = $validated['order_ids'];
        $action = $validated['action'];

        $orders = Order::withTrashed()->whereIn('id', $orderIds)->get();

        $containsArchived = $orders->contains(fn (Order $order) => $order->trashed());
        $containsActive = $orders->contains(fn (Order $order) => !$order->trashed());

        if (($action === 'restore' || $action === 'force_delete') && $containsActive) {
            return response()->json([
                'message' => 'Please select archived orders only for restore or permanent delete actions.',
            ], 422);
        }

        if ($action === 'archive' && $containsArchived) {
            return response()->json([
                'message' => 'Archive action only applies to active orders.',
            ], 422);
        }

        $processedCount = 0;

        foreach ($orders as $order) {
            if (!$order instanceof Order) {
                continue;
            }

            if (str_starts_with($action, 'status_')) {
                $status = str_replace('status_', '', $action);
                $this->orderService->updateStatus($order, $status);
            } elseif ($action === 'archive') {
                $order->delete();
            } elseif ($action === 'restore') {
                $order->restore();
            } elseif ($action === 'force_delete') {
                $order->forceDelete();
            }

            $processedCount += 1;
        }

        return response()->json([
            'message' => "Successfully applied action to {$processedCount} orders"
        ]);
    }

    /**
     * List all orders (admin view).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = $this->orderService->getAllOrders(
            $request->input('status'),
            $request->integer('per_page', 20),
            $request->boolean('with_archived'),
        );

        return OrderResource::collection($orders);
    }

    /**
     * Update an order's status.
     */
    public function update(UpdateOrderStatusRequest $request, int $order): JsonResponse
    {
        $orderModel = Order::withTrashed()->findOrFail($order);
        $this->orderService->updateStatus($orderModel, $request->validated('status'));

        return response()->json([
            'message' => 'Order status updated',
            'order' => new OrderResource($orderModel->load(['user', 'items.variant.product.images'])),
        ]);
    }

    /**
     * Archive an order.
     */
    public function destroy(int $order): JsonResponse
    {
        Order::findOrFail($order)->delete();
        return response()->json(['message' => 'Order archived']);
    }

    /**
     * Restore an archived order.
     */
    public function restore(int $order): JsonResponse
    {
        $orderModel = Order::onlyTrashed()->findOrFail($order);
        $orderModel->restore();
        return response()->json([
            'message' => 'Order restored',
            'order' => new OrderResource($orderModel->load(['user', 'items.variant.product.images'])),
        ]);
    }

    /**
     * Permanently delete an order.
     */
    public function forceDelete(int $order): JsonResponse
    {
        $orderModel = Order::withTrashed()->findOrFail($order);

        if (!$orderModel->trashed()) {
            return response()->json([
                'message' => 'Only archived orders can be permanently deleted. Archive this order first.',
            ], 422);
        }

        $orderModel->forceDelete();

        return response()->json(['message' => 'Order permanently deleted']);
    }
}
