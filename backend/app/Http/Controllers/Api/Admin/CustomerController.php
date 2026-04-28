<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    /**
     * List all customers with their order stats.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::where('role', 'customer')
            ->withCount('orders')
            ->withSum('orders', 'total')
            ->orderByDesc('created_at');

        if ($request->boolean('with_archived')) {
            $query->withTrashed();
        }

        $customers = $query->paginate($request->integer('per_page', 20));

        return response()->json($customers);
    }

    /**
     * Show a customer.
     */
    public function show($id): JsonResponse
    {
        $customer = User::withTrashed()
            ->where('role', 'customer')
            ->withCount('orders')
            ->withSum('orders', 'total')
            ->findOrFail($id);

        return response()->json($customer);
    }

    /**
     * Update customer profile.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $customer = User::withTrashed()
            ->where('role', 'customer')
            ->findOrFail($id);

        $validated = $request->validate([
            'first_name' => 'nullable|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'username' => 'nullable|string|max:255|unique:users,username,' . $customer->id,
            'phone' => 'nullable|string|max:50',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|max:255',
            'postal_code' => 'nullable|string|max:50',
            'country' => 'nullable|string|max:255',
        ]);

        $customer->update($validated);

        // Update the full name for convenience if necessary
        $customer->name = trim(($customer->first_name ?? '') . ' ' . ($customer->last_name ?? ''));
        if (empty($customer->name)) {
            $customer->name = null;
        }
        $customer->save();

        return response()->json([
            'message' => 'Customer profile updated successfully',
            'customer' => $customer,
        ]);
    }

    /**
     * Archive (Soft Delete) a customer.
     */
    public function destroy($id): JsonResponse
    {
        $customer = User::where('role', 'customer')->findOrFail($id);

        $customer->delete(); // Soft delete

        return response()->json([
            'message' => 'Customer archived successfully',
        ]);
    }

    /**
     * Restore an archived customer.
     */
    public function restore($id): JsonResponse
    {
        $customer = User::onlyTrashed()->where('role', 'customer')->findOrFail($id);

        $customer->restore();

        return response()->json([
            'message' => 'Customer restored successfully',
            'customer' => $customer,
        ]);
    }

    /**
     * Permanently delete a customer.
     */
    public function forceDelete($id): JsonResponse
    {
        $customer = User::withTrashed()->where('role', 'customer')->findOrFail($id);

        if (!$customer->trashed()) {
            return response()->json([
                'message' => 'Only archived customers can be permanently deleted. Archive this customer first.',
            ], 422);
        }

        $customer->forceDelete();

        return response()->json([
            'message' => 'Customer permanently deleted',
        ]);
    }
}
