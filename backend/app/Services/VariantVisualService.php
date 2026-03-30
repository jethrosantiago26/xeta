<?php

namespace App\Services;

use App\Models\Product;
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

    public function buildAttributes(Product $product, array $payload, ?ProductVariant $existingVariant = null): array
    {
        $incomingAttributes = is_array($payload['attributes'] ?? null) ? $payload['attributes'] : [];
        $existingAttributes = is_array($existingVariant?->attributes) ? $existingVariant->attributes : [];

        $attributes = array_merge($existingAttributes, $incomingAttributes);

        $name = (string) ($payload['name'] ?? $existingVariant?->name ?? 'Variant');
        $sku = (string) ($payload['sku'] ?? $existingVariant?->sku ?? 'SKU');
        $seed = (string) ($existingVariant?->id ?? $payload['id'] ?? '');

        $colorHex = $this->resolveColorHex($name, $sku, $attributes, $seed);

        $attributes['color_hex'] = $colorHex;

        $imageUrl = trim((string) ($attributes['image_url'] ?? ''));

        if ($imageUrl === '') {
            $attributes['image_url'] = $this->generateVariantImageDataUri(
                (string) $product->name,
                $name,
                $colorHex,
            );
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

    private function hexToRgb(string $hex): array
    {
        $normalized = $this->normalizeHex($hex);

        if ($normalized === '') {
            return ['r' => 0, 'g' => 0, 'b' => 0];
        }

        return [
            'r' => hexdec(substr($normalized, 1, 2)),
            'g' => hexdec(substr($normalized, 3, 2)),
            'b' => hexdec(substr($normalized, 5, 2)),
        ];
    }

    private function mixHex(string $leftHex, string $rightHex, float $leftWeight = 0.5): string
    {
        $left = $this->hexToRgb($leftHex);
        $right = $this->hexToRgb($rightHex);

        $weight = max(0, min(1, $leftWeight));
        $rightWeight = 1 - $weight;

        $red = (int) round($left['r'] * $weight + $right['r'] * $rightWeight);
        $green = (int) round($left['g'] * $weight + $right['g'] * $rightWeight);
        $blue = (int) round($left['b'] * $weight + $right['b'] * $rightWeight);

        return sprintf('#%02x%02x%02x', $red, $green, $blue);
    }

    private function generateVariantImageDataUri(string $productName, string $variantName, string $color): string
    {
        $tint = $this->mixHex($color, '#ffffff', 0.72);
        $shade = $this->mixHex($color, '#0b1020', 0.6);
        $soft = $this->mixHex($color, '#dde6ff', 0.35);
        $deeper = $this->mixHex($color, '#020617', 0.42);
        $ring = $this->mixHex($color, '#ffffff', 0.5);

        $productLabel = e($productName);
        $variantLabel = e($variantName);

        $svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 900' role='img' aria-label='{$productLabel} {$variantLabel}'><defs><linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='{$tint}'/><stop offset='100%' stop-color='{$shade}'/></linearGradient><linearGradient id='panel' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='{$soft}' stop-opacity='0.9'/><stop offset='100%' stop-color='{$deeper}' stop-opacity='0.82'/></linearGradient><linearGradient id='device' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#f8fbff' stop-opacity='0.92'/><stop offset='100%' stop-color='{$ring}' stop-opacity='0.78'/></linearGradient><filter id='shadow' x='-20%' y='-20%' width='140%' height='160%'><feDropShadow dx='0' dy='24' stdDeviation='22' flood-opacity='0.22'/></filter></defs><rect x='24' y='24' width='1152' height='852' rx='64' fill='url(#bg)'/><g filter='url(#shadow)'><rect x='120' y='158' width='960' height='584' rx='52' fill='url(#panel)'/><rect x='220' y='258' width='760' height='190' rx='34' fill='url(#device)'/><rect x='260' y='292' width='682' height='30' rx='12' fill='{$color}' fill-opacity='0.55'/><g fill='{$deeper}' fill-opacity='0.34'><rect x='268' y='336' width='72' height='28' rx='9'/><rect x='350' y='336' width='72' height='28' rx='9'/><rect x='432' y='336' width='72' height='28' rx='9'/><rect x='514' y='336' width='72' height='28' rx='9'/><rect x='596' y='336' width='72' height='28' rx='9'/><rect x='678' y='336' width='72' height='28' rx='9'/><rect x='760' y='336' width='72' height='28' rx='9'/><rect x='842' y='336' width='92' height='28' rx='9'/></g><g><ellipse cx='428' cy='568' rx='186' ry='102' fill='url(#device)'/><ellipse cx='428' cy='568' rx='126' ry='68' fill='{$color}' fill-opacity='0.5'/></g><g><rect x='620' y='496' width='302' height='148' rx='64' fill='url(#device)'/><circle cx='698' cy='570' r='22' fill='{$color}' fill-opacity='0.64'/><circle cx='842' cy='570' r='22' fill='{$color}' fill-opacity='0.64'/></g></g></svg>";

        return 'data:image/svg+xml;utf8,' . rawurlencode($svg);
    }
}
