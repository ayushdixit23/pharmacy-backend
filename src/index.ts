import express from "express";
import { NODE_ENV, PORT } from "./utils/envConfig.js";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { errorMiddleware } from "./middlewares/errors/errorMiddleware.js";
import { CustomError } from "./middlewares/errors/CustomError.js";
import { rateLimit } from "express-rate-limit";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import userManagementRoutes from "./routes/userManagement.js";
import roleBasedAPIRoutes from "./routes/roleBasedAPI.js";
import productRoutes from './routes/products.js';
import supplierRoutes from './routes/suppliers.js';
import batchRoutes from './routes/batches.js';
import barcodeRoutes from './routes/barcode.js';
import alertRoutes from './routes/alerts.js';
import inventoryRoutes from './routes/inventory.js';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 400,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Allowed origins for CORS
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://your-production-domain.com",
];

// Initialize Express app
const app = express();

// Middlewares
app.use(helmet()); // Security headers
app.use(limiter); // Rate limiting middleware

// Logging based on environment (development/production)
const logFormat = NODE_ENV === "development" ? "dev" : "combined";
app.use(morgan(logFormat));

// Compression middleware
app.use(compression());

// CORS configuration (must come before Better Auth)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed HTTP methods including OPTIONS
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"], // Allowed headers
    credentials: true, // Allow cookies to be sent
  })
);

app.all("/api/auth/{*splat}", toNodeHandler(auth));

// Body parsing middleware
app.use(express.json());

// Routes
app.get("/", (_, res) => {
  res.send("Server is running!");
});

app.get("/api/data", (_, res) => {
  // Send data from the server
  res.status(200).json({ message: "Data from the server" });
});

app.get("/api/error", (_, res) => {
  // throw your custom error like this
  throw new CustomError("This is a custom error", 400);
});

// Get user session
app.get("/api/me", async (req: any, res: any) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    return res.json(session);
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
});

app.use("/api/users", userManagementRoutes);

// Role-based API routes
app.use("/api/pharmacy", roleBasedAPIRoutes);

// Test route for products
app.get("/api/products/test", (req, res) => {
  res.json({ message: "Products test route working" });
});

app.use("/api/products", productRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/barcode", barcodeRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/inventory", inventoryRoutes);

// 404 Handler for non-existent routes (must come after routes)
app.use((_, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error Handling Middleware (must come after routes and 404 handler)
app.use(errorMiddleware);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
