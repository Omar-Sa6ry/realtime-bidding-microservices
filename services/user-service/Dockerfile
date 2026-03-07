FROM node:24.11.0-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --legacy-peer-deps --no-audit --prefer-offline

COPY . .

CMD ["npm", "run", "start:dev"]