hostname playgroud

mkdir -p ./postgres_data
chown -R 1000:1000 ./postgres_data

# cat <<EOF > config.yml
# system.admin-email: "admin@example.com" 
# system.secret-key: "$(date | base64 -w 0)" 
# EOF

chmod +x ./init-sentry.sh

docker-compose up -d