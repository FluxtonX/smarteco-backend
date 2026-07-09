#!/bin/bash
set -e

# ─── Configuration ─────────────────────────────
APP_DIR="/var/www/smarteco-backend"
LOG_FILE="/var/log/smarteco/deploy.log"
BRANCH="dev"

# ─── Colors ────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[DEPLOY $(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR $(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN $(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

# ─── Start Deployment ──────────────────────────
log "🚀 Starting deployment..."
log "Branch: $BRANCH"
cd "$APP_DIR"

# ─── Step 1: Pull Latest Code ──────────────────
log "📥 Pulling latest code from $BRANCH..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
log "✅ Code pulled. Commit: $(git rev-parse --short HEAD)"

# ─── Step 2: Install Dependencies ──────────────
log "📦 Installing dependencies..."
npm ci --production=false
log "✅ Dependencies installed."

# ─── Step 3: Generate Prisma Client ────────────
log "🔧 Generating Prisma client..."
npx prisma generate --schema=src/database/prisma/schema.prisma
log "✅ Prisma client generated."

# ─── Step 4: Run Database Migrations ───────────
log "🗃️ Running database migrations..."
npx prisma migrate deploy --schema=src/database/prisma/schema.prisma
log "✅ Migrations applied."

# ─── Step 5: Build Application ─────────────────
log "🔨 Building application..."
npm run build
log "✅ Build complete."

# ─── Step 6: Restart Application (Zero Downtime)
log "🔄 Restarting application with PM2..."
pm2 reload ecosystem.config.js --update-env
log "✅ Application restarted."

# ─── Step 7: Verify Health ─────────────────────
log "🏥 Verifying health..."
sleep 5

HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health || true)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    log "✅ Health check passed! (HTTP $HEALTH_RESPONSE)"
else
    warn "⚠️ Health check returned HTTP $HEALTH_RESPONSE"
    log "Checking PM2 logs for errors..."
    pm2 logs smarteco-backend --lines 20 --nostream | tee -a "$LOG_FILE"
fi

# ─── Step 8: Save PM2 State ───────────────────
pm2 save
log "💾 PM2 state saved."

# ─── Done ──────────────────────────────────────
log "🎉 Deployment completed successfully!"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
