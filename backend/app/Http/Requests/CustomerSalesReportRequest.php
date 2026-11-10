<?php
declare(strict_types=1);
namespace App\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

final class CustomerSalesReportRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    protected function prepareForValidation(): void
    {
        $today = CarbonImmutable::now('America/Bogota');
        $this->merge([
            'desde' => $this->input('desde', $today->subDays(29)->format('Y-m-d')),
            'hasta' => $this->input('hasta', $today->format('Y-m-d')),
            'page' => $this->input('page', 1), 'per_page' => $this->input('per_page', 20),
        ]);
    }
    public function rules(): array
    {
        return array_intersect_key((new ListarVentasRequest())->rules(), array_flip(['desde', 'hasta', 'page', 'per_page', 'q', 'local_id']));
    }
    public function messages(): array { return (new ListarVentasRequest())->messages(); }
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) return;
            if (CarbonImmutable::parse($this->input('desde'))->diffInDays(CarbonImmutable::parse($this->input('hasta'))) > 30) {
                $validator->errors()->add('hasta', 'Selecciona un periodo de hasta 31 días.');
            }
        }];
    }
}
