/**
 * ============================================
 * STORAGE MODULE
 * ============================================
 * This file handles all data persistence for the application.
 * It manages two storage systems:
 * 
 * 1. localStorage: Stores JSON data (inspections, users, session)
 *    - Pros: Simple, synchronous, easy to use
 *    - Cons: Limited to ~5-10MB, string-only storage
 * 
 * 2. IndexedDB: Stores binary data (photos)
 *    - Pros: Much larger storage (hundreds of MB), binary data support
 *    - Cons: Asynchronous, more complex API
 * 
 * Why separate storage systems?
 * - Inspections data is small and needs quick access
 * - Photos are large and should not bloat localStorage
 * - Separating them keeps the app fast and within storage limits
 * 
 * Data Structures:
 * 
 * qci_users: [
 *   {
 *     id: "u_1234567890_abc1",
 *     username: "john",
 *     password: "base64encodedpassword",  // NOT secure, just for demo
 *     role: "Inspector",  // "Inspector", "Supervisor", "Admin"
 *     createdAt: "2024-03-27T10:00:00.000Z"
 *   }
 * ]
 * 
 * qci_inspections: [
 *   {
 *     id: "ins_1234567890_def2",
 *     po: "PO-2024-001",
 *     styleNumber: "ST-1021",
 *     washingName: "Stone Wash",
 *     quantity: 320,
 *     date: "2024-03-27",
 *     inspectorName: "John Doe",
 *     status: "Passed",  // Draft, In Progress, Passed, Failed, Pending
 *     notes: "All checks passed",
 *     defects: [
 *       {
 *         description: "Broken stitch",
 *         quantity: 5,
 *         severity: "Major",  // Critical, Major, Minor
 *         photoCount: 2
 *       }
 *     ],
 *     isReinspection: false,
 *     originalId: null,
 *     createdBy: "john",
 *     lastEditedBy: "john",
 *     createdAt: "2024-03-27T10:00:00.000Z",
 *     updatedAt: "2024-03-27T10:00:00.000Z"
 *   }
 * ]
 * 
 * qci_session: {
 *   id: "u_1234567890_abc1",
 *   username: "john",
 *   role: "Inspector"
 * }
 * 
 * qci_theme: "dark"  // "dark" or "light"
 */

/**
 * ============================================
 * LOCALSTORAGE KEYS
 * ============================================
 * Centralizing keys to avoid typos and make maintenance easier.
 * If we need to change a key name, we change it in one place.
 */
const STORAGE_KEYS = {
    USERS: 'qci_users',
    INSPECTIONS: 'qci_inspections',
    SESSION: 'qci_session',
    THEME: 'qci_theme'
};

/**
 * ============================================
 * INDEXEDDB SETUP
 * ============================================
 * IndexedDB is an asynchronous, NoSQL database in the browser.
 * It's perfect for storing binary data like images.
 * 
 * Database Structure:
 * - Name: 'qci_photos_db'
 * - Version: 1
 * - Object Store: 'photos'
 * - Key Pattern: 'inspectionId_defectIndex_photoIndex'
 *   Example: 'ins_1234567890_0_0' (first photo of first defect)
 */
const IDBConfig = {
    DB_NAME: 'qci_photos_db',
    DB_VERSION: 1,
    STORE_NAME: 'photos'
};

// Private variable to hold database connection once opened
let _dbConnection = null;

/**
 * OPEN INDEXEDDB CONNECTION
 * ============================================
 * Opens (or creates) the IndexedDB database.
 * This is an asynchronous operation, so we use a callback.
 * The connection is cached to avoid reopening repeatedly.
 * 
 * @param {Function} callback - Called with database instance or null on error
 */
function openIDB(callback) {
    // If already connected, use existing connection
    if (_dbConnection) {
        callback(_dbConnection);
        return;
    }
    
    // Request to open database
    const request = indexedDB.open(IDBConfig.DB_NAME, IDBConfig.DB_VERSION);
    
    // Called when database needs to be created or upgraded
    request.onupgradeneeded = function(event) {
        const db = event.target.result;
        
        // Create object store if it doesn't exist
        // keyPath: 'key' means each object must have a 'key' property as its primary key
        if (!db.objectStoreNames.contains(IDBConfig.STORE_NAME)) {
            db.createObjectStore(IDBConfig.STORE_NAME, { keyPath: 'key' });
        }
    };
    
    // Success: database opened
    request.onsuccess = function(event) {
        _dbConnection = event.target.result;
        callback(_dbConnection);
    };
    
    // Error: could not open database
    request.onerror = function(event) {
        console.error('IndexedDB error:', event.target.error);
        callback(null);
    };
}

/**
 * SAVE PHOTOS TO INDEXEDDB
 * ============================================
 * Stores photos for an inspection.
 * Photos are stored as base64 strings, each with a unique key.
 * 
 * Key format: inspectionId_defectIndex_photoIndex
 * Example: "ins_123_0_0" for the first photo of the first defect
 * 
 * Why this key structure?
 * - Allows easy retrieval of all photos for a specific inspection
 * - Photos are linked to specific defects
 * - Can be deleted by inspection or by individual photo
 * 
 * @param {string} inspectionId - ID of the inspection
 * @param {Array} defectsWithPhotos - Array of defect objects with photos arrays
 * @param {Function} callback - Called when operation completes
 */
function savePhotosToIDB(inspectionId, defectsWithPhotos, callback) {
    openIDB(function(db) {
        if (!db) {
            console.error('Failed to open IndexedDB');
            if (callback) callback();
            return;
        }
        
        // Start a transaction for reading and writing
        const transaction = db.transaction([IDBConfig.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(IDBConfig.STORE_NAME);
        
        // Loop through each defect
        defectsWithPhotos.forEach((defect, defectIndex) => {
            // Loop through each photo in the defect
            (defect.photos || []).forEach((photoSrc, photoIndex) => {
                // Create unique key
                const key = `${inspectionId}_${defectIndex}_${photoIndex}`;
                
                // Store the photo
                store.put({ key: key, src: photoSrc });
            });
        });
        
        // Callback when transaction completes
        transaction.oncomplete = function() {
            if (callback) callback();
        };
        
        transaction.onerror = function(event) {
            console.error('Error saving photos:', event.target.error);
            if (callback) callback();
        };
    });
}

/**
 * LOAD PHOTOS FROM INDEXEDDB
 * ============================================
 * Retrieves all photos for an inspection.
 * Returns an array of objects with defect index, photo index, and photo data.
 * 
 * How it works:
 * 1. For each potential defect (0 to defectCount-1)
 * 2. For each potential photo position (0 to 9, max 10 per defect)
 * 3. Try to fetch photo from IndexedDB
 * 4. Collect all found photos into results array
 * 
 * @param {string} inspectionId - ID of the inspection
 * @param {number} defectCount - Number of defects in the inspection
 * @param {Function} callback - Called with array of photo objects
 */
function loadPhotosFromIDB(inspectionId, defectCount, callback) {
    openIDB(function(db) {
        if (!db) {
            callback([]);
            return;
        }
        
        const transaction = db.transaction([IDBConfig.STORE_NAME], 'readonly');
        const store = transaction.objectStore(IDBConfig.STORE_NAME);
        
        const results = [];
        let pendingRequests = 0;
        
        // For each possible defect
        for (let defectIndex = 0; defectIndex < defectCount; defectIndex++) {
            // For each possible photo (max 10 per defect)
            for (let photoIndex = 0; photoIndex < 10; photoIndex++) {
                const key = `${inspectionId}_${defectIndex}_${photoIndex}`;
                pendingRequests++;
                
                const request = store.get(key);
                request.onsuccess = function(event) {
                    if (event.target.result) {
                        results.push({
                            defectIndex: defectIndex,
                            photoIndex: photoIndex,
                            src: event.target.result.src
                        });
                    }
                    pendingRequests--;
                    
                    // When all requests complete, return results
                    if (pendingRequests === 0) {
                        callback(results);
                    }
                };
                
                request.onerror = function() {
                    pendingRequests--;
                    if (pendingRequests === 0) {
                        callback(results);
                    }
                };
            }
        }
        
        // If no defects, callback immediately
        if (defectCount === 0) {
            callback([]);
        }
    });
}

/**
 * DELETE PHOTOS FROM INDEXEDDB
 * ============================================
 * Removes all photos associated with an inspection.
 * Called when an inspection is deleted.
 * 
 * @param {string} inspectionId - ID of the inspection to delete photos for
 * @param {number} defectCount - Number of defects (to know how many keys to try)
 * @param {Function} callback - Called when deletion completes
 */
function deletePhotosFromIDB(inspectionId, defectCount, callback) {
    openIDB(function(db) {
        if (!db) {
            if (callback) callback();
            return;
        }
        
        const transaction = db.transaction([IDBConfig.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(IDBConfig.STORE_NAME);
        
        // Delete all possible photo keys
        for (let defectIndex = 0; defectIndex < defectCount; defectIndex++) {
            for (let photoIndex = 0; photoIndex < 10; photoIndex++) {
                const key = `${inspectionId}_${defectIndex}_${photoIndex}`;
                store.delete(key);
            }
        }
        
        transaction.oncomplete = function() {
            if (callback) callback();
        };
        
        transaction.onerror = function() {
            if (callback) callback();
        };
    });
}

/**
 * CLEAR ALL PHOTOS (FOR TESTING/RESET)
 * ============================================
 * Completely clears the photos database.
 * Useful for resetting the app or clearing test data.
 * 
 * @param {Function} callback - Called when operation completes
 */
function clearAllPhotos(callback) {
    openIDB(function(db) {
        if (!db) {
            if (callback) callback();
            return;
        }
        
        const transaction = db.transaction([IDBConfig.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(IDBConfig.STORE_NAME);
        store.clear();
        
        transaction.oncomplete = function() {
            if (callback) callback();
        };
        
        transaction.onerror = function() {
            if (callback) callback();
        };
    });
}

/**
 * ============================================
 * LOCALSTORAGE OPERATIONS
 * ============================================
 * These functions handle reading/writing JSON data to localStorage.
 * They're synchronous and simple compared to IndexedDB.
 */

/**
 * GET INSPECTIONS
 * ============================================
 * Retrieves all inspections from localStorage.
 * Returns empty array if none exist.
 * 
 * @returns {Array} - Array of inspection objects
 */
function getInspections() {
    const data = localStorage.getItem(STORAGE_KEYS.INSPECTIONS);
    return data ? JSON.parse(data) : [];
}

/**
 * SAVE INSPECTIONS
 * ============================================
 * Saves inspections array to localStorage.
 * Includes error handling for quota exceeded.
 * 
 * @param {Array} inspections - Array of inspection objects
 * @returns {boolean} - True if saved successfully, false on error
 */
function saveInspections(inspections) {
    try {
        localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(inspections));
        // Update storage display if available
        if (typeof updateStorageDisplay === 'function') {
            updateStorageDisplay();
        }
        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            showToast('Storage full. Please delete old records or export data.', 'error');
        } else {
            console.error('Error saving inspections:', error);
            showToast('Error saving data. Please try again.', 'error');
        }
        return false;
    }
}

/**
 * GET INSPECTION BY ID
 * ============================================
 * Finds a single inspection by its ID.
 * Returns null if not found.
 * 
 * @param {string} id - Inspection ID
 * @returns {Object|null} - Inspection object or null
 */
function getInspectionById(id) {
    const inspections = getInspections();
    return inspections.find(insp => insp.id === id) || null;
}

/**
 * CREATE INSPECTION
 * ============================================
 * Adds a new inspection to the database.
 * 
 * @param {Object} inspectionData - The inspection data (without id and timestamps)
 * @param {string} currentUser - Username of the creator
 * @returns {Object} - The created inspection with id and timestamps
 */
function createInspection(inspectionData, currentUser) {
    const inspections = getInspections();
    const now = new Date().toISOString();
    
    const newInspection = {
        ...inspectionData,
        id: generateId('ins'),
        createdBy: currentUser,
        lastEditedBy: currentUser,
        createdAt: now,
        updatedAt: now
    };
    
    inspections.push(newInspection);
    saveInspections(inspections);
    return newInspection;
}

/**
 * UPDATE INSPECTION
 * ============================================
 * Updates an existing inspection.
 * 
 * @param {string} id - ID of inspection to update
 * @param {Object} updates - Updated fields
 * @param {string} currentUser - Username of the editor
 * @returns {Object|null} - Updated inspection or null if not found
 */
function updateInspection(id, updates, currentUser) {
    const inspections = getInspections();
    const index = inspections.findIndex(insp => insp.id === id);
    
    if (index === -1) return null;
    
    const updatedInspection = {
        ...inspections[index],
        ...updates,
        lastEditedBy: currentUser,
        updatedAt: new Date().toISOString()
    };
    
    inspections[index] = updatedInspection;
    saveInspections(inspections);
    return updatedInspection;
}

/**
 * DELETE INSPECTION
 * ============================================
 * Removes an inspection and its associated photos.
 * This is a complex operation because we need to:
 * 1. Get the inspection to know how many defects it had
 * 2. Delete the inspection from localStorage
 * 3. Delete all associated photos from IndexedDB
 * 
 * @param {string} id - ID of inspection to delete
 * @param {Function} callback - Called with success boolean
 */
function deleteInspection(id, callback) {
    // First, get the inspection to know defect count
    const inspection = getInspectionById(id);
    if (!inspection) {
        if (callback) callback(false);
        return;
    }
    
    const defectCount = (inspection.defects || []).length;
    
    // Delete photos from IndexedDB
    deletePhotosFromIDB(id, defectCount, function() {
        // Then delete inspection from localStorage
        const inspections = getInspections();
        const filtered = inspections.filter(insp => insp.id !== id);
        const success = saveInspections(filtered);
        
        if (callback) callback(success);
    });
}

/**
 * GET USERS
 * ============================================
 * Retrieves all users from localStorage.
 * 
 * @returns {Array} - Array of user objects
 */
function getUsers() {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
}

/**
 * SAVE USERS
 * ============================================
 * Saves users array to localStorage.
 * 
 * @param {Array} users - Array of user objects
 * @returns {boolean} - True if saved successfully
 */
function saveUsers(users) {
    try {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        return true;
    } catch (error) {
        console.error('Error saving users:', error);
        showToast('Error saving user data.', 'error');
        return false;
    }
}

/**
 * GET USER BY ID
 * ============================================
 * Finds a user by their ID.
 * 
 * @param {string} id - User ID
 * @returns {Object|null} - User object or null
 */
function getUserById(id) {
    const users = getUsers();
    return users.find(user => user.id === id) || null;
}

/**
 * GET USER BY USERNAME
 * ============================================
 * Finds a user by username (case-insensitive).
 * 
 * @param {string} username - Username to look for
 * @returns {Object|null} - User object or null
 */
function getUserByUsername(username) {
    const users = getUsers();
    return users.find(user => user.username.toLowerCase() === username.toLowerCase()) || null;
}

/**
 * CREATE USER
 * ============================================
 * Creates a new user account.
 * Password is stored as base64 (NOT secure, just for demo).
 * 
 * In a real application, you would:
 * - Hash passwords with bcrypt or similar
 * - Use HTTPS for transmission
 * - Never store plaintext or base64 passwords
 * 
 * @param {string} username - Desired username
 * @param {string} password - Plaintext password
 * @param {string} role - User role (Inspector, Supervisor, Admin)
 * @returns {Object|null} - Created user or null if username exists
 */
function createUser(username, password, role = 'Inspector') {
    // Check if username already exists
    if (getUserByUsername(username)) {
        showToast('Username already exists.', 'error');
        return null;
    }
    
    const users = getUsers();
    const now = new Date().toISOString();
    
    // Store password as base64 (NOT SECURE - demo only!)
    // In production, use: bcrypt.hash(password, saltRounds)
    const newUser = {
        id: generateId('u'),
        username: username,
        password: btoa(password), // Base64 encoding
        role: role,
        createdAt: now
    };
    
    users.push(newUser);
    saveUsers(users);
    return newUser;
}

/**
 * UPDATE USER ROLE
 * ============================================
 * Changes a user's role. Admin only operation.
 * 
 * @param {string} userId - ID of user to update
 * @param {string} newRole - New role (Inspector, Supervisor, Admin)
 * @returns {Object|null} - Updated user or null
 */
function updateUserRole(userId, newRole) {
    const users = getUsers();
    const index = users.findIndex(user => user.id === userId);
    
    if (index === -1) return null;
    
    users[index].role = newRole;
    saveUsers(users);
    return users[index];
}

/**
 * DELETE USER
 * ============================================
 * Removes a user account.
 * 
 * @param {string} userId - ID of user to delete
 * @returns {boolean} - True if deleted successfully
 */
function deleteUser(userId) {
    const users = getUsers();
    const filtered = users.filter(user => user.id !== userId);
    
    // Don't allow deleting the last admin
    const remainingAdmins = filtered.filter(user => user.role === 'Admin').length;
    if (remainingAdmins === 0) {
        showToast('Cannot delete the last admin user.', 'error');
        return false;
    }
    
    return saveUsers(filtered);
}

/**
 * ============================================
 * SESSION MANAGEMENT
 * ============================================
 */

/**
 * GET CURRENT SESSION
 * ============================================
 * Retrieves the current user session.
 * 
 * @returns {Object|null} - Session object or null
 */
function getCurrentSession() {
    const session = localStorage.getItem(STORAGE_KEYS.SESSION);
    return session ? JSON.parse(session) : null;
}

/**
 * SET CURRENT SESSION
 * ============================================
 * Creates a new user session (login).
 * 
 * @param {Object} user - User object
 */
function setCurrentSession(user) {
    const session = {
        id: user.id,
        username: user.username,
        role: user.role
    };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
}

/**
 * CLEAR CURRENT SESSION
 * ============================================
 * Removes the current session (logout).
 */
function clearCurrentSession() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
}

/**
 * CHECK IF USER IS LOGGED IN
 * ============================================
 * Verifies if there's a valid session.
 * Also checks that the user still exists (not deleted).
 * 
 * @returns {boolean} - True if logged in
 */
function isLoggedIn() {
    const session = getCurrentSession();
    if (!session) return false;
    
    // Verify user still exists
    const user = getUserById(session.id);
    return user !== null;
}

/**
 * ============================================
 * THEME MANAGEMENT
 * ============================================
 */

/**
 * GET THEME PREFERENCE
 * ============================================
 * Retrieves saved theme preference.
 * 
 * @returns {string} - 'dark' or 'light', defaults to 'dark'
 */
function getThemePreference() {
    const theme = localStorage.getItem(STORAGE_KEYS.THEME);
    return theme || 'dark';
}

/**
 * SET THEME PREFERENCE
 * ============================================
 * Saves theme preference.
 * 
 * @param {string} theme - 'dark' or 'light'
 */
function setThemePreference(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

/**
 * ============================================
 * STORAGE UTILITIES
 * ============================================
 */

/**
 * GET STORAGE STATISTICS
 * ============================================
 * Calculates detailed storage usage statistics.
 * Useful for dashboard and debugging.
 * 
 * @returns {Object} - Storage statistics
 */
function getStorageStats() {
    const inspections = getInspections();
    const users = getUsers();
    
    // Calculate localStorage usage
    let localStorageSize = 0;
    for (let key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
            localStorageSize += (localStorage[key].length + key.length) * 2;
        }
    }
    
    return {
        localStorage: {
            used: localStorageSize,
            usedFormatted: `${(localStorageSize / 1024).toFixed(1)} KB`,
            limit: 5 * 1024 * 1024,
            limitFormatted: '5 MB',
            percent: (localStorageSize / (5 * 1024 * 1024)) * 100
        },
        records: {
            inspections: inspections.length,
            users: users.length
        }
    };
}

/**
 * EXPORT ALL DATA
 * ============================================
 * Exports all application data (inspections and users) as JSON.
 * Useful for backup or migration.
 * 
 * @returns {Object} - Complete data export
 */
function exportAllData() {
    return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        inspections: getInspections(),
        users: getUsers()
    };
}

/**
 * IMPORT DATA
 * ============================================
 * Imports previously exported data.
 * WARNING: This overwrites existing data!
 * 
 * @param {Object} data - Data object from exportAllData()
 * @returns {boolean} - True if import successful
 */
function importAllData(data) {
    if (!data || !data.inspections || !data.users) {
        showToast('Invalid data format.', 'error');
        return false;
    }
    
    try {
        saveInspections(data.inspections);
        saveUsers(data.users);
        showToast('Data imported successfully. Refresh to see changes.', 'success');
        return true;
    } catch (error) {
        console.error('Import error:', error);
        showToast('Error importing data.', 'error');
        return false;
    }
}

/**
 * CLEAR ALL DATA (RESET APP)
 * ============================================
 * Completely clears all application data.
 * This is destructive - use with caution!
 * 
 * @param {Function} callback - Called when complete
 */
function clearAllData(callback) {
    // Clear localStorage data
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.INSPECTIONS);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    // Don't clear theme preference
    
    // Clear IndexedDB photos
    clearAllPhotos(function() {
        if (callback) callback();
    });
}

/**
 * ============================================
 * INITIALIZATION
 * ============================================
 */

/**
 * INITIALIZE DEMO DATA
 * ============================================
 * Creates demo data if no users exist.
 * This ensures the app always has at least one admin user.
 * 
 * @param {string} adminUsername - Username for admin (default 'admin')
 * @param {string} adminPassword - Password for admin (default 'admin123')
 */
function initializeDemoData(adminUsername = 'admin', adminPassword = 'admin123') {
    const users = getUsers();
    
    // Only create demo data if no users exist
    if (users.length === 0) {
        // Create admin user
        createUser(adminUsername, adminPassword, 'Admin');
        
        // Create demo inspections
        const demoInspections = createDemoInspections(adminUsername);
        saveInspections(demoInspections);
        
        console.log('Demo data initialized');
    }
}

/**
 * CREATE DEMO INSPECTIONS
 * ============================================
 * Generates sample inspection data for demonstration.
 * 
 * @param {string} username - Creator username
 * @returns {Array} - Array of inspection objects
 */
function createDemoInspections(username) {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    return [
        {
            id: generateId('ins'),
            po: 'PO-2024-001',
            styleNumber: 'ST-1021',
            washingName: 'Stone Wash',
            quantity: 320,
            date: yesterday.toISOString().slice(0, 10),
            inspectorName: 'Alice Johnson',
            status: 'Passed',
            notes: 'All quality checks passed. No defects found.',
            defects: [],
            isReinspection: false,
            originalId: null,
            createdBy: username,
            lastEditedBy: username,
            createdAt: yesterday.toISOString(),
            updatedAt: yesterday.toISOString()
        },
        {
            id: generateId('ins'),
            po: 'PO-2024-002',
            styleNumber: 'ST-2050',
            washingName: 'Enzyme Wash',
            quantity: 500,
            date: threeDaysAgo.toISOString().slice(0, 10),
            inspectorName: 'Bob Smith',
            status: 'Failed',
            notes: 'Multiple sewing defects found. Requires re-inspection.',
            defects: [
                {
                    description: 'Broken stitch on back seam',
                    quantity: 12,
                    severity: 'Major',
                    photoCount: 2
                },
                {
                    description: 'Loose button on front',
                    quantity: 4,
                    severity: 'Minor',
                    photoCount: 1
                },
                {
                    description: 'Torn fabric at pocket',
                    quantity: 2,
                    severity: 'Critical',
                    photoCount: 3
                }
            ],
            isReinspection: false,
            originalId: null,
            createdBy: username,
            lastEditedBy: username,
            createdAt: threeDaysAgo.toISOString(),
            updatedAt: threeDaysAgo.toISOString()
        },
        {
            id: generateId('ins'),
            po: 'PO-2024-003',
            styleNumber: 'ST-3300',
            washingName: 'Acid Wash',
            quantity: 200,
            date: now.toISOString().slice(0, 10),
            inspectorName: 'Charlie Davis',
            status: 'In Progress',
            notes: 'Currently inspecting. Will update soon.',
            defects: [
                {
                    description: 'Uneven hem on left sleeve',
                    quantity: 6,
                    severity: 'Minor',
                    photoCount: 1
                }
            ],
            isReinspection: false,
            originalId: null,
            createdBy: username,
            lastEditedBy: username,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
        },
        {
            id: generateId('ins'),
            po: 'PO-2024-004',
            styleNumber: 'ST-4410',
            washingName: 'Rinse Wash',
            quantity: 750,
            date: twoDaysAgo.toISOString().slice(0, 10),
            inspectorName: 'Diana Prince',
            status: 'Pending',
            notes: 'Awaiting supervisor approval.',
            defects: [],
            isReinspection: false,
            originalId: null,
            createdBy: username,
            lastEditedBy: username,
            createdAt: twoDaysAgo.toISOString(),
            updatedAt: twoDaysAgo.toISOString()
        }
    ];
}

// Helper for demo data (fixes missing variable)
const twoDaysAgo = new Date();
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

// Export functions for global use
window.StorageAPI = {
    // Inspections
    getInspections,
    saveInspections,
    getInspectionById,
    createInspection,
    updateInspection,
    deleteInspection,
    
    // Users
    getUsers,
    saveUsers,
    getUserById,
    getUserByUsername,
    createUser,
    updateUserRole,
    deleteUser,
    
    // Session
    getCurrentSession,
    setCurrentSession,
    clearCurrentSession,
    isLoggedIn,
    
    // Theme
    getThemePreference,
    setThemePreference,
    
    // Photos (IndexedDB)
    savePhotosToIDB,
    loadPhotosFromIDB,
    deletePhotosFromIDB,
    
    // Utilities
    getStorageStats,
    exportAllData,
    importAllData,
    clearAllData,
    initializeDemoData
};