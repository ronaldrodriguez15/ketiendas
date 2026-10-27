<?php
declare(strict_types=1);
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListarContactosRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    protected function prepareForValidation(): void
    {
        $this->merge(['page' => $this->input('page', 1), 'per_page' => $this->input('per_page', 10)]);
    }

    public function rules(): array
    {
        $supplier = $this->routeIs('suppliers.*');
        $searchFields = ['first_name', 'last_name', 'email', 'phone_number', 'account_number'];
        if ($supplier) $searchFields[] = 'company_name';
        foreach (range(1, 10) as $i) $searchFields[] = 'custom_field_'.$i.'_value';
        return [
            'search' => ['nullable', 'string', 'max:120'],
            'search_field' => ['nullable', Rule::in($searchFields)],
            'sort_col' => ['nullable', Rule::in(['person_id', 'first_name', 'last_name', 'company_name', 'email', 'phone_number', 'account_number', 'balance'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'page' => ['required', 'integer', 'min:1', 'max:21474836'],
            'per_page' => ['required', 'integer', 'between:1,100'],
            'location_id' => $supplier ? ['prohibited'] : ['nullable', 'integer', 'min:1', 'max:2147483647'],
        ];
    }

    public function messages(): array
    {
        return ['*.integer' => 'Debe ser un número entero.', '*.min' => 'El valor está fuera del rango permitido.',
            '*.in' => 'Selecciona una opción válida.', 'per_page.between' => 'Selecciona entre 1 y 100 registros.',
            'search.max' => 'La búsqueda admite hasta 120 caracteres.', 'search.string' => 'La búsqueda debe ser texto.',
            'location_id.prohibited' => 'El filtro de local solo está disponible para clientes.'];
    }
}
