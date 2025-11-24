# EnorEtt API

Backend API for the EnorEtt Swedish grammar assistant Chrome Extension.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
cd api
npm install
```

### Configuration

Create a `.env` file in the `api` directory:

```env
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=chrome-extension://*,http://localhost:3000
```

### Run Development Server

```bash
npm run dev
```

### Run Production Server

```bash
npm start
```

The API will be available at `http://localhost:3000`

## 📚 API Endpoints

### Health Check

**GET** `/`
```json
{
  "success": true,
  "service": "EnorEtt API",
  "version": "1.0.0",
  "status": "healthy"
}
```

### Check Word

**GET** `/api/enorett?word={word}`

Check if a Swedish word takes "en" or "ett".

**Parameters:**
- `word` (string, required) - The Swedish noun to check

**Example:**
```bash
curl "http://localhost:3000/api/enorett?word=bil"
```

**Success Response:**
```json
{
  "success": true,
  "word": "bil",
  "article": "en",
  "translation": "car",
  "confidence": "high",
  "source": "dictionary",
  "explanation": "Från ordbok: bil = car"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "word": "unknown",
  "error": "Word not found",
  "errorSv": "Ordet finns inte i ordboken",
  "suggestion": "Statistiskt sett är ~70% av svenska ord 'en-ord'",
  "confidence": "none"
}
```

### Batch Lookup

**POST** `/api/enorett/batch`

Look up multiple words at once (max 50).

**Request Body:**
```json
{
  "words": ["bil", "hus", "bok", "barn"]
}
```

**Response:**
```json
{
  "success": true,
  "count": 4,
  "results": [
    {
      "word": "bil",
      "article": "en",
      "translation": "car",
      "confidence": "high"
    },
    {
      "word": "hus",
      "article": "ett",
      "translation": "house",
      "confidence": "high"
    }
  ]
}
```

### Statistics

**GET** `/api/enorett/stats`

Get dictionary statistics.

**Response:**
```json
{
  "success": true,
  "total": 1000,
  "en": 700,
  "ett": 300,
  "enPercentage": "70.0",
  "ettPercentage": "30.0"
}
```

## 🔐 Security

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing configuration
- **Rate Limiting** - 100 requests per 15 minutes per IP
- **Input Validation** - All inputs are validated and sanitized

## 📊 Rate Limits

- **Default:** 100 requests per 15 minutes per IP
- **Batch endpoint:** Max 50 words per request

## 🚢 Deployment

### Deploy to Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create enorett-api

# Deploy
git subtree push --prefix api heroku main

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set ALLOWED_ORIGINS=chrome-extension://*,https://enorett.se
```

### Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

## 🔮 Future Enhancements

- [ ] PostgreSQL database integration
- [ ] AI-powered word analysis (OpenAI/Claude)
- [ ] User authentication for Pro features
- [ ] Expanded dictionary (10,000+ words)
- [ ] Phrase and sentence analysis
- [ ] Analytics and usage tracking
- [ ] WebSocket support for real-time updates
- [ ] GraphQL API option

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please see CONTRIBUTING.md for guidelines.

## 📧 Contact

For API issues or questions, please contact: api@enorett.se

