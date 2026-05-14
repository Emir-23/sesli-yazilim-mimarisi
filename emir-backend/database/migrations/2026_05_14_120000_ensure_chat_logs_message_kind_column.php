<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Eski veritabanlarında `message_kind` yoksa ekler (ProjectChatController ile uyum).
     */
    public function up(): void
    {
        if (Schema::hasTable('chat_logs') && ! Schema::hasColumn('chat_logs', 'message_kind')) {
            Schema::table('chat_logs', function (Blueprint $table) {
                $table->string('message_kind', 32)
                    ->default('plain_text')
                    ->after('message')
                    ->comment('plain_text | voice_transcript');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('chat_logs') && Schema::hasColumn('chat_logs', 'message_kind')) {
            Schema::table('chat_logs', function (Blueprint $table) {
                $table->dropColumn('message_kind');
            });
        }
    }
};
