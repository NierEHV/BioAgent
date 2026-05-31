FROM node:22-slim

# Docker CLI (for docker-in-docker operations)
RUN apt-get update && apt-get install -y docker.io && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/agent-core/package.json packages/agent-core/
COPY packages/executor/package.json packages/executor/
COPY packages/skills/package.json packages/skills/
COPY packages/knowledge/package.json packages/knowledge/
COPY packages/workflow/package.json packages/workflow/
COPY packages/ui/package.json packages/ui/

RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "dev"]
