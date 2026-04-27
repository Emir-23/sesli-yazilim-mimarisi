<?php

use App\Http\Controllers\GenerateUmlController;
use App\Http\Controllers\ProjectChatController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectTranscriptController;
use Illuminate\Support\Facades\Route;

Route::post('/generate-uml', GenerateUmlController::class);

Route::apiResource('projects', ProjectController::class)->only(['index', 'show', 'store']);
Route::get('/projects/{project}/chat-logs', [ProjectChatController::class, 'index']);
Route::post('/projects/{project}/chat-logs', [ProjectChatController::class, 'store']);
Route::get('/projects/{project}/transcripts', [ProjectTranscriptController::class, 'index']);
Route::post('/projects/{project}/transcripts', [ProjectTranscriptController::class, 'store']);
Route::get('/projects/{project}/deepgram/live-config', [ProjectTranscriptController::class, 'deepgramConfig']);
