FROM node:12-alpine

WORKDIR /usr/local/src/app

ADD package.json package.json
ADD package-lock.json package-lock.json
RUN NODE_ENV=development npm install

ADD tsconfig.json tsconfig.json
ADD src src

RUN npm run compile

ENTRYPOINT npm start
