# Sentry Learning UI

A React application to learn and test Sentry error tracking in a development environment.

## Quick Start

### Option 1: Docker (Recommended)
\`\`\`bash
# Start the development environment
docker-compose up --build

# Visit http://localhost:80 (or your Killercoda provided URL)
\`\`\`

### Option 2: Local Development
\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Visit http://localhost:3000
\`\`\`

## Features

- 🔥 Trigger different types of errors
- 🌐 Test Sentry with and without DSN
- 👤 Set user context and custom tags
- 🍞 Add breadcrumbs for event trails
- 📊 Real-time activity logging
- 🚨 Error boundary for React components
- 🎯 Interactive UI for learning Sentry concepts

## Sentry DSN Configuration

1. Get a DSN from [sentry.io](https://sentry.io) (free tier available)
2. Add it to \`.env\` file:
   \`\`\`env
   VITE_SENTRY_DSN=your_dsn_here
   \`\`\`
3. Restart the application

## What You Can Test

### Error Types
- **Runtime Errors**: Uncaught exceptions that crash components
- **API Errors**: Simulated network request failures
- **Validation Errors**: Form validation with warnings/info messages
- **Promise Rejections**: Unhandled promise rejections
- **Custom Errors**: Manually captured exceptions

### Sentry Features
- **User Context**: Associate errors with specific users
- **Custom Tags**: Add metadata for filtering and search
- **Breadcrumbs**: Create trails of events leading to errors
- **Error Boundaries**: React component error handling

## Learning Objectives

- Understand how Sentry captures different error types
- Learn about error boundaries in React
- Practice setting user context and metadata
- See how breadcrumbs create event trails
- Test Sentry behavior with and without a DSN
- Learn debugging techniques with activity logs

## Development Notes

- Without a DSN, Sentry will log debug messages to browser console
- Runtime errors will trigger the error boundary with recovery option
- Check browser console for detailed Sentry debug logs
- All actions are logged in the activity panel for learning
- Hot reloading is enabled for smooth development

## Project Structure

\`\`\`
sentry-learning-ui/
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # Application styles
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── docker-compose.yml   # Docker development setup
├── Dockerfile          # Container configuration
├── vite.config.js      # Vite build tool configuration
├── package.json        # Dependencies and scripts
└── .env               # Environment variables
\`\`\`

## Troubleshooting

### Common Issues

1. **Blocked host error**: 
   - Solution: Vite config allows all hosts, should work in Killercoda

2. **Docker port issues**:
   - App runs on port 3000 inside container, mapped to port 80 on host

3. **Hot reload not working**:
   - Ensure volume mounts are working in Docker
   - Check CHOKIDAR_USEPOLLING environment variable

4. **Sentry not capturing errors**:
   - Check browser console for Sentry debug messages
   - Verify DSN is correctly set in environment variables
   - Without DSN, errors are logged to console only

### Killercoda Specific

- Application will be available at the provided Killercoda URL
- Port 80 is automatically exposed by Killercoda
- All hosts are allowed in Vite configuration

## Next Steps

After exploring this learning UI:

1. **Set up a real Sentry account** at [sentry.io](https://sentry.io)
2. **Integrate Sentry** into your own projects
3. **Explore advanced features** like performance monitoring
4. **Set up alerting** and notifications
5. **Learn about source maps** for better error tracking

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [React Error Boundaries](https://reactjs.org/docs/error-boundaries.html)
- [Vite Documentation](https://vitejs.dev/)

Happy learning! 🚀


----
```
hostname playgroud

mkdir -p ./postgres_data
chown -R 1000:1000 ./postgres_data

# cat <<EOF > config.yml
# system.admin-email: "admin@example.com" 
# system.secret-key: "$(date | base64 -w 0)" 
# EOF

cat <<'EOF' > init-sentry.sh
#!/usr/bin/env bash
set -e

# Run migrations / upgrade
echo "Running sentry upgrade..."
# sed -i 's/^SENTRY_USE_RELAY *= *.*/SENTRY_USE_RELAY = False/' /etc/sentry/sentry.conf.py
echo "SENTRY_BEACON = False" >> /etc/sentry/sentry.conf.py
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
EOF


chmod +x ./init-sentry.sh

cat <<'EOF' > docker-compose.yaml
version: "3.9"

services:
  postgres:
    container_name: postgres
    image: postgres:18.0-alpine3.22
    environment:
      POSTGRES_HOST_AUTH_METHOD: trust
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    volumes:
      - postgres_data:/var/lib/postgresql/data
    expose:
      - 5432

  redis:
    container_name: redis
    image: redis:8.2.3-alpine3.22
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
    expose:
      - 6379

  sentry:
    container_name: sentry
    image: ghcr.io/getsentry/sentry:25.10.0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "8080:9000"
    environment:
      SENTRY_SECRET_KEY: "replace-with-a-secure-random-value"
      SENTRY_POSTGRES_HOST: postgres
      SENTRY_POSTGRES_PORT: 5432
      SENTRY_DB_USER: postgres
      SENTRY_DB_NAME: postgres
      SENTRY_REDIS_HOST: redis
      SENTRY_LOG_LEVEL: DEBUG
      SENTRY_ADMIN_EMAIL: admin@gmail.com
      SENTRY_ADMIN_PASSWORD: Test@123
    command: ["/tmp/init-sentry.sh"]
    volumes:
      - ./init-sentry.sh:/tmp/init-sentry.sh:ro      
volumes:
  postgres_data:
EOF

docker-compose up -d
```