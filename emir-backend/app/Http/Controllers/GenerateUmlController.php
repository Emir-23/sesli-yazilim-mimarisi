<?php

namespace App\Http\Controllers;

use App\Services\AIService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class GenerateUmlController extends Controller
{
    public function __invoke(Request $request, AIService $aiService): JsonResponse
    {
        $validated = $request->validate([
            'text' => ['required', 'string'],
            'type' => ['nullable', 'string', 'in:class,use_case'],
        ]);

        // İstemci 'type' göndermezse 'class'; AIService yalnızca 'class' | 'use_case' alır (karışık mod yok).

        if (trim((string) config('services.gemini.key', '')) === '') {
            return response()->json([
                'message' => 'Lütfen .env dosyanıza GEMINI_API_KEY ekleyin.',
            ], 400);
        }

        try {
            $type = ($validated['type'] ?? 'class') === 'use_case' ? 'use_case' : 'class';
            $diagram = $aiService->generateUmlFromText($validated['text'], $type);

            return response()->json([
                'nodes' => $diagram['nodes'],
                'edges' => $diagram['edges'],
            ]);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 400);
        } catch (Exception $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
