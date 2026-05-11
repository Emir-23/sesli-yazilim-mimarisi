<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('diagrams', function (Blueprint $table) {
            $table->json('sprint_tasks')->nullable()->after('diagram_data');
            $table->timestamp('sprint_tasks_generated_at')->nullable()->after('sprint_tasks');
        });
    }

    public function down(): void
    {
        Schema::table('diagrams', function (Blueprint $table) {
            $table->dropColumn(['sprint_tasks', 'sprint_tasks_generated_at']);
        });
    }
};
