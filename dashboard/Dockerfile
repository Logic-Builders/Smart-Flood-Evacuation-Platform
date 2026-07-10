# Build React dashboard (Create React App)
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY public ./public
COPY src ./src

# Empty = same-origin requests via nginx proxy (see config.js: ?? not ||,
# so this deliberately-empty value isn't overridden by its localhost fallback)
ARG REACT_APP_API_URL=
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# Serve with nginx + API proxy
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
