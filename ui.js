/**
 * ============================================
 * UI RENDERING MODULE
 * ============================================
 * This file handles all DOM manipulation and UI rendering:
 * - Dashboard with statistics and recent inspections
 * - Inspections list with search, filter, sort, pagination
 * - Inspection form (create/edit)
 * - Inspection detail view
 * - Admin panel for user management
 * 
 * The UI is organized into pages that are shown/hidden based on navigation.
 * Each page has its own rendering function that updates the DOM with current data.
 * 
 * Key Concepts:
 * - State Management: Variables like listSortCol, listSortDir, listPage track UI state
 * - Event Delegation: Some events are handled at parent level
 * - Dynamic Rendering: Functions completely rebuild sections when data changes
 */

/**
 * ============================================
 * GLOBAL UI STATE VARIABLES
 * ============================================
 * These track the current state of the UI across different pages.
 */

// Inspection list state
let listSortCol = 'date';           // Current sort column
let listSortDir = 'desc';           // Sort direction ('asc' or 'desc')
let listPage = 1;                   // Current page number
const PAGE_SIZE = 15;               // Items per page

// Form state
let formMode = 'create';            // 'create' or 'edit'
let editingId = null;               // ID of inspection being edited
let reinspectionSource = null;      // Original ID if creating re-inspection
let defectCounter = 0;              // Counter for defect IDs

// Detail view state
let currentDetailId = null;         // Currently viewed inspection ID

// Modal state
let pendingDeleteId = null;         // ID pending deletion
let pendingDeleteUserId = null;     // User ID pending deletion
let deleteReturnPage = 'list';      // Where to return after delete

// Debounced search function (to prevent excessive rendering)
const debouncedSearch = debounce(() => {
    renderInspectionsList();
}, 300);

/**
 * ============================================
 * DASHBOARD RENDERING
 * ============================================
 */

/**
 * RENDER DASHBOARD
 * ============================================
 * Updates the dashboard with current statistics and recent inspections.
 * Called when dashboard page is opened or data changes.
 */
function renderDashboard() {
    // Set greeting based on time of day
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const greetingEl = document.getElementById('dash-greeting');
    if (greetingEl) greetingEl.textContent = greeting;
    
    // Get all inspections
    const inspections = getInspections();
    const total = inspections.length;
    
    // Calculate statistics by status
    const stats = {
        total: total,
        passed: inspections.filter(i => i.status === 'Passed').length,
        failed: inspections.filter(i => i.status === 'Failed').length,
        pending: inspections.filter(i => i.status === 'Pending').length,
        progress: inspections.filter(i => i.status === 'In Progress').length,
        draft: inspections.filter(i => i.status === 'Draft').length
    };
    
    // Update stat values
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-passed').textContent = stats.passed;
    document.getElementById('stat-failed').textContent = stats.failed;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-progress').textContent = stats.progress;
    document.getElementById('stat-draft').textContent = stats.draft;
    
    // Update progress bars (use setTimeout for smooth animation)
    setTimeout(() => {
        const getPercent = (count) => total > 0 ? Math.round(count / total * 100) + '%' : '0%';
        document.getElementById('bar-passed').style.width = getPercent(stats.passed);
        document.getElementById('bar-failed').style.width = getPercent(stats.failed);
        document.getElementById('bar-pending').style.width = getPercent(stats.pending);
        document.getElementById('bar-progress').style.width = getPercent(stats.progress);
        document.getElementById('bar-draft').style.width = getPercent(stats.draft);
    }, 80);
    
    // Render recent inspections (last 8 by creation date)
    const recent = [...inspections]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 8);
    
    const tbody = document.getElementById('recent-tbody');
    const table = document.getElementById('recent-table');
    const empty = document.getElementById('recent-empty');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (recent.length === 0) {
        if (table) table.style.display = 'none';
        if (empty) empty.style.display = 'block';
    } else {
        if (table) table.style.display = '';
        if (empty) empty.style.display = 'none';
        
        recent.forEach(inspection => {
            const row = document.createElement('tr');
            row.onclick = () => viewInspection(inspection.id);
            row.innerHTML = `
                <td><strong>${escHtml(inspection.po)}</strong></td>
                <td>${escHtml(inspection.styleNumber)}</td>
                <td>${escHtml(inspection.washingName)}</td>
                <td>${escHtml(inspection.inspectorName || '--')}</td>
                <td>${formatDate(inspection.date)}</td>
                <td>${getStatusBadge(inspection.status, inspection.isReinspection)}</td>
            `;
            tbody.appendChild(row);
        });
    }
}

/**
 * ============================================
 * INSPECTIONS LIST RENDERING
 * ============================================
 */

/**
 * RENDER INSPECTIONS LIST
 * ============================================
 * Main entry point for list rendering. Resets to page 1 and calls internal render.
 */
function renderInspectionsList() {
    listPage = 1;
    renderListPage();
}

/**
 * RENDER LIST PAGE (Internal)
 * ============================================
 * Applies filters, sorting, pagination and renders the inspection list.
 * This is where all the complex list logic lives.
 */
function renderListPage() {
    // Get filter values
    const searchTerm = document.getElementById('list-search')?.value.toLowerCase().trim() || '';
    const statusFilter = document.getElementById('filter-status')?.value || '';
    const dateFrom = document.getElementById('filter-date-from')?.value || '';
    const dateTo = document.getElementById('filter-date-to')?.value || '';
    
    // Filter inspections
    let filtered = getInspections().filter(inspection => {
        // Search filter (PO, Style, Washing, Inspector)
        const matchesSearch = !searchTerm || [
            inspection.po,
            inspection.styleNumber,
            inspection.washingName,
            inspection.inspectorName
        ].some(field => (field || '').toLowerCase().includes(searchTerm));
        
        // Status filter
        const matchesStatus = !statusFilter || inspection.status === statusFilter;
        
        // Date range filter
        const matchesDateFrom = !dateFrom || inspection.date >= dateFrom;
        const matchesDateTo = !dateTo || inspection.date <= dateTo;
        
        return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
    
    // Apply sorting
    filtered.sort((a, b) => {
        let aVal = a[listSortCol] || '';
        let bVal = b[listSortCol] || '';
        
        // Handle numeric comparison for numbers
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return listSortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Handle string comparison
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
        
        if (aVal < bVal) return listSortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return listSortDir === 'asc' ? 1 : -1;
        return 0;
    });
    
    // Update sort icons
    ['po', 'styleNumber', 'date'].forEach(col => {
        const icon = document.getElementById(`sort-${col}`);
        if (icon) {
            icon.textContent = col === listSortCol ? (listSortDir === 'asc' ? '↑' : '↓') : '−';
        }
    });
    
    // Pagination
    const total = filtered.length;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const start = (listPage - 1) * PAGE_SIZE;
    const pageData = filtered.slice(start, start + PAGE_SIZE);
    
    // Update meta info
    const metaEl = document.getElementById('list-meta');
    if (metaEl) {
        if (total === 0) {
            metaEl.textContent = '';
        } else {
            const first = start + 1;
            const last = Math.min(start + PAGE_SIZE, total);
            metaEl.textContent = `Showing ${first}-${last} of ${total} inspections`;
        }
    }
    
    // Render table body
    const tbody = document.getElementById('inspections-tbody');
    const table = document.getElementById('inspections-table');
    const empty = document.getElementById('inspections-empty');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (pageData.length === 0) {
        if (table) table.style.display = 'none';
        if (empty) empty.style.display = 'block';
        
        const emptyTitle = document.getElementById('inspections-empty-title');
        const emptyText = document.getElementById('inspections-empty-text');
        if (emptyTitle) {
            emptyTitle.textContent = getInspections().length === 0 ? 'No inspections yet' : 'No results found';
        }
        if (emptyText) {
            emptyText.textContent = getInspections().length === 0 ? 'Create your first inspection' : 'Try adjusting your search or filters';
        }
    } else {
        if (table) table.style.display = '';
        if (empty) empty.style.display = 'none';
        
        pageData.forEach(inspection => {
            const row = document.createElement('tr');
            row.onclick = (e) => {
                // Don't trigger if clicking on action buttons
                if (e.target.closest('.row-actions')) return;
                viewInspection(inspection.id);
            };
            
            row.innerHTML = `
                <td>${inspection.isReinspection ? '<span class="reinsp-tag">Re</span>' : ''}</td>
                <td><strong>${escHtml(inspection.po)}</strong></td>
                <td>${escHtml(inspection.styleNumber)}</td>
                <td>${escHtml(inspection.washingName)}</td>
                <td>${escHtml(inspection.quantity)}</td>
                <td>${escHtml(inspection.inspectorName || '--')}</td>
                <td>${formatDate(inspection.date)}</td>
                <td>${getStatusBadge(inspection.status, inspection.isReinspection)}</td>
                <td>
                    <div class="row-actions">
                        <button class="action-btn" onclick="event.stopPropagation(); viewInspection('${inspection.id}')">View</button>
                        <button class="action-btn" onclick="event.stopPropagation(); editInspection('${inspection.id}')">Edit</button>
                        ${hasPermission('delete_inspection') ? 
                            `<button class="action-btn danger" onclick="event.stopPropagation(); openDeleteModal('${inspection.id}', 'list')">Del</button>` : 
                            ''}
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    // Render pagination controls
    renderPagination(totalPages);
}

/**
 * RENDER PAGINATION
 * ============================================
 * Creates pagination buttons based on total pages.
 */
function renderPagination(totalPages) {
    const container = document.getElementById('pagination-row');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.textContent = '← Prev';
    prevBtn.disabled = listPage === 1;
    prevBtn.onclick = () => {
        if (listPage > 1) {
            listPage--;
            renderListPage();
        }
    };
    container.appendChild(prevBtn);
    
    // Page numbers (show limited range for many pages)
    const maxVisible = 5;
    let startPage = Math.max(1, listPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.className = 'page-btn';
        firstBtn.textContent = '1';
        firstBtn.onclick = () => { listPage = 1; renderListPage(); };
        container.appendChild(firstBtn);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '0 4px';
            container.appendChild(dots);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === listPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => { listPage = i; renderListPage(); };
        container.appendChild(btn);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '0 4px';
            container.appendChild(dots);
        }
        
        const lastBtn = document.createElement('button');
        lastBtn.className = 'page-btn';
        lastBtn.textContent = totalPages;
        lastBtn.onclick = () => { listPage = totalPages; renderListPage(); };
        container.appendChild(lastBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = listPage === totalPages;
    nextBtn.onclick = () => {
        if (listPage < totalPages) {
            listPage++;
            renderListPage();
        }
    };
    container.appendChild(nextBtn);
}

/**
 * SORT LIST
 * ============================================
 * Changes sort column/direction and re-renders.
 * 
 * @param {string} column - Column name to sort by
 */
function sortList(column) {
    if (listSortCol === column) {
        // Toggle direction if same column
        listSortDir = listSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        // New column, default to ascending
        listSortCol = column;
        listSortDir = 'asc';
    }
    renderListPage();
}

/**
 * CLEAR LIST FILTERS
 * ============================================
 * Resets all filter inputs and re-renders.
 */
function clearListFilters() {
    const searchInput = document.getElementById('list-search');
    const statusSelect = document.getElementById('filter-status');
    const dateFrom = document.getElementById('filter-date-from');
    const dateTo = document.getElementById('filter-date-to');
    
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = '';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    
    renderInspectionsList();
}

/**
 * ============================================
 * INSPECTION FORM RENDERING
 * ============================================
 */

/**
 * OPEN CREATE FORM
 * ============================================
 * Initializes the form for creating a new inspection.
 */
function openCreateForm() {
    formMode = 'create';
    editingId = null;
    reinspectionSource = null;
    
    resetForm();
    
    const titleEl = document.getElementById('form-page-title');
    const subtitleEl = document.getElementById('form-page-subtitle');
    const reinspNotice = document.getElementById('reinsp-notice');
    
    if (titleEl) titleEl.textContent = 'New Inspection';
    if (subtitleEl) subtitleEl.textContent = 'Fill in the details below';
    if (reinspNotice) reinspNotice.style.display = 'none';
    
    // Set default date to today
    const dateInput = document.getElementById('f-date');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    
    navigate('new-inspection');
}

/**
 * OPEN REINSPECTION FORM
 * ============================================
 * Creates a re-inspection based on a failed inspection.
 * 
 * @param {string} originalId - ID of the original failed inspection
 */
function openReinspectionForm(originalId) {
    const original = getInspectionById(originalId);
    if (!original) {
        showToast('Original inspection not found.', 'error');
        return;
    }
    
    formMode = 'create';
    editingId = null;
    reinspectionSource = originalId;
    
    resetForm();
    
    // Pre-fill data from original inspection
    const poInput = document.getElementById('f-po');
    const styleInput = document.getElementById('f-style');
    const washingInput = document.getElementById('f-washing');
    const qtyInput = document.getElementById('f-qty');
    const inspectorInput = document.getElementById('f-inspector');
    const dateInput = document.getElementById('f-date');
    
    if (poInput) poInput.value = original.po || '';
    if (styleInput) styleInput.value = original.styleNumber || '';
    if (washingInput) washingInput.value = original.washingName || '';
    if (qtyInput) qtyInput.value = original.quantity || '';
    if (inspectorInput) inspectorInput.value = original.inspectorName || '';
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    
    // Set status to In Progress for re-inspection
    selectStatusByValue('In Progress');
    
    // Show re-inspection notice
    const reinspNotice = document.getElementById('reinsp-notice');
    const reinspRef = document.getElementById('reinsp-ref');
    if (reinspNotice) reinspNotice.style.display = 'block';
    if (reinspRef) reinspRef.textContent = originalId;
    
    const titleEl = document.getElementById('form-page-title');
    const subtitleEl = document.getElementById('form-page-subtitle');
    if (titleEl) titleEl.textContent = 'Re-inspection';
    if (subtitleEl) subtitleEl.textContent = 'Pre-filled from original failed inspection';
    
    navigate('new-inspection');
}

/**
 * EDIT INSPECTION
 * ============================================
 * Loads an existing inspection into the form for editing.
 * 
 * @param {string} id - ID of inspection to edit
 */
function editInspection(id) {
    const inspection = getInspectionById(id);
    if (!inspection) {
        showToast('Inspection not found.', 'error');
        return;
    }
    
    // Check permission
    if (!canAccessInspection(inspection)) {
        showToast('You do not have permission to edit this inspection.', 'error');
        return;
    }
    
    formMode = 'edit';
    editingId = id;
    reinspectionSource = inspection.originalId || null;
    
    resetForm();
    
    // Populate form fields
    const poInput = document.getElementById('f-po');
    const styleInput = document.getElementById('f-style');
    const washingInput = document.getElementById('f-washing');
    const qtyInput = document.getElementById('f-qty');
    const dateInput = document.getElementById('f-date');
    const inspectorInput = document.getElementById('f-inspector');
    const notesInput = document.getElementById('f-notes');
    
    if (poInput) poInput.value = inspection.po || '';
    if (styleInput) styleInput.value = inspection.styleNumber || '';
    if (washingInput) washingInput.value = inspection.washingName || '';
    if (qtyInput) qtyInput.value = inspection.quantity || '';
    if (dateInput) dateInput.value = inspection.date || '';
    if (inspectorInput) inspectorInput.value = inspection.inspectorName || '';
    if (notesInput) notesInput.value = inspection.notes || '';
    
    selectStatusByValue(inspection.status || 'Draft');
    
    // Show re-inspection notice if applicable
    if (inspection.isReinspection && inspection.originalId) {
        const reinspNotice = document.getElementById('reinsp-notice');
        const reinspRef = document.getElementById('reinsp-ref');
        if (reinspNotice) reinspNotice.style.display = 'block';
        if (reinspRef) reinspRef.textContent = inspection.originalId;
    }
    
    // Load defects with photos
    const defectCount = (inspection.defects || []).length;
    loadPhotosFromIDB(id, defectCount, (photoResults) => {
        // Create array of defects with photos
        const defectsWithPhotos = (inspection.defects || []).map((defect, idx) => ({
            description: defect.description,
            quantity: defect.quantity,
            severity: defect.severity,
            photos: []
        }));
        
        // Add photos to corresponding defects
        photoResults.forEach(photo => {
            if (defectsWithPhotos[photo.defectIndex]) {
                defectsWithPhotos[photo.defectIndex].photos.push(photo.src);
            }
        });
        
        // Add each defect to the form
        defectsWithPhotos.forEach(defect => addDefect(defect));
    });
    
    const titleEl = document.getElementById('form-page-title');
    const subtitleEl = document.getElementById('form-page-subtitle');
    if (titleEl) titleEl.textContent = 'Edit Inspection';
    if (subtitleEl) subtitleEl.textContent = 'Update the record below';
    
    navigate('new-inspection');
}

/**
 * RESET FORM
 * ============================================
 * Clears all form fields and removes all defects.
 */
function resetForm() {
    // Clear text inputs
    const inputs = ['f-po', 'f-style', 'f-washing', 'f-qty', 'f-date', 'f-inspector', 'f-notes'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            el.classList.remove('invalid');
        }
    });
    
    // Clear error messages
    const errors = ['err-po', 'err-style', 'err-washing', 'err-qty', 'err-date'];
    errors.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
    });
    
    // Reset status to Draft
    selectStatusByValue('Draft');
    
    // Clear defects
    const defectsList = document.getElementById('defects-list');
    if (defectsList) defectsList.innerHTML = '';
    defectCounter = 0;
    
    updateDefectsEmpty();
}

/**
 * SELECT STATUS
 * ============================================
 * Handles status button click in the form.
 * 
 * @param {HTMLElement} btn - The clicked status button
 */
function selectStatus(btn) {
    // Remove active class from all status buttons
    document.querySelectorAll('.status-opt').forEach(b => {
        b.classList.remove('active');
    });
    btn.classList.add('active');
}

/**
 * SELECT STATUS BY VALUE
 * ============================================
 * Programmatically selects a status button by its value.
 * 
 * @param {string} value - Status value (Draft, Passed, etc.)
 */
function selectStatusByValue(value) {
    const buttons = document.querySelectorAll('.status-opt');
    buttons.forEach(btn => {
        if (btn.getAttribute('data-val') === value) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

/**
 * GET SELECTED STATUS
 * ============================================
 * Returns the currently selected status value.
 * 
 * @returns {string} - Selected status
 */
function getSelectedStatus() {
    const active = document.querySelector('.status-opt.active');
    return active ? active.getAttribute('data-val') : 'Draft';
}

/**
 * ADD DEFECT
 * ============================================
 * Adds a new defect row to the form.
 * 
 * @param {Object} data - Optional defect data for editing
 */
function addDefect(data = {}) {
    defectCounter++;
    const idx = defectCounter;
    const container = document.getElementById('defects-list');
    if (!container) return;
    
    const severity = data.severity || 'Major';
    const critClass = severity === 'Critical' ? 'active-critical' : 'inactive';
    const majClass = severity === 'Major' ? 'active-major' : 'inactive';
    const minClass = severity === 'Minor' ? 'active-minor' : 'inactive';
    
    const div = document.createElement('div');
    div.className = 'defect-row';
    div.id = `defect-${idx}`;
    
    div.innerHTML = `
        <div class="defect-row-header">
            <span class="defect-number">Defect #${idx}</span>
            <button class="defect-remove" onclick="removeDefect(${idx})">×</button>
        </div>
        <div class="defect-fields">
            <div class="form-group" style="margin-bottom:10px">
                <label class="form-label">Description</label>
                <input class="form-input" type="text" id="def-desc-${idx}" 
                       placeholder="Describe the defect..." value="${escHtml(data.description || '')}">
            </div>
            <div class="defect-row-bottom">
                <div class="form-group" style="margin-bottom:0;flex:0 0 100px">
                    <label class="form-label">Qty Found</label>
                    <input class="form-input" type="number" id="def-qty-${idx}" 
                           min="1" value="${data.quantity || ''}">
                </div>
                <div class="form-group" style="margin-bottom:0;flex:1">
                    <label class="form-label">Severity</label>
                    <div class="severity-selector" id="sev-${idx}">
                        <button class="sev-btn ${critClass}" data-sev="Critical" 
                                onclick="selectSeverity(${idx}, 'Critical')">Critical</button>
                        <button class="sev-btn ${majClass}" data-sev="Major" 
                                onclick="selectSeverity(${idx}, 'Major')">Major</button>
                        <button class="sev-btn ${minClass}" data-sev="Minor" 
                                onclick="selectSeverity(${idx}, 'Minor')">Minor</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="photo-section">
            <div class="photo-section-label">Photos (optional, max 10)</div>
            <div class="photo-upload-area">
                <input type="file" id="photo-input-${idx}" accept="image/*" multiple 
                       style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden"
                       onchange="handlePhotoUpload(${idx}, this)">
                <button type="button" class="photo-add-btn" onclick="pickPhotos(${idx})">
                    + Add Photos
                </button>
                <span class="photo-upload-label" id="photo-count-label-${idx}">No photos yet</span>
            </div>
            <div class="photo-previews" id="photo-previews-${idx}"></div>
            <div class="photo-count-warning" id="photo-warn-${idx}" style="display:none">
                Maximum 10 photos reached.
            </div>
        </div>
    `;
    
    container.appendChild(div);
    
    // Add existing photos if provided
    if (data.photos && data.photos.length) {
        data.photos.forEach((src, pi) => {
            addPhotoThumb(idx, src, pi);
        });
        checkPhotoLimit(idx);
    }
    
    updateDefectsEmpty();
}

/**
 * REMOVE DEFECT
 * ============================================
 * Removes a defect row from the form.
 * 
 * @param {number} idx - Defect index to remove
 */
function removeDefect(idx) {
    const defectRow = document.getElementById(`defect-${idx}`);
    if (defectRow) defectRow.remove();
    updateDefectsEmpty();
}

/**
 * UPDATE DEFECTS EMPTY STATE
 * ============================================
 * Shows/hides the empty state message for defects.
 */
function updateDefectsEmpty() {
    const list = document.getElementById('defects-list');
    const empty = document.getElementById('defects-empty');
    if (list && empty) {
        empty.style.display = list.children.length === 0 ? 'block' : 'none';
    }
}

/**
 * SELECT SEVERITY
 * ============================================
 * Updates the severity button styles for a defect.
 * 
 * @param {number} idx - Defect index
 * @param {string} severity - Selected severity (Critical, Major, Minor)
 */
function selectSeverity(idx, severity) {
    const container = document.getElementById(`sev-${idx}`);
    if (!container) return;
    
    container.querySelectorAll('.sev-btn').forEach(btn => {
        const sev = btn.getAttribute('data-sev');
        if (sev === severity) {
            // Activate selected button
            if (severity === 'Critical') btn.className = 'sev-btn active-critical';
            else if (severity === 'Major') btn.className = 'sev-btn active-major';
            else btn.className = 'sev-btn active-minor';
        } else {
            btn.className = 'sev-btn inactive';
        }
    });
}

/**
 * PICK PHOTOS
 * ============================================
 * Triggers file input click for a defect.
 * 
 * @param {number} idx - Defect index
 */
function pickPhotos(idx) {
    const input = document.getElementById(`photo-input-${idx}`);
    if (input) input.click();
}

/**
 * HANDLE PHOTO UPLOAD
 * ============================================
 * Processes uploaded photos, compresses them, and adds thumbnails.
 * 
 * @param {number} idx - Defect index
 * @param {HTMLInputElement} input - File input element
 */
function handlePhotoUpload(idx, input) {
    const files = Array.from(input.files);
    const previews = document.getElementById(`photo-previews-${idx}`);
    if (!previews) return;
    
    const existingCount = previews.querySelectorAll('.photo-thumb').length;
    const available = 10 - existingCount;
    
    // Process each file
    files.slice(0, available).forEach(file => {
        compressImage(file, (compressedBase64) => {
            addPhotoThumb(idx, compressedBase64);
            checkPhotoLimit(idx);
        });
    });
    
    // Clear input so same files can be selected again
    input.value = '';
}

/**
 * ADD PHOTO THUMBNAIL
 * ============================================
 * Adds a photo thumbnail to the preview area.
 * 
 * @param {number} idx - Defect index
 * @param {string} src - Base64 image source
 */
function addPhotoThumb(idx, src) {
    const previews = document.getElementById(`photo-previews-${idx}`);
    if (!previews) return;
    
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.dataset.src = src;
    thumb.innerHTML = `
        <img src="${src}" alt="photo">
        <button class="photo-thumb-remove" onclick="removePhoto(this)">×</button>
    `;
    previews.appendChild(thumb);
}

/**
 * REMOVE PHOTO
 * ============================================
 * Removes a photo thumbnail.
 * 
 * @param {HTMLElement} btn - The remove button clicked
 */
function removePhoto(btn) {
    const thumb = btn.closest('.photo-thumb');
    const defectRow = btn.closest('.defect-row');
    if (thumb && defectRow) {
        thumb.remove();
        const idx = defectRow.id.replace('defect-', '');
        checkPhotoLimit(idx);
    }
}

/**
 * CHECK PHOTO LIMIT
 * ============================================
 * Updates UI based on photo count (max 10 per defect).
 * 
 * @param {number} idx - Defect index
 */
function checkPhotoLimit(idx) {
    const previews = document.getElementById(`photo-previews-${idx}`);
    const warn = document.getElementById(`photo-warn-${idx}`);
    const input = document.getElementById(`photo-input-${idx}`);
    const countLabel = document.getElementById(`photo-count-label-${idx}`);
    
    if (!previews || !warn || !input) return;
    
    const count = previews.querySelectorAll('.photo-thumb').length;
    warn.style.display = count >= 10 ? 'block' : 'none';
    input.disabled = count >= 10;
    
    if (countLabel) {
        countLabel.textContent = count === 0 ? 'No photos yet' : `${count} photo${count !== 1 ? 's' : ''}`;
    }
}

/**
 * COLLECT DEFECTS FROM FORM
 * ============================================
 * Gathers all defect data from the form for saving.
 * 
 * @returns {Array} - Array of defect objects with photos
 */
function collectDefects() {
    const rows = document.querySelectorAll('.defect-row');
    const defects = [];
    
    rows.forEach(row => {
        const idx = row.id.replace('defect-', '');
        
        const descInput = document.getElementById(`def-desc-${idx}`);
        const qtyInput = document.getElementById(`def-qty-${idx}`);
        const sevContainer = document.getElementById(`sev-${idx}`);
        
        const description = descInput ? descInput.value.trim() : '';
        const quantity = qtyInput ? qtyInput.value : '';
        
        // Get selected severity
        let severity = 'Major';
        if (sevContainer) {
            const activeBtn = sevContainer.querySelector('.sev-btn:not(.inactive)');
            if (activeBtn) severity = activeBtn.getAttribute('data-sev');
        }
        
        // Collect photos
        const photos = [];
        const previews = document.getElementById(`photo-previews-${idx}`);
        if (previews) {
            previews.querySelectorAll('.photo-thumb').forEach(thumb => {
                if (thumb.dataset.src) photos.push(thumb.dataset.src);
            });
        }
        
        defects.push({
            description: description,
            quantity: quantity,
            severity: severity,
            photoCount: photos.length,
            photos: photos
        });
    });
    
    return defects;
}

/**
 * VALIDATE FORM
 * ============================================
 * Checks all required fields before saving.
 * 
 * @returns {boolean} - True if form is valid
 */
function validateForm() {
    let isValid = true;
    
    const required = [
        { id: 'f-po', errId: 'err-po', label: 'PO Number' },
        { id: 'f-style', errId: 'err-style', label: 'Style Number' },
        { id: 'f-washing', errId: 'err-washing', label: 'Washing Name' },
        { id: 'f-qty', errId: 'err-qty', label: 'Quantity' },
        { id: 'f-date', errId: 'err-date', label: 'Date' }
    ];
    
    required.forEach(field => {
        const el = document.getElementById(field.id);
        const errEl = document.getElementById(field.errId);
        
        if (!el || !el.value.trim()) {
            if (el) el.classList.add('invalid');
            if (errEl) errEl.textContent = `${field.label} is required.`;
            isValid = false;
        } else {
            if (el) el.classList.remove('invalid');
            if (errEl) errEl.textContent = '';
        }
    });
    
    // Validate quantity is a positive number
    const qtyEl = document.getElementById('f-qty');
    if (qtyEl && qtyEl.value && parseInt(qtyEl.value) <= 0) {
        const errEl = document.getElementById('err-qty');
        if (errEl) errEl.textContent = 'Quantity must be greater than 0.';
        if (qtyEl) qtyEl.classList.add('invalid');
        isValid = false;
    }
    
    return isValid;
}

/**
 * SAVE FORM
 * ============================================
 * Saves the inspection (create or update) to storage.
 * 
 * @param {string} forcedStatus - Optional forced status (e.g., 'Draft' for draft save)
 */
function saveForm(forcedStatus = null) {
    // Validate unless forced status is Draft (drafts can be incomplete)
    if (!forcedStatus && !validateForm()) {
        showToast('Please fill in all required fields.', 'error');
        const firstInvalid = document.querySelector('.form-input.invalid');
        if (firstInvalid) {
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    const session = getCurrentSession();
    if (!session) {
        showToast('You must be logged in to save.', 'error');
        return;
    }
    
    const now = new Date().toISOString();
    const status = forcedStatus || getSelectedStatus();
    const defects = collectDefects();
    
    // Prepare inspection data
    const inspectionData = {
        po: document.getElementById('f-po').value.trim(),
        styleNumber: document.getElementById('f-style').value.trim(),
        washingName: document.getElementById('f-washing').value.trim(),
        quantity: parseInt(document.getElementById('f-qty').value),
        date: document.getElementById('f-date').value,
        inspectorName: document.getElementById('f-inspector').value.trim(),
        notes: document.getElementById('f-notes').value.trim(),
        status: status,
        defects: defects.map(d => ({
            description: d.description,
            quantity: d.quantity,
            severity: d.severity,
            photoCount: d.photoCount
        })),
        isReinspection: !!reinspectionSource,
        originalId: reinspectionSource || null
    };
    
    // Separate photos for IndexedDB
    const photosForIDB = defects.map(d => ({ photos: d.photos }));
    
    if (formMode === 'edit' && editingId) {
        // Update existing inspection
        const existing = getInspectionById(editingId);
        if (!existing) {
            showToast('Inspection not found.', 'error');
            return;
        }
        
        // Delete old photos
        const oldDefectCount = (existing.defects || []).length;
        deletePhotosFromIDB(editingId, oldDefectCount, () => {
            // Save new photos
            savePhotosToIDB(editingId, photosForIDB, () => {});
        });
        
        // Update inspection in localStorage
        const updatedInspection = {
            ...inspectionData,
            id: editingId,
            createdBy: existing.createdBy,
            lastEditedBy: session.username,
            createdAt: existing.createdAt,
            updatedAt: now
        };
        
        const inspections = getInspections();
        const index = inspections.findIndex(i => i.id === editingId);
        if (index !== -1) {
            inspections[index] = updatedInspection;
            saveInspections(inspections);
            showToast('Inspection updated successfully.', 'success');
        }
    } else {
        // Create new inspection
        const newInspection = {
            ...inspectionData,
            id: generateId('ins'),
            createdBy: session.username,
            lastEditedBy: session.username,
            createdAt: now,
            updatedAt: now
        };
        
        // Save photos
        savePhotosToIDB(newInspection.id, photosForIDB, () => {});
        
        // Save inspection
        const inspections = getInspections();
        inspections.push(newInspection);
        saveInspections(inspections);
        
        showToast(status === 'Draft' ? 'Draft saved successfully.' : 'Inspection submitted successfully.', 'success');
    }
    
    // Navigate back to inspections list
    navigate('inspections');
}

/**
 * CANCEL FORM
 * ============================================
 * Discards changes and returns to inspections list.
 */
function cancelForm() {
    navigate('inspections');
}

/**
 * ============================================
 * DETAIL VIEW RENDERING
 * ============================================
 */

/**
 * VIEW INSPECTION
 * ============================================
 * Loads and displays an inspection in detail view.
 * 
 * @param {string} id - Inspection ID
 */
function viewInspection(id) {
    const inspection = getInspectionById(id);
    if (!inspection) {
        showToast('Inspection not found.', 'error');
        return;
    }
    
    currentDetailId = id;
    const defectCount = (inspection.defects || []).length;
    
    // Load photos from IndexedDB
    loadPhotosFromIDB(id, defectCount, (photoResults) => {
        // Create array of defects with photos
        const defectsWithPhotos = (inspection.defects || []).map((defect, idx) => ({
            description: defect.description,
            quantity: defect.quantity,
            severity: defect.severity,
            photos: []
        }));
        
        // Add photos to corresponding defects
        photoResults.forEach(photo => {
            if (defectsWithPhotos[photo.defectIndex]) {
                defectsWithPhotos[photo.defectIndex].photos.push(photo.src);
            }
        });
        
        renderDetailView(inspection, defectsWithPhotos);
    });
}

/**
 * RENDER DETAIL VIEW
 * ============================================
 * Renders the complete inspection detail page.
 * 
 * @param {Object} inspection - Inspection object
 * @param {Array} defectsWithPhotos - Defects with photo data
 */
function renderDetailView(inspection, defectsWithPhotos) {
    // Hero section
    const detailPo = document.getElementById('detail-po');
    if (detailPo) detailPo.textContent = inspection.po || '--';
    
    const styleBadge = document.getElementById('detail-style-badge');
    const washingBadge = document.getElementById('detail-washing-badge');
    if (styleBadge) styleBadge.innerHTML = `<span class="detail-meta-chip">Style: ${escHtml(inspection.styleNumber)}</span>`;
    if (washingBadge) washingBadge.innerHTML = `<span class="detail-meta-chip">Washing: ${escHtml(inspection.washingName)}</span>`;
    
    const statusBadgeEl = document.getElementById('detail-status-badge');
    if (statusBadgeEl) statusBadgeEl.innerHTML = getStatusBadge(inspection.status, inspection.isReinspection);
    
    const reinspTag = document.getElementById('detail-reinsp-tag');
    if (reinspTag) reinspTag.style.display = inspection.isReinspection ? 'block' : 'none';
    
    // Order info fields
    document.getElementById('d-po').textContent = inspection.po || '--';
    document.getElementById('d-style').textContent = inspection.styleNumber || '--';
    document.getElementById('d-washing').textContent = inspection.washingName || '--';
    document.getElementById('d-qty').textContent = inspection.quantity ? `${inspection.quantity} pcs` : '--';
    document.getElementById('d-date').textContent = formatDate(inspection.date);
    document.getElementById('d-inspector').textContent = inspection.inspectorName || '--';
    
    // Record info fields
    document.getElementById('d-status-text').textContent = inspection.status || '--';
    document.getElementById('d-created-by').textContent = inspection.createdBy || '--';
    document.getElementById('d-edited-by').textContent = inspection.lastEditedBy || '--';
    document.getElementById('d-created-at').textContent = formatDateTime(inspection.createdAt);
    document.getElementById('d-updated-at').textContent = formatDateTime(inspection.updatedAt);
    
    // Original inspection link for re-inspections
    const origRow = document.getElementById('d-orig-row');
    const origIdSpan = document.getElementById('d-orig-id');
    if (inspection.isReinspection && inspection.originalId) {
        if (origRow) origRow.style.display = 'flex';
        if (origIdSpan) {
            origIdSpan.innerHTML = `<a style="color:var(--violet-2);cursor:pointer" onclick="viewInspection('${inspection.originalId}')">${inspection.originalId}</a>`;
        }
    } else {
        if (origRow) origRow.style.display = 'none';
    }
    
    // Notes section
    const notesCard = document.getElementById('d-notes-card');
    const notesEl = document.getElementById('d-notes');
    if (inspection.notes && inspection.notes.trim()) {
        if (notesCard) notesCard.style.display = 'block';
        if (notesEl) notesEl.textContent = inspection.notes;
    } else {
        if (notesCard) notesCard.style.display = 'none';
    }
    
    // Defects section
    renderDetailDefects(defectsWithPhotos);
    
    // Re-inspection CTA (only for failed inspections)
    const reinspCta = document.getElementById('reinsp-cta');
    if (reinspCta) {
        reinspCta.style.display = inspection.status === 'Failed' ? 'flex' : 'none';
    }
    
    // Action buttons (based on permissions)
    const actionsEl = document.getElementById('detail-actions');
    if (actionsEl) {
        let buttons = '';
        if (hasPermission('export_data')) {
            buttons += `<button class="btn btn-ghost btn-sm" onclick="exportCSV('${inspection.id}')">CSV</button>`;
            buttons += `<button class="btn btn-ghost btn-sm" onclick="exportPDF('${inspection.id}')">PDF</button>`;
        }
        if (canAccessInspection(inspection)) {
            buttons += `<button class="btn btn-ghost btn-sm" onclick="editInspection('${inspection.id}')">Edit</button>`;
        }
        if (hasPermission('delete_inspection')) {
            buttons += `<button class="btn btn-ghost btn-sm" onclick="openDeleteModal('${inspection.id}', 'detail')">Delete</button>`;
        }
        actionsEl.innerHTML = buttons;
    }
    
    // Navigate to detail page
    navigate('detail');
}

/**
 * RENDER DETAIL DEFECTS
 * ============================================
 * Renders the defects section in detail view.
 * 
 * @param {Array} defects - Defects with photos
 */
function renderDetailDefects(defects) {
    const list = document.getElementById('detail-defects-list');
    const empty = document.getElementById('detail-defects-empty');
    const summary = document.getElementById('defect-summary');
    
    if (!list || !empty || !summary) return;
    
    if (!defects || defects.length === 0) {
        list.style.display = 'none';
        empty.style.display = 'block';
        summary.innerHTML = '';
        return;
    }
    
    list.style.display = 'block';
    empty.style.display = 'none';
    
    // Count by severity
    const critical = defects.filter(d => d.severity === 'Critical').length;
    const major = defects.filter(d => d.severity === 'Major').length;
    const minor = defects.filter(d => d.severity === 'Minor').length;
    
    // Create summary chips
    let chips = '';
    if (critical) chips += `<span class="sev-chip sev-chip-critical">Critical: ${critical}</span>`;
    if (major) chips += `<span class="sev-chip sev-chip-major">Major: ${major}</span>`;
    if (minor) chips += `<span class="sev-chip sev-chip-minor">Minor: ${minor}</span>`;
    chips += `<span class="sev-chip" style="background:var(--bg-3);color:var(--text-muted)">Total: ${defects.length}</span>`;
    summary.innerHTML = chips;
    
    // Render each defect
    list.innerHTML = '';
    defects.forEach((defect, idx) => {
        const sevClass = defect.severity === 'Critical' ? 'sev-chip-critical' :
                        defect.severity === 'Major' ? 'sev-chip-major' : 'sev-chip-minor';
        
        // Generate photos HTML
        let photosHtml = '';
        if (defect.photos && defect.photos.length > 0) {
            photosHtml = `<div class="defect-photos-grid">` +
                defect.photos.map(src => 
                    `<img class="defect-photo-thumb" src="${src}" alt="photo" 
                          data-lbsrc="${encodeURIComponent(src)}" 
                          onclick="openLightboxFromEl(this)">`
                ).join('') +
                `</div>`;
        }
        
        const card = document.createElement('div');
        card.className = 'defect-detail-card';
        card.innerHTML = `
            <div class="defect-detail-header">
                <div class="defect-detail-desc">
                    #${idx + 1} - ${escHtml(defect.description || 'No description')}
                </div>
                <div class="defect-detail-meta">
                    <span class="defect-qty-chip">Qty: ${escHtml(String(defect.quantity || '--'))}</span>
                    <span class="sev-chip ${sevClass}">${escHtml(defect.severity)}</span>
                </div>
            </div>
            ${photosHtml}
        `;
        list.appendChild(card);
    });
}

/**
 * OPEN LIGHTBOX FROM ELEMENT
 * ============================================
 * Opens lightbox with the clicked photo.
 * 
 * @param {HTMLElement} el - The clicked image element
 */
function openLightboxFromEl(el) {
    const src = decodeURIComponent(el.getAttribute('data-lbsrc') || el.src);
    openLightbox(src);
}

/**
 * OPEN LIGHTBOX
 * ============================================
 * Displays a full-size image in a modal overlay.
 * 
 * @param {string} src - Image source URL
 */
function openLightbox(src) {
    // Remove existing lightbox
    const existing = document.querySelector('.lightbox');
    if (existing) existing.remove();
    
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.onclick = function(e) {
        // Close when clicking overlay, not image
        if (e.target === lb) lb.remove();
    };
    lb.innerHTML = `
        <button class="lightbox-close" onclick="this.closest('.lightbox').remove()">×</button>
        <img src="${src}" alt="photo" onclick="event.stopPropagation()">
    `;
    document.body.appendChild(lb);
}

/**
 * ============================================
 * ADMIN PANEL RENDERING
 * ============================================
 */

/**
 * RENDER ADMIN PANEL
 * ============================================
 * Displays user management interface for admins.
 */
function renderAdminPanel() {
    // Check permission
    if (!hasPermission('access_admin_panel')) {
        showToast('Access denied. Admin privileges required.', 'error');
        navigate('dashboard');
        return;
    }
    
    const session = getCurrentSession();
    const searchTerm = document.getElementById('admin-search')?.value.toLowerCase().trim() || '';
    const roleFilter = document.getElementById('admin-role-filter')?.value || '';
    
    let users = getUsers();
    
    // Apply filters
    users = users.filter(user => {
        const matchesSearch = !searchTerm || user.username.toLowerCase().includes(searchTerm);
        const matchesRole = !roleFilter || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });
    
    // Sort: Admin first, then Supervisor, then Inspector
    const roleOrder = { Admin: 0, Supervisor: 1, Inspector: 2 };
    users.sort((a, b) => {
        const orderDiff = (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3);
        if (orderDiff !== 0) return orderDiff;
        return a.username.localeCompare(b.username);
    });
    
    // Render statistics
    const stats = getUserStatistics();
    const statsEl = document.getElementById('admin-stats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="admin-stat-chip">
                <span style="font-size:18px">👥</span>
                <div>
                    <div class="admin-stat-chip-val">${stats.total}</div>
                    <div class="admin-stat-chip-label">Total Users</div>
                </div>
            </div>
            <div class="admin-stat-chip">
                <span style="font-size:18px">⚙️</span>
                <div>
                    <div class="admin-stat-chip-val">${stats.admins}</div>
                    <div class="admin-stat-chip-label">Admins</div>
                </div>
            </div>
            <div class="admin-stat-chip">
                <span style="font-size:18px">🛡️</span>
                <div>
                    <div class="admin-stat-chip-val">${stats.supervisors}</div>
                    <div class="admin-stat-chip-label">Supervisors</div>
                </div>
            </div>
            <div class="admin-stat-chip">
                <span style="font-size:18px">🔍</span>
                <div>
                    <div class="admin-stat-chip-val">${stats.inspectors}</div>
                    <div class="admin-stat-chip-label">Inspectors</div>
                </div>
            </div>
        `;
    }
    
    // Render user table
    const tbody = document.getElementById('admin-tbody');
    const table = document.getElementById('admin-table');
    const empty = document.getElementById('admin-empty');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (users.length === 0) {
        if (table) table.style.display = 'none';
        if (empty) empty.style.display = 'block';
    } else {
        if (table) table.style.display = '';
        if (empty) empty.style.display = 'none';
        
        users.forEach(user => {
            const isSelf = user.id === session?.id;
            const admins = getUsers().filter(u => u.role === 'Admin');
            const isLastAdmin = user.role === 'Admin' && admins.length === 1;
            
            const roleClass = user.role === 'Admin' ? 'role-admin' :
                             user.role === 'Supervisor' ? 'role-supervisor' : 'role-inspector';
            
            const roleOptions = ['Inspector', 'Supervisor', 'Admin'].map(r => 
                `<option value="${r}" ${user.role === r ? 'selected' : ''}>${r}</option>`
            ).join('');
            
            const selfTag = isSelf ? '<span class="self-badge">YOU</span>' : '';
            const disableRole = isSelf || isLastAdmin;
            const disableDelete = isSelf || isLastAdmin;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="user-avatar" style="width:34px;height:34px;font-size:14px">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                </td>
                <td>
                    <strong>${escHtml(user.username)}</strong>${selfTag}
                </td>
                <td>
                    <select class="role-select ${roleClass}" 
                            ${disableRole ? 'disabled' : ''}
                            onchange="changeUserRole('${user.id}', this.value, this)">
                        ${roleOptions}
                    </select>
                </td>
                <td>${formatDate((user.createdAt || '').slice(0, 10))}</td>
                <td>
                    <button class="action-btn danger" 
                            ${disableDelete ? 'disabled style="opacity:0.35;cursor:not-allowed"' : ''}
                            onclick="openDeleteUserModal('${user.id}')">
                        Delete
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

/**
 * CHANGE USER ROLE (Admin)
 * ============================================
 * Updates a user's role and refreshes UI.
 * 
 * @param {string} userId - User ID to update
 * @param {string} newRole - New role
 * @param {HTMLElement} selectEl - The select element (to update UI)
 */
function changeUserRole(userId, newRole, selectEl) {
    const result = changeUserRoleAPI(userId, newRole);
    
    if (result.success) {
        showToast(result.message, 'success');
        
        // Update select styling
        const roleClass = newRole === 'Admin' ? 'role-admin' :
                         newRole === 'Supervisor' ? 'role-supervisor' : 'role-inspector';
        selectEl.className = `role-select ${roleClass}`;
        
        // Refresh admin panel
        renderAdminPanel();
        
        // Update current session if role changed for current user
        const session = getCurrentSession();
        if (session && session.id === userId) {
            refreshSession();
            updateUIForUser();
        }
    } else {
        showToast(result.message, 'error');
        // Reset select to original value
        const user = getUserById(userId);
        if (user && selectEl) selectEl.value = user.role;
    }
}

/**
 * OPEN DELETE USER MODAL
 * ============================================
 * Shows confirmation modal for user deletion.
 * 
 * @param {string} userId - User ID to delete
 */
function openDeleteUserModal(userId) {
    pendingDeleteUserId = userId;
    const modal = document.getElementById('delete-user-modal');
    if (modal) modal.style.display = 'flex';
}

/**
 * CLOSE DELETE USER MODAL
 * ============================================
 * Hides the user deletion confirmation modal.
 */
function closeDeleteUserModal() {
    pendingDeleteUserId = null;
    const modal = document.getElementById('delete-user-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * CONFIRM DELETE USER
 * ============================================
 * Executes user deletion after confirmation.
 */
function confirmDeleteUser() {
    if (!pendingDeleteUserId) return;
    
    const result = deleteUserAccount(pendingDeleteUserId);
    
    if (result.success) {
        showToast(result.message, 'success');
        renderAdminPanel();
    } else {
        showToast(result.message, 'error');
    }
    
    closeDeleteUserModal();
}

/**
 * ============================================
 * MODAL FUNCTIONS (Delete Inspection)
 * ============================================
 */

/**
 * OPEN DELETE MODAL
 * ============================================
 * Shows confirmation modal for inspection deletion.
 * 
 * @param {string} id - Inspection ID
 * @param {string} returnPage - Where to return after delete ('list' or 'detail')
 */
function openDeleteModal(id, returnPage = 'list') {
    pendingDeleteId = id;
    deleteReturnPage = returnPage;
    const modal = document.getElementById('delete-modal');
    if (modal) modal.style.display = 'flex';
}

/**
 * CLOSE DELETE MODAL
 * ============================================
 * Hides the inspection deletion confirmation modal.
 */
function closeDeleteModal() {
    pendingDeleteId = null;
    const modal = document.getElementById('delete-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * CONFIRM DELETE
 * ============================================
 * Executes inspection deletion after confirmation.
 */
function confirmDelete() {
    if (!pendingDeleteId) return;
    
    deleteInspection(pendingDeleteId, (success) => {
        if (success) {
            showToast('Inspection deleted successfully.', 'success');
            
            if (deleteReturnPage === 'detail') {
                navigate('inspections');
            } else {
                renderInspectionsList();
                renderDashboard();
            }
        } else {
            showToast('Failed to delete inspection.', 'error');
        }
        
        closeDeleteModal();
    });
}

/**
 * ============================================
 * NAVIGATION & UI UTILITIES
 * ============================================
 */

/**
 * NAVIGATE TO PAGE
 * ============================================
 * Switches between pages and updates active navigation.
 * 
 * @param {string} page - Page name (dashboard, inspections, new-inspection, detail, admin)
 */
function navigate(page) {
    // Check page access permissions
    if (!checkPageAccess(page)) return;
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    // Show selected page
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');
    
    // Update active navigation item
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
        if (nav.getAttribute('data-page') === page) {
            nav.classList.add('active');
        }
    });
    
    // Close sidebar on mobile
    closeSidebar();
    
    // Render page-specific content
    switch (page) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'inspections':
            renderInspectionsList();
            break;
        case 'admin':
            renderAdminPanel();
            break;
        case 'new-inspection':
            updateDefectsEmpty();
            break;
        case 'detail':
            // Already rendered when viewInspection was called
            break;
    }
}

/**
 * CLOSE SIDEBAR
 * ============================================
 * Closes the sidebar on mobile devices.
 */
function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburger = document.getElementById('hamburger');
    
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    if (hamburger) hamburger.classList.remove('open');
}

/**
 * TOGGLE SIDEBAR
 * ============================================
 * Opens/closes the sidebar on mobile devices.
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburger = document.getElementById('hamburger');
    
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
    if (hamburger) hamburger.classList.toggle('open');
}

/**
 * UPDATE STORAGE DISPLAY
 * ============================================
 * Updates the storage usage bar in the sidebar.
 */
function updateStorageDisplay() {
    const stats = getStorageStats();
    const fillEl = document.getElementById('storage-bar-fill');
    const labelEl = document.getElementById('storage-bar-label');
    
    if (fillEl) {
        const percent = Math.min(100, stats.localStorage.percent);
        fillEl.style.width = `${percent}%`;
        fillEl.style.background = stats.localStorage.percent > 85 ? 'var(--danger)' :
                                  stats.localStorage.percent > 60 ? 'var(--warning)' : 'var(--success)';
    }
    
    if (labelEl) {
        labelEl.textContent = `Storage: ${stats.localStorage.usedFormatted} / ${stats.localStorage.limitFormatted}`;
    }
}

/**
 * SEED DEMO DATA
 * ============================================
 * Loads demo data for testing and demonstration.
 */
function seedDemoData() {
    const session = getCurrentSession();
    if (!session) {
        showToast('Please log in first.', 'error');
        return;
    }
    
    const inspections = getInspections();
    if (inspections.length > 0) {
        if (!confirm('This will add demo data to your existing inspections. Continue?')) {
            return;
        }
    }
    
    const demoInspections = createDemoInspections(session.username);
    const existing = getInspections();
    saveInspections([...existing, ...demoInspections]);
    
    renderDashboard();
    renderInspectionsList();
    showToast(`Added ${demoInspections.length} demo inspections.`, 'success');
}

/**
 * ============================================
 * EVENT LISTENERS INITIALIZATION
 * ============================================
 */

/**
 * INITIALIZE UI
 * ============================================
 * Sets up all event listeners and initial UI state.
 */
function initUI() {
    // Set up search with debounce
    const searchInput = document.getElementById('list-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => debouncedSearch());
    }
    
    // Set up filter event listeners
    const statusFilter = document.getElementById('filter-status');
    const dateFrom = document.getElementById('filter-date-from');
    const dateTo = document.getElementById('filter-date-to');
    const clearFilters = document.getElementById('clear-filters');
    
    if (statusFilter) statusFilter.addEventListener('change', () => renderInspectionsList());
    if (dateFrom) dateFrom.addEventListener('change', () => renderInspectionsList());
    if (dateTo) dateTo.addEventListener('change', () => renderInspectionsList());
    if (clearFilters) clearFilters.addEventListener('click', () => clearListFilters());
    
    // Admin panel filters
    const adminSearch = document.getElementById('admin-search');
    const adminRoleFilter = document.getElementById('admin-role-filter');
    if (adminSearch) adminSearch.addEventListener('input', () => renderAdminPanel());
    if (adminRoleFilter) adminRoleFilter.addEventListener('change', () => renderAdminPanel());
    
    // Form buttons
    const addDefectBtn = document.getElementById('add-defect-btn');
    const saveDraftBtn = document.getElementById('save-draft-btn');
    const submitBtn = document.getElementById('submit-btn');
    const saveDraftBottom = document.getElementById('save-draft-bottom');
    const submitBottom = document.getElementById('submit-bottom');
    const createReinspBtn = document.getElementById('create-reinsp-btn');
    
    if (addDefectBtn) addDefectBtn.addEventListener('click', () => addDefect());
    if (saveDraftBtn) saveDraftBtn.addEventListener('click', () => saveForm('Draft'));
    if (submitBtn) submitBtn.addEventListener('click', () => saveForm());
    if (saveDraftBottom) saveDraftBottom.addEventListener('click', () => saveForm('Draft'));
    if (submitBottom) submitBottom.addEventListener('click', () => saveForm());
    if (createReinspBtn && currentDetailId) {
        createReinspBtn.addEventListener('click', () => openReinspectionForm(currentDetailId));
    }
    
    // Modal buttons
    const cancelDelete = document.getElementById('cancel-delete-btn');
    const confirmDelete = document.getElementById('confirm-delete-btn');
    const cancelDeleteUser = document.getElementById('cancel-delete-user-btn');
    const confirmDeleteUser = document.getElementById('confirm-delete-user-btn');
    
    if (cancelDelete) cancelDelete.addEventListener('click', () => closeDeleteModal());
    if (confirmDelete) confirmDelete.addEventListener('click', () => confirmDelete());
    if (cancelDeleteUser) cancelDeleteUser.addEventListener('click', () => closeDeleteUserModal());
    if (confirmDeleteUser) confirmDeleteUser.addEventListener('click', () => confirmDeleteUser());
    
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle-input');
    if (themeToggle) {
        themeToggle.addEventListener('change', () => toggleTheme());
    }
    
    // Sortable column headers
    document.querySelectorAll('.sortable').forEach(el => {
        const sortCol = el.getAttribute('data-sort');
        if (sortCol) {
            el.addEventListener('click', () => sortList(sortCol));
        }
    });
    
    // Update storage display periodically
    updateStorageDisplay();
    setInterval(updateStorageDisplay, 30000); // Update every 30 seconds
}

// Export functions for global use
window.UIAPI = {
    renderDashboard,
    renderInspectionsList,
    renderAdminPanel,
    navigate,
    openCreateForm,
    editInspection,
    viewInspection,
    openReinspectionForm,
    cancelForm,
    saveForm,
    addDefect,
    removeDefect,
    selectSeverity,
    pickPhotos,
    handlePhotoUpload,
    removePhoto,
    openDeleteModal,
    closeDeleteModal,
    confirmDelete,
    openDeleteUserModal,
    closeDeleteUserModal,
    confirmDeleteUser,
    changeUserRole,
    seedDemoData,
    toggleSidebar,
    closeSidebar,
    sortList,
    clearListFilters,
    openLightbox,
    openLightboxFromEl,
    updateStorageDisplay
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initUI();
});