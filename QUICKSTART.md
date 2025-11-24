# EnorEtt - Quick Start Guide

*Get up and running in 5 minutes*

---

## 🚀 Install Extension (Local Development)

### Step 1: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right corner)
3. Click "Load unpacked"
4. Select the `EnorEtt` folder
5. The EnorEtt icon should appear in your toolbar!

### Step 2: Test the Extension

Click the EnorEtt icon and try these words:
- `bil` → Should show "en bil ✅"
- `hus` → Should show "ett hus ✅"
- `bok` → Should show "en bok ✅"
- `barn` → Should show "ett barn ✅"

### Step 3: Test Context Menu

1. Go to any Swedish website (e.g., wikipedia.org/wiki/Sverige)
2. Select a Swedish word
3. Right-click and choose "Kolla en/ett för [word]"
4. The popup should open with the result!

---

## 🔧 Optional: Run API Backend

The extension works completely offline, but if you want to run the API:

### Step 1: Install Dependencies

```bash
cd api
npm install
```

### Step 2: Create Environment File

```bash
# Copy the example
cp .env.example .env

# Edit .env with your settings (optional)
nano .env
```

### Step 3: Start Server

```bash
npm run dev
```

The API will run at `http://localhost:3000`

### Step 4: Test API

```bash
# Check health
curl http://localhost:3000/health

# Look up a word
curl "http://localhost:3000/api/enorett?word=bil"

# Should return:
# {
#   "success": true,
#   "word": "bil",
#   "article": "en",
#   "translation": "car",
#   "confidence": "high"
# }
```

---

## 🧪 Testing Checklist

- [ ] Extension loads without errors
- [ ] Popup opens when clicking icon
- [ ] Search for known en-word (bil, bok, katt)
- [ ] Search for known ett-word (hus, barn, bord)
- [ ] Search for unknown word (triggers pattern detection)
- [ ] Context menu appears on right-click
- [ ] Context menu lookup works
- [ ] Keyboard shortcut works (Ctrl/Cmd+Shift+E)
- [ ] Extension works offline (disable WiFi and test)
- [ ] No console errors

---

## 🐛 Troubleshooting

### Extension doesn't load
- Make sure you're loading the ROOT folder (EnorEtt), not a subfolder
- Check Chrome DevTools console for errors
- Try reloading the extension from `chrome://extensions/`

### Popup is blank
- Open Chrome DevTools on the popup (right-click icon → Inspect)
- Check console for JavaScript errors
- Verify all files are present in correct folders

### Context menu doesn't appear
- Check that manifest.json has "contextMenus" permission
- Reload the extension
- Try on a different website

### API won't start
- Make sure you're in the `api` folder
- Check that Node.js 18+ is installed: `node --version`
- Install dependencies: `npm install`
- Check for port conflicts (change PORT in .env)

---

## 📁 Project Structure

```
EnorEtt/
├── popup/                  # Extension popup UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── background/             # Service worker
│   └── background.js
├── content/                # Content scripts
│   └── content.js
├── utils/                  # Shared utilities
│   ├── dictionary.js       # 1000+ Swedish nouns
│   └── lookup.js           # Lookup logic
├── icons/                  # Extension icons
│   ├── icon-16.svg
│   ├── icon-48.svg
│   └── icon-128.svg
├── api/                    # Backend API (optional)
│   ├── server.js
│   ├── routes/
│   ├── package.json
│   └── README.md
├── manifest.json           # Extension configuration
├── README.md               # Main documentation
├── BUSINESS_PLAN.md        # Go-to-market strategy
├── CHROME_STORE.md         # Store listing copy
├── SOCIAL_MEDIA.md         # Launch content
└── QUICKSTART.md           # This file!
```

---

## ⌨️ Keyboard Shortcuts

- **Open Popup:** `Ctrl+Shift+E` (Windows) or `Cmd+Shift+E` (Mac)
- **Clear Input:** `Esc` (when focused on input)
- **Check Word:** `Enter` (when in input field)

You can customize the shortcut:
1. Go to `chrome://extensions/shortcuts`
2. Find EnorEtt
3. Click the pencil icon to edit

---

## 🎨 Development Tips

### Hot Reload

Chrome extensions don't auto-reload. After making changes:
1. Go to `chrome://extensions/`
2. Click the refresh icon on EnorEtt
3. Close and reopen the popup to see changes

### Debugging Popup

Right-click the extension icon → "Inspect popup"

### Debugging Background Script

1. Go to `chrome://extensions/`
2. Find EnorEtt
3. Click "Inspect views: background page"

### Debugging Content Script

1. Open any webpage
2. Open Chrome DevTools (F12)
3. Content script logs appear in console

### Testing Offline

1. Open Chrome DevTools
2. Go to Network tab
3. Click "Offline" dropdown
4. Select "Offline"
5. Test extension functionality

---

## 📦 Building for Production

### Create Distribution ZIP

```bash
# From project root
zip -r enorett-v1.0.0.zip . \
  -x "*.git*" \
  -x "node_modules/*" \
  -x "api/*" \
  -x "*.md" \
  -x ".DS_Store" \
  -x "*.zip"
```

This creates a clean ZIP ready for Chrome Web Store upload.

### Pre-submission Checklist

- [ ] All features tested and working
- [ ] No console errors
- [ ] Icons display correctly (all sizes)
- [ ] Privacy policy added (if collecting data)
- [ ] Screenshots prepared (1280x800px)
- [ ] Store listing copy written
- [ ] Version number updated in manifest.json
- [ ] Code is clean and commented

---

## 🚢 Publishing to Chrome Web Store

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay $5 one-time developer fee (if first extension)
3. Click "New Item"
4. Upload your ZIP file
5. Fill in store listing:
   - Name, description, screenshots
   - Category: Productivity
   - Language: English + Swedish
6. Submit for review
7. Wait 1-3 days for approval

Detailed instructions in `CHROME_STORE.md`

---

## 🆘 Need Help?

- **Documentation:** Check `README.md`
- **API Docs:** See `api/README.md`
- **Business Strategy:** Read `BUSINESS_PLAN.md`
- **Launch Plan:** Review `SOCIAL_MEDIA.md`
- **Issues:** Create GitHub issue
- **Email:** hello@enorett.se

---

## 🎉 You're Ready!

The extension is now running locally. Next steps:

1. ✅ Test all features thoroughly
2. 📝 Read the business plan for launch strategy
3. 🎨 Customize colors/design if desired
4. 📦 Prepare for Chrome Web Store submission
5. 🚀 Launch and share with the world!

**Lycka till! (Good luck!)** 🇸🇪

