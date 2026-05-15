FROM node:20-alpine

WORKDIR /app

# Git needed for repo clone + auto-sync
RUN apk add --no-cache git

# Copy server files
COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

# Clone the repo for codebase access
ARG REPO_URL=https://github.com/your-org/ApartmentHub.git
RUN git clone ${REPO_URL} /app/repo || mkdir -p /app/repo

# Create logs directory
RUN mkdir -p /app/logs

EXPOSE 3100

CMD ["node", "server.js"]
