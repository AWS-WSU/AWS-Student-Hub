# Newsletter Feature Documentation

This document describes the implementation and status of the newsletter signup feature for AWS Student Hub.

---

## Issue Checklist & Status

- [x] **Backend POST endpoint** to receive email submissions
- [x] **Server-side email validation**
- [x] **Store/process emails**
  - [x] MongoDB storage (when configured)
  - [x] In-memory fallback (if MongoDB not set up)
  - [ ] CSV/simple table export (not implemented, but MongoDB allows easy export)
- [x] **Frontend integration**
  - [x] Form submit button sends to backend (via fetch)
  - [x] Shows success/failure message
- [x] **Basic rate limiting** (5 requests per 15 minutes per IP)
- [ ] **CAPTCHA** (not implemented, optional/future enhancement)
- [x] **CORS handled properly**

---

## Overview
The newsletter signup feature allows users to subscribe to the AWS Student Hub newsletter directly from the website footer. The implementation includes backend validation, database storage (MongoDB or in-memory fallback), and user feedback on the frontend.

## Features Summary
- ✅ Email validation (client and server-side)
- ✅ Duplicate email handling
- ✅ Rate limiting (5 requests per 15 minutes per IP)
- ✅ User feedback with success/error messages
- ✅ MongoDB storage with timestamps (when configured)
- ✅ In-memory fallback if MongoDB is not set up
- ✅ CORS handling
- ✅ Reactivation of previously unsubscribed emails
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

### Unsubscribe from Newsletter
```
POST /api/newsletter/unsubscribe
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Get All Subscriptions (Admin)
```
GET /api/newsletter/subscriptions
```

---

## Setup Instructions

### 🚨 MongoDB Configuration Required
**Important:** This application requires MongoDB for persistent email storage.

If MongoDB is not configured, please contact:
📧 **Project Lead: Akrm Al-Hakimi**

#### Current Behavior
- ✅ Application runs with temporary in-memory storage if MongoDB is unavailable
- ⚠️ All email subscriptions will be lost when server restarts
- 🎯 For production use, MongoDB must be properly configured

#### To Configure MongoDB
1. Install MongoDB locally or set up MongoDB Atlas
2. Set the `MONGODB_URI` environment variable in `/backend/.env`:
   ```
   MONGODB_URI=mongodb://localhost:27017/aws-student-hub
   # or your MongoDB Atlas connection string
   ```

#### Backend Setup
1. Make sure MongoDB is running locally or configure `MONGODB_URI` in `.env`
2. Install dependencies: `npm install`
3. Create `.env` file with required environment variables
4. Start the server: `npm run dev`

#### Frontend Setup
1. Make sure `VITE_API_URL` is configured in `.env`
2. The newsletter form is already integrated in the Footer component

#### Environment Variables
**Backend (.env):**
```
MONGODB_URI=mongodb://localhost:27017/aws-student-hub
PORT=5000
NODE_ENV=development
```
**Frontend (.env):**
```
VITE_API_URL=http://localhost:5000/api
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
- Rate limiting: 5 requests per 15 minutes per IP
- Email validation on both client and server
- Input sanitization
- CORS protection
- Error handling without exposing sensitive information

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

### API Testing with curl
```bash
# Subscribe
curl -X POST http://localhost:5000/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Get subscriptions
curl http://localhost:5000/api/newsletter/subscriptions
```

---

## Troubleshooting

### Common Issues
1. **MongoDB Connection Error:** Ensure MongoDB is running and URI is correct
2. **CORS Error:** Check that frontend URL is in the CORS origins list
3. **Rate Limiting:** Wait 15 minutes or restart server to reset rate limits
4. **Environment Variables:** Ensure all required .env variables are set
