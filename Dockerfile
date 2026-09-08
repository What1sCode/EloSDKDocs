# Pinned exactly to the "playwright" npm version in package.json — a
# mismatch between this image and that version means Playwright can't
# find the browser build it expects at runtime.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/index.js"]
