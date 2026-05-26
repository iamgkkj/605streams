# 605streams - New Features & Technical Redesign Documentation

This document describes all the new features, architecture improvements, secure credential preloading configurations, and resilience mechanics implemented in the `new` branch of 605streams.

---

## 1. Unified Movies & TV Shows Filter
Previously, 605streams had redundant movie/tv filter selectors: one under the search input for search queries, and one under the trending headers for trending shelves. This caused UI confusion and a fragmented experience.

### Implementation:
- **Unified Master Toggle**: Removed the redundant tabs inside `.trending-section` in `index.html`.
- **Integrated Events**: Upgraded the main `.search-type-toggle` filter at the top of the landing page to control the entire page's content type.
- **Dynamic Shelf Re-populating**: When a user clicks **"TV Shows"** or **"Movies"** on the master toggle:
  - It dynamically updates `currentSearchType`.
  - It updates the search bar's placeholder text.
  - It automatically triggers `loadTrending()` to immediately refresh the "Trending Now" shelves below with matching movies or TV show recommendations.
  - If there is already text inside the search bar, it automatically re-runs the search with the new filter scope.

---

## 2. Secure Private Credentials Preloading (`config.js`)
To allow the developer to leverage their own TMDb API key and Access Token securely without accidentally committing them to the open Git repository, we designed a zero-leak ES6 dynamic preloading engine.

### Implementation:
- **Git-Ignored Config File (`config.js`)**: Contains the developer's private `TMDB_API_KEY` and `TMDB_READ_TOKEN`.
- **Git-Safe Template (`config.js.example`)**: Added as a version-controlled example file showing how to structure the key file.
- **Strict Security Rules (`.gitignore`)**: Added `config.js` to `.gitignore` to guarantee local credentials can never be leaked.
- **Promise-Based Preloader (`search.js`)**: Restructured the key-loader using an ES6 Promise-based dynamic import chain:
  ```javascript
  import('./config.js')
    .then(config => {
      if (config.TMDB_API_KEY && config.TMDB_API_KEY.trim().length > 5) {
        activeKeys.unshift(config.TMDB_API_KEY.trim());
      }
    })
    .catch(e => { /* Graceful ignore */ });
  ```
  This eliminates parser-blocking top-level `await` statements entirely, restoring complete browser compilation compatibility and making the search button functional.

---

## 3. High-Fidelity TMDB Alternative `/images` Resolution Fallback
Standard search and recommendation lists may have missing or blocked poster images in restricted network sandboxes. We implemented a multi-stage loading lifecycle.

### Implementation:
- **Fallback Resolver (`getBackupImages` in `search.js`)**: Queries TMDB `/3/movie/{id}/images` or `/3/tv/{id}/images` to gather alternative backdrops and posters.
- **Image Lifecycle Preloader (`home.js`)**: Uses a resilient, asynchronous retry loop:
  - **Stage 1 (Primary)**: Tries loading the primary TMDB poster image.
  - **Stage 2 (Alternate Sizes/Proxy)**: Tries alternative resolution files and wraps them in a public proxy (`corsproxy.io`) to resolve mixed-content blocks.
  - **Stage 3 (TMDb /images Query)**: Dynamically fetches backup alternative posters and backdrops from TMDb, then retries the load.
  - **Stage 4 (Gradient Fallback)**: Generates a beautiful deterministic HSL gradient card based on the movie/show title only as a final backup.

---

## 4. Instant Offline Fast-Fallback Guard
To prevent slow key-rotation loops from hanging the UI when completely offline or firewalled inside sandboxed environments.

### Implementation:
- **Offline Cache State (`isTmdOffline`)**: Tracks API socket availability.
- **Fast-Fail Execution**: If the initial key fetch fails instantly with a network block error (e.g. `TypeError: Failed to fetch`), it flags the API as offline and instantly skips all subsequent key rotation steps.
- **0ms Render Recovery**: Search and trending components fall back immediately to the local high-fidelity database (supporting instant, lag-free lookups for queries like *"Breaking Bad"*, *"Inception"*, and *"The Matrix"*).
