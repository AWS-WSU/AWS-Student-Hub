# Newsletter Feature Documentation

This document describes the implementation and status of the newsletter signup feature for AWS Student Hub.

---

## Issue Checklist & Status

- [x] **Backend POST endpoint** to receive email submissions
- [x] **Server-side email validation**
- [x] **Store/process emails**
  - [x] MongoDB storage (local or Atlas, when configured)
  - [x] In-memory fallback (if MongoDB not set up)
  - [ ] CSV/simple table export (not implemented, but MongoDB allows easy export)
- [x] **Frontend integration**
  - [x] Form submit button sends to backend (via fetch)
  - [x] Shows success/failure message
- [x] **Basic rate limiting** (5 requests per 15 minutes per IP)
- [ ] **CAPTCHA** (not implemented, optional/future enhancement)
- [x] **CORS handled properly**
- [x] **Admin token required for protected endpoints**

---

## Overview
The newsletter signup feature allows users to subscribe to the AWS Student Hub newsletter directly from the website footer. The implementation includes backend validation, database storage (MongoDB Atlas, local MongoDB, or in-memory fallback), and user feedback on the frontend. Admins can view all subscriptions with a secure token.

## Features Summary
- ✅ Email validation (client and server-side)
- ✅ Duplicate email handling
- ✅ Rate limiting (5 requests per 15 minutes per IP)
- ✅ User feedback with success/error messages
- ✅ MongoDB Atlas or local MongoDB storage with timestamps (when configured)
- ✅ In-memory fallback if MongoDB is not set up (data lost on restart)
- ✅ CORS handling via environment variable
- ✅ Reactivation of previously unsubscribed emails
- ✅ Admin-only endpoint for viewing all subscriptions (token required)
- ❌ CAPTCHA (not implemented, optional)
- ❌ CSV/simple table export (not implemented, but possible via MongoDB tools)

---

## API Endpoints

### Subscribe to Newsletter
```
POST /api/newsletter/subscribe
Content-Type: application/json

{
  "email": "user@example.com"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Successfully subscribed to newsletter! Thank you for joining us."
}
```
- If already subscribed: `409` with `{ success: false, message: 'This email is already subscribed to our newsletter' }`
- If reactivating: `200` with `{ success: true, message: 'Welcome back! Your newsletter subscription has been reactivated.' }`
- If invalid email: `400` with `{ success: false, message: 'Please provide a valid email address' }`

### Unsubscribe from Newsletter
```
POST /api/newsletter/unsubscribe
Content-Type: application/json

{
  "email": "user@example.com"
}
```
- If not found: `404` with `{ success: false, message: 'Email not found in our newsletter list' }`
- If invalid email: `400` with `{ success: false, message: 'Please provide a valid email address' }`
- On success: `200` with `{ success: true, message: 'Successfully unsubscribed from newsletter' }`

### Get All Subscriptions (Admin Only)
```
GET /api/newsletter/subscriptions
x-admin-token: <your_admin_token> (must exactly match the ADMIN_TOKEN specified in the backend .env file)
```
**Response:**
```json
{
  "success": true,
  "data": [
    { "email": "user@example.com", "subscribedAt": "2024-06-01T12:00:00.000Z" },
    ...
  ],
  "count": 1,
  "storage": "MongoDB" // or "Memory (temporary)"
}
```
- Requires `x-admin-token` header. Returns `401` if missing/invalid.

---

## Setup Instructions

### 🚨 MongoDB Configuration Required
**Important:** This application requires MongoDB (Atlas or local) for persistent email storage.

If MongoDB is not configured, please contact:
📧 **Project Lead: Akrm Al-Hakimi**

#### Current Behavior
- ✅ Application runs with temporary in-memory storage if MongoDB is unavailable
- ⚠️ All email subscriptions will be lost when server restarts
- 🎯 For production use, MongoDB (Atlas or local) must be properly configured

#### To Configure MongoDB Atlas
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas/database)
2. Build a free cluster (M0 tier)
3. Create a database user and whitelist your IP
4. Get your connection string (e.g., `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority`)
5. Add it to your backend `.env` file as `MONGODB_URI`

#### Backend Setup
1. Make sure MongoDB is running locally or configure `MONGODB_URI` in `.env`
2. Install dependencies: `npm install`
3. Create `.env` file with required environment variables (see below)
4. **Set `ADMIN_TOKEN` in `.env` (required, server will not start without it)**
5. Start the server: `npm start`

#### Frontend Setup
1. Make sure `VITE_API_URL` is configured in `.env`
2. The newsletter form is already integrated in the Footer component

#### Example Environment Variables

**backend/.env.example**
```
# MongoDB connection string (Atlas or local)
# MONGODB_URI=your_mongodb_connection_string_here
# Admin token for protected endpoints (required)
ADMIN_TOKEN=your_admin_token_here
# Server port (optional, defaults to 5000 or 5001)
PORT=5001
# Node environment
NODE_ENV=development
# Allowed CORS origins (comma separated)
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

**frontend/.env.example**
```
# API base URL for the backend
VITE_API_URL=http://localhost:5001/api
# Auth0 (if used)
VITE_AUTH0_DOMAIN=your-auth0-domain
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_CALLBACK_URL=http://localhost:5173
```

---

## Database Schema

**Newsletter Collection:**
```javascript
{
  email: String (required, unique, lowercase),
  subscribedAt: Date (default: Date.now),
  isActive: Boolean (default: true),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

---

## Security Features
- Rate limiting: 5 requests per 15 minutes per IP (all newsletter endpoints)
- Email validation on both client and server
- Input sanitization
- CORS protection (configurable origins)
- Error handling without exposing sensitive information
- Admin endpoints protected by static token in `x-admin-token` header (constant-time comparison)

---

## Future Enhancements
- [ ] Email verification before adding to list
- [ ] Bulk export functionality for newsletter distribution
- [ ] Admin dashboard for managing subscriptions
- [ ] Integration with email service providers (SendGrid, Mailgun, etc.)
- [ ] CAPTCHA integration for additional spam protection
- [ ] Unsubscribe links in emails

---

## Testing

### Manual Testing
1. Start both backend and frontend servers
2. Navigate to the website footer
3. Try subscribing with a valid email
4. Try subscribing with the same email again (should show already subscribed)
5. Try subscribing with invalid email format
6. Test rate limiting by making multiple rapid requests
7. Test admin endpoint with and without correct `x-admin-token`

### API Testing with curl
```bash
# Subscribe
curl -X POST http://localhost:5001/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Unsubscribe
curl -X POST http://localhost:5001/api/newsletter/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Get subscriptions (admin only, requires x-admin-token header)
curl -H "x-admin-token: your_admin_token_here" http://localhost:5001/api/newsletter/subscriptions | jq
```

---

## Troubleshooting

### Common Issues
1. **MongoDB Connection Error:** Ensure MongoDB is running and URI is correct
2. **CORS Error:** Check that frontend URL is in the CORS origins list
3. **Rate Limiting:** Wait 15 minutes or restart server to reset rate limits
4. **Environment Variables:** Ensure all required .env variables are set
5. **Admin Token Error:** Ensure `ADMIN_TOKEN` is set in backend `.env` and provided in `x-admin-token` header for admin endpoints
