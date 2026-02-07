# Use official Playwright image with all browser dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.58.1-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy built application
COPY dist ./dist

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Run the server
CMD ["node", "dist/server.js"]
