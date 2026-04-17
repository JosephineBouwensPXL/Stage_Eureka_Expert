FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src ./src
COPY tsconfig.json ./

EXPOSE 3001

CMD ["npm", "run", "dev"]
