<?php

namespace App\Services;

use App\Models\ProductVariant;

class VariantVisualService
{
    private const NAMED_COLORS = [
        'black' => '#1f2937',
        'graphite' => '#374151',
        'silver' => '#9ca3af',
        'white' => '#f4f7ff',
        'red' => '#ef4444',
        'blue' => '#2563eb',
        'green' => '#16a34a',
        'yellow' => '#f59e0b',
        'orange' => '#ea580c',
        'purple' => '#7c3aed',
        'pink' => '#ec4899',
        'teal' => '#0d9488',
        'cyan' => '#0891b2',
        'gold' => '#ca8a04',
        'brown' => '#92400e',
    ];

    public function buildAttributes(array $payload, ?ProductVariant $existingVariant = null): array
    {
        $incomingAttributes = is_array($payload['attributes'] ?? null) ? $payload['attributes'] : [];
        $existingAttributes = is_array($existingVariant?->attributes) ? $existingVariant->attributes : [];

        $attributes = array_merge($existingAttributes, $incomingAttributes);

        $name = (string) ($payload['name'] ?? $existingVariant?->name ?? 'Variant');
        $sku = (string) ($payload['sku'] ?? $existingVariant?->sku ?? 'SKU');
        $seed = (string) ($existingVariant?->id ?? $payload['id'] ?? '');

        $colorHex = $this->resolveColorHex($name, $sku, $attributes, $seed);

        $attributes['color_hex'] = $colorHex;

        if (array_key_exists('image_url', $attributes)) {
            $imageUrl = trim((string) $attributes['image_url']);

            if ($imageUrl === '') {
                unset($attributes['image_url']);
            } else {
                $attributes['image_url'] = $imageUrl;
            }
        }

        return $attributes;
    }

    private function resolveColorHex(string $variantName, string $variantSku, array $attributes, string $seed): string
    {
        $attributeHex = $this->normalizeHex(
            (string) ($attributes['color_hex'] ?? $attributes['colour_hex'] ?? $attributes['hex'] ?? ''),
        );

        if ($attributeHex !== '') {
            return $attributeHex;
        }

        $namedColor = $this->extractNamedColor(
            mb_strtolower(
                trim(
                    $variantName . ' ' . (string) ($attributes['color'] ?? '') . ' ' . (string) ($attributes['colour'] ?? ''),
                ),
            ),
        );

        if ($namedColor !== '') {
            return $namedColor;
        }

        $hash = abs((int) crc32($seed . ':' . $variantSku . ':' . $variantName));
        $hue = $hash % 360;
        $saturation = 64 + ($hash % 12);
        $lightness = 48 + (($hash >> 3) % 8);

        return $this->hslToHex($hue, $saturation, $lightness);
    }

    private function extractNamedColor(string $text): string
    {
        foreach (self::NAMED_COLORS as $name => $hex) {
            if (str_contains($text, $name)) {
                return $hex;
            }
        }

        return '';
    }

    private function normalizeHex(string $value): string
    {
        $trimmed = strtolower(trim($value));

        if ($trimmed === '') {
            return '';
        }

        if (preg_match('/^#[0-9a-f]{3}$/', $trimmed) === 1) {
            return '#' . $trimmed[1] . $trimmed[1] . $trimmed[2] . $trimmed[2] . $trimmed[3] . $trimmed[3];
        }

        if (preg_match('/^#[0-9a-f]{6}$/', $trimmed) === 1) {
            return $trimmed;
        }

        return '';
    }

    private function hslToHex(int $hue, int $saturation, int $lightness): string
    {
        $h = (($hue % 360) + 360) % 360;
        $s = max(0, min(100, $saturation)) / 100;
        $l = max(0, min(100, $lightness)) / 100;

        $c = (1 - abs(2 * $l - 1)) * $s;
        $x = $c * (1 - abs(fmod($h / 60, 2) - 1));
        $m = $l - $c / 2;

        $r = 0;
        $g = 0;
        $b = 0;

        if ($h < 60) {
            $r = $c;
            $g = $x;
        } elseif ($h < 120) {
            $r = $x;
            $g = $c;
        } elseif ($h < 180) {
            $g = $c;
            $b = $x;
        } elseif ($h < 240) {
            $g = $x;
            $b = $c;
        } elseif ($h < 300) {
            $r = $x;
            $b = $c;
        } else {
            $r = $c;
            $b = $x;
        }

        $red = (int) round(($r + $m) * 255);
        $green = (int) round(($g + $m) * 255);
        $blue = (int) round(($b + $m) * 255);

        return sprintf('#%02x%02x%02x', $red, $green, $blue);
    }

}
