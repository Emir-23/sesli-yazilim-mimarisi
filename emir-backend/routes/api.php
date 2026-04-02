<?php

use App\Http\Controllers\GenerateUmlController;
use App\Http\Controllers\ProjectController;
use Illuminate\Support\Facades\Route;

Route::post('/generate-uml', GenerateUmlController::class);

Route::apiResource('projects', ProjectController::class)->only(['index', 'show', 'store']);
