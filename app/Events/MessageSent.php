<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    /** @var \App\Models\Message */
    public $message;

    public function __construct(Message $message)
    {
        $this->message = $message->loadMissing('user:id,name');
    }

    public function broadcastOn()
    {
        return new PrivateChannel('conversation.'.$this->message->conversation_id);
    }

    /**
     * Frontend listens for `.message.sent`.
     */
    public function broadcastAs()
    {
        return 'message.sent';
    }

    public function broadcastWith()
    {
        $m = $this->message;

        return [
            'message' => [
                'id' => $m->id,
                'conversation_id' => $m->conversation_id,
                'user_id' => $m->user_id,
                'body' => $m->body,
                'read_at' => $m->read_at ? $m->read_at->toIso8601String() : null,
                'created_at' => $m->created_at->toIso8601String(),
                'user' => $m->user ? [
                    'id' => $m->user->id,
                    'name' => $m->user->name,
                ] : null,
            ],
        ];
    }
}
