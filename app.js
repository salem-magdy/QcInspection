/**
 * ============================================
 * APPLICATION CONTROLLER MODULE
 * ============================================
 * This is the main entry point and orchestrator for the entire application.
 * It initializes all modules, sets up global event listeners, and manages
 * the application lifecycle.
 * 
 * Responsibilities:
 * - Initialize all modules in correct order
 * - Set up global event handlers (keyboard shortcuts, etc.)
 * - Manage theme application
 * - Handle demo data initialization
 * - Route initial page based on authentication state
 * - Set up auto-save and cleanup handlers
 * 
 * The application follows this flow:
 * 1. DOM loads
 * 2. Initialize storage (check for existing data)
 * 3. Initialize authentication (check for existing session)
 * 4. Apply saved theme
 * 5. If logged in: show app, update UI, navigate to dashboard
 * 6. If not logged in: show auth layer
 * 7. Set up global event listeners
 */

/**
 * ============================================
 * GLOBAL APPLICATION STATE
 * ============================================
 */

// Track if app has been initialized
let appInitialized = false;

// Track active timers for cleanup
let activeTimers = [];

// Auto-save interval (in milliseconds) - disabled by default for demo
let autoSaveInterval = null;

/**
 * ============================================
 * APPLICATION INITIALIZATION
 * ============================================
 */

/**
 * INITIALIZE APPLICATION
 * ============================================
 * Main entry point - called when DOM is ready.
 * Sets up everything in the correct order.
 */
function initApp() {
    console.log('🚀 Initializing QC Inspection System...');
    
    // Step 1: Initialize demo data if needed
    initializeDemoData();
    
    // Step 2: Apply saved theme
    initTheme();
    
    // Step 3: Check for existing session
    const hasValidSession = initAuth();
    
    // Step 4: Set up global event listeners
    setupGlobalEventListeners();
    
    // Step 5: Set up beforeunload handler for unsaved changes
    setupBeforeUnloadHandler();
    
    // Step 6: Set up periodic storage check
    setupStorageMonitor();
    
    // Step 7: Initialize UI components
    initUIComponents();
    
    // Step 8: If logged in, show app and load dashboard
    if (hasValidSession) {
        showApplication();
        navigate('dashboard');
    } else {
        showAuthLayer();
    }
    
    appInitialized = true;
    console.log('✅ Application initialized successfully');
}

/**
 * INITIALIZE THEME
 * ============================================
 * Loads and applies saved theme preference.
 */
function initTheme() {
    const savedTheme = getThemePreference();
    applyTheme(savedTheme);
    
    // Set toggle switch state
    const themeToggle = document.getElementById('theme-toggle-input');
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'light';
    }
}

/**
 * APPLY THEME
 * ============================================
 * Applies theme to document and saves preference.
 * 
 * @param {string} theme - 'dark' or 'light'
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    setThemePreference(theme);
}

/**
 * TOGGLE THEME
 * ============================================
 * Switches between dark and light themes.
 * Called from theme toggle button.
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    
    // Update toggle switch
    const themeToggle = document.getElementById('theme-toggle-input');
    if (themeToggle) {
        themeToggle.checked = newTheme === 'light';
    }
    
    showToast(`${newTheme === 'dark' ? 'Dark' : 'Light'} mode activated`, 'info');
}

/**
 * INITIALIZE AUTHENTICATION
 * ============================================
 * Sets up auth module and checks for existing session.
 * 
 * @returns {boolean} - True if user is logged in
 */
function initAuth() {
    // Set up auth event listeners
    setupAuthEventListeners();
    
    // Check for existing valid session
    const isValid = validateSession();
    
    if (isValid) {
        // Refresh session data
        refreshSession();
        
        // Update UI for logged-in user
        updateUIForUser();
        
        return true;
    }
    
    return false;
}

/**
 * SETUP AUTH EVENT LISTENERS
 * ============================================
 * Attaches event listeners to auth form elements.
 */
function setupAuthEventListeners() {
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const showRegisterLink = document.getElementById('show-register-link');
    const showLoginLink = document.getElementById('show-login-link');
    const loginPassword = document.getElementById('login-password');
    const regConfirm = document.getElementById('reg-confirm');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLoginSubmit);
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegisterSubmit);
    }
    
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            showRegisterForm();
        });
    }
    
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginForm();
        });
    }
    
    // Enter key support
    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLoginSubmit();
        });
    }
    
    if (regConfirm) {
        regConfirm.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleRegisterSubmit();
        });
    }
}

/**
 * SHOW APPLICATION
 * ============================================
 * Hides auth layer and shows the main application.
 */
function showApplication() {
    const authLayer = document.getElementById('auth-layer');
    if (authLayer) {
        authLayer.classList.add('hidden');
    }
}

/**
 * SHOW AUTH LAYER
 * ============================================
 * Shows the authentication layer and hides the app.
 */
function showAuthLayer() {
    const authLayer = document.getElementById('auth-layer');
    if (authLayer) {
        authLayer.classList.remove('hidden');
    }
    
    // Reset to login form
    showLoginForm();
}

/**
 * ============================================
 * GLOBAL EVENT HANDLERS
 * ============================================
 */

/**
 * SETUP GLOBAL EVENT LISTENERS
 * ============================================
 * Sets up event listeners that apply to the entire application.
 */
function setupGlobalEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);
    
    // Escape key to close modals and lightboxes
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
    
    // Click outside modals to close (optional)
    document.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
            closeAllModals();
        }
    });
    
    // Handle window resize for responsive adjustments
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            handleWindowResize();
        }, 250);
    });
    
    // Handle online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
}

/**
 * HANDLE GLOBAL KEYDOWN
 * ============================================
 * Processes keyboard shortcuts across the application.
 * 
 * Shortcuts:
 * - Ctrl/Cmd + K: Focus search
 * - Ctrl/Cmd + N: New inspection
 * - Ctrl/Cmd + D: Dashboard
 * - Ctrl/Cmd + I: Inspections list
 * - Ctrl/Cmd + H: Toggle sidebar (mobile)
 * 
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleGlobalKeydown(e) {
    // Check for Ctrl or Cmd key
    const isModifierPressed = e.ctrlKey || e.metaKey;
    
    if (!isModifierPressed) return;
    
    switch (e.key) {
        case 'k':
        case 'K':
            e.preventDefault();
            focusSearch();
            break;
        case 'n':
        case 'N':
            e.preventDefault();
            if (isLoggedIn()) {
                openCreateForm();
            }
            break;
        case 'd':
        case 'D':
            e.preventDefault();
            if (isLoggedIn()) {
                navigate('dashboard');
            }
            break;
        case 'i':
        case 'I':
            e.preventDefault();
            if (isLoggedIn()) {
                navigate('inspections');
            }
            break;
        case 'h':
        case 'H':
            e.preventDefault();
            if (window.innerWidth <= 768) {
                toggleSidebar();
            }
            break;
    }
}

/**
 * FOCUS SEARCH
 * ============================================
 * Focuses the search input on the current page.
 */
function focusSearch() {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    
    // Try to find search input on current page
    const searchInput = activePage.querySelector('.search-input');
    if (searchInput) {
        searchInput.focus();
        showToast('Search focused', 'info');
    }
}

/**
 * HANDLE WINDOW RESIZE
 * ============================================
 * Adjusts UI when window is resized.
 */
function handleWindowResize() {
    // Close sidebar on desktop if open (but not on mobile)
    if (window.innerWidth > 768) {
        closeSidebar();
    }
    
    // Re-render list to adjust for new screen size
    const activePage = document.querySelector('.page.active');
    if (activePage && activePage.id === 'page-inspections') {
        renderInspectionsList();
    }
}

/**
 * HANDLE ONLINE
 * ============================================
 * Called when browser comes back online.
 */
function handleOnline() {
    showToast('You are back online', 'success');
    // Refresh data to ensure consistency
    const activePage = document.querySelector('.page.active');
    if (activePage && activePage.id === 'page-inspections') {
        renderInspectionsList();
    } else if (activePage && activePage.id === 'page-dashboard') {
        renderDashboard();
    }
}

/**
 * HANDLE OFFLINE
 * ============================================
 * Called when browser goes offline.
 */
function handleOffline() {
    showToast('You are offline. Data will be saved locally.', 'warning');
}

/**
 * CLOSE ALL MODALS
 * ============================================
 * Closes any open modals or lightboxes.
 */
function closeAllModals() {
    // Close delete modals
    closeDeleteModal();
    closeDeleteUserModal();
    
    // Close any lightboxes
    const lightboxes = document.querySelectorAll('.lightbox');
    lightboxes.forEach(lb => lb.remove());
}

/**
 * ============================================
 * STORAGE MANAGEMENT
 * ============================================
 */

/**
 * SETUP STORAGE MONITOR
 * ============================================
 * Periodically checks storage usage and warns if nearing limit.
 */
function setupStorageMonitor() {
    // Check storage every 30 seconds
    const interval = setInterval(() => {
        const stats = getStorageStats();
        
        // Warn if storage is over 85%
        if (stats.localStorage.percent > 85) {
            showToast('⚠️ Storage nearly full. Consider exporting and deleting old records.', 'warning');
        }
        
        // Update storage display
        updateStorageDisplay();
    }, 30000);
    
    activeTimers.push(interval);
}

/**
 * SETUP BEFOREUNLOAD HANDLER
 * ============================================
 * Warns user if there are unsaved changes.
 */
function setupBeforeUnloadHandler() {
    window.addEventListener('beforeunload', (e) => {
        // Check if there are unsaved changes in the form
        if (hasUnsavedChanges()) {
            const message = 'You have unsaved changes. Are you sure you want to leave?';
            e.preventDefault();
            e.returnValue = message;
            return message;
        }
    });
}

/**
 * HAS UNSAVED CHANGES
 * ============================================
 * Checks if the current form has unsaved changes.
 * 
 * @returns {boolean} - True if there are unsaved changes
 */
function hasUnsavedChanges() {
    const activePage = document.querySelector('.page.active');
    if (!activePage || activePage.id !== 'page-new-inspection') {
        return false;
    }
    
    // Simple check: if any form field has a value
    const formInputs = activePage.querySelectorAll('.form-input');
    for (let input of formInputs) {
        if (input.value && input.value.trim() !== '') {
            return true;
        }
    }
    
    // Check if there are any defects
    const defectsList = document.getElementById('defects-list');
    if (defectsList && defectsList.children.length > 0) {
        return true;
    }
    
    return false;
}

/**
 * ============================================
 * UI COMPONENT INITIALIZATION
 * ============================================
 */

/**
 * INIT UI COMPONENTS
 * ============================================
 * Sets up interactive UI components that aren't page-specific.
 */
function initUIComponents() {
    // Set up sortable table headers
    initSortableHeaders();
    
    // Set up filter event listeners
    initFilterListeners();
    
    // Set up admin panel filters
    initAdminFilters();
    
    // Set up form buttons
    initFormButtons();
    
    // Set up modal buttons
    initModalButtons();
    
    // Set up demo data button
    initDemoDataButton();
}

/**
 * INIT SORTABLE HEADERS
 * ============================================
 * Sets up click handlers for sortable table headers.
 */
function initSortableHeaders() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        const sortCol = header.getAttribute('data-sort');
        if (sortCol) {
            // Remove any existing listeners to avoid duplicates
            const newHeader = header.cloneNode(true);
            header.parentNode.replaceChild(newHeader, header);
            newHeader.addEventListener('click', () => sortList(sortCol));
        }
    });
}

/**
 * INIT FILTER LISTENERS
 * ============================================
 * Sets up event listeners for filter inputs.
 */
function initFilterListeners() {
    const searchInput = document.getElementById('list-search');
    const statusFilter = document.getElementById('filter-status');
    const dateFrom = document.getElementById('filter-date-from');
    const dateTo = document.getElementById('filter-date-to');
    const clearFilters = document.getElementById('clear-filters');
    
    if (searchInput) {
        // Remove existing listeners
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        newSearch.addEventListener('input', () => debouncedSearch());
    }
    
    if (statusFilter) {
        const newStatus = statusFilter.cloneNode(true);
        statusFilter.parentNode.replaceChild(newStatus, statusFilter);
        newStatus.addEventListener('change', () => renderInspectionsList());
    }
    
    if (dateFrom) {
        const newDateFrom = dateFrom.cloneNode(true);
        dateFrom.parentNode.replaceChild(newDateFrom, dateFrom);
        newDateFrom.addEventListener('change', () => renderInspectionsList());
    }
    
    if (dateTo) {
        const newDateTo = dateTo.cloneNode(true);
        dateTo.parentNode.replaceChild(newDateTo, dateTo);
        newDateTo.addEventListener('change', () => renderInspectionsList());
    }
    
    if (clearFilters) {
        const newClear = clearFilters.cloneNode(true);
        clearFilters.parentNode.replaceChild(newClear, clearFilters);
        newClear.addEventListener('click', () => clearListFilters());
    }
}

/**
 * INIT ADMIN FILTERS
 * ============================================
 * Sets up event listeners for admin panel filters.
 */
function initAdminFilters() {
    const adminSearch = document.getElementById('admin-search');
    const adminRoleFilter = document.getElementById('admin-role-filter');
    
    if (adminSearch) {
        const newSearch = adminSearch.cloneNode(true);
        adminSearch.parentNode.replaceChild(newSearch, adminSearch);
        newSearch.addEventListener('input', () => renderAdminPanel());
    }
    
    if (adminRoleFilter) {
        const newFilter = adminRoleFilter.cloneNode(true);
        adminRoleFilter.parentNode.replaceChild(newFilter, adminRoleFilter);
        newFilter.addEventListener('change', () => renderAdminPanel());
    }
}

/**
 * INIT FORM BUTTONS
 * ============================================
 * Sets up event listeners for form buttons.
 */
function initFormButtons() {
    const addDefectBtn = document.getElementById('add-defect-btn');
    const saveDraftBtn = document.getElementById('save-draft-btn');
    const submitBtn = document.getElementById('submit-btn');
    const saveDraftBottom = document.getElementById('save-draft-bottom');
    const submitBottom = document.getElementById('submit-bottom');
    const createReinspBtn = document.getElementById('create-reinsp-btn');
    
    if (addDefectBtn) {
        const newBtn = addDefectBtn.cloneNode(true);
        addDefectBtn.parentNode.replaceChild(newBtn, addDefectBtn);
        newBtn.addEventListener('click', () => addDefect());
    }
    
    if (saveDraftBtn) {
        const newBtn = saveDraftBtn.cloneNode(true);
        saveDraftBtn.parentNode.replaceChild(newBtn, saveDraftBtn);
        newBtn.addEventListener('click', () => saveForm('Draft'));
    }
    
    if (submitBtn) {
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);
        newBtn.addEventListener('click', () => saveForm());
    }
    
    if (saveDraftBottom) {
        const newBtn = saveDraftBottom.cloneNode(true);
        saveDraftBottom.parentNode.replaceChild(newBtn, saveDraftBottom);
        newBtn.addEventListener('click', () => saveForm('Draft'));
    }
    
    if (submitBottom) {
        const newBtn = submitBottom.cloneNode(true);
        submitBottom.parentNode.replaceChild(newBtn, submitBottom);
        newBtn.addEventListener('click', () => saveForm());
    }
    
    if (createReinspBtn) {
        const newBtn = createReinspBtn.cloneNode(true);
        createReinspBtn.parentNode.replaceChild(newBtn, createReinspBtn);
        newBtn.addEventListener('click', () => {
            if (currentDetailId) {
                openReinspectionForm(currentDetailId);
            }
        });
    }
}

/**
 * INIT MODAL BUTTONS
 * ============================================
 * Sets up event listeners for modal buttons.
 */
function initModalButtons() {
    const cancelDelete = document.getElementById('cancel-delete-btn');
    const confirmDelete = document.getElementById('confirm-delete-btn');
    const cancelDeleteUser = document.getElementById('cancel-delete-user-btn');
    const confirmDeleteUser = document.getElementById('confirm-delete-user-btn');
    
    if (cancelDelete) {
        const newBtn = cancelDelete.cloneNode(true);
        cancelDelete.parentNode.replaceChild(newBtn, cancelDelete);
        newBtn.addEventListener('click', () => closeDeleteModal());
    }
    
    if (confirmDelete) {
        const newBtn = confirmDelete.cloneNode(true);
        confirmDelete.parentNode.replaceChild(newBtn, confirmDelete);
        newBtn.addEventListener('click', () => confirmDelete());
    }
    
    if (cancelDeleteUser) {
        const newBtn = cancelDeleteUser.cloneNode(true);
        cancelDeleteUser.parentNode.replaceChild(newBtn, cancelDeleteUser);
        newBtn.addEventListener('click', () => closeDeleteUserModal());
    }
    
    if (confirmDeleteUser) {
        const newBtn = confirmDeleteUser.cloneNode(true);
        confirmDeleteUser.parentNode.replaceChild(newBtn, confirmDeleteUser);
        newBtn.addEventListener('click', () => confirmDeleteUser());
    }
}

/**
 * INIT DEMO DATA BUTTON
 * ============================================
 * Sets up the demo data button in dashboard.
 */
function initDemoDataButton() {
    const demoButtons = document.querySelectorAll('[onclick="seedDemoData()"]');
    demoButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => seedDemoData());
    });
}

/**
 * ============================================
 * PERFORMANCE OPTIMIZATIONS
 * ============================================
 */

/**
 * DEBOUNCE FUNCTION (Wrapper)
 * ============================================
 * Creates a debounced version of renderInspectionsList.
 * This prevents excessive re-renders during rapid typing.
 */
const debouncedRenderList = debounce(() => {
    renderInspectionsList();
}, 300);

/**
 * THROTTLE FUNCTION (Wrapper)
 * ============================================
 * Creates a throttled version of storage update.
 */
const throttledStorageUpdate = throttle(() => {
    updateStorageDisplay();
}, 5000);

/**
 * ============================================
 * ERROR HANDLING
 * ============================================
 */

/**
 * GLOBAL ERROR HANDLER
 * ============================================
 * Catches unhandled errors and displays user-friendly messages.
 */
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // Don't show error for network-related issues
    if (event.message && event.message.includes('NetworkError')) {
        return;
    }
    
    showToast('An unexpected error occurred. Please refresh the page.', 'error');
});

/**
 * UNHANDLED PROMISE REJECTION HANDLER
 * ============================================
 * Catches unhandled promise rejections.
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
    showToast('An error occurred. Please try again.', 'error');
});

/**
 * ============================================
 * CLEANUP
 * ============================================
 */

/**
 * CLEANUP APPLICATION
 * ============================================
 * Clears timers and removes event listeners.
 * Called when app is being destroyed (e.g., for testing).
 */
function cleanupApp() {
    // Clear all active timers
    activeTimers.forEach(timer => clearInterval(timer));
    activeTimers = [];
    
    // Clear auto-save interval
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
    
    console.log('🧹 Application cleaned up');
}

/**
 * ============================================
 * EXPORT FUNCTIONS FOR GLOBAL USE
 * ============================================
 * These functions need to be available in the global scope
 * for HTML onclick handlers and cross-module calls.
 */

// Make critical functions globally available
window.initApp = initApp;
window.navigate = navigate;
window.openCreateForm = openCreateForm;
window.editInspection = editInspection;
window.viewInspection = viewInspection;
window.openReinspectionForm = openReinspectionForm;
window.cancelForm = cancelForm;
window.saveForm = saveForm;
window.addDefect = addDefect;
window.removeDefect = removeDefect;
window.selectSeverity = selectSeverity;
window.pickPhotos = pickPhotos;
window.handlePhotoUpload = handlePhotoUpload;
window.removePhoto = removePhoto;
window.openDeleteModal = openDeleteModal;
window.confirmDelete = confirmDelete;
window.openDeleteUserModal = openDeleteUserModal;
window.confirmDeleteUser = confirmDeleteUser;
window.changeUserRole = changeUserRole;
window.seedDemoData = seedDemoData;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.sortList = sortList;
window.clearListFilters = clearListFilters;
window.openLightbox = openLightbox;
window.openLightboxFromEl = openLightboxFromEl;
window.toggleTheme = toggleTheme;
window.handleLogin = handleLoginSubmit;
window.handleRegister = handleRegisterSubmit;
window.showRegister = showRegisterForm;
window.showLogin = showLoginForm;
window.handleLogout = handleLogout;
window.exportCSV = exportCSV;
window.exportPDF = exportPDF;
window.closeDeleteModal = closeDeleteModal;
window.closeDeleteUserModal = closeDeleteUserModal;
window.updateStorageDisplay = updateStorageDisplay;

// Also export the API objects for debugging
window.StorageAPI = StorageAPI;
window.AuthAPI = AuthAPI;
window.UIAPI = UIAPI;
window.ExportAPI = ExportAPI;

/**
 * ============================================
 * APPLICATION BOOTSTRAP
 * ============================================
 * Wait for DOM to be ready before initializing.
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOM already loaded, initialize immediately
    initApp();
}

/**
 * ============================================
 * SERVICE WORKER REGISTRATION (Optional)
 * ============================================
 * Register service worker for offline support.
 * This is commented out as it requires additional files.
 * Uncomment to enable PWA features.
 */
/*
if ('serviceWorker' in navigator && !window.location.hostname === 'localhost') {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => {
            console.log('ServiceWorker registered');
        })
        .catch(error => {
            console.log('ServiceWorker registration failed:', error);
        });
}
*/

/**
 * ============================================
 * DEVELOPMENT HELPERS
 * ============================================
 * These are only available in development mode.
 * They help with testing and debugging.
 */
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Expose debug helpers in development
    window.debug = {
        clearAllData: () => {
            if (confirm('⚠️ This will delete ALL data! Are you sure?')) {
                clearAllData(() => {
                    localStorage.clear();
                    location.reload();
                });
            }
        },
        getStorageStats: () => getStorageStats(),
        getInspections: () => getInspections(),
        getUsers: () => getUsers(),
        getCurrentSession: () => getCurrentSession()
    };
    
    console.log('🐛 Debug mode enabled. Use window.debug for helpers.');
}