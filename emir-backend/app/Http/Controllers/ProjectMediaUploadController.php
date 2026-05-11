<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProjectMediaUploadRequest;
use App\Http\Resources\ProjectFileResource;
use App\Jobs\ProcessProjectFileUpload;
use App\Models\Project;
use App\Models\ProjectFile;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class ProjectMediaUploadController extends Controller
{
    public function store(StoreProjectMediaUploadRequest $request, Project $project): JsonResponse
    {
        $uploaded = $request->file('file');
        $tempPath = $uploaded->store('temp_uploads/'.$project->id, 'local');
        $mime = $uploaded->getMimeType() ?? 'application/octet-stream';
        $kind = str_starts_with($mime, 'audio/') ? 'audio' : 'text';

        $projectFile = ProjectFile::query()->create([
            'project_id' => $project->id,
            'file_name' => $uploaded->getClientOriginalName(),
            'file_path' => $tempPath,
            'storage_disk' => 'local',
            'mime_type' => $mime,
            'kind' => $kind,
            'status' => 'pending',
            'size_bytes' => $uploaded->getSize(),
        ]);

        ProcessProjectFileUpload::dispatch($projectFile->id);

        return (new ProjectFileResource($projectFile))
            ->response()
            ->setStatusCode(Response::HTTP_ACCEPTED);
    }
}
