<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    /**
     * List all product variants with their stock.
     */
    public function index(Request $request): JsonResponse
    {
        $variants = ProductVariant::with(['product' => function ($query) {
                $query->select('id', 'name', 'slug', 'is_active');
            }])
            ->orderBy('id', 'asc')
            ->paginate($request->integer('per_page', 50));

        return response()->json($variants);
    }

    /**
     * Update stock for a specific variant.
     */
    public function updateStock(Request $request, ProductVariant $variant): JsonResponse
    {
        $validated = $request->validate([
            'stock_quantity' => 'required|integer|min:0',
        ]);

        $variant->update(['stock_quantity' => $validated['stock_quantity']]);

        return response()->json([
            'message' => 'Stock updated successfully',
            'variant' => $variant->load('product'),
        ]);
    }
}
