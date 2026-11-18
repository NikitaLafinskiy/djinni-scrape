ARG FUNCTION_DIR="/var/task"

FROM node:22-bookworm

ARG FUNCTION_DIR

RUN apt-get update && \
    apt-get install -y \
    g++ \
    make \
    cmake \
    unzip \
    libcurl4-openssl-dev

RUN mkdir -p ${FUNCTION_DIR}
WORKDIR ${FUNCTION_DIR}

ENV NPM_CONFIG_CACHE=/tmp/.npm
ENV PLAYWRIGHT_TMP_DIR=/tmp/
ENV PLAYWRIGHT_BROWSERS_PATH=/var/task/ms-playwright

COPY package*.json tsconfig.json ./

RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci
RUN npx playwright install --with-deps chromium

COPY src ./src

RUN npm run build && npm prune --omit=dev

ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-ric"]

CMD ["dist/handlers/scraper.handler"]
