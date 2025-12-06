/**
 * EnorEtt API Server
 * Express backend for Swedish grammar checking
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import enorEttRouter from './routes/enorett.js';
import subscriptionRouter from './routes/subscription.js';
import usersRouter from './routes/users.js';
import { connectDB } from './db/connection.js';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// MIDDLEWARE
// ============================================

// Security headers with CSP that allows inline scripts for upgrade page
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or Chrome extensions)
    if (!origin) return callback(null, true);
    
    // Allow Chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow configured origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'https://enorett.se',
      'https://www.enorett.se',
      'https://api.enorett.se',
      'http://localhost:3000'
    ];
    
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now, tighten in production
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    errorSv: 'För många förfrågningar, försök igen senare.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to API routes
app.use('/api/', limiter);

// Request logging (development)
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.query);
    next();
  });
}

// ============================================
// ROUTES
// ============================================

// Serve homepage at root route
app.get('/', async (req, res) => {
  try {
    // Path to homepage.html (in same directory as server.js)
    const homepagePath = join(__dirname, 'homepage.html');
    const homepageHtml = await readFile(homepagePath, 'utf-8');
    
    // Set CSP header that allows Tailwind CDN and inline scripts
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; " +
      "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
      "font-src 'self' data:; " +
      "img-src 'self' data: https:;"
    );
    res.send(homepageHtml);
  } catch (error) {
    console.error('Error serving homepage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load homepage',
      errorSv: 'Kunde inte ladda startsidan',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'EnorEtt API',
    version: '1.0.0',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/enorett', enorEttRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/users', usersRouter);

// Serve upgrade/landing page
app.get('/upgrade', async (req, res) => {
  try {
    // Path to landing.html (in same directory as server.js)
    const landingPath = join(__dirname, 'landing.html');
    const landingHtml = await readFile(landingPath, 'utf-8');
    
    // Set CSP header that allows Tailwind CDN and inline scripts
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; " +
      "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
      "font-src 'self' data:; " +
      "img-src 'self' data: https:;"
    );
    res.send(landingHtml);
  } catch (error) {
    console.error('Error serving landing page:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load upgrade page',
      errorSv: 'Kunde inte ladda uppgraderingssidan',
      details: error.message
    });
  }
});

// Serve privacy.jpg image
app.get('/privacy.jpg', async (req, res) => {
  try {
    const imagePath = join(__dirname, 'privacy.jpg');
    const imageBuffer = await readFile(imagePath);
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error serving privacy image:', error);
    res.status(404).json({
      success: false,
      error: 'Image not found',
      errorSv: 'Bild hittades inte'
    });
  }
});

// Fallback HTML for privacy policy if file cannot be read
const fallbackPrivacyHTML = `<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - EnorEtt</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        h1 { color: #4562e3; }
        h2 { color: #764ba2; margin-top: 30px; }
    </style>
</head>
<body>
    <h1>Privacy Policy - EnorEtt Chrome Extension</h1>
    <p><strong>Last Updated:</strong> December 6, 2025</p>
    
    <h2>Overview</h2>
    <p>EnorEtt respects your privacy. We collect personal data only when you upgrade to Pro.</p>
    
    <h2>Data Collection</h2>
    <p><strong>Free Users:</strong> No data is collected. All data remains local on your device.</p>
    <p><strong>Pro Users:</strong> We collect User ID, email address, word lookup data, usage statistics, and subscription information.</p>
    
    <h2>Local Storage</h2>
    <p>EnorEtt stores word lookup history, favorite words, and settings locally on your device only.</p>
    
    <h2>Contact</h2>
    <p>Questions about privacy: <a href="mailto:johnmessoa@gmail.com">johnmessoa@gmail.com</a></p>
    
    <p>For the complete privacy policy, please visit: <a href="https://enorett.se/privacy">https://enorett.se/privacy</a></p>
</body>
</html>`;

// Serve privacy policy page - ALWAYS returns HTML, even on error
app.get('/privacy', async (req, res) => {
  // Always set HTML headers first
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
    "font-src 'self' data:; " +
    "img-src 'self' data: https:;"
  );
  
  try {
    // Path to privacy.html (in same directory as server.js)
    const privacyPath = join(__dirname, 'privacy.html');
    const privacyHtml = await readFile(privacyPath, 'utf-8');
    res.send(privacyHtml);
  } catch (error) {
    console.error('Error serving privacy policy:', error);
    // Return fallback HTML instead of JSON - Chrome Web Store requires HTML
    res.status(200).send(fallbackPrivacyHTML);
  }
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    errorSv: 'Endpoint hittades inte',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    errorSv: 'Ett serverfel uppstod',
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// START SERVER
// ============================================

// Connect to database
connectDB().catch((error) => {
  console.error('Failed to connect to database:', error);
  // Don't exit - allow server to run without database
});

// Only start server if not in Vercel serverless environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, async () => {
    console.log('=================================');
    console.log('🇸🇪  EnorEtt API Server');
    console.log('=================================');
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Port: ${PORT}`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log('=================================');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
  });
}

// Export for Vercel serverless functions
export default app;

