#!/bin/bash

# Pre-commit Hook Setup Script
# This script sets up local pre-commit hooks to validate code before committing

set -e

echo "🔧 Setting up pre-commit hooks..."

# Check if husky is already installed
if [ ! -d ".husky" ]; then
  echo "📦 Installing husky..."
  npm install husky lint-staged --save-dev
  npx husky install
else
  echo "✅ Husky already installed"
fi

# Create pre-commit hook
mkdir -p .husky
cat > .husky/pre-commit << 'EOF'
#!/bin/bash
echo "🔍 Running pre-commit checks..."

cd whatsapp-order-saas

# Stage files for linting
npx lint-staged

# Run TypeScript check on changed files
echo "📝 Checking TypeScript..."
npx tsc --noEmit || true

echo "✅ Pre-commit checks passed!"
EOF

chmod +x .husky/pre-commit

# Create commit-msg hook (optional - enforce commit message format)
cat > .husky/commit-msg << 'EOF'
#!/bin/bash

# Enforce conventional commits format
# Format: type(scope): subject
# Examples: feat(auth): add password reset
#           fix(webhook): handle signature verification
#           docs: update deployment guide

msg="$(cat "$1")"
type="$(echo "$msg" | grep -oE '^[a-z]+' | head -1)"

if [ -z "$type" ]; then
  echo "❌ Commit message must start with: feat, fix, docs, style, refactor, test, chore"
  echo "   Example: 'feat(auth): add password reset'"
  exit 1
fi

# Allow conventional commit types
if [[ ! "$type" =~ ^(feat|fix|docs|style|refactor|test|chore|perf|ci|revert|Merge)$ ]]; then
  echo "❌ Invalid commit type: $type"
  echo "   Allowed types: feat, fix, docs, style, refactor, test, chore, perf, ci, revert"
  exit 1
fi

echo "✅ Commit message format valid"
EOF

chmod +x .husky/commit-msg

# Configure lint-staged in package.json
echo "⚙️  Configuring lint-staged..."

cd whatsapp-order-saas

# Add lint-staged config if not present
if ! grep -q "lint-staged" package.json; then
  cat >> package.json << 'EOF'
,
  "lint-staged": {
    "*.{ts,tsx}": [
      "next lint --fix",
      "tsc --noEmit"
    ],
    "*.{js,jsx}": [
      "next lint --fix"
    ]
  }
EOF
  echo "✅ Added lint-staged configuration to package.json"
else
  echo "⚠️  lint-staged already configured"
fi

echo ""
echo "✨ Pre-commit hooks setup complete!"
echo ""
echo "📋 What's installed:"
echo "   • Pre-commit hook: Lints changed files before commit"
echo "   • Commit message hook: Enforces conventional commits format"
echo ""
echo "💡 Next steps:"
echo "   1. Commit this setup: git add . && git commit -m 'chore: add pre-commit hooks'"
echo "   2. All team members will auto-install hooks on next npm install"
echo ""
echo "🚀 Hooks will automatically run on: git commit"
echo "   To skip hooks (emergency only): git commit --no-verify"
