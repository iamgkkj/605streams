/**
 * home.js - Home page logic for 605streams
 * Handles search typeaheads, trending grid display, and recently watched history navigation.
 */

import { searchContent, getTrending, getImageUrl, getBackupImages } from './search.js';

// DOM Elements
let searchInput = null;
let searchBtn = null;
let searchDropdown = null;
let trendingGrid = null;
let recentGrid = null;
let recentSection = null;

let currentSearchType = 'movie';
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('605streams Home Page initialized');
    
    // Resolve selectors
    searchInput = document.getElementById('home-search');
    searchBtn = document.getElementById('home-search-btn');
    searchDropdown = document.getElementById('search-dropdown');
    trendingGrid = document.getElementById('trending-grid');
    recentGrid = document.getElementById('recent-grid');
    recentSection = document.getElementById('recent-section');
    
    // 1. Bind search input and trigger actions
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }
    if (searchInput) {
        searchInput.addEventListener('input', onSearchInput);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
        
        // Hide dropdown if clicked outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
                searchDropdown.classList.add('hidden');
            }
        });
        
        // Refocus dropdown if search has content and is focused
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length >= 2) {
                searchDropdown.classList.remove('hidden');
            }
        });
    }
    
    // 2. Toggle Search Types (Movies vs TV)
    const toggleMovieBtn = document.getElementById('toggle-movie');
    const toggleTvBtn = document.getElementById('toggle-tv');
    
    if (toggleMovieBtn && toggleTvBtn) {
        toggleMovieBtn.addEventListener('click', () => {
            toggleMovieBtn.classList.add('active');
            toggleTvBtn.classList.remove('active');
            currentSearchType = 'movie';
            if (searchInput) searchInput.placeholder = 'Search for a movie...';
            triggerAutoSearch();
        });
        
        toggleTvBtn.addEventListener('click', () => {
            toggleTvBtn.classList.add('active');
            toggleMovieBtn.classList.remove('active');
            currentSearchType = 'tv';
            if (searchInput) searchInput.placeholder = 'Search for a TV show...';
            triggerAutoSearch();
        });
    }
    
    // 3. Advanced ID bypass link
    const advancedLink = document.getElementById('advanced-mode-link');
    if (advancedLink) {
        advancedLink.addEventListener('click', () => {
            localStorage.setItem('605streams_advanced_mode', 'true');
            window.location.href = 'player.html';
        });
    }
    
    // 4. Populate initial grids (Unified Search/Recommendations Filter)
    loadTrending(currentSearchType);
    loadRecentlyViewed();
});

function triggerAutoSearch() {
    const query = searchInput ? searchInput.value.trim() : '';
    if (query.length >= 2) {
        performSearch();
    } else {
        // If empty/cleared, automatically reload unified trending content
        loadTrending(currentSearchType);
        // Restore trending section header
        const sectionHeader = document.querySelector('.trending-section .section-header h2');
        if (sectionHeader) sectionHeader.innerHTML = '🔥 Trending Now';
    }
}

async function onSearchInput(e) {
    const query = e.target.value.trim();
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (query.length === 0) {
        searchDropdown.classList.add('hidden');
        
        // Restore trending section header
        const sectionHeader = document.querySelector('.trending-section .section-header h2');
        if (sectionHeader) sectionHeader.innerHTML = '🔥 Trending Now';
        
        // Load active trending category matching the unified filter type
        loadTrending(currentSearchType);
        return;
    }
    
    if (query.length < 2) {
        searchDropdown.classList.add('hidden');
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        try {
            const results = await searchContent(query, currentSearchType);
            renderSearchDropdown(results, currentSearchType);
        } catch (error) {
            console.error('Search input fetch error:', error);
        }
    }, 300);
}

function renderSearchDropdown(results, type) {
    if (!results || results.length === 0) {
        searchDropdown.innerHTML = '<div class="dropdown-item no-results">No results found</div>';
        searchDropdown.classList.remove('hidden');
        return;
    }
    
    const limited = results.slice(0, 6);
    searchDropdown.innerHTML = limited.map(item => {
        const title = type === 'movie' ? item.title : item.name;
        const dateKey = type === 'movie' ? item.release_date : item.first_air_date;
        const year = dateKey ? dateKey.split('-')[0] : 'N/A';
        const poster = item.poster_path ? getImageUrl(item.poster_path, 'w92') : null;
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        
        return `
            <div class="dropdown-item" 
                 data-id="${item.id}" 
                 data-type="${type}" 
                 data-title="${escapeHtml(title)}" 
                 data-year="${year}" 
                 data-rating="${rating}"
                 data-poster="${item.poster_path || ''}">
                ${poster ? `<img data-src="${poster}" data-id="${item.id}" data-type="${type}" alt="${escapeHtml(title)}" class="loading" style="display:none;">` : '<div class="dropdown-poster-placeholder">🎬</div>'}
                <div class="dropdown-info">
                    <div class="dropdown-title">${escapeHtml(title)}</div>
                    <div class="dropdown-year">${year} • ⭐ ${rating}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Preload all search dropdown images
    searchDropdown.querySelectorAll('img[data-src]').forEach(img => {
        loadImageWithRetry(img, img.dataset.src, 2);
    });
    
    // Bind click selectors to dropdown options
    searchDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.id;
            const type = item.dataset.type;
            const title = item.dataset.title;
            const year = item.dataset.year;
            const rating = item.dataset.rating;
            const poster = item.dataset.poster;
            navigateToPlayer(id, type, title, year, rating, poster);
        });
    });
    
    searchDropdown.classList.remove('hidden');
}

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    
    // Dismiss active suggest dropdown
    if (searchDropdown) {
        searchDropdown.classList.add('hidden');
    }
    
    // Display loading text
    if (trendingGrid) {
        trendingGrid.innerHTML = '<div class="loading-spinner">Searching streams...</div>';
    }
    
    // Update main section title
    const sectionHeader = document.querySelector('.trending-section .section-header h2');
    if (sectionHeader) {
        sectionHeader.innerHTML = `🔍 Search Results: "${escapeHtml(query)}"`;
    }
    
    try {
        const results = await searchContent(query, currentSearchType);
        renderContentGrid(results, currentSearchType, trendingGrid);
    } catch (error) {
        console.error('Submit query search error:', error);
        if (trendingGrid) {
            trendingGrid.innerHTML = `<div class="no-results">Search failed: ${error.message}</div>`;
        }
    }
}

async function loadTrending(type) {
    if (!trendingGrid) return;
    trendingGrid.innerHTML = '<div class="loading-spinner">Loading trending streams...</div>';
    
    try {
        const results = await getTrending(type);
        renderContentGrid(results, type, trendingGrid);
    } catch (error) {
        trendingGrid.innerHTML = `<div class="no-results">Failed to fetch trending content: ${error.message}</div>`;
    }
}

function renderContentGrid(items, type, container) {
    if (!container) return;
    if (!items || items.length === 0) {
        container.innerHTML = '<div class="no-results">No streams available</div>';
        return;
    }
    
    container.innerHTML = items.map(item => {
        const cardType = item.type || type;
        const title = item.title || item.name;
        
        let year = 'N/A';
        if (item.year) {
            year = item.year;
        } else {
            const dateVal = cardType === 'movie' ? item.release_date : item.first_air_date;
            if (dateVal) year = dateVal.split('-')[0];
        }
        
        const posterValue = item.poster || item.poster_path;
        const poster = posterValue ? getImageUrl(posterValue, 'w342') : null;
        
        let rating = 'N/A';
        if (item.rating) {
            rating = item.rating;
        } else if (item.vote_average) {
            rating = item.vote_average.toFixed(1);
        }
        
        return `
            <div class="content-card" 
                 data-id="${item.id}" 
                 data-type="${cardType}" 
                 data-title="${escapeHtml(title)}" 
                 data-year="${year}" 
                 data-rating="${rating}"
                 data-poster="${posterValue || ''}">
                ${poster ? `<img data-src="${poster}" data-id="${item.id}" data-type="${cardType}" alt="${escapeHtml(title)}" class="content-poster loading" style="display:none;">` : '<div class="content-poster placeholder">🎬</div>'}
                <div class="content-info">
                    <div class="content-title">${escapeHtml(title)}</div>
                    <div class="content-meta">${year} • ⭐ ${rating}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Asynchronously preload all card images using retry logic
    container.querySelectorAll('img[data-src]').forEach(img => {
        loadImageWithRetry(img, img.dataset.src, 2);
    });
    
    // Bind click selectors on card elements
    container.querySelectorAll('.content-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const type = card.dataset.type;
            const title = card.dataset.title;
            const year = card.dataset.year;
            const rating = card.dataset.rating;
            const poster = card.dataset.poster;
            navigateToPlayer(id, type, title, year, rating, poster);
        });
    });
}

function navigateToPlayer(tmdbId, type, title, year, rating, poster) {
    // 1. Save item locally to enable Continue Watching list
    saveToRecentlyViewed(tmdbId, type, title, year, rating, poster);
    
    // 2. Navigate using Query String
    const params = new URLSearchParams({
        id: tmdbId,
        type: type,
        title: title || '',
        year: year || '',
        rating: rating || ''
    });
    
    window.location.href = `player.html?${params.toString()}`;
}

function saveToRecentlyViewed(id, type, title, year, rating, poster) {
    try {
        const recent = JSON.parse(localStorage.getItem('605streams_recent') || '[]');
        const newItem = { id, type, title, year, rating, poster, timestamp: Date.now() };
        
        // Filter out duplicate entries matching this content item
        const filtered = recent.filter(item => !(item.id == id && item.type == type));
        filtered.unshift(newItem);
        
        // Keep history capped at 10 items
        localStorage.setItem('605streams_recent', JSON.stringify(filtered.slice(0, 10)));
    } catch (e) {
        console.error('History caching failed:', e);
    }
}

function loadRecentlyViewed() {
    try {
        const recent = JSON.parse(localStorage.getItem('605streams_recent') || '[]');
        if (recent.length === 0 || !recentSection) {
            if (recentSection) recentSection.style.display = 'none';
            return;
        }
        
        recentSection.style.display = 'block';
        renderContentGrid(recent.slice(0, 6), 'mixed', recentGrid);
    } catch (e) {
        console.error('Failed to load watching history cache:', e);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, (m) => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        if (m === "'") return '&#039;';
        return m;
    });
}

/**
 * Attempts to load an image with retries and proxy wrappers
 * @param {HTMLImageElement} img - The image element
 * @param {string} url - Image URL
 * @param {number} retries - Remaining retries
 */
function loadImageWithRetry(img, url, retries = 2) {
    if (retries === 0) {
        applyGradientFallback(img);
        return;
    }
    
    img.src = url;
    
    img.onload = () => {
        img.style.display = 'block';
        img.classList.remove('loading');
        if (img.parentElement?.querySelector('.placeholder-fallback')) {
            img.parentElement.querySelector('.placeholder-fallback')?.remove();
        }
    };
    
    img.onerror = async () => {
        console.warn(`Image failed to load: ${url}, retries left: ${retries - 1}`);
        
        if (retries > 1) {
            // Try different size or proxy
            let newUrl = url;
            if (url.includes('w92')) {
                newUrl = url.replace('w92', 'w154');
            } else if (url.includes('w342')) {
                newUrl = url.replace('w342', 'w500');
            } else {
                newUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            }
            loadImageWithRetry(img, newUrl, retries - 1);
        } else {
            // Query fallback alternative movie/tv images list using getBackupImages
            const tmdbId = img.dataset.id;
            const cardType = img.dataset.type || 'movie';
            if (tmdbId && !img.hasAttribute('data-backup-tried')) {
                img.setAttribute('data-backup-tried', '1');
                console.log(`Querying TMDB /images fallback API for ID: ${tmdbId}`);
                try {
                    const backups = await getBackupImages(tmdbId, cardType);
                    if (backups && backups.length > 0) {
                        const sizeCode = img.classList.contains('content-poster') ? 'w342' : 'w92';
                        const backupUrl = getImageUrl(backups[0], sizeCode);
                        console.log(`Resolved alternative fallback image path: ${backupUrl}`);
                        loadImageWithRetry(img, backupUrl, 2);
                        return;
                    }
                } catch (e) {
                    console.warn(`TMDB /images fallback fetch failed for ID ${tmdbId}:`, e);
                }
            }
            applyGradientFallback(img);
        }
    };
}

/**
 * Construct linear gradient fallback poster
 */
function applyGradientFallback(img) {
    img.style.display = 'none';
    const title = img.alt || 'Movie';
    const parent = img.parentElement;
    
    if (parent && !parent.querySelector('.placeholder-fallback')) {
        const gradientDiv = document.createElement('div');
        
        // Custom styling check for dropdown autocomplete vs main content grids
        if (parent.classList.contains('dropdown-item')) {
            gradientDiv.className = 'dropdown-poster-placeholder placeholder-fallback';
            gradientDiv.style.width = '36px';
            gradientDiv.style.height = '50px';
            gradientDiv.style.borderRadius = '4px';
            gradientDiv.style.flexShrink = '0';
            gradientDiv.style.background = 'linear-gradient(135deg, #1e1b4b, #0c0a09)';
            gradientDiv.innerHTML = `
                <div class="fallback-content" style="padding: 0; gap: 0;">
                    <span class="fallback-icon" style="font-size: 1rem;">🎬</span>
                </div>
            `;
        } else {
            gradientDiv.className = 'content-poster placeholder-fallback';
            const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const hue1 = hash % 360;
            const hue2 = (hue1 + 40) % 360;
            
            gradientDiv.style.background = `linear-gradient(135deg, hsl(${hue1}, 70%, 25%), hsl(${hue2}, 70%, 15%))`;
            gradientDiv.innerHTML = `
                <div class="fallback-content">
                    <span class="fallback-icon">🎬</span>
                    <span class="fallback-title">${escapeHtml(title.substring(0, 20))}</span>
                </div>
            `;
        }
        
        parent.insertBefore(gradientDiv, img);
    }
}

// Add console diagnostic tools
window.debugImages = () => {
    const images = document.querySelectorAll('.content-poster');
    images.forEach(img => {
        console.log('Image src:', img.src);
        img.complete ? console.log('✅ Loaded successfully!') : console.log('❌ Failed or still loading');
    });
};

function escapeSvg(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, (m) => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        if (m === "'") return '&#039;';
        return m;
    });
}
