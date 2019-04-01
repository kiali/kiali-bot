FROM node:10.15-alpine

RUN apk add alpine-sdk python

USER node
WORKDIR /home/node

# RUN apk add ruby libxml2 libxslt ruby-dev alpine-sdk zlib zlib-dev \
# && gem install markdown2confluence --no-ri --no-rdoc

ENV NODE_ENV=production KIALI_BOT_USER=kiali-bot

COPY package*.json ./
RUN npm install

COPY app.yml ./
COPY lib ./

EXPOSE 3000
CMD npm run start
