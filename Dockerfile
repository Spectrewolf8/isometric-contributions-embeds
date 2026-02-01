FROM node:22-bullseye

# Install system dependencies required by canvas
RUN apt-get update && apt-get install -y \
  build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy lockfile first for reproducible installs
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app
COPY . .

# Expose port (Render provides PORT env automatically)
EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "server.js"]