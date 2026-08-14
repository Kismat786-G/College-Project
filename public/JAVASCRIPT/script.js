let places = [];

const categories = ['All', 'Nature', 'Beach', 'Historical', 'Urban', 'Adventure', 'Cultural'];

let currentFilter = 'All';
let searchQuery = '';
let currentView = 'explore';
let minRatingFilter = 0;
let budgetFilter = 'all';
let difficultyFilter = 'All';
let regionFilter = 'All';
let selectedPlace = null;
let userRating = 0;

let currentPlaceReviews = [];
let travelerCount = 0;

// DOM Elements
const loginPage = document.getElementById('login-page');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const tabButtons = document.querySelectorAll('.tab-btn');
const userBtn = document.getElementById('user-btn');
const profileCard = document.getElementById('user-profile-card');
const logoutBtn = document.getElementById('logout-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
let profileHideTimer = null;
const searchInput = document.getElementById('search-input');
const categoriesContainer = document.getElementById('categories');
const navViewButtons = document.querySelectorAll('[data-view]');
const ratingFilter = document.getElementById('rating-filter');
const budgetFilterSelect = document.getElementById('budget-filter');
const difficultyFilterSelect = document.getElementById('difficulty-filter');
const regionFilterSelect = document.getElementById('region-filter');
const placesGrid = document.getElementById('places-grid');
const spotlightGrid = document.querySelector('.spotlight-grid');
const noResults = document.getElementById('no-results');
const placeDetailModal = document.getElementById('place-detail-modal');
const addPlaceBtns = document.querySelectorAll('#add-place-btn, #cta-add-btn, #featured-add-btn, .mobile-add-btn');
const backBtn = document.getElementById('back-btn');
const closeFormBtn = document.getElementById('close-form-btn');
const addPlaceModal = document.getElementById('add-place-modal');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const reviewForm = document.getElementById('review-form');
const starRating = document.getElementById('star-rating');
const travelStatus = document.getElementById('travel-status');
const travelBoardContent = document.getElementById('travel-board-content');

// Initialize
async function init() {
    try {
        places = await loadApprovedPlaces();
    } catch (error) {
        places = [];
    }
    try {
        travelerCount = await loadTravelerCount();
    } catch (error) {
        travelerCount = 0;
    }
    refreshCategories();
    renderCategories();
    renderAdvancedFilters();
    renderPlaces();
    renderSpotlight();
    updateStats();
    initializeUserProfile();
    initializeNotifications();
    attachEventListeners();
}

function initializeNotifications() {
    const button = document.getElementById('notif-btn');
    const panel = document.getElementById('notification-panel');
    const list = document.getElementById('notification-list');
    const badge = document.getElementById('notif-badge');
    const markAll = document.getElementById('notif-mark-all');
    if (!button || !panel || !list || !badge) return;
    const text = note => {
        const name = escapeHtml(note.data?.place_name || 'your destination');
        if (note.type === 'place_approved') return `Your destination “${name}” was approved.`;
        if (note.type === 'place_rejected') return `Your destination “${name}” was not approved.`;
        if (note.type === 'new_review') return `Someone reviewed “${name}”.`;
        return `Your destination “${name}” is awaiting approval.`;
    };
    const load = async () => {
        const response = await fetch('../../PHP/notifications.php?action=get', { credentials: 'same-origin' });
        if (!response.ok) return;
        const data = await response.json(); if (!data.success) return;
        const unread = Number(data.unread || 0); badge.hidden = unread === 0; badge.textContent = String(unread);
        list.innerHTML = (data.notifications || []).map(note => `<article class="notification-item ${note.is_read ? '' : 'unread'}"><div><strong>${text(note)}</strong><small>${escapeHtml(formatDate(note.created_at))}</small></div>${note.is_read ? '' : `<button class="notification-mark-all" data-note-id="${note.id}" type="button">Mark read</button>`}</article>`).join('') || '<p class="empty-state">No notifications yet.</p>';
    };
    button.addEventListener('click', async () => {
        if (!isUserLoggedIn()) { window.location.href = 'login.html'; return; }
        const hidden = panel.hasAttribute('hidden');
        if (hidden) {
            panel.removeAttribute('hidden');
            panel.setAttribute('aria-hidden', 'false');
            try { await load(); } catch (error) { list.innerHTML = '<p class="empty-state">No notifications yet.</p>'; }
        } else {
            panel.setAttribute('hidden', '');
            panel.setAttribute('aria-hidden', 'true');
        }
    });
    list.addEventListener('click', async event => { const target = event.target.closest('[data-note-id]'); if (!target) return; await fetch('../../PHP/notifications.php', { method: 'POST', credentials: 'same-origin', body: new URLSearchParams({ action: 'mark_read', id: target.dataset.noteId }) }); await load(); });
    markAll?.addEventListener('click', async () => { await fetch('../../PHP/notifications.php', { method: 'POST', credentials: 'same-origin', body: new URLSearchParams({ action: 'mark_all' }) }); await load(); });
    document.addEventListener('click', event => {
        if (!panel.hasAttribute('hidden') && !panel.parentElement.contains(event.target)) {
            panel.setAttribute('hidden', '');
            panel.setAttribute('aria-hidden', 'true');
        }
    });
    if (isUserLoggedIn()) load();
}

function escapeHtml(value = '') {
    return value.toString().replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function getPlaceImageUrl(imagePath = '') {
    const path = imagePath.toString().trim();
    if (!path || path === 'Submitted destination') return '';
    if (/^(https?:|data:|blob:)/i.test(path)) return path;

    const normalizedPath = path.replace(/^(\.\.\/)+/, '').replace(/^public\//i, '');
    return `../../PHP/serve_image.php?path=${encodeURIComponent(normalizedPath)}`;
}

function formatDate(value) {
    if (!value) return 'Unknown';
    return new Date(value).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function refreshCategories() {
    const dynamicCategories = Array.from(
        new Set(
            places
                .map(place => place.category)
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));

    categories.splice(0, categories.length, 'All', ...dynamicCategories);
}

function getUniquePlaceValues(fields) {
    return Array.from(new Set(
        places
            .flatMap(place => fields.map(field => (place[field] || '').toString().trim()))
            .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
}

function renderAdvancedFilters() {
    if (difficultyFilterSelect) {
        const difficulties = getUniquePlaceValues(['difficulty']);
        difficultyFilterSelect.innerHTML = [
            '<option value="All">Any difficulty</option>',
            ...difficulties.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
        ].join('');
        difficultyFilterSelect.value = difficultyFilter;
    }

    if (regionFilterSelect) {
        const regions = getUniquePlaceValues(['district', 'province', 'municipality']);
        regionFilterSelect.innerHTML = [
            '<option value="All">All Nepal</option>',
            ...regions.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
        ].join('');
        regionFilterSelect.value = regionFilter;
    }
}

function normalizePlace(place) {
    return {
        rating: 0,
        reviews: 0,
        category: 'Other',
        budget: 0,
        transport: 0,
        stay: 0,
        food: 0,
        fee: 0,
        localName: '',
        tagline: '',
        province: '',
        district: '',
        municipality: '',
        shortDesc: '',
        bestTime: '',
        duration: '',
        difficulty: 'Easy',
        things: '',
        tips: '',
        startPoint: '',
        routeDesc: '',
        destination: '',
        accomDesc: '',
        hotels: '',
        restaurants: '',
        homestay: false,
        parking: false,
        toilets: false,
        mapLatitude: '',
        mapLongitude: '',
        mapUrl: '',
        ...place,
        location: place.location || [place.district, place.province].filter(Boolean).join(', ') || place.destination || 'Nepal',
        status: place.status || 'approved'
    };
}

async function loadApprovedPlaces() {
    const response = await fetch('../../PHP/places.php?action=approved', {
        method: 'GET',
        credentials: 'same-origin'
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load approved places.');
    }

    return (data.places || []).map(normalizePlace);
}

async function loadTravelerCount() {
    const response = await fetch('../../PHP/places.php?action=stats', {
        method: 'GET',
        credentials: 'same-origin'
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load traveler count.');
    }

    return Number(data.travelerCount || 0);
}

function buildPlaceFromForm(formElement) {
    const data = new FormData(formElement);
    const field = name => (data.get(name) || '').toString().trim();
    const numberField = name => Number(field(name)) || 0;

    return normalizePlace({
        id: Date.now(),
        name: field('name'),
        localName: field('localName'),
        tagline: field('tagline'),
        province: field('province'),
        district: field('district'),
        municipality: field('municipality'),
        mapLatitude: field('mapLatitude'),
        mapLongitude: field('mapLongitude'),
        mapUrl: field('mapUrl'),
        category: field('category'),
        shortDesc: field('shortDesc'),
        bestTime: field('bestTime'),
        duration: field('duration'),
        things: field('things'),
        tips: field('tips'),
        difficulty: field('difficulty') || 'Easy',
        budget: numberField('budget'),
        transport: numberField('transport'),
        stay: numberField('stay'),
        food: numberField('food'),
        fee: numberField('fee'),
        accomDesc: field('accomDesc'),
        hotels: field('hotels'),
        restaurants: field('restaurants'),
        homestay: data.has('homestay'),
        parking: data.has('parking'),
        toilets: data.has('toilets'),
        coverImage: coverFile ? coverFile.name : 'Submitted destination',
        startPoint: field('start'),
        routeDesc: field('routeDesc'),
        destination: field('dest'),
        submittedBy: localStorage.getItem('userName') || getCookie('userName') || 'Traveler',
        submittedAt: new Date().toISOString(),
        status: 'pending'
    });
}

async function submitPlaceForApproval(formElement) {
    const submittedPlace = buildPlaceFromForm(formElement);
    const formData = new FormData(formElement);
    formData.append('action', 'submit');
    if (coverFile) {
        formData.set('coverImage', coverFile, coverFile.name);
    }

    try {
        const response = await fetch('../../PHP/places.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (response.status === 401) {
            window.location.href = 'login.html';
            return null;
        }

        if (!data.success) {
            throw new Error(data.message || 'Unable to submit place.');
        }

        return { ...submittedPlace, id: data.id, coverImage: data.coverImage || submittedPlace.coverImage };
    } catch (error) {
        throw new Error(error.message || 'Unable to submit place. Please check Apache, MySQL, and login status.');
    }
}

// Event Listeners
function attachEventListeners() {
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (signupForm) signupForm.addEventListener('submit', handleLogin);
    if (userBtn) userBtn.addEventListener('click', openUserProfile);
    if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    navViewButtons.forEach(btn => {
        btn.addEventListener('click', () => setDestinationView(btn.dataset.view || 'explore'));
    });
    document.addEventListener('click', (event) => {
        if (event.target.closest('#travel-features')) {
            handleTravelFeatureClick(event);
        }

        const spotlightCard = event.target.closest('[data-spotlight-place-id]');
        if (spotlightCard) {
            openPlaceDetail(Number(spotlightCard.dataset.spotlightPlaceId));
        }
    });

    document.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-spotlight-place-id]')) {
            event.preventDefault();
            openPlaceDetail(Number(event.target.dataset.spotlightPlaceId));
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            filterPlaces();
        });
    }

    if (ratingFilter) {
        ratingFilter.addEventListener('change', (e) => {
            minRatingFilter = Number(e.target.value) || 0;
            filterPlaces();
        });
    }

    if (budgetFilterSelect) {
        budgetFilterSelect.addEventListener('change', (e) => {
            budgetFilter = e.target.value;
            filterPlaces();
        });
    }

    if (difficultyFilterSelect) {
        difficultyFilterSelect.addEventListener('change', (e) => {
            difficultyFilter = e.target.value;
            filterPlaces();
        });
    }

    if (regionFilterSelect) {
        regionFilterSelect.addEventListener('change', (e) => {
            regionFilter = e.target.value;
            filterPlaces();
        });
    }

    addPlaceBtns.forEach(btn => {
        btn.addEventListener('click', openAddPlaceModal);
    });

    if (backBtn) backBtn.addEventListener('click', closePlaceDetail);
    if (closeFormBtn) closeFormBtn.addEventListener('click', closeAddPlaceModal);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
    if (reviewForm) reviewForm.addEventListener('submit', handleReviewSubmit);

    if (starRating) {
        const starBtns = starRating.querySelectorAll('.star-btn');
        starBtns.forEach(btn => {
            btn.addEventListener('click', () => setRating(parseInt(btn.dataset.rating)));
            btn.addEventListener('mouseenter', () => highlightStars(parseInt(btn.dataset.rating)));
        });
        starRating.addEventListener('mouseleave', () => highlightStars(userRating));
    }

    if (addPlaceModal) {
        addPlaceModal.addEventListener('click', (e) => {
            if (e.target === addPlaceModal) closeAddPlaceModal();
        });
    }
    if (placeDetailModal) {
        placeDetailModal.addEventListener('click', (e) => {
            if (e.target === placeDetailModal) closePlaceDetail();
        });
    }
}

// Auth Functions
function switchTab(tab) {
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    if (tab === 'login') {
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
    } else {
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
    }
}

function handleLogin(e) {
    e.preventDefault();
    if (loginPage) loginPage.classList.remove('active');
    if (mainApp) mainApp.classList.add('active');
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return decodeURIComponent(parts.pop().split(';').shift());
    }
    return '';
}

function initializeUserProfile() {
    const userName = localStorage.getItem('userName') || getCookie('userName') || 'Traveler';
    const userRole = localStorage.getItem('userRole') || getCookie('userRole') || 'User';
    const profileName = document.getElementById('profile-name');
    const profileRole = document.getElementById('profile-role');
    const userAvatar = document.getElementById('user-avatar');
    const navUserInitial = document.getElementById('nav-user-initial');
    const isLoggedIn = Boolean(localStorage.getItem('userRole') || getCookie('userRole'));

    if (profileName) profileName.textContent = userName;
    if (profileRole) profileRole.textContent = userRole.charAt(0).toUpperCase() + userRole.slice(1);
    if (userAvatar) userAvatar.textContent = userName.charAt(0).toUpperCase();
    if (navUserInitial && isLoggedIn) {
        navUserInitial.textContent = Array.from(userName.trim())[0]?.toUpperCase() || 'U';
        userBtn?.classList.add('has-initial');
    }

    if (isLoggedIn) {
        showProfileCard();
        updateTravelBoard();
    }

    if (userName && userName !== 'Traveler') {
        userBtn?.setAttribute('aria-label', 'Open user profile');
    }

    loadHomepageAvatar();
}

async function loadHomepageAvatar() {
    if (!userBtn || !isUserLoggedIn()) return;
    try {
        const response = await fetch('../../PHP/user.php?action=me', { credentials: 'same-origin' });
        if (!response.ok) return;
        const data = await response.json();
        const avatar = data?.user?.avatar || '';
        if (!data?.success || !avatar) return;
        userBtn.style.backgroundImage = `url(../../PHP/serve_image.php?path=${encodeURIComponent(avatar)})`;
        userBtn.classList.add('with-image');
    } catch (error) {
        // The normal profile icon remains visible if the avatar cannot be loaded.
    }
}

function showProfileCard() {
    if (!profileCard) return;

    profileCard.classList.add('active');
    profileCard.setAttribute('aria-hidden', 'false');

    if (profileHideTimer) clearTimeout(profileHideTimer);
    profileHideTimer = setTimeout(() => {
        profileCard.classList.remove('active');
        profileCard.setAttribute('aria-hidden', 'true');
    }, 8000);
}

function hideProfileCard() {
    if (!profileCard) return;
    profileCard.classList.remove('active');
    profileCard.setAttribute('aria-hidden', 'true');
    if (profileHideTimer) clearTimeout(profileHideTimer);
}

function isUserLoggedIn() {
    return Boolean(localStorage.getItem('isAdmin') === 'true' || localStorage.getItem('userRole') || getCookie('userRole'));
}

function openUserProfile() {
    if (!isUserLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    window.location.href = 'profile.html';
}
function setTravelStatus(message) {
    if (travelStatus) {
        travelStatus.textContent = message;
    }
}

function updateTravelBoard(feature = 'saved') {
    if (!travelBoardContent) return;

    if (!isUserLoggedIn()) {
        travelBoardContent.innerHTML = '<p class="empty-state">Please sign in to view your saved places and trips.</p>';
        setTravelStatus('Sign in to start saving places and shaping your next trip.');
        return;
    }

    fetch('../../PHP/travel.php?action=get', {
        method: 'GET',
        credentials: 'same-origin'
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                travelBoardContent.innerHTML = '<p class="empty-state">Unable to load your travel board right now.</p>';
                return;
            }

            const saved = data.saved || [];
            const trips = data.trips || [];
            const notes = data.notes || [];

            if (feature === 'saved') {
                if (saved.length === 0) {
                    travelBoardContent.innerHTML = '<p class="empty-state">No saved places yet.</p>';
                } else {
                    travelBoardContent.innerHTML = saved.map(item => {
                        const place = places.find(p => p.id === item.place_id);
                        return `<div class="travel-board-item">💾 ${escapeHtml(place ? place.name : `Place ${item.place_id}`)}</div>`;
                    }).join('');
                }
                setTravelStatus('Your saved places are ready for the next trip.');
            } else if (feature === 'future') {
                if (trips.length === 0) {
                    travelBoardContent.innerHTML = '<p class="empty-state">No future trips planned yet.</p>';
                } else {
                    travelBoardContent.innerHTML = trips.map(item => {
                        const place = places.find(p => p.id === item.place_id);
                        return `<div class="travel-board-item">🗓️ ${escapeHtml(place ? place.name : `Place ${item.place_id}`)}</div>`;
                    }).join('');
                }
                setTravelStatus('Your future trips are ready to review.');
            } else if (feature === 'notes') {
                if (notes.length === 0) {
                    travelBoardContent.innerHTML = '<p class="empty-state">No trip notes yet.</p>';
                } else {
                    travelBoardContent.innerHTML = notes.map(note => `<div class="travel-board-item">📝 ${escapeHtml(note.note_text)}</div>`).join('');
                }
                setTravelStatus('Your notes are stored here for later.');
            } else {
                travelBoardContent.innerHTML = '<div class="travel-board-item">✨ More travel tools will appear here soon.</div>';
                setTravelStatus('More travel tools are on the way.');
            }
        })
        .catch(() => {
            travelBoardContent.innerHTML = '<p class="empty-state">Unable to load your travel board right now.</p>';
        });
}

function handleTravelFeatureClick(event) {
    const button = event.target.closest('.feature-item');
    if (!button || !isUserLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }

    const feature = button.dataset.feature;
    showProfileCard();
    updateTravelBoard(feature);
}

async function logoutUser() {
    try {
        const formData = new FormData();
        formData.append('action', 'logout');
        await fetch('../../PHP/places.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
    } catch (error) {
        // Clear browser data even when the server cannot be reached.
    }
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    document.cookie = 'isAdmin=; path=/; max-age=0';
    document.cookie = 'userRole=; path=/; max-age=0';
    document.cookie = 'userName=; path=/; max-age=0';
    document.cookie = 'userId=; path=/; max-age=0';
    hideProfileCard();
    window.location.href = 'login.html';
}

// Collections, notes, and trip planning stored locally per-user
function savePlaceToCollection(placeId) {
    if (!isUserLoggedIn()) { window.location.href = 'login.html'; return; }

    const formData = new FormData();
    formData.append('action', 'save_place');
    formData.append('place_id', placeId);

    fetch('../../PHP/travel.php', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
    })
        .then(response => response.json())
        .then(result => {
            if (!result.success) throw new Error(result.message || 'Unable to save right now.');
            showProfileCard();
            setTravelStatus('Saved to your collection.');
            updateTravelBoard('saved');
            showToast('Saved to your collection.', 'fa-bookmark');
        })
        .catch(error => {
            const message = error.message || 'Unable to save right now.';
            setTravelStatus(message);
            showToast(message, 'fa-triangle-exclamation');
        });
}

function addNoteToPlace(placeId, note) {
    if (!isUserLoggedIn()) { window.location.href = 'login.html'; return; }

    const formData = new FormData();
    formData.append('action', 'add_note');
    formData.append('place_id', placeId);
    formData.append('note_text', note);

    fetch('../../PHP/travel.php', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
    })
        .then(response => response.json())
        .then(result => {
            if (!result.success) throw new Error(result.message || 'Unable to save note right now.');
            showProfileCard();
            setTravelStatus('Note saved to your travel board.');
            updateTravelBoard('notes');
            showToast('Trip note saved.', 'fa-note-sticky');
        })
        .catch(error => {
            const message = error.message || 'Unable to save note right now.';
            setTravelStatus(message);
            showToast(message, 'fa-triangle-exclamation');
        });
}

function organizeTrip(placeId) {
    if (!isUserLoggedIn()) { window.location.href = 'login.html'; return; }

    const formData = new FormData();
    formData.append('action', 'plan_trip');
    formData.append('place_id', placeId);

    fetch('../../PHP/travel.php', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
    })
        .then(response => response.json())
        .then(result => {
            if (!result.success) throw new Error(result.message || 'Unable to plan trip right now.');
            showProfileCard();
            setTravelStatus('Added to your future trips.');
            updateTravelBoard('future');
            showToast('Added to your trip plan.', 'fa-calendar-check');
        })
        .catch(error => {
            const message = error.message || 'Unable to plan trip right now.';
            setTravelStatus(message);
            showToast(message, 'fa-triangle-exclamation');
        });
}

// Mobile Menu
function toggleMobileMenu() {
    mobileMenu.classList.toggle('active');
}

// Categories
function renderCategories() {
    categoriesContainer.innerHTML = categories.map(cat => `
        <button class="category-btn ${cat === currentFilter ? 'active' : ''}"
                onclick="setCategory(${JSON.stringify(cat)})">
            ${escapeHtml(cat)}
        </button>
    `).join('');
}

function setCategory(category) {
    currentFilter = category;
    renderCategories();
    filterPlaces();
}

function setDestinationView(view) {
    currentView = view === 'top-rated' ? 'top-rated' : 'explore';
    navViewButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentView);
    });
    if (mobileMenu) mobileMenu.classList.remove('active');
    filterPlaces();
    document.querySelector('.places-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Places
function renderPlaces() {
    const filteredPlaces = getFilteredPlaces();

    if (filteredPlaces.length === 0) {
        placesGrid.style.display = 'none';
        noResults.style.display = 'block';
    } else {
        placesGrid.style.display = 'grid';
        noResults.style.display = 'none';

        placesGrid.innerHTML = filteredPlaces.map(place => {
            // Generate image content - use actual image if available, otherwise SVG placeholder
            let imageContent = `
                <svg class="icon-large" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
            `;
            
            const imageUrl = getPlaceImageUrl(place.coverImage);
            if (imageUrl) {
                imageContent = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(place.name)}">`;
            }
            
            return `
                <div class="place-card" onclick="openPlaceDetail(${place.id})">
                    <div class="place-image">
                        ${imageContent}
                        <div class="place-category">${escapeHtml(place.category)}</div>
                    </div>
                    <div class="place-info">
                        <div class="place-info-top">
                            <h3 class="place-name">${escapeHtml(place.name)}</h3>
                            <div class="place-location-info">
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                                <span>${escapeHtml(place.location)}</span>
                            </div>
                        </div>
                        <div class="place-footer-meta">
                            <div class="place-rating">
                                <span class="rating-badge">${Number(place.rating || 0).toFixed(1)} / 5</span>
                            </div>
                            <div class="place-reviews">
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                                <span>${Number(place.reviews || 0)} reviews</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateSectionHeader(filteredPlaces.length);
}

function spotlightImage(place, className = '') {
    const imageUrl = getPlaceImageUrl(place.coverImage);
    if (imageUrl) {
        return `<img class="${className}" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(place.name)}">`;
    }

    return `
        <svg class="icon-large ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
        </svg>
    `;
}

function renderSpotlight() {
    if (!spotlightGrid) return;

    const spotlightPlaces = [...places]
        .sort((a, b) => (Number(b.rating || 0) - Number(a.rating || 0)) || (Number(b.reviews || 0) - Number(a.reviews || 0)))
        .slice(0, 3);

    if (spotlightPlaces.length === 0) {
        spotlightGrid.innerHTML = '<p class="spotlight-empty">No approved places are available yet. Check back soon.</p>';
        return;
    }

    const [featured, ...remaining] = spotlightPlaces;
    const featuredLocation = featured.location || 'Nepal';
    spotlightGrid.innerHTML = `
        <article class="spotlight-card" data-spotlight-place-id="${Number(featured.id)}" role="button" tabindex="0" aria-label="View details for ${escapeHtml(featured.name)}">
            <div class="spotlight-media">
                ${spotlightImage(featured)}
                <span class="spotlight-badge">Top pick</span>
            </div>
            <div class="spotlight-body">
                <p class="spotlight-pill">${escapeHtml(featured.category)}</p>
                <h3>${escapeHtml(featured.name)}</h3>
                <p>${escapeHtml(featured.shortDesc || featured.tagline || 'Discover this approved destination in Nepal.')}</p>
                <div class="spotlight-meta">
                    <span class="spotlight-pill">★ ${Number(featured.rating || 0).toFixed(1)} (${Number(featured.reviews || 0)} reviews)</span>
                    <span class="spotlight-pill">${escapeHtml(featuredLocation)}</span>
                </div>
            </div>
        </article>
        <div class="spotlight-stack">
            ${remaining.map(place => `
                <article class="mini-card" data-spotlight-place-id="${Number(place.id)}" role="button" tabindex="0" aria-label="View details for ${escapeHtml(place.name)}">
                    <div class="mini-icon">${spotlightImage(place, 'mini-image')}</div>
                    <div>
                        <h4>${escapeHtml(place.name)}</h4>
                        <p>${escapeHtml(place.shortDesc || place.tagline || place.location || 'Approved destination')}</p>
                        <span class="mini-meta">★ ${Number(place.rating || 0).toFixed(1)} · ${Number(place.reviews || 0)} reviews</span>
                    </div>
                </article>
            `).join('')}
        </div>
    `;
}

function getFilteredPlaces() {
    return places
        .filter(place => {
            const matchesCategory = currentFilter === 'All' || place.category === currentFilter;
            const searchableLocation = place.location || [place.district, place.province].filter(Boolean).join(', ');
            const searchableRegion = [place.district, place.province, place.municipality]
                .filter(Boolean)
                .map(value => value.toString().toLowerCase());
            const placeBudget = Number(place.budget || 0);
            const maxBudget = budgetFilter === 'all' ? Infinity : Number(budgetFilter);
            const matchesSearch = place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                searchableLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
                place.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (place.shortDesc || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRating = Number(place.rating || 0) >= minRatingFilter;
            const matchesBudget = budgetFilter === 'all' || placeBudget === 0 || placeBudget <= maxBudget;
            const matchesDifficulty = difficultyFilter === 'All' || place.difficulty === difficultyFilter;
            const matchesRegion = regionFilter === 'All' || searchableRegion.includes(regionFilter.toLowerCase());
            const matchesView = currentView !== 'top-rated' || Number(place.rating || 0) > 0 || Number(place.reviews || 0) > 0;
            return matchesCategory && matchesSearch && matchesRating && matchesBudget && matchesDifficulty && matchesRegion && matchesView;
        })
        .sort((a, b) => (Number(b.rating || 0) - Number(a.rating || 0)) || (Number(b.reviews || 0) - Number(a.reviews || 0)));
}

function filterPlaces() {
    renderPlaces();
}

function clearFilters() {
    searchQuery = '';
    currentFilter = 'All';
    minRatingFilter = 0;
    budgetFilter = 'all';
    difficultyFilter = 'All';
    regionFilter = 'All';
    searchInput.value = '';
    if (ratingFilter) ratingFilter.value = '0';
    if (budgetFilterSelect) budgetFilterSelect.value = 'all';
    if (difficultyFilterSelect) difficultyFilterSelect.value = 'All';
    if (regionFilterSelect) regionFilterSelect.value = 'All';
    renderCategories();
    renderPlaces();
}

function updateSectionHeader(count) {
    const titlePrefix = currentView === 'top-rated' ? 'Top Rated' : 'All';
    const title = currentFilter === 'All' ? `${titlePrefix} Destinations` : `${titlePrefix} ${currentFilter} Destinations`;
    const subtitlePrefix = currentView === 'top-rated' ? 'Highest rated uploaded places' : 'Explore all uploaded places';
    const subtitle = `${subtitlePrefix} • ${count} ${count === 1 ? 'place' : 'places'}`;

    document.getElementById('section-title').textContent = title;
    document.getElementById('section-subtitle').textContent = subtitle;
}

function updateStats() {
    const totalPlaces = places.length;
    const totalReviews = places.reduce((sum, place) => sum + Number(place.reviews || 0), 0);
    const totalWeighted = places.reduce((sum, place) => sum + (Number(place.rating || 0) * Number(place.reviews || 0)), 0);
    const averageRating = totalReviews > 0 ? (totalWeighted / totalReviews) : 0;

    const placesEl = document.getElementById('stat-places');
    const reviewsEl = document.getElementById('stat-reviews');
    const avgEl = document.getElementById('stat-avg-rating');
    const travelersEl = document.getElementById('stat-travelers');

    if (placesEl) placesEl.textContent = `${totalPlaces}`;
    if (reviewsEl) reviewsEl.textContent = `${totalReviews}`;
    if (avgEl) avgEl.textContent = averageRating.toFixed(1);
    if (travelersEl) travelersEl.textContent = `${travelerCount}`;
}

function openAddPlaceModal() {
    if (!isUserLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    if (!addPlaceModal) return;
    addPlaceModal.classList.add('active');
    if (mobileMenu) mobileMenu.classList.remove('active');
}

function closeAddPlaceModal() {
    if (!addPlaceModal) return;
    addPlaceModal.classList.remove('active');
}

// Place Detail
function openPlaceDetail(id) {
    selectedPlace = places.find(p => p.id === id);
    if (!selectedPlace) return;

    // Header info
    document.getElementById('detail-name').textContent = selectedPlace.name || 'Selected Place';
    document.getElementById('detail-local-name').textContent = selectedPlace.localName || '';
    document.getElementById('detail-tagline').textContent = selectedPlace.tagline || '';
    const detailHero = document.querySelector('.detail-hero');
    const detailCoverImage = document.getElementById('detail-cover-image');
    const detailImageUrl = getPlaceImageUrl(selectedPlace.coverImage);
    if (detailHero && detailCoverImage) {
        detailHero.classList.toggle('has-image', Boolean(detailImageUrl));
        detailCoverImage.src = detailImageUrl || '';
        detailCoverImage.alt = detailImageUrl ? (selectedPlace.name || 'Place cover image') : '';
    }

    const detailRating = document.getElementById('detail-rating-value');
    const detailReviewCount = document.getElementById('detail-review-count');
    if (detailRating) detailRating.textContent = Number(selectedPlace.rating || 0).toFixed(1);
    if (detailReviewCount) detailReviewCount.textContent = `${Number(selectedPlace.reviews || 0)}`;

    // Location info
    const districtProvince = [selectedPlace.district, selectedPlace.province].filter(Boolean).join(', ');
    document.getElementById('detail-location').textContent = districtProvince || 'Nepal';
    document.getElementById('detail-location-full').textContent = [selectedPlace.municipality, selectedPlace.province].filter(Boolean).join(', ');

    // About
    document.getElementById('detail-desc').textContent = selectedPlace.shortDesc || '-';

    // Trip Information
    document.getElementById('detail-best-time').textContent = selectedPlace.bestTime || '-';
    document.getElementById('detail-duration').textContent = selectedPlace.duration || '-';
    document.getElementById('detail-difficulty').textContent = selectedPlace.difficulty || '-';
    document.getElementById('detail-category').textContent = selectedPlace.category || '-';

    // Things to Do
    document.getElementById('detail-things').textContent = selectedPlace.things || '-';

    // Tips
    document.getElementById('detail-tips').textContent = selectedPlace.tips || '-';

    // Route
    document.getElementById('detail-start').textContent = selectedPlace.startPoint || '-';
    document.getElementById('detail-route').textContent = selectedPlace.routeDesc || '-';
    document.getElementById('detail-dest').textContent = selectedPlace.destination || '-';

    const mapLink = document.getElementById('detail-map-link');
    const rawLatitude = String(selectedPlace.mapLatitude ?? '').trim();
    const rawLongitude = String(selectedPlace.mapLongitude ?? '').trim();
    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);
    const hasCoordinates = rawLatitude !== '' && rawLongitude !== '' &&
        Number.isFinite(latitude) && Number.isFinite(longitude) &&
        latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
    if (mapLink) {
        mapLink.hidden = !hasCoordinates;
        mapLink.href = hasCoordinates
            ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitude},${longitude}`)}`
            : '#';
    }

    // Budget
    document.getElementById('detail-budget').textContent = `NPR ${selectedPlace.budget.toLocaleString()}`;
    document.getElementById('detail-transport').textContent = `NPR ${selectedPlace.transport.toLocaleString()}`;
    document.getElementById('detail-stay').textContent = `NPR ${selectedPlace.stay.toLocaleString()}`;
    document.getElementById('detail-food').textContent = `NPR ${selectedPlace.food.toLocaleString()}`;
    document.getElementById('detail-fee').textContent = `NPR ${selectedPlace.fee.toLocaleString()}`;

    // Facilities
    document.getElementById('detail-accom').textContent = selectedPlace.accomDesc || '-';
    document.getElementById('detail-hotels').textContent = selectedPlace.hotels || '-';
    document.getElementById('detail-restaurants').textContent = selectedPlace.restaurants || '-';

    // Features
    document.getElementById('feature-homestay').style.display = selectedPlace.homestay ? 'flex' : 'none';
    document.getElementById('feature-parking').style.display = selectedPlace.parking ? 'flex' : 'none';
    document.getElementById('feature-toilets').style.display = selectedPlace.toilets ? 'flex' : 'none';

    // Add action buttons (save, note, plan)
    const actionsContainerId = 'detail-actions';
    let actions = document.getElementById(actionsContainerId);
    if (!actions) {
        actions = document.createElement('div');
        actions.id = actionsContainerId;
        actions.className = 'detail-actions';
        const header = document.querySelector('.detail-card .detail-header');
        if (header) header.appendChild(actions);
    }
    actions.innerHTML = `
        <div class="detail-action-buttons">
            <button class="btn btn-outline" id="save-collection-btn">Save to Collection</button>
            <button class="btn btn-outline" id="add-note-btn">Add Note</button>
            <button class="btn btn-primary" id="plan-trip-btn">Plan Trip</button>
        </div>
    `;

    const saveBtn = document.getElementById('save-collection-btn');
    const noteBtn = document.getElementById('add-note-btn');
    const planBtn = document.getElementById('plan-trip-btn');

    if (saveBtn) saveBtn.onclick = () => savePlaceToCollection(selectedPlace.id);
    if (noteBtn) noteBtn.onclick = () => {
        const note = prompt('Add a private note for this place:');
        if (note) addNoteToPlace(selectedPlace.id, note);
    };
    if (planBtn) planBtn.onclick = () => organizeTrip(selectedPlace.id);

    loadPlaceReviews(selectedPlace.id);
    userRating = 0;
    highlightStars(0);
    const reviewText = document.getElementById('review-text');
    if (reviewText) reviewText.value = '';

    placeDetailModal.classList.add('active');
}

function closePlaceDetail() {
    placeDetailModal.classList.remove('active');
    selectedPlace = null;
    currentPlaceReviews = [];
}

async function loadPlaceReviews(placeId) {
    try {
        const response = await fetch(`../../PHP/places.php?action=get_reviews&place_id=${encodeURIComponent(placeId)}`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Unable to load reviews.');
        }
        currentPlaceReviews = data.reviews || [];
    } catch (error) {
        currentPlaceReviews = [];
    }

    renderReviews();
}

function renderReviews() {
    const reviewCount = document.getElementById('review-count');
    const reviewsList = document.getElementById('reviews-list');
    if (!reviewCount || !reviewsList) return;

    reviewCount.textContent = `(${currentPlaceReviews.length})`;

    if (currentPlaceReviews.length === 0) {
        reviewsList.innerHTML = '<p class="empty-state">No reviews yet. Be the first to review this place.</p>';
        return;
    }

    reviewsList.innerHTML = currentPlaceReviews.map(review => {
        const author = review.author || 'Traveler';
        const avatar = review.avatar
            ? `<img src="../../PHP/serve_image.php?path=${encodeURIComponent(review.avatar)}" alt="${escapeHtml(author)}'s profile photo">`
            : `<span aria-hidden="true">${escapeHtml(author.charAt(0).toUpperCase())}</span>`;
        return `
        <div class="review-item">
            <div class="review-header">
                <div class="review-avatar">${avatar}</div>
                <div class="review-info">
                    <div class="review-top">
                        <div>
                            <h4 class="review-author">${escapeHtml(author)}</h4>
                            <div class="review-date">${formatDate(review.createdAt)}</div>
                        </div>
                        <span class="rating-badge rating-badge-sm">${Number(review.rating || 0)}/5</span>
                    </div>
                    <p class="review-text">${escapeHtml(review.comment || '')}</p>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

function setRating(rating) {
    userRating = rating;
    highlightStars(rating);
}

function highlightStars(rating) {
    if (!starRating) return;
    const starBtns = starRating.querySelectorAll('.star-btn');
    starBtns.forEach((btn, index) => {
        btn.classList.toggle('active', index < rating);
    });
}

async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!isUserLoggedIn()) { window.location.href = 'login.html'; return; }
    if (!selectedPlace) return;
    const reviewText = document.getElementById('review-text').value;

    if (userRating === 0) {
        alert('Please select a rating');
        return;
    }

    const formData = new FormData();
    formData.append('action', 'submit_review');
    formData.append('place_id', selectedPlace.id);
    formData.append('rating', userRating);
    formData.append('comment', reviewText.trim());

    const response = await fetch('../../PHP/places.php', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
        alert(data.message || 'Unable to submit review.');
        return;
    }

    try {
        places = await loadApprovedPlaces();
        refreshCategories();
        renderCategories();
        renderPlaces();
        renderSpotlight();
        selectedPlace = places.find(place => Number(place.id) === Number(selectedPlace.id)) || selectedPlace;
    } catch (error) {
        // Keep current UI state if place reload fails.
    }
    await loadPlaceReviews(selectedPlace.id);
    updateStats();
    if (typeof showToast === 'function') {
        showToast('Review submitted successfully!', 'fa-check');
    }
    userRating = 0;
    highlightStars(0);
    document.getElementById('review-text').value = '';
}

// ===== FORM FUNCTIONALITY =====
const form = document.getElementById('placeForm');
const pages = form ? [...form.querySelectorAll('.page')] : [];
const steps = form ? [...form.querySelectorAll('.step')] : [];
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const publishBtn = document.getElementById('publishBtn');
let current = 1;
const total = pages.length;

// File uploads - declared at top level so validateStep can access
let coverFile = null;
let galleryFiles = [];

function showStep(n) {
    current = n;
    pages.forEach(p => p.classList.toggle('active', +p.dataset.page === n));
    steps.forEach(s => {
        const sn = +s.dataset.step;
        s.classList.toggle('active', sn === n);
        s.classList.toggle('done', sn < n);
    });
    if (prevBtn) prevBtn.disabled = n === 1;
    if (nextBtn) nextBtn.style.display = n === total ? 'none' : 'inline-flex';
    if (publishBtn) publishBtn.style.display = n === total ? 'inline-flex' : 'none';
}

function validateStep(n) {
    const page = pages[n - 1];
    if (!page) return true;
    let ok = true;
    page.querySelectorAll('[required]').forEach(el => {
        const wrap = el.closest('.field');
        const err = wrap?.querySelector('.err-msg');
        const bad = !el.value.trim();
        el.classList.toggle('error', bad);
        if (err) err.classList.toggle('show', bad);
        if (bad) ok = false;
    });
    if (n === 1 && !document.getElementById('categoryInput').value) {
        const err = document.querySelector('#chips')?.parentElement.querySelector('.err-msg');
        if (err) err.classList.add('show');
        ok = false;
    }
    if (n === 3 && coverFile == null) {
        const drop = document.getElementById('coverDrop');
        if (drop) drop.parentElement.querySelector('.err-msg').classList.add('show');
        ok = false;
    }
    return ok;
}

// ===== MAP LOCATION PICKER =====
let locationMap;
let locationMarker;
let pendingLocation;
let userLocationMarker;
let locationRouteLine;
let currentUserLocation;
let routeRequestId = 0;

function formatMapDistance(meters) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km` : `${Math.round(meters)} m`;
}

function formatMapDuration(seconds) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60 ? `${minutes % 60} min` : ''}` : `${minutes} min`;
}

function straightLineDistance(lat1, lng1, lat2, lng2) {
    const radians = value => value * Math.PI / 180;
    const earthRadius = 6371000;
    const latDelta = radians(lat2 - lat1);
    const lngDelta = radians(lng2 - lng1);
    const a = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(lngDelta / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function setRouteSummary(message = '', isVisible = false) {
    const summary = document.getElementById('mapRouteSummary');
    if (!summary) return;
    summary.textContent = message;
    summary.hidden = !isVisible;
}

function clearRouteLine() {
    if (locationRouteLine && locationMap) locationMap.removeLayer(locationRouteLine);
    locationRouteLine = null;
}

function setMapLocation(lat, lng, label = 'Selected location') {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    pendingLocation = { lat: latitude, lng: longitude, label };
    if (locationMap && window.L) {
        if (locationMarker) locationMarker.setLatLng([latitude, longitude]);
        else locationMarker = L.marker([latitude, longitude]).addTo(locationMap);
        locationMarker.bindPopup(`<strong>Destination</strong><br>${escapeHtml(label)}`);
        locationMap.setView([latitude, longitude], Math.max(locationMap.getZoom(), 13));
    }
    const coords = document.getElementById('mapSelectionCoords');
    const selected = document.getElementById('mapSelectionLabel');
    if (coords) coords.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    if (selected) selected.textContent = label;
    updateRoutePreview();
}

function initialiseLocationMap() {
    const canvas = document.getElementById('mapPickerCanvas');
    if (!canvas || locationMap || !window.L) return;

    locationMap = L.map(canvas).setView([28.3949, 84.1240], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(locationMap);
    locationMap.on('click', event => setMapLocation(event.latlng.lat, event.latlng.lng, 'Pinned location'));
}

function clearMapLocation() {
    pendingLocation = null;
    if (locationMarker && locationMap) locationMap.removeLayer(locationMarker);
    locationMarker = null;
    clearRouteLine();
    routeRequestId++;
    const label = document.getElementById('mapSelectionLabel');
    const coords = document.getElementById('mapSelectionCoords');
    if (label) label.textContent = 'Click the map or choose a search result to place a pin.';
    if (coords) coords.textContent = 'No location selected yet.';
    setRouteSummary('', false);
    const savedLabel = document.getElementById('selectedMapLocation');
    if (savedLabel) savedLabel.textContent = 'No map location selected yet.';
    ['mapLatitude', 'mapLongitude', 'mapUrl'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
}

async function updateRoutePreview() {
    if (!pendingLocation || !currentUserLocation) return;
    const requestId = ++routeRequestId;
    setRouteSummary('Calculating driving distance and travel time…', true);
    clearRouteLine();

    try {
        const params = new URLSearchParams({
            action: 'route',
            origin_lat: currentUserLocation.lat,
            origin_lng: currentUserLocation.lng,
            destination_lat: pendingLocation.lat,
            destination_lng: pendingLocation.lng
        });
        const response = await fetch(`../../PHP/map.php?${params}`);
        const data = await response.json();
        if (requestId !== routeRequestId) return;
        if (!response.ok || !data.success) throw new Error(data.message || 'Route unavailable');

        setRouteSummary(`From your current location: ${formatMapDistance(data.distance_meters)} by road · about ${formatMapDuration(data.duration_seconds)} by car`, true);
        if (locationMap && window.L && data.geometry?.coordinates?.length) {
            locationRouteLine = L.geoJSON(data.geometry, { style: { color: '#1d7357', weight: 5, opacity: 0.8 } }).addTo(locationMap);
            const bounds = locationRouteLine.getBounds();
            if (bounds.isValid()) locationMap.fitBounds(bounds, { padding: [35, 35] });
        }
    } catch (error) {
        if (requestId !== routeRequestId) return;
        const directDistance = straightLineDistance(currentUserLocation.lat, currentUserLocation.lng, pendingLocation.lat, pendingLocation.lng);
        setRouteSummary(`Straight-line distance from your location: ${formatMapDistance(directDistance)}. Driving time is currently unavailable.`, true);
    }
}

function renderMapSearchResults(results) {
    const container = document.getElementById('mapSearchResults');
    if (!container) return;
    container.replaceChildren();
    container.hidden = false;

    if (!results.length) {
        const message = document.createElement('p');
        message.className = 'helper';
        message.textContent = 'No locations found. Try a landmark, municipality, or district name.';
        container.appendChild(message);
        return;
    }

    results.forEach(result => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'map-search-result';
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-location-dot';
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.textContent = result.label;
        button.append(icon, label);
        button.addEventListener('click', () => {
            setMapLocation(result.lat, result.lng, result.label);
            container.hidden = true;
            container.replaceChildren();
        });
        container.appendChild(button);
    });
}

function useCurrentMapLocation(button) {
    if (!navigator.geolocation) {
        showToast('Your browser does not support location access.', 'fa-triangle-exclamation');
        return;
    }
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Finding you…';
    navigator.geolocation.getCurrentPosition(position => {
        const { latitude: lat, longitude: lng } = position.coords;
        currentUserLocation = { lat, lng };
        if (locationMap && window.L) {
            if (userLocationMarker) userLocationMarker.setLatLng([lat, lng]);
            else userLocationMarker = L.circleMarker([lat, lng], { radius: 8, color: '#9a7142', fillColor: '#9a7142', fillOpacity: 1, weight: 2 }).addTo(locationMap);
            userLocationMarker.bindPopup('Your current location');
            if (!pendingLocation) locationMap.setView([lat, lng], 14);
        }
        button.disabled = false;
        button.innerHTML = originalText;
        if (pendingLocation) updateRoutePreview();
        else setRouteSummary('Your current location is ready. Choose a destination to see distance and driving time.', true);
    }, () => {
        button.disabled = false;
        button.innerHTML = originalText;
        showToast('We could not access your location. Allow location permission and try again.', 'fa-triangle-exclamation');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
}

function setupMapPicker() {
    const modal = document.getElementById('mapPickerModal');
    const openButton = document.getElementById('openMapPickerBtn');
    const closeButtons = [document.getElementById('closeMapPickerBtn'), document.getElementById('mapPickerCancelBtn')];
    const useButton = document.getElementById('useMapLocationBtn');
    const searchInput = document.getElementById('mapSearchInput');
    const searchButton = document.getElementById('mapSearchBtn');
    const myLocationButton = document.getElementById('mapMyLocationBtn');
    const clearButton = document.getElementById('clearMapLocationBtn');

    if (!modal || !openButton) return;
    const close = () => {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    };
    const open = () => {
        initialiseLocationMap();
        if (!locationMap) {
            showToast('Map could not be loaded. Please check your internet connection.', 'fa-triangle-exclamation');
            return;
        }
        const savedLat = document.getElementById('mapLatitude')?.value;
        const savedLng = document.getElementById('mapLongitude')?.value;
        if (savedLat && savedLng) setMapLocation(savedLat, savedLng, 'Current selected location');
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => locationMap.invalidateSize(), 100);
    };
    const search = async () => {
        const query = searchInput?.value.trim();
        if (!query) return;
        searchButton.disabled = true;
        searchButton.textContent = 'Searching…';
        try {
            const response = await fetch(`../../PHP/map.php?action=search&q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'not found');
            renderMapSearchResults(data.results || []);
        } catch (error) {
            showToast(error.message || 'Location search failed. Please try again.', 'fa-triangle-exclamation');
        } finally {
            searchButton.disabled = false;
            searchButton.textContent = 'Search';
        }
    };

    openButton.addEventListener('click', open);
    closeButtons.forEach(button => button?.addEventListener('click', close));
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    useButton?.addEventListener('click', () => {
        if (!pendingLocation) {
            showToast('Click the map or search for a location first.', 'fa-triangle-exclamation');
            return;
        }
        document.getElementById('mapLatitude').value = pendingLocation.lat.toFixed(7);
        document.getElementById('mapLongitude').value = pendingLocation.lng.toFixed(7);
        document.getElementById('mapUrl').value = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${pendingLocation.lat},${pendingLocation.lng}`)}`;
        document.getElementById('selectedMapLocation').textContent = `Location selected: ${pendingLocation.label} (${pendingLocation.lat.toFixed(6)}, ${pendingLocation.lng.toFixed(6)})`;
        close();
    });
    searchButton?.addEventListener('click', search);
    myLocationButton?.addEventListener('click', () => useCurrentMapLocation(myLocationButton));
    clearButton?.addEventListener('click', clearMapLocation);
    searchInput?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); search(); } });
}

if (form) {
    setupMapPicker();
    if (nextBtn) nextBtn.addEventListener('click', () => { if (validateStep(current)) showStep(Math.min(current + 1, total)); });
    if (prevBtn) prevBtn.addEventListener('click', () => showStep(Math.max(current - 1, 1)));
    steps.forEach(s => s.addEventListener('click', () => {
        const target = +s.dataset.step;
        if (target < current || validateStep(current)) showStep(target);
    }));

    // Chips
    document.querySelectorAll('#chips .chip').forEach(c => {
        c.addEventListener('click', () => {
            document.querySelectorAll('#chips .chip').forEach(x => x.classList.remove('active'));
            c.classList.add('active');
            document.getElementById('categoryInput').value = c.dataset.cat;
            const err = document.querySelector('#chips')?.parentElement.querySelector('.err-msg');
            if (err) err.classList.remove('show');
        });
    });

    // Uploads setup
    function setupDrop(dropId, inputId, isMulti, onFiles) {
        const drop = document.getElementById(dropId);
        const input = document.getElementById(inputId);
        if (!drop || !input) return;
        drop.addEventListener('click', () => input.click());
        drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
        drop.addEventListener('drop', e => {
            e.preventDefault();
            drop.classList.remove('drag');
            onFiles([...e.dataTransfer.files]);
        });
        input.addEventListener('change', e => onFiles([...e.target.files]));
    }

    function renderCover() {
        const wrap = document.getElementById('coverPreview');
        if (!wrap) return;
        wrap.innerHTML = '';
        if (!coverFile) return;
        const url = URL.createObjectURL(coverFile);
        wrap.innerHTML = `<div class="preview"><img src="${url}"><button type="button" data-x>×</button></div>`;
        wrap.querySelector('[data-x]').onclick = () => { coverFile = null; renderCover(); };
    }

    function renderGallery() {
        const wrap = document.getElementById('galleryPreview');
        if (!wrap) return;
        wrap.innerHTML = '';
        galleryFiles.forEach((f, i) => {
            const url = URL.createObjectURL(f);
            const div = document.createElement('div');
            div.className = 'preview';
            div.innerHTML = `<img src="${url}"><button type="button">×</button>`;
            div.querySelector('button').onclick = () => { galleryFiles.splice(i, 1); renderGallery(); };
            wrap.appendChild(div);
        });
    }

    setupDrop('coverDrop', 'coverInput', false, (files) => {
        if (files[0]) {
            coverFile = files[0];
            renderCover();
            const err = document.getElementById('coverDrop')?.parentElement.querySelector('.err-msg');
            if (err) err.classList.remove('show');
        }
    });

    setupDrop('galleryDrop', 'galleryInput', true, (files) => {
        galleryFiles = galleryFiles.concat(files);
        renderGallery();
    });

    // Cancel & Draft
    const cancelBtn = document.getElementById('cancelBtn');
    const draftBtn = document.getElementById('draftBtn');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (confirm('Discard this submission?')) {
                form.reset();
                coverFile = null;
                galleryFiles = [];
                renderCover();
                renderGallery();
                document.querySelectorAll('#chips .chip').forEach(c => c.classList.remove('active'));
                document.getElementById('categoryInput').value = '';
                showStep(1);
            }
        });
    }

    if (draftBtn) {
        draftBtn.addEventListener('click', () => {
            showToast('Draft saved locally', 'fa-bookmark');
        });
    }

    // Submit
    form.addEventListener('submit', async e => {
        e.preventDefault();
        let all = true;
        for (let i = 1; i <= total; i++) {
            if (!validateStep(i)) {
                showStep(i);
                all = false;
                break;
            }
        }
        if (!all) return;
        let submittedPlace = null;
        try {
            submittedPlace = await submitPlaceForApproval(form);
        } catch (error) {
            showToast(error.message || 'Unable to submit place.', 'fa-triangle-exclamation');
        }
        if (!submittedPlace) return;
        showToast('Submitted for admin approval!', 'fa-check');
        form.reset();
        coverFile = null;
        galleryFiles = [];
        renderCover();
        renderGallery();
        document.querySelectorAll('#chips .chip').forEach(c => c.classList.remove('active'));
        document.getElementById('categoryInput').value = '';
        showStep(1);
        closeAddPlaceModal();
    });

    function showToast(msg, icon) {
        const t = document.getElementById('toast');
        if (!t) return;
        document.body.appendChild(t);
        t.querySelector('div strong').textContent = msg;
        t.querySelector('i').className = `fa-solid ${icon || 'fa-check'}`;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2800);
    }

    // Clear errors on input
    form.addEventListener('input', e => {
        if (e.target.matches('.input,.select,.textarea')) {
            e.target.classList.remove('error');
            const err = e.target.closest('.field')?.querySelector('.err-msg');
            if (err) err.classList.remove('show');
        }
    });
}

// Start the app
init();
