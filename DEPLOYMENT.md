# Taskflow Zero - Production Deployment Guide

## Prerequisites

1. **Cloudflare Account** with Workers paid plan (for production)
2. **Node.js 18+** and npm installed
3. **Wrangler CLI** installed and authenticated: `npm install -g wrangler && wrangler login`

## Step 1: Create Production Resources

### 1.1 Create D1 Database

```bash
wrangler d1 create taskflow-db
```

Save the `database_id` from the output.

### 1.2 Create R2 Bucket

```bash
wrangler r2 bucket create taskflow-files
```

### 1.3 Create KV Namespace

```bash
wrangler kv:namespace create CACHE
```

Save the `id` from the output.

## Step 2: Update wrangler.toml

Edit `wrangler.toml` and update the `[env.production]` section with your actual resource IDs:

```toml
[env.production]
route = "taskflow.yourdomain.com/*"  # Your custom domain
workers_dev = false

[[env.production.d1_databases]]
binding = "DB"
database_name = "taskflow-db"
database_id = "YOUR_D1_DATABASE_ID"  # Replace with actual ID

[[env.production.r2_buckets]]
binding = "FILES"
bucket_name = "taskflow-files"

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "YOUR_KV_NAMESPACE_ID"  # Replace with actual ID

[env.production.ai]
binding = "AI"
```

## Step 3: Set Production Secrets

```bash
# Set JWT secret (use a strong random string)
wrangler secret put JWT_SECRET -e production

# Optional: Set OAuth credentials
wrangler secret put GOOGLE_CLIENT_ID -e production
wrangler secret put GOOGLE_CLIENT_SECRET -e production
wrangler secret put GITHUB_CLIENT_ID -e production
wrangler secret put GITHUB_CLIENT_SECRET -e production
```

To generate a strong JWT secret:

```bash
# PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})

# Linux/Mac
openssl rand -base64 64
```

## Step 4: Run Database Migrations

```bash
wrangler d1 migrations apply taskflow-db -e production
```

## Step 5: Build and Deploy

```bash
# Install all dependencies
npm install

# Build the web frontend
npm --workspace @taskflow/web run build

# Deploy to production
wrangler deploy -e production
```

## Step 6: Configure Custom Domain

1. **Add domain to Cloudflare**: If not already added, add your domain to Cloudflare
2. **Create DNS record**: Add a DNS record (A, AAAA, or CNAME) pointing to your Workers route
3. **Update wrangler.toml**: Set the `route` in `[env.production]` to your domain pattern

Example:
```toml
[env.production]
route = "taskflow.example.com/*"
# or subdomain: "app.example.com/*"
# or path: "example.com/app/*"
```

## Step 7: Configure OAuth (Optional)

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://your-domain.com/oauth/google/callback`
6. Set Client ID and Secret in KV or as secrets

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Homepage URL: `https://your-domain.com`
4. Set Authorization callback URL: `https://your-domain.com/oauth/github/callback`
5. Save Client ID and Secret

Store credentials:

```bash
# Store in KV
wrangler kv:key put GOOGLE_CLIENT_ID "your-client-id" --namespace-id YOUR_KV_ID
wrangler kv:key put GOOGLE_CLIENT_SECRET "your-client-secret" --namespace-id YOUR_KV_ID
wrangler kv:key put GITHUB_CLIENT_ID "your-client-id" --namespace-id YOUR_KV_ID
wrangler kv:key put GITHUB_CLIENT_SECRET "your-client-secret" --namespace-id YOUR_KV_ID
```

## Step 8: Verify Deployment

1. Visit your domain: `https://your-domain.com`
2. Check API docs: `https://your-domain.com/docs`
3. Test OpenAPI spec: `https://your-domain.com/openapi.json`
4. Create an account and test the application

## Monitoring and Maintenance

### View Logs

```bash
wrangler tail -e production
```

### Update Application

```bash
# Pull latest code
git pull

# Install dependencies
npm install

# Build frontend
npm --workspace @taskflow/web run build

# Deploy
wrangler deploy -e production
```

### Database Migrations

When adding new migrations:

```bash
# Apply new migrations to production
wrangler d1 migrations apply taskflow-db -e production
```

### Rollback (if needed)

```bash
# Deploy a specific version
wrangler deploy -e production apps/api/src/index.ts

# Or rollback via Cloudflare dashboard
# Workers & Pages → Your Worker → Deployments → Rollback
```

## Security Checklist

- [ ] Strong JWT_SECRET set (64+ random characters)
- [ ] OAuth secrets stored securely (KV or Wrangler secrets)
- [ ] Custom domain with HTTPS enabled
- [ ] Rate limiting configured (default: 300 req/min)
- [ ] API keys with scopes for external access
- [ ] Regular backups of D1 database
- [ ] Monitor logs for suspicious activity
- [ ] Keep dependencies updated

## Performance Optimization

### Enable Caching

Cloudflare Workers automatically cache static assets from `apps/web/dist`.

### Configure Cache Rules

In Cloudflare Dashboard:
1. Go to your domain → Caching → Configuration
2. Set cache rules for static assets
3. Enable Tiered Cache for better global performance

### Scale Resources

- **D1**: Scales automatically
- **R2**: Unlimited storage
- **KV**: Scales to millions of keys
- **Workers AI**: Pay per inference

## Backup Strategy

### D1 Database Backup

```bash
# Export database
wrangler d1 export taskflow-db -e production --output backup.sql

# Restore from backup
wrangler d1 execute taskflow-db -e production --file backup.sql
```

### Automated Backups

Set up a scheduled Worker to backup D1 periodically:

```bash
# Create backup worker
wrangler init backup-worker

# Add cron trigger in wrangler.toml
[triggers]
crons = ["0 2 * * *"]  # Daily at 2 AM
```

## Troubleshooting

### Issue: "Database not found"

- Verify D1 database ID in wrangler.toml
- Check database exists: `wrangler d1 list`
- Run migrations: `wrangler d1 migrations apply taskflow-db -e production`

### Issue: "Unauthorized" errors

- Verify JWT_SECRET is set: `wrangler secret list -e production`
- Check token expiration (default: 7 days)
- Clear browser cache and cookies

### Issue: "Rate limit exceeded"

- Increase rate limit in middleware.ts
- Configure per-key limits via API
- Add user-specific rate limiting

### Issue: WebSocket connection fails

- Verify Durable Objects are enabled
- Check `ROOM_DO` binding in wrangler.toml
- Ensure domain supports WebSocket upgrades

## Cost Estimation

### Cloudflare Workers (Paid Plan: $5/month)

- **Requests**: 10M included, then $0.50 per additional million
- **Duration**: 30M CPU-milliseconds, then $0.02 per million
- **D1**: 25M rows read free, writes $1 per million
- **R2**: $0.015 per GB storage, $0.36 per million Class B requests
- **KV**: $0.50 per million reads, $5 per million writes
- **Workers AI**: $0.011 per 1000 neurons

### Example Usage (Small Team)

- 100K requests/month: **Free tier**
- 1GB R2 storage: **$0.015/month**
- 1M KV operations: **$0.50/month**
- AI tag suggestions (10K): **$0.11/month**

**Total: ~$5.62/month for small team** (includes $5 Workers plan)

## Support

- **GitHub Issues**: Report bugs or feature requests
- **Cloudflare Docs**: https://developers.cloudflare.com/workers/
- **Community Discord**: https://discord.gg/cloudflaredev

## License

MIT License - See LICENSE file for details
