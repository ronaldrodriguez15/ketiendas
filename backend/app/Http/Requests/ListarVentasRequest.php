<?php
declare(strict_types=1);

namespace App\Http\Requests;

use App\Services\Sales\SaleMapper;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class ListarVentasRequest extends FormRequest
{
    public function authorize(): bool { return true; } // Route enforces Sanctum.

    protected function prepareForValidation(): void
    {
        $today = CarbonImmutable::now('America/Bogota');
        $this->merge([
            'desde' => $this->input('desde', $today->subDays(6)->format('Y-m-d')),
            'hasta' => $this->input('hasta', $today->format('Y-m-d')),
            'page' => $this->input('page', 1), 'per_page' => $this->input('per_page', 10),
        ]);
    }

    public function rules(): array
    {
        return [
            'desde' => ['required', 'date_format:Y-m-d'],
            'hasta' => ['required', 'date_format:Y-m-d', 'after_or_equal:desde'],
            'page' => ['required', 'integer', 'min:1', 'max:21474836'],
            'per_page' => ['required', 'integer', 'between:1,100'],
            'q' => ['nullable', 'string', 'max:60'],
            'estado' => ['nullable', Rule::in(SaleMapper::STATES)],
            'credito_antiguo' => ['sometimes', 'boolean'],
            'local_id' => ['nullable', 'integer', 'min:1'],
            'cliente_id' => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) return;
            $start = CarbonImmutable::createFromFormat('!Y-m-d', $this->input('desde'), 'America/Bogota');
            $end = CarbonImmutable::createFromFormat('!Y-m-d', $this->input('hasta'), 'America/Bogota');
            if ($start->diffInDays($end) + 1 > (int) config('phppos.max_dias')) {
                $validator->errors()->add('hasta', 'El rango máximo es de '.config('phppos.max_dias').' días.');
            }
        }];
    }

    public function messages(): array
    {
        return [
            '*.required' => 'Este campo es obligatorio.', '*.integer' => 'Debe ser un número entero.',
            '*.min' => 'El valor mínimo es 1.', '*.date_format' => 'Usa una fecha válida con formato AAAA-MM-DD.',
            'hasta.after_or_equal' => 'La fecha final no puede ser anterior a la inicial.',
            'per_page.between' => 'Selecciona entre 1 y 100 filas.', 'estado.in' => 'El estado no es válido.',
            'q.max' => 'La búsqueda admite hasta 60 caracteres.', 'q.string' => 'La búsqueda debe ser texto.',
        ];
    }
}
