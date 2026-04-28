<?php

return [
    // Use a persistent disk (for example s3) in production to keep product media across restarts.
    'attachments_disk' => env(
        'PRODUCT_ATTACHMENTS_DISK',
        env('AWS_BUCKET') ? 's3' : env('FILESYSTEM_DISK', 'public')
    ),
    'attachments_directory' => env('PRODUCT_ATTACHMENTS_DIRECTORY', 'products'),
    'variant_attachments_directory' => env('PRODUCT_VARIANT_ATTACHMENTS_DIRECTORY', 'product-variants'),
];
