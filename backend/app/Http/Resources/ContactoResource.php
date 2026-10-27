<?php
declare(strict_types=1);
namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class ContactoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $result = ['person_id' => (int) $this->resource['person_id']];
        foreach (['first_name', 'last_name', 'company_name', 'email', 'phone_number', 'account_number', 'address_1', 'city'] as $field) {
            $value = $this->resource[$field] ?? null;
            $result[$field] = is_scalar($value) ? mb_substr(trim(strip_tags((string) $value)), 0, 500) : '';
        }
        $fields = $request->routeIs('customers.*') ? ['balance', 'credit_limit', 'points'] : ['balance'];
        foreach ($fields as $field) {
            $value = $this->resource[$field] ?? null;
            $result[$field] = is_numeric($value) && is_finite((float) $value) ? (float) $value : null;
        }
        return $result;
    }
}
