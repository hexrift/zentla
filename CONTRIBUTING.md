# Contributing to Zentla

Thank you for your interest in contributing to Zentla! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Your environment (OS, Node.js version, etc.)
- Relevant logs or error messages

### Suggesting Features

Feature requests are welcome! Please:

- Check existing issues and discussions first
- Describe the problem you're trying to solve
- Explain your proposed solution
- Consider alternative approaches

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `yarn install`
3. **Make your changes** following our coding standards
4. **Add tests** for new functionality
5. **Run the test suite**: `yarn test`
6. **Run linting**: `yarn lint`
7. **Run type checking**: `yarn typecheck`
8. **Commit your changes** with a descriptive message
9. **Push to your fork** and submit a pull request

## Development Setup

### Prerequisites

- Node.js 18+
- Yarn 4+
- Docker (for PostgreSQL and Redis)
- Stripe CLI (for webhook testing)

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/zentla.git
cd zentla

# Install dependencies
yarn install

# Start infrastructure
docker-compose up -d

# Set up environment
cp .env.example .env

# Run migrations
yarn db:generate
yarn db:migrate

# Start development
yarn dev
```

### Project Structure

```
packages/
├── api/          # NestJS API - main backend
├── admin-ui/     # React admin dashboard
├── web/          # Marketing site & docs
├── sdk/          # TypeScript SDK
├── core/         # Shared domain logic
├── database/     # Prisma schema
└── adapters/     # Billing provider integrations
```

### Running Tests

```bash
# Run all tests
yarn test

# Run tests for a specific package
yarn workspace @zentla/api test

# Run tests in watch mode
yarn workspace @zentla/api test:watch
```

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Check linting
yarn lint

# Fix linting issues
yarn lint --fix

# Format code
yarn prettier --write .
```

### Commit Messages

We follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(api): add promotion code validation
fix(checkout): handle expired sessions gracefully
docs: update quickstart guide
```

## Architecture Guidelines

### API Design

- Follow REST conventions
- Use consistent error responses
- Version endpoints under `/api/v1/`
- Document all endpoints with OpenAPI

### Database

- Use Prisma for all database operations
- Create migrations for schema changes
- Never modify existing migrations
- Add indexes for frequently queried fields

### Testing

- Write unit tests for business logic
- Write integration tests for API endpoints
- Mock external services (Stripe, etc.)
- Aim for meaningful test coverage

## Getting Help

- **Questions**: Open a [GitHub Discussion](https://github.com/hexrift/zentla/discussions)
- **Bugs**: Open a [GitHub Issue](https://github.com/hexrift/zentla/issues)
- **Security**: Email security@zentla.dev (see [SECURITY.md](SECURITY.md))

## Recognition

Contributors will be recognized in our release notes and on the project README.

Thank you for contributing to Zentla!
