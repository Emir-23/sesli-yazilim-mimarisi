<?php

namespace App\Http\Resources;

use App\Models\ProjectFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ProjectFile */
class ProjectFileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'file_name' => $this->file_name,
            'file_path' => $this->file_path,
            'storage_disk' => $this->storage_disk,
            'mime_type' => $this->mime_type,
            'kind' => $this->kind,
            'status' => $this->status,
            'size_bytes' => $this->size_bytes,
            'url' => $this->when(
                $this->storage_disk === 'public' && $this->status === 'stored',
                fn () => Storage::disk('public')->url($this->file_path)
            ),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
