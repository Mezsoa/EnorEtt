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

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'EnorEtt API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
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
    
    // Set CSP header that allows inline scripts for this page
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', "script-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
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

// Serve privacy policy page
app.get('/privacy', async (req, res) => {
  try {
    // Path to PRIVACY.md (in parent directory)
    const privacyPath = join(__dirname, '..', 'PRIVACY.md');
    const privacyMarkdown = await readFile(privacyPath, 'utf-8');
    
    // Convert markdown to HTML (simple conversion)
    const privacyHtml = convertMarkdownToHtml(privacyMarkdown);
    
    // Set headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(privacyHtml);
  } catch (error) {
    console.error('Error serving privacy policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load privacy policy',
      errorSv: 'Kunde inte ladda integritetspolicyn',
      details: error.message
    });
  }
});

/**
 * Simple markdown to HTML converter for privacy policy
 */
function convertMarkdownToHtml(markdown) {
  let html = markdown;
  
  // Split into lines for processing
  const lines = html.split('\n');
  const processedLines = [];
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Headers
    if (line.startsWith('# ')) {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(`<h1>${line.substring(2)}</h1>`);
    } else if (line.startsWith('## ')) {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(`<h2>${line.substring(3)}</h2>`);
    } else if (line.startsWith('### ')) {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(`<h3>${line.substring(4)}</h3>`);
    } else if (line.startsWith('- ')) {
      // List item
      if (!inList) {
        processedLines.push('<ul>');
        inList = true;
      }
      processedLines.push(`<li>${line.substring(2)}</li>`);
    } else if (line === '---') {
      // Horizontal rule
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push('<hr>');
    } else if (line === '') {
      // Empty line - close list if open, add paragraph break
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push('');
    } else {
      // Regular paragraph
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      // Convert bold text
      let processedLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Convert email links
      processedLine = processedLine.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g, '<a href="mailto:$1">$1</a>');
      processedLines.push(`<p>${processedLine}</p>`);
    }
  }
  
  // Close any open list
  if (inList) {
    processedLines.push('</ul>');
  }
  
  // Join all lines
  html = processedLines.join('\n');
  
  // Wrap in proper HTML structure
  return `<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Integritetspolicy - EnorEtt</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #333;
        }
        h1 {
            color: #4562e3;
            border-bottom: 3px solid #4562e3;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        h2 {
            color: #764ba2;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        h3 {
            color: #555;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        ul {
            margin: 15px 0;
            padding-left: 30px;
        }
        li {
            margin: 8px 0;
        }
        p {
            margin: 15px 0;
        }
        strong {
            color: #4562e3;
        }
        hr {
            border: none;
            border-top: 1px solid #ddd;
            margin: 30px 0;
        }
        a {
            color: #4562e3;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    ${html}
</body>
</html>`;
}

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

