<?php

namespace App\Events;

use App\Models\Transcript;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TranscriptCaptured implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(public Transcript $transcript)
    {
    }

    public function broadcastOn(): Channel
    {
        return new Channel('project.'.$this->transcript->project_id.'.transcript');
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->transcript->id,
            'project_id' => $this->transcript->project_id,
            'user_id' => $this->transcript->user_id,
            'user_name' => $this->transcript->user_name,
            'content' => $this->transcript->content,
            'is_final' => $this->transcript->is_final,
            'spoken_at' => optional($this->transcript->spoken_at)->toIso8601String(),
            'created_at' => optional($this->transcript->created_at)->toIso8601String(),
        ];
    }
}
