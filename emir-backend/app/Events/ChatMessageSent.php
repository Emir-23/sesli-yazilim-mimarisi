<?php

namespace App\Events;

use App\Models\ChatLog;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChatMessageSent implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(public ChatLog $chatLog)
    {
    }

    public function broadcastOn(): Channel
    {
        return new Channel('project.'.$this->chatLog->project_id.'.chat');
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->chatLog->id,
            'project_id' => $this->chatLog->project_id,
            'user_id' => $this->chatLog->user_id,
            'user_name' => $this->chatLog->user_name,
            'message' => $this->chatLog->message,
            'sent_at' => optional($this->chatLog->sent_at)->toIso8601String(),
            'created_at' => optional($this->chatLog->created_at)->toIso8601String(),
        ];
    }
}
