<?php

namespace Database\Factories;

use App\Models\Diagram;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Diagram>
 */
class DiagramFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'diagram_data' => [
                'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
                'nodes' => [
                    ['id' => 'n1', 'type' => 'input', 'label' => fake()->words(2, true), 'position' => ['x' => 80, 'y' => 120]],
                    ['id' => 'n2', 'type' => 'process', 'label' => fake()->words(2, true), 'position' => ['x' => 280, 'y' => 120]],
                    ['id' => 'n3', 'type' => 'output', 'label' => fake()->words(2, true), 'position' => ['x' => 480, 'y' => 120]],
                ],
                'edges' => [
                    ['id' => 'e1', 'source' => 'n1', 'target' => 'n2'],
                    ['id' => 'e2', 'source' => 'n2', 'target' => 'n3'],
                ],
            ],
        ];
    }
}
