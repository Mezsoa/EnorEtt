# Extension Package Preparation Guide

## Manifest.json Verification

Your `manifest.json` has been reviewed and is compliant with Chrome Web Store requirements:

✅ **Verified Fields:**
- `manifest_version: 3` (latest version)
- `version: "1.0.0"` (semantic versioning)
- `name: "EnorEtt"` (within 45 character limit)
- `description` (within 132 character limit)
- Icons defined for all required sizes (16, 48, 128)
- Permissions are minimal and justified
- Content Security Policy is properly configured

⚠️ **Note:** Your `homepage_url` currently points to a placeholder GitHub URL. Update this before submission if you have a real homepage, or remove it if you don't have one yet.

## Creating the ZIP Package

### Files to INCLUDE:
- `manifest.json`
- `popup/` (entire directory)
- `background/` (entire directory)
- `content/` (entire directory)
- `utils/` (entire directory)
- `icons/` (entire directory)

### Files to EXCLUDE:
- `api/` (backend code, not needed for extension)
- `*.md` (documentation files)
- `landing.html` (not part of extension)
- `.git/` (version control)
- `node_modules/` (if any)
- `.DS_Store` (macOS system files)
- Any existing ZIP files

### Command to Create ZIP:

Run this command from your project root directory:

```bash
cd "/Users/johngunnarsson/Programs/Freelance/EnorEtt copy"
zip -r enorett-v1.0.0.zip . \
  -x "*.git*" \
  -x "node_modules/*" \
  -x "api/*" \
  -x "*.md" \
  -x "*.DS_Store" \
  -x "landing.html" \
  -x "enorett-*.zip"
```

### Alternative: Manual ZIP Creation

1. Create a new folder called `enorett-extension`
2. Copy these folders/files into it:
   - `manifest.json`
   - `popup/`
   - `background/`
   - `content/`
   - `utils/`
   - `icons/`
3. Right-click the folder and select "Compress" (macOS) or use a ZIP tool
4. Rename the ZIP to `enorett-v1.0.0.zip`

### Verification Checklist

Before uploading, verify:
- [ ] ZIP file size is reasonable (< 5MB typically)
- [ ] `manifest.json` is in the root of the ZIP
- [ ] All icon files exist and are accessible
- [ ] No unnecessary files included
- [ ] Extension can be loaded as "unpacked" in Chrome for testing

### Testing the Package

1. Extract the ZIP to a temporary folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extracted folder
6. Verify the extension loads without errors
7. Test all functionality

