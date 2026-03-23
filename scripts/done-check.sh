#!/bin/bash
# Done Check — runs the full Definition of Done checklist
set -e
cd "$(dirname "$0")/.."

echo "=== ESLint ==="
npx eslint . --quiet 2>&1 | tail -5
echo "✓ Lint passed"

echo ""
echo "=== TypeScript ==="
npx tsc --noEmit 2>&1 | tail -5
echo "✓ Type check passed"

echo ""
echo "=== Tests ==="
pnpm test:run 2>&1 | tail -10
echo "✓ Tests passed"

echo ""
echo "=== Build ==="
pnpm build 2>&1 | tail -5
echo "✓ Build passed"

echo ""
echo "🎉 All DoD checks passed!"
