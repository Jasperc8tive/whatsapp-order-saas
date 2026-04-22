# CI/CD Pipeline & Development Workflow

## Quick Start

### 1. Local Development Setup

```bash
# Install dependencies
cd whatsapp-order-saas
npm install

# Set up pre-commit hooks (optional but recommended)
cd ..
bash setup-hooks.sh
```

### 2. Local Validation Before Commit

```bash
# Lint code
npm run lint

# Type check
npx tsc --noEmit

# Full build (what CI runs)
npm run build

# Or run all at once
npm run lint && npx tsc --noEmit && npm run build
```

## Automated CI/CD Pipeline

Your code is automatically validated and deployed through GitHub Actions.

### What Happens on Each Push

#### 📋 Pull Requests

1. ✅ Code is linted (`next lint`)
2. ✅ TypeScript is type-checked (`tsc --noEmit`)
3. ✅ Full production build runs (`next build`)
4. ✅ Security scan runs (`npm audit`)

**Status:** Code review required before merge

#### 🚀 Push to `master` (Production)

1. ✅ Same validation as PR
2. ✅ Auto-deployed to Vercel production
3. 📊 Deployment status reported

**Requirement:** All validations must pass

#### ⚙️ Push to `develop` (Staging)

1. ✅ Validation runs
2. ℹ️ Can be configured for staging deployment

## GitHub Actions Workflows

### CI/CD Pipeline (`.github/workflows/ci.yml`)

Runs validation and production deployment.

**Triggered on:**

- Every push to `master` or `develop`
- Every pull request into `master` or `develop`

**Jobs:**

- `validate` — Lint, type-check, build
- `deploy` — Deploy to Vercel (master only)
- `security` — Check npm vulnerabilities (PR only)

### Environment Validation (`.github/workflows/env-check.yml`)

Validates database migrations and environment setup.

**Triggered on:**

- Manual workflow dispatch
- Pushes to `master` with migration file changes

## Setting Up CI/CD

### First Time Setup

1. **Get Vercel credentials:**
   - Visit <https://vercel.com/account/tokens>
   - Create new token (scope: Full Account)
   - Copy token and Org/Project IDs

2. **Add GitHub Secrets:**
   - Go to repo → Settings → Secrets and variables → Actions
   - Click "New repository secret" for each:

     ```bash
     VERCEL_TOKEN = your_vercel_token
     VERCEL_ORG_ID = your_org_id
     VERCEL_PROJECT_ID = your_project_id
     NEXT_PUBLIC_SITE_URL = https://yourdomain.com
     NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJxx...
     ```

3. **Protect master branch:**
   - Settings → Branches → Add rule for `master`
   - Check "Require status checks to pass before merging"
   - Select `validate` as required check

4. **Test the pipeline:**
   - Make a test commit to a branch
   - Push to GitHub
   - Watch Actions tab to see workflow run

### Detailed Setup Guide

See [`.github/CI_CD_SETUP.md`](.github/CI_CD_SETUP.md) for complete setup instructions.

## Pre-Commit Hooks (Local)

### Optional Setup

Set up local pre-commit hooks to catch issues before pushing:

```bash
bash setup-hooks.sh
```

This will:

- Lint staged files before commit
- Check TypeScript on staged files
- Enforce conventional commit format (optional)

**Benefits:**

- 🚀 Faster feedback loop
- 🛑 Prevent bad commits from being pushed
- 👥 Consistent code style across team

**Manual Commands:**

```bash
# Lint and auto-fix files
cd whatsapp-order-saas
npm run lint -- --fix

# Type check
npx tsc --noEmit

# Build (catches compilation errors)
npm run build
```

## Deployment Process

### Automatic Deployment (Recommended)

- Push to `master` → Automatically deployed to production
- Requires all status checks to pass

### Manual Deployment

```bash
cd whatsapp-order-saas
vercel --prod
```

## Monitoring Deployments

### GitHub Actions

- View all workflow runs: repo → Actions tab
- Click workflow to see detailed logs
- Each job and step has its own output

### Vercel Dashboard

- <https://vercel.com/dashboard>
- View deployments, logs, analytics
- Rollback capability available

## Troubleshooting

### "Build fails in CI but works locally"

```bash
# Simulate CI environment locally
npm ci  # Install from lock file
npm run build
npm run lint
```

### "Deployment stuck or failed"

1. Check GitHub Actions logs for error details
2. Verify secrets are set correctly
3. Check Vercel project settings
4. View Vercel deployment logs

### "Type check passes locally but fails in CI"

- Different Node versions might have different behavior
- Run exactly what CI runs: `npx tsc --noEmit`
- Check for uncommitted changes

## Performance Notes

### Build Time

- Initial build: ~30-45 seconds
- Subsequent builds: ~15-20 seconds (with cache)
- Full workflow: ~3-5 minutes

### Caching

- npm dependencies cached in CI
- Next.js build cache used when available

## Best Practices

### ✅ DO

- Run validation locally before pushing
- Write clear commit messages
- Test the build locally on major changes
- Keep commits focused and atomic
- Review CI logs if something fails

### ❌ DON'T

- Push without running `npm run build` locally
- Force-push to `master`
- Use `--no-verify` to skip checks
- Merge PRs without passing status checks
- Commit secrets or API keys

## Adding Tests

Once you add a test suite:

1. **Add test script to `package.json`:**

   ```json
   {
     "test": "jest",
     "test:watch": "jest --watch",
     "test:coverage": "jest --coverage"
   }
   ```

2. **Extend CI workflow in `.github/workflows/ci.yml`:**

   ```yaml
   - name: Run tests
     working-directory: whatsapp-order-saas
     run: npm run test
   ```

## Security

### What's Protected

- ✅ Secrets stored in GitHub Actions (never logged)
- ✅ Build artifacts not committed
- ✅ Branch protection prevents unverified merges
- ✅ Vercel token scoped to automation only

### What's Open

- ℹ️ Workflow definitions are public (best practice)
- ℹ️ Build logs are visible to repo members

## Common Workflows

### Creating a Feature

```bash
# Create feature branch
git checkout -b feat/my-feature

# Make changes, commit, push
git add .
git commit -m "feat(dashboard): add new page"
git push origin feat/my-feature

# Open PR on GitHub
# CI automatically validates

# After review and approval
# Merge to master (requires passing checks)

# CI deploys to production automatically
```

### Hotfix for Production

```bash
# Create from master
git checkout master
git pull origin master
git checkout -b fix/critical-bug

# Quick fix, commit, push
git add .
git commit -m "fix(webhook): handle null values"
git push origin fix/critical-bug

# Open PR, request expedited review
# Merge and deploy immediately
```

### Database Migration

```bash
# Create migration and code
git add whatsapp-order-saas/supabase/migrations/
git commit -m "chore: add new order_status table"
git push

# CI validates migration syntax automatically
# Review and merge when ready
```

## Support & Help

### Check Status

- GitHub Actions → Workflows
- Vercel Dashboard → Deployments
- Check recent commits for issues

### Debug

1. Read the full error message in Actions logs
2. Reproduce locally with: `npm ci && npm run build`
3. Check Git status: `git status`
4. Review recent changes: `git log --oneline -5`

### Further Help

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Last Updated:** March 2026  
**CI/CD Status:** ✅ Active and Monitored
