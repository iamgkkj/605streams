# API.md - 111Movies Endpoints

## Base Information
All endpoints return a **streamable video URL** (usually a `.m3u8` or direct `.mp4`) in the response body or via redirect. The frontend should use the response as the `src` of a video player.

## Endpoints

### Get Movie Stream
**Endpoint:** `https://111movies.net/movie/{id}`  
**Method:** GET  
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | IMDb ID (with `tt` prefix, e.g., `tt6263850`) OR TMDb numeric ID (e.g., `533535`) |

**Example Request:**

GET https://111movies.net/movie/tt6263850
**Example Response:** A direct URL to the video stream (e.g., `https://cdn.111movies.net/streams/tt6263850.m3u8`).

---

### Get TV Episode Stream
**Endpoint:** `https://111movies.net/tv/{id}/{season}/{episode}`  
**Method:** GET  
**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | IMDb or TMDb ID of the TV series |
| season | integer | Yes | Season number (e.g., `1`) |
| episode | integer | Yes | Episode number (e.g., `5`) |

**Example Request:**
GET https://111movies.net/tv/tt30217403/1/5


**Example Response:** A direct URL to the episode's video stream.

---

## Error Handling
- **404 Not Found:** Invalid ID or content not available.
- **400 Bad Request:** Missing parameters.
- **500 Internal Server Error:** API side issue – retry after a few seconds.

## Usage Notes
- The API does NOT require an API key for personal/low-load use.
- No CORS restrictions – can be called directly from frontend.
- The returned video stream may be HLS (`.m3u8`) – use a player like `hls.js` for compatibility.