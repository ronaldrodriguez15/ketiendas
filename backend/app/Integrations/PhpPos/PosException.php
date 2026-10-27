<?php
declare(strict_types=1);

namespace App\Integrations\PhpPos;

use RuntimeException;
use Illuminate\Http\JsonResponse;

final class PosException extends RuntimeException
{
    public function __construct(public readonly string $kind = 'unavailable')
    {
        parent::__construct(match ($kind) {
            'auth' => 'No se pudo autenticar la conexión con el POS.',
            'not_found' => 'La venta no existe.',
            'contact_not_found' => 'El cliente o proveedor no existe.',
            'invalid_parameters' => 'El POS rechazó los filtros. Revisa los parámetros de búsqueda.',
            'invalid_response' => 'El POS devolvió una respuesta incompleta o no válida. Intenta de nuevo.',
            'upstream_failure' => 'El POS no pudo completar la consulta. Intenta de nuevo en unos minutos.',
            default => 'El POS no está disponible. Intenta de nuevo en unos minutos.',
        });
    }

    public function report(): bool { return true; } // Never log upstream response/credentials.

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], match ($this->kind) {
            'auth' => 502, 'not_found' => 404,
            'contact_not_found' => 404, 'invalid_parameters' => 422,
            'invalid_response', 'upstream_failure' => 502,
            default => 502,
        })->header('Cache-Control', 'no-store');
    }
}
