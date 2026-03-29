<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    /**
     * Get admin dashboard statistics.
     */
    public function index(): JsonResponse
    {
                    $totalUsers = User::count();
        $totalCustomers = User::where('role', 'customer')->count();
        $totalAdmins = User::where('role', 'admin')->count();
        $totalProducts = Product::count();
        $activeProducts = Product::where('is_active', true)->count();
        $totalOrders = Order::count();
        $pendingOrders = Order::where('status', 'pending')->count();
        // COD orders start as pending, so gross revenue includes all non-cancelled orders.
        $revenueTotal = Order::where('status', '!=', 'cancelled')->sum('total');
        $revenueThisMonth = Order::where('status', '!=', 'cancelled')
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->sum('total');
        $revenueCollected = Order::whereIn('status', ['paid', 'processing', 'shipped', 'delivered'])->sum('total');

        return response()->json([
            'stats' => [
                'total_users' => $totalUsers,
                'total_customers' => $totalCustomers,
                'total_admins' => $totalAdmins,
                'total_products' => $totalProducts,
                'active_products' => $activeProducts,
                'total_orders' => $totalOrders,
                'pending_orders' => $pendingOrders,
                'revenue_total' => (float) $revenueTotal,
                'revenue_this_month' => (float) $revenueThisMonth,
                'revenue_collected' => (float) $revenueCollected,
                // Compatibility aliases for older frontend consumers.
                'users' => $totalUsers,
                'products' => $totalProducts,
                'orders' => $totalOrders,
                'revenue' => (float) $revenueTotal,
            ],
            'recent_orders' => Order::with('user')
                ->orderByDesc('created_at')
                ->limit(10)
                ->get()
                ->map(fn ($o) => [
                    'id' => $o->id,
                    'order_number' => $o->order_number,
                    'customer' => $o->user->name,
                    'total' => (float) $o->total,
                    'status' => $o->status,
                    'created_at' => $o->created_at,
                ]),
        ]);
    }
}
