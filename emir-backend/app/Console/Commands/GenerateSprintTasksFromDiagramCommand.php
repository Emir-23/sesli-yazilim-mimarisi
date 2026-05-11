<?php

namespace App\Console\Commands;

use App\Models\Project;
use App\Services\AIService;
use Illuminate\Console\Command;

class GenerateSprintTasksFromDiagramCommand extends Command
{
    protected $signature = 'diagram:generate-sprint-tasks {project : Kayıtlı projenin kimliği}';

    protected $description = 'Diyagram (node/edge) haritasını analiz eder ve geliştiriciler için eyleme dönüştürülebilir sprint görev listesi üretir.';

    public function handle(AIService $aiService): int
    {
        $projectId = (int) $this->argument('project');
        $project = Project::query()->with('diagram')->find($projectId);
        if ($project === null) {
            $this->error('Proje bulunamadı.');

            return self::FAILURE;
        }

        $diagram = $project->diagram;
        if ($diagram === null) {
            $this->error('Projeye bağlı diyagram kaydı yok.');

            return self::FAILURE;
        }

        $this->info('Gemini ile görev listesi üretiliyor…');

        try {
            $tasks = $aiService->generateSprintTasksFromDiagram($diagram->diagram_data ?? []);
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $diagram->update([
            'sprint_tasks' => $tasks,
            'sprint_tasks_generated_at' => now(),
        ]);

        $this->info('Tamamlandı. '.count($tasks).' görev kaydedildi.');
        foreach ($tasks as $i => $task) {
            $title = is_array($task) ? ($task['title'] ?? json_encode($task)) : (string) $task;
            $this->line(($i + 1).'. '.$title);
        }

        return self::SUCCESS;
    }
}
