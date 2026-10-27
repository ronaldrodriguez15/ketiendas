<?php
declare(strict_types=1);
namespace App\Http\Controllers;

use App\Services\Sales\CierreService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

final class CierreController extends Controller
{
    public function __invoke(Request $request, CierreService $service): JsonResponse
    {
        $today = CarbonImmutable::now('America/Bogota')->format('Y-m-d');
        $input = $request->validate(['fecha' => ['sometimes', 'required', 'date_format:Y-m-d', 'before_or_equal:'.$today],
            'forma_pago' => ['sometimes', 'required', 'string', 'max:80'],
            'page' => ['sometimes', 'integer', 'min:1'], 'per_page' => ['sometimes', 'integer', 'in:10,25,50']],
            ['fecha.required' => 'Selecciona un día.', 'fecha.date_format' => 'Selecciona una fecha válida.', 'fecha.before_or_equal' => 'El día no puede ser posterior a hoy.']);
        if (isset($input['forma_pago'])) return response()->json($service->detail($input['fecha'] ?? $today,
            $input['forma_pago'], (int) ($input['page'] ?? 1), (int) ($input['per_page'] ?? 10)));
        return response()->json($service->summary($input['fecha'] ?? $today));
    }
}
