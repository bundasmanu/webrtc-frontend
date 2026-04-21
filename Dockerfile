# Build stage — Vite reads these at build time (static defaults baked into the bundle).
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV VITE_SIP_WSS_URI=wss://kamailio-edge.example.invalid:5061
ENV VITE_ICE_SERVERS_JSON=
ENV VITE_JSSIP_DEBUG=false

RUN npm run build

# Runtime
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
