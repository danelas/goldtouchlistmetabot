FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy server
COPY server ./server

# Copy client
COPY client ./client

# Install and build client
WORKDIR /app/client
RUN npm install
RUN npm run build

# Install server deps
WORKDIR /app/server
RUN npm install

# Expose port
EXPOSE 5000

# Start server
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
