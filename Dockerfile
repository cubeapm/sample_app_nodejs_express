FROM ubuntu:22.04

# https://github.com/nodesource/distributions#debian-and-ubuntu-based-distributions
RUN apt-get update && apt-get install -y ca-certificates curl gnupg && mkdir -p /etc/apt/keyrings && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
RUN apt-get update && apt-get install nodejs -y

WORKDIR /nodejs

ADD package.json .
ADD package-lock.json .
RUN npm install

ADD . .

EXPOSE 8000

CMD ["node", "app.js"]
