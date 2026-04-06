FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

CMD ["node", "p2p/node.js"]
