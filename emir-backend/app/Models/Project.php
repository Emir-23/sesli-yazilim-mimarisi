<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Project extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'title',
        'description',
    ];

    public function files(): HasMany
    {
        return $this->hasMany(ProjectFile::class);
    }

    public function diagram(): HasOne
    {
        return $this->hasOne(Diagram::class);
    }

    public function chatLogs(): HasMany
    {
        return $this->hasMany(ChatLog::class);
    }

    public function transcripts(): HasMany
    {
        return $this->hasMany(Transcript::class);
    }
}
