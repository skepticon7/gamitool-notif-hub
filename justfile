backend:
    cd nest-notif-hub && npm run start:nodemon

frontend:
    cd next-notif-hub && pnpm dev

infra:
    docker compose -f infrastructure/gamitool/compose.yml up -d

auth:
    docker compose -f infrastructure/authentik/compose.yml up -d

infra-up:
    just infra
    just auth

infra-down:
    docker compose -f infrastructure/gamitool/compose.yml down
    docker compose -f infrastructure/authentik/compose.yml down

lint-backend:
    cd nest-notif-hub && npm run lint

lint-frontend:
    cd next-notif-hub && pnpm lint

test-backend:
    cd nest-notif-hub && npm test

build-backend:
    cd nest-notif-hub && npm run build

build-frontend:
    cd next-notif-hub && pnpm build

install:
    cd next-notif-hub && pnpm install
    cd nest-notif-hub && npm install
