# JWT Authentication Setup

## Cấu hình JWT đã hoàn thành

### 1. Dependencies đã cài đặt:
- `@nestjs/jwt` - JWT module cho NestJS
- `@nestjs/passport` - Passport integration
- `passport-jwt` - JWT strategy cho Passport
- `@types/passport-jwt` - TypeScript types

### 2. Files đã tạo/cập nhật:

#### Config:
- `src/config/jwt.config.ts` - Cấu hình JWT secret và expiration

#### Strategies:
- `src/common/strategies/jwt.strategy.ts` - JWT strategy để validate token

#### Guards:
- `src/common/guards/jwt-auth.guard.ts` - Guard để protect routes

#### Auth Module:
- `src/modules/auth/auth.module.ts` - Import JWT module và strategy
- `src/modules/auth/auth.service.ts` - Generate JWT token khi login/register
- `src/modules/auth/auth.controller.ts` - Endpoints với JWT protection

### 3. API Endpoints:

#### Public endpoints:
- `POST /auth/register` - Đăng ký tài khoản (gửi OTP)
- `POST /auth/verify-otp` - Xác thực OTP và tạo tài khoản (trả về JWT)
- `POST /auth/login` - Đăng nhập (trả về JWT)
- `GET /auth/google` - Google OAuth login
- `GET /auth/google/callback` - Google OAuth callback (redirect với token)

#### Protected endpoints:
- `GET /auth/profile` - Lấy thông tin user (cần JWT token)

### 4. Cách sử dụng JWT:

#### Đăng nhập/Đăng ký:
```bash
# Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Response
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  },
  "result": {
    "code": "success",
    "error_msg_id": "",
    "total_count": ""
  }
}
```

#### Sử dụng token:
```bash
# Lấy profile
GET /auth/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Environment Variables cần thiết:

```env
# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"

# Frontend URL
FRONTEND_URL="http://localhost:3001"
```

### 6. JWT Token Structure:

```typescript
// Payload
{
  "sub": "user-id",      // User ID
  "email": "user@example.com",
  "iat": 1234567890,     // Issued at
  "exp": 1234567890      // Expires at
}
```

### 7. Bảo mật:

- JWT secret được lưu trong environment variables
- Token có thời hạn 7 ngày (có thể cấu hình)
- Tất cả protected routes cần Bearer token
- Google OAuth redirect với token trong URL

### 8. Test JWT:

```bash
# 1. Đăng nhập để lấy token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# 2. Sử dụng token để truy cập protected route
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Lưu ý:
- JWT token được tự động generate khi đăng nhập thành công
- Token chứa user ID và email
- Frontend cần lưu token và gửi trong header Authorization
- Token có thể được refresh bằng cách đăng nhập lại
