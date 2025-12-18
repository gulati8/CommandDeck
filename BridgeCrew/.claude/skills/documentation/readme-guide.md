# README Writing Guide

## Philosophy

A README is an **entry point**, not comprehensive documentation. It should get a developer from zero to running the project locally in under 5 minutes of reading.

**Key principle**: Answer three questions quickly:
1. **What is this?** (1-2 sentences)
2. **What do I need?** (tech stack, prerequisites)
3. **How do I run it?** (quick start commands)

## What Belongs in a README

### Essential Sections (in order)

1. **Project Title + One-line Description**
   - Clear, specific, no jargon
   - Example: "A TypeScript library for rate-limiting API requests"
   - NOT: "A powerful, enterprise-grade, next-generation solution..."

2. **Prerequisites**
   - Language/runtime version (e.g., "Node.js 18+")
   - System requirements if any
   - Account requirements (API keys, etc.)

3. **Installation**
   ```bash
   # Clone and install
   git clone <repo>
   cd <project>
   npm install
   ```

4. **Quick Start**
   ```bash
   # Run the thing
   npm run dev
   # Open http://localhost:3000
   ```

5. **Tech Stack** (optional but helpful)
   - List core technologies
   - Keep it factual: "React 18, TypeScript, Tailwind CSS, Prisma"
   - NO marketing language

6. **Project Structure** (if helpful for onboarding)
   ```
   src/
   ├── components/  # React components
   ├── lib/         # Utilities
   └── pages/       # Next.js routes
   ```

7. **Available Commands**
   - `npm run dev` - Start development server
   - `npm run build` - Production build
   - `npm test` - Run tests

8. **Environment Variables**
   - List required variables
   - Include `.env.example` if needed
   - Link to setup docs if complex

9. **Links to Deeper Docs** (if they exist)
   - Contributing: `CONTRIBUTING.md`
   - Architecture: `docs/ARCHITECTURE.md`
   - API Reference: `docs/API.md`

10. **License**
    - MIT, Apache 2.0, etc.

### Optional Sections (use sparingly)

- **Badges** - Only if actively maintained (build status, version)
- **Screenshots** - Only for UI-heavy projects
- **Basic Examples** - One simple code example MAX

## What Does NOT Belong in a README

Move these to separate documentation:

| Content | Where It Belongs |
|---------|------------------|
| Architecture decisions | `docs/ARCHITECTURE.md` or `docs/adr/` |
| Implementation patterns | `docs/PATTERNS.md` or `CONTRIBUTING.md` |
| API documentation | `docs/API.md` or inline docs |
| Deployment instructions | `docs/DEPLOYMENT.md` |
| Design philosophy | `docs/PHILOSOPHY.md` |
| Troubleshooting guide | `docs/TROUBLESHOOTING.md` |
| Detailed configuration | `docs/CONFIGURATION.md` |
| Changelog | `CHANGELOG.md` |
| Security policies | `SECURITY.md` |

## Anti-Patterns to Avoid

❌ **Marketing Language**
- "Powerful, scalable, enterprise-grade solution"
- "Revolutionary approach to..."
- "Blazingly fast..."

✅ **Factual Description**
- "Redis-backed rate limiter for Express.js"
- "Static site generator using Markdown"

---

❌ **Feature Lists**
```markdown
## Features
- ✨ Fast performance
- 🚀 Easy to use
- 💪 Robust and reliable
- 🎨 Beautiful UI
```

✅ **Concise Description**
"A rate limiter with Redis backend and Express middleware."

---

❌ **Extensive Troubleshooting**
"If you encounter error X, try Y. If that doesn't work, check Z..."

✅ **Link to Docs**
"See [Troubleshooting Guide](docs/TROUBLESHOOTING.md) if you encounter issues."

---

❌ **Comprehensive Configuration**
Long tables of every config option with descriptions

✅ **Essential Config Only**
Required environment variables, link to full config docs

---

❌ **Architecture Explanations**
"We chose microservices because...The system uses an event-driven architecture where..."

✅ **Save for Architecture Docs**
Brief mention of stack, details in `docs/ARCHITECTURE.md`

## Writing Style

1. **Assume zero prior knowledge** of your project (but basic dev skills)
2. **Use simple, direct language** - avoid jargon, acronyms (or define them)
3. **Be scannable** - Use headers, bullets, code blocks
4. **Commands over prose** - Show, don't tell
   - Good: `npm install && npm start`
   - Bad: "First, install dependencies by running the install command, then start the server"
5. **No emojis** - Unless the project culture uses them extensively
6. **Present tense, imperative mood** - "Run `npm start`" not "You should run..."

## Template

Use this as a starting point:

```markdown
# Project Name

Brief one-sentence description.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Installation

\`\`\`bash
git clone https://github.com/user/repo.git
cd repo
npm install
cp .env.example .env  # Edit with your values
\`\`\`

## Quick Start

\`\`\`bash
npm run dev
# Open http://localhost:3000
\`\`\`

## Tech Stack

- Next.js 14
- TypeScript
- Prisma (PostgreSQL)
- Tailwind CSS

## Project Structure

\`\`\`
src/
├── app/         # Next.js app router
├── components/  # React components
└── lib/         # Database, utilities
\`\`\`

## Commands

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm test` - Run tests
- `npm run db:migrate` - Run database migrations

## Environment Variables

Required variables in `.env`:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Authentication secret

See `.env.example` for full list.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and decisions
- [API Reference](docs/API.md) - Endpoint documentation
- [Contributing](CONTRIBUTING.md) - Development workflow

## License

MIT
\`\`\`

## Testing Your README

Before finalizing, check:

1. ✅ Can a new developer clone and run the project in < 5 minutes?
2. ✅ Are all prerequisites clearly listed?
3. ✅ Are commands copy-pasteable?
4. ✅ Is it under 200 lines? (Aim for 100-150)
5. ✅ Does it avoid architecture/implementation details?
6. ✅ Are there links to deeper documentation?

## Examples of Great READMEs

When in doubt, look at popular projects:
- **Minimal**: https://github.com/sindresorhus/got
- **Clear structure**: https://github.com/vercel/next.js
- **Good balance**: https://github.com/trpc/trpc

## For Different Project Types

### Library/Package
Focus on: Installation, basic usage example, API reference link

### Application
Focus on: Prerequisites, local setup, environment variables, running locally

### Framework/Tool
Focus on: Quick start, basic example, link to full docs

### Utility/Script
Focus on: What it does, usage command, options
