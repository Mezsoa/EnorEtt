# EnorEtt 🇸🇪

> Din svenska grammatikassistent - Your Swedish grammar helper

EnorEtt is a Chrome Extension that helps you instantly know whether to use "en" or "ett" before a Swedish noun. Perfect for Swedish learners, expats, students, and writers!

![EnorEtt Banner](https://via.placeholder.com/800x200/4A90E2/FFFFFF?text=EnorEtt+-+Swedish+Grammar+Helper)

## ✨ Features

- **🎯 Instant Lookup** - Check any Swedish noun in seconds
- **📚 1000+ Word Dictionary** - Comprehensive offline database
- **🎨 Beautiful UI** - Clean Scandinavian design
- **⚡ Offline-First** - Works without internet connection
- **🖱️ Context Menu** - Right-click any word to check
- **🔍 Smart Fallback** - Pattern-based detection for unknown words
- **⌨️ Keyboard Shortcut** - `Ctrl+Shift+E` (Windows) or `Cmd+Shift+E` (Mac)
- **🌐 API Ready** - Optional backend for extended features

## 🚀 Installation

### Install from Chrome Web Store

_(Coming soon - Extension under review)_

1. Visit the [Chrome Web Store](https://chrome.google.com/webstore)
2. Search for "EnorEtt"
3. Click "Add to Chrome"

### Install from Source (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/enorett.git
   cd enorett
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the extension**
   - Click "Load unpacked"
   - Select the `EnorEtt` folder
   - The extension icon should appear in your toolbar!

## 📖 Usage

### Method 1: Popup Interface

1. Click the EnorEtt icon in your toolbar
2. Type a Swedish noun (e.g., "bil", "hus", "bok")
3. Click "Kolla" or press Enter
4. See the result instantly! ✅

### Method 2: Context Menu

1. Select any Swedish word on a webpage
2. Right-click and choose "Kolla en/ett för [word]"
3. The popup opens with the result

### Method 3: Keyboard Shortcut

1. Press `Ctrl+Shift+E` (Windows) or `Cmd+Shift+E` (Mac)
2. Type your word and press Enter

## 🎨 Screenshots

| Popup Interface | Success Result | Pattern Detection |
|----------------|----------------|-------------------|
| ![Popup](https://via.placeholder.com/250x400/4A90E2/FFFFFF?text=Popup) | ![Success](https://via.placeholder.com/250x400/5CB85C/FFFFFF?text=Success) | ![Pattern](https://via.placeholder.com/250x400/F0AD4E/FFFFFF?text=Pattern) |

## 🏗️ Project Structure

```
EnorEtt/
├── popup/              # Extension popup UI
│   ├── popup.html      # Main UI structure
│   ├── popup.js        # UI logic
│   └── popup.css       # Scandinavian-style design
├── background/         # Service worker
│   └── background.js   # Context menu & messaging
├── content/            # Content scripts
│   └── content.js      # In-page functionality
├── utils/              # Shared utilities
│   ├── dictionary.js   # 1000+ Swedish nouns
│   └── lookup.js       # Lookup logic
├── icons/              # Extension icons
│   ├── icon-16.svg     # Toolbar icon
│   ├── icon-48.svg     # Extension page icon
│   └── icon-128.svg    # Store listing icon
├── api/                # Backend API (optional)
│   ├── server.js       # Express server
│   ├── routes/         # API routes
│   └── package.json    # API dependencies
├── manifest.json       # Extension configuration
└── README.md           # You are here!
```

## 🔧 Development

### Prerequisites

- Node.js 18+ (for API backend)
- Chrome browser
- Basic knowledge of JavaScript

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/yourusername/enorett.git
cd enorett

# No build step required for the extension!
# Just load it in Chrome as described above

# Optional: Set up API backend
cd api
npm install
npm run dev
```

### Making Changes

1. Edit files in the project
2. Go to `chrome://extensions/`
3. Click the refresh icon on the EnorEtt extension
4. Test your changes

### Testing Checklist

- [ ] Test known en-words (bil, bok, katt)
- [ ] Test known ett-words (hus, barn, bord)
- [ ] Test unknown words (fallback logic)
- [ ] Test context menu functionality
- [ ] Test keyboard shortcut
- [ ] Test with empty input
- [ ] Test with multiple words
- [ ] Test with special characters

## 📦 Publishing to Chrome Web Store

1. **Prepare for publication**
   - Update version in `manifest.json`
   - Test thoroughly in Chrome
   - Prepare screenshots and promotional images
   - Write compelling store description

2. **Create ZIP file**
   ```bash
   # Exclude unnecessary files
   zip -r enorett-v1.0.0.zip . -x "*.git*" "node_modules/*" "api/*" "*.md" "*.DS_Store"
   ```

3. **Submit to Chrome Web Store**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay one-time $5 developer fee (if first time)
   - Click "New Item"
   - Upload ZIP file
   - Fill in store listing details
   - Submit for review (usually 1-3 days)

## 🌟 Roadmap

### v1.0 - MVP ✅
- [x] Core extension with 1000-word dictionary
- [x] Popup interface
- [x] Context menu integration
- [x] Pattern-based fallback
- [x] Offline functionality

### v1.1 - Enhanced UX (Q1 2025)
- [ ] User contributions (suggest new words)
- [ ] Favorites/history feature
- [ ] Dark mode support
- [ ] Multiple language support (UI in English/Swedish)

### v1.5 - API Integration (Q2 2025)
- [ ] Online API with 10,000+ words
- [ ] AI-powered explanations
- [ ] Example sentences
- [ ] Pronunciation guide

### v2.0 - Smart Features (Q3 2025)
- [ ] Phrase checker (not just words)
- [ ] Grammar suggestions
- [ ] Learning mode with quizzes
- [ ] Browser sync across devices

### v3.0 - Platform Expansion (Q4 2025)
- [ ] Firefox extension
- [ ] Edge extension
- [ ] Google Docs integration
- [ ] Notion plugin
- [ ] Mobile app (iOS/Android)

## 💡 How It Works

1. **Dictionary Lookup** - First checks against local database of 1000+ words
2. **Pattern Detection** - Uses Swedish grammar rules (suffixes like -het, -ing, -ium)
3. **Confidence Rating** - Shows how confident the result is (High/Medium/Low)
4. **API Fallback** _(Optional)_ - Queries backend for unknown words

### Example Pattern Rules

**En-words often end in:**
- `-are` (lärare, författare)
- `-ing` (tidning, övning)
- `-het` (möjlighet, säkerhet)
- `-tion` (station, nation)

**Ett-words often end in:**
- `-ium` (museum, aquarium)
- `-ande` (boende, levande)
- `-ment` (moment, argument)
- `-o` (foto, piano)

## 🤝 Contributing

We welcome contributions! Here's how you can help:

- **Add more words** to the dictionary
- **Report bugs** via GitHub Issues
- **Suggest features** we should add
- **Improve translations** and UI text
- **Share with friends** learning Swedish!

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 💖 Support

If you find EnorEtt helpful:

- ⭐ Star this repository
- 🐦 Share on social media
- ☕ [Buy us a coffee](https://buymeacoffee.com/enorett)
- 💬 Leave a review on Chrome Web Store

## 📧 Contact

- **Website:** [enorett.se](https://enorett.se) _(coming soon)_
- **Email:** hello@enorett.se
- **Twitter:** [@EnorEttApp](https://twitter.com/enorettapp)
- **GitHub Issues:** [Report bugs](https://github.com/yourusername/enorett/issues)

## 🙏 Acknowledgments

- Swedish language resources from [Svenska Akademien](https://www.svenskaakademien.se/)
- Icon design inspired by Scandinavian minimalism
- Built with ❤️ for Swedish learners worldwide

---

**Made in Sweden 🇸🇪** | [Privacy Policy](PRIVACY.md) | [Terms of Service](TERMS.md)

# EnorEtt
