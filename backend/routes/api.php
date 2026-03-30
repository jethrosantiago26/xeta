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
use App\Http\Controllers\Api\Admin\SupportTicketController as AdminSupportTicketController;
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

        // Support (customer)
        Route::get('support/tickets', [SupportTicketController::class, 'index']);
        Route::post('support/tickets', [SupportTicketController::class, 'store']);
        Route::get('support/tickets/{ticket}', [SupportTicketController::class, 'show']);
        Route::post('support/tickets/{ticket}/messages', [SupportTicketController::class, 'storeMessage']);

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

            // Variant Management
            Route::post('products/{product}/variants', [AdminProductController::class, 'storeVariant']);
            Route::put('products/{product}/variants/{variant}', [AdminProductController::class, 'updateVariant']);
            Route::delete('products/{product}/variants/{variant}', [AdminProductController::class, 'destroyVariant']);

            // Order Management
            Route::get('orders', [AdminOrderController::class, 'index']);
            Route::put('orders/{order}', [AdminOrderController::class, 'update']);

            // Support (admin)
            Route::get('support/tickets', [AdminSupportTicketController::class, 'index']);
            Route::get('support/tickets/{ticket}', [AdminSupportTicketController::class, 'show']);
            Route::put('support/tickets/{ticket}', [AdminSupportTicketController::class, 'update']);
            Route::post('support/tickets/{ticket}/messages', [AdminSupportTicketController::class, 'storeMessage']);
        });
    });
});
