<?php

namespace App\Http\Controllers;

use App\Events\ChatMessageSent;
use App\Http\Requests\StoreChatMessageRequest;
use App\Models\ChatLog;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class ProjectChatController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        $messages = ChatLog::query()
            ->where('project_id', $project->id)
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->reverse()
            ->values();

        return response()->json(['data' => $messages]);
    }

    public function store(StoreChatMessageRequest $request, Project $project): JsonResponse
    {
        $safe = $request->safe();

        $payload = [
            'message' => $safe['message'],
            'sent_at' => $safe->has('sent_at') && $safe['sent_at'] !== null
                ? Carbon::parse($safe['sent_at'])
                : now(),
            'message_kind' => $safe['message_kind'] ?? 'plain_text',
            'user_id' => $safe['user_id'] ?? null,
            'user_name' => $safe['user_name'] ?? 'Anonymous',
        ];

        $chatLog = $project->chatLogs()->create($payload);

        broadcast(new ChatMessageSent($chatLog))->toOthers();

        return response()->json(['data' => $chatLog], 201);
    }
}
