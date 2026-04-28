<?php

namespace App\Http\Requests;

use App\Models\Promotion;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StorePromotionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string'],
            'discount_type' => ['required', 'in:percentage,fixed,bogo,bundle'],
            'scope' => ['required', 'in:order,product,category'],
            'value' => ['nullable', 'numeric', 'min:0'],
            'buy_quantity' => ['nullable', 'integer', 'min:1'],
            'get_quantity' => ['nullable', 'integer', 'min:1'],
            'bundle_price' => ['nullable', 'numeric', 'min:0'],
            'min_purchase_amount' => ['nullable', 'numeric', 'min:0'],
            'first_order_only' => ['sometimes', 'boolean'],
            'requires_code' => ['sometimes', 'boolean'],
            'is_stackable' => ['sometimes', 'boolean'],
            'priority' => ['sometimes', 'integer', 'min:1', 'max:1000'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'usage_limit_per_user' => ['nullable', 'integer', 'min:1'],
            'conditions' => ['nullable', 'array'],
            'conditions.variant_ids' => ['nullable', 'array'],
            'conditions.variant_ids.*' => ['integer', 'exists:product_variants,id'],
            'conditions.bundle_product_ids' => ['nullable', 'array'],
            'conditions.bundle_product_ids.*' => ['integer', 'exists:products,id'],
            'conditions.bundle_quantity' => ['nullable', 'integer', 'min:1'],
            'conditions.bundle_price' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'product_ids' => ['nullable', 'array'],
            'product_ids.*' => ['integer', 'exists:products,id'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $discountType = $this->input('discount_type');
            $scope = $this->input('scope');
            $requiresCode = $this->boolean('requires_code');

            if ($requiresCode && trim((string) $this->input('code')) === '') {
                $validator->errors()->add('code', 'A promo code is required when requires_code is enabled.');
            }

            if ($scope === Promotion::SCOPE_PRODUCT && empty($this->input('product_ids', []))) {
                $validator->errors()->add('product_ids', 'At least one product is required for product-scoped promotions.');
            }

            if ($scope === Promotion::SCOPE_PRODUCT && empty(data_get($this->input('conditions', []), 'variant_ids', []))) {
                $validator->errors()->add('conditions.variant_ids', 'At least one variant is required for product sales.');
            }

            if ($scope === Promotion::SCOPE_CATEGORY && empty($this->input('category_ids', []))) {
                $validator->errors()->add('category_ids', 'At least one category is required for category-scoped promotions.');
            }

            if ($discountType === Promotion::DISCOUNT_PERCENTAGE) {
                $value = (float) $this->input('value', 0);

                if ($value <= 0 || $value > 100) {
                    $validator->errors()->add('value', 'Percentage discounts must be between 0.01 and 100.');
                }
            }

            if ($discountType === Promotion::DISCOUNT_FIXED && (float) $this->input('value', 0) <= 0) {
                $validator->errors()->add('value', 'Fixed discounts require a positive value.');
            }

            if ($discountType === Promotion::DISCOUNT_BOGO) {
                if ((int) $this->input('buy_quantity', 0) <= 0) {
                    $validator->errors()->add('buy_quantity', 'BOGO requires a buy quantity.');
                }

                if ((int) $this->input('get_quantity', 0) <= 0) {
                    $validator->errors()->add('get_quantity', 'BOGO requires a get quantity.');
                }

                if ($scope === Promotion::SCOPE_ORDER) {
                    $validator->errors()->add('scope', 'BOGO promotions must target products or categories.');
                }
            }

            if ($discountType === Promotion::DISCOUNT_BUNDLE) {
                $bundlePrice = (float) ($this->input('bundle_price') ?? data_get($this->input('conditions', []), 'bundle_price', 0));

                if ($bundlePrice <= 0) {
                    $validator->errors()->add('bundle_price', 'Bundle promotions require a bundle_price greater than zero.');
                }

                if (empty(data_get($this->input('conditions', []), 'bundle_product_ids', []))) {
                    $validator->errors()->add('conditions.bundle_product_ids', 'Bundle promotions require bundle_product_ids.');
                }
            }
        });
    }
}
