/**
 * ============================================
 * AUTHENTICATION MODULE
 * ============================================
 * This file handles all authentication and authorization logic:
 * - User login/logout
 * - User registration
 * - Session management
 * - Permission checking (role-based access control)
 * 
 * Role-Based Access Control (RBAC):
 * - Inspector: Can create and edit inspections, view own work
 * - Supervisor: Can create, edit, and delete inspections, view all
 * - Admin: Full access + user management
 * 
 * Security Note:
 * This is a demo implementation. In production, you would:
 * - Use HTTPS for all communications
 * - Hash passwords with bcrypt or argon2
 * - Implement proper session tokens (JWT)
 * - Add rate limiting
 * - Use HTTP-only cookies for sessions
 */

/**
 * ============================================
 * PERMISSIONS MATRIX
 * ============================================
 * Defines what actions each role can perform.
 * This centralizes permissions logic for easy maintenance.
 * 
 * Structure:
 * - Key: Action name (create, edit, delete, etc.)
 * - Value: Array of roles allowed to perform that action
 */
const PERMISSIONS = {
    // Core CRUD operations
    create_inspection: ['Inspector', 'Supervisor', 'Admin'],
    edit_inspection: ['Inspector', 'Supervisor', 'Admin'],
    delete_inspection: ['Supervisor', 'Admin'],
    
    // View operations
    view_all_inspections: ['Supervisor', 'Admin'],
    view_own_inspections: ['Inspector', 'Supervisor', 'Admin'],
    
    // User management (Admin only)
    manage_users: ['Admin'],
    change_user_role: ['Admin'],
    delete_user: ['Admin'],
    
    // Reports and exports
    export_data: ['Inspector', 'Supervisor', 'Admin'],
    generate_reports: ['Supervisor', 'Admin'],
    
    // Admin panel access
    access_admin_panel: ['Admin']
};

/**
 * CHECK USER PERMISSION
 * ============================================
 * Verifies if the current user has permission for a specific action.
 * 
 * @param {string} action - The action to check (e.g., 'delete_inspection')
 * @param {Object} user - User object (optional, uses current session if not provided)
 * @returns {boolean} - True if user has permission
 */
function hasPermission(action, user = null) {
    // Get current user if not provided
    const currentUser = user || getCurrentSession();
    
    // No user = no permissions
    if (!currentUser || !currentUser.role) {
        return false;
    }
    
    // Get allowed roles for this action
    const allowedRoles = PERMISSIONS[action];
    
    // If action not defined, deny by default (fail secure)
    if (!allowedRoles) {
        console.warn(`Unknown permission action: ${action}`);
        return false;
    }
    
    // Check if user's role is allowed
    return allowedRoles.includes(currentUser.role);
}

/**
 * CHECK INSPECTION ACCESS
 * ============================================
 * Verifies if user can access/modify a specific inspection.
 * Rules:
 * - Admin/Supervisor: Can access any inspection
 * - Inspector: Can only access inspections they created
 * 
 * @param {Object} inspection - The inspection object
 * @param {Object} user - User object (optional)
 * @returns {boolean} - True if user can access the inspection
 */
function canAccessInspection(inspection, user = null) {
    const currentUser = user || getCurrentSession();
    
    if (!currentUser || !inspection) {
        return false;
    }
    
    // Admin and Supervisor can access everything
    if (currentUser.role === 'Admin' || currentUser.role === 'Supervisor') {
        return true;
    }
    
    // Inspector can only access their own inspections
    return inspection.createdBy === currentUser.username;
}

/**
 * ============================================
 * AUTHENTICATION FUNCTIONS
 * ============================================
 */

/**
 * LOGIN USER
 * ============================================
 * Authenticates a user with username and password.
 * 
 * Process:
 * 1. Validate input (not empty)
 * 2. Find user by username
 * 3. Verify password (compare base64)
 * 4. Create session
 * 5. Return user object
 * 
 * @param {string} username - User's username
 * @param {string} password - User's password (plaintext)
 * @returns {Object} - Result object with success flag and user/message
 */
function loginUser(username, password) {
    // Input validation
    if (!username || !password) {
        return {
            success: false,
            message: 'Please enter both username and password.'
        };
    }
    
    // Find user by username (case-insensitive)
    const user = getUserByUsername(username);
    
    // Check if user exists
    if (!user) {
        return {
            success: false,
            message: 'Invalid username or password.'
        };
    }
    
    // Verify password
    // In demo: stored as base64, so we compare btoa(input)
    // In production: use bcrypt.compare()
    if (user.password !== btoa(password)) {
        return {
            success: false,
            message: 'Invalid username or password.'
        };
    }
    
    // Create session (don't store password in session)
    const session = {
        id: user.id,
        username: user.username,
        role: user.role
    };
    
    // Save session
    setCurrentSession(session);
    
    // Update last login time (optional feature)
    // In production, you'd update this in the user record
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
        users[userIndex].lastLogin = new Date().toISOString();
        saveUsers(users);
    }
    
    return {
        success: true,
        user: session,
        message: `Welcome back, ${user.username}!`
    };
}

/**
 * REGISTER NEW USER
 * ============================================
 * Creates a new user account with validation.
 * 
 * Validation rules:
 * - Username: 3-30 chars, only letters, numbers, underscores
 * - Password: Minimum 6 characters
 * - Passwords must match
 * - Username must be unique
 * 
 * @param {string} username - Desired username
 * @param {string} password - Desired password
 * @param {string} confirmPassword - Password confirmation
 * @returns {Object} - Result object with success flag and message
 */
function registerUser(username, password, confirmPassword) {
    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
        return {
            success: false,
            message: usernameValidation.message
        };
    }
    
    // Validate password
    if (!password) {
        return {
            success: false,
            message: 'Password is required.'
        };
    }
    
    if (password.length < 6) {
        return {
            success: false,
            message: 'Password must be at least 6 characters.'
        };
    }
    
    // Check password confirmation
    if (password !== confirmPassword) {
        return {
            success: false,
            message: 'Passwords do not match.'
        };
    }
    
    // Check if username already exists
    if (getUserByUsername(username)) {
        return {
            success: false,
            message: 'Username already taken. Please choose another.'
        };
    }
    
    // Check if this is the first user (make them Admin)
    const existingUsers = getUsers();
    const role = existingUsers.length === 0 ? 'Admin' : 'Inspector';
    
    // Create the user
    const newUser = createUser(username, password, role);
    
    if (!newUser) {
        return {
            success: false,
            message: 'Failed to create user. Please try again.'
        };
    }
    
    return {
        success: true,
        message: existingUsers.length === 0 
            ? 'Admin account created! You can now sign in.' 
            : 'Account created successfully! You can now sign in.',
        user: newUser
    };
}

/**
 * LOGOUT USER
 * ============================================
 * Clears the current session and redirects to login.
 */
function logoutUser() {
    clearCurrentSession();
    showToast('Signed out successfully.', 'info');
    
    // Show auth layer and reset to login form
    const authLayer = document.getElementById('auth-layer');
    if (authLayer) {
        authLayer.classList.remove('hidden');
    }
    
    // Reset to login form
    showLoginForm();
}

/**
 * ============================================
 * SESSION MANAGEMENT
 * ============================================
 */

/**
 * GET CURRENT USER
 * ============================================
 * Returns the currently logged-in user object.
 * 
 * @returns {Object|null} - Current user or null if not logged in
 */
function getCurrentUser() {
    const session = getCurrentSession();
    if (!session) return null;
    
    // Get full user data
    return getUserById(session.id);
}

/**
 * VALIDATE CURRENT SESSION
 * ============================================
 * Checks if the current session is still valid.
 * Verifies:
 * - Session exists
 * - User still exists in database
 * - Session hasn't expired (optional)
 * 
 * @returns {boolean} - True if session is valid
 */
function validateSession() {
    const session = getCurrentSession();
    
    if (!session) return false;
    
    // Check if user still exists
    const user = getUserById(session.id);
    if (!user) {
        // User was deleted, clear session
        clearCurrentSession();
        return false;
    }
    
    // Optional: Check session expiration
    // In production, you'd have an expiration timestamp
    
    return true;
}

/**
 * REFRESH SESSION
 * ============================================
 * Updates session with latest user data (role changes, etc.)
 */
function refreshSession() {
    const session = getCurrentSession();
    if (!session) return null;
    
    const user = getUserById(session.id);
    if (!user) {
        clearCurrentSession();
        return null;
    }
    
    // Update session with latest data
    const updatedSession = {
        id: user.id,
        username: user.username,
        role: user.role
    };
    
    setCurrentSession(updatedSession);
    return updatedSession;
}

/**
 * ============================================
 * ROLE MANAGEMENT (Admin Functions)
 * ============================================
 */

/**
 * CHANGE USER ROLE
 * ============================================
 * Updates a user's role. Admin only operation.
 * 
 * Validation:
 * - Cannot demote the last admin
 * - Cannot change own role (to prevent lockout)
 * 
 * @param {string} userId - ID of user to modify
 * @param {string} newRole - New role (Inspector, Supervisor, Admin)
 * @param {Object} currentUser - The user performing the action
 * @returns {Object} - Result object with success flag and message
 */
function changeUserRole(userId, newRole, currentUser = null) {
    const admin = currentUser || getCurrentUser();
    
    // Check permission
    if (!admin || admin.role !== 'Admin') {
        return {
            success: false,
            message: 'Only administrators can change user roles.'
        };
    }
    
    const targetUser = getUserById(userId);
    if (!targetUser) {
        return {
            success: false,
            message: 'User not found.'
        };
    }
    
    // Prevent changing own role (security)
    if (targetUser.id === admin.id) {
        return {
            success: false,
            message: 'You cannot change your own role.'
        };
    }
    
    // Check if this is the last admin
    const admins = getUsers().filter(u => u.role === 'Admin');
    if (targetUser.role === 'Admin' && admins.length === 1 && newRole !== 'Admin') {
        return {
            success: false,
            message: 'Cannot demote the only admin user.'
        };
    }
    
    // Update role
    const updated = updateUserRole(userId, newRole);
    
    if (updated) {
        return {
            success: true,
            message: `${targetUser.username}'s role changed to ${newRole}.`,
            user: updated
        };
    }
    
    return {
        success: false,
        message: 'Failed to update user role.'
    };
}

/**
 * DELETE USER ACCOUNT
 * ============================================
 * Removes a user account. Admin only operation.
 * 
 * Validation:
 * - Cannot delete own account
 * - Cannot delete the last admin
 * 
 * @param {string} userId - ID of user to delete
 * @param {Object} currentUser - The user performing the action
 * @returns {Object} - Result object with success flag and message
 */
function deleteUserAccount(userId, currentUser = null) {
    const admin = currentUser || getCurrentUser();
    
    // Check permission
    if (!admin || admin.role !== 'Admin') {
        return {
            success: false,
            message: 'Only administrators can delete users.'
        };
    }
    
    const targetUser = getUserById(userId);
    if (!targetUser) {
        return {
            success: false,
            message: 'User not found.'
        };
    }
    
    // Prevent self-deletion
    if (targetUser.id === admin.id) {
        return {
            success: false,
            message: 'You cannot delete your own account.'
        };
    }
    
    // Check if this is the last admin
    const admins = getUsers().filter(u => u.role === 'Admin');
    if (targetUser.role === 'Admin' && admins.length === 1) {
        return {
            success: false,
            message: 'Cannot delete the only admin user.'
        };
    }
    
    // Delete user
    const success = deleteUser(userId);
    
    if (success) {
        return {
            success: true,
            message: `${targetUser.username} has been deleted.`
        };
    }
    
    return {
        success: false,
        message: 'Failed to delete user.'
    };
}

/**
 * GET USERS BY ROLE
 * ============================================
 * Returns all users with a specific role.
 * 
 * @param {string} role - Role to filter by (Inspector, Supervisor, Admin)
 * @returns {Array} - Array of users with that role
 */
function getUsersByRole(role) {
    const users = getUsers();
    return users.filter(user => user.role === role);
}

/**
 * GET USER STATISTICS
 * ============================================
 * Returns counts of users by role.
 * 
 * @returns {Object} - Counts for each role
 */
function getUserStatistics() {
    const users = getUsers();
    
    return {
        total: users.length,
        admins: users.filter(u => u.role === 'Admin').length,
        supervisors: users.filter(u => u.role === 'Supervisor').length,
        inspectors: users.filter(u => u.role === 'Inspector').length
    };
}

/**
 * ============================================
 * UI HELPER FUNCTIONS
 * ============================================
 */

/**
 * UPDATE UI FOR CURRENT USER
 * ============================================
 * Updates the sidebar and UI based on current user's permissions.
 * Called after login or role changes.
 */
function updateUIForUser() {
    const session = getCurrentSession();
    if (!session) return;
    
    // Update user info in sidebar
    const userNameEl = document.getElementById('user-name-display');
    const userRoleEl = document.getElementById('user-role-display');
    const userAvatarEl = document.getElementById('user-avatar');
    
    if (userNameEl) userNameEl.textContent = session.username;
    if (userRoleEl) userRoleEl.textContent = session.role;
    if (userAvatarEl) userAvatarEl.textContent = session.username.charAt(0).toUpperCase();
    
    // Show/hide admin navigation based on role
    const adminNavItem = document.getElementById('admin-nav-item');
    const adminSection = document.getElementById('admin-section');
    const isAdmin = session.role === 'Admin';
    
    if (adminNavItem) {
        adminNavItem.style.display = isAdmin ? 'flex' : 'none';
    }
    if (adminSection) {
        adminSection.style.display = isAdmin ? 'block' : 'none';
    }
    
    // Hide delete buttons for non-supervisors/admins
    // This is handled in the UI rendering functions
}

/**
 * CHECK AND HANDLE UNAUTHORIZED ACCESS
 * ============================================
 * Checks if user can access a page and redirects if not.
 * 
 * @param {string} page - Page name being accessed
 * @returns {boolean} - True if access allowed
 */
function checkPageAccess(page) {
    const session = getCurrentSession();
    
    // Public pages anyone can access (after login)
    const publicPages = ['dashboard', 'inspections', 'new-inspection', 'detail'];
    
    if (publicPages.includes(page)) {
        return true;
    }
    
    // Admin page requires admin role
    if (page === 'admin') {
        if (session && session.role === 'Admin') {
            return true;
        } else {
            showToast('Access denied. Admin privileges required.', 'error');
            return false;
        }
    }
    
    return true;
}

/**
 * ============================================
 * FORM HANDLERS (UI Integration)
 * ============================================
 */

/**
 * HANDLE LOGIN FORM SUBMISSION
 * ============================================
 * Processes the login form, shows errors, and updates UI on success.
 */
function handleLoginSubmit() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    
    // Clear previous error
    if (errorEl) {
        errorEl.classList.remove('show');
        errorEl.textContent = '';
    }
    
    // Attempt login
    const result = loginUser(username, password);
    
    if (result.success) {
        // Update UI for logged-in user
        updateUIForUser();
        
        // Hide auth layer
        const authLayer = document.getElementById('auth-layer');
        if (authLayer) {
            authLayer.classList.add('hidden');
        }
        
        // Navigate to dashboard
        if (typeof navigate === 'function') {
            navigate('dashboard');
        }
        
        // Show welcome message
        showToast(result.message, 'success');
    } else {
        // Show error
        if (errorEl) {
            errorEl.textContent = result.message;
            errorEl.classList.add('show');
        }
    }
}

/**
 * HANDLE REGISTRATION FORM SUBMISSION
 * ============================================
 * Processes the registration form, shows success/error messages.
 */
function handleRegisterSubmit() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    
    const errorEl = document.getElementById('register-error');
    const successEl = document.getElementById('register-success');
    
    // Clear previous messages
    if (errorEl) errorEl.classList.remove('show');
    if (successEl) successEl.classList.remove('show');
    
    // Attempt registration
    const result = registerUser(username, password, confirm);
    
    if (result.success) {
        // Show success message
        if (successEl) {
            successEl.textContent = result.message;
            successEl.classList.add('show');
        }
        
        // Clear form
        document.getElementById('reg-username').value = '';
        document.getElementById('reg-password').value = '';
        document.getElementById('reg-confirm').value = '';
        
        // Switch to login form after 1.5 seconds
        setTimeout(() => {
            showLoginForm();
        }, 1500);
    } else {
        // Show error
        if (errorEl) {
            errorEl.textContent = result.message;
            errorEl.classList.add('show');
        }
    }
}

/**
 * SHOW LOGIN FORM
 * ============================================
 * Switches from register to login form.
 */
function showLoginForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    
    // Clear any messages
    const errorEl = document.getElementById('register-error');
    const successEl = document.getElementById('register-success');
    if (errorEl) errorEl.classList.remove('show');
    if (successEl) successEl.classList.remove('show');
}

/**
 * SHOW REGISTER FORM
 * ============================================
 * Switches from login to register form.
 */
function showRegisterForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    
    // Clear any messages
    const loginError = document.getElementById('login-error');
    if (loginError) loginError.classList.remove('show');
}

/**
 * ============================================
 * INITIALIZATION
 * ============================================
 */

/**
 * INITIALIZE AUTH MODULE
 * ============================================
 * Sets up event listeners and checks for existing session.
 */
function initAuth() {
    // Set up event listeners for auth forms
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const showRegisterLink = document.getElementById('show-register-link');
    const showLoginLink = document.getElementById('show-login-link');
    
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
    
    // Enter key support for forms
    const loginPassword = document.getElementById('login-password');
    const regConfirm = document.getElementById('reg-confirm');
    
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
    
    // Check for existing valid session
    if (validateSession()) {
        const session = getCurrentSession();
        if (session) {
            updateUIForUser();
            
            // Hide auth layer
            const authLayer = document.getElementById('auth-layer');
            if (authLayer) {
                authLayer.classList.add('hidden');
            }
            
            // Refresh session data
            refreshSession();
            
            return true;
        }
    }
    
    return false;
}

// Auto-initialize when script loads
// We'll use DOMContentLoaded to ensure DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

// Export functions for global use
window.AuthAPI = {
    login: loginUser,
    register: registerUser,
    logout: logoutUser,
    getCurrentUser,
    validateSession,
    refreshSession,
    hasPermission,
    canAccessInspection,
    changeUserRole,
    deleteUserAccount,
    getUserStatistics,
    updateUIForUser,
    checkPageAccess
};