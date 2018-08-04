FROM node:alpine
EXPOSE 3000
WORKDIR /src

RUN apk add ruby libxml2 libxslt ruby-dev alpine-sdk zlib zlib-dev \
 && gem install markdown2confluence --no-ri --no-rdoc

CMD npm run dev
