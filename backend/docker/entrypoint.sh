#!/bin/sh
set -eu

mkdir -p \
  /var/www/html/storage/app/public/products \
  /var/www/html/storage/app/public/product-variants \
  /var/www/html/storage/app/public/support-attachments

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R ug+rwX /var/www/html/storage /var/www/html/bootstrap/cache

if [ "${RUN_MIGRATIONS_ON_BOOT:-false}" = "true" ]; then
  php artisan migrate --force
fi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
