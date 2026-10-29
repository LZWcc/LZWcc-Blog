#!/bin/sh
set -eu
umask 077
backup_directory=/root/backups/umami-blog
mkdir -p "$backup_directory"
backup_file="$backup_directory/umami-$(date -u +%Y%m%dT%H%M%SZ).dump"
cd /opt/umami-blog
docker compose exec -T db pg_dump -U umami -d umami -Fc > "$backup_file.tmp"
mv "$backup_file.tmp" "$backup_file"
echo "Umami database backup created: $backup_file"
