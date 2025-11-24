# Chrome Web Store Submission Guide

Complete step-by-step instructions for publishing EnorEtt to the Chrome Web Store.

## Prerequisites Checklist

Before starting, ensure you have:
- [ ] Extension ZIP file ready (`enorett-v1.0.0.zip`)
- [ ] At least 1 screenshot (1280x800px) - see `ASSET_GUIDE.md`
- [ ] Privacy policy published online (see Privacy Policy section below)
- [ ] Support email address ready (hello@enorett.se)
- [ ] Google account for Chrome Web Store Developer access

## Step 1: Create Chrome Web Store Developer Account

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Sign in with your Google account
3. If this is your first time:
   - Click "Pay Registration Fee" ($5 one-time payment)
   - Complete payment via Google Pay
   - Accept the Developer Agreement
4. You'll be redirected to the Developer Dashboard

## Step 2: Publish Privacy Policy Online

**You MUST have a publicly accessible privacy policy URL before submission.**

### Option A: GitHub Pages (Recommended - Free)

1. Create a GitHub repository (if you don't have one)
2. Upload your `PRIVACY.md` file to the repository
3. Enable GitHub Pages:
   - Go to repository Settings → Pages
   - Select source branch (usually `main`)
   - Save
4. Your privacy policy URL will be: `https://[username].github.io/[repo-name]/PRIVACY.md`
   - Or create `privacy-policy.html` for a cleaner URL: `https://[username].github.io/[repo-name]/privacy-policy.html`

### Option B: Your Own Website

1. Upload `PRIVACY.md` or convert to HTML
2. Place it at: `https://yourdomain.com/privacy-policy.html`
3. Ensure it's publicly accessible

### Option C: Free Hosting Services

- **Netlify Drop**: Drag and drop HTML file
- **Vercel**: Connect GitHub repo
- **GitHub Gist**: For simple text version

**Note:** Write down your privacy policy URL - you'll need it in Step 4.

## Step 3: Upload Extension Package

1. In Chrome Web Store Developer Dashboard, click **"New Item"**
2. Click **"Choose File"** and select `enorett-v1.0.0.zip`
3. Click **"Upload"**
4. Wait for upload to complete (may take a minute)
5. If there are any errors, fix them and re-upload

## Step 4: Fill in Store Listing Information

### Basic Information Tab

**Name:**
```
EnorEtt - Swedish Grammar Helper
```
(34 characters - within 45 limit)

**Summary (Short Description):**
```
Instantly check if a Swedish word takes "en" or "ett". Perfect for learners, expats, and students. Works offline!
```
(128 characters - within 132 limit)

**Description (Detailed):**
Copy the entire detailed description from `CHROME_STORE.md` (lines 23-142), or use this:

```
🇸🇪 STOP GUESSING EN OR ETT IN SWEDISH

EnorEtt is your instant Swedish grammar assistant. Never wonder "en bil eller ett bil?" again. 
Get accurate answers in under a second, right where you're working.

✨ KEY FEATURES

• INSTANT LOOKUP - Check any Swedish noun in under 1 second
• 1000+ WORDS - Comprehensive offline dictionary
• CONTEXT MENU - Right-click any word on any website
• OFFLINE-FIRST - Works without internet connection
• PATTERN LEARNING - Understand why words take en/ett
• BEAUTIFUL DESIGN - Clean Scandinavian interface
• KEYBOARD SHORTCUT - Quick access with Ctrl+Shift+E
• COMPLETELY FREE - No ads, no tracking, forever

🎯 PERFECT FOR

• Swedish language students and learners
• Expats living in Sweden
• SFI (Swedish for Immigrants) students
• Content creators writing in Swedish
• Translators and copywriters
• Swedish language teachers
• Anyone learning or using Swedish

💡 HOW IT WORKS

1. Click the EnorEtt icon or use keyboard shortcut
2. Type a Swedish noun (like "bil", "hus", "bok")
3. Get instant answer with confidence rating
4. Optional: See pattern explanations to learn the rules

OR: Right-click any word on a webpage and select "Kolla en/ett"

📚 SMART FEATURES

• Dictionary-based lookup for 1000+ common words
• Pattern detection for unknown words (suffixes like -het, -ing, -ium)
• Confidence ratings (High/Medium/Low)
• Translation included for learning context
• History of recent lookups
• Works completely offline

🎨 BEAUTIFUL DESIGN

Inspired by Scandinavian minimalism, EnorEtt features:
• Clean, uncluttered interface
• Soothing blue and teal color scheme
• Smooth animations
• Thoughtful micro-interactions
• Responsive and fast

🔒 PRIVACY FIRST

• No data collection
• No tracking
• No ads
• All processing happens locally on your device
• Your lookups stay private

🆓 FREE FOREVER

We believe learning Swedish shouldn't cost money. EnorEtt's core features 
will always be free. Optional Pro features support development and unlock 
advanced capabilities like API access and 10,000+ word dictionary.

🌟 WHY ENORETT?

Swedish grammatical gender is one of the hardest parts of learning the language. 
There's no clear rule for when to use "en" vs "ett" - you just have to memorize 
each word. Traditional dictionaries are slow and break your workflow.

EnorEtt solves this by putting the answer right where you need it, instantly.

Made in Sweden 🇸🇪 by Swedish learners, for Swedish learners.

📖 LEARNING RESOURCES

EnorEtt doesn't just tell you the answer - it helps you learn. Pattern 
explanations teach you common rules like:

• Words ending in -het, -ing, -tion are usually "en" words
• Words ending in -ium, -ande, -ment are usually "ett" words
• And many more helpful patterns!

🚀 WHAT'S NEXT

We're constantly improving EnorEtt based on user feedback. Upcoming features:
• Expanded dictionary (10,000+ words)
• Example sentences
• Pronunciation audio
• Firefox and Edge versions
• Mobile apps
• And much more!

💬 SUPPORT & FEEDBACK

We love hearing from our users! 

• Questions: hello@enorett.se
• Bugs: Report via GitHub
• Feature requests: Leave a review or email us

⭐ IF YOU LIKE ENORETT

• Leave a 5-star review
• Share with other Swedish learners
• Follow us on social media @EnorEttApp

Lycka till med svenskan! (Good luck with Swedish!)
```

**Category:**
- Primary: **Productivity**
- You can also select: Education

**Language:**
- Select **English** (and Swedish if you want)

### Privacy Tab

**Privacy Policy URL:**
```
[Enter your privacy policy URL from Step 2]
```
Example: `https://yourusername.github.io/enorett/PRIVACY.md`

**Single Purpose Description:**
```
EnorEtt helps users instantly determine whether Swedish nouns take "en" or "ett" articles. The extension provides quick lookups through a popup interface and context menu, with an offline dictionary and pattern-based detection for unknown words.
```

**Permissions Justification:**
Copy this text (from `CHROME_STORE.md` lines 308-326):

```
PERMISSIONS REQUESTED:

1. "storage"
   Purpose: Save user preferences, lookup history, and favorites locally
   Justification: Provides better user experience with persistent settings
   
2. "contextMenus"
   Purpose: Add "Check En/Ett" option when right-clicking selected text
   Justification: Core feature for quick word checking without opening popup

We do NOT request:
• <all_urls> access (content scripts are optional)
• Tabs permission
• History access
• Any other invasive permissions

Our extension prioritizes user privacy and minimal permissions.
```

### Store Listing Tab

**Support URL (Optional):**
```
https://github.com/yourusername/enorett
```
(Or your website if you have one)

**Support Email:**
```
hello@enorett.se
```

**Homepage URL (Optional):**
```
https://github.com/yourusername/enorett
```
(Or your website)

### Graphics Tab

**Screenshots:**
1. Click "Choose File" for each screenshot
2. Upload at least 1 screenshot (1280x800px recommended)
3. Upload up to 5 screenshots total
4. Add titles for each screenshot (see `ASSET_GUIDE.md` for titles)

**Small Promo Tile (Optional):**
- Upload 440x280px image if you created one

**Marquee Promo Tile (Optional):**
- Upload 1400x560px image if you created one

**Icon:**
- Your 128x128 icon should be automatically extracted from the ZIP
- Verify it looks correct

## Step 5: Review and Submit

1. **Review all tabs** to ensure information is complete:
   - [ ] Basic Information filled
   - [ ] Privacy tab completed
   - [ ] Store Listing tab completed
   - [ ] At least 1 screenshot uploaded
   - [ ] Privacy policy URL is accessible

2. **Click "Submit for Review"** button

3. **Select Distribution:**
   - **Unlisted** (recommended for first submission) - Only accessible via direct link
   - **Public** - Visible in Chrome Web Store search

4. **Confirm submission**

## Step 6: Wait for Review

- **Review Time:** Typically 1-3 business days
- **Status:** Check Developer Dashboard for updates
- **Email Notifications:** You'll receive emails about status changes

### Possible Review Outcomes:

**✅ Approved:**
- Extension goes live immediately (if Public) or becomes accessible via link (if Unlisted)
- You'll receive an email confirmation

**⚠️ Needs Changes:**
- Review team will provide feedback
- Make requested changes
- Resubmit the updated ZIP

**❌ Rejected:**
- Review team will explain why
- Fix issues and resubmit

## Step 7: Post-Launch

Once approved:

1. **Share your extension:**
   - Get the store link from Developer Dashboard
   - Share on social media, forums, etc.

2. **Monitor reviews:**
   - Respond to user feedback
   - Address bug reports quickly

3. **Update as needed:**
   - Fix bugs
   - Add features
   - Update version number in `manifest.json`
   - Upload new ZIP for updates

## Troubleshooting

### Common Issues:

**"Invalid ZIP file"**
- Ensure ZIP contains `manifest.json` in root
- Check that all required files are included
- Recreate ZIP if needed

**"Privacy policy URL not accessible"**
- Verify URL is publicly accessible
- Check that URL doesn't require authentication
- Test URL in incognito window

**"Screenshot size incorrect"**
- Resize to exactly 1280x800px or 640x400px
- Use image editing software

**"Permissions not justified"**
- Ensure you filled out the Permissions Justification field
- Be specific about why each permission is needed

## Quick Reference Checklist

Before clicking "Submit for Review":

- [ ] ZIP file uploaded successfully
- [ ] Name and description filled in
- [ ] Privacy policy URL is live and accessible
- [ ] At least 1 screenshot uploaded
- [ ] Support email provided
- [ ] Permissions justification completed
- [ ] Single purpose description filled
- [ ] All required fields completed
- [ ] Extension tested locally and works correctly

## Need Help?

- **Chrome Web Store Help:** [support.google.com/chrome_webstore](https://support.google.com/chrome_webstore)
- **Developer Forum:** [groups.google.com/a/chromium.org/forum/#!forum/chromium-extensions](https://groups.google.com/a/chromium.org/forum/#!forum/chromium-extensions)
- **Your Support Email:** hello@enorett.se

Good luck with your submission! 🚀

