# Setting up the MongoDB instance for development

**Backend `.env`:**
```env
MONGODB_URI=your_mongodb_connection_string
PORT=5001
CORS_ORIGIN=http://localhost:5173
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:5001/api
```

## Newsletter API

- `POST /api/newsletter/subscribe` - Subscribe with `{"email": "user@example.com"}`
- `GET /api/newsletter/subscriptions` - View all subscriptions

## Testing
```bash
# Test subscribe
curl -X POST http://localhost:5001/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# View subscriptions
curl http://localhost:5001/api/newsletter/subscriptions | jq
```

## MongoDB Setup

Contact Akrm Al-Hakimi for MongoDB configuration. You MUST be a certified board member of WSU's AWS Cloud Club. Outside collaborators will not receive production variables.

Without MongoDB configured, the newsletter signup will return a service unavailable error.
