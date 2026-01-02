# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously at Zentla. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, email us at: **security@zentla.dev**

Include the following information:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report within 48 hours.
2. **Assessment**: We will investigate and assess the vulnerability within 7 days.
3. **Resolution**: We aim to resolve critical vulnerabilities within 30 days.
4. **Disclosure**: We will coordinate with you on public disclosure timing.

### Safe Harbor

We consider security research conducted in accordance with this policy to be:

- Authorized under applicable anti-hacking laws
- Exempt from DMCA restrictions
- Lawful and helpful to the security of our users

We will not pursue legal action against researchers who:

- Act in good faith
- Avoid privacy violations and data destruction
- Do not exploit vulnerabilities beyond proof of concept
- Report vulnerabilities promptly

## Security Best Practices

When deploying Zentla, we recommend:

### API Keys

- Rotate API keys regularly
- Use test keys in development, live keys only in production
- Never commit API keys to version control
- Use environment variables for all secrets

### Database

- Use strong passwords
- Enable SSL for database connections
- Restrict network access to database servers
- Regular backups with encryption

### Infrastructure

- Keep dependencies updated
- Use HTTPS for all traffic
- Implement rate limiting
- Monitor for unusual activity

### Webhooks

- Always verify webhook signatures
- Use HTTPS endpoints only
- Implement idempotency for event processing

## Known Security Considerations

### Stripe Integration

- Zentla stores Stripe customer IDs and subscription IDs
- Payment card data is never stored in Zentla (handled by Stripe)
- Webhook signatures are verified using HMAC-SHA256

### Authentication

- JWT tokens are used for API authentication
- Tokens should be stored securely client-side
- Implement token refresh for long-lived sessions

## Updates

Security updates are released as patch versions and announced in:

- GitHub Releases
- Security advisories (for critical issues)

Subscribe to releases to stay informed about security updates.
