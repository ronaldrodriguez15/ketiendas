<?php
declare(strict_types=1);
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class TopProductsRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    protected function prepareForValidation(): void
    {
        $this->merge(['periodo' => $this->input('periodo', 'dia')]);
    }
    public function rules(): array
    {
        return ['periodo' => ['required', 'in:dia,semana,mes'], 'local_id' => ['sometimes', 'integer', 'min:1']];
    }
}
