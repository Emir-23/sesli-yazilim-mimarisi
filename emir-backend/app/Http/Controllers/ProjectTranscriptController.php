<?php

namespace App\Http\Controllers;

use App\Events\TranscriptCaptured;
use App\Http\Requests\StoreTranscriptRequest;
use App\Models\Project;
use App\Models\Transcript;
use App\Services\DeepgramService;
use Illuminate\Http\JsonResponse;

class ProjectTranscriptController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        $transcripts = Transcript::query()
            ->where('project_id', $project->id)
            ->orderByDesc('id')
            ->limit(500)
            ->get()
            ->reverse()
            ->values();

        return response()->json(['data' => $transcripts]);
    }

    public function store(StoreTranscriptRequest $request, Project $project): JsonResponse
    {
        $payload = $request->validated();

        $transcript = Transcript::query()->create([
            'project_id' => $project->id,
            'user_id' => $payload['user_id'] ?? null,
            'user_name' => $payload['user_name'] ?? 'Anonymous',
            'content' => $payload['content'],
            'is_final' => (bool) ($payload['is_final'] ?? false),
            'spoken_at' => $payload['spoken_at'] ?? now(),
        ]);

        broadcast(new TranscriptCaptured($transcript))->toOthers();

        return response()->json(['data' => $transcript], 201);
    }

    public function deepgramConfig(Project $project, DeepgramService $deepgramService): JsonResponse
    {
        return response()->json([
            'project_id' => $project->id,
            'data' => $deepgramService->liveConfig(),
        ]);
    }
}
