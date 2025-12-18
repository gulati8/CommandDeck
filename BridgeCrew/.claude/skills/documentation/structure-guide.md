# Documentation Structure Guide

## The Documentation Hierarchy

Different types of documentation serve different purposes and audiences. Organize them appropriately.

```
project-root/
├── README.md                 # Quick start (5-minute entry point)
├── CONTRIBUTING.md           # How to contribute
├── CHANGELOG.md              # Version history
├── LICENSE.md                # Legal
├── SECURITY.md               # Security policies
├── CODE_OF_CONDUCT.md        # Community guidelines
├── .env.example              # Environment template
│
└── docs/
    ├── ARCHITECTURE.md       # System design, decisions
    ├── API.md                # API reference
    ├── DEPLOYMENT.md         # How to deploy
    ├── CONFIGURATION.md      # Detailed config options
    ├── TROUBLESHOOTING.md    # Common issues
    ├── DEVELOPMENT.md        # Local dev workflow
    ├── TESTING.md            # Testing strategy
    │
    ├── adr/                  # Architecture Decision Records
    │   ├── 001-use-postgres.md
    │   ├── 002-event-sourcing.md
    │   └── README.md
    │
    ├── guides/               # How-to guides
    │   ├── authentication.md
    │   ├── database-setup.md
    │   └── creating-endpoints.md
    │
    └── reference/            # Reference documentation
        ├── database-schema.md
        ├── environment-variables.md
        └── api-endpoints.md
```

## File Purposes

### Root Level Files

#### README.md
**Purpose**: Get developers running the project in 5 minutes
**Audience**: New developers, potential users
**Contents**:
- What is this? (1-2 sentences)
- Prerequisites
- Installation
- Quick start
- Tech stack
- Basic commands
- Links to other docs

**Length**: 100-200 lines MAX

---

#### CONTRIBUTING.md
**Purpose**: Guide contributors through the contribution process
**Audience**: External and internal contributors
**Contents**:
- How to set up dev environment
- Code style guidelines
- Branching strategy
- Pull request process
- Testing requirements
- Where to ask questions

**When to create**: When you want external contributions or have a team

---

#### CHANGELOG.md
**Purpose**: Track version changes
**Audience**: Users upgrading between versions
**Format**: Keep-a-Changelog format
```markdown
## [1.2.0] - 2025-01-15
### Added
- New authentication method

### Changed
- Improved error messages

### Fixed
- Connection timeout bug
```

**When to create**: For versioned releases, especially libraries

---

#### LICENSE.md
**Purpose**: Legal terms
**Audience**: Users, legal teams
**Contents**: MIT, Apache, GPL, or proprietary license

---

#### SECURITY.md
**Purpose**: Security vulnerability reporting
**Audience**: Security researchers
**Contents**:
- How to report vulnerabilities
- Security policy
- Supported versions

**When to create**: For production applications and public projects

---

### docs/ Directory

The `docs/` directory contains detailed documentation that goes beyond quick-start.

#### docs/ARCHITECTURE.md
**Purpose**: Explain system design and architectural decisions
**Audience**: Developers who need to understand the system deeply
**Contents**:
- High-level architecture diagram
- Key architectural patterns (microservices, monolith, etc.)
- Technology choices and rationale
- System boundaries and components
- Data flow
- Important trade-offs made

**Example structure**:
```markdown
# Architecture

## Overview
[One paragraph system description]

## System Components
- Frontend (Next.js)
- API Server (Express)
- Database (PostgreSQL)
- Cache (Redis)

## Architecture Diagram
[Diagram here]

## Key Decisions
- Why microservices vs monolith
- Why PostgreSQL vs MongoDB
- Why REST vs GraphQL

## Data Flow
[How data moves through the system]

## Security Architecture
[Authentication, authorization approach]
```

---

#### docs/adr/ (Architecture Decision Records)
**Purpose**: Document significant architectural decisions
**Audience**: Developers needing context for past decisions
**Format**: One file per decision

**Template**:
```markdown
# ADR-001: Use PostgreSQL for Primary Database

## Status
Accepted

## Context
We need to choose a database for user data and transactions.
[Explain the situation and constraints]

## Decision
We will use PostgreSQL as our primary database.

## Consequences
**Positive**:
- ACID compliance for transactions
- Mature tooling and ecosystem
- Strong type system

**Negative**:
- Scaling requires more planning than NoSQL
- Learning curve for team unfamiliar with SQL

## Alternatives Considered
- MongoDB: More flexible schema but lacks ACID guarantees
- MySQL: Similar to Postgres but weaker JSON support
```

**When to create**: When making significant technical decisions that need documentation

---

#### docs/API.md
**Purpose**: Comprehensive API reference
**Audience**: Developers integrating with your API
**Contents**:
- Base URL
- Authentication
- All endpoints with:
  - HTTP method
  - Path
  - Parameters
  - Request body example
  - Response example
  - Error codes

**Alternative**: Consider API documentation tools (Swagger/OpenAPI, Postman collections)

---

#### docs/DEPLOYMENT.md
**Purpose**: How to deploy to production
**Audience**: DevOps, developers deploying
**Contents**:
- Deployment prerequisites
- Step-by-step deployment process
- Environment configuration
- Monitoring and health checks
- Rollback procedures
- Common deployment issues

---

#### docs/CONFIGURATION.md
**Purpose**: Detailed configuration options
**Audience**: Operators, advanced users
**Contents**:
- All environment variables
- Configuration file options
- Default values
- Examples for different scenarios

---

#### docs/TROUBLESHOOTING.md
**Purpose**: Help users solve common problems
**Audience**: Developers encountering issues
**Contents**:
- Common error messages and solutions
- Debugging techniques
- FAQ
- Where to get help

**Format**: Problem → Solution pairs
```markdown
## Error: "Connection refused on port 5432"

**Cause**: PostgreSQL is not running or not accessible.

**Solution**:
1. Check if PostgreSQL is running: `pg_isready`
2. Verify connection string in `.env`
3. Ensure database exists: `createdb myapp_dev`
```

---

#### docs/DEVELOPMENT.md
**Purpose**: Detailed local development workflow
**Audience**: Regular contributors
**Contents**:
- Detailed setup (beyond README quick start)
- Development tools and IDE setup
- Debugging techniques
- Running specific test suites
- Database management
- Common development tasks

---

#### docs/guides/ Directory
**Purpose**: Task-oriented how-to guides
**Audience**: Developers doing specific tasks
**Contents**: One file per common task

Examples:
- `adding-new-endpoint.md`
- `database-migrations.md`
- `setting-up-authentication.md`
- `creating-new-component.md`

**Format**: Step-by-step instructions

---

#### docs/reference/ Directory
**Purpose**: Reference information
**Audience**: Developers needing to look up details
**Contents**:
- Database schema documentation
- Complete environment variable reference
- Error code reference
- Configuration option reference

---

## Decision Matrix: Where Does This Content Go?

| Content Type | Location | Why |
|--------------|----------|-----|
| Installation steps | `README.md` | Essential for first run |
| Why we chose GraphQL | `docs/ARCHITECTURE.md` or `docs/adr/` | Architectural context |
| All API endpoints | `docs/API.md` | Comprehensive reference |
| How to add a new endpoint | `docs/guides/` | Task-oriented |
| Environment variables (basic) | `README.md` | Essential for setup |
| Environment variables (all) | `docs/CONFIGURATION.md` | Complete reference |
| Debugging tips | `docs/TROUBLESHOOTING.md` | Problem-solving |
| Code style rules | `CONTRIBUTING.md` | For contributors |
| Security vulnerability process | `SECURITY.md` | Standard location |
| How to deploy | `docs/DEPLOYMENT.md` | Operational task |
| Test coverage requirements | `CONTRIBUTING.md` | Contributor guideline |
| Testing strategy (architecture) | `docs/ARCHITECTURE.md` or `docs/TESTING.md` | System design |
| How to run tests | `README.md` (basic) or `docs/DEVELOPMENT.md` (detailed) | Depends on complexity |

## Quick Reference

**Ask yourself**: "Does this information help someone run the project in the next 5 minutes?"
- **Yes** → `README.md`
- **No** → `docs/` somewhere

**Ask yourself**: "Is this about WHY we built it this way?"
- **Yes** → `docs/ARCHITECTURE.md` or `docs/adr/`

**Ask yourself**: "Is this a step-by-step guide for a specific task?"
- **Yes** → `docs/guides/`

**Ask yourself**: "Is this reference information to look up?"
- **Yes** → `docs/reference/`

**Ask yourself**: "Is this about HOW to contribute?"
- **Yes** → `CONTRIBUTING.md`

## Documentation Principles

1. **Findable**: Clear file names, logical organization, linked from README
2. **Scannable**: Headers, bullets, code blocks
3. **Accurate**: Keep docs updated when code changes
4. **Concise**: Remove fluff, be direct
5. **Practical**: Include examples and commands
6. **Layered**: Quick start → Detailed docs → Reference

## Maintaining Documentation

### When Code Changes
- **Small change**: Update inline comments
- **API change**: Update API docs
- **New feature**: Update README (if affects setup), add guide if complex
- **Architectural change**: Update ARCHITECTURE.md, create ADR

### Documentation Reviews
During code review, check:
- Does this change affect existing docs?
- Should this create new documentation?
- Are examples still accurate?
- Are setup instructions still current?

### Deprecation
When removing features:
1. Update README and relevant docs
2. Add migration guide if needed
3. Update CHANGELOG.md
4. Keep old docs with deprecation notice for one version

## Starting From Scratch

For a new project, create in this order:

1. **README.md** - Essential for anyone discovering the project
2. **LICENSE.md** - Legal clarity
3. **.env.example** - If needed
4. **CONTRIBUTING.md** - When ready for contributors
5. **docs/ARCHITECTURE.md** - Once architecture stabilizes
6. **Other docs/** - As needed when complexity grows

Don't create documentation "in advance" - create it when the need becomes clear.
