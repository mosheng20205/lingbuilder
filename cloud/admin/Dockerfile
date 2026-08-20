FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG VITE_CLOUD_API_URL
ENV VITE_CLOUD_API_URL=$VITE_CLOUD_API_URL
COPY package*.json ./
COPY packages/contracts/package*.json packages/contracts/
COPY cloud/admin/package*.json cloud/admin/
RUN npm ci
COPY packages/contracts packages/contracts
COPY cloud/admin cloud/admin
COPY image image
RUN npm run build -w @lingbuilder/contracts && npm run build -w @lingbuilder/admin

FROM nginx:1.27-alpine
COPY cloud/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/cloud/admin/dist /usr/share/nginx/html
EXPOSE 80
