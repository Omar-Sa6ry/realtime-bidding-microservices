FROM node:24.11.0

WORKDIR /usr/src/app

COPY services/api-gateway/package.json ./

RUN npm install --legacy-peer-deps

COPY . .

WORKDIR /usr/src/app/services/api-gateway

CMD ["npm", "run", "start:dev"]
