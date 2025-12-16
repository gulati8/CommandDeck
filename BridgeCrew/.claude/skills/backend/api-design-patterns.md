# API Design Patterns

Best practices for designing REST, GraphQL, and gRPC APIs.

## REST API Patterns

### Resource Naming

```
# Good - Noun-based, plural
GET    /users
GET    /users/:id
POST   /users
PUT    /users/:id
PATCH  /users/:id
DELETE /users/:id

# Good - Nested resources
GET    /users/:id/orders
POST   /users/:id/orders
GET    /users/:id/orders/:orderId

# Bad - Verb-based
GET    /getUsers
POST   /createUser
POST   /deleteUser
```

### HTTP Methods & Status Codes

| Method | Purpose | Idempotent | Safe |
|--------|---------|------------|------|
| GET | Read | Yes | Yes |
| POST | Create | No | No |
| PUT | Replace | Yes | No |
| PATCH | Update | Yes | No |
| DELETE | Remove | Yes | No |

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Success with body |
| 201 | Created | POST success |
| 204 | No Content | DELETE success |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Auth required |
| 403 | Forbidden | No permission |
| 404 | Not Found | Resource missing |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable | Validation failed |
| 429 | Too Many Requests | Rate limited |
| 500 | Server Error | Unexpected error |

### Request/Response Format

```json
// Standard Response Envelope
{
  "data": { ... },        // The payload
  "meta": {               // Metadata
    "requestId": "uuid",
    "pagination": { ... }
  },
  "links": {              // HATEOAS (optional)
    "self": "/users?page=2",
    "next": "/users?page=3"
  }
}

// Error Response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [
      { "field": "email", "message": "Must be valid email" }
    ],
    "requestId": "uuid"
  }
}
```

### Pagination

```
# Offset-based (simple)
GET /users?page=2&limit=20

Response:
{
  "data": [...],
  "meta": {
    "pagination": {
      "page": 2,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}

# Cursor-based (for real-time data)
GET /users?cursor=eyJpZCI6MTIzfQ&limit=20

Response:
{
  "data": [...],
  "meta": {
    "pagination": {
      "hasMore": true,
      "nextCursor": "eyJpZCI6MTQzfQ"
    }
  }
}
```

### Filtering & Sorting

```
# Filtering
GET /users?filter[status]=active&filter[role]=admin

# Multiple values
GET /products?filter[category]=electronics,clothing

# Sorting
GET /users?sort=-createdAt,name  # - prefix for descending

# Search
GET /users?search=john
```

### Versioning Strategies

```
# URL Path (Recommended)
GET /api/v1/users
GET /api/v2/users

# Header
GET /api/users
Accept: application/vnd.api+json; version=1

# Query Parameter
GET /api/users?version=1
```

## GraphQL Patterns

### Schema Design

```graphql
# Types
type User {
  id: ID!
  email: String!
  name: String!
  createdAt: DateTime!
  orders(first: Int, after: String): OrderConnection!
}

# Queries
type Query {
  user(id: ID!): User
  users(filter: UserFilter, pagination: PaginationInput): UserConnection!
}

# Mutations
type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!
}

# Input/Payload Pattern
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

### Pagination (Relay-style)

```graphql
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Query
query {
  users(first: 10, after: "cursor") {
    edges {
      node {
        id
        name
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### N+1 Prevention (DataLoader)

```typescript
// DataLoader setup
const userLoader = new DataLoader(async (ids: string[]) => {
  const users = await User.find({ id: { $in: ids } });
  const userMap = new Map(users.map(u => [u.id, u]));
  return ids.map(id => userMap.get(id));
});

// In resolver
const resolvers = {
  Order: {
    user: (order, _, { loaders }) => loaders.user.load(order.userId)
  }
};
```

## gRPC Patterns

### Proto Definition

```protobuf
syntax = "proto3";

package user.v1;

service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
  rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse);
  rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);

  // Streaming
  rpc WatchUsers(WatchUsersRequest) returns (stream User);
}

message User {
  string id = 1;
  string email = 2;
  string name = 3;
}

message GetUserRequest {
  string id = 1;
}

message GetUserResponse {
  User user = 1;
}
```

## Common Patterns

### Idempotency Keys

```
POST /orders
Idempotency-Key: abc123

# Server stores key -> response mapping
# Duplicate requests return cached response
```

### Rate Limiting Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1673788200
```

### Webhooks

```json
{
  "id": "evt_123",
  "type": "user.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "id": "usr_456",
    "email": "user@example.com"
  }
}

# Verification
X-Webhook-Signature: sha256=abc123...
```

### API Versioning Lifecycle

1. **Alpha**: Breaking changes expected
2. **Beta**: Mostly stable, minor changes
3. **Stable**: No breaking changes
4. **Deprecated**: Sunset announced
5. **Retired**: No longer available

## Best Practices Checklist

- [ ] Consistent resource naming (nouns, plural)
- [ ] Proper HTTP methods and status codes
- [ ] Pagination for all list endpoints
- [ ] Filtering and sorting support
- [ ] Clear error messages with codes
- [ ] Rate limiting implemented
- [ ] API versioning strategy
- [ ] OpenAPI/GraphQL documentation
- [ ] Idempotency for mutations
- [ ] Request ID tracking
