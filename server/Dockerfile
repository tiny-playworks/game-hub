FROM node:24.17.0-alpine AS build
RUN corepack enable
WORKDIR /app/server
COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./
RUN corepack pnpm install --frozen-lockfile
WORKDIR /app
COPY src ./src
COPY shared ./shared
COPY server ./server
WORKDIR /app/server
RUN corepack pnpm build

FROM node:24.17.0-alpine
ARG GAME_HUB_REVISION=unknown
ENV GAME_HUB_REVISION=$GAME_HUB_REVISION
LABEL org.opencontainers.image.revision=$GAME_HUB_REVISION
WORKDIR /app/server
RUN corepack enable
COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./
RUN corepack pnpm install --prod --frozen-lockfile
COPY --from=build /app/server/dist ./dist
ENV GAME_HUB_DB_PATH=/data/household.sqlite
ENV GAME_HUB_PORT=8787
VOLUME /data
EXPOSE 8787
CMD ["node", "dist/index.mjs"]
