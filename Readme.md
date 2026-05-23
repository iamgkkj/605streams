# 111Movies Personal Streaming Client (605streams)

A lightweight, zero-backend, high-performance web client designed to stream movies and TV shows from the 111Movies service. Built with premium glassmorphism visuals, smooth CSS layout animations, and manual subtitle synchronization shifting.

---

## 🚀 Key Features

* **Premium Visuals**: Dark-mode interface featuring CSS ambient background glows and fluid transitions.
* **Smart Stream Loading**: Seamlessly parses TMDb (numeric) and IMDb (`tt...`) IDs, fetching direct streams from the API.
* **Custom Video Player**: Custom-built HTML5 controls including giant playback activity indicators, precision volume bars, timeline buffering, and mouse-inactivity fading.
* **Adaptive HLS.js Integration**: Automates live HLS playlist decoding (`.m3u8`) with native fallback (e.g., Safari, iOS).
* **Manual Subtitle Synchronizer**:
  * Parses `.srt` or `.vtt` files in pure JavaScript.
  * Real-time sync adjustment slider ($-10.0\text{s}$ to $+10.0\text{s}$) with $100\text{ms}$ precision.
  * Fully synced modified subtitle `.srt` file download.

---

## 🛠️ Technical Stack

* **Structure & UI**: HTML5, Vanilla ES6 Modules (Zero bundlers, zero compilers, zero dependencies).
* **Styling & Effects**: CSS Grid/Flexbox, dynamic media queries, keyframe spinners, glassmorphism filters.
* **Playback Engine**: Standard HTML5 Media elements, `Hls.js` CDN.
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
   * *Streaming Support*: Due to browser security and CORS policies on local files (`file:///`), modern browsers block external HLS streams (`.m3u8`). **It is highly recommended to serve the app locally**:
     ```bash
     # Using Node.js (npx)
     npx http-server -p 8080
     
     # Or using Python 3
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
     * *Example (TV Show)*: Enter `240411` (or `tt30217403`), set Season `1`, Episode `5`, and click **Load Stream**.
3. **Synchronizing Subtitles**:
   * Drag and drop any `.srt` or `.vtt` file onto the dashed **Subtitle Dashboard** drop-zone.
   * Use the **Sync Shift** slider or the incremental quick buttons (`-1.0s`, `-0.1s`, `+0.1s`, `+1.0s`) to adjust text synchronization.
   * Toggle subtitle visibility on/off using the switch.
   * If you've adjusted the timing, click **Download Sync'd Subtitles** to export your customized `.srt` file.

---

## ⌨️ Keyboard Shortcuts

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
2. **`ui.js`**: DOM element connector, custom video controls, and layout.
3. **`api.js`**: Endpoint communication with 111movies.net.
4. **`player.js`**: Video playback engine and Hls.js buffer.
5. **`subtitles.js`**: Subtitle timing offset shifts, text compiler, and SRT parser.

*For more details, see the complete [architecture.md](architecture.md) documentation.*