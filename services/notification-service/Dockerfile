FROM node:24.11.0

WORKDIR /usr/src/app

COPY services/notification-service/package.json ./

RUN npm install --legacy-peer-deps

COPY . .

WORKDIR /usr/src/app/services/notification-service

CMD ["npm", "run", "start:dev"]
