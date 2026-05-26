/**
 * home.js - Home page logic for 605streams
 * Handles search typeaheads, trending grid display, and recently watched history navigation.
 */

import { searchContent, getTrending, getImageUrl } from './search.js';

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
    
    // 3. Trending media category tabs
    document.querySelectorAll('.trending-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.trending-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadTrending(tab.dataset.trend);
        });
    });
    
    // 4. Advanced ID bypass link
    const advancedLink = document.getElementById('advanced-mode-link');
    if (advancedLink) {
        advancedLink.addEventListener('click', () => {
            localStorage.setItem('605streams_advanced_mode', 'true');
            window.location.href = 'player.html';
        });
    }
    
    // 5. Populate initial grids
    loadTrending('movie');
    loadRecentlyViewed();
});

function triggerAutoSearch() {
    if (searchInput && searchInput.value.trim().length >= 2) {
        onSearchInput({ target: searchInput });
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
        
        // Load active trending category tab
        const activeTab = document.querySelector('.trending-tab.active');
        const trendType = activeTab ? activeTab.dataset.trend : 'movie';
        loadTrending(trendType);
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
                ${poster ? `<img src="${poster}" alt="">` : '<div class="dropdown-poster-placeholder">🎬</div>'}
                <div class="dropdown-info">
                    <div class="dropdown-title">${escapeHtml(title)}</div>
                    <div class="dropdown-year">${year} • ⭐ ${rating}</div>
                </div>
            </div>
        `;
    }).join('');
    
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
        const poster = posterValue ? getImageUrl(posterValue, 'w200') : null;
        
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
                ${poster ? `<img src="${poster}" alt="${escapeHtml(title)}" class="content-poster" loading="lazy">` : '<div class="content-poster placeholder">🎬</div>'}
                <div class="content-info">
                    <div class="content-title">${escapeHtml(title)}</div>
                    <div class="content-meta">${year} • ⭐ ${rating}</div>
                </div>
            </div>
        `;
    }).join('');
    
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
