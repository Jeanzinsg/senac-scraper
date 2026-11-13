FROM mcr.microsoft.com/playwright:v1.65.0-noble
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY parser.js server.js ./
ENV NODE_ENV=production
EXPOSE 3100
CMD ["node", "server.js"]
