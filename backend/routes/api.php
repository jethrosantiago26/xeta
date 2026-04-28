<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\SupportTicketController;
use App\Http\Controllers\Api\WishlistController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Api\Admin\ProductController as AdminProductController;
use App\Http\Controllers\Api\Admin\ReviewController as AdminReviewController;
use App\Http\Controllers\Api\Admin\SupportTicketController as AdminSupportTicketController;
use App\Http\Controllers\Api\Admin\CustomerController as AdminCustomerController;
use App\Http\Controllers\Api\Admin\InventoryController as AdminInventoryController;
use App\Http\Controllers\Api\Admin\AnalyticsController as AdminAnalyticsController;
use App\Http\Controllers\Api\Admin\PromotionController as AdminPromotionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {
    // Products (public)
    Route::get('products', [ProductController::class, 'index']);
    Route::get('products/{slug}', [ProductController::class, 'show']);

    // Categories (public)
    Route::get('categories', [CategoryController::class, 'index']);
    Route::get('categories/{slug}', [CategoryController::class, 'show']);

    /*
    |--------------------------------------------------------------------------
    | Authenticated Routes (Clerk JWT required)
    |--------------------------------------------------------------------------
    */
    Route::middleware('clerk')->group(function () {
        // Auth
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/sync', [AuthController::class, 'sync']);
        Route::put('auth/me', [AuthController::class, 'update']);

        // Cart
        Route::get('cart', [CartController::class, 'index']);
        Route::post('cart', [CartController::class, 'store']);
        Route::put('cart/{cartItem}', [CartController::class, 'update']);
        Route::delete('cart/{cartItem}', [CartController::class, 'destroy']);
        Route::post('cart/merge', [CartController::class, 'merge']);

        // Checkout
        Route::post('checkout/place-order', [CheckoutController::class, 'createOrder']);

        // Orders
        Route::get('orders', [OrderController::class, 'index']);
        Route::get('orders/{order}', [OrderController::class, 'show']);

        // Wishlist
        Route::get('wishlist', [WishlistController::class, 'index']);
        Route::post('wishlist', [WishlistController::class, 'store']);
        Route::delete('wishlist/{wishlistItem}', [WishlistController::class, 'destroy']);

        // Reviews
        Route::post('products/{product}/reviews', [ReviewController::class, 'store']);
        Route::put('products/{product}/reviews/{review}', [ReviewController::class, 'update']);

        // Support (customer)
        Route::get('support/tickets', [SupportTicketController::class, 'index']);
        Route::post('support/tickets', [SupportTicketController::class, 'store']);
        Route::get('support/tickets/{ticket}', [SupportTicketController::class, 'show']);
        Route::post('support/tickets/{ticket}/messages', [SupportTicketController::class, 'storeMessage']);
        Route::post('support/tickets/{ticket}/reopen', [SupportTicketController::class, 'reopen']);

        /*
        |--------------------------------------------------------------------------
        | Admin Routes (Clerk JWT + admin role)
        |--------------------------------------------------------------------------
        */
        Route::middleware('admin')->prefix('admin')->group(function () {
            // Dashboard
            Route::get('dashboard', [DashboardController::class, 'index']);

            // Products Management
            Route::get('products', [AdminProductController::class, 'index']);
            Route::post('products', [AdminProductController::class, 'store']);
            Route::put('products/{product}', [AdminProductController::class, 'update']);
            Route::delete('products/{product}', [AdminProductController::class, 'destroy']);
            Route::post('products/{product}/restore', [AdminProductController::class, 'restore']);
            Route::delete('products/{product}/force', [AdminProductController::class, 'forceDelete']);

            // Variant Management
            Route::post('products/{product}/variants', [AdminProductController::class, 'storeVariant']);
            Route::put('products/{product}/variants/{variant}', [AdminProductController::class, 'updateVariant']);
            Route::delete('products/{product}/variants/{variant}', [AdminProductController::class, 'destroyVariant']);

            // Order Management
            Route::post('orders/bulk', [AdminOrderController::class, 'bulkAction']);
            Route::get('orders', [AdminOrderController::class, 'index']);
            Route::put('orders/{order}', [AdminOrderController::class, 'update']);
            Route::delete('orders/{order}', [AdminOrderController::class, 'destroy']);
            Route::post('orders/{order}/restore', [AdminOrderController::class, 'restore']);
            Route::delete('orders/{order}/force', [AdminOrderController::class, 'forceDelete']);

            // Support (admin)
            Route::get('support/tickets', [AdminSupportTicketController::class, 'index']);
            Route::get('support/tickets/{ticket}', [AdminSupportTicketController::class, 'show']);
            Route::put('support/tickets/{ticket}', [AdminSupportTicketController::class, 'update']);
            Route::post('support/tickets/{ticket}/messages', [AdminSupportTicketController::class, 'storeMessage']);

            // Reviews (admin)
            Route::get('reviews', [AdminReviewController::class, 'index']);
            Route::put('reviews/{review}', [AdminReviewController::class, 'update']);
            Route::delete('reviews/{review}', [AdminReviewController::class, 'destroy']);
            Route::post('reviews/{review}/restore', [AdminReviewController::class, 'restore']);
            Route::delete('reviews/{review}/force', [AdminReviewController::class, 'forceDelete']);

            // Customers (admin)
            Route::get('customers', [AdminCustomerController::class, 'index']);
            Route::get('customers/{customer}', [AdminCustomerController::class, 'show']);
            Route::put('customers/{customer}', [AdminCustomerController::class, 'update']);
            Route::delete('customers/{customer}', [AdminCustomerController::class, 'destroy']);
            Route::post('customers/{customer}/restore', [AdminCustomerController::class, 'restore']);
            Route::delete('customers/{customer}/force', [AdminCustomerController::class, 'forceDelete']);

            // Inventory (admin)
            Route::get('inventory', [AdminInventoryController::class, 'index']);
            Route::put('inventory/variants/{variant}/stock', [AdminInventoryController::class, 'updateStock']);

            // Analytics (admin)
            Route::get('analytics', [AdminAnalyticsController::class, 'index']);

            // Promotions (admin)
            Route::get('promotions/dashboard', [AdminPromotionController::class, 'dashboard']);
            Route::get('promotions', [AdminPromotionController::class, 'index']);
            Route::post('promotions', [AdminPromotionController::class, 'store']);
            Route::get('promotions/{promotion}', [AdminPromotionController::class, 'show']);
            Route::put('promotions/{promotion}', [AdminPromotionController::class, 'update']);
            Route::put('promotions/{promotion}/active', [AdminPromotionController::class, 'setActive']);
            Route::delete('promotions/{promotion}', [AdminPromotionController::class, 'destroy']);
        });
    });
});
