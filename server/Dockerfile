FROM node:24.17.0-alpine AS build
WORKDIR /app
RUN corepack enable
COPY server/package.json server/pnpm-lock.yaml ./server/
RUN corepack pnpm --dir server install --frozen-lockfile
COPY src ./src
COPY shared ./shared
COPY server ./server
RUN corepack pnpm --dir server build

FROM node:24.17.0-alpine
WORKDIR /app/server
RUN corepack enable
COPY server/package.json server/pnpm-lock.yaml ./
RUN corepack pnpm install --prod --frozen-lockfile
COPY --from=build /app/server/dist ./dist
ENV GAME_HUB_DB_PATH=/data/household.sqlite
ENV GAME_HUB_PORT=8787
VOLUME /data
EXPOSE 8787
CMD ["node", "dist/index.mjs"]
