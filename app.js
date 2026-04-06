/**
 * StreamTV - Modern IPTV Web Application
 *
 * Features:
 * - Fetches channels from IPTV-org M3U playlist
 * - Category-based filtering
 * - HLS streaming with fallback
 * - Search functionality
 * - Favorites system (localStorage)
 * - TV-style remote navigation support
 * - Responsive design
 */

// ===== Configuration =====
const CONFIG = {
    M3U_URL: 'https://iptv-org.github.io/iptv/index.m3u',
    STORAGE_KEYS: {
        FAVORITES: 'streamtv_favorites',
        LAST_CATEGORY: 'streamtv_last_category',
        LAST_CHANNEL: 'streamtv_last_channel'
    },
    MAX_CHANNELS_PER_LOAD: 200,
    DEBOUNCE_DELAY: 300
};

// ===== Application State =====
const state = {
    channels: [],
    categories: new Map(),
    currentCategory: 'All',
    searchQuery: '',
    favorites: new Set(),
    currentChannelIndex: -1,
    filteredChannels: [],
    visibleChannels: [],
    isLoading: false,
    hlsInstance: null
};

// ===== DOM Elements =====
const elements = {
    searchInput: null,
    favoritesToggle: null,
    categoryList: null,
    channelGrid: null,
    loadingSpinner: null,
    emptyState: null,
    channelStats: null,
    visibleCount: null,
    totalCount: null,
    playerOverlay: null,
    videoPlayer: null,
    playerChannelLogo: null,
    playerChannelName: null,
    playerLoading: null,
    playerError: null,
    closePlayer: null,
    prevChannel: null,
    nextChannel: null,
    playPause: null,
    fullscreen: null,
    retryStream: null
};

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    setupEventListeners();
    await loadData();
});

function cacheElements() {
    elements.searchInput = document.getElementById('searchInput');
    elements.favoritesToggle = document.getElementById('favoritesToggle');
    elements.categoryList = document.getElementById('categoryList');
    elements.channelGrid = document.getElementById('channelGrid');
    elements.loadingSpinner = document.getElementById('loadingSpinner');
    elements.emptyState = document.getElementById('emptyState');
    elements.channelStats = document.getElementById('channelStats');
    elements.visibleCount = document.getElementById('visibleCount');
    elements.totalCount = document.getElementById('totalCount');
    elements.playerOverlay = document.getElementById('playerOverlay');
    elements.videoPlayer = document.getElementById('videoPlayer');
    elements.playerChannelLogo = document.getElementById('playerChannelLogo');
    elements.playerChannelName = document.getElementById('playerChannelName');
    elements.playerLoading = document.getElementById('playerLoading');
    elements.playerError = document.getElementById('playerError');
    elements.closePlayer = document.getElementById('closePlayer');
    elements.prevChannel = document.getElementById('prevChannel');
    elements.nextChannel = document.getElementById('nextChannel');
    elements.playPause = document.getElementById('playPause');
    elements.fullscreen = document.getElementById('fullscreen');
    elements.retryStream = document.getElementById('retryStream');
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Search with debounce
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.searchQuery = e.target.value.toLowerCase().trim();
            filterChannels();
        }, CONFIG.DEBOUNCE_DELAY);
    });

    // Favorites toggle
    elements.favoritesToggle.addEventListener('click', () => {
        const wasActive = elements.favoritesToggle.classList.contains('active');
        elements.favoritesToggle.classList.toggle('active', !wasActive);
        state.currentCategory = !wasActive ? 'Favorites' : state.currentCategory === 'Favorites' ? 'All' : state.currentCategory;
        filterChannels();
    });

    // Player controls
    elements.closePlayer.addEventListener('click', closePlayer);
    elements.prevChannel.addEventListener('click', () => playChannel(state.currentChannelIndex - 1));
    elements.nextChannel.addEventListener('click', () => playChannel(state.currentChannelIndex + 1));
    elements.playPause.addEventListener('click', togglePlayPause);
    elements.fullscreen.addEventListener('click', toggleFullscreen);
    elements.retryStream.addEventListener('click', retryCurrentStream);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    // Video events
    elements.videoPlayer.addEventListener('play', () => updatePlayPauseIcon(true));
    elements.videoPlayer.addEventListener('pause', () => updatePlayPauseIcon(false));
    elements.videoPlayer.addEventListener('error', handleVideoError);
    elements.videoPlayer.addEventListener('waiting', () => showPlayerLoading(true));
    elements.videoPlayer.addEventListener('canplay', () => showPlayerLoading(false));
}

function handleKeyboard(e) {
    if (!elements.playerOverlay.classList.contains('active')) return;

    switch (e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            if (e.shiftKey) playChannel(state.currentChannelIndex - 1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            if (e.shiftKey) playChannel(state.currentChannelIndex + 1);
            break;
        case ' ':
            e.preventDefault();
            togglePlayPause();
            break;
        case 'f':
        case 'F':
            toggleFullscreen();
            break;
        case 'Escape':
            closePlayer();
            break;
    }
}

// ===== Data Loading =====
async function loadData() {
    state.isLoading = true;
    showLoading(true);

    try {
        console.log('🚀 Loading IPTV data...');
        console.log('📡 URL:', CONFIG.M3U_URL);

        const response = await fetch(CONFIG.M3U_URL);
        console.log('📥 Response:', response.status, response.statusText);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        const lines = text.split('\n');
        console.log('📦 M3U size:', (text.length / 1024).toFixed(1), 'KB, lines:', lines.length);

        // Parse M3U
        parseM3U(text);

        console.log('✅ Loaded', state.channels.length, 'channels');

        if (state.channels.length === 0) {
            console.warn('⚠️ No channels parsed!');
            showError('No channels found. The playlist format may have changed.');
            return;
        }

        buildCategories();
        restoreLastCategory();
        filterChannels();
        loadFavorites();
    } catch (error) {
        console.error('💥 Load failed:', error);
        showError('Failed to load playlist. See console for details.');
    } finally {
        state.isLoading = false;
        showLoading(false);
    }
}

function parseM3U(content) {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = null;
    let expectUrl = false;
    let parsedCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#EXTINF:')) {
            // Parse metadata
            const info = line.slice(8);
            const match = info.match(/,(.+)$/);
            const name = match ? match[1].trim() : 'Unknown Channel';

            const logoMatch = info.match(/tvg-logo="([^"]*)"/);
            const groupMatch = info.match(/group-title="([^"]*)"/);

            currentChannel = {
                id: channels.length,
                name: name,
                logo: logoMatch ? logoMatch[1] : '',
                category: sanitizeCategory(groupMatch ? groupMatch[1] : 'Uncategorized'),
                streamUrl: '',
                isFavorite: false
            };
            expectUrl = true;

            if (channels.length < 3) {
                console.log(`  Parsed: "${name}" → ${currentChannel.category}`);
            }
        } else if (line && !line.startsWith('#') && expectUrl && currentChannel) {
            // Stream URL
            if (line.startsWith('http')) {
                currentChannel.streamUrl = line;
                channels.push(currentChannel);
                parsedCount++;
                currentChannel = null;
                expectUrl = false;
            }
        }
    }

    state.channels = channels;
    state.filteredChannels = channels;

    // Update total count in UI
    if (elements.totalCount) {
        elements.totalCount.textContent = channels.length;
    } else {
        console.warn('totalCount element not found - will update later');
    }

    console.log(`✅ M3U parsing complete: ${parsedCount} channels`);
}

function sanitizeCategory(category) {
    return category
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'Other';
}

// ===== Category System =====
function buildCategories() {
    state.categories.clear();
    state.categories.set('All', []);

    state.channels.forEach(channel => {
        if (!state.categories.has(channel.category)) {
            state.categories.set(channel.category, []);
        }
        state.categories.get(channel.category).push(channel.id);
    });

    const sortedCategories = Array.from(state.categories.entries())
        .filter(([name]) => name !== 'All')
        .sort((a, b) => b[1].length - a[1].length)
        .map(([name]) => name);

    renderCategories(['All', ...sortedCategories]);
}

function renderCategories(categoryList) {
    elements.categoryList.innerHTML = '';

    categoryList.forEach(category => {
        const count = category === 'All'
            ? state.channels.length
            : state.categories.get(category)?.length || 0;

        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.dataset.category = category;
        btn.innerHTML = `
            <span>${category}</span>
            <span class="category-count">${count}</span>
        `;

        if (category === state.currentCategory) {
            btn.classList.add('active');
        }

        btn.addEventListener('click', () => selectCategory(category));
        elements.categoryList.appendChild(btn);
    });
}

function selectCategory(category) {
    console.log('Select category:', category);
    state.currentCategory = category;
    state.searchQuery = '';
    elements.searchInput.value = '';
    elements.favoritesToggle.classList.remove('active');

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });

    filterChannels();
    saveLastCategory(category);
}

// ===== Filtering =====
function filterChannels() {
    const query = state.searchQuery.toLowerCase();
    const category = state.currentCategory;
    const showFavoritesOnly = category === 'Favorites';

    console.log('Filtering:', { total: state.channels.length, category, query: query || '(none)' });

    state.filteredChannels = state.channels.filter(channel => {
        if (showFavoritesOnly && !state.favorites.has(channel.id)) return false;
        if (!showFavoritesOnly && category !== 'All' && channel.category !== category) return false;
        if (query && !channel.name.toLowerCase().includes(query)) return false;
        return true;
    });

    console.log('Filtered:', state.filteredChannels.length, 'channels');

    state.visibleChannels = [];
    renderGrid();
}

// ===== Lazy Loading =====
function renderGrid() {
    console.log('Rendering grid:', state.filteredChannels.length, 'total');

    const loadMore = () => {
        const start = state.visibleChannels.length;
        const end = Math.min(start + CONFIG.MAX_CHANNELS_PER_LOAD, state.filteredChannels.length);
        const nextBatch = state.filteredChannels.slice(start, end);

        state.visibleChannels.push(...nextBatch);
        batchRenderChannels(nextBatch);

        if (state.visibleChannels.length < state.filteredChannels.length) {
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                    observer.disconnect();
                }
            }, { rootMargin: '200px' });

            const sentinel = document.createElement('div');
            sentinel.id = 'loadMoreSentinel';
            elements.channelGrid.appendChild(sentinel);
            observer.observe(sentinel);
        }

        updateStats();
    };

    elements.channelGrid.innerHTML = '';
    elements.emptyState.style.display = state.filteredChannels.length === 0 ? 'flex' : 'none';

    if (state.filteredChannels.length > 0) {
        loadMore();
    } else {
        updateStats();
    }
}

function batchRenderChannels(channels) {
    const fragment = document.createDocumentFragment();

    channels.forEach(channel => {
        const card = createChannelCard(channel);
        fragment.appendChild(card);
    });

    elements.channelGrid.appendChild(fragment);
}

function createChannelCard(channel) {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.tabIndex = 0;
    card.dataset.channelId = channel.id;

    card.innerHTML = `
        <button class="star-btn ${state.favorites.has(channel.id) ? 'active' : ''}" data-action="favorite">
            <svg viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
        </button>
        <div class="channel-logo-container">
            <img class="channel-logo" src="${channel.logo || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"%3E%3Cpath d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/%3E%3C/svg%3E'}"
                 alt="${channel.name}"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23666%22%3E%3Cpath d=%22M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z%22/%3E%3C/svg%3E'">
        </div>
        <div class="channel-info">
            <div class="channel-name">${channel.name}</div>
            <div class="channel-category">${channel.category}</div>
        </div>
    `;

    const starBtn = card.querySelector('[data-action="favorite"]');
    starBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(channel.id);
        starBtn.classList.toggle('active');
    });

    card.addEventListener('click', () => openPlayer(channel));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPlayer(channel);
        }
    });

    return card;
}

// ===== Player =====
function openPlayer(channel) {
    state.currentChannelIndex = state.filteredChannels.findIndex(c => c.id === channel.id);
    elements.playerOverlay.classList.add('active');

    elements.playerChannelName.textContent = channel.name;
    elements.playerChannelLogo.src = channel.logo || '';
    elements.playerLoading.style.display = 'flex';
    elements.playerError.style.display = 'none';

    if (state.hlsInstance) {
        state.hlsInstance.destroy();
        state.hlsInstance = null;
    }

    playStream(channel.streamUrl);
    saveLastChannel(channel.id);
}

function playStream(url) {
    elements.videoPlayer.src = '';
    elements.videoPlayer.load();

    if (Hls.isSupported()) {
        state.hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
        });

        state.hlsInstance.loadSource(url);
        state.hlsInstance.attachMedia(elements.videoPlayer);

        state.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            elements.videoPlayer.play().catch(e => console.log('Autoplay blocked:', e));
        });

        state.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        state.hlsInstance.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        state.hlsInstance.recoverMediaError();
                        break;
                    default:
                        handleVideoError();
                        break;
                }
            }
        });
    } else if (elements.videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        elements.videoPlayer.src = url;
        elements.videoPlayer.addEventListener('loadedmetadata', () => {
            elements.videoPlayer.play().catch(e => console.log('Autoplay blocked:', e));
        });
    } else {
        handleVideoError();
    }
}

function playChannel(index) {
    const newIndex = (index + state.filteredChannels.length) % state.filteredChannels.length;
    const channel = state.filteredChannels[newIndex];

    if (channel && state.currentChannelIndex !== newIndex) {
        openPlayer(channel);
    }
}

function handleVideoError() {
    showPlayerLoading(false);
    elements.playerError.style.display = 'flex';
    console.error('Video playback error');
}

function retryCurrentStream() {
    if (state.currentChannelIndex >= 0 && state.currentChannelIndex < state.filteredChannels.length) {
        const channel = state.filteredChannels[state.currentChannelIndex];
        elements.playerLoading.style.display = 'flex';
        elements.playerError.style.display = 'none';
        playStream(channel.streamUrl);
    }
}

function closePlayer() {
    elements.playerOverlay.classList.remove('active');
    elements.videoPlayer.pause();
    elements.videoPlayer.src = '';

    if (state.hlsInstance) {
        state.hlsInstance.destroy();
        state.hlsInstance = null;
    }
}

function togglePlayPause() {
    elements.videoPlayer.paused ? elements.videoPlayer.play() : elements.videoPlayer.pause();
}

function updatePlayPauseIcon(isPlaying) {
    document.getElementById('playIcon').style.display = isPlaying ? 'none' : 'block';
    document.getElementById('pauseIcon').style.display = isPlaying ? 'block' : 'none';
}

function toggleFullscreen() {
    const wrapper = document.querySelector('.player-wrapper');

    if (!document.fullscreenElement) {
        wrapper.requestFullscreen().catch(err => console.log('Fullscreen failed:', err));
    } else {
        document.exitFullscreen();
    }
}

function showPlayerLoading(show) {
    elements.playerLoading.style.display = show ? 'flex' : 'none';
}

// ===== Favorites =====
function loadFavorites() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.FAVORITES);
    if (stored) {
        try {
            state.favorites = new Set(JSON.parse(stored));
        } catch (e) {
            state.favorites = new Set();
        }
    }
}

function toggleFavorite(channelId) {
    if (state.favorites.has(channelId)) {
        state.favorites.delete(channelId);
    } else {
        state.favorites.add(channelId);
    }

    localStorage.setItem(CONFIG.STORAGE_KEYS.FAVORITES, JSON.stringify([...state.favorites]));
    updateFavoriteCounts();
}

function updateFavoriteCounts() {
    const favoriteCount = state.favorites.size;
    const favoritesBtn = document.querySelector('[data-category="Favorites"] .category-count');
    if (favoritesBtn) {
        favoritesBtn.textContent = favoriteCount;
    }
}

// ===== Statistics =====
function updateStats() {
    elements.visibleCount.textContent = state.visibleChannels.length;
    elements.totalCount.textContent = state.filteredChannels.length;
}

// ===== Utility Functions =====
function showLoading(show) {
    elements.loadingSpinner.style.display = show ? 'flex' : 'none';
    if (!show) {
        setTimeout(() => {
            elements.loadingSpinner.style.display = 'none';
        }, 100);
    }
}

function showError(message) {
    elements.loadingSpinner.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 48px; height: 48px; color: #ef4444;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <p style="color: #ef4444;">${message}</p>
    `;
}

// ===== Persistence =====
function saveLastCategory(category) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_CATEGORY, category);
}

function restoreLastCategory() {
    const lastCategory = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_CATEGORY);
    if (lastCategory && state.categories.has(lastCategory)) {
        state.currentCategory = lastCategory;
        elements.favoritesToggle.classList.remove('active');
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === lastCategory);
        });
    }
}

function saveLastChannel(channelId) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_CHANNEL, channelId.toString());
}

// ===== Add Favorites Button =====
document.addEventListener('DOMContentLoaded', () => {
    const allCategoryBtn = document.querySelector('.category-btn');
    if (allCategoryBtn) {
        const favoritesBtn = document.createElement('button');
        favoritesBtn.className = 'category-btn';
        favoritesBtn.dataset.category = 'Favorites';
        favoritesBtn.innerHTML = `
            <span>❤️ Favorites</span>
            <span class="category-count">0</span>
        `;
        allCategoryBtn.after(favoritesBtn);
        updateFavoriteCounts();
    }
});
