<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_files', function (Blueprint $table) {
            $table->string('storage_disk', 32)->default('public')->after('file_path');
            $table->string('mime_type', 191)->nullable()->after('storage_disk');
            $table->string('kind', 32)->default('other')->after('mime_type')->comment('audio | text | other');
            $table->string('status', 32)->default('stored')->after('kind')->comment('pending | stored | failed');
            $table->unsignedBigInteger('size_bytes')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('project_files', function (Blueprint $table) {
            $table->dropColumn(['storage_disk', 'mime_type', 'kind', 'status', 'size_bytes']);
        });
    }
};
