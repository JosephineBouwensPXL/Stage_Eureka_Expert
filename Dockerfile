FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Optional build-time Vite variables.
ARG VITE_API_BASE_URL
ARG VITE_GEMINI_API_KEY
ARG GEMINI_API_KEY
ARG ELEVENLABS_API_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
