<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

Route::get('/', function () {
    return response()->json([
        'name' => config('app.name', 'XETA'),
        'status' => 'ok',
    ]);
});

/**
 * Return a binary asset response with a safe inferred mime type.
 */
$assetResponse = function (string $contents, string $path) {
    $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

    $mimeType = match ($extension) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
        'avif' => 'image/avif',
        default => 'application/octet-stream',
    };

    return response($contents, 200, [
        'Content-Type' => $mimeType,
        'Cache-Control' => 'public, max-age=604800',
    ]);
};

Route::get('/storage/{path}', function (string $path) use ($assetResponse) {
    $normalizedPath = ltrim(str_replace('\\', '/', $path), '/');
    $disk = Storage::disk('public');

    if ($disk->exists($normalizedPath)) {
        return $assetResponse($disk->get($normalizedPath), $normalizedPath);
    }

    // Backward compatibility for legacy files saved under public/uploads.
    $legacyRelativePath = 'uploads/' . $normalizedPath;
    $legacyAbsolutePath = public_path($legacyRelativePath);

    if (File::exists($legacyAbsolutePath) && File::isFile($legacyAbsolutePath)) {
        return $assetResponse(File::get($legacyAbsolutePath), $legacyRelativePath);
    }

    abort(404);
})->where('path', '.*');

Route::get('/uploads/{path}', function (string $path) use ($assetResponse) {
    $normalizedPath = ltrim(str_replace('\\', '/', $path), '/');
    $legacyRelativePath = 'uploads/' . $normalizedPath;
    $legacyAbsolutePath = public_path($legacyRelativePath);

    if (File::exists($legacyAbsolutePath) && File::isFile($legacyAbsolutePath)) {
        return $assetResponse(File::get($legacyAbsolutePath), $legacyRelativePath);
    }

    // Fallback to the storage disk for paths already migrated to /storage.
    $disk = Storage::disk('public');

    if ($disk->exists($normalizedPath)) {
        return $assetResponse($disk->get($normalizedPath), $normalizedPath);
    }

    abort(404);
})->where('path', '.*');
