// ===== FIREBASE DATABASE CLEANUP UTILITY =====
// Use this script to clean up unwanted data nodes in Firebase Realtime Database

class FirebaseCleanup {
    constructor() {
        this.db = null;
        this.auth = null;
        this.isInitialized = false;
    }

    // Initialize Firebase services
    async initialize() {
        try {
            // Wait for Firebase to be available
            const checkFirebase = setInterval(() => {
                if (window.firebaseAuth && window.firebaseDb) {
                    this.auth = window.firebaseAuth;
                    this.db = window.firebaseDb;
                    this.isInitialized = true;
                    clearInterval(checkFirebase);
                    console.log('✅ Firebase Cleanup initialized successfully');
                }
            }, 100);
        } catch (error) {
            console.error('❌ Failed to initialize Firebase Cleanup:', error);
        }
    }

    // Remove empty or null nodes
    async removeEmptyNodes(path) {
        try {
            const { ref, get, remove } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const dbRef = ref(this.db, path);
            const snapshot = await get(dbRef);
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                let removedCount = 0;

                for (const [key, value] of Object.entries(data)) {
                    if (value === null || value === undefined || 
                        (typeof value === 'object' && Object.keys(value).length === 0) ||
                        (typeof value === 'string' && value.trim() === '')) {
                        
                        const childRef = ref(this.db, `${path}/${key}`);
                        await remove(childRef);
                        removedCount++;
                        console.log(`🗑️ Removed empty node: ${path}/${key}`);
                    }
                }

                console.log(`✅ Cleanup complete for ${path}: ${removedCount} empty nodes removed`);
                return removedCount;
            } else {
                console.log(`ℹ️ No data found at path: ${path}`);
                return 0;
            }
        } catch (error) {
            console.error(`❌ Error cleaning up ${path}:`, error);
            return 0;
        }
    }

    // Remove duplicate entries based on a specific field
    async removeDuplicates(path, uniqueField) {
        try {
            const { ref, get, remove } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const dbRef = ref(this.db, path);
            const snapshot = await get(dbRef);
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                const seen = new Map();
                let removedCount = 0;

                for (const [key, value] of Object.entries(data)) {
                    if (value && value[uniqueField]) {
                        const fieldValue = value[uniqueField];
                        
                        if (seen.has(fieldValue)) {
                            // This is a duplicate, remove it
                            const childRef = ref(this.db, `${path}/${key}`);
                            await remove(childRef);
                            removedCount++;
                            console.log(`🗑️ Removed duplicate: ${path}/${key} (${uniqueField}: ${fieldValue})`);
                        } else {
                            seen.set(fieldValue, key);
                        }
                    }
                }

                console.log(`✅ Duplicate cleanup complete for ${path}: ${removedCount} duplicates removed`);
                return removedCount;
            } else {
                console.log(`ℹ️ No data found at path: ${path}`);
                return 0;
            }
        } catch (error) {
            console.error(`❌ Error removing duplicates from ${path}:`, error);
            return 0;
        }
    }

    // Remove test/demo data
    async removeTestData(path, testIdentifiers = ['test', 'demo', 'sample', 'example']) {
        try {
            const { ref, get, remove } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const dbRef = ref(this.db, path);
            const snapshot = await get(dbRef);
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                let removedCount = 0;

                for (const [key, value] of Object.entries(data)) {
                    let isTestData = false;

                    // Check if key contains test identifiers
                    if (testIdentifiers.some(identifier => 
                        key.toLowerCase().includes(identifier.toLowerCase()))) {
                        isTestData = true;
                    }

                    // Check if any value fields contain test identifiers
                    if (value && typeof value === 'object') {
                        for (const [fieldKey, fieldValue] of Object.entries(value)) {
                            if (typeof fieldValue === 'string' && 
                                testIdentifiers.some(identifier => 
                                    fieldValue.toLowerCase().includes(identifier.toLowerCase()))) {
                                isTestData = true;
                                break;
                            }
                        }
                    }

                    if (isTestData) {
                        const childRef = ref(this.db, `${path}/${key}`);
                        await remove(childRef);
                        removedCount++;
                        console.log(`🗑️ Removed test data: ${path}/${key}`);
                    }
                }

                console.log(`✅ Test data cleanup complete for ${path}: ${removedCount} test entries removed`);
                return removedCount;
            } else {
                console.log(`ℹ️ No data found at path: ${path}`);
                return 0;
            }
        } catch (error) {
            console.error(`❌ Error removing test data from ${path}:`, error);
            return 0;
        }
    }

    // Remove incomplete records (missing required fields)
    async removeIncompleteRecords(path, requiredFields) {
        try {
            const { ref, get, remove } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const dbRef = ref(this.db, path);
            const snapshot = await get(dbRef);
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                let removedCount = 0;

                for (const [key, value] of Object.entries(data)) {
                    if (value && typeof value === 'object') {
                        let isIncomplete = false;

                        for (const field of requiredFields) {
                            if (!value.hasOwnProperty(field) || 
                                value[field] === null || 
                                value[field] === undefined || 
                                (typeof value[field] === 'string' && value[field].trim() === '')) {
                                isIncomplete = true;
                                break;
                            }
                        }

                        if (isIncomplete) {
                            const childRef = ref(this.db, `${path}/${key}`);
                            await remove(childRef);
                            removedCount++;
                            console.log(`🗑️ Removed incomplete record: ${path}/${key}`);
                        }
                    }
                }

                console.log(`✅ Incomplete records cleanup complete for ${path}: ${removedCount} records removed`);
                return removedCount;
            } else {
                console.log(`ℹ️ No data found at path: ${path}`);
                return 0;
            }
        } catch (error) {
            console.error(`❌ Error removing incomplete records from ${path}:`, error);
            return 0;
        }
    }

    // Remove old records based on timestamp
    async removeOldRecords(path, timestampField, daysOld = 30) {
        try {
            const { ref, get, remove } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const dbRef = ref(this.db, path);
            const snapshot = await get(dbRef);
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysOld);
                let removedCount = 0;

                for (const [key, value] of Object.entries(data)) {
                    if (value && value[timestampField]) {
                        const recordDate = new Date(value[timestampField]);
                        
                        if (recordDate < cutoffDate) {
                            const childRef = ref(this.db, `${path}/${key}`);
                            await remove(childRef);
                            removedCount++;
                            console.log(`🗑️ Removed old record: ${path}/${key} (${recordDate.toDateString()})`);
                        }
                    }
                }

                console.log(`✅ Old records cleanup complete for ${path}: ${removedCount} old records removed`);
                return removedCount;
            } else {
                console.log(`ℹ️ No data found at path: ${path}`);
                return 0;
            }
        } catch (error) {
            console.error(`❌ Error removing old records from ${path}:`, error);
            return 0;
        }
    }

    // Comprehensive cleanup for all common paths
    async performFullCleanup() {
        console.log('🧹 Starting comprehensive Firebase database cleanup...');
        
        const cleanupTasks = [
            // Clean up students collection
            { path: 'students', type: 'empty' },
            { path: 'students', type: 'test' },
            { path: 'students', type: 'incomplete', requiredFields: ['email', 'name'] },

            // Clean up staff collection
            { path: 'staff', type: 'empty' },
            { path: 'staff', type: 'test' },
            { path: 'staff', type: 'incomplete', requiredFields: ['email', 'name'] },

            // Clean up assignments
            { path: 'assignments', type: 'empty' },
            { path: 'assignments', type: 'test' },
            { path: 'assignments', type: 'incomplete', requiredFields: ['title', 'description', 'createdBy'] },

            // Clean up applications
            { path: 'applications', type: 'empty' },
            { path: 'applications', type: 'test' },
            { path: 'applications', type: 'incomplete', requiredFields: ['title', 'type', 'submittedBy'] },

            // Clean up announcements
            { path: 'announcements', type: 'empty' },
            { path: 'announcements', type: 'test' },
            { path: 'announcements', type: 'incomplete', requiredFields: ['title', 'message', 'createdBy'] },

            // Clean up submissions
            { path: 'submissions', type: 'empty' },
            { path: 'submissions', type: 'test' },

            // Clean up MCQ assignments
            { path: 'mcq-assignments', type: 'empty' },
            { path: 'mcq-assignments', type: 'test' },

            // Clean up schedule events
            { path: 'schedule-events', type: 'empty' },
            { path: 'schedule-events', type: 'test' },
        ];

        let totalRemoved = 0;

        for (const task of cleanupTasks) {
            try {
                let removed = 0;
                
                switch (task.type) {
                    case 'empty':
                        removed = await this.removeEmptyNodes(task.path);
                        break;
                    case 'test':
                        removed = await this.removeTestData(task.path);
                        break;
                    case 'incomplete':
                        removed = await this.removeIncompleteRecords(task.path, task.requiredFields);
                        break;
                    case 'old':
                        removed = await this.removeOldRecords(task.path, task.timestampField, task.daysOld);
                        break;
                }
                
                totalRemoved += removed;
                
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`❌ Error in cleanup task for ${task.path}:`, error);
            }
        }

        console.log(`🎉 Full cleanup complete! Total nodes removed: ${totalRemoved}`);
        return totalRemoved;
    }

    // Manual cleanup for specific node
    async removeSpecificNode(path) {
        try {
            const { ref, remove } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const dbRef = ref(this.db, path);
            await remove(dbRef);
            console.log(`✅ Successfully removed node: ${path}`);
            return true;
        } catch (error) {
            console.error(`❌ Error removing node ${path}:`, error);
            return false;
        }
    }

    // List all nodes in a path for manual review
    async listNodes(path, maxDepth = 1) {
        try {
            const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const dbRef = ref(this.db, path);
            const snapshot = await get(dbRef);
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                console.log(`📋 Nodes in ${path}:`);
                
                for (const [key, value] of Object.entries(data)) {
                    if (typeof value === 'object' && value !== null) {
                        const keys = Object.keys(value);
                        console.log(`  📁 ${key} (${keys.length} properties): ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`);
                    } else {
                        console.log(`  📄 ${key}: ${typeof value === 'string' ? value.substring(0, 50) + '...' : value}`);
                    }
                }
            } else {
                console.log(`ℹ️ No data found at path: ${path}`);
            }
        } catch (error) {
            console.error(`❌ Error listing nodes in ${path}:`, error);
        }
    }
}

// Initialize and make available globally
const firebaseCleanup = new FirebaseCleanup();

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    firebaseCleanup.initialize();
});

// Make cleanup functions available globally for console use
window.firebaseCleanup = firebaseCleanup;

// Helper functions for console use
window.cleanupHelpers = {
    // Quick cleanup commands
    removeEmpty: (path) => firebaseCleanup.removeEmptyNodes(path),
    removeTest: (path) => firebaseCleanup.removeTestData(path),
    removeDuplicates: (path, field) => firebaseCleanup.removeDuplicates(path, field),
    removeIncomplete: (path, fields) => firebaseCleanup.removeIncompleteRecords(path, fields),
    removeOld: (path, field, days) => firebaseCleanup.removeOldRecords(path, field, days),
    removeNode: (path) => firebaseCleanup.removeSpecificNode(path),
    listNodes: (path) => firebaseCleanup.listNodes(path),
    fullCleanup: () => firebaseCleanup.performFullCleanup(),
    
    // Common cleanup commands
    cleanStudents: () => {
        firebaseCleanup.removeEmptyNodes('students');
        firebaseCleanup.removeTestData('students');
        firebaseCleanup.removeIncompleteRecords('students', ['email', 'name']);
    },
    
    cleanApplications: () => {
        firebaseCleanup.removeEmptyNodes('applications');
        firebaseCleanup.removeTestData('applications');
        firebaseCleanup.removeIncompleteRecords('applications', ['title', 'type', 'submittedBy']);
    },
    
    cleanAssignments: () => {
        firebaseCleanup.removeEmptyNodes('assignments');
        firebaseCleanup.removeTestData('assignments');
        firebaseCleanup.removeIncompleteRecords('assignments', ['title', 'description', 'createdBy']);
    }
};

console.log('🧹 Firebase Cleanup Utility loaded!');
console.log('💡 Usage examples:');
console.log('  - cleanupHelpers.fullCleanup() - Complete database cleanup');
console.log('  - cleanupHelpers.listNodes("students") - List all student nodes');
console.log('  - cleanupHelpers.removeEmpty("applications") - Remove empty application nodes');
console.log('  - cleanupHelpers.removeTest("assignments") - Remove test assignment data');
console.log('  - cleanupHelpers.removeNode("path/to/specific/node") - Remove specific node');
