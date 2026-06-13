FROM node:22-alpine

# build tools for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++ curl

WORKDIR /app
COPY package.json ./
RUN npm install

COPY . .
RUN mkdir -p /data

EXPOSE 3001
CMD ["node", "server.js"]
