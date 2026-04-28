<?php

namespace App\Http\Controllers;

use App\Events\ChatMessageSent;
use App\Http\Requests\StoreChatMessageRequest;
use App\Models\ChatLog;
use App\Models\Project;
use Illuminate\Http\JsonResponse;

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
        $payload = $request->validated();

        $chatLog = ChatLog::query()->create([
            'project_id' => $project->id,
            'user_id' => $payload['user_id'] ?? null,
            'user_name' => $payload['user_name'] ?? 'Anonymous',
            'message' => $payload['message'],
            'sent_at' => $payload['sent_at'] ?? now(),
        ]);

        broadcast(new ChatMessageSent($chatLog))->toOthers();

        return response()->json(['data' => $chatLog], 201);
    }
}
