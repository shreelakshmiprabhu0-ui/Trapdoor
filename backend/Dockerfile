FROM node:22-alpine
WORKDIR /backend
COPY package*.json ./
RUN npm install --omit=dev && npm install --no-save supertest@7
COPY src ./src
USER node
EXPOSE 4000
CMD ["node", "src/server.js"]
