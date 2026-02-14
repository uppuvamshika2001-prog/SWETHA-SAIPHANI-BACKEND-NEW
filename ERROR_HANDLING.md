# Production-Safe Error Handling Documentation

## Overview

This document describes the comprehensive error handling system implemented for the HMS (Hospital Management System) backend. The system ensures:

- ✅ APIs never crash the server
- ✅ Errors are handled, logged, and safely returned
- ✅ Clients always receive clear, structured error responses
- ✅ Sensitive details are never leaked to clients
- ✅ Full error stacks are logged server-side only

---

## 📁 Files Modified/Created

### New Files
1. **`src/utils/AppError.ts`** - Custom error class hierarchy
2. **`src/utils/asyncHandler.ts`** - Async wrapper utility

### Modified Files
1. **`src/middleware/errorHandler.ts`** - Enhanced global error handler
2. **`src/utils/response.ts`** - Updated response utilities
3. **`src/modules/auth/auth.controller.ts`** - Refactored with asyncHandler
4. **`src/modules/auth/auth.service.ts`** - Hardened login method
5. **`src/server.ts`** - Enhanced process handlers
6. **`src/app.ts`** - Updated 404 handler

---

## 🏗️ Architecture

### 1. Custom Error Class Hierarchy (`AppError.ts`)

```typescript
AppError (base class)
├── ValidationError (400)
├── UnauthorizedError (401)
├── InvalidCredentialsError (401)
├── TokenError (401)
├── ForbiddenError (403)
├── NotFoundError (404)
├── ConflictError (409)
├── UnprocessableEntityError (422)
├── RateLimitError (429)
├── InternalError (500)
├── DatabaseError (500)
└── ServiceUnavailableError (503)
```

Each error includes:
- `statusCode` - HTTP status code
- `code` - Machine-readable error code (e.g., `AUTH_INVALID_CREDENTIALS`)
- `message` - Human-readable message
- `isOperational` - Flag to distinguish expected vs programming errors
- `timestamp` - When the error occurred
- `details` - Optional additional information

### 2. Async Handler Wrapper (`asyncHandler.ts`)

```typescript
export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
```

Wraps all async route handlers to:
- Catch any unhandled promise rejections
- Forward errors to Express error middleware
- Prevent server crashes from async errors

### 3. Global Error Handler (`errorHandler.ts`)

Handles:
- `AppError` and subclasses
- `ZodError` (validation)
- `PrismaClientKnownRequestError` (database)
- `JsonWebTokenError` / `TokenExpiredError` (JWT)
- `SyntaxError` (JSON parsing)
- `TypeError` (null/undefined access)
- Unknown errors (500)

Features:
- Request ID generation for tracing
- Full stack trace logging (server-side only)
- Safe client responses (no sensitive data)
- Different behavior for production vs development

---

## 📝 Standard Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "role": "..." },
    "tokens": { "accessToken": "...", "refreshToken": "...", "expiresIn": "15m" }
  },
  "message": "Login successful",
  "timestamp": "2026-01-28T12:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "details": []  // Optional, for validation errors
  },
  "timestamp": "2026-01-28T12:00:00.000Z",
  "requestId": "req_1706446800_abc123xyz"
}
```

---

## 🔐 Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `BAD_REQUEST` | 400 | Invalid request data |
| `AUTH_UNAUTHORIZED` | 401 | Not authenticated |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `AUTH_INVALID_TOKEN` | 401 | JWT verification failed |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT has expired |
| `AUTH_ACCOUNT_DISABLED` | 401 | Account is disabled |
| `AUTH_FORBIDDEN` | 403 | Not authorized for action |
| `NOT_FOUND` | 404 | Resource not found |
| `ROUTE_NOT_FOUND` | 404 | API endpoint not found |
| `DUPLICATE_ENTRY` | 409 | Unique constraint violation |
| `CONFLICT` | 409 | Resource conflict |
| `UNPROCESSABLE_ENTITY` | 422 | Semantic validation error |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily down |

---

## 🛡️ Security Best Practices Implemented

### 1. No Credential Enumeration
```typescript
// BAD: Reveals if email exists
throw new Error('Invalid email - User not found');

// GOOD: Generic message for both cases
throw new InvalidCredentialsError(); // "Invalid email or password"
```

### 2. No Stack Traces in Production
```typescript
// Only in development:
if (!config.isProduction && stack) {
    response.stack = stack;
}
```

### 3. Sensitive Field Redaction
The logger automatically redacts:
- `password`
- `passwordHash`
- `token`
- `refreshToken`
- `accessToken`

### 4. Request ID Tracing
Every error response includes a `requestId` for debugging without exposing internals.

---

## 🔄 Process-Level Error Handling

Located in `server.ts`:

```typescript
// Handles synchronous exceptions
process.on('uncaughtException', (err) => {
    logger.fatal({ error: err.message, type: 'uncaughtException' }, 
        '💥 UNCAUGHT EXCEPTION - Server will continue running');
});

// Handles unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason, type: 'unhandledRejection' }, 
        '💥 UNHANDLED PROMISE REJECTION - Server will continue running');
});
```

The server logs but continues running to maintain availability.

---

## 💻 Usage Examples

### Using asyncHandler in Controllers
```typescript
import { asyncHandler } from '../../utils/asyncHandler.js';

export const login = asyncHandler(async (req, res, _next) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    sendSuccess(res, result, 'Login successful');
});
```

### Throwing Custom Errors in Services
```typescript
import { InvalidCredentialsError, DatabaseError } from '../../utils/AppError.js';

async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    
    if (!user) {
        throw new InvalidCredentialsError();
    }
    
    // ... rest of login logic
}
```

### Handling Errors in Try-Catch
```typescript
try {
    const user = await prisma.user.findUnique({ where: { email } });
} catch (dbError) {
    logger.error({ error: dbError }, 'Database error during login');
    throw new DatabaseError('Unable to process login request');
}
```

---

## 🧪 Testing Error Responses

### Test Validation Error (Empty Body)
```bash
POST /api/auth/login
Body: {}

Response (400):
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "email: Invalid email address, password: Password must be at least 6 characters",
    "details": [...]
  }
}
```

### Test Invalid Credentials
```bash
POST /api/auth/login
Body: { "email": "wrong@example.com", "password": "wrongpass" }

Response (401):
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

### Test Route Not Found
```bash
GET /api/nonexistent

Response (404):
{
  "success": false,
  "error": {
    "code": "ROUTE_NOT_FOUND",
    "message": "Route GET /api/nonexistent not found"
  }
}
```

---

## 🔧 Production vs Development

| Behavior | Development | Production |
|----------|-------------|------------|
| Stack traces in response | ✅ Yes | ❌ No |
| Detailed error messages | ✅ Yes | ⚠️ Generic for 500s |
| Pretty logging | ✅ Yes | ❌ JSON format |
| Log level | `debug` | `info` |

---

## 📊 Logging

All errors are logged server-side with full details:

```json
{
  "level": "error",
  "requestId": "req_1706446800_abc123xyz",
  "error": "Invalid email or password",
  "name": "InvalidCredentialsError",
  "code": "AUTH_INVALID_CREDENTIALS",
  "statusCode": 401,
  "stack": "...",
  "url": "/api/auth/login",
  "method": "POST",
  "ip": "::1",
  "userId": null,
  "isOperational": true,
  "msg": "Error occurred"
}
```

---

## ✅ Checklist Summary

- [x] Global Error Handler Middleware
- [x] Custom AppError Class Hierarchy
- [x] Async Handler Wrapper
- [x] Hardened Auth Controllers
- [x] Request ID Generation
- [x] Production-Safe Responses
- [x] Process-Level Exception Handlers
- [x] Consistent Error Response Format
- [x] Full Server-Side Logging
- [x] Graceful Shutdown Handling
