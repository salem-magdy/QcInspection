/**
 * ============================================
 * EXPORTS MODULE
 * ============================================
 * This file handles data export functionality:
 * - CSV export (comma-separated values for spreadsheets)
 * - PDF export (professional inspection reports)
 * 
 * Why two formats?
 * - CSV: Easy to analyze in Excel, lightweight, good for data processing
 * - PDF: Professional reports, formatted for printing, presentation-ready
 * 
 * Dependencies:
 * - jsPDF library (loaded from CDN)
 * - Our storage and utility modules
 */

/**
 * ============================================
 * CSV EXPORT
 * ============================================
 */

/**
 * EXPORT INSPECTION AS CSV
 * ============================================
 * Creates a CSV file with inspection data and all defects.
 * Each defect appears on its own row with inspection metadata repeated.
 * 
 * CSV Structure:
 * - Row 1: Headers (all fields)
 * - Row 2+: Data rows (one per defect, or one row if no defects)
 * 
 * Why multi-row format?
 * - Each defect gets its own row for easier analysis in Excel
 * - You can filter by defect type, severity, etc.
 * - Better for statistical analysis
 * 
 * @param {string} id - Inspection ID to export
 */
function exportCSV(id) {
    // Get the inspection
    const inspection = getInspectionById(id);
    if (!inspection) {
        showToast('Inspection not found.', 'error');
        return;
    }
    
    // Define CSV columns (order matters for readability)
    const columns = [
        'Inspection ID',
        'PO Number',
        'Style Number',
        'Washing Name',
        'Quantity',
        'Inspection Date',
        'Inspector',
        'Status',
        'Is Re-inspection',
        'Original ID',
        'Notes',
        'Created By',
        'Last Edited By',
        'Created At',
        'Updated At',
        'Defect #',
        'Defect Description',
        'Defect Quantity',
        'Defect Severity',
        'Photo Count'
    ];
    
    // Prepare data rows
    const defects = inspection.defects || [];
    const rows = [];
    
    // Base inspection data (repeated for each defect)
    const baseData = [
        inspection.id,
        inspection.po,
        inspection.styleNumber,
        inspection.washingName,
        inspection.quantity,
        inspection.date,
        inspection.inspectorName || '',
        inspection.status,
        inspection.isReinspection ? 'Yes' : 'No',
        inspection.originalId || '',
        inspection.notes || '',
        inspection.createdBy || '',
        inspection.lastEditedBy || '',
        formatDateTime(inspection.createdAt),
        formatDateTime(inspection.updatedAt)
    ];
    
    if (defects.length === 0) {
        // If no defects, create one row with empty defect fields
        const row = [...baseData, '', '', '', '', ''];
        rows.push(row);
    } else {
        // Create a row for each defect
        defects.forEach((defect, index) => {
            const defectData = [
                index + 1,
                defect.description || '',
                defect.quantity || '',
                defect.severity || '',
                defect.photoCount || 0
            ];
            const row = [...baseData, ...defectData];
            rows.push(row);
        });
    }
    
    // Convert to CSV string
    const csvContent = convertToCSV(columns, rows);
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `QCI_${inspection.po}_${inspection.date}_export.csv`;
    downloadFile(blob, filename);
    
    showToast('CSV exported successfully.', 'success');
}

/**
 * CONVERT TO CSV
 * ============================================
 * Converts column headers and data rows to properly formatted CSV.
 * Handles escaping of quotes, commas, and newlines.
 * 
 * CSV Rules:
 * - Fields with commas, quotes, or newlines must be quoted
 * - Quotes inside fields must be doubled ("")
 * - Always use UTF-8 encoding
 * 
 * @param {Array} columns - Array of column headers
 * @param {Array} rows - Array of data rows (each an array of values)
 * @returns {string} - Properly formatted CSV string
 */
function convertToCSV(columns, rows) {
    // Escape a single value for CSV
    const escapeValue = (value) => {
        if (value === null || value === undefined) return '';
        
        const str = String(value);
        
        // Check if escaping is needed
        const needsQuoting = str.includes(',') || 
                            str.includes('"') || 
                            str.includes('\n') || 
                            str.includes('\r');
        
        if (needsQuoting) {
            // Double up any quotes
            const escaped = str.replace(/"/g, '""');
            return `"${escaped}"`;
        }
        
        return str;
    };
    
    // Build CSV lines
    const lines = [];
    
    // Headers row
    lines.push(columns.map(escapeValue).join(','));
    
    // Data rows
    rows.forEach(row => {
        lines.push(row.map(escapeValue).join(','));
    });
    
    return lines.join('\r\n');
}

/**
 * EXPORT ALL INSPECTIONS AS CSV
 * ============================================
 * Exports all inspections to a single CSV file.
 * Useful for backup or comprehensive analysis.
 * 
 * @returns {boolean} - True if export successful
 */
function exportAllToCSV() {
    const inspections = getInspections();
    
    if (inspections.length === 0) {
        showToast('No inspections to export.', 'error');
        return false;
    }
    
    // Define columns
    const columns = [
        'Inspection ID',
        'PO Number',
        'Style Number',
        'Washing Name',
        'Quantity',
        'Inspection Date',
        'Inspector',
        'Status',
        'Is Re-inspection',
        'Original ID',
        'Notes',
        'Created By',
        'Last Edited By',
        'Created At',
        'Updated At',
        'Defect #',
        'Defect Description',
        'Defect Quantity',
        'Defect Severity',
        'Photo Count'
    ];
    
    const rows = [];
    
    // Process each inspection
    inspections.forEach(inspection => {
        const baseData = [
            inspection.id,
            inspection.po,
            inspection.styleNumber,
            inspection.washingName,
            inspection.quantity,
            inspection.date,
            inspection.inspectorName || '',
            inspection.status,
            inspection.isReinspection ? 'Yes' : 'No',
            inspection.originalId || '',
            inspection.notes || '',
            inspection.createdBy || '',
            inspection.lastEditedBy || '',
            formatDateTime(inspection.createdAt),
            formatDateTime(inspection.updatedAt)
        ];
        
        const defects = inspection.defects || [];
        
        if (defects.length === 0) {
            rows.push([...baseData, '', '', '', '', '']);
        } else {
            defects.forEach((defect, index) => {
                rows.push([
                    ...baseData,
                    index + 1,
                    defect.description || '',
                    defect.quantity || '',
                    defect.severity || '',
                    defect.photoCount || 0
                ]);
            });
        }
    });
    
    // Create CSV
    const csvContent = convertToCSV(columns, rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    downloadFile(blob, `QCI_All_Inspections_${timestamp}.csv`);
    
    showToast(`Exported ${inspections.length} inspections to CSV.`, 'success');
    return true;
}

/**
 * ============================================
 * PDF EXPORT
 * ============================================
 * Generates professional PDF reports using jsPDF.
 * 
 * Features:
 * - Professional layout with headers and footers
 * - Color-coded status badges
 * - Defect table with severity colors
 * - Embedded photos when available
 * - Page numbers and timestamps
 */

/**
 * EXPORT INSPECTION AS PDF
 * ============================================
 * Creates a formatted PDF report for an inspection.
 * This is a complex function with many layout calculations.
 * 
 * @param {string} id - Inspection ID to export
 */
function exportPDF(id) {
    // Check if jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
        showToast('PDF library not loaded. Please refresh the page.', 'error');
        return;
    }
    
    const inspection = getInspectionById(id);
    if (!inspection) {
        showToast('Inspection not found.', 'error');
        return;
    }
    
    // Load photos first (async)
    const defectCount = (inspection.defects || []).length;
    loadPhotosFromIDB(id, defectCount, (photoResults) => {
        // Create defects with photos
        const defectsWithPhotos = (inspection.defects || []).map((defect, idx) => ({
            description: defect.description,
            quantity: defect.quantity,
            severity: defect.severity,
            photos: []
        }));
        
        photoResults.forEach(photo => {
            if (defectsWithPhotos[photo.defectIndex]) {
                defectsWithPhotos[photo.defectIndex].photos.push(photo.src);
            }
        });
        
        // Generate PDF with photos
        generatePDFReport(inspection, defectsWithPhotos);
    });
}

/**
 * GENERATE PDF REPORT
 * ============================================
 * Creates the actual PDF document with all content.
 * 
 * PDF Dimensions (A4):
 * - Width: 210mm
 * - Height: 297mm
 * - Margins: 16mm left and right
 * - Content width: 178mm
 * 
 * @param {Object} inspection - Inspection object
 * @param {Array} defectsWithPhotos - Defects with photo data
 */
function generatePDFReport(inspection, defectsWithPhotos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    // Constants for layout
    const WIDTH = 210;
    const LEFT_MARGIN = 16;
    const RIGHT_MARGIN = 16;
    const CONTENT_WIDTH = WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
    let y = 20; // Current Y position (starts from top)
    
    // Helper functions for PDF styling
    const setFont = (style, size, color = [15, 27, 45]) => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
    };
    
    const drawRect = (x, y, w, h, color) => {
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(x, y, w, h, 'F');
    };
    
    const drawLine = (y) => {
        doc.setDrawColor(220, 228, 240);
        doc.setLineWidth(0.3);
        doc.line(LEFT_MARGIN, y, WIDTH - RIGHT_MARGIN, y);
    };
    
    const checkPageBreak = (needed) => {
        if (y + needed > 280) {
            doc.addPage();
            y = 20;
            return true;
        }
        return false;
    };
    
    // ============================================
    // HEADER SECTION
    // ============================================
    
    // Top colored bar
    drawRect(0, 0, WIDTH, 28, [108, 99, 255]); // Violet
    drawRect(0, 24, WIDTH, 4, [255, 107, 53]); // Orange accent
    
    // Logo and title
    setFont('bold', 18, [255, 255, 255]);
    doc.text('QCInspect', LEFT_MARGIN, 16);
    setFont('normal', 9, [200, 196, 255]);
    doc.text('Quality Final Inspection Report', LEFT_MARGIN, 22);
    setFont('normal', 8, [200, 196, 255]);
    const dateStr = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    doc.text(`Generated: ${dateStr}`, WIDTH - RIGHT_MARGIN, 22, { align: 'right' });
    
    y = 38;
    
    // ============================================
    // ORDER INFORMATION SECTION
    // ============================================
    
    checkPageBreak(35);
    drawRect(LEFT_MARGIN, y, CONTENT_WIDTH, 7, [240, 244, 255]);
    setFont('bold', 10, [108, 99, 255]);
    doc.text('ORDER INFORMATION', LEFT_MARGIN + 4, y + 5);
    y += 10;
    
    // Two-column layout for order info
    const infoFields = [
        ['PO Number', inspection.po],
        ['Style Number', inspection.styleNumber],
        ['Washing Name', inspection.washingName],
        ['Quantity', inspection.quantity ? `${inspection.quantity} pcs` : '--'],
        ['Inspection Date', formatDate(inspection.date)],
        ['Inspector', inspection.inspectorName || '--']
    ];
    
    const colWidth = CONTENT_WIDTH / 2;
    infoFields.forEach((field, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = LEFT_MARGIN + (col * colWidth);
        const fieldY = y + (row * 12);
        
        checkPageBreak(12);
        
        // Field label
        setFont('bold', 8, [100, 116, 139]);
        doc.text(field[0].toUpperCase(), x + 2, fieldY + 4);
        
        // Field value
        setFont('normal', 10, [15, 27, 45]);
        doc.text(String(field[1] || '--'), x + 2, fieldY + 9);
        
        // Border
        doc.setDrawColor(220, 228, 240);
        doc.setLineWidth(0.2);
        doc.rect(x, fieldY, colWidth, 12, 'S');
    });
    
    y += Math.ceil(infoFields.length / 2) * 12 + 8;
    
    // ============================================
    // INSPECTION RESULT SECTION
    // ============================================
    
    checkPageBreak(25);
    drawRect(LEFT_MARGIN, y, CONTENT_WIDTH, 7, [240, 244, 255]);
    setFont('bold', 10, [108, 99, 255]);
    doc.text('INSPECTION RESULT', LEFT_MARGIN + 4, y + 5);
    y += 10;
    
    // Status badge
    const statusColors = {
        'Passed': [52, 211, 153],
        'Failed': [248, 113, 113],
        'Pending': [251, 191, 36],
        'In Progress': [96, 165, 250],
        'Draft': [100, 116, 139]
    };
    const statusColor = statusColors[inspection.status] || [100, 116, 139];
    const lightColor = statusColor.map(c => Math.min(255, c + 170));
    
    drawRect(LEFT_MARGIN, y, 44, 10, lightColor);
    setFont('bold', 10, statusColor);
    doc.text(inspection.status || '--', LEFT_MARGIN + 22, y + 7, { align: 'center' });
    
    // Re-inspection badge
    if (inspection.isReinspection) {
        drawRect(LEFT_MARGIN + 48, y, 36, 10, [255, 235, 220]);
        setFont('bold', 9, [255, 107, 53]);
        doc.text('RE-INSPECTION', LEFT_MARGIN + 66, y + 7, { align: 'center' });
    }
    
    y += 14;
    
    // Metadata row (Created, Edited, Updated)
    setFont('bold', 8, [100, 116, 139]);
    doc.text('CREATED BY', LEFT_MARGIN + 2, y);
    doc.text('LAST EDITED BY', LEFT_MARGIN + 55, y);
    doc.text('UPDATED AT', LEFT_MARGIN + 110, y);
    y += 5;
    
    setFont('normal', 9, [15, 27, 45]);
    doc.text(inspection.createdBy || '--', LEFT_MARGIN + 2, y);
    doc.text(inspection.lastEditedBy || '--', LEFT_MARGIN + 55, y);
    doc.text(formatDateTime(inspection.updatedAt), LEFT_MARGIN + 110, y);
    y += 10;
    
    // Notes section
    if (inspection.notes && inspection.notes.trim()) {
        checkPageBreak(20);
        setFont('bold', 8, [100, 116, 139]);
        doc.text('NOTES', LEFT_MARGIN + 2, y);
        y += 4;
        setFont('normal', 9, [15, 27, 45]);
        const notesLines = doc.splitTextToSize(inspection.notes, CONTENT_WIDTH - 4);
        doc.text(notesLines, LEFT_MARGIN + 2, y);
        y += notesLines.length * 5 + 6;
    }
    
    drawLine(y);
    y += 6;
    
    // ============================================
    // DEFECT SUMMARY SECTION
    // ============================================
    
    checkPageBreak(20);
    drawRect(LEFT_MARGIN, y, CONTENT_WIDTH, 7, [240, 244, 255]);
    setFont('bold', 10, [108, 99, 255]);
    doc.text('DEFECT SUMMARY', LEFT_MARGIN + 4, y + 5);
    y += 10;
    
    const defects = defectsWithPhotos;
    if (defects.length === 0) {
        setFont('italic', 10, [100, 116, 139]);
        doc.text('No defects recorded.', LEFT_MARGIN + 2, y + 6);
        y += 14;
    } else {
        // Summary chips
        const critical = defects.filter(d => d.severity === 'Critical').length;
        const major = defects.filter(d => d.severity === 'Major').length;
        const minor = defects.filter(d => d.severity === 'Minor').length;
        
        const chipData = [
            ['Critical: ' + critical, [248, 113, 113]],
            ['Major: ' + major, [251, 191, 36]],
            ['Minor: ' + minor, [96, 165, 250]],
            ['Total: ' + defects.length, [100, 116, 139]]
        ];
        
        let chipX = LEFT_MARGIN;
        chipData.forEach(chip => {
            const textWidth = doc.getTextWidth(chip[0]);
            const chipWidth = textWidth + 8;
            
            drawRect(chipX, y, chipWidth, 8, chip[1].map(c => Math.min(255, c + 165)));
            setFont('bold', 8, chip[1]);
            doc.text(chip[0], chipX + 4, y + 5.5);
            
            chipX += chipWidth + 4;
        });
        
        y += 12;
        
        // Defects table header
        checkPageBreak(15);
        drawRect(LEFT_MARGIN, y, CONTENT_WIDTH, 7, [230, 234, 245]);
        setFont('bold', 8, [100, 116, 139]);
        doc.text('#', LEFT_MARGIN + 2, y + 5);
        doc.text('DESCRIPTION', LEFT_MARGIN + 10, y + 5);
        doc.text('QTY', LEFT_MARGIN + 120, y + 5);
        doc.text('SEVERITY', LEFT_MARGIN + 140, y + 5);
        doc.text('PHOTOS', LEFT_MARGIN + 168, y + 5);
        y += 8;
        
        // Defects table rows
        defects.forEach((defect, i) => {
            checkPageBreak(12);
            
            // Alternating row background
            const bgColor = i % 2 === 0 ? [255, 255, 255] : [240, 244, 255];
            drawRect(LEFT_MARGIN, y, CONTENT_WIDTH, 9, bgColor);
            
            setFont('normal', 8, [15, 27, 45]);
            doc.text(String(i + 1), LEFT_MARGIN + 2, y + 6);
            
            // Truncate description if too long
            const desc = defect.description || '--';
            const truncatedDesc = desc.length > 50 ? desc.substring(0, 47) + '...' : desc;
            doc.text(truncatedDesc, LEFT_MARGIN + 10, y + 6);
            
            doc.text(String(defect.quantity || '--'), LEFT_MARGIN + 120, y + 6);
            
            // Severity chip
            const sevColor = defect.severity === 'Critical' ? [248, 113, 113] :
                            defect.severity === 'Major' ? [251, 191, 36] : [96, 165, 250];
            const sevLight = sevColor.map(c => Math.min(255, c + 160));
            drawRect(LEFT_MARGIN + 138, y + 1, 26, 7, sevLight);
            setFont('bold', 7, sevColor);
            doc.text(defect.severity || '--', LEFT_MARGIN + 151, y + 6, { align: 'center' });
            
            setFont('normal', 8, [100, 116, 139]);
            doc.text(String(defect.photos?.length || 0), LEFT_MARGIN + 174, y + 6);
            
            y += 9;
        });
        
        y += 4;
        
        // ============================================
        // PHOTOS SECTION
        // ============================================
        
        const defectsWithPhotos = defects.filter(d => d.photos && d.photos.length > 0);
        if (defectsWithPhotos.length > 0) {
            checkPageBreak(20);
            drawLine(y);
            y += 6;
            
            drawRect(LEFT_MARGIN, y, CONTENT_WIDTH, 7, [240, 244, 255]);
            setFont('bold', 10, [108, 99, 255]);
            doc.text('DEFECT PHOTOS', LEFT_MARGIN + 4, y + 5);
            y += 10;
            
            defectsWithPhotos.forEach(defect => {
                checkPageBreak(35);
                
                setFont('bold', 9, [15, 27, 45]);
                const descShort = (defect.description || '').substring(0, 60);
                doc.text(`Defect: ${descShort}`, LEFT_MARGIN, y);
                y += 5;
                
                // Photo grid
                const thumbSize = 26;
                const gap = 4;
                let photoX = LEFT_MARGIN;
                let photoY = y;
                let photosOnRow = 0;
                
                (defect.photos || []).forEach((photo, idx) => {
                    if (photosOnRow > 0 && photoX + thumbSize > WIDTH - RIGHT_MARGIN) {
                        photoX = LEFT_MARGIN;
                        photoY += thumbSize + gap;
                        photosOnRow = 0;
                        checkPageBreak(thumbSize + gap + 10);
                    }
                    
                    try {
                        // Try to add the image
                        const imageType = photo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                        doc.addImage(photo, imageType, photoX, photoY, thumbSize, thumbSize);
                    } catch (e) {
                        // If image fails, draw a placeholder
                        drawRect(photoX, photoY, thumbSize, thumbSize, [240, 244, 255]);
                        setFont('normal', 8, [100, 116, 139]);
                        doc.text('Photo', photoX + 8, photoY + 14);
                    }
                    
                    photoX += thumbSize + gap;
                    photosOnRow++;
                });
                
                y = photoY + thumbSize + 8;
            });
        }
    }
    
    // ============================================
    // FOOTER (Page Numbers)
    // ============================================
    
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Footer bar
        drawRect(0, 287, WIDTH, 10, [108, 99, 255]);
        setFont('normal', 7, [200, 196, 255]);
        doc.text('QCInspect - Confidential QC Report', WIDTH / 2, 293, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, WIDTH - RIGHT_MARGIN, 293, { align: 'right' });
    }
    
    // Save the PDF
    const filename = `QCI_${(inspection.po || 'report').replace(/[^a-z0-9]/gi, '_')}_${inspection.date || 'export'}.pdf`;
    doc.save(filename);
    
    showToast('PDF exported successfully.', 'success');
}

/**
 * ============================================
 * UTILITY FUNCTIONS
 * ============================================
 */

/**
 * EXPORT DATA AS JSON (Backup)
 * ============================================
 * Exports all application data as JSON for backup.
 * 
 * @returns {boolean} - True if export successful
 */
function exportBackupJSON() {
    const data = exportAllData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    downloadFile(blob, `QCInspect_Backup_${timestamp}.json`);
    
    showToast('Backup exported successfully.', 'success');
    return true;
}

/**
 * IMPORT DATA FROM JSON (Restore)
 * ============================================
 * Imports backup data and restores the application.
 * 
 * @param {File} file - JSON file to import
 */
function importBackupJSON(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate data structure
            if (!data.inspections || !data.users) {
                throw new Error('Invalid backup file structure');
            }
            
            if (confirm('This will replace ALL existing data. Are you sure?')) {
                importAllData(data);
            }
        } catch (error) {
            showToast('Invalid backup file: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

// Export functions for global use
window.ExportAPI = {
    exportCSV,
    exportAllToCSV,
    exportPDF,
    exportBackupJSON,
    importBackupJSON
};