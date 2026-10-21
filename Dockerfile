FROM node:22-slim
WORKDIR /app
COPY . .
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/fineprint.db TRUST_PROXY=1
VOLUME /data
EXPOSE 3000
CMD ["node", "--no-warnings", "server/index.js"]
