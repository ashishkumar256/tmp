FROM node:18-alpine AS build

WORKDIR /app

ARG SENTRY_AUTH_TOKEN
ARG VITE_RELEASE_NAME
ARG VITE_SENTRY_DIST

ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV VITE_RELEASE_NAME=$VITE_RELEASE_NAME
ENV VITE_SENTRY_DIST=$VITE_SENTRY_DIST

COPY package*.json ./
RUN npm install
COPY . .

RUN npm run build

CMD ["npm", "run", "dev", "--", "--host"]

# FROM node:18-alpine

# WORKDIR /app
# RUN npm install -g serve

# COPY --from=build /app/dist .

# EXPOSE 3000

# CMD ["serve", "-s", ".", "-l", "3000"]