function escapeHtml(value = '') {
    if (value === null || value === undefined) return '';
    return value.toString().replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

const state = {
    activeFeature: 'saved',
    places: [],
    travel: { saved: [], trips: [], notes: [] }
};
state.user = { avatar: '' };

const els = {
    avatar: document.getElementById('profile-avatar'),
    name: document.getElementById('profile-name'),
    role: document.getElementById('profile-role'),
    savedCount: document.getElementById('saved-count'),
    tripCount: document.getElementById('trip-count'),
    noteCount: document.getElementById('note-count'),
    tabs: document.getElementById('profile-tabs'),
    boardTitle: document.getElementById('board-title'),
    boardSubtitle: document.getElementById('board-subtitle'),
    boardGrid: document.getElementById('profile-board-grid'),
    status: document.getElementById('profile-status'),
    search: document.getElementById('profile-search'),
    editModal: document.getElementById('place-edit-modal'),
    editForm: document.getElementById('place-edit-form'),
    editPlaceId: document.getElementById('edit-place-id'),
    editPlaceName: document.getElementById('edit-place-name'),
    editPlaceCategory: document.getElementById('edit-place-category'),
    editPlaceProvince: document.getElementById('edit-place-province'),
    editPlaceDistrict: document.getElementById('edit-place-district'),
    editPlaceMunicipality: document.getElementById('edit-place-municipality'),
    editPlaceDescription: document.getElementById('edit-place-description'),
    editPlaceStart: document.getElementById('edit-place-start'),
    editPlaceRoute: document.getElementById('edit-place-route'),
    editPlaceDestination: document.getElementById('edit-place-destination'),
    avatarInput: document.getElementById('avatar-input'),
    notifButton: document.getElementById('profile-notif-btn'),
    notifBadge: document.getElementById('profile-notif-badge'),
    notifPanel: document.getElementById('profile-notification-panel'),
    notifList: document.getElementById('profile-notification-list'),
    notifMarkAll: document.getElementById('profile-notif-mark-all'),
    placeSelect: document.getElementById('quick-place-select'),
    noteText: document.getElementById('quick-note-text'),
    quickSave: document.getElementById('quick-save-btn'),
    quickPlan: document.getElementById('quick-plan-btn'),
    quickNote: document.getElementById('quick-note-btn'),
    refresh: document.getElementById('refresh-profile-btn'),
    logout: document.getElementById('profile-logout-btn'),
    toast: document.getElementById('profile-toast')
};

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return '';
}

function isUserLoggedIn() {
    return Boolean(localStorage.getItem('isAdmin') === 'true' || localStorage.getItem('userRole') || getCookie('userRole'));
}

function getUserName() {
    return localStorage.getItem('userName') || getCookie('userName') || 'Traveler';
}

function getUserRole() {
    return localStorage.getItem('userRole') || getCookie('userRole') || 'User';
}

function normalizePlace(place) {
    return {
        id: Number(place.id),
        name: place.name || `Place ${place.id}`,
        category: place.category || 'Destination',
        district: place.district || '',
        province: place.province || '',
        location: place.location || [place.district, place.province].filter(Boolean).join(', ') || 'Nepal',
        rating: Number(place.rating) || 0,
        coverImage: place.coverImage || place.cover_image || ''
    };
}

function getPlace(placeId) {
    return state.places.find(place => Number(place.id) === Number(placeId));
}

function getPlaceName(placeId) {
    return getPlace(placeId)?.name || `Place ${placeId}`;
}

function formatDate(value) {
    if (!value) return 'Recently updated';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently updated';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function setStatus(message) {
    if (els.status) els.status.textContent = message;
}

function showToast(message, icon = 'fa-check') {
    if (!els.toast) return;
    els.toast.querySelector('strong').textContent = message;
    els.toast.querySelector('i').className = `fa-solid ${icon}`;
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 2600);
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    if (response.status === 401) {
        window.location.href = 'login.html';
        return null;
    }
    return response.json();
}

async function loadPlaces() {
    const data = await fetchJson('../../PHP/places.php?action=approved');
    state.places = data?.success ? (data.places || []).map(normalizePlace) : [];
    renderPlaceSelect();
}

async function loadTravelBoard() {
    setStatus('Loading your travel board...');
    const data = await fetchJson('../../PHP/travel.php?action=get');
    if (!data) return;
    if (!data.success) {
        setStatus(data.message || 'Unable to load your profile board.');
        return;
    }

    state.travel = {
        saved: data.saved || [],
        trips: data.trips || [],
        notes: data.notes || []
    };

    updateCounts();
    renderBoard();
}

function renderIdentity() {
    const userName = getUserName();
    const userRole = getUserRole();
    if (els.name) els.name.textContent = userName;
    if (els.role) els.role.textContent = `${userRole.charAt(0).toUpperCase()}${userRole.slice(1)} account`;
    if (els.avatar) {
        if (state.user.avatar) {
            els.avatar.style.backgroundImage = `url(../../PHP/serve_image.php?path=${encodeURIComponent(state.user.avatar)})`;
            els.avatar.classList.add('with-image');
        } else {
            els.avatar.style.backgroundImage = '';
            els.avatar.classList.remove('with-image');
        }
        const initial = document.getElementById('profile-avatar-initial');
        if (initial) {
            initial.textContent = Array.from(userName.trim())[0]?.toUpperCase() || 'T';
        }
    }
}

function updateCounts() {
    if (els.savedCount) els.savedCount.textContent = state.travel.saved.length;
    if (els.tripCount) els.tripCount.textContent = state.travel.trips.length;
    if (els.noteCount) els.noteCount.textContent = state.travel.notes.length;
}

function renderPlaceSelect() {
    if (!els.placeSelect) return;
    if (state.places.length === 0) {
        els.placeSelect.innerHTML = '<option value="">No approved places found</option>';
        return;
    }

    els.placeSelect.innerHTML = [
        '<option value="">Choose a destination</option>',
        ...state.places.map(place => `<option value="${place.id}">${escapeHtml(place.name)}</option>`)
    ].join('');
}

function setActiveFeature(feature) {
    state.activeFeature = feature;
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.feature === feature);
    });
    renderBoard();
}

function getBoardConfig() {
    const configs = {
        saved: {
            title: 'Saved Places',
            subtitle: 'Places you want to keep close for later.',
            empty: 'No saved places yet. Use Quick Add or open a destination and save it.',
            status: 'Saved places loaded.',
            items: state.travel.saved.map(item => ({
                key: `saved-${item.place_id}`,
                icon: 'fa-bookmark',
                title: getPlaceName(item.place_id),
                meta: `Saved ${formatDate(item.saved_at)}`,
                placeId: item.place_id,
                action: 'remove_saved',
                actionLabel: 'Remove'
            }))
        },
        trips: {
            title: 'Future Trips',
            subtitle: 'Destinations you are planning to visit.',
            empty: 'No future trips yet. Add one from Quick Add.',
            status: 'Future trips loaded.',
            items: state.travel.trips.map(item => ({
                key: `trip-${item.place_id}`,
                icon: 'fa-calendar-days',
                title: getPlaceName(item.place_id),
                meta: `Planned ${formatDate(item.planned_at)}`,
                placeId: item.place_id,
                action: 'remove_trip',
                actionLabel: 'Remove'
            }))
        },
        notes: {
            title: 'Trip Notes',
            subtitle: 'Private reminders, ideas, and planning details.',
            empty: 'No notes yet. Write one from Quick Add.',
            status: 'Trip notes loaded.',
            items: state.travel.notes.map(note => ({
                key: `note-${note.id}`,
                icon: 'fa-note-sticky',
                title: note.note_text,
                meta: `${getPlaceName(note.place_id)} - ${formatDate(note.created_at)}`,
                noteId: note.id,
                action: 'delete_note',
                actionLabel: 'Delete'
            }))
        },
        pending: {
            title: 'Pending Approval',
            subtitle: 'Destinations you submitted that are waiting for an admin decision.',
            empty: 'You have no destinations waiting for approval.',
            status: 'Pending submissions loaded.',
            items: (state.travel.pending || []).map(place => ({
                key: `pending-${place.id}`,
                icon: 'fa-hourglass-half',
                title: place.name || `Destination ${place.id}`,
                meta: `Submitted ${formatDate(place.submitted_at)}`,
                actionLabel: 'Awaiting approval'
            }))
        },
        places: {
            title: 'Your Places',
            subtitle: 'Destinations you submitted',
            empty: 'You have not submitted any places yet.',
            status: 'Your submitted places loaded.',
            items: (state.travel.places || []).map(place => ({
                key: `place-${place.id}`,
                icon: 'fa-map-location-dot',
                title: place.name || `Place ${place.id}`,
                meta: `${(place.status||'pending').charAt(0).toUpperCase() + (place.status||'pending').slice(1)} • Submitted ${formatDate(place.submitted_at)}`,
                placeId: place.id,
                action: 'delete_mine',
                actionLabel: 'Remove'
            }))
        },
        tools: {
            title: 'Travel Tools',
            subtitle: 'Useful shortcuts for shaping your next route.',
            empty: '',
            status: 'Travel tools ready.',
            items: [
                { key: 'tool-explore', icon: 'fa-compass', title: 'Explore destinations', meta: 'Browse all approved places.', href: 'index.html' },
                { key: 'tool-add', icon: 'fa-plus', title: 'Add destination', meta: 'Open the add place form from the home page.', href: 'index.html#add-place' },
                { key: 'tool-refresh', icon: 'fa-rotate-right', title: 'Refresh board', meta: 'Sync saved places, trips, and notes.', action: 'refresh', actionLabel: 'Refresh' }
            ]
        }
    };
    return configs[state.activeFeature] || configs.saved;
}

function renderBoard() {
    if (!els.boardGrid) return;
    const config = getBoardConfig();
    const query = (els.search?.value || '').trim().toLowerCase();
    const items = query
        ? config.items.filter(item => `${item.title} ${item.meta}`.toLowerCase().includes(query))
        : config.items;

    if (els.boardTitle) els.boardTitle.textContent = config.title;
    if (els.boardSubtitle) els.boardSubtitle.textContent = config.subtitle;
    setStatus(config.status);

    if (items.length === 0) {
        els.boardGrid.innerHTML = `<div class="profile-empty-state">${escapeHtml(query ? 'No matching items found.' : config.empty)}</div>`;
        return;
    }

    els.boardGrid.innerHTML = items.map(renderBoardCard).join('');
}

function renderBoardCard(item) {
    const button = item.href
        ? `<a class="profile-card-action" href="${item.href}">Open</a>`
        : item.action
            ? `<button class="profile-card-action" type="button" data-action="${item.action}" data-place-id="${item.placeId || ''}" data-note-id="${item.noteId || ''}">${item.actionLabel || 'Open'}</button>`
            : `<span class="profile-card-action profile-card-static">${item.actionLabel || 'Pending'}</span>`;

    return `
        <article class="profile-board-card">
            <div class="profile-board-card-icon"><i class="fa-solid ${item.icon}"></i></div>
            <div class="profile-board-card-body">
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.meta)}</p>
            </div>
            ${button}
        </article>
    `;
}

async function postTravelAction(action, payload = {}) {
    const formData = new FormData();
    formData.append('action', action);
    Object.entries(payload).forEach(([key, value]) => formData.append(key, value));

    const data = await fetchJson('../../PHP/travel.php', {
        method: 'POST',
        body: formData
    });

    if (!data) return false;
    if (!data.success) {
        showToast(data.message || 'Action failed.', 'fa-triangle-exclamation');
        return false;
    }

    showToast(data.message || 'Profile updated.');
    await loadTravelBoard();
    // reload user's submitted places when relevant
    if (['delete_mine','update_mine','submit'].includes(action)) {
        await loadMyPlaces();
        renderBoard();
    }
    return true;
}

async function loadMyPlaces() {
    const data = await fetchJson('../../PHP/places.php?action=mine');
    if (!data?.success) return;
    state.travel.places = data.places || [];
}

function getSelectedPlaceId() {
    const placeId = els.placeSelect?.value || '';
    if (!placeId) {
        showToast('Choose a destination first.', 'fa-triangle-exclamation');
        return '';
    }
    return placeId;
}

async function handleBoardAction(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    if (action === 'refresh') {
        await loadTravelBoard();
        showToast('Profile board refreshed.');
        return;
    }

    if (action === 'delete_note') {
        await postTravelAction(action, { note_id: button.dataset.noteId });
        return;
    }

    if (action === 'remove_saved' || action === 'remove_trip') {
        await postTravelAction(action, { place_id: button.dataset.placeId });
        return;
    }

    if (action === 'delete_mine') {
        const placeId = button.dataset.placeId;
        if (!placeId) return;
        if (!confirm('Delete this place submission? This cannot be undone.')) return;

        // call places.php delete_mine
        const form = new FormData();
        form.append('action', 'delete_mine');
        form.append('place_id', placeId);
        const data = await fetchJson('../../PHP/places.php', { method: 'POST', body: form });
        if (!data) return;
        if (!data.success) {
            showToast(data.message || 'Unable to delete place.', 'fa-triangle-exclamation');
            return;
        }

        showToast(data.message || 'Place deleted.');
        await loadMyPlaces();
        renderBoard();
        // also refresh travel board in case saved/trips reference removed place
        await loadTravelBoard();
        return;
    }
}

async function logout() {
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
    window.location.href = 'login.html';
}

function bindEvents() {
    els.tabs?.addEventListener('click', event => {
        const tab = event.target.closest('.profile-tab');
        if (tab) setActiveFeature(tab.dataset.feature);
    });
    els.boardGrid?.addEventListener('click', handleBoardAction);
    els.search?.addEventListener('input', renderBoard);
    els.refresh?.addEventListener('click', async () => {
        await loadTravelBoard();
        showToast('Profile board refreshed.');
    });
    els.logout?.addEventListener('click', logout);
    els.quickSave?.addEventListener('click', () => {
        const placeId = getSelectedPlaceId();
        if (placeId) postTravelAction('save_place', { place_id: placeId }).then(() => setActiveFeature('saved'));
    });
    els.quickPlan?.addEventListener('click', () => {
        const placeId = getSelectedPlaceId();
        if (placeId) postTravelAction('plan_trip', { place_id: placeId }).then(() => setActiveFeature('trips'));
    });
    els.quickNote?.addEventListener('click', async () => {
        const placeId = getSelectedPlaceId();
        const note = els.noteText?.value.trim() || '';
        if (!placeId) return;
        if (!note) {
            showToast('Write a note first.', 'fa-triangle-exclamation');
            return;
        }

        const saved = await postTravelAction('add_note', { place_id: placeId, note_text: note });
        if (saved && els.noteText) els.noteText.value = '';
        if (saved) setActiveFeature('notes');
    });
}


async function initProfile() {

     if (!isUserLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    renderIdentity();
    bindEvents();
    bindAvatarUpload();
    bindNotifications();
    await loadPlaces();
    await loadTravelBoard();
    await loadUserInfo();
    await loadMyPlaces();
    renderBoard();
    await loadNotifications();
}

async function loadUserInfo() {
    const data = await fetchJson('../../PHP/user.php?action=me');
    if (!data?.success) return;
    state.user = data.user || { avatar: '' };
    state.travel.pending = data.pending || [];
    renderIdentity();
    renderBoard();
}

function bindAvatarUpload() {
    els.avatarInput?.addEventListener('change', async event => {
        const image = event.target.files?.[0];
        if (!image) return;
        if (image.size > 5 * 1024 * 1024) { showToast('Profile image must be under 5 MB.', 'fa-triangle-exclamation'); return; }
        const upload = new FormData(); upload.append('image', image);
        const result = await fetchJson('../../PHP/upload.php', { method: 'POST', body: upload });
        if (!result?.success) { showToast(result?.message || 'Image upload failed.', 'fa-triangle-exclamation'); return; }
        const update = new FormData(); update.append('action', 'update_avatar'); update.append('avatar', result.image_path);
        const saved = await fetchJson('../../PHP/user.php', { method: 'POST', body: update });
        if (!saved?.success) { showToast(saved?.message || 'Unable to save profile image.', 'fa-triangle-exclamation'); return; }
        state.user.avatar = saved.avatar; renderIdentity(); showToast('Profile image updated.'); event.target.value = '';
    });
}

function notificationText(note) {
    const name = escapeHtml(note.data?.place_name || 'your destination');
    if (note.type === 'place_approved') return `Your destination “${name}” was approved.`;
    if (note.type === 'place_rejected') return `Your destination “${name}” was not approved.`;
    if (note.type === 'new_review') return `Someone reviewed “${name}”.`;
    if (note.type === 'place_submitted') return `Your destination “${name}” is awaiting approval.`;
    return 'You have a new notification.';
}
async function loadNotifications() {
    const data = await fetchJson('../../PHP/notifications.php?action=get');
    if (!data?.success) return;
    const unread = Number(data.unread || 0); els.notifBadge.hidden = unread === 0; els.notifBadge.textContent = String(unread);
    els.notifList.innerHTML = (data.notifications || []).map(note => `<article class="notification-item ${note.is_read ? '' : 'unread'}"><div><strong>${notificationText(note)}</strong><small>${escapeHtml(formatDate(note.created_at))}</small></div>${note.is_read ? '' : `<button class="notification-mark-all" data-note-id="${note.id}" type="button">Mark read</button>`}</article>`).join('') || '<p class="empty-state">No notifications yet.</p>';
}
function bindNotifications() {
    els.notifButton?.addEventListener('click', async () => {
        const isHidden = els.notifPanel.hasAttribute('hidden');
        if (isHidden) {
            els.notifPanel.removeAttribute('hidden');
            els.notifPanel.setAttribute('aria-hidden', 'false');
            try { await loadNotifications(); } catch (error) { els.notifList.innerHTML = '<p class="empty-state">No notifications yet.</p>'; }
        } else {
            els.notifPanel.setAttribute('hidden', '');
            els.notifPanel.setAttribute('aria-hidden', 'true');
        }
    });
    els.notifList?.addEventListener('click', async event => { const button = event.target.closest('[data-note-id]'); if (!button) return; await fetchJson('../../PHP/notifications.php', { method: 'POST', body: new URLSearchParams({ action: 'mark_read', id: button.dataset.noteId }) }); await loadNotifications(); });
    els.notifMarkAll?.addEventListener('click', async () => { await fetchJson('../../PHP/notifications.php', { method: 'POST', body: new URLSearchParams({ action: 'mark_all' }) }); await loadNotifications(); });
    document.addEventListener('click', event => {
        if (!els.notifPanel || els.notifPanel.hasAttribute('hidden')) return;
        if (!els.notifPanel.parentElement.contains(event.target)) {
            els.notifPanel.setAttribute('hidden', '');
            els.notifPanel.setAttribute('aria-hidden', 'true');
        }
    });
}

initProfile();
