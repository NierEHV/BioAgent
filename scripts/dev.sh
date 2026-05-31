#!/usr/bin/env bash
# ============================================================
# BioAgent Development Startup Script
# ============================================================
set -euo pipefail

echo "🔬 BioAgent Development Mode"
echo "============================"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 22+ required"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm 9+ required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "⚠️  Docker not found — container execution will fail"; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  echo "❌ Node.js 22+ required, found: $(node -v)"
  exit 1
fi

echo "✅ Node.js $(node -v)"
echo "✅ pnpm $(pnpm -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Build all packages
echo ""
echo "🔨 Building packages..."
pnpm build

# Typecheck
echo ""
echo "🔍 Typecheck..."
pnpm typecheck

# Run tests
echo ""
echo "🧪 Running tests..."
pnpm test

# Start development
echo ""
echo "🚀 Starting BioAgent development server..."
echo "   UI: http://localhost:3000"
echo ""
cd packages/ui && pnpm dev
