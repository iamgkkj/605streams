# 111Movies Personal Streaming Client (605streams)

A lightweight, zero-backend, high-performance web client designed to stream movies and TV shows from the 111Movies service. Built with premium glassmorphism visuals, smooth CSS layout animations, and secure iframe embedding.

---

## 🚀 Key Features

* **Premium Visuals**: Dark-mode interface featuring CSS ambient background glows and fluid transitions.
* **CORS-Free Architecture**: Bypasses browser connection policies and Cloudflare/NextJS exceptions by using direct iframe embedding from the working domain `https://111movies.com`.
* **Hybrid Playback Engine**:
  * **Embed Mode**: Renders standard movies and TV shows seamlessly using `https://111movies.com` frames with their high-fidelity native controls.
  * **Direct Mode**: Activates during manual manifest URL overrides (`.m3u8`, `.mp4`). Reveals a fully featured HTML5/Hls.js player, precision timeline bars, buffering statistics, volume mixers, and subtitle overlays.
* **Manual Subtitle Synchronizer**:
  * Parses `.srt` or `.vtt` files in pure JavaScript.
  * Real-time sync adjustment slider ($-10.0\text{s}$ to $+10.0\text{s}$) with $100\text{ms}$ precision.
  * Fully synced modified subtitle `.srt` file download.
  * *Note*: Subtitles are supported on manual direct video streams.

---

## 🛠️ Technical Stack

* **Structure & UI**: HTML5, Vanilla ES6 Modules (Zero bundlers, zero compilers, zero dependencies).
* **Styling & Effects**: CSS Grid/Flexbox, dynamic media queries, keyframe spinners, glassmorphism filters.
* **Playback Engine**: Secure iframe embeds and dynamic Hls.js components for manual streams.
* **Subtitle Engine**: Custom in-memory cue indexing and parsing.

---

## 📦 Installation & Setup

1. **Clone this repository**:
   ```bash
   git clone <repository-url>
   cd 605streams
   ```

2. **Open index.html**:
   * *Local Filesystem*: You can open `index.html` directly in a browser.
   * *Streaming Support*: To test manual streaming manifests and avoid origin protocol security constraints, it is highly recommended to serve the app locally:
     ```bash
     # Using Python 3
     python3 -m http.server 8080
     ```
     Then navigate to `http://localhost:8080` in your browser.

---

## 🍿 How To Use

1. **Streaming Movies**:
   * Select **Movie** content type.
   * Enter the movie's IMDb ID or TMDb numeric ID.
     * *Example (Deadpool)*: Enter `tt6263850` (or `293660`) and click **Load Stream**.
2. **Streaming TV Shows**:
   * Select **TV Show** content type (this will expand the Episode selector).
   * Enter the series ID and specify the Season and Episode numbers.
     * *Example (Breaking Bad)*: Enter `tt0903747`, set Season `1`, Episode `1`, and click **Load Stream**.
3. **Manual Stream Bypass**:
   * Expand the **Manual Override** section.
   * Paste any video URL (such as `.m3u8` playlists or `.mp4` video files).
   * Click **Apply Override** to load the stream directly in the high-fidelity native player. Use the **Subtitle Dashboard** to upload local VTT/SRT subtitles and adjust text timing instantly!

---

## ⌨️ Keyboard Shortcuts
*(Applicable during direct video playback)*

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Toggle Play / Pause |
| <kbd>F</kbd> | Toggle Fullscreen (video container) |
| <kbd>M</kbd> | Mute / Unmute audio |
| <kbd>←</kbd> / <kbd>→</kbd> | Seek Backwards / Forwards 10 seconds |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Increase / Decrease volume |

---

## 📐 Architecture & Modular Flow

The code is strictly partitioned to avoid clutter and maintain low load times:
1. **`app.js`**: App loader and bootstrap.
2. **`ui.js`**: DOM element connector, manual override panels, and loading displays.
3. **`api.js`**: Endpoint builder returning TV and Movie embed URLs on `https://111movies.com`.
4. **`player.js`**: Hybrid player engine managing iframes and Hls.js video assets.
5. **`subtitles.js`**: Subtitle timing offset shifts, text compiler, and SRT parser.

*For more details, see the complete [architecture.md](architecture.md) documentation.*