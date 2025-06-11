// CORS for frontend requests
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ["http://localhost:5173", "http://localhost:3000"];
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));