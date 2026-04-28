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

class GenerateUmlController extends Controller
{
    public function __construct(private AIService $aiService)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'diagram_type' => ['required', 'string', 'in:class,state'],
        ]);

        try {
            $projectId = (int) $validated['project_id'];
            $diagramType = $validated['diagram_type'];
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
                ->sortBy(fn (array $item) => optional($item['timestamp'])->getTimestamp() ?? 0)
                ->values();

            $mergedText = $this->buildMergedText($mergedTimeline);

            try {
                $diagramData = $this->aiService->generateUmlFromText($mergedText, $diagramType);
            } catch (\Exception $e) {
                $haystack = strtolower($e->getMessage());
                if (str_contains($haystack, '503') || str_contains($haystack, 'high demand')) {
                    return response()->json([
                        'error' => 'Şu an yapay zeka sunucuları çok yoğun. Lütfen 1-2 dakika sonra tekrar deneyin.',
                    ], 503);
                }

                return response()->json([
                    'error' => 'Diyagram üretilirken bir hata oluştu: '.$e->getMessage(),
                ], 500);
            }

            return response()->json(['diagram_data' => $diagramData]);
        } catch (Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function buildMergedText(Collection $timeline): string
    {
        return $timeline
            ->map(function (array $item): string {
                $time = optional($item['timestamp'])->format('H:i') ?? '--:--';

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
