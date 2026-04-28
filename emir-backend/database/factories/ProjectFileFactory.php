<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\ProjectFile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProjectFile>
 */
class ProjectFileFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $slug = fake()->slug(2);

        return [
            'project_id' => Project::factory(),
            'file_name' => $slug.'.mp3',
            'file_path' => 'storage/recordings/'.$slug.'-'.fake()->uuid().'.mp3',
        ];
    }
}
