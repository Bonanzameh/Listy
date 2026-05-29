FROM node:22-alpine

WORKDIR /app

COPY server.js index.html styles.css app.js logo.svg manifest.webmanifest service-worker.js apple-touch-icon.png icon-192.png icon-512.png ./

ENV PORT=3000
ENV DATA_DIR=/app/data

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
