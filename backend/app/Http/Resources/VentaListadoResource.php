<?php
declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Arr;

final class VentaListadoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return Arr::only($this->resource, ['id', 'fecha', 'cliente', 'total', 'forma_pago', 'items', 'estado', 'recibo_url']);
    }
}
