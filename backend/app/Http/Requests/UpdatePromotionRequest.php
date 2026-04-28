<?php

namespace App\Http\Requests;

class UpdatePromotionRequest extends StorePromotionRequest
{
    public function rules(): array
    {
        $rules = parent::rules();

        foreach ($rules as $field => $fieldRules) {
            if ($field === 'name' || $field === 'discount_type' || $field === 'scope') {
                $rules[$field] = ['sometimes', ...$fieldRules];
                continue;
            }

            if ($field === 'product_ids' || $field === 'category_ids') {
                $rules[$field] = ['sometimes', 'array'];
                continue;
            }
        }

        return $rules;
    }
}
