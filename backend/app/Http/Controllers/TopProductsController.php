<?php
declare(strict_types=1);
namespace App\Http\Controllers;

use App\Http\Requests\TopProductsRequest;
use App\Services\Sales\TopProductsService;
use Illuminate\Http\JsonResponse;

final class TopProductsController extends Controller
{
    public function __invoke(TopProductsRequest $request, TopProductsService $service): JsonResponse
    {
        return response()->json($service->report($request->validated()))
            ->header('Cache-Control', 'private, no-store')->header('Vary', 'Cookie, Authorization, Origin');
    }
}
