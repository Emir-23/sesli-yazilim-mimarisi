<?php

namespace App\Http\Controllers;

use App\Services\AIService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GenerateUmlController extends Controller
{
    public function __invoke(Request $request, AIService $aiService): JsonResponse
    {
        $validated = $request->validate([
            'text' => ['required', 'string'],
        ]);

        try {
            $uml = $aiService->generateUmlFromText($validated['text']);

            return response()->json(['uml' => $uml]);
        } catch (Exception $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
