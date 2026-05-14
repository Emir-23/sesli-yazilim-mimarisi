<?php

namespace App\Http\Controllers;

use App\Events\TranscriptCaptured;
use App\Http\Requests\StoreTranscriptRequest;
use App\Models\Project;
use App\Models\Transcript;
use App\Services\DeepgramService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

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
        $safe = $request->safe();

        $payload = [
            'content' => $safe['content'],
            'is_final' => (bool) ($safe['is_final'] ?? false),
            'spoken_at' => $safe->has('spoken_at') && $safe['spoken_at'] !== null
                ? Carbon::parse($safe['spoken_at'])
                : now(),
            'user_id' => $safe['user_id'] ?? null,
            'user_name' => $safe['user_name'] ?? 'Anonymous',
        ];

        $transcript = $project->transcripts()->create($payload);

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
