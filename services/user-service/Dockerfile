# Force rebuild with webpack externals and graphql directive fix
FROM node:24.11.0

WORKDIR /usr/src/app

ARG CACHEBUST=2
COPY services/user-service/package.json ./

RUN npm install --legacy-peer-deps

COPY . .

WORKDIR /usr/src/app/services/user-service

CMD ["npm", "run", "start:dev"]

