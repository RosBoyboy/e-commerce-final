<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\Order;
use App\Models\Product;

class OrderChatService
{
    public static function orderReference(Order $order): string
    {
        return (string) ($order->order_number ?? ('#' . $order->id));
    }

    /**
     * Human-readable product line, e.g. "Stussy hoodie" or "Item A, Item B".
     */
    public static function productNamesSummary(Order $order): string
    {
        $order->loadMissing('items.product:id,name');
        $names = $order->items
            ->map(fn ($i) => $i->product->name ?? null)
            ->filter()
            ->unique()
            ->values();
        if ($names->isEmpty()) {
            return 'your order';
        }
        if ($names->count() === 1) {
            return $names->first();
        }
        $slice = $names->take(3);
        $extra = $names->count() > 3 ? ', …' : '';

        return $slice->implode(', ') . $extra;
    }

    /**
     * Resolve seller–customer thread for this order (first line item with seller).
     */
    public static function conversationForOrder(Order $order): ?Conversation
    {
        $order->loadMissing(['customer', 'items.product']);
        $customer = $order->customer;
        if (!$customer) {
            return null;
        }

        $sellerId = null;
        $product = null;
        foreach ($order->items as $item) {
            $p = $item->product;
            if (!$p && $item->product_id) {
                $p = Product::query()
                    ->select(['id', 'seller_id', 'name', 'slug', 'image'])
                    ->find($item->product_id);
            }
            if ($p && $p->seller_id) {
                $sellerId = (int) $p->seller_id;
                $product = $p;
                break;
            }
        }

        if (!$sellerId) {
            return null;
        }

        $productId = $product && $product->id ? (int) $product->id : null;

        $conversation = null;
        if ($productId) {
            $conversation = Conversation::query()
                ->where('seller_id', $sellerId)
                ->where('customer_id', $customer->id)
                ->where('product_id', $productId)
                ->first();
        }
        if (!$conversation) {
            $conversation = Conversation::query()
                ->where('seller_id', $sellerId)
                ->where('customer_id', $customer->id)
                ->orderByDesc('updated_at')
                ->first();
        }
        if (!$conversation) {
            $conversation = Conversation::create([
                'seller_id' => $sellerId,
                'customer_id' => $customer->id,
                'product_id' => $productId,
            ]);
        } elseif ($productId && $conversation->product_id === null) {
            $conversation->update(['product_id' => $productId]);
        }

        return $conversation;
    }

    public static function sellerIdForOrder(Order $order): ?int
    {
        $order->loadMissing('items.product');
        foreach ($order->items as $item) {
            $p = $item->product;
            if ($p && $p->seller_id) {
                return (int) $p->seller_id;
            }
        }

        return null;
    }

    /**
     * Idempotent tag so we never duplicate the same automated notice for an order.
     */
    public static function notifyTag(int $orderId, string $kind): string
    {
        return '[ORDER_NOTIFY:' . $orderId . ':' . $kind . ']';
    }

    /**
     * Post from seller when customer confirms receipt (thank-you).
     */
    public static function bodyCustomerReceiptThankYou(Order $order): string
    {
        $ref = self::orderReference($order);
        $summary = self::productNamesSummary($order);
        $tag = self::notifyTag((int) $order->id, 'received');

        return $tag . ' Re: Order ' . $ref . ' (' . $summary . ') — Your UrbanNxt order has arrived! Thank you for choosing us. We hope you love your new look. Feel free to tag us in your photos!';
    }

    /**
     * Post from seller when rider marks the order delivered (customer sees order # + product).
     */
    public static function bodyRiderDelivered(Order $order): string
    {
        $ref = self::orderReference($order);
        $summary = self::productNamesSummary($order);
        $tag = self::notifyTag((int) $order->id, 'delivered');

        return $tag . ' Re: Order ' . $ref . ' (' . $summary . ') — Your delivery is complete. Our rider marked this order as delivered. Thank you for shopping with UrbanNxt!';
    }

    /**
     * Post from seller when seller marks order shipped.
     */
    public static function bodySellerShipped(Order $order): string
    {
        $order->loadMissing(['customer', 'items.product']);
        $name = $order->customer->name ?? 'there';
        $ref = self::orderReference($order);
        $summary = self::productNamesSummary($order);
        $tag = self::notifyTag((int) $order->id, 'shipped');

        return $tag . ' Re: Order ' . $ref . ' (' . $summary . ') — Hi ' . $name . '! Your order has been shipped. You will receive tracking updates here. Stay stylish!';
    }

    public static function hasNotification(Conversation $conversation, int $sellerId, string $tagPrefix): bool
    {
        return $conversation->messages()
            ->where('user_id', $sellerId)
            ->where('body', 'like', $tagPrefix . '%')
            ->exists();
    }

    public static function sendSellerAutomatedMessage(Order $order, string $body, string $notifyKind): bool
    {
        $conversation = self::conversationForOrder($order);
        if (!$conversation) {
            return false;
        }

        $sellerId = self::sellerIdForOrder($order);
        if (!$sellerId) {
            return false;
        }

        $tag = self::notifyTag((int) $order->id, $notifyKind);
        if (self::hasNotification($conversation, $sellerId, $tag)) {
            return true;
        }

        Message::create([
            'conversation_id' => $conversation->id,
            'user_id' => $sellerId,
            'body' => $body,
        ]);
        $conversation->touch();

        return true;
    }
}
