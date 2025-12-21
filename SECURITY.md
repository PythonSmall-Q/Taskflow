# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| 0.1.x   | :x:                |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take the security of Taskflow Zero seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please DO NOT:
- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Please DO:
1. **Email us** at security@your-domain.com (or open a private security advisory on GitHub)
2. **Provide details**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. **Wait for response**: We will acknowledge your email within 48 hours

## Security Measures

### Authentication & Authorization
- JWT-based authentication with configurable expiration
- API key system with scoped permissions
- Rate limiting on all endpoints
- CORS configuration

### Data Protection
- All data encrypted in transit (HTTPS/WSS)
- Cloudflare's zero-trust security model
- Parameterized SQL queries to prevent injection
- Input validation using Zod schemas

### Infrastructure
- Runs on Cloudflare's global network
- Automatic DDoS protection
- Web Application Firewall (WAF)
- Built-in rate limiting

### Best Practices for Deployment

1. **Use strong JWT secrets**
   ```bash
   # Generate a secure random string
   openssl rand -base64 64
   ```

2. **Rotate secrets regularly**
   ```bash
   wrangler secret put JWT_SECRET -e production
   ```

3. **Configure rate limits**
   - Default: 300 requests per minute
   - Adjust in `apps/api/src/middleware.ts`

4. **Enable Cloudflare Access** (optional, for enterprise)
   - Add Access policies in Cloudflare dashboard
   - Configure `ACCESS_JWKS_URL` in environment

5. **Monitor logs**
   ```bash
   wrangler tail -e production
   ```

6. **Regular updates**
   - Keep dependencies updated
   - Monitor security advisories
   - Apply patches promptly

## Security Checklist

When deploying to production:

- [ ] Strong JWT_SECRET set (64+ characters)
- [ ] OAuth credentials stored securely
- [ ] API keys with appropriate scopes
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Custom domain with HTTPS
- [ ] Regular backups configured
- [ ] Monitoring and alerting set up
- [ ] Access logs reviewed regularly
- [ ] Dependencies kept up to date

## Known Security Considerations

### Development Environment
- Default JWT_SECRET in `wrangler.toml` is for development only
- Never use development secrets in production
- `.env.local` should never be committed to git

### OAuth Implementation
- OAuth implementation is basic and suitable for MVP
- For production, consider using Cloudflare Access or Auth0
- Validate OAuth tokens properly

### File Uploads
- File uploads are stored in R2 with access controls
- Consider implementing file size limits
- Scan uploads for malware if handling untrusted content

### WebSocket Security
- WebSockets use same authentication as HTTP
- Consider implementing additional authorization checks
- Monitor for abuse (connection flooding)

## Security Updates

Security updates will be released as patch versions and announced via:
- GitHub Security Advisories
- CHANGELOG.md
- Project README

## Disclosure Policy

- **Initial Report**: Acknowledged within 48 hours
- **Investigation**: 1-7 days for initial assessment
- **Fix Development**: Depends on severity
- **Public Disclosure**: After fix is released and users have time to update

## Credits

We appreciate security researchers who responsibly disclose vulnerabilities. Contributors will be credited in:
- CHANGELOG.md
- Project README
- GitHub Security Advisories

## Contact

For security issues: security@your-domain.com
For general support: GitHub Issues

---

Thank you for helping keep Taskflow Zero and our users safe!
