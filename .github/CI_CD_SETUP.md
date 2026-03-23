# CI/CD Pipeline Setup Guide

This document outlines the automated CI/CD pipeline configuration for WhatsApp Order SaaS using GitHub Actions.

## Overview

The project uses **GitHub Actions** for continuous integration and deployment with **Vercel** as the hosting platform.

### Workflows Included

1. **CI/CD Pipeline** (`ci.yml`)
   - Lints code on every push and PR
   - Type checks TypeScript
   - Builds the application
   - Deploys to Vercel on push to `master` (production)

2. **Environment & Database Validation** (`env-check.yml`)
   - Validates database migrations are syntactically correct
   - Checks environment variables are properly documented
   - Can be triggered manually or on migration changes

## Required GitHub Secrets

Configure the following secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

### Vercel Deployment Secrets
- `VERCEL_TOKEN` — Personal access token from Vercel (https://vercel.com/account/tokens)
- `VERCEL_ORG_ID` — Vercel organization ID
- `VERCEL_PROJECT_ID` — Vercel project ID

### Build-Time Environment Variables
- `NEXT_PUBLIC_SITE_URL` — Public site URL (e.g., `https://yourdomain.com`)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public anon key

### Optional Notifications
- `SLACK_WEBHOOK_URL` — Slack webhook for build notifications (optional)

## Workflow Behavior

### On Pull Request
- ✅ Runs linting
- ✅ Runs type checking
- ✅ Runs full build
- ✅ Runs security scans (npm audit)
- ❌ **Does NOT deploy**

### On Push to `master`
- ✅ Runs validation (lint, type-check, build)
- ✅ Deploys to Vercel (production)
- ✅ Marks deployment status

### On Push to `develop`
- ✅ Runs validation (lint, type-check, build)
- ❌ Does not deploy to production
- ℹ️ Can be configured to deploy to staging if needed

## Setup Instructions

### Step 1: Get Vercel Credentials

1. Navigate to https://vercel.com/account/tokens
2. Create a new token with:
   - Name: `whatsapp-order-saas-github-actions`
   - Scope: Full Account
3. Copy the token

4. Get your Org ID:
   ```bash
   vercel teams list  # if using team
   # or in Vercel dashboard URL: https://vercel.com/[ORG-ID]/[PROJECT-ID]
   ```

5. Get your Project ID:
   ```bash
   cd whatsapp-order-saas
   vercel env ls
   ```

### Step 2: Add GitHub Secrets

1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Click "New repository secret" and add each required secret:

   ```
   VERCEL_TOKEN=your_token_here
   VERCEL_ORG_ID=your_org_id
   VERCEL_PROJECT_ID=your_project_id
   NEXT_PUBLIC_SITE_URL=https://yourdomain.com
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxx...
   ```

### Step 3: Configure Branch Protection (Recommended)

1. Go to Settings → Branches → Add rule
2. Apply to branch: `master`
3. Check: "Require status checks to pass before merging"
4. Select required checks:
   - `validate` (Lint, Type Check & Build)
   - `security` (Security Scanning)

This ensures all code is validated before merging to production.

### Step 4: Monitor Deployments

- View workflow runs: GitHub repo → Actions tab
- View Vercel deployments: https://vercel.com/dashboard
- Check deployment logs for any issues

## Manual Deployment

If you need to manually deploy between commits:

```bash
cd whatsapp-order-saas
vercel --prod
```

## Troubleshooting

### Build Fails in CI but Works Locally

**Common causes:**
- Missing environment variables in GitHub secrets
- Node version mismatch (CI uses v20.x, check `package.json` engines)
- Uncommitted changes or git state issues

**Solution:**
1. Verify all secrets are set in GitHub
2. Run locally: `npm ci && npm run build`
3. Check Node version: `node --version`

### Vercel Deployment Hangs

**Possible causes:**
- Invalid `VERCEL_TOKEN`
- `VERCEL_ORG_ID` or `VERCEL_PROJECT_ID` incorrect
- Project env vars not synced to Vercel

**Solution:**
1. Verify credentials: `vercel whoami`
2. Re-run workflow from GitHub Actions tab
3. Check Vercel dashboard for project settings

### Linting or Type Check Warnings

Edit workflow to fail on warnings:

```yaml
# In ci.yml, change:
npm run lint -- --max-warnings 0  # Fail on any warning
```

## Adding Test Automation

Once test suite is added, extend `ci.yml`:

```yaml
- name: Run tests
  working-directory: whatsapp-order-saas
  run: npm run test
```

Add to `package.json`:
```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

## Database Migration CI

Migrations are automatically validated on:
- Push to `master`
- Manual trigger via workflow dispatch
- When migration files change

View status in Actions → Environment & Database Validation

## Security Considerations

### Secrets Management
- ✅ All secrets stored in GitHub (never committed)
- ✅ Vercel token is scoped to automation only
- ✅ Service-role keys are *not* in CI (never needed for builds)

### Branch Protection
- ✅ Production (`master`) requires status checks
- ℹ️ Consider requiring code review approval before merge

### Dependency Updates
- ⚠️ Monitor npm audit warnings in security job
- ℹ️ Use `dependabot` for automated dependency updates (optional)

## Monitoring & Alerts

### GitHub Workflow Notifications
Enable in: Settings → Notifications → GitHub Actions

### Integration with Slack (Optional)
Add to workflow or use GitHub + Slack integration for real-time alerts

## Next Steps

1. **Run the workflow**: Push a dummy commit to trigger CI
2. **Verify deployment**: Check Vercel dashboard for successful deployment
3. **Set branch protection**: Require status checks before merge
4. **Add test suite**: Implement tests and extend CI workflow
5. **Configure alerts**: Set up notifications for failures

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel Deployment Automation](https://vercel.com/docs/git/vercel-for-github)
- [Next.js CI/CD Best Practices](https://nextjs.org/docs/deployment#ci-cd-environments)
- [Environment Variables Guide](../whatsapp-order-saas/.env.local.example)
