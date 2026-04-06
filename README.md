# StreamTV - Modern IPTV Web Application

A sleek, Smart TV-style IPTV streaming application with a dark theme and smooth interactions.

## Features

- **JSON API Channel Fetch**: Uses official IPTV-org API (https://iptv-org.github.io/api/channels.json)
- **Category System**: Auto-categorizes channels from API data
- **Smart Search**: Real-time channel search
- **Favorites System**: Save favorite channels locally (localStorage)
- **HLS Streaming**: Uses HLS.js for .m3u8 streams
- **TV-Style Navigation**: Keyboard shortcuts for remote-like control
- **Responsive Design**: Works on desktop and large screens
- **Error Handling**: Graceful handling of broken streams with retry option

## Quick Start

### Option 1: Direct Browser (Simplest)
1. Open `index.html` in a modern web browser (Chrome, Firefox, Edge, Safari)
2. The app will automatically fetch the playlist and load channels

### Option 2: Local Server (Recommended for some browsers)
If you encounter CORS issues:
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then open: `http://localhost:8000`

## Keyboard Shortcuts (when player is open)

| Key | Action |
|-----|--------|
| ← Shift + Arrows | Previous channel |
| → Shift + Arrows | Next channel |
| Space | Play/Pause |
| F | Toggle fullscreen |
| Escape | Close player |

## Technical Details

### Architecture
- **HTML5 + CSS3 + Vanilla JavaScript** (no build step required)
- **HLS.js** for adaptive streaming
- **LocalStorage** for favorites and preferences persistence

### Performance Optimizations
- Lazy loading with Intersection Observer
- Virtual-like pagination (200 channels per batch)
- Debounced search input
- Efficient DOM updates with document fragments
- Image error fallbacks

### Browser Compatibility
- Chrome 70+
- Firefox 65+
- Safari 11+
- Edge 79+
- Smart TVs with modern browsers (WebOS, Tizen, Android TV)

## File Structure

```
streamtv/
├── index.html    # Main HTML structure
├── styles.css    # All styles (dark theme, TV UI)
├── app.js        # Application logic
└── README.md     # This file
```

## Customization

### Change API source:
Edit `CONFIG.API_URL` in `app.js`

### Modify colors:
Edit CSS variables in `styles.css` under `:root`

### Adjust performance:
Change `MAX_CHANNELS_PER_LOAD` and `DEBOUNCE_DELAY` in `app.js`

## Notes

- Channel data is fetched from the official IPTV-org JSON API
- Some streams may be geographically restricted or offline
- No backend required - everything runs in the browser
- Favorites and last viewed channel are saved automatically
- The JSON API returns ~8000+ channels from the community-maintained database

## License

MIT License - Free to use and modify

---

Made with ❤️ for Smart TV enthusiasts
