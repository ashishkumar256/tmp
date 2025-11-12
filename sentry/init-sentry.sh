#!/usr/bin/env bash
set -e

echo "Running sentry upgrade..."
# sed -i "s|^SENTRY_USE_RELAY *= *.*|SENTRY_USE_RELAY = False|" /etc/sentry/sentry.conf.py
cp /etc/sentry/sentry.conf.py /tmp/sentry.conf.py.bakup
sed -i "s|^# SECURE_PROXY_SSL_HEADER =.*|SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')|" /etc/sentry/sentry.conf.py
sed -i "s|^# SESSION_COOKIE_SECURE = True|SESSION_COOKIE_SECURE = True|" /etc/sentry/sentry.conf.py
sed -i "s|^# CSRF_COOKIE_SECURE = True|CSRF_COOKIE_SECURE = True|" /etc/sentry/sentry.conf.py

cat <<'EOF' >> /etc/sentry/sentry.conf.py
SENTRY_BEACON = False
SENTRY_ALLOW_ORIGIN="*"

CSRF_TRUSTED_ORIGINS = [
    "http://*.killercoda.com",
    "https://*.killercoda.com",
]

EOF

# # Allow Django to trust frontend origins for CSRF
# CSRF_TRUSTED_ORIGINS = [
#     "https://*.killercoda.com",
#     "http://*.killercoda.com",
# ]

# MIDDLEWARE = [
#     mw for mw in globals().get("MIDDLEWARE", [])
#     if mw != "django.middleware.csrf.CsrfViewMiddleware"
# ]



sentry upgrade --noinput

# Create superuser if environment variables provided
if [ -n "$SENTRY_ADMIN_EMAIL" ] && [ -n "$SENTRY_ADMIN_PASSWORD" ]; then
  echo "Creating admin user $SENTRY_ADMIN_EMAIL"
  sentry createuser --email "$SENTRY_ADMIN_EMAIL" \
                    --password "$SENTRY_ADMIN_PASSWORD" \
                    --superuser
else
  echo "SENTRY_ADMIN_EMAIL or SENTRY_ADMIN_PASSWORD not set — skipping user creation"
fi

# Now run the web server
echo "Starting Sentry web server"
exec tini -- sentry run web