# Despliegue en Dokploy (proyecto Laboratorios-virtuales): descarga el build web
# publicado en la release de GitHub (igual que el workflow de Pages), lo verifica
# y lo sirve con nginx. Para publicar otra versión cambia el build arg RELEASE_TAG.
FROM node:22-alpine AS build
ARG RELEASE_TAG=web-v0.1.5
ARG REPO=softwarevalle75-wq/Atlas-Psicologia-Web
WORKDIR /src
RUN apk add --no-cache curl unzip
COPY WebBuildTools/verify-build.cjs ./verify-build.cjs
RUN curl -fsSL -o atlas.zip "https://github.com/${REPO}/releases/download/${RELEASE_TAG}/Atlas-Psicologia-Web.zip" \
 && mkdir site && unzip -q atlas.zip -d site && rm atlas.zip \
 && node verify-build.cjs site > /dev/null

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/site /usr/share/nginx/html
EXPOSE 80
