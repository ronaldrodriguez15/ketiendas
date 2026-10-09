<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\ListarVentasRequest;
use App\Http\Resources\VentaListadoResource;
use App\Services\Sales\SalesService;
use Illuminate\Http\JsonResponse;

final class VentaController extends Controller
{
    public function index(ListarVentasRequest $request, SalesService $service): JsonResponse
    {
        $result = $service->listing($request->validated());
        return response()->json(['data' => VentaListadoResource::collection($result['data'])->resolve($request), 'meta' => $result['meta']])
            ->header('Cache-Control', $result['meta']['parcial'] ? 'private, no-store' : 'private, max-age=30')
            ->header('Vary', 'Cookie, Authorization, Origin');
    }

    public function show(int $id, SalesService $service): JsonResponse
    {
        return response()->json(['data' => $service->detail($id)])
            ->header('Cache-Control', 'private, max-age=30')->header('Vary', 'Cookie, Authorization, Origin');
    }
}
