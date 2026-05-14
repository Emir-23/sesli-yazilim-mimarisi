<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class ProjectMeetingSummaryController extends Controller
{
    /**
     * chat_logs (sent_at) + transcripts (spoken_at) → kronolojik tek metin (AI / UML için).
     */
    public function __invoke(Project $project): JsonResponse
    {
        $project->load([
            'chatLogs' => static fn ($q) => $q->orderBy('sent_at')->orderBy('id'),
            'transcripts' => static fn ($q) => $q->orderBy('spoken_at')->orderBy('id'),
        ]);

        $rows = collect();

        foreach ($project->chatLogs as $log) {
            $at = $log->sent_at instanceof Carbon ? $log->sent_at->copy() : Carbon::parse($log->sent_at);
            $label = trim((string) ($log->user_name ?? '')) !== '' ? $log->user_name : 'Yazılı sohbet';
            $body = preg_replace('/\s+/', ' ', trim((string) $log->message));
            $rows->push([
                'sort' => $at->format('Y-m-d\TH:i:s.u').'-chat-'.str_pad((string) $log->id, 10, '0', STR_PAD_LEFT),
                'line' => sprintf('[%s] %s (Chat): %s', $at->format('H:i:s'), $label, $body),
            ]);
        }

        foreach ($project->transcripts as $t) {
            $at = $t->spoken_at instanceof Carbon ? $t->spoken_at->copy() : Carbon::parse($t->spoken_at);
            $label = trim((string) ($t->user_name ?? '')) !== '' ? $t->user_name : 'Sistem Sesi';
            $body = preg_replace('/\s+/', ' ', trim((string) $t->content));
            $rows->push([
                'sort' => $at->format('Y-m-d\TH:i:s.u').'-tr-'.str_pad((string) $t->id, 10, '0', STR_PAD_LEFT),
                'line' => sprintf('[%s] %s (Transcript): %s', $at->format('H:i:s'), $label, $body),
            ]);
        }

        $summary = $rows->sortBy('sort')->pluck('line')->implode("\n");

        return response()->json(['summary' => $summary]);
    }
}
