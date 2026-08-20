FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY packages/contracts/package*.json packages/contracts/
COPY cloud/api/package*.json cloud/api/
RUN npm ci
COPY packages/contracts packages/contracts
COPY cloud/api cloud/api
COPY ["LingBuilder AI 规则手册.md", "."]
RUN npm run build -w @lingbuilder/contracts && npm run build -w @lingbuilder/cloud-api

FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/cloud/api/dist ./cloud/api/dist
COPY --from=build /app/cloud/api/prisma ./cloud/api/prisma
COPY --from=build /app/cloud/api/package.json ./cloud/api/package.json
COPY --from=build ["/app/LingBuilder AI 规则手册.md", "./LingBuilder AI 规则手册.md"]
USER node
EXPOSE 17900
CMD ["node", "cloud/api/dist/main.js"]
