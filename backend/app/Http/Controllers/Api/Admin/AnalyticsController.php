<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AnalyticsController extends Controller
{
    /**
     * Get analytics dashboard data.
     */
    public function index(Request $request): JsonResponse
    {
        $days = $request->integer('days', 30);
        $startDate = Carbon::now()->subDays($days)->startOfDay();

        // 1. Revenue over time (daily)
        $dailyRevenue = Order::select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('SUM(total) as revenue'),
                DB::raw('COUNT(*) as orders')
            )
            ->where('status', '!=', 'cancelled')
            ->where('created_at', '>=', $startDate)
            ->groupBy('date')
            ->orderBy('date', 'asc')
            ->get();

        // Fill in missing days with 0
        $chartData = [];
        for ($i = 0; $i < $days; $i++) {
            $date = Carbon::now()->subDays($days - $i - 1)->format('Y-m-d');
            $chartData[$date] = ['date' => $date, 'revenue' => 0, 'orders' => 0];
        }

        foreach ($dailyRevenue as $row) {
            $chartData[$row->date] = [
                'date' => $row->date,
                'revenue' => (float) $row->revenue,
                'orders' => (int) $row->orders,
            ];
        }

        // 2. Top selling products
        $topProducts = OrderItem::select(
                'product_name',
                'variant_name',
                DB::raw('SUM(quantity) as total_quantity'),
                DB::raw('SUM(total) as total_revenue')
            )
            ->whereHas('order', function ($query) use ($startDate) {
                $query->where('status', '!=', 'cancelled')
                      ->where('created_at', '>=', $startDate);
            })
            ->groupBy('product_name', 'variant_name')
            ->orderByDesc('total_revenue')
            ->limit(10)
            ->get()
            ->map(fn($item) => [
                'name' => "{$item->product_name} - {$item->variant_name}",
                'quantity' => (int) $item->total_quantity,
                'revenue' => (float) $item->total_revenue,
            ]);

        // 3. Status breakdown
        $statusBreakdown = Order::select('status', DB::raw('COUNT(*) as count'))
            ->where('created_at', '>=', $startDate)
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status');

        return response()->json([
            'timeseries' => array_values($chartData),
            'top_products' => $topProducts,
            'status_breakdown' => $statusBreakdown,
            'summary' => [
                'total_revenue' => collect($chartData)->sum('revenue'),
                'total_orders' => collect($chartData)->sum('orders'),
            ]
        ]);
    }
}
