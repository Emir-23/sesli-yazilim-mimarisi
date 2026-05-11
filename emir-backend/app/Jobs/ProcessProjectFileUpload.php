<?php

namespace App\Jobs;

use App\Models\ProjectFile;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class ProcessProjectFileUpload implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $projectFileId) {}

    public function handle(): void
    {
        $file = ProjectFile::query()->find($this->projectFileId);
        if ($file === null || $file->status !== 'pending') {
            return;
        }

        $local = Storage::disk('local');
        $public = Storage::disk('public');

        if (! $local->exists($file->file_path)) {
            $file->update(['status' => 'failed']);

            return;
        }

        try {
            $base = basename($file->file_name);
            $base = Str::ascii($base) !== '' ? Str::ascii($base) : 'upload';
            $base = preg_replace('/[^a-zA-Z0-9._-]+/', '_', $base) ?? 'upload';
            $destination = 'projects/'.$file->project_id.'/'.$file->id.'_'.$base;

            $public->put($destination, $local->get($file->file_path));
            $local->delete($file->file_path);

            $file->update([
                'file_path' => $destination,
                'storage_disk' => 'public',
                'status' => 'stored',
            ]);
        } catch (Throwable $e) {
            Log::warning('ProcessProjectFileUpload başarısız', [
                'project_file_id' => $file->id,
                'exception' => $e->getMessage(),
            ]);
            $file->update(['status' => 'failed']);
            throw $e;
        }
    }
}
