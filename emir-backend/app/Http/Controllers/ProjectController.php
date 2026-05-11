<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Models\ProjectFile;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $projects = Project::query()
            ->with(['files', 'diagram'])
            ->orderByDesc('id')
            ->paginate(15);

        return ProjectResource::collection($projects);
    }

    public function show(Project $project): ProjectResource
    {
        $project->load(['files', 'diagram']);

        return new ProjectResource($project);
    }

    public function store(StoreProjectRequest $request): ProjectResource
    {
        $project = DB::transaction(function () use ($request) {
            $project = Project::query()->create(
                $request->safe()->only(['title', 'description'])
            );

            if ($request->hasFile('files')) {
                foreach ($request->file('files') as $file) {
                    $path = $file->store('projects/'.$project->id, 'public');
                    $mime = $file->getMimeType() ?? 'application/octet-stream';
                    $kind = str_starts_with($mime, 'audio/') ? 'audio' : 'text';

                    ProjectFile::query()->create([
                        'project_id' => $project->id,
                        'file_name' => $file->getClientOriginalName(),
                        'file_path' => $path,
                        'storage_disk' => 'public',
                        'mime_type' => $mime,
                        'kind' => $kind,
                        'status' => 'stored',
                        'size_bytes' => $file->getSize(),
                    ]);
                }
            }

            return $project;
        });

        $project->load(['files', 'diagram']);

        return new ProjectResource($project);
    }
}
