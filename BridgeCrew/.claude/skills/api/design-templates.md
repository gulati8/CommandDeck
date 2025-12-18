# API Design Templates and Best Practices

Reference templates for REST APIs, GraphQL schemas, and API contract design. Use these as starting points, adapting to project requirements.

---

## REST API Template

### Endpoint Structure

#### Create Resource
```
POST /api/v1/resources
```

**Request**:
```json
{
  "name": "string (required, 1-100 chars)",
  "description": "string (optional, max 1000 chars)",
  "type": "enum: basic|premium|enterprise",
  "metadata": {
    "key": "value"
  }
}
```

**Response** (201 Created):
```json
{
  "data": {
    "id": "uuid",
    "name": "Resource Name",
    "description": "Description",
    "type": "basic",
    "metadata": {},
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

**Error Responses**:
| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid request body |
| 401 | UNAUTHORIZED | Missing or invalid auth |
| 403 | FORBIDDEN | Insufficient permissions |
| 409 | CONFLICT | Resource already exists |
| 422 | UNPROCESSABLE_ENTITY | Business rule violation |

---

#### List Resources
```
GET /api/v1/resources
```

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page (max 100) |
| sort | string | -createdAt | Sort field (prefix - for desc) |
| filter[type] | string | - | Filter by type |
| filter[search] | string | - | Search in name/description |

**Response** (200 OK):
```json
{
  "data": [
    { "id": "uuid", "name": "...", ... }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  },
  "links": {
    "self": "/api/v1/resources?page=1",
    "next": "/api/v1/resources?page=2",
    "last": "/api/v1/resources?page=8"
  }
}
```

---

#### Get Resource
```
GET /api/v1/resources/:id
```

**Response** (200 OK):
```json
{
  "data": {
    "id": "uuid",
    "name": "Resource Name",
    ...
  }
}
```

**Error Responses**:
| Status | Code | Description |
|--------|------|-------------|
| 404 | NOT_FOUND | Resource not found |

---

#### Update Resource
```
PATCH /api/v1/resources/:id
```

**Request** (partial update):
```json
{
  "name": "Updated Name"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "id": "uuid",
    "name": "Updated Name",
    ...
  }
}
```

---

#### Delete Resource
```
DELETE /api/v1/resources/:id
```

**Response** (204 No Content)

---

## Authentication Patterns

### JWT Authentication
```
Authorization: Bearer <token>
```

**Token Payload**:
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "roles": ["user", "admin"],
  "iat": 1673784600,
  "exp": 1673788200
}
```

**Token Refresh**:
```
POST /api/v1/auth/refresh
{
  "refreshToken": "string"
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address"
      }
    ],
    "requestId": "uuid"
  }
}
```

**Standard Error Codes**:
| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Permission denied |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Pagination Strategies

### Offset-based (for simple lists)
```
GET /resources?page=2&limit=20
```

### Cursor-based (for real-time data)
```
GET /resources?cursor=eyJpZCI6MTIzfQ&limit=20
```

**Response includes**:
```json
{
  "meta": {
    "pagination": {
      "hasMore": true,
      "nextCursor": "eyJpZCI6MTQzfQ"
    }
  }
}
```

---

## Versioning Strategy

**Approach**: URL path versioning

```
/api/v1/resources  # Current stable
/api/v2/resources  # Next major version
```

**Deprecation Policy**:
1. Announce deprecation 6 months before removal
2. Add `Deprecation` header to responses
3. Document migration path
4. Remove after deprecation period

**Headers**:
```
Deprecation: true
Sunset: Sat, 31 Dec 2024 23:59:59 GMT
Link: </api/v2/resources>; rel="successor-version"
```

---

## Rate Limiting

**Headers in Response**:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1673788200
```

**When Exceeded** (429):
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "retryAfter": 60
  }
}
```

---

## Webhooks

**Webhook Payload**:
```json
{
  "id": "webhook-event-uuid",
  "type": "resource.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "id": "resource-uuid",
    ...
  }
}
```

**Webhook Security**:
- Include signature header: `X-Webhook-Signature`
- Verify: `HMAC-SHA256(payload, secret)`
- Implement idempotency with event ID

---

## OpenAPI Specification Template

```yaml
openapi: 3.0.3
info:
  title: Resource API
  version: 1.0.0
  description: API for managing resources

servers:
  - url: https://api.example.com/v1

paths:
  /resources:
    get:
      summary: List resources
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ResourceList'

components:
  schemas:
    Resource:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
      required:
        - id
        - name
```

---

## GraphQL Schema Template

### Schema Design
```graphql
type Query {
  user(id: ID!): User
  users(filter: UserFilter, pagination: PaginationInput): UserConnection!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
}

type User {
  id: ID!
  email: String!
  name: String!
  orders(first: Int, after: String): OrderConnection!
}

# Relay-style connection for pagination
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

### Input/Payload Pattern
```graphql
input CreateUserInput {
  email: String!
  name: String!
}

type CreateUserPayload {
  user: User
  errors: [UserError!]!
}

type UserError {
  field: String
  message: String!
}
```

---

## REST API Best Practices

### URL Design
- Use nouns, not verbs: `/users` not `/getUsers`
- Use plural nouns: `/users` not `/user`
- Use hyphens for readability: `/user-profiles`
- Use lowercase: `/api/v1/users`
- Nest for relationships: `/users/:id/orders`

### HTTP Methods
| Method | Purpose | Idempotent |
|--------|---------|------------|
| GET | Read resource(s) | Yes |
| POST | Create resource | No |
| PUT | Replace resource | Yes |
| PATCH | Partial update | Yes |
| DELETE | Remove resource | Yes |

### Status Codes
| Code | Usage |
|------|-------|
| 200 | Success with body |
| 201 | Created |
| 204 | Success, no body |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict |
| 422 | Unprocessable |
| 429 | Rate limited |
| 500 | Server error |

### Response Envelope

```json
{
  "data": { ... },      // The actual response data
  "meta": { ... },      // Pagination, request ID, etc.
  "links": { ... },     // HATEOAS links (optional)
  "error": { ... }      // Only for error responses
}
```

---

## Design Principles

1. **Consistency is king** - Same patterns everywhere
2. **Design for clients** - Consider DX in every decision
3. **Fail explicitly** - Clear error messages and codes
4. **Version from day one** - Plan for evolution
5. **Document everything** - OpenAPI/GraphQL introspection
6. **Secure by default** - Auth, rate limits, validation
7. **Paginate by default** - Never return unbounded lists
8. **Use proper status codes** - 200 for success, 4xx for client errors
9. **Include request IDs** - For debugging and support
10. **Plan for backwards compatibility** - Breaking changes are expensive
