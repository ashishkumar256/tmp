FROM node:18-alpine AS build

WORKDIR /app

ARG SENTRY_AUTH_TOKEN
ARG VITE_RELEASE_NAME
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV VITE_RELEASE_NAME=$VITE_RELEASE_NAME

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "run", "start"]