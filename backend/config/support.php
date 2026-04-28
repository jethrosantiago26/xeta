<?php

return [
    // Use a persistent disk (for example s3) in production to keep support attachments across restarts.
    'attachments_disk' => env(
        'SUPPORT_ATTACHMENTS_DISK',
        env('AWS_BUCKET') ? 's3' : env('FILESYSTEM_DISK', 'public')
    ),
    'attachments_directory' => env('SUPPORT_ATTACHMENTS_DIRECTORY', 'support-attachments'),
];
