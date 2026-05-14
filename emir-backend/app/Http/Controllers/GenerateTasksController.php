<?php

namespace App\Http\Controllers;

use App\Models\ChatLog;
use App\Models\Project;
use App\Models\Transcript;
use App\Services\AIService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;

class GenerateTasksController extends Controller
{
    public function __construct(private AIService $aiService) {}

    public function __invoke(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'project_id' => ['sometimes', 'integer', 'exists:projects,id'],
            'text' => ['sometimes', 'string', 'max:20000'],
            'diagram' => ['sometimes', 'array'],
            'diagram.nodes' => ['required_with:diagram', 'array', 'min:1'],
            'diagram.edges' => ['sometimes', 'array'],
        ]);

        $validator->after(function ($v) use ($request) {
            $hasText = $request->filled('text');
            $hasProject = $request->filled('project_id');
            $hasDiagram = is_array($request->input('diagram'))
                && is_array($request->input('diagram.nodes'))
                && count($request->input('diagram.nodes')) > 0;
            if (! $hasText && ! $hasProject && ! $hasDiagram) {
                $v->errors()->add('text', 'text, project_id veya diagram (nodes) gereklidir.');
            }
        });

        /** @var array<string, mixed> $validated */
        $validated = $validator->validate();

        $hasDiagram = is_array($request->input('diagram'))
            && is_array($request->input('diagram.nodes'))
            && count($request->input('diagram.nodes')) > 0;

        try {
            if ($hasDiagram) {
                $diagram = $request->input('diagram', []);
                $tasks = $this->aiService->generateSprintTasksFromDiagram([
                    'nodes' => is_array($diagram['nodes'] ?? null) ? $diagram['nodes'] : [],
                    'edges' => is_array($diagram['edges'] ?? null) ? $diagram['edges'] : [],
                ]);
            } elseif (! empty($validated['text'])) {
                $tasks = $this->aiService->generateTasksFromText((string) $validated['text']);
            } else {
                $projectId = (int) $validated['project_id'];
                $project = Project::query()->findOrFail($projectId);

                $chatEntries = ChatLog::query()
                    ->where('project_id', $project->id)
                    ->get()
                    ->map(function (ChatLog $chatLog): array {
                        return [
                            'timestamp' => $chatLog->sent_at ?? $chatLog->created_at,
                            'user_name' => $chatLog->user_name ?: 'Anonymous',
                            'type' => 'Chat',
                            'content' => $chatLog->message,
                        ];
                    });

                $transcriptEntries = Transcript::query()
                    ->where('project_id', $project->id)
                    ->get()
                    ->map(function (Transcript $transcript): array {
                        return [
                            'timestamp' => $transcript->spoken_at ?? $transcript->created_at,
                            'user_name' => $transcript->user_name ?: 'Anonymous',
                            'type' => 'Ses',
                            'content' => $transcript->content,
                        ];
                    });

                $mergedTimeline = $chatEntries
                    ->merge($transcriptEntries)
                    ->sortBy(function (array $item) {
                        $ts = $item['timestamp'] ?? null;
                        if ($ts instanceof \DateTimeInterface) {
                            return $ts->getTimestamp();
                        }

                        return 0;
                    })
                    ->values();

                $mergedText = $this->buildMergedText($mergedTimeline);
                $tasks = $this->aiService->generateTasksFromText($mergedText);
            }

            return response()->json([
                'data' => $tasks,
                'tasks' => $tasks,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => $e->getMessage(),
                'message' => $e->getMessage(),
            ], 400);
        } catch (Exception $e) {
            $haystack = strtolower($e->getMessage());
            if (str_contains($haystack, '503') || str_contains($haystack, 'high demand')) {
                return response()->json([
                    'error' => 'Şu an yapay zeka sunucuları çok yoğun. Lütfen 1-2 dakika sonra tekrar deneyin.',
                    'message' => 'Şu an yapay zeka sunucuları çok yoğun. Lütfen 1-2 dakika sonra tekrar deneyin.',
                ], 503);
            }
            if (str_contains($haystack, '429') || str_contains($haystack, 'rate limit') || str_contains($haystack, 'too many requests')) {
                return response()->json([
                    'error' => 'Çok fazla istek atıldı. Lütfen kısa bir süre sonra tekrar deneyin.',
                    'message' => 'Çok fazla istek atıldı. Lütfen kısa bir süre sonra tekrar deneyin.',
                ], 429);
            }

            return response()->json([
                'error' => 'Görevler üretilirken bir hata oluştu: '.$e->getMessage(),
                'message' => 'Görevler üretilirken bir hata oluştu: '.$e->getMessage(),
            ], 500);
        }
    }

    private function buildMergedText(Collection $timeline): string
    {
        return $timeline
            ->map(function (array $item): string {
                $ts = $item['timestamp'] ?? null;
                $time = $ts instanceof \DateTimeInterface ? $ts->format('H:i') : '--:--';

                return sprintf(
                    '[%s] %s (%s): %s',
                    $time,
                    (string) $item['user_name'],
                    (string) $item['type'],
                    (string) $item['content']
                );
            })
            ->implode("\n");
    }
}
