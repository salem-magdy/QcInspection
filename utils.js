/**
 * ============================================
 * UTILITIES MODULE
 * ============================================
 * This file contains pure helper functions that are used across the entire application.
 * These functions have no side effects and don't depend on the DOM directly.
 * They handle common tasks like formatting dates, escaping HTML, compressing images,
 * and showing notifications.
 * 
 * Why separate these?
 * 1. Reusability - same functions used everywhere
 * 2. Testability - pure functions are easy to test
 * 3. Maintainability - changes in one place affect all usages
 * 4. Readability - keeps other files focused on their specific concerns
 */

/**
 * ESCAPE HTML - CRITICAL FOR SECURITY
 * ============================================
 * Prevents XSS (Cross-Site Scripting) attacks by converting special characters
 * to their HTML entity equivalents.
 * 
 * Why is this important?
 * When displaying user-generated content (like inspection notes or defect descriptions),
 * if we just inject it as raw HTML, a malicious user could inject <script> tags.
 * This function neutralizes that threat by converting < to &lt; etc.
 * 
 * @param {string} str - The string to escape
 * @returns {string} - HTML-escaped string safe for injection
 */
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')      // Ampersand must come first!
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * FORMAT DATE (YYYY-MM-DD to readable format)
 * ============================================
 * Converts ISO date string (YYYY-MM-DD) to a human-readable format.
 * Example: "2024-03-27" -> "27 Mar 2024"
 * 
 * Why this format?
 * - Consistent display across the app
 * - Uses local conventions (en-GB gives DD MMM YYYY)
 * - Fallback for invalid dates
 * 
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} - Formatted date like "27 Mar 2024" or "--" if invalid
 */
function formatDate(dateStr) {
    if (!dateStr) return '--';
    try {
        // Create date object (append T00:00:00 to avoid timezone issues)
        const date = new Date(dateStr.slice(0, 10) + 'T00:00:00');
        // Check if date is valid
        if (isNaN(date.getTime())) return '--';
        // Format using en-GB locale for consistent day/month/year
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (e) {
        return '--';
    }
}

/**
 * FORMAT DATE TIME (ISO string to readable format)
 * ============================================
 * Converts full ISO datetime string to readable format with time.
 * Example: "2024-03-27T14:30:00.000Z" -> "27 Mar 2024 14:30"
 * 
 * Used for showing creation/update timestamps in detail view.
 * 
 * @param {string} isoString - ISO datetime string
 * @returns {string} - Formatted datetime like "27 Mar 2024 14:30"
 */
function formatDateTime(isoString) {
    if (!isoString) return '--';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '--';
        // Format date part
        const datePart = date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        // Format time part (hours:minutes)
        const timePart = date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        });
        return `${datePart} ${timePart}`;
    } catch (e) {
        return '--';
    }
}

/**
 * GENERATE UNIQUE ID
 * ============================================
 * Creates a unique identifier for new records.
 * Combines timestamp with random string to avoid collisions.
 * 
 * Why not just Date.now()?
 * - If two records are created in the same millisecond, they'd conflict
 * - Adding random suffix ensures uniqueness
 * 
 * Pattern: "ins_1701234567890_a3f2" for inspections
 *          "u_1701234567890_b4e1" for users
 * 
 * @param {string} prefix - Optional prefix (e.g., 'ins', 'u')
 * @returns {string} - Unique ID with optional prefix
 */
function generateId(prefix = '') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * SHOW TOAST NOTIFICATION
 * ============================================
 * Displays a temporary notification message that auto-dismisses.
 * 
 * How it works:
 * 1. Creates a div with appropriate class based on message type
 * 2. Appends to toast container
 * 3. Removes after 3 seconds with fade-out animation
 * 
 * @param {string} message - The message to display
 * @param {string} type - Message type: 'success', 'error', or 'info'
 */
function showToast(message, type = 'info') {
    // Get or create toast container
    let container = document.getElementById('toast-container');
    if (!container) {
        // Create container if it doesn't exist (fallback)
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Add to container
    container.appendChild(toast);
    
    // Auto-remove after 3 seconds with fade effect
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

/**
 * VALIDATE EMAIL FORMAT
 * ============================================
 * Checks if email string matches standard email pattern.
 * 
 * Regex explanation:
 * ^[^\s@]+  - One or more chars that aren't space or @
 * @         - Literal @ symbol
 * [^\s@]+   - Domain name (no spaces or @)
 * \.        - Literal dot
 * [^\s@]+$  - TLD (no spaces or @)
 * 
 * @param {string} email - Email to validate
 * @returns {boolean} - True if email format is valid
 */
function validateEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * VALIDATE USERNAME
 * ============================================
 * Ensures username meets requirements:
 * - At least 3 characters
 * - Only letters, numbers, and underscores
 * - No spaces
 * 
 * @param {string} username - Username to validate
 * @returns {object} - { valid: boolean, message: string }
 */
function validateUsername(username) {
    if (!username || username.length < 3) {
        return { valid: false, message: 'Username must be at least 3 characters' };
    }
    if (username.length > 30) {
        return { valid: false, message: 'Username must be less than 30 characters' };
    }
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
        return { valid: false, message: 'Username can only contain letters, numbers, and underscores' };
    }
    return { valid: true, message: '' };
}

/**
 * VALIDATE PASSWORD STRENGTH
 * ============================================
 * Checks if password meets minimum requirements.
 * 
 * Requirements:
 * - Minimum 6 characters
 * - At least one number (optional but recommended)
 * - At least one uppercase letter (optional but recommended)
 * 
 * @param {string} password - Password to validate
 * @returns {object} - { valid: boolean, message: string, strength: 'weak'|'medium'|'strong' }
 */
function validatePassword(password) {
    if (!password || password.length < 6) {
        return { valid: false, message: 'Password must be at least 6 characters', strength: 'weak' };
    }
    
    let strength = 'weak';
    let hasNumber = /\d/.test(password);
    let hasUpper = /[A-Z]/.test(password);
    let hasLower = /[a-z]/.test(password);
    let hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    // Calculate password strength
    let score = (hasNumber ? 1 : 0) + (hasUpper ? 1 : 0) + 
                (hasLower ? 1 : 0) + (hasSpecial ? 1 : 0);
    
    if (password.length >= 8 && score >= 3) {
        strength = 'strong';
    } else if (password.length >= 6 && score >= 2) {
        strength = 'medium';
    }
    
    return { valid: true, message: '', strength };
}

/**
 * DEBOUNCE FUNCTION
 * ============================================
 * Limits how often a function can be called.
 * 
 * Why is this useful?
 * - Search inputs: wait until user stops typing before searching
 * - Window resize: avoid recalculating layout too often
 * - Auto-save: don't save on every keystroke
 * 
 * How it works:
 * - Each call resets the timer
 * - Function only executes after delay has passed without new calls
 * 
 * @param {Function} func - The function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * THROTTLE FUNCTION
 * ============================================
 * Ensures a function is called at most once in a specified time period.
 * 
 * Difference from debounce:
 * - Debounce: waits for pause in calls
 * - Throttle: executes at regular intervals regardless of call frequency
 * 
 * Useful for:
 * - Scroll events
 * - Mouse move tracking
 * - Rate limiting API calls
 * 
 * @param {Function} func - The function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

/**
 * COMPRESS IMAGE
 * ============================================
 * Reduces image file size by resizing and compressing.
 * 
 * Why is this necessary?
 * - Smartphone photos can be 5-10MB each
 * - localStorage has ~5-10MB total limit
 * - IndexedDB has more space, but still limited
 * - Compressing ensures we can store more photos
 * 
 * Process:
 * 1. Read file as data URL
 * 2. Create image element to get dimensions
 * 3. Calculate new dimensions (max 1024px on longest side)
 * 4. Draw on canvas at new size
 * 5. Export as JPEG with 65% quality
 * 
 * @param {File} file - The image file to compress
 * @param {Function} callback - Callback with compressed base64 string
 */
function compressImage(file, callback) {
    // Max pixel dimension for the longest side
    const MAX_PX = 1024;
    // JPEG quality (0.65 = 65% quality, good balance of size/quality)
    const QUALITY = 0.65;
    
    // Step 1: Read the file as data URL
    const reader = new FileReader();
    reader.onload = function(e) {
        // Step 2: Create image to get original dimensions
        const img = new Image();
        img.onload = function() {
            let width = img.width;
            let height = img.height;
            
            // Step 3: Calculate new dimensions maintaining aspect ratio
            if (width > MAX_PX || height > MAX_PX) {
                if (width > height) {
                    // Landscape: limit width
                    height = Math.round(height * MAX_PX / width);
                    width = MAX_PX;
                } else {
                    // Portrait: limit height
                    width = Math.round(width * MAX_PX / height);
                    height = MAX_PX;
                }
            }
            
            // Step 4: Create canvas and draw resized image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Step 5: Export as compressed JPEG
            const compressed = canvas.toDataURL('image/jpeg', QUALITY);
            callback(compressed);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * TRUNCATE TEXT
 * ============================================
 * Cuts off text after specified length and adds ellipsis.
 * 
 * Useful for:
 * - Table cells where space is limited
 * - Card descriptions
 * - Notification messages
 * 
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} - Truncated text with "..." if needed
 */
function truncateText(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * DEEP CLONE OBJECT
 * ============================================
 * Creates a true copy of an object (not just reference).
 * 
 * Why not just object spread ({...obj})?
 * - Spread only does shallow copy
 * - Nested objects would still be references
 * - JSON method creates true deep copy
 * 
 * Note: This doesn't work for functions, Dates, or circular references.
 * But for our data objects (plain objects with arrays), it's perfect.
 * 
 * @param {Object} obj - Object to clone
 * @returns {Object} - Deep clone of the object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * DETECT MOBILE DEVICE
 * ============================================
 * Checks if the current device is likely a mobile device.
 * 
 * Why both checks?
 * - User agent string for browser detection
 * - Touch points for touchscreen detection
 * - Combines both for better accuracy
 * 
 * @returns {boolean} - True if device appears to be mobile
 */
function isMobileDevice() {
    return window.matchMedia('(max-width: 768px)').matches ||
           ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0);
}

/**
 * GET STATUS BADGE HTML
 * ============================================
 * Returns the HTML for a status badge with appropriate styling.
 * 
 * This centralizes status styling so we don't have to repeat
 * the same logic across multiple files.
 * 
 * @param {string} status - Inspection status (Passed, Failed, etc.)
 * @param {boolean} isReinspection - Whether this is a re-inspection
 * @returns {string} - HTML string for the badge
 */
function getStatusBadge(status, isReinspection) {
    // Special case: re-inspections get their own badge style
    if (isReinspection && status !== 'Passed') {
        return '<span class="badge badge-reinspection">Re-insp.</span>';
    }
    
    // Map status to CSS class
    const badgeMap = {
        'Passed': 'badge-passed',
        'Failed': 'badge-failed',
        'Pending': 'badge-pending',
        'In Progress': 'badge-in-progress',
        'Draft': 'badge-draft'
    };
    
    const badgeClass = badgeMap[status] || 'badge-draft';
    return `<span class="badge ${badgeClass}">${escHtml(status)}</span>`;
}

/**
 * CALCULATE STORAGE USAGE
 * ============================================
 * Estimates localStorage usage and returns percentage.
 * 
 * How it works:
 * - Each character in localStorage is approximately 2 bytes
 * - Sum up lengths of all keys and values
 * - Calculate percentage of 5MB limit
 * 
 * @returns {object} - { used: number (bytes), percent: number, color: string }
 */
function calculateStorageUsage() {
    let total = 0;
    
    // Iterate through all localStorage items
    for (let key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
            // Each character is 2 bytes in JavaScript strings
            total += (localStorage[key].length + key.length) * 2;
        }
    }
    
    // 5MB limit (approximately)
    const limit = 5 * 1024 * 1024;
    const percent = total / limit;
    
    // Determine color based on usage
    let color = 'var(--success)';
    if (percent > 0.85) color = 'var(--danger)';
    else if (percent > 0.6) color = 'var(--warning)';
    
    return {
        used: total,
        percent: Math.min(100, percent * 100),
        color: color,
        formatted: `${(total / 1024).toFixed(0)} KB / ~5 MB`
    };
}

/**
 * SAFE PARSE JSON
 * ============================================
 * Safely parses JSON without throwing errors.
 * 
 * Why? localStorage.getItem can return malformed JSON
 * or null. This function handles those cases gracefully.
 * 
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Value to return if parsing fails
 * @returns {*} - Parsed object or defaultValue
 */
function safeParseJSON(jsonString, defaultValue = null) {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error('JSON parse error:', e);
        return defaultValue;
    }
}

/**
 * DOWNLOAD FILE
 * ============================================
 * Creates and triggers download of a file from blob data.
 * 
 * Used for CSV and PDF exports.
 * 
 * @param {Blob} blob - File blob
 * @param {string} filename - Name to save the file as
 */
function downloadFile(blob, filename) {
    // Create object URL from blob
    const url = URL.createObjectURL(blob);
    
    // Create hidden anchor element
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    
    // Trigger click and cleanup
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Release object URL to free memory
    URL.revokeObjectURL(url);
}

/**
 * COPY TO CLIPBOARD
 * ============================================
 * Copies text to clipboard with fallback for older browsers.
 * 
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - True if successful
 */
async function copyToClipboard(text) {
    try {
        // Modern clipboard API
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    }
}

/**
 * GROUP BY FUNCTION
 * ============================================
 * Groups array items by a key.
 * 
 * Example: groupBy(inspections, 'status')
 * Returns: { 'Passed': [...], 'Failed': [...], ... }
 * 
 * @param {Array} array - Array to group
 * @param {string|Function} key - Key to group by or function that returns key
 * @returns {Object} - Grouped object
 */
function groupBy(array, key) {
    return array.reduce((result, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        if (!result[groupKey]) {
            result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
    }, {});
}

/**
 * SORT ARRAY BY KEY
 * ============================================
 * Sorts array by specified key with optional direction.
 * 
 * @param {Array} array - Array to sort
 * @param {string} key - Key to sort by
 * @param {string} direction - 'asc' or 'desc'
 * @returns {Array} - New sorted array
 */
function sortByKey(array, key, direction = 'asc') {
    const sorted = [...array];
    sorted.sort((a, b) => {
        let aVal = a[key] || '';
        let bVal = b[key] || '';
        
        // Handle numeric comparison for numbers
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Handle string comparison
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
        
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    return sorted;
}

/**
 * EXPORT DATA AS CSV
 * ============================================
 * Converts array of objects to CSV string.
 * 
 * Handles:
 * - Headers from object keys
 * - Proper escaping of quotes and commas
 * - Nested objects (flattened)
 * 
 * @param {Array} data - Array of objects to export
 * @param {Array} columns - Optional array of column names to include
 * @returns {string} - CSV formatted string
 */
function exportToCSV(data, columns = null) {
    if (!data || !data.length) return '';
    
    // Use provided columns or get from first object
    const headers = columns || Object.keys(data[0]);
    
    // Escape cell value for CSV
    const escapeCell = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // If contains comma, quote, or newline, wrap in quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };
    
    // Build CSV rows
    const rows = [];
    
    // Headers row
    rows.push(headers.map(h => escapeCell(h)).join(','));
    
    // Data rows
    data.forEach(item => {
        const row = headers.map(header => {
            // Handle nested properties (e.g., 'user.name')
            const value = header.split('.').reduce((obj, key) => {
                return obj && obj[key] !== undefined ? obj[key] : '';
            }, item);
            return escapeCell(value);
        });
        rows.push(row.join(','));
    });
    
    return rows.join('\n');
}

// Export functions for use in other files (if using modules)
// Since we're using regular script tags, these are globally available
// For clarity, I'm listing them - they're all in the global scope

/**
 * ============================================
 * USAGE EXAMPLES:
 * ============================================
 * 
 * // Format a date
 * formatDate('2024-03-27') // Returns: "27 Mar 2024"
 * 
 * // Escape user input
 * escHtml('<script>alert("xss")</script>') // Returns: "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 * 
 * // Show notification
 * showToast('Inspection saved successfully!', 'success')
 * 
 * // Compress an image
 * compressImage(file, (compressedBase64) => {
 *     console.log('Compressed image ready');
 * });
 * 
 * // Debounce search input
 * const debouncedSearch = debounce((query) => {
 *     // Search API call
 * }, 300);
 */