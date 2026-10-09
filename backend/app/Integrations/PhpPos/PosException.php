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
            default => 'El POS no está disponible. Intenta de nuevo en unos minutos.',
        });
    }

    public function report(): bool { return true; } // Never log upstream response/credentials.

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], match ($this->kind) {
            'auth' => 502, 'not_found' => 404, default => 504,
        })->header('Cache-Control', 'no-store');
    }
}
