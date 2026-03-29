<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\SellerProductController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\SellerOrderController;
use App\Http\Controllers\Api\RiderOrderController;
use App\Http\Controllers\Api\CartController;

Route::post('/auth/register', [AuthController::class, 'register'])->name('api.auth.register');
Route::post('/auth/login', [AuthController::class, 'login'])->name('api.auth.login');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/user', [AuthController::class, 'user']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
});

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{id}', [ProductController::class, 'show']);
Route::get('/categories', [CategoryController::class, 'index']);


Route::middleware('auth:sanctum')->group(function () {
    Route::get('/orders', [OrderController::class, 'customerOrders']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::patch('/orders/{id}/status', [OrderController::class, 'updateStatus']);

    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart/items', [CartController::class, 'store']);
    Route::patch('/cart/items/{cartItem}', [CartController::class, 'update']);
    Route::delete('/cart/items/{cartItem}', [CartController::class, 'destroy']);
});


Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('rider')->group(function () {
        Route::get('/orders', [RiderOrderController::class, 'orders']);
        Route::get('/stats', [RiderOrderController::class, 'stats']);
        Route::get('/profile', [RiderOrderController::class, 'profile']);
        Route::patch('/orders/{id}/deliver', [RiderOrderController::class, 'markDelivered']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('seller')->group(function () {
        Route::get('/products', [SellerProductController::class, 'index']);
        Route::post('/products', [SellerProductController::class, 'store']);
        Route::put('/products/{id}', [SellerProductController::class, 'update']);
        Route::delete('/products/{id}', [SellerProductController::class, 'destroy']);
        Route::get('/orders', [SellerOrderController::class, 'index']);
        Route::patch('/orders/{id}/status', [SellerOrderController::class, 'updateStatus']);
        Route::get('/riders', [SellerOrderController::class, 'riders']);
        Route::patch('/orders/{id}/assign-rider', [SellerOrderController::class, 'assignRider']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/conversations/unread-count', [ConversationController::class, 'unreadCount']);
    Route::post('/conversations/mark-all-read', [ConversationController::class, 'markAllRead']);
    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::get('/conversations/{id}', [ConversationController::class, 'show']);
    Route::post('/conversations', [ConversationController::class, 'store']);
    Route::post('/conversations/{id}/messages', [ConversationController::class, 'sendMessage']);
});


Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('admin')->group(function () {
        Route::get('/stats', [AdminController::class, 'stats']);

        Route::get('/users/archived', [AdminController::class, 'archivedUsers']);
        Route::post('/users/archive-batch', [AdminController::class, 'archiveUsersBatch']);
        Route::post('/users/permanent-batch', [AdminController::class, 'permanentDeleteUsersBatch']);
        Route::patch('/users/{id}/archive', [AdminController::class, 'archiveUser']);
        Route::patch('/users/{id}/restore', [AdminController::class, 'restoreUser']);
        Route::get('/users', [AdminController::class, 'users']);
        Route::put('/users/{id}', [AdminController::class, 'updateUser']);
        Route::delete('/users/{id}', [AdminController::class, 'deleteUser']);

        // Orders
        Route::get('/orders', [AdminController::class, 'orders']);
        Route::patch('/orders/{id}/status', [AdminController::class, 'updateOrderStatus']);
        Route::patch('/orders/{id}/assign-rider', [AdminController::class, 'assignOrderRider']);

        // Fleet riders (built-in accounts)
        Route::get('/riders', [AdminController::class, 'riders']);
        Route::put('/riders/{id}', [AdminController::class, 'updateRider']);

        // Products
        Route::get('/products/archived', [AdminController::class, 'archivedProducts']);
        Route::post('/products/archive-batch', [AdminController::class, 'archiveProductsBatch']);
        Route::post('/products/permanent-batch', [AdminController::class, 'permanentDeleteProductsBatch']);
        Route::patch('/products/{id}/archive', [AdminController::class, 'archiveProduct']);
        Route::patch('/products/{id}/restore', [AdminController::class, 'restoreProduct']);
        Route::get('/products', [AdminController::class, 'products']);
        Route::post('/products', [AdminController::class, 'storeProduct']);
        Route::put('/products/{id}', [AdminController::class, 'updateProduct']);
        Route::delete('/products/{id}', [AdminController::class, 'deleteProduct']);

        // Categories
        Route::get('/categories', [AdminController::class, 'categories']);
        Route::post('/categories', [AdminController::class, 'storeCategory']);
        Route::put('/categories/{id}', [AdminController::class, 'updateCategory']);
        Route::delete('/categories/{id}', [AdminController::class, 'deleteCategory']);

        // Settings
        Route::get('/settings', [AdminController::class, 'settings']);
        Route::put('/settings', [AdminController::class, 'updateSettings']);
    });
});
     