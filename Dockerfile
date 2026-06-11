# Unstuck — zero npm dependencies, so no install step at all.
FROM node:22-alpine
WORKDIR /app
COPY server.js ./
COPY public ./public
ENV PORT=3456
# the canonical graph lives here — mount a volume so it survives redeploys
VOLUME /app/data
EXPOSE 3456
CMD ["node", "server.js"]
