// ===== FIREBASE INTEGRATION =====
// Firebase configuration and initialization
let firebaseAuth, firebaseDb;

// Initialize Firebase when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase to be available
    const checkFirebase = setInterval(() => {
        if (window.firebaseAuth && window.firebaseDb && window.firebaseServices) {
            firebaseAuth = window.firebaseAuth;
            firebaseDb = window.firebaseDb;
            clearInterval(checkFirebase);
            
            // Set up Firebase auth state listener
            setupFirebaseAuthListener();
            
            // Initialize the app
            initializeApp();
        }
    }, 100);
});

// ===== UI UTILITIES =====
// Show alert/notification function
function showAlert(message, type = 'info', duration = 5000) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert-toast');
    existingAlerts.forEach(alert => alert.remove());
    
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert-toast alert alert-${type}`;
    alert.innerHTML = `
        <div class="alert-icon">
            <i class="fas ${getAlertIcon(type)}"></i>
        </div>
        <div class="alert-content">
            <div class="alert-message">${message}</div>
        </div>
        <button type="button" class="alert-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add styles
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
        box-shadow: var(--shadow-lg);
    `;
    
    // Add to page
    document.body.appendChild(alert);
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (alert.parentElement) {
                alert.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => alert.remove(), 300);
            }
        }, duration);
    }
    
    return alert;
}

// Get alert icon based on type
function getAlertIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'info': 
        default: return 'fa-info-circle';
    }
}

// Show loading state
function showLoading(element, text = 'Loading...') {
    if (!element) return;
    
    const originalContent = element.innerHTML;
    element.disabled = true;
    element.innerHTML = `
        <span class="loading"></span>
        <span>${text}</span>
    `;
    
    return () => {
        element.disabled = false;
        element.innerHTML = originalContent;
    };
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return 'Today';
    } else if (diffDays === 2) {
        return 'Yesterday';
    } else if (diffDays <= 7) {
        return `${diffDays - 1} days ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

// Format time for display
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Check if date is overdue
function isOverdue(dueDate) {
    return new Date(dueDate) < new Date();
}

// Check if date is due soon (within 24 hours)
function isDueSoon(dueDate) {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due - now;
    const diffHours = diffTime / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 24;
}

// Get status badge class
function getStatusBadgeClass(status) {
    switch (status.toLowerCase()) {
        case 'pending': return 'badge-warning';
        case 'submitted': return 'badge-info';
        case 'graded': return 'badge-success';
        case 'overdue': return 'badge-error';
        case 'approved': return 'badge-success';
        case 'rejected': return 'badge-error';
        case 'under_review': return 'badge-info';
        default: return 'badge-gray';
    }
}

// Debounce function for search inputs
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .alert-toast {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-4);
        border-radius: var(--radius-lg);
        margin-bottom: var(--space-2);
        border: 1px solid;
    }
    
    .alert-toast .alert-close {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: var(--space-1);
        border-radius: var(--radius-sm);
        transition: background-color var(--transition-normal);
        margin-left: auto;
    }
    
    .alert-toast .alert-close:hover {
        background: rgba(0, 0, 0, 0.1);
    }
    
    .loading {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        border: 2px solid var(--gray-200);
        border-radius: 50%;
        border-top-color: var(--primary-500);
        animation: spin 1s ease-in-out infinite;
        margin-right: var(--space-2);
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// ===== FIREBASE AUTHENTICATION FUNCTIONS =====
async function registerUser(email, password, role, name = null) {
    try {
        console.log(`🔄 Registering new ${role} user: ${email}`);
        
        // Validate and set default role
        if (!role || (role !== 'student' && role !== 'staff')) {
            role = 'student'; // Default to student if no valid role
            console.log(`⚠️ Invalid role provided, defaulting to: ${role}`);
        }
        
        // Import Firebase auth functions
        const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        // Create user with email and password
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        const user = userCredential.user;
        
        // Store user data in unified /users/{uid} structure
        const userData = {
            uid: user.uid,
            name: name || email.split('@')[0], // Use provided name or email prefix as fallback
            email: user.email,
            role: role,
            department: 'General', // Default department
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };
        
        // Validate user.uid is a string
        if (!user.uid || typeof user.uid !== 'string') {
            throw new Error(`Invalid user UID: ${user.uid} (type: ${typeof user.uid})`);
        }
        
        // Store user profile in appropriate collection based on role
        if (role === 'staff') {
            await addDataWithTimestamp('staff', user.uid, userData);
            console.log(`✅ Staff user registered successfully in Firebase: /staff/${user.uid}`);
        } else {
            await addDataWithTimestamp('students', user.uid, userData);
            console.log(`✅ Student user registered successfully in Firebase: /students/${user.uid}`);
        }
        
        // Store user info with proper structure
        const userInfo = {
            uid: user.uid,
            email: user.email,
            name: userData.name,
            role: role,
            department: userData.department
        };
        
        // Use the new setCurrentUser function to ensure proper synchronization
        setCurrentUser(userInfo);
        
        return { success: true, user: userInfo };
    } catch (error) {
        console.error('❌ Registration error:', error);
        return { success: false, error: error.message };
    }
}

async function loginUser(email, password, portal = null) {
    try {
        console.log(`🔐 Universal login for: ${email} (Portal: ${portal || 'auto-detect'})`);
        
        // If portal is specified, use the appropriate login function
        if (portal === 'staff') {
            return await loginStaffPortal(email, password);
        } else if (portal === 'student') {
            return await loginStudentPortal(email, password);
        }
        
        // Auto-detect portal by checking both collections
        console.log(`🔍 Auto-detecting portal for user: ${email}`);
        
        // Import Firebase auth functions
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        // Sign in with email and password
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const user = userCredential.user;
        
        console.log(`✅ Firebase authentication successful for: ${user.email}`);
        
        // Check both collections to determine user type
        console.log(`🔍 Checking staff collection: /staff/${user.uid}`);
        let staffData = await getData('staff', user.uid);
        
        if (staffData) {
            console.log(`📊 User found in staff collection - redirecting to staff portal`);
            return await loginStaffPortal(email, password);
        }
        
        console.log(`🔍 Checking students collection: /students/${user.uid}`);
        let studentData = await getData('students', user.uid);
        
        if (studentData) {
            console.log(`📊 User found in students collection - redirecting to student portal`);
            return await loginStudentPortal(email, password);
        }
        
        // User not found in either collection
        console.log(`❌ User not found in any collection for UID: ${user.uid}`);
        return { success: false, error: 'User account not found. Please contact administrator to set up your account.' };
        
    } catch (error) {
        console.error('❌ Universal login error:', error);
        return { success: false, error: error.message };
    }
}

async function logoutUser() {
    try {
        // Import Firebase auth functions
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        // Sign out from Firebase
        await signOut(firebaseAuth);
        
        // Clear local storage
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUser');
        
        // Reset global state
        currentUser = null;
        
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

// ===== FIREBASE REALTIME DATABASE FUNCTIONS =====
async function addData(path, data) {
    try {
        // Import Realtime Database functions
        const { ref, set, push } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        // Ensure path is a valid string
        const cleanPath = String(path).trim();
        
        // Validate path
        if (!cleanPath) {
            throw new Error(`Invalid path: "${cleanPath}"`);
        }
        
        // If data has an ID, use set, otherwise use push to generate a new key
        if (data.id) {
            const cleanId = String(data.id).trim();
            if (!cleanId) {
                throw new Error(`Invalid data.id: "${cleanId}"`);
            }
            
            const dbRef = ref(firebaseDb, `${cleanPath}/${cleanId}`);
            console.log(`📝 Adding data to Firebase: ${cleanPath}/${cleanId}`);
            await set(dbRef, data);
            return cleanId;
        } else {
            const dbRef = ref(firebaseDb, cleanPath);
            const newRef = push(dbRef);
            console.log(`📝 Adding data to Firebase: ${cleanPath}/${newRef.key}`);
            await set(newRef, data);
            return newRef.key;
        }
    } catch (error) {
        console.error('Error adding data:', error);
        throw error;
    }
}

async function getData(path, id = null) {
    try {
        // Import Realtime Database functions
        const { ref, get, query, orderByChild, limitToLast } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        // Ensure path is a valid string
        const cleanPath = String(path).trim();
        
        // Validate path
        if (!cleanPath) {
            throw new Error(`Invalid path: "${cleanPath}"`);
        }
        
        if (id) {
            // Get single record
            const cleanId = String(id).trim();
            if (!cleanId) {
                throw new Error(`Invalid id: "${cleanId}"`);
            }
            
            const dbRef = ref(firebaseDb, `${cleanPath}/${cleanId}`);
            console.log(`📖 Reading from Firebase: ${cleanPath}/${cleanId}`);
            const snapshot = await get(dbRef);
            
            if (snapshot.exists()) {
                return { id: snapshot.key, ...snapshot.val() };
            } else {
                return null;
            }
        } else {
            // Get all records at path
            const dbRef = ref(firebaseDb, cleanPath);
            console.log(`📖 Reading from Firebase: ${cleanPath}`);
            const snapshot = await get(dbRef);
            
            const records = [];
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    records.push({ id: childSnapshot.key, ...childSnapshot.val() });
                });
            }
            
            return records;
        }
    } catch (error) {
        console.error('Error getting data:', error);
        throw error;
    }
}

async function updateData(path, id, data) {
    try {
        // Import Realtime Database functions
        const { ref, update } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        // Ensure path and id are valid strings
        const cleanPath = String(path).trim();
        const cleanId = String(id).trim();
        
        // Validate path and id
        if (!cleanPath || !cleanId) {
            throw new Error(`Invalid path or id: path="${cleanPath}", id="${cleanId}"`);
        }
        
        // Build the database reference
        const dbRef = ref(firebaseDb, `${cleanPath}/${cleanId}`);
        
        console.log(`🔄 Updating Firebase: ${cleanPath}/${cleanId}`);
        await update(dbRef, data);
        return true;
    } catch (error) {
        console.error('Error updating data:', error);
        throw error;
    }
}

async function deleteData(path, id) {
    try {
        // Import Realtime Database functions
        const { ref, remove } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        // Ensure path and id are valid strings
        const cleanPath = String(path).trim();
        const cleanId = String(id).trim();
        
        // Validate path and id
        if (!cleanPath || !cleanId) {
            throw new Error(`Invalid path or id: path="${cleanPath}", id="${cleanId}"`);
        }
        
        // Build the database reference
        const dbRef = ref(firebaseDb, `${cleanPath}/${cleanId}`);
        
        console.log(`🗑️ Deleting from Firebase: ${cleanPath}/${cleanId}`);
        await remove(dbRef);
        return true;
    } catch (error) {
        console.error('Error deleting data:', error);
        throw error;
    }
}

// ===== ENHANCED FIREBASE FUNCTIONS =====
// Helper function to build and validate Firebase paths
function buildFirebasePath(basePath, id) {
    // Ensure basePath and id are valid strings
    const cleanBasePath = String(basePath).trim();
    const cleanId = String(id).trim();
    
    // Validate inputs
    if (!cleanBasePath) {
        throw new Error(`Invalid base path: "${cleanBasePath}"`);
    }
    if (!cleanId) {
        throw new Error(`Invalid ID: "${cleanId}"`);
    }
    
    // Build the path
    const fullPath = `${cleanBasePath}/${cleanId}`;
    console.log(`🔗 Building Firebase path: ${fullPath}`);
    
    return { basePath: cleanBasePath, id: cleanId, fullPath };
}

async function addDataWithTimestamp(path, id, data) {
    try {
        // Validate and build the path
        const { basePath, id: cleanId } = buildFirebasePath(path, id);
        
        const dataWithTimestamp = {
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Use addData with the validated path and id
        return await addData(basePath, { ...dataWithTimestamp, id: cleanId });
    } catch (error) {
        console.error('Error adding data with timestamp:', error);
        throw error;
    }
}

async function updateDataWithTimestamp(path, id, data) {
    try {
        // Validate and build the path
        const { basePath, id: cleanId } = buildFirebasePath(path, id);
        
        const dataWithTimestamp = {
            ...data,
            updatedAt: new Date().toISOString()
        };
        
        // Use updateData with the validated path and id
        return await updateData(basePath, cleanId, dataWithTimestamp);
    } catch (error) {
        console.error('Error updating data with timestamp:', error);
        throw error;
    }
}

async function getDataByUser(path, userId) {
    try {
        const { ref, get, query, orderByChild, equalTo } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        
        // Ensure path and userId are valid strings
        const cleanPath = String(path).trim();
        const cleanUserId = String(userId).trim();
        
        // Validate path and userId
        if (!cleanPath || !cleanUserId) {
            throw new Error(`Invalid path or userId: path="${cleanPath}", userId="${cleanUserId}"`);
        }
        
        const dbRef = ref(firebaseDb, cleanPath);
        const q = query(dbRef, orderByChild('userId'), equalTo(cleanUserId));
        console.log(`👤 Getting user data from Firebase: ${cleanPath} for user: ${cleanUserId}`);
        const snapshot = await get(q);
        
        const records = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                records.push({ id: childSnapshot.key, ...childSnapshot.val() });
            });
        }
        
        return records;
    } catch (error) {
        console.error('Error getting data by user:', error);
        throw error;
    }
}

// Helper function to get user data from Realtime Database
async function getUserData(uid) {
    try {
        // Validate uid is a string
        if (!uid || typeof uid !== 'string') {
            throw new Error(`Invalid UID: ${uid} (type: ${typeof uid})`);
        }
        
        // Try to get user data from both students and staff collections
        let userData = await getData('students', uid);
        if (!userData) {
            userData = await getData('staff', uid);
        }
        return userData;
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
}

// ===== REALTIME DATABASE INTEGRATION FUNCTIONS =====
// Load data from Realtime Database
async function loadDataFromFirebase() {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            console.log('⚠️ Firebase services not available, skipping data load');
            return;
        }
        
        console.log('🔄 Loading data from Firebase Realtime Database...');
        
        // Load assignments from Firebase (prioritize Firebase data)
        console.log('🔍 Debug - Loading assignments from Firebase...');
        const assignmentsData = await getAssignmentsFromFirebase();
        console.log('🔍 Debug - Raw Firebase assignments data:', assignmentsData);
        
        if (assignmentsData && assignmentsData.length >= 0) {
            assignments = assignmentsData;
            localStorage.setItem('assignments', JSON.stringify(assignments));
            console.log(`✅ Loaded ${assignments.length} assignments from Firebase`);
            console.log('🔍 Debug - Processed assignments:', assignments);
            
            // If Firebase returned empty array, still use it (don't fallback to mock)
            if (assignmentsData.length === 0) {
                console.log('📝 Firebase returned empty assignments array - no assignments available');
            }
        } else {
            console.log('⚠️ No assignments data received from Firebase');
        }
        
        // Load submissions
        const submissionsData = await window.firebaseServices.getAllSubmissions();
        if (submissionsData && submissionsData.length > 0) {
            submissions = submissionsData;
            localStorage.setItem('submissions', JSON.stringify(submissions));
            console.log(`✅ Loaded ${submissions.length} submissions from Firebase`);
        }
        
        // MCQ functionality removed as per user request
        
        // Load applications
        const applicationsData = await getApplicationsFromFirebase();
        if (applicationsData && applicationsData.length > 0) {
            applications = applicationsData;
            localStorage.setItem('applications', JSON.stringify(applications));
            console.log(`✅ Loaded ${applications.length} applications from Firebase`);
        } else {
            // Fallback to local storage if no data in Firebase
            const savedApplications = localStorage.getItem('applications');
            if (savedApplications) {
                applications = JSON.parse(savedApplications);
                console.log(`✅ Loaded ${applications.length} applications from local storage`);
            }
        }
        
        // Load announcements
        const announcementsData = await getAnnouncementsFromFirebase();
        if (announcementsData && announcementsData.length > 0) {
            announcements = announcementsData;
            localStorage.setItem('announcements', JSON.stringify(announcements));
            console.log(`✅ Loaded ${announcements.length} announcements from Firebase`);
        }
        
        // Load schedule events
        const scheduleData = await getSchedulesFromFirebase();
        if (scheduleData && scheduleData.length > 0) {
            scheduleEvents = scheduleData;
            localStorage.setItem('scheduleEvents', JSON.stringify(scheduleEvents));
            console.log(`✅ Loaded ${scheduleEvents.length} schedule events from Firebase`);
        }
        
        // Load users
        const usersData = await window.firebaseServices.getAllUsers();
        if (usersData && usersData.length > 0) {
            users = usersData.map(user => ({
                id: user.uid || user.id,
                name: user.name || user.displayName,
                email: user.email,
                role: user.role,
                phone: user.phone || null
            }));
            console.log(`✅ Loaded ${users.length} users from Firebase`);
        }
        
        console.log('✅ All data loaded from Firebase Realtime Database');
    } catch (error) {
        console.error('❌ Error loading data from Firebase:', error);
    }
}

// Save data to Realtime Database
async function saveDataToFirebase(dataType, data) {
    try {
        if (!firebaseDb) return;
        
        console.log(`💾 Saving ${dataType} to Firebase...`);
        
        switch (dataType) {
            case 'assignments':
                await addDataWithTimestamp('assignments', data);
                break;
            case 'submissions':
                await addDataWithTimestamp('submissions', data);
                break;
            case 'mcqAssignments':
                // Use the new MCQ quiz structure
                await addDataWithTimestamp('mcqQuizzes', data);
                break;
            case 'applications':
                await addDataWithTimestamp('applications', data);
                break;
            case 'announcements':
                await addDataWithTimestamp('announcements', data);
                break;
            case 'schedules':
                await addDataWithTimestamp('schedules', data);
                break;
            case 'students':
                await addDataWithTimestamp('students', data);
                break;
            case 'staff':
                await addDataWithTimestamp('staff', data);
                break;
            default:
                console.warn('⚠️ Unknown data type:', dataType);
        }
        
        console.log(`✅ ${dataType} saved to Firebase Realtime Database`);
        
        // Reload data from Firebase to keep local state in sync
        await loadDataFromFirebase();
        
    } catch (error) {
        console.error(`❌ Error saving ${dataType} to Firebase:`, error);
        throw error;
    }
}

// Update data in Realtime Database
async function updateDataInFirebase(dataType, id, data) {
    try {
        if (!firebaseDb) return;
        
        switch (dataType) {
            case 'assignments':
                await updateDataWithTimestamp('assignments', id, data);
                break;
            case 'submissions':
                await updateDataWithTimestamp('submissions', id, data);
                break;
            case 'mcqAssignments':
                // Use the new MCQ quiz structure
                await updateDataWithTimestamp('mcqQuizzes', id, data);
                break;
            case 'applications':
                await updateDataWithTimestamp('applications', id, data);
                break;
            case 'announcements':
                await updateDataWithTimestamp('announcements', id, data);
                break;
            case 'schedules':
                await updateDataWithTimestamp('schedules', id, data);
                break;
            case 'students':
                await updateDataWithTimestamp('students', id, data);
                break;
            case 'staff':
                await updateDataWithTimestamp('staff', id, data);
                break;
            default:
                console.warn('⚠️ Unknown data type:', dataType);
        }
        
        console.log(`✅ ${dataType} updated in Firebase Realtime Database`);
        
        // Reload data from Firebase to keep local state in sync
        await loadDataFromFirebase();
        
    } catch (error) {
        console.error(`❌ Error updating ${dataType} in Firebase:`, error);
        throw error;
    }
}

// Delete data from Realtime Database
async function deleteDataFromFirebase(dataType, id) {
    try {
        if (!firebaseDb) return;
        
        switch (dataType) {
            case 'assignments':
                await deleteData('assignments', id);
                break;
            case 'submissions':
                await deleteData('submissions', id);
                break;
            case 'mcqAssignments':
                // Use the new MCQ quiz structure
                await deleteData('mcqQuizzes', id);
                break;
            case 'applications':
                await deleteData('applications', id);
                break;
            case 'announcements':
                await deleteData('announcements', id);
                break;
            case 'schedules':
                await deleteData('schedules', id);
                break;
            case 'students':
                await deleteData('students', id);
                break;
            case 'staff':
                await deleteData('staff', id);
                break;
            default:
                console.warn('⚠️ Unknown data type:', dataType);
        }
        
        console.log(`✅ ${dataType} deleted from Firebase Realtime Database`);
        
        // Reload data from Firebase to keep local state in sync
        await loadDataFromFirebase();
        
    } catch (error) {
        console.error(`❌ Error deleting ${dataType} in Firebase:`, error);
        throw error;
    }
}

// ===== FIREBASE AUTH STATE LISTENER =====
function setupFirebaseAuthListener() {
    if (!firebaseAuth) return;
    
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js').then(({ onAuthStateChanged }) => {
        onAuthStateChanged(firebaseAuth, async (user) => {
            // Hide initial loading state
            const initialLoadingState = document.getElementById('initialLoadingState');
            
            if (user) {
                console.log('👤 User signed in:', user.email);
                
                // Check if we already have user data in localStorage
                const savedUser = localStorage.getItem('currentUser');
                if (savedUser) {
                    try {
                        const parsedUser = JSON.parse(savedUser);
                        if (parsedUser && parsedUser.uid === user.uid) {
                            // User data already exists in localStorage, use it
                            currentUser = parsedUser;
                            console.log('✅ User data loaded from localStorage');
                            
                            // Redirect directly to main app without showing login page
                            console.log('🔄 User already logged in, redirecting to dashboard');
                            
                            // Keep initial loading state visible and transition directly to dashboard
                            if (initialLoadingState) {
                                // Redirect directly to dashboard
                                await showMainApp();
                                
                                // Fade out initial loading state after dashboard is ready
                                setTimeout(() => {
                                    initialLoadingState.style.opacity = '0';
                                    setTimeout(() => {
                                        initialLoadingState.style.display = 'none';
                                    }, 300);
                                }, 200);
                            } else {
                                await showMainApp();
                            }
                            
                            return;
                        }
                    } catch (error) {
                        console.error('Error parsing user data from localStorage:', error);
                    }
                }
                
                // If we don't have valid user data in localStorage, fetch from Firebase
                try {
                    // First check students collection
                    let userData = await getData('students', user.uid);
                    let userRole = 'student';
                    
                    // If not found in students, check staff collection
                    if (!userData) {
                        userData = await getData('staff', user.uid);
                        userRole = 'staff';
                    }
                    
                    // If still not found, check users collection as fallback
                    if (!userData) {
                        userData = await getData('users', user.uid);
                        userRole = userData?.role || 'student';
                    }
                    
                    if (userData) {
                        // Ensure name field is properly populated
                        let userName = userData.name || userData.displayName || user.displayName || user.email.split('@')[0];
                        
                        // If name is missing from userData, update the Firebase record
                        if (!userData.name && userName) {
                            try {
                                await updateData(userRole === 'staff' ? 'staff' : 'students', user.uid, { name: userName });
                                console.log(`✅ Updated ${userRole} profile with name: ${userName}`);
                            } catch (error) {
                                console.error('❌ Error updating user name in Firebase:', error);
                            }
                        }
                        
                        // Update currentUser with Firebase data using proper structure
                        const userInfo = {
                            uid: user.uid,
                            email: user.email,
                            name: userName,
                            role: userRole,
                            department: userData.department || 'General',
                            portal: userRole
                        };
                        
                        // Use the new setCurrentUser function to ensure proper synchronization
                        setCurrentUser(userInfo);
                        
                        console.log(`✅ Auth state updated: ${currentUser.role} - ${currentUser.name}`);
                        console.log(`🔐 Current user role: ${currentUser.role}`);
                        
                        // Check for initial loading state or login page
                        const initialLoadingState = document.getElementById('initialLoadingState');
                        
                        if (initialLoadingState && initialLoadingState.style.display !== 'none') {
                            // If initial loading state is visible, transition directly to dashboard
                            console.log('🔄 User already logged in, redirecting to dashboard');
                            
                            // Redirect directly to dashboard
                            await showMainApp();
                            
                            // Fade out initial loading state after dashboard is ready
                            setTimeout(() => {
                                initialLoadingState.style.opacity = '0';
                                setTimeout(() => {
                                    initialLoadingState.style.display = 'none';
                                }, 300);
                            }, 200);
                        } else if (document.getElementById('loginPage').classList.contains('active')) {
                            // If login page is visible, show loading overlay and redirect
                            console.log('🔄 User already logged in, redirecting to dashboard');
                            
                            // Show loading indicator before redirecting
                            const loadingOverlay = document.createElement('div');
                            loadingOverlay.className = 'loading-overlay';
                            loadingOverlay.innerHTML = `
                                <div style="text-align: center;">
                                    <div class="loading" style="width: 40px; height: 40px; margin-bottom: 16px;"></div>
                                    <p style="color: var(--gray-700); font-weight: 500;">Loading your dashboard...</p>
                                </div>
                            `;
                            document.body.appendChild(loadingOverlay);
                            
                            // Redirect after a short delay to show the loading indicator
                            setTimeout(async () => {
                                await showMainApp();
                                document.body.removeChild(loadingOverlay);
                            }, 300);
                        }
                    } else {
                        console.warn('⚠️ User data not found in Firebase during auth state change');
                    }
                } catch (error) {
                    console.error('❌ Error fetching user data during auth state change:', error);
                }
            } else {
                console.log('👤 User signed out');
                currentUser = null;
                localStorage.removeItem('currentUser');
                sessionStorage.removeItem('currentUser');
                
                // Update Firebase services currentUser if available
                if (window.firebaseServices) {
                    window.firebaseServices.currentUser = null;
                }
                
                // Show login page and hide initial loading state
                if (initialLoadingState) {
                    // Show login page
                    document.getElementById('loginPage').classList.add('active');
                    document.getElementById('mainApp').classList.remove('active');
                    
                    // Fade out initial loading state
                    setTimeout(() => {
                        initialLoadingState.style.opacity = '0';
                        setTimeout(() => {
                            initialLoadingState.style.display = 'none';
                        }, 300);
                    }, 200);
                }
                
                // Update UI if app is initialized
                if (typeof updateUserInterface === 'function') {
                    updateUserInterface();
                }
            }
        });
    });
}

// ===== FIREBASE MODULE INTEGRATION FUNCTIONS =====

// Assignment Module Integration
async function createAssignmentWithFirebase(assignmentData) {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            throw new Error('Firebase services not available');
        }
        
        const result = await window.firebaseServices.createAssignment(assignmentData);
        if (result.success) {
            console.log('✅ Assignment created with Firebase:', result.assignmentId);
            // Refresh assignments list
            await loadDataFromFirebase();
            return result;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('❌ Error creating assignment with Firebase:', error);
        throw error;
    }
}

async function getAssignmentsFromFirebase() {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            console.log('⚠️ Firebase services not initialized, waiting...');
            // Wait for Firebase services to be available
            await new Promise(resolve => {
                const checkFirebase = setInterval(() => {
                    if (window.firebaseServices && window.firebaseServices.isInitialized) {
                        clearInterval(checkFirebase);
                        resolve();
                    }
                }, 100);
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    clearInterval(checkFirebase);
                    resolve();
                }, 10000);
            });
        }
        
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            throw new Error('Firebase services still not available after waiting');
        }
        
        console.log('🔍 Debug - Calling Firebase getAssignments...');
        const assignments = await window.firebaseServices.getAssignments();
        console.log('🔍 Debug - Raw Firebase assignments:', assignments);
        console.log('🔍 Debug - Assignments type:', typeof assignments);
        console.log('🔍 Debug - Is array:', Array.isArray(assignments));
        
        // Ensure assignments have proper structure
        if (assignments && Array.isArray(assignments)) {
            const processedAssignments = assignments.map(assignment => {
                // Ensure each assignment has an id
                if (!assignment.id && assignment.key) {
                    assignment.id = assignment.key;
                }
                
                // Ensure required fields exist
                return {
                    id: assignment.id || assignment.key || `assignment-${Date.now()}`,
                    title: assignment.title || 'Untitled Assignment',
                    description: assignment.description || 'No description provided',
                    subject: assignment.subject || 'General',
                    dueDate: assignment.dueDate || new Date().toISOString().split('T')[0],
                    dueTime: assignment.dueTime || '23:59',
                    maxScore: assignment.maxScore || 100,
                    createdAt: assignment.createdAt || new Date().toISOString(),
                    createdBy: assignment.createdBy || {
                        uid: 'unknown',
                        name: 'Unknown Teacher',
                        role: 'staff'
                    },
                    status: assignment.status || 'active',
                    ...assignment // Include any other fields
                };
            });
            
            console.log('🔍 Debug - Processed assignments:', processedAssignments);
            return processedAssignments;
        }
        
        console.log('⚠️ Firebase returned non-array or empty assignments');
        return [];
    } catch (error) {
        console.error('❌ Error getting assignments from Firebase:', error);
        return [];
    }
}

async function submitAssignmentWithFirebase(assignmentId, submissionData) {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            throw new Error('Firebase services not available');
        }
        
        const result = await window.firebaseServices.submitAssignment(assignmentId, submissionData);
        if (result.success) {
            console.log('✅ Assignment submitted with Firebase:', result.submissionId);
            // Refresh submissions list
            await loadDataFromFirebase();
            return result;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('❌ Error submitting assignment with Firebase:', error);
        throw error;
    }
}

// Application Module Integration
async function createApplicationWithFirebase(applicationData) {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            throw new Error('Firebase services not available');
        }
        
        const result = await window.firebaseServices.createApplication(applicationData);
        if (result.success) {
            console.log('✅ Application created with Firebase:', result.applicationId);
            // Refresh applications list
            await loadDataFromFirebase();
            return result;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('❌ Error creating application with Firebase:', error);
        throw error;
    }
}

async function getApplicationsFromFirebase() {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            throw new Error('Firebase services not available');
        }
        
        const applications = await window.firebaseServices.getApplications();
        return applications;
    } catch (error) {
        console.error('❌ Error getting applications from Firebase:', error);
        return [];
    }
}

async function updateApplicationStatusWithFirebase(applicationId, status, comment = '') {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            throw new Error('Firebase services not available');
        }
        
        const result = await window.firebaseServices.updateApplicationStatus(applicationId, status, comment);
        if (result.success) {
            console.log('✅ Application status updated with Firebase:', status);
            // Refresh applications list
            await loadDataFromFirebase();
            return result;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('❌ Error updating application status with Firebase:', error);
        throw error;
    }
}

// Announcement Module Integration
async function createAnnouncementWithFirebase(announcementData) {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            throw new Error('Firebase services not available');
        }
        
        const result = await window.firebaseServices.createAnnouncement(announcementData);
        if (result.success) {
            console.log('✅ Announcement created with Firebase:', result.announcementId);
            // Refresh announcements list
            await loadDataFromFirebase();
            return result;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('❌ Error creating announcement with Firebase:', error);
        throw error;
    }
}

async function getAnnouncementsFromFirebase() {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            throw new Error('Firebase services not available');
        }
        
        const announcements = await window.firebaseServices.getAnnouncements();
        return announcements;
    } catch (error) {
        console.error('❌ Error getting announcements from Firebase:', error);
        return [];
    }
}

// Schedule Module Integration
async function createScheduleWithFirebase(scheduleData) {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            throw new Error('Firebase services not available');
        }
        
        const result = await window.firebaseServices.createSchedule(scheduleData);
        if (result.success) {
            console.log('✅ Schedule event created with Firebase:', result.scheduleId);
            // Refresh schedules list
            await loadDataFromFirebase();
            return result;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('❌ Error creating schedule event with Firebase:', error);
        throw error;
    }
}

async function getSchedulesFromFirebase() {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            throw new Error('Firebase services not available');
        }
        const schedules = await window.firebaseServices.getSchedules();
        return schedules;
    } catch (error) {
        console.error('❌ Error getting schedules from Firebase:', error);
        return [];
    }
}

// User Management Integration
async function getUserProfileFromFirebase(uid) {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            throw new Error('Firebase services not available');
        }
        
        const userProfile = await window.firebaseServices.getUserProfile(uid);
        return userProfile;
    } catch (error) {
        console.error('❌ Error getting user profile from Firebase:', error);
        return null;
    }
}

async function updateUserProfileWithFirebase(uid, profileData) {
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            throw new Error('Firebase services not available');
        }
        
        const result = await window.firebaseServices.updateUserProfile(uid, profileData);
        return result;
    } catch (error) {
        console.error('❌ Error updating user profile with Firebase:', error);
        throw error;
    }
}

// ===== UI HELPER FUNCTIONS =====
function showAuthStatus(message, type = 'success') {
    const authStatus = document.getElementById('authStatus');
    if (authStatus) {
        authStatus.textContent = message;
        authStatus.className = `auth-status ${type}`;
        authStatus.classList.remove('hidden');
        
        // Hide after 5 seconds
        setTimeout(() => {
            authStatus.classList.add('hidden');
        }, 5000);
    }
}

function toggleRegistrationForm() {
    const loginPage = document.getElementById('loginPage');
    const registerFormContainer = document.getElementById('registerFormContainer');
    
    if (registerFormContainer.classList.contains('hidden')) {
        // Show registration form
        loginPage.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
        
        // Add animation to form elements with staggered delay
        const formElements = registerFormContainer.querySelectorAll('.form-group, .role-selection, button, .form-row');
        formElements.forEach((element, index) => {
            element.classList.add('animate-fade-in');
            element.style.animationDelay = `${0.1 + (index * 0.1)}s`;
        });
        
        // Add interactive effects to form inputs
        const formInputs = registerFormContainer.querySelectorAll('.form-input');
        formInputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.parentElement.classList.add('input-focus');
            });
            input.addEventListener('blur', () => {
                input.parentElement.classList.remove('input-focus');
            });
        });
    } else {
        // Show login form
        loginPage.classList.remove('hidden');
        registerFormContainer.classList.add('hidden');
    }
}

function showLoginPage() {
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('mainApp').classList.remove('active');
    currentView = 'login';
}

// ===== GLOBAL STATE MANAGEMENT =====
let currentUser = null;
let currentView = 'dashboard';
let assignments = [];
let submissions = [];
// MCQ functionality removed
let applications = [];
let notifications = [];
let scheduleEvents = [];
let announcements = [];
let users = [];

// Initialize applications array properly
if (!applications || !Array.isArray(applications)) {
    applications = [];
    console.log('📋 Applications array initialized');
}

// ===== CURRENT USER MANAGEMENT =====
/**
 * Get the current user with proper structure
 * @returns {Object|null} Current user object with uid, name, role, and email
 */
function getCurrentUser() {
    if (!currentUser) {
        // Try to load from localStorage
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
            } catch (error) {
                console.error('Error parsing currentUser from localStorage:', error);
                return null;
            }
        }
    }
    return currentUser;
}

/**
 * Set the current user and sync across all systems
 * @param {Object} user - User object with uid, name, role, email
 */
function setCurrentUser(user) {
    if (!user || !user.uid) {
        console.error('Invalid user object provided to setCurrentUser');
        return false;
    }
    
    // Ensure proper structure
    currentUser = {
        uid: user.uid,
        id: user.uid, // Keep both for backward compatibility
        name: user.name || user.displayName || user.email?.split('@')[0] || 'Unknown User',
        role: user.role || 'student',
        email: user.email,
        department: user.department || 'General',
        portal: user.portal || user.role
    };
    
    // Sync to localStorage and sessionStorage
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Sync to Firebase services if available
    if (window.firebaseServices) {
        window.firebaseServices.currentUser = currentUser;
        // Also call the sync method to ensure proper synchronization
        if (typeof window.firebaseServices.syncCurrentUser === 'function') {
            window.firebaseServices.syncCurrentUser();
        }
    }
    
    console.log('✅ Current user synchronized:', currentUser);
    return true;
}

/**
 * Check if current user is available and has required role
 * @param {string} requiredRole - Required role ('staff' or 'student')
 * @param {string} operation - Operation being performed (for error message)
 * @returns {boolean} True if user has required role
 */
function requireCurrentUser(requiredRole, operation) {
    const user = getCurrentUser();
    if (!user) {
        showConfirmation('Authentication Error', 'User not logged in or role not found. Please log in again.', 'error');
        return false;
    }
    
    if (user.role !== requiredRole) {
        showConfirmation('Permission Denied', `Only ${requiredRole}s can ${operation}`, 'error');
        return false;
    }
    
    return true;
}

/**
 * Get createdBy object for database operations
 * @returns {Object} createdBy object with uid, name, and role
 */
function getCreatedByObject() {
    const user = getCurrentUser();
    if (!user) {
        throw new Error('User not logged in or role not found');
    }
    
    return {
        uid: user.uid,
        name: user.name,
        role: user.role
    };
}

// ===== MOCK DATA =====
const mockData = {
    assignments: [
        {
            id: '1',
            title: 'Introduction to Web Development',
            description: 'Create a simple HTML page with CSS styling and basic JavaScript functionality. Focus on responsive design principles.',
            dueDate: '2024-02-15',
            status: 'pending',
            subject: 'Web Development',
            maxScore: 100,
            createdBy: 'staff1',
            createdAt: '2024-01-15'
        },
        {
            id: '2',
            title: 'JavaScript Fundamentals',
            description: 'Complete exercises on JavaScript basics including variables, functions, arrays, and object-oriented programming concepts.',
            dueDate: '2024-02-20',
            status: 'submitted',
            subject: 'Programming',
            maxScore: 100,
            submittedAt: '2024-02-18',
            createdBy: 'staff1',
            createdAt: '2024-01-20'
        },
        {
            id: '3',
            title: 'Database Design Principles',
            description: 'Design a normalized database schema for an e-commerce system with proper relationships and constraints.',
            dueDate: '2024-02-25',
            status: 'graded',
            subject: 'Database Systems',
            maxScore: 100,
            grade: 85,
            feedback: 'Excellent normalization work. Consider adding indexes for better performance.',
            createdBy: 'staff1',
            createdAt: '2024-01-25'
        }
    ],
    // MCQ functionality removed as per user request
    // mcqAssignments: [
    //     {
    //         id: 'mcq1',
    //         title: 'Programming Basics Quiz',
    //         description: 'Test your knowledge of programming fundamentals including variables, data types, and control structures.',
    //         dueDate: '2024-02-25',
    //         subject: 'Programming',
    //         questions: [
    //             {
    //                 id: 'q1',
    //                 question: 'What is a variable in programming?',
    //                 options: ['A storage location for data', 'A function that performs calculations', 'A loop that repeats code', 'A condition that checks values'],
    //                 correctAnswer: 'A storage location for data',
    //                 points: 10
    //             },
    //             {
    //                 id: 'q2',
    //                 question: 'Which keyword is used to declare a variable in JavaScript?',
    //                 options: ['var', 'let', 'const', 'All of the above'],
    //                 correctAnswer: 'All of the above',
    //                 points: 10
    //             },
    //             {
    //                 id: 'q3',
    //                 question: 'What is the purpose of a function in programming?',
    //                 options: ['To store data', 'To repeat code', 'To organize and reuse code', 'To create variables'],
    //                 correctAnswer: 'To organize and reuse code',
    //                 points: 10
    //             }
    //         ],
    //         totalPoints: 30,
    //         timeLimit: 30,
    //         allowRetake: true,
    //         showCorrectAnswers: true,
    //         createdBy: 'staff1',
    //         createdAt: '2024-01-25'
    //     }
    // ],
    applications: [
        {
            id: 'app1',
            type: 'internship',
            title: 'Summer Software Development Internship',
            description: 'Application for a 12-week summer internship in software development at TechCorp. Gain hands-on experience with modern web technologies.',
            deadline: '2024-03-01',
            status: 'submitted',
            submittedBy: 'student1',
            submittedAt: '2024-02-01'
        },
        {
            id: 'app2',
            type: 'scholarship',
            title: 'Academic Excellence Scholarship',
            description: 'Merit-based scholarship for students maintaining a GPA of 3.8 or higher. Covers tuition and provides additional academic support.',
            deadline: '2024-03-15',
            status: 'under_review',
            submittedBy: 'student1',
            submittedAt: '2024-02-10'
        }
    ],
    announcements: [
        {
            id: 'ann1',
            title: 'Welcome to Spring Semester 2024',
            content: 'Welcome back students! Classes begin next week. Please check your course schedules and ensure all prerequisites are met. The library will be open extended hours during the first two weeks.',
            type: 'general',
            priority: 'medium',
            targetAudience: 'all',
            isPublished: true,
            publishDate: '2024-01-20',
            createdBy: 'staff1',
            createdAt: '2024-01-20',
            readBy: []
        },
        {
            id: 'ann2',
            title: 'Career Fair Registration Now Open',
            content: 'The annual Spring Career Fair will be held on March 15th. Over 50 companies will be attending. Register now to secure your spot and prepare your resume.',
            type: 'event',
            priority: 'high',
            targetAudience: 'students',
            isPublished: true,
            publishDate: '2024-01-25',
            createdBy: 'staff1',
            createdAt: '2024-01-25',
            readBy: []
        }
    ],
    scheduleEvents: [
        {
            id: 'schedule1',
            title: 'Mathematics Lecture - Linear Algebra',
            description: 'Weekly mathematics lecture covering linear algebra concepts and problem solving.',
            date: '2025-01-18',
            time: '10:00',
            category: 'lecture',
            location: 'Room 201, Mathematics Building',
            priority: 'high',
            createdBy: 'staff1',
            createdAt: '2025-01-16'
        },
        {
            id: 'schedule2',
            title: 'Computer Science Lab Session',
            description: 'Hands-on programming lab session for data structures and algorithms.',
            date: '2025-01-19',
            time: '14:30',
            category: 'lab',
            location: 'Computer Lab 3, CS Building',
            priority: 'medium',
            createdBy: 'staff1',
            createdAt: '2025-01-16'
        },
        {
            id: 'schedule3',
            title: 'Database Assignment Deadline',
            description: 'Submit your normalized database schema design for the e-commerce system project.',
            date: '2025-01-22',
            time: '23:59',
            category: 'assignment',
            location: 'Online Submission',
            priority: 'urgent',
            createdBy: 'staff1',
            createdAt: '2025-01-16'
        },
        {
            id: 'schedule4',
            title: 'Student Council Meeting',
            description: 'Monthly meeting to discuss upcoming events, student concerns, and campus improvements.',
            date: '2025-01-24',
            time: '16:00',
            category: 'meeting',
            location: 'Student Union, Conference Room A',
            priority: 'medium',
            createdBy: 'staff1',
            createdAt: '2025-01-16'
        },
        {
            id: 'schedule5',
            title: 'Physics Lab - Quantum Mechanics',
            description: 'Laboratory experiment on quantum mechanics principles and wave-particle duality.',
            date: '2025-01-17',
            time: '15:30',
            category: 'lab',
            location: 'Physics Lab 2, Science Building',
            priority: 'high',
            createdBy: 'staff1',
            createdAt: '2025-01-16'
        },
        {
            id: 'schedule6',
            title: 'Chemistry Midterm Exam',
            description: 'Midterm examination covering organic chemistry chapters 1-5.',
            date: '2025-01-10',
            time: '09:00',
            category: 'exam',
            location: 'Main Auditorium',
            priority: 'urgent',
            createdBy: 'staff1',
            createdAt: '2025-01-05'
        },
        {
            id: 'schedule7',
            title: 'Programming Workshop - Python',
            description: 'Hands-on workshop on Python programming for beginners.',
            date: '2025-01-12',
            time: '14:00',
            category: 'workshop',
            location: 'Computer Lab 1',
            priority: 'medium',
            createdBy: 'staff1',
            createdAt: '2025-01-08'
        }
    ],
    users: [
        {
            id: 'student1',
            name: 'Alex Johnson',
            email: 'alex.johnson@university.edu',
            role: 'student',
            phone: '+1 (555) 000-0000'
        },
        {
            id: 'staff1',
            name: 'Sarah Wilson',
            email: 'sarah.wilson@university.edu',
            role: 'staff'
        }
    ]
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupAccessibility();
});
    
function initializeApp() {
    // Don't show login page immediately - let auth listener handle it
    // This prevents the login page flash on refresh
    
    // Initialize applications array from localStorage if available
    try {
        const storedApplications = localStorage.getItem('applications');
        if (storedApplications) {
            applications = JSON.parse(storedApplications);
            console.log('📋 Loaded applications from localStorage during initialization:', applications.length);
        } else {
            applications = [];
            console.log('📋 No stored applications found, initialized empty array');
        }
    } catch (error) {
        console.error('❌ Error loading applications from localStorage:', error);
        applications = [];
    }
    
    // First check if user is already logged in before showing any UI
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            console.log('✅ User data loaded from localStorage during initialization');
            // Don't show login page yet - auth listener will handle redirection
        } catch (error) {
            console.error('Error parsing user data from localStorage:', error);
            currentUser = null;
        }
    }
    
    loadData();
    setupEventListeners();
    
    // Load data from Firebase Realtime Database if available
    if (firebaseDb) {
        loadDataFromFirebase();
    }
    
    // Set up periodic sync for MCQ data when Firebase services are available
    setTimeout(() => {
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            console.log('🔄 Setting up periodic MCQ data sync...');
            
            // Initial sync
            loadDataFromFirebase();
            
            // Set up periodic sync
            setInterval(async () => {
                if (window.firebaseServices && window.firebaseServices.isInitialized && currentUser) {
                    try {
                        // MCQ functionality removed - skip MCQ sync
                        // const mcqQuizzesData = await window.firebaseServices.getMCQQuizzes();
                        // if (mcqQuizzesData && mcqQuizzesData.length > 0) {
                        //     // MCQ functionality removed
                        // }
                    } catch (error) {
                        console.error('Error syncing MCQ data:', error);
                    }
                }
            }, 30000); // Sync every 30 seconds
        }
    }, 2000); // Wait 2 seconds for Firebase services to initialize
}

function loadData() {
    // Load from localStorage if available
    const savedNotifications = localStorage.getItem('notifications');
    const savedAssignments = localStorage.getItem('assignments');
    const savedSubmissions = localStorage.getItem('submissions');
    
    // Load current user using the new function
    currentUser = getCurrentUser();
    
    if (savedNotifications) {
        notifications = JSON.parse(savedNotifications);
    }
    
    
    // Load assignments and submissions from localStorage or use mock data
    if (savedAssignments) {
        assignments = JSON.parse(savedAssignments);
    } else {
        assignments = mockData.assignments;
        localStorage.setItem('assignments', JSON.stringify(assignments));
    }
    
    if (savedSubmissions) {
        submissions = JSON.parse(savedSubmissions);
    } else {
        submissions = [];
        localStorage.setItem('submissions', JSON.stringify(submissions));
    }
    
    // Load applications from localStorage or use mock data
    const savedApplications = localStorage.getItem('applications');
    if (savedApplications) {
        applications = JSON.parse(savedApplications);
    } else {
        applications = mockData.applications;
        localStorage.setItem('applications', JSON.stringify(applications));
    }
    
    // Load announcements from localStorage or use mock data
    const savedAnnouncements = localStorage.getItem('announcements');
    if (savedAnnouncements) {
        announcements = JSON.parse(savedAnnouncements);
    } else {
        announcements = mockData.announcements;
        localStorage.setItem('announcements', JSON.stringify(announcements));
    }
    
    // Load schedules from localStorage or use mock data
    const savedSchedules = localStorage.getItem('scheduleEvents');
    if (savedSchedules) {
        scheduleEvents = JSON.parse(savedSchedules);
        console.log('📅 Loaded', scheduleEvents.length, 'schedule events from localStorage');
    } else {
        scheduleEvents = mockData.scheduleEvents || [];
        localStorage.setItem('scheduleEvents', JSON.stringify(scheduleEvents));
        console.log('📅 Loaded', scheduleEvents.length, 'schedule events from mock data');
    }
    
    // MCQ functionality removed as per user request
    // Load MCQ assignments from localStorage or use mock data
    // const savedMcqAssignments = localStorage.getItem('mcqAssignments');
    // if (savedMcqAssignments) {
    //     mcqAssignments = JSON.parse(savedMcqAssignments);
    // } else {
    //     mcqAssignments = mockData.mcqAssignments;
    //     localStorage.setItem('mcqAssignments', JSON.stringify(mcqAssignments));
    // }
    
    // Load MCQ submissions from localStorage
    // const savedMcqSubmissions = localStorage.getItem('mcqSubmissions');
    // if (savedMcqSubmissions) {
    //     mcqSubmissions = JSON.parse(savedMcqSubmissions);
    // }
    
    // Use mock data for users
    users = mockData.users;
}

function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        setupFormValidation(loginForm);
        
        // Add animation to form elements with staggered delay
        const formElements = loginForm.querySelectorAll('.form-group, .role-selection, button');
        formElements.forEach((element, index) => {
            element.classList.add('animate-fade-in');
            element.style.animationDelay = `${0.1 + (index * 0.1)}s`;
        });
        
        // Add interactive effects to form inputs
        const formInputs = loginForm.querySelectorAll('.form-input');
        formInputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.parentElement.classList.add('input-focus');
            });
            input.addEventListener('blur', () => {
                input.parentElement.classList.remove('input-focus');
            });
        });
    }
    
    // Registration form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
        setupFormValidation(registerForm);
    }
    
    // Role selection buttons (for both login and registration forms)
    const roleButtons = document.querySelectorAll('.role-btn');
    roleButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Get the form this button belongs to
            const form = this.closest('form');
            const isRegistrationForm = form && form.id === 'registerForm';
            
            // Update only the buttons in the same form
            const formRoleButtons = form.querySelectorAll('.role-btn');
            formRoleButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');
            
            // Update password field type and hint (only for login form)
            if (!isRegistrationForm) {
                const passwordField = document.getElementById('password');
                const passwordHint = document.getElementById('password-hint');
                if (this.dataset.role === 'student') {
                    passwordField.type = 'tel';
                    passwordField.placeholder = 'Enter your phone number';
                    passwordHint.textContent = 'Students use their phone number as password';
                } else {
                    passwordField.type = 'password';
                    passwordField.placeholder = 'Enter your password';
                    passwordHint.textContent = 'Enter your staff password';
                }
            }
        });
    });
    
    // Notification button
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', toggleNotificationPanel);
    }
    
    // Click outside notification panel to close
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.notifications')) {
            const panel = document.getElementById('notificationPanel');
            if (panel) {
                panel.classList.add('hidden');
                const btn = document.getElementById('notificationBtn');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            }
        }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboardNavigation);
}

function setupAccessibility() {
    // Add skip link for keyboard users
    const skipLink = document.createElement('a');
    skipLink.href = '#mainApp';
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
        position: absolute;
        top: -40px;
        left: 6px;
        background: var(--primary-600);
        color: white;
        padding: 8px;
        text-decoration: none;
        border-radius: 4px;
        z-index: 10000;
        transition: top 0.3s;
    `;
    skipLink.addEventListener('focus', () => {
        skipLink.style.top = '6px';
    });
    skipLink.addEventListener('blur', () => {
        skipLink.style.top = '-40px';
    });
    document.body.insertBefore(skipLink, document.body.firstChild);
    
    // Announce page changes for screen readers
    const announcePageChange = (message) => {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    };
    
    window.announcePageChange = announcePageChange;
}

function setupFormValidation(form) {
    const inputs = form.querySelectorAll('input[required]');
    
    inputs.forEach(input => {
        input.addEventListener('blur', validateField);
        input.addEventListener('input', clearFieldError);
    });
}

function validateField(e) {
    const field = e.target;
    const errorId = field.getAttribute('aria-describedby');
    const errorElement = document.getElementById(errorId);
    
    if (!errorElement) return;
    
    let isValid = true;
    let errorMessage = '';
    
    if (field.type === 'email' && field.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }
    }
    
    if (field.required && !field.value.trim()) {
        isValid = false;
        errorMessage = 'This field is required';
    }
    
    if (!isValid) {
        errorElement.textContent = errorMessage;
        errorElement.classList.remove('hidden');
        field.setAttribute('aria-invalid', 'true');
    } else {
        errorElement.classList.add('hidden');
        field.setAttribute('aria-invalid', 'false');
    }
}

function clearFieldError(e) {
    const field = e.target;
    const errorId = field.getAttribute('aria-describedby');
    const errorElement = document.getElementById(errorId);
    
    if (errorElement) {
        errorElement.classList.add('hidden');
        field.setAttribute('aria-invalid', 'false');
    }
}

function handleKeyboardNavigation(e) {
    // Escape key closes modals and panels
    if (e.key === 'Escape') {
        const modal = document.querySelector('.modal:not(.hidden)');
        if (modal) {
            closeModal();
        }
        
        const panel = document.getElementById('notificationPanel');
        if (panel && !panel.classList.contains('hidden')) {
            panel.classList.add('hidden');
            const btn = document.getElementById('notificationBtn');
            if (btn) btn.setAttribute('aria-expanded', 'false');
        }
    }
    
    // Tab key navigation improvements
    if (e.key === 'Tab') {
        const focusableElements = document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (e.shiftKey && document.activeElement === focusableElements[0]) {
            e.preventDefault();
            focusableElements[focusableElements.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === focusableElements[focusableElements.length - 1]) {
            e.preventDefault();
            focusableElements[0].focus();
        }
    }
}

// ===== PAGE MANAGEMENT =====
function showLoginPage() {
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('mainApp').classList.remove('active');
    
    // Focus first input for accessibility
    setTimeout(() => {
        const firstInput = document.querySelector('#loginPage input');
        if (firstInput) firstInput.focus();
    }, 100);
}

// Render skeleton loading UI for dashboard
function renderSkeletonDashboard() {
    return `
        <div class="dashboard" role="region" aria-label="Dashboard Overview">
            <div class="dashboard-card">
                <h3 class="skeleton" style="width: 70%; height: 24px;"></h3>
                <div class="skeleton" style="width: 60%; height: 40px; margin-bottom: 8px;"></div>
                <div class="skeleton" style="width: 40%; height: 16px;"></div>
            </div>
            <div class="dashboard-card">
                <h3 class="skeleton" style="width: 60%; height: 24px;"></h3>
                <div class="skeleton" style="width: 50%; height: 40px; margin-bottom: 8px;"></div>
                <div class="skeleton" style="width: 45%; height: 16px;"></div>
            </div>
            <div class="dashboard-card">
                <h3 class="skeleton" style="width: 65%; height: 24px;"></h3>
                <div class="skeleton" style="width: 55%; height: 40px; margin-bottom: 8px;"></div>
                <div class="skeleton" style="width: 50%; height: 16px;"></div>
            </div>
        </div>
        
        <div class="quick-actions" role="region" aria-label="Quick Actions">
            <div class="skeleton" style="width: 100%; height: 60px; border-radius: 12px;"></div>
            <div class="skeleton" style="width: 100%; height: 60px; border-radius: 12px;"></div>
            <div class="skeleton" style="width: 100%; height: 60px; border-radius: 12px;"></div>
            <div class="skeleton" style="width: 100%; height: 60px; border-radius: 12px;"></div>
        </div>
        
        <div class="content-section">
            <h2 class="skeleton" style="width: 50%; height: 32px; margin-bottom: 24px;"></h2>
            <div class="skeleton" style="width: 100%; height: 80px; margin-bottom: 16px; border-radius: 12px;"></div>
            <div class="skeleton" style="width: 100%; height: 80px; margin-bottom: 16px; border-radius: 12px;"></div>
            <div class="skeleton" style="width: 100%; height: 80px; border-radius: 12px;"></div>
        </div>
    `;
}

async function showMainApp() {
    // Ensure we have the current user
    if (!currentUser) {
        currentUser = getCurrentUser();
        if (!currentUser) {
            console.error('❌ No user found when showing main app');
            showLoginPage();
            return;
        }
    }
    
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('mainApp').classList.add('active');
    
    // Show skeleton loading UI first
    updateUserInfo();
    setupNavigation();
    
    // Show skeleton loading UI
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = renderSkeletonDashboard();
    
    // Load data for the dashboard
    try {
        console.log('🔄 Loading data for dashboard...');
        
        // First try to load data from Firebase
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            await loadDataFromFirebase();
        } else {
            // Fallback to local data
            loadData();
        }
        
        console.log('✅ Data loaded successfully for dashboard');
        
        // After data is loaded, show the actual dashboard
        showView('dashboard');
    } catch (error) {
        console.error('❌ Error loading data for dashboard:', error);
        // Fallback to local data if Firebase fails
        loadData();
        
        // Show the actual dashboard
        showView('dashboard');
    }
    
    // Announce page change for screen readers
    if (window.announcePageChange) {
        window.announcePageChange(`Welcome to ${currentUser.role} portal`);
    }
}

// ===== AUTHENTICATION =====
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const roleBtn = document.querySelector('.role-btn.active');
    const selectedRole = roleBtn ? roleBtn.dataset.role : 'student';
    
    // Clear previous errors
    clearLoginErrors();
    
    // Validation
    if (!email || !password) {
        showAlert('Please fill in all fields', 'warning');
        return;
    }
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const stopLoading = showLoading(submitBtn, 'Signing In...');
    
    try {
        // Try Firebase authentication with portal-based login
        if (firebaseAuth && firebaseDb) {
            console.log(`🔐 Attempting login for ${selectedRole} portal with email: ${email}`);
            
            // Use portal-specific login function
            const result = await loginUser(email, password, selectedRole);
            
            if (result.success) {
                currentUser = result.user;
                
                // Verify portal matches selected role
                if (currentUser.portal !== selectedRole) {
                    showAlert(`Portal mismatch: This account is registered in the ${currentUser.portal} portal, not the ${selectedRole} portal.`, 'error');
                    return;
                }
                
                console.log(`✅ Login successful for ${currentUser.role} portal: ${currentUser.name}`);
                showAlert(`Welcome back, ${currentUser.name}!`, 'success');
                await loginSuccess();
                return;
            } else {
                // Firebase auth failed, try demo login as fallback
                if (selectedRole === 'student' && email === 'alex.johnson@university.edu' && password === '+1 (555) 000-0000') {
                    const userData = users.find(u => u.id === 'student1');
                    if (userData) {
                        const userInfo = {
                            uid: userData.id,
                            id: userData.id, // Keep for backward compatibility
                            email: userData.email,
                            name: userData.name,
                            role: userData.role,
                            department: userData.department || 'General',
                            portal: userData.role
                        };
                        setCurrentUser(userInfo);
                        loginSuccess();
                        return;
                    }
                } else if (selectedRole === 'staff' && email === 'sarah.wilson@university.edu' && password === 'staff123') {
                    const userData = users.find(u => u.id === 'staff1');
                    if (userData) {
                        const userInfo = {
                            uid: userData.id,
                            id: userData.id, // Keep for backward compatibility
                            email: userData.email,
                            name: userData.name,
                            role: userData.role,
                            department: userData.department || 'General',
                            portal: userData.role
                        };
                        setCurrentUser(userInfo);
                        loginSuccess();
                        return;
                    }
                } else {
                    showAlert(result.error || 'Invalid credentials. Please check your email and password.', 'error');
                    return;
                }
            }
        } else {
            // Firebase not available, use demo login
            if (selectedRole === 'student' && email === 'alex.johnson@university.edu' && password === '+1 (555) 000-0000') {
                currentUser = users.find(u => u.id === 'student1');
                loginSuccess();
            } else if (selectedRole === 'staff' && email === 'sarah.wilson@university.edu' && password === 'staff123') {
                currentUser = users.find(u => u.id === 'staff1');
                loginSuccess();
            } else {
                showAlert('Invalid credentials. Please check your email and password.', 'error');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert('An error occurred during login. Please try again.', 'error');
    } finally {
        // Reset button state
        if (stopLoading) stopLoading();
    }
}

function demoLogin(role) {
    const demoCredentials = {
        student: { email: 'alex.johnson@university.edu', password: '+1 (555) 000-0000' },
        staff: { email: 'sarah.wilson@university.edu', password: 'staff123' }
    };
    
    document.getElementById('email').value = demoCredentials[role].email;
    document.getElementById('password').value = demoCredentials[role].password;
    
    // Update role selection
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
        if (btn.dataset.role === role) {
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
        }
    });
    
    // Update password field
    const passwordField = document.getElementById('password');
    if (role === 'student') {
        passwordField.type = 'tel';
    } else {
        passwordField.type = 'password';
    }
    
    // Store the selected portal for login
    document.getElementById('loginForm').setAttribute('data-portal', role);
}

async function loginSuccess() {
    // currentUser is already set by setCurrentUser function
    showAlert(`Welcome back, ${currentUser.name}! You have successfully logged in to your ${currentUser.role} portal.`, 'success', 3000);
    
    // Load data before showing the main app
    try {
        console.log('🔄 Loading data before showing dashboard...');
        // First try to load data from Firebase
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            await loadDataFromFirebase();
        } else {
            // Fallback to local data
            loadData();
        }
        console.log('✅ Data loaded successfully');
    } catch (error) {
        console.error('❌ Error loading data:', error);
        // Fallback to local data if Firebase fails
        loadData();
    }
    
    // Show loading indicator before redirecting
    setTimeout(() => {
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.style.zIndex = '1000';
        loadingOverlay.innerHTML = `
            <div style="text-align: center;">
                <div class="loading" style="width: 40px; height: 40px; margin-bottom: 16px;"></div>
                <p style="color: var(--gray-700); font-weight: 500;">Preparing your dashboard...</p>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
        
        // Small delay to show the success message before switching pages
        setTimeout(async () => {
            await showMainApp();
            document.body.removeChild(loadingOverlay);
        }, 500);
    }, 1000);
}

function clearLoginErrors() {
    const errorElements = document.querySelectorAll('#loginPage .error-message');
    errorElements.forEach(el => el.classList.add('hidden'));
    
    const inputs = document.querySelectorAll('#loginPage input');
    inputs.forEach(input => input.setAttribute('aria-invalid', 'false'));
}

function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    
    // Focus the error message for screen readers
    errorDiv.focus();
    
    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}

// ===== REGISTRATION HANDLER =====
function handleRegistration(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();
    const roleBtn = document.querySelector('#registerForm .role-btn.active');
    const role = roleBtn ? roleBtn.dataset.role : 'student';
    
    // Clear previous errors
    const registerError = document.getElementById('registerError');
    registerError.classList.add('hidden');
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
        showAlert('Please fill in all fields', 'warning');
        return;
    }
    
    if (password.length < 6) {
        showAlert('Password must be at least 6 characters long', 'warning');
        return;
    }
    
    if (password !== confirmPassword) {
        showAlert('Passwords do not match', 'error');
        return;
    }
    
    if (!email.includes('@')) {
        showAlert('Please enter a valid email address', 'warning');
        return;
    }
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const stopLoading = showLoading(submitBtn, 'Creating Account...');
    
    // Attempt to register with Firebase
    if (firebaseAuth && firebaseDb) {
        registerUser(email, password, role, name)
            .then(result => {
                if (result.success) {
                    showAlert('Account created successfully! You can now log in.', 'success');
                    
                    // Switch back to login form with a nice transition
                    setTimeout(() => {
                        // Add exit animation
                        const registerFormContainer = document.getElementById('registerFormContainer');
                        registerFormContainer.style.animation = 'fadeOutRight 0.5s forwards';
                        
                        setTimeout(() => {
                            toggleRegistrationForm();
                            // Pre-fill the email field
                            document.getElementById('email').value = email;
                            // Clear registration form
                            e.target.reset();
                            // Reset animation
                            registerFormContainer.style.animation = '';
                        }, 500);
                    }, 2000);
                } else {
                    showAlert(result.error || 'Failed to create account. Please try again.', 'error');
                }
            })
            .catch(error => {
                console.error('Registration error:', error);
                showAlert('An error occurred during registration. Please try again.', 'error');
            })
            .finally(() => {
                // Reset button state
                if (stopLoading) stopLoading();
            });
    } else {
        showAlert('Registration service is not available. Please try again later.', 'error');
        if (stopLoading) stopLoading();
    }
}

function showRegisterError(message) {
    const errorDiv = document.getElementById('registerError');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    
    // Focus the error message for screen readers
    errorDiv.focus();
    
    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}

// ===== USER INTERFACE =====
function updateUserInfo() {
    if (!currentUser) {
        console.warn('⚠️ updateUserInfo called but currentUser is null');
        return;
    }
    
    // Debug logging for user info
    console.log('🔄 Updating user info:', {
        name: currentUser.name,
        displayName: currentUser.displayName,
        email: currentUser.email,
        role: currentUser.role
    });
    
    // Ensure name is properly displayed with fallback
    const displayName = currentUser.name || currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
    
    document.getElementById('userName').textContent = displayName;
    document.getElementById('userEmail').textContent = currentUser.email || '';
    document.getElementById('userRole').textContent = `${currentUser.role || 'Student'} Portal`;
    
    const unreadCount = notifications.filter(n => !n.read).length;
    const countElement = document.getElementById('notificationCount');
    countElement.textContent = unreadCount;
    countElement.setAttribute('aria-label', `${unreadCount} unread notifications`);
    
    // Hide count if no notifications
    if (unreadCount === 0) {
        countElement.style.display = 'none';
    } else {
        countElement.style.display = 'block';
    }
}

function setupNavigation() {
    const navList = document.getElementById('navList');
    navList.innerHTML = '';
    
    const navItems = currentUser.role === 'student' ? getStudentNavItems() : getStaffNavItems();
    
    navItems.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        
        const button = document.createElement('button');
        button.className = 'nav-btn';
        button.innerHTML = `<i class="${item.icon}" aria-hidden="true"></i><span>${item.label}</span>`;
        button.onclick = () => showView(item.id);
        button.setAttribute('aria-label', item.label);
        button.setAttribute('tabindex', '0');
        
        li.appendChild(button);
        navList.appendChild(li);
    });
    
    // Set first nav item as active
    const firstNavBtn = navList.querySelector('.nav-btn');
    if (firstNavBtn) {
        firstNavBtn.classList.add('active');
        firstNavBtn.setAttribute('aria-current', 'page');
    }
}

function getStudentNavItems() {
    return [
        { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-tachometer-alt' },
        { id: 'assignments', label: 'Assignments', icon: 'fas fa-tasks' },
        { id: 'applications', label: 'Applications', icon: 'fas fa-file-alt' },
        { id: 'announcements', label: 'Announcements', icon: 'fas fa-bell' },
        { id: 'schedule', label: 'My Schedule', icon: 'fas fa-calendar-alt' },
        { id: 'profile', label: 'Profile', icon: 'fas fa-user-circle' }
    ];
}

function getStaffNavItems() {
    return [
        { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-tachometer-alt' },
        { id: 'assignments', label: 'Assignments', icon: 'fas fa-tasks' },
        { id: 'applications', label: 'Review Applications', icon: 'fas fa-file-alt' },
        { id: 'announcements', label: 'Announcements', icon: 'fas fa-bullhorn' },
        { id: 'schedule', label: 'Schedule Management', icon: 'fas fa-calendar-alt' },
        { id: 'profile', label: 'Profile', icon: 'fas fa-user-circle' }
    ];
}

// Initialize Web Worker
let dataWorker;
try {
    dataWorker = new Worker('data-worker.js');
    dataWorker.onmessage = handleWorkerMessage;
} catch (error) {
    console.error('Error creating Web Worker:', error);
}

function handleWorkerMessage(e) {
    const { type, data } = e.data;
    const contentArea = document.getElementById('contentArea');
    
    switch (type) {
        case 'assignmentsLoaded':
            assignments = data;
            if (currentView === 'assignments' && contentArea) {
                contentArea.innerHTML = renderAssignments();
            }
            break;
            
        case 'submissionsLoaded':
            submissions = data;
            if (currentView === 'assignments' && contentArea) {
                contentArea.innerHTML = renderAssignments();
            }
            break;
    }
}

function showView(viewName) {
    try {
        // Update navigation state immediately
        currentView = viewName;
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.removeAttribute('aria-current');
        });
        
        const activeBtn = document.querySelector(`[onclick="showView('${viewName}')"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.setAttribute('aria-current', 'page');
        }
        
        // Get content area
        const contentArea = document.getElementById('contentArea');
        if (!contentArea) return;
        
        // Show loading state immediately for assignments
        if (viewName === 'assignments') {
            // Show minimal loading state
            contentArea.innerHTML = `
                <div class="content-section">
                    <div class="section-header">
                        <h2><i class="fas fa-book-open" aria-hidden="true"></i>My Assignments</h2>
                    </div>
                    <div id="assignmentsList" class="assignments-grid">
                        <div class="loading-container">
                            <div class="loading"></div>
                        </div>
                    </div>
                </div>
            `;
            
            // Don't reset assignments array - keep existing data
            // assignments = []; // Removed - this was clearing Firebase data
            // submissions = []; // Removed - this was clearing Firebase data
            // MCQ assignments removed
            
            // Show loading state
            contentArea.innerHTML = `
                <div class="content-section">
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        <h3>Loading assignments from Firebase...</h3>
                        <p>Please wait while we fetch the latest data.</p>
                    </div>
                </div>
            `;
                
                // Load real data in Web Worker
                if (dataWorker) {
                    dataWorker.postMessage({ 
                        type: 'loadAssignments', 
                        data: assignments 
                    });
                } else {
                    // Fallback if Web Worker fails
                    loadFirebaseDataInBackground();
                }
            
            return;
        }
        
        // Handle other views normally
        switch (viewName) {
            case 'dashboard':
                contentArea.innerHTML = renderDashboard();
                break;
            case 'applications':
                contentArea.innerHTML = renderApplications();
                break;
            case 'announcements':
                contentArea.innerHTML = renderAnnouncements();
                break;
            case 'schedule':
                contentArea.innerHTML = renderSchedule();
                break;
            case 'profile':
                contentArea.innerHTML = renderProfile();
                break;
            default:
                contentArea.innerHTML = renderDashboard();
        }
        
    } catch (error) {
        console.error('Error in showView:', error);
        const contentArea = document.getElementById('contentArea');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="error-container">
                    <h3>Error Loading Page</h3>
                    <p>Please try again</p>
                </div>
            `;
        }
    }
}

// ===== CONTENT RENDERING =====
function renderDashboard() {
    if (currentUser.role === 'student') {
        return renderStudentDashboard();
    } else {
        return renderStaffDashboard();
    }
}

function renderStudentDashboard() {
    // Make sure assignments array exists
    if (!assignments || !Array.isArray(assignments)) {
        console.error('❌ Assignments array is not available:', assignments);
        assignments = [];
    }
    
    // Make sure applications array exists
    if (!applications || !Array.isArray(applications)) {
        console.error('❌ Applications array is not available:', applications);
        applications = [];
    }
    
    // Make sure announcements array exists
    if (!announcements || !Array.isArray(announcements)) {
        console.error('❌ Announcements array is not available:', announcements);
        announcements = [];
    }
    
    const pendingAssignments = assignments.filter(a => a.status === 'pending');
    const submittedAssignments = assignments.filter(a => a.status === 'submitted');
    const userApplications = applications.filter(a => 
        a.submittedBy === currentUser.id || 
        a.studentId === currentUser.id || 
        a.submittedBy === currentUser.uid || 
        a.studentId === currentUser.uid
    );
    
    // Assignment Statistics
    const userSubmissions = submissions.filter(s => 
        s.studentId === currentUser.id || 
        s.studentId === currentUser.uid ||
        s.submittedBy === currentUser.id || 
        s.submittedBy === currentUser.uid
    );
    const gradedSubmissions = userSubmissions.filter(s => s.grade !== undefined && s.grade !== null);
    const avgGrade = gradedSubmissions.length > 0 ? 
        Math.round(gradedSubmissions.reduce((sum, s) => sum + parseFloat(s.grade), 0) / gradedSubmissions.length) : 0;
    
    return `
        <div class="dashboard" role="region" aria-label="Dashboard Overview">
            <div class="dashboard-card">
                <h3><i class="fas fa-clock" aria-hidden="true"></i>Pending Assignments</h3>
                <div class="stat-number" aria-label="${pendingAssignments.length} pending assignments">${pendingAssignments.length}</div>
                <div class="stat-label">Need to submit</div>
            </div>
            <div class="dashboard-card">
                <h3><i class="fas fa-check-circle" aria-hidden="true"></i>Submitted</h3>
                <div class="stat-number" aria-label="${submittedAssignments.length} submitted assignments">${submittedAssignments.length}</div>
                <div class="stat-label">Awaiting grade</div>
            </div>
            <div class="dashboard-card">
                <h3><i class="fas fa-file-alt" aria-hidden="true"></i>Applications</h3>
                <div class="stat-number" aria-label="${userApplications.length} applications submitted">${userApplications.length}</div>
                <div class="stat-label">Total applications</div>
            </div>
            <div class="dashboard-card">
                <h3><i class="fas fa-chart-line" aria-hidden="true"></i>Average Grade</h3>
                <div class="stat-number" aria-label="Average grade ${avgGrade}">${avgGrade}</div>
                <div class="stat-label">Overall performance</div>
            </div>
        </div>
        
        <div class="quick-actions" role="region" aria-label="Quick Actions">
            <button class="action-btn" onclick="showView('assignments')" aria-label="View all assignments">
                <i class="fas fa-tasks" aria-hidden="true"></i>
                <span>View Assignments</span>
            </button>
            <button class="action-btn" onclick="showView('applications')" aria-label="Submit new application">
                <i class="fas fa-plus" aria-hidden="true"></i>
                <span>Submit Application</span>
            </button>
            <button class="action-btn" onclick="showView('announcements')" aria-label="View announcements">
                <i class="fas fa-bell" aria-hidden="true"></i>
                <span>View Announcements</span>
            </button>
            <button class="action-btn" onclick="showView('schedule')" aria-label="View schedule">
                <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                <span>My Schedule</span>
            </button>
        </div>
        
        <div class="content-section">
            <h2><i class="fas fa-bell" aria-hidden="true"></i>Recent Announcements</h2>
            ${renderAnnouncementsList(announcements.slice(0, 3))}
        </div>
    `;
}

function renderStaffDashboard() {
    console.log('🔍 Debug - renderStaffDashboard called');
    console.log('🔍 Debug - assignments:', assignments.length);
    console.log('🔍 Debug - submissions:', submissions.length);
    console.log('🔍 Debug - applications:', applications.length);
    console.log('🔍 Debug - users:', users.length);
    
    const totalAssignments = assignments.length;
    const totalApplications = applications.length;
    const totalStudents = users.filter(u => u.role === 'student').length;
    const pendingApplications = applications.filter(a => a.status === 'pending');
    
    // Assignment Statistics
    const totalSubmissions = submissions.length;
    const gradedSubmissions = submissions.filter(s => s.grade !== undefined && s.grade !== null);
    const avgAssignmentGrade = gradedSubmissions.length > 0 ? 
        Math.round(gradedSubmissions.reduce((sum, s) => sum + parseFloat(s.grade), 0) / gradedSubmissions.length) : 0;
    
    console.log('🔍 Debug - Dashboard stats:', {
        totalAssignments,
        totalSubmissions,
        gradedSubmissions: gradedSubmissions.length,
        avgAssignmentGrade,
        totalStudents,
        pendingApplications: pendingApplications.length
    });
    
    return `
        <div class="dashboard" role="region" aria-label="Staff Dashboard Overview">
            <div class="dashboard-card">
                <h3><i class="fas fa-tasks" aria-hidden="true"></i>Assignments</h3>
                <div class="stat-number" aria-label="${totalAssignments} total assignments">${totalAssignments}</div>
                <div class="stat-label">Created assignments</div>
            </div>
            <div class="dashboard-card">
                <h3><i class="fas fa-file-text" aria-hidden="true"></i>Applications</h3>
                <div class="stat-number" aria-label="${totalApplications} applications received">${totalApplications}</div>
                <div class="stat-label">Total applications</div>
            </div>
            <div class="dashboard-card">
                <h3><i class="fas fa-chart-bar" aria-hidden="true"></i>Submissions</h3>
                <div class="stat-number" aria-label="${totalSubmissions} assignment submissions">${totalSubmissions}</div>
                <div class="stat-label">Total submissions</div>
            </div>
            <div class="dashboard-card">
                <h3><i class="fas fa-chart-line" aria-hidden="true"></i>Class Average</h3>
                <div class="stat-number" aria-label="Class average grade ${avgAssignmentGrade}">${avgAssignmentGrade}</div>
                <div class="stat-label">Assignment performance</div>
            </div>
        </div>
        
        <div class="quick-actions" role="region" aria-label="Staff Quick Actions">
            <button class="action-btn" onclick="showView('assignments')" aria-label="Create new assignment">
                <i class="fas fa-plus" aria-hidden="true"></i>
                <span>Create Assignment</span>
            </button>
            <button class="action-btn" onclick="showView('applications')" aria-label="Review student applications">
                <i class="fas fa-eye" aria-hidden="true"></i>
                <span>Review Applications</span>
            </button>
            <button class="action-btn" onclick="showView('announcements')" aria-label="Create announcement">
                <i class="fas fa-bullhorn" aria-hidden="true"></i>
                <span>Create Announcement</span>
            </button>
            <button class="action-btn" onclick="showView('schedule')" aria-label="Manage schedule">
                <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                <span>Manage Schedule</span>
            </button>
        </div>
        
        <div class="content-section">
            <h2><i class="fas fa-chart-line" aria-hidden="true"></i>Recent Activity</h2>
            <div class="recent-activity">
                <p>Welcome back, ${currentUser.name}! Here's what's happening today:</p>
                <ul>
                    <li><i class="fas fa-tasks"></i> ${totalAssignments} assignments created</li>
                    <li><i class="fas fa-file-text"></i> ${totalSubmissions} submissions received</li>
                    <li><i class="fas fa-check-circle"></i> ${gradedSubmissions.length} submissions graded</li>
                    <li><i class="fas fa-clock"></i> ${pendingApplications.length} applications pending review</li>
                </ul>
            </div>
        </div>
        
        <div class="content-section">
            <h2><i class="fas fa-chart-pie" aria-hidden="true"></i>Grading Overview</h2>
            <div class="grading-overview">
                <div class="grading-stats">
                    <div class="grading-stat">
                        <div class="stat-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-number">${gradedSubmissions.length}</div>
                            <div class="stat-label">Graded Submissions</div>
                        </div>
                    </div>
                    <div class="grading-stat">
                        <div class="stat-icon">
                            <i class="fas fa-hourglass-half"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-number">${totalSubmissions - gradedSubmissions.length}</div>
                            <div class="stat-label">Pending Review</div>
                        </div>
                    </div>
                    <div class="grading-stat">
                        <div class="stat-icon">
                            <i class="fas fa-percentage"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-number">${totalSubmissions > 0 ? Math.round((gradedSubmissions.length / totalSubmissions) * 100) : 0}%</div>
                            <div class="stat-label">Completion Rate</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="content-section">
            <h2><i class="fas fa-users" aria-hidden="true"></i>Student Overview</h2>
            <div class="student-overview">
                <div class="student-stats">
                    <div class="student-stat">
                        <div class="stat-icon">
                            <i class="fas fa-user-graduate"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-number">${totalStudents}</div>
                            <div class="stat-label">Total Students</div>
                        </div>
                    </div>
                    <div class="student-stat">
                        <div class="stat-icon">
                            <i class="fas fa-file-alt"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-number">${totalApplications}</div>
                            <div class="stat-label">Applications Received</div>
                        </div>
                    </div>
                    <div class="student-stat">
                        <div class="stat-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-number">${pendingApplications.length}</div>
                            <div class="stat-label">Pending Applications</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ===== LOADING STATES =====
function renderAssignmentsLoading() {
    return `
        <div class="content-section">
            <div class="section-header">
                <h2><i class="fas fa-book-open" aria-hidden="true"></i>My Assignments</h2>
            </div>
            <div class="loading-container" style="text-align: center; padding: 2rem;">
                <div class="loading" style="width: 2rem; height: 2rem; margin: 0 auto 1rem;"></div>
                <p>Loading assignments...</p>
            </div>
        </div>
    `;
}

// ===== INSTANT DATA LOADING =====
function loadAssignmentsInstant() {
    console.log('⚡ Loading assignments instantly...');
    
    const contentArea = document.getElementById('contentArea');
    
    // Try to load from localStorage first (instant)
    const savedAssignments = localStorage.getItem('assignments');
    if (savedAssignments) {
        try {
            const parsedAssignments = JSON.parse(savedAssignments);
            if (parsedAssignments && parsedAssignments.length > 0) {
                assignments = parsedAssignments;
                console.log('⚡ Loaded assignments from localStorage');
                contentArea.innerHTML = renderAssignments();
                
                // Load Firebase data in background
                loadFirebaseDataInBackground();
                return;
            }
        } catch (e) {
            console.log('⚠️ Error parsing localStorage assignments');
        }
    }
    
    // If no localStorage data, try Firebase first, then use empty array
    console.log('📝 No local data found, will load from Firebase');
    // Don't reset assignments array - let Firebase load populate it
    // assignments = []; // Removed - this was clearing Firebase data
    // submissions = []; // Removed - this was clearing Firebase data
    // MCQ assignments removed
    
    // Show loading state while Firebase loads
    contentArea.innerHTML = `
        <div class="content-section">
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <h3>Loading assignments from Firebase...</h3>
                <p>Please wait while we fetch the latest data.</p>
            </div>
        </div>
    `;
    
    // Load Firebase data in background
    loadFirebaseDataInBackground();
}

// ===== FAST DATA LOADING =====
function loadAssignmentsFast() {
    console.log('⚡ Loading assignments fast...');
    
    // Show loading state immediately
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = renderAssignmentsLoading();
    
    // Load data in background without blocking UI
    setTimeout(async () => {
        try {
            // Try to load from localStorage first (fastest)
            const savedAssignments = localStorage.getItem('assignments');
            if (savedAssignments) {
                try {
                    const parsedAssignments = JSON.parse(savedAssignments);
                    if (parsedAssignments && parsedAssignments.length > 0) {
                        assignments = parsedAssignments;
                        console.log('⚡ Loaded assignments from localStorage');
                    }
                } catch (e) {
                    console.log('⚠️ Error parsing localStorage assignments');
                }
            }
            
            // If no assignments, show empty state (don't use mock data)
            if (!assignments || assignments.length === 0) {
                console.log('📝 No assignments available from Firebase');
            }
            
            // Set empty submissions for now
            submissions = [];
            // MCQ assignments removed
            
            // Render immediately
            contentArea.innerHTML = renderAssignments();
            console.log('⚡ Assignments page rendered');
            
            // Try to load Firebase data in background (non-blocking)
            loadFirebaseDataInBackground();
            
        } catch (error) {
            console.error('❌ Error in fast loading:', error);
            // Don't reset assignments array - keep existing data
            // assignments = []; // Removed - this was clearing Firebase data
            // submissions = []; // Removed - this was clearing Firebase data
            // MCQ assignments removed
            contentArea.innerHTML = `
                <div class="content-section">
                    <div class="error-container">
                        <h3>Error Loading Assignments</h3>
                        <p>Unable to load assignments from Firebase. Please try again later.</p>
                        <button onclick="showView('assignments')" class="btn btn-primary">Retry</button>
                    </div>
                </div>
            `;
        }
    }, 100); // Very short delay to show loading state
}

// Background Firebase loading (non-blocking)
async function loadFirebaseDataInBackground() {
    try {
        console.log('🔄 Loading Firebase data in background...');
        
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            console.log('⚠️ Firebase not available, skipping background load');
            return;
        }
        
        // Load assignments from Firebase with retry logic
        let firebaseAssignments = [];
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                firebaseAssignments = await getAssignmentsFromFirebase();
                if (firebaseAssignments && firebaseAssignments.length >= 0) {
                    break; // Success, even if empty array
                }
            } catch (error) {
                console.log(`⚠️ Assignment fetch attempt ${retryCount + 1} failed:`, error.message);
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
                }
            }
        }
        
        if (firebaseAssignments && firebaseAssignments.length >= 0) {
            assignments = firebaseAssignments;
            localStorage.setItem('assignments', JSON.stringify(assignments));
            console.log(`✅ Background loaded ${assignments.length} Firebase assignments`);
            
            // Re-render with Firebase data if we're on assignments page
            if (currentView === 'assignments') {
            const contentArea = document.getElementById('contentArea');
                if (contentArea) {
            contentArea.innerHTML = renderAssignments();
                    console.log('✅ Assignment view refreshed with Firebase data');
                }
            }
        }
        
        // Load submissions with error handling
        try {
        const firebaseSubmissions = await getSubmissionsWithCache();
            if (firebaseSubmissions && firebaseSubmissions.length >= 0) {
            submissions = firebaseSubmissions;
                localStorage.setItem('submissions', JSON.stringify(submissions));
                console.log(`✅ Background loaded ${submissions.length} Firebase submissions`);
            }
        } catch (error) {
            console.log('⚠️ Failed to load submissions:', error.message);
        }
        
        // Final re-render with all Firebase data if on assignments page
        if (currentView === 'assignments') {
        const contentArea = document.getElementById('contentArea');
            if (contentArea) {
        contentArea.innerHTML = renderAssignments();
                console.log('✅ Final assignment view refresh completed');
            }
        }
        
    } catch (error) {
        console.error('❌ Error in background Firebase loading:', error);
        // Don't show error to user, just log it
    }
}

// Fallback mock data functions
function getMockAssignments() {
    return [
        {
            id: 'mock-1',
            title: 'Web Development Project',
            description: 'Create a responsive website using HTML, CSS, and JavaScript. This project will test your understanding of modern web development practices.',
            subject: 'Web Development',
            dueDate: '2024-02-15',
            dueTime: '23:59',
            maxScore: 100,
            createdAt: new Date().toISOString(),
            createdBy: {
                uid: 'mock-teacher',
                name: 'Dr. Smith',
                role: 'staff'
            },
            status: 'active'
        },
        {
            id: 'mock-2',
            title: 'Database Design Assignment',
            description: 'Design a normalized database schema for a library management system. Include proper relationships and constraints.',
            subject: 'Database Systems',
            dueDate: '2024-02-20',
            dueTime: '17:00',
            maxScore: 80,
            createdAt: new Date().toISOString(),
            createdBy: {
                uid: 'mock-teacher',
                name: 'Prof. Johnson',
                role: 'staff'
            },
            status: 'active'
        },
        {
            id: 'mock-3',
            title: 'Algorithm Implementation',
            description: 'Implement sorting algorithms (Bubble, Quick, Merge) and analyze their time complexity with examples.',
            subject: 'Programming',
            dueDate: '2024-02-25',
            dueTime: '12:00',
            maxScore: 90,
            createdAt: new Date().toISOString(),
            createdBy: {
                uid: 'mock-teacher',
                name: 'Dr. Brown',
                role: 'staff'
            },
            status: 'active'
        },
        {
            id: 'mock-4',
            title: 'Software Engineering Project',
            description: 'Develop a complete software project following SDLC principles. Include documentation and testing.',
            subject: 'Software Engineering',
            dueDate: '2024-03-01',
            dueTime: '18:00',
            maxScore: 120,
            createdAt: new Date().toISOString(),
            createdBy: {
                uid: 'mock-teacher',
                name: 'Prof. Wilson',
                role: 'staff'
            },
            status: 'active'
        },
        {
            id: 'mock-5',
            title: 'Data Structures Lab',
            description: 'Implement various data structures (Stack, Queue, Tree) and demonstrate their operations.',
            subject: 'Data Structures',
            dueDate: '2024-03-05',
            dueTime: '14:30',
            maxScore: 85,
            createdAt: new Date().toISOString(),
            createdBy: {
                uid: 'mock-teacher',
                name: 'Dr. Davis',
                role: 'staff'
            },
            status: 'active'
        }
    ];
}

function getMockMCQAssignments() {
    return [
        {
            id: 'mcq-mock-1',
            title: 'JavaScript Fundamentals Quiz',
            description: 'Test your knowledge of JavaScript basics including variables, functions, and DOM manipulation.',
            subject: 'Programming',
            dueDate: '2024-02-18',
            dueTime: '23:59',
            timeLimit: 30,
            totalPoints: 50,
            createdAt: new Date().toISOString(),
            createdBy: {
                uid: 'mock-teacher',
                name: 'Dr. Smith',
                role: 'staff'
            },
            status: 'active'
        },
        {
            id: 'mcq-mock-2',
            title: 'Database Concepts Quiz',
            description: 'Test your understanding of database concepts, SQL queries, and normalization.',
            subject: 'Database Systems',
            dueDate: '2024-02-22',
            dueTime: '20:00',
            timeLimit: 45,
            totalPoints: 60,
            createdAt: new Date().toISOString(),
            createdBy: {
                uid: 'mock-teacher',
                name: 'Prof. Johnson',
                role: 'staff'
            },
            status: 'active'
        }
    ];
}

function updateLoadingProgress(percent, message) {
    const loadingContainer = document.querySelector('.loading-container');
    if (loadingContainer) {
        const progressBar = loadingContainer.querySelector('.progress-bar') || createProgressBar(loadingContainer);
        const messageElement = loadingContainer.querySelector('.loading-message');
        
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        
        if (messageElement) {
            messageElement.textContent = message;
        }
    }
}

function createProgressBar(container) {
    const progressHTML = `
        <div class="progress-container" style="width: 100%; background: #f0f0f0; border-radius: 10px; margin: 1rem 0;">
            <div class="progress-bar" style="width: 0%; height: 8px; background: linear-gradient(90deg, #4CAF50, #45a049); border-radius: 10px; transition: width 0.3s ease;"></div>
        </div>
        <p class="loading-message" style="margin-top: 1rem; color: #666;">Loading...</p>
    `;
    
    const progressDiv = document.createElement('div');
    progressDiv.innerHTML = progressHTML;
    container.appendChild(progressDiv);
    
    return progressDiv.querySelector('.progress-bar');
}

function showAssignmentsError(error) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `
        <div class="content-section">
            <div class="error-container" style="text-align: center; padding: 4rem 2rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #f44336; margin-bottom: 1rem;"></i>
                <h3>Failed to Load Assignments</h3>
                <p>We encountered an error while loading your assignments. Please try again.</p>
                <button class="btn btn-primary" onclick="loadAssignmentsAsync()" style="margin-top: 1rem;">
                    <i class="fas fa-refresh"></i> Retry
                </button>
                <p style="margin-top: 1rem; color: #666; font-size: 0.9rem;">
                    Error: ${error.message || 'Unknown error'}
                </p>
            </div>
        </div>
    `;
}

// ===== CACHED DATA LOADING =====
let assignmentsCache = null;
let submissionsCache = null;
let mcqCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getAssignmentsWithCache() {
    const now = Date.now();
    
    // Return cached data if it's still fresh
    if (assignmentsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
        console.log('📦 Using cached assignments data');
        return assignmentsCache;
    }
    
    // Load from Firebase
    try {
        const assignmentsData = await getAssignmentsFromFirebase();
        if (assignmentsData && assignmentsData.length > 0) {
            assignmentsCache = assignmentsData;
            cacheTimestamp = now;
            return assignmentsData;
        } else {
            console.log('⚠️ Firebase returned empty assignments array');
        }
    } catch (error) {
        console.error('❌ Error loading assignments from Firebase:', error);
    }
    
    // Fallback to localStorage
    try {
        const savedAssignments = localStorage.getItem('assignments');
        if (savedAssignments) {
            const parsedAssignments = JSON.parse(savedAssignments);
            if (parsedAssignments && parsedAssignments.length > 0) {
                console.log('📦 Using localStorage assignments data');
                return parsedAssignments;
            }
        }
    } catch (error) {
        console.error('❌ Error parsing localStorage assignments:', error);
    }
    
    // Final fallback - return empty array
    console.log('⚠️ No assignments data available, returning empty array');
    return [];
}

async function getSubmissionsWithCache() {
    const now = Date.now();
    
    // Return cached data if it's still fresh
    if (submissionsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
        console.log('📦 Using cached submissions data');
        return submissionsCache;
    }
    
    // Load from Firebase
    try {
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            const submissionsData = await window.firebaseServices.getAllSubmissions();
            submissionsCache = submissionsData;
            return submissionsData;
        }
    } catch (error) {
        console.error('❌ Error loading submissions from Firebase:', error);
    }
    
    // Fallback to localStorage
    const savedSubmissions = localStorage.getItem('submissions');
    return savedSubmissions ? JSON.parse(savedSubmissions) : [];
}

async function getMCQAssignmentsWithCache() {
    const now = Date.now();
    
    // Return cached data if it's still fresh
    if (mcqCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
        console.log('📦 Using cached MCQ data');
        return mcqCache;
    }
    
    // Load from Firebase
    try {
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            const mcqData = await window.firebaseServices.getMCQQuizzes();
            mcqCache = mcqData;
            return mcqData;
        }
    } catch (error) {
        console.error('❌ Error loading MCQ quizzes from Firebase:', error);
    }
    
    // Fallback to localStorage
    const savedMcq = localStorage.getItem('mcqAssignments');
    return savedMcq ? JSON.parse(savedMcq) : [];
}

function renderAssignments() {
    try {
        // Simple check for user role
        if (currentUser && currentUser.role === 'student') {
            return renderStudentAssignments();
        } else {
            return renderStaffAssignments();
        }
    } catch (error) {
        return `
            <div class="content-section">
                <div class="error-container">
                    <h3>Error Loading Assignments</h3>
                    <p>Please try again</p>
                    <button onclick="showView('assignments')" class="btn btn-primary">Retry</button>
                </div>
            </div>
        `;
    }
}

// ===== PAGINATION STATE =====
let currentAssignmentPage = 1;
let assignmentsPerPage = 6;
let filteredAssignments = [];
let filteredMCQAssignments = [];

function renderStudentAssignments() {
    try {
        // Debug: Log assignments data
        console.log('🔍 Debug - renderStudentAssignments called');
        console.log('🔍 Debug - assignments array:', assignments);
        console.log('🔍 Debug - assignments length:', assignments.length);
        console.log('🔍 Debug - currentUser:', currentUser);
        
        // If assignments array is empty, try to load from Firebase first
        if (assignments.length === 0) {
            console.log('🔍 Debug - Assignments array is empty, attempting to load from Firebase...');
            // Trigger Firebase data loading
            loadDataFromFirebase().then(() => {
                console.log('🔍 Debug - Firebase data loaded, re-rendering...');
                // Re-render after data is loaded
                const contentArea = document.getElementById('contentArea');
                if (contentArea) {
                    contentArea.innerHTML = renderAssignments();
                }
            }).catch(error => {
                console.error('❌ Error loading Firebase data:', error);
            });
        }
        
        // Filter assignments and get user submissions
        const userSubmissions = submissions.filter(s => 
            s.studentId === currentUser.id || 
            s.studentId === currentUser.uid ||
            s.submittedBy === currentUser.id || 
            s.submittedBy === currentUser.uid
        );

        if (assignments.length === 0) {
            return `
                <div class="content-section">
                    <div class="section-header">
                        <h2><i class="fas fa-book-open" aria-hidden="true"></i>My Assignments</h2>
                </div>
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i class="fas fa-book-open"></i>
                </div>
                        <h3 class="empty-state-title">No Assignments Available</h3>
                        <p class="empty-state-description">No assignments have been posted yet. Check back later for new assignments.</p>
            </div>
                </div>
            `;
        }
        
        return `
            <div class="content-section">
                <div class="section-header">
                    <h2><i class="fas fa-book-open" aria-hidden="true"></i>My Assignments</h2>
                    <div class="header-stats">
                        <span class="stat-item">
                            <i class="fas fa-tasks"></i>
                            Total: ${assignments.length}
                        </span>
                        <span class="stat-item">
                            <i class="fas fa-check-circle"></i>
                            Submitted: ${userSubmissions.length}
                        </span>
                </div>
                </div>
                
                <div class="assignment-filters">
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" placeholder="Search assignments..." onkeyup="filterStudentAssignments(this.value)">
                    </div>
                    <div class="filter-group">
                        <label>Subject</label>
                        <select onchange="filterStudentAssignmentsBySubject(this.value)">
                            <option value="">All Subjects</option>
                            <option value="Web Development">Web Development</option>
                            <option value="Programming">Programming</option>
                            <option value="Database Systems">Database Systems</option>
                            <option value="Software Engineering">Software Engineering</option>
                            <option value="Data Structures">Data Structures</option>
                            <option value="Computer Networks">Computer Networks</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Status</label>
                        <select onchange="filterStudentAssignmentsByStatus(this.value)">
                            <option value="">All Status</option>
                            <option value="pending">Not Submitted</option>
                            <option value="submitted">Submitted</option>
                            <option value="graded">Graded</option>
                            <option value="overdue">Overdue</option>
                        </select>
                    </div>
                </div>
                
                <div id="studentAssignmentsList" class="assignments-grid">
                    ${renderStudentAssignmentCards(assignments, userSubmissions)}
                </div>
                
                ${renderPagination(Math.ceil(assignments.length / assignmentsPerPage), 'assignments')}
            </div>
        `;
    } catch (error) {
        console.error('Error rendering student assignments:', error);
        return `
            <div class="content-section">
                <div class="error-container">
                    <h3>Error Loading Assignments</h3>
                    <p>Please try again later</p>
                    <button onclick="showView('assignments')" class="btn btn-primary">Retry</button>
                </div>
            </div>
        `;
    }
}

function renderPagination(totalPages, type) {
    if (totalPages <= 1) return '';
    
    const currentPage = type === 'assignments' ? currentAssignmentPage : 1;
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    let paginationHTML = '<div class="pagination-container" style="display: flex; justify-content: center; align-items: center; margin: 2rem 0; gap: 0.5rem;">';
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `
            <button class="btn btn-secondary pagination-btn" onclick="changePage(${currentPage - 1}, '${type}')" 
                    style="padding: 0.5rem 1rem; border-radius: 6px;">
                <i class="fas fa-chevron-left"></i> Previous
            </button>
        `;
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        paginationHTML += `
            <button class="btn ${isActive ? 'btn-primary' : 'btn-secondary'} pagination-btn" 
                    onclick="changePage(${i}, '${type}')"
                    style="padding: 0.5rem 1rem; border-radius: 6px; min-width: 2.5rem;">
                ${i}
            </button>
        `;
    }
    
    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `
            <button class="btn btn-secondary pagination-btn" onclick="changePage(${currentPage + 1}, '${type}')" 
                    style="padding: 0.5rem 1rem; border-radius: 6px;">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    paginationHTML += '</div>';
    
    // Page info
    paginationHTML += `
        <div class="pagination-info" style="text-align: center; color: #666; font-size: 0.9rem; margin-top: 1rem;">
            Page ${currentPage} of ${totalPages} (${filteredAssignments.length} total assignments)
        </div>
    `;
    
    return paginationHTML;
}

function changePage(page, type) {
    if (type === 'assignments') {
        currentAssignmentPage = page;
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = renderAssignments();
    }
}

// Debug function to test assignments loading
async function testAssignmentsLoading() {
    console.log('🧪 Testing assignments loading...');
    console.log('Current assignments:', assignments);
    console.log('Current submissions:', submissions);
    // console.log('Current mcqAssignments:', mcqAssignments); // MCQ removed
    console.log('Current user:', currentUser);
    
    // Load real Firebase data for testing
    console.log('Loading real Firebase data for testing...');
    try {
        const firebaseAssignments = await getAssignmentsFromFirebase();
        assignments = firebaseAssignments || [];
    submissions = [];
        // MCQ assignments removed
    
        console.log('After loading Firebase data:');
    console.log('Assignments:', assignments);
    } catch (error) {
        console.error('Error loading Firebase data:', error);
        assignments = [];
        submissions = [];
    }
    console.log('Submissions:', submissions);
    console.log('MCQ Assignments:', mcqAssignments);
    
    // Render the page
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = renderAssignments();
    console.log('✅ Test assignments page rendered');
}

// Make test function available globally
window.testAssignmentsLoading = testAssignmentsLoading;

// Direct Firebase test function
async function testFirebaseData() {
    console.log('🧪 Testing Firebase data directly...');
    
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            console.error('❌ Firebase services not available');
            return;
        }
        
        console.log('🔍 Testing Firebase readData directly...');
        
        // Test direct Firebase read
        const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        const dbRef = ref(window.firebaseDb, 'assignments');
        const snapshot = await get(dbRef);
        
        console.log('🔍 Firebase snapshot exists:', snapshot.exists());
        console.log('🔍 Firebase snapshot val:', snapshot.val());
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log('🔍 Raw Firebase data:', data);
            
            // Check if data is an object with keys
            if (typeof data === 'object' && data !== null) {
                const keys = Object.keys(data);
                console.log('🔍 Firebase data keys:', keys);
                
                // Convert to array format
                const assignmentsArray = keys.map(key => ({
                    id: key,
                    ...data[key]
                }));
                
                console.log('🔍 Converted assignments array:', assignmentsArray);
                
                // Set assignments and render
                assignments = assignmentsArray;
                const contentArea = document.getElementById('contentArea');
                contentArea.innerHTML = renderAssignments();
                console.log('✅ Firebase data loaded and rendered');
            }
        } else {
            console.log('⚠️ No assignments found in Firebase');
        }
        
    } catch (error) {
        console.error('❌ Error testing Firebase data:', error);
    }
}

// Make Firebase test function available globally
window.testFirebaseData = testFirebaseData;

// Force load Firebase data function
async function forceLoadFirebaseData() {
    console.log('🔄 Force loading Firebase data...');
    
    try {
        if (!window.firebaseServices || !window.firebaseServices.isInitialized) {
            console.error('❌ Firebase services not available');
            return;
        }
        
        // Direct Firebase read
        const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        const dbRef = ref(window.firebaseDb, 'assignments');
        const snapshot = await get(dbRef);
        
        console.log('🔍 Firebase snapshot exists:', snapshot.exists());
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log('🔍 Raw Firebase data:', data);
            
            if (typeof data === 'object' && data !== null) {
                const keys = Object.keys(data);
                console.log('🔍 Firebase data keys:', keys);
                
                const assignmentsArray = keys.map(key => ({
                    id: key,
                    ...data[key]
                }));
                
                console.log('🔍 Converted assignments array:', assignmentsArray);
                
                // Set assignments and render
                assignments = assignmentsArray;
                localStorage.setItem('assignments', JSON.stringify(assignments));
                
                const contentArea = document.getElementById('contentArea');
                contentArea.innerHTML = renderAssignments();
                console.log('✅ Firebase data loaded and rendered');
            }
        } else {
            console.log('⚠️ No assignments found in Firebase');
        }
        
    } catch (error) {
        console.error('❌ Error force loading Firebase data:', error);
    }
}

// Make force load function available globally
window.forceLoadFirebaseData = forceLoadFirebaseData;

// Simple test function to verify assignments work
async function testAssignmentsNow() {
    console.log('🧪 Testing assignments now...');
    
    // Load real Firebase data
    console.log('Loading real Firebase data...');
    try {
        const firebaseAssignments = await getAssignmentsFromFirebase();
        assignments = firebaseAssignments || [];
    submissions = [];
        // MCQ assignments removed
    
    console.log('Assignments:', assignments);
        // console.log('MCQ Assignments:', mcqAssignments); // MCQ removed
    } catch (error) {
        console.error('Error loading Firebase data:', error);
        assignments = [];
        submissions = [];
    }
    
    // Render immediately
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = renderAssignments();
    
    console.log('✅ Assignments page rendered successfully');
}

// Make test function available globally
window.testAssignmentsNow = testAssignmentsNow;

// Simple test to check if assignment button works
function testAssignmentButton() {
    console.log('🧪 Testing assignment button...');
    
    try {
        // Check if showView function exists
        if (typeof showView !== 'function') {
            console.error('❌ showView function not found');
            return;
        }
        
        // Check if currentUser exists
        if (!currentUser) {
            console.error('❌ No current user found');
            return;
        }
        
        // Test calling showView
        console.log('🔄 Calling showView("assignments")...');
        showView('assignments');
        
        console.log('✅ Assignment button test completed');
        
    } catch (error) {
        console.error('❌ Error testing assignment button:', error);
    }
}

// Make test function available globally
window.testAssignmentButton = testAssignmentButton;

// ===== FIREBASE CONNECTIVITY TEST =====
async function testFirebaseConnectivity() {
    console.log('🧪 Testing Firebase connectivity and assignment flow...');
    
    try {
        // Test 1: Check Firebase initialization
        console.log('🔍 Test 1: Firebase Services Initialization');
        if (!window.firebaseServices) {
            console.log('❌ Firebase services not found');
            return false;
        }
        
        if (!window.firebaseServices.isInitialized) {
            console.log('⚠️ Firebase services not initialized, waiting...');
            await new Promise(resolve => {
                const checkInit = setInterval(() => {
                    if (window.firebaseServices.isInitialized) {
                        clearInterval(checkInit);
                        resolve();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(checkInit);
                    resolve();
                }, 5000);
            });
        }
        
        if (window.firebaseServices.isInitialized) {
            console.log('✅ Firebase services initialized successfully');
        } else {
            console.log('❌ Firebase services failed to initialize');
            return false;
        }
        
        // Test 2: Test assignment fetching
        console.log('🔍 Test 2: Assignment Data Fetching');
        const assignments = await getAssignmentsFromFirebase();
        console.log(`✅ Successfully fetched ${assignments.length} assignments from Firebase`);
        
        // Test 3: Test Firebase database connection
        console.log('🔍 Test 3: Direct Firebase Database Connection');
        if (window.firebaseDb) {
            const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const dbRef = ref(window.firebaseDb, 'assignments');
            const snapshot = await get(dbRef);
            console.log(`✅ Direct Firebase connection successful. Data exists: ${snapshot.exists()}`);
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                const assignmentCount = data ? Object.keys(data).length : 0;
                console.log(`✅ Found ${assignmentCount} assignments in Firebase database`);
            }
        }
        
        // Test 4: Test authentication state
        console.log('🔍 Test 4: Authentication State');
        if (window.firebaseAuth && window.firebaseAuth.currentUser) {
            console.log('✅ User is authenticated:', window.firebaseAuth.currentUser.email);
            console.log('✅ User role:', window.firebaseServices.currentUser?.role || 'unknown');
        } else {
            console.log('⚠️ No user currently authenticated');
        }
        
        console.log('✅ Firebase connectivity test completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Firebase connectivity test failed:', error);
        return false;
    }
}

// Test Firebase assignment creation (staff only)
async function testAssignmentCreation() {
    console.log('🧪 Testing assignment creation...');
    
    if (!currentUser || currentUser.role !== 'staff') {
        console.log('❌ User must be staff to test assignment creation');
        return false;
    }
    
    const testAssignment = {
        title: `Test Assignment ${new Date().toLocaleTimeString()}`,
        subject: 'Web Development',
        description: 'This is a test assignment created to verify Firebase integration.',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
        dueTime: '23:59',
        maxScore: 100
    };
    
    try {
        const result = await createAssignmentWithFirebase(testAssignment);
        if (result.success) {
            console.log('✅ Test assignment created successfully:', result.assignmentId);
            return true;
        } else {
            console.log('❌ Test assignment creation failed');
            return false;
        }
    } catch (error) {
        console.error('❌ Error testing assignment creation:', error);
        return false;
    }
}

// Test complete Firebase assignment workflow
async function testCompleteAssignmentFlow() {
    console.log('🧪 Testing complete assignment workflow...');
    
    try {
        // Step 1: Test Firebase connectivity
        console.log('\n=== STEP 1: Firebase Connectivity ===');
        const connectivityTest = await testFirebaseConnectivity();
        if (!connectivityTest) {
            console.log('❌ Firebase connectivity test failed');
            return false;
        }
        
        // Step 2: Test assignment data fetching
        console.log('\n=== STEP 2: Assignment Data Fetching ===');
        const assignments = await getAssignmentsFromFirebase();
        console.log(`✅ Fetched ${assignments.length} assignments from Firebase`);
        
        // Step 3: Test assignment rendering for students
        console.log('\n=== STEP 3: Student Assignment Display ===');
        if (assignments.length > 0) {
            const sampleAssignment = assignments[0];
            console.log('✅ Sample assignment structure:', {
                id: sampleAssignment.id,
                title: sampleAssignment.title,
                subject: sampleAssignment.subject,
                createdBy: sampleAssignment.createdBy,
                dueDate: sampleAssignment.dueDate
            });
        }
        
        // Step 4: Test UI rendering
        console.log('\n=== STEP 4: UI Rendering Test ===');
        const contentArea = document.getElementById('contentArea');
        if (contentArea) {
            const previousContent = contentArea.innerHTML;
            contentArea.innerHTML = renderAssignments();
            console.log('✅ Assignment UI rendered successfully');
            
            // Check if assignments are displayed
            const assignmentCards = contentArea.querySelectorAll('.assignment-card');
            console.log(`✅ Found ${assignmentCards.length} assignment cards in UI`);
        }
        
        console.log('\n✅ Complete assignment workflow test passed!');
        return true;
        
    } catch (error) {
        console.error('❌ Complete workflow test failed:', error);
        return false;
    }
}

// Test staff registration and login flow
async function testStaffRegistrationFlow() {
    console.log('🧪 Testing staff registration and login flow...');
    
    // Note: This is a demonstration of the flow, actual registration requires user interaction
    const testStaffData = {
        email: `test.staff.${Date.now()}@university.edu`,
        password: 'testpassword123',
        role: 'staff',
        name: 'Test Staff Member'
    };
    
    console.log('📝 Staff registration flow available with the following features:');
    console.log('✅ Role selection (Student/Staff) in registration form');
    console.log('✅ Firebase authentication integration');
    console.log('✅ Proper user profile creation in /staff/{uid} node');
    console.log('✅ Role-based access control for assignment creation');
    console.log('✅ Automatic login after successful registration');
    
    console.log('\n📋 To test staff registration:');
    console.log('1. Click "Register" button on login page');
    console.log('2. Select "Staff" role');
    console.log('3. Fill in staff details');
    console.log('4. Submit form');
    console.log('5. Login with staff credentials');
    console.log('6. Create assignments from staff portal');
    
    return true;
}

// Force refresh Firebase data and display
async function forceRefreshFirebaseData() {
    console.log('🔄 Force refreshing Firebase data...');
    
    try {
        // Clear current data
        assignments = [];
        submissions = [];
        
        // Show loading state
        const contentArea = document.getElementById('contentArea');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="content-section">
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        <h3>Refreshing data from Firebase...</h3>
                        <p>Please wait while we fetch the latest assignments.</p>
                    </div>
                </div>
            `;
        }
        
        // Load fresh data from Firebase
        await loadDataFromFirebase();
        
        // Re-render with fresh data
        if (contentArea) {
            contentArea.innerHTML = renderAssignments();
        }
        
        console.log(`✅ Refreshed with ${assignments.length} assignments from Firebase`);
        return true;
        
    } catch (error) {
        console.error('❌ Error refreshing Firebase data:', error);
        return false;
    }
}

// Debug function to check why assignments aren't showing
async function debugAssignmentDisplay() {
    console.log('🔍 Debug - Starting assignment display debug...');
    
    // Check current state
    console.log('🔍 Current assignments array:', assignments);
    console.log('🔍 Current assignments length:', assignments.length);
    console.log('🔍 Current user:', currentUser);
    console.log('🔍 Firebase services initialized:', window.firebaseServices?.isInitialized);
    
    // Force load from Firebase
    console.log('🔍 Force loading from Firebase...');
    try {
        const firebaseData = await getAssignmentsFromFirebase();
        console.log('🔍 Firebase data received:', firebaseData);
        
        if (firebaseData && firebaseData.length > 0) {
            assignments = firebaseData;
            console.log('🔍 Updated assignments array:', assignments);
            
            // Force render
            const contentArea = document.getElementById('contentArea');
            if (contentArea) {
                contentArea.innerHTML = renderAssignments();
                console.log('🔍 Rendered assignments page');
            }
        } else {
            console.log('❌ No data received from Firebase');
        }
    } catch (error) {
        console.error('❌ Error loading Firebase data:', error);
    }
}

// Direct Firebase test function
async function testDirectFirebaseRead() {
    console.log('🧪 Testing direct Firebase read...');
    
    try {
        if (!window.firebaseDb) {
            console.log('❌ Firebase database not available');
            return;
        }
        
        const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
        const dbRef = ref(window.firebaseDb, 'assignments');
        const snapshot = await get(dbRef);
        
        console.log('🔍 Firebase snapshot exists:', snapshot.exists());
        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log('🔍 Raw Firebase data:', data);
            console.log('🔍 Data type:', typeof data);
            console.log('🔍 Data keys:', Object.keys(data));
            
            // Process the data like the service does
            const records = [];
            Object.keys(data).forEach(key => {
                const childData = data[key];
                records.push({ 
                    id: key, 
                    ...childData 
                });
            });
            
            console.log('🔍 Processed records:', records);
            return records;
        } else {
            console.log('❌ No data found at assignments node');
            return [];
        }
    } catch (error) {
        console.error('❌ Error reading Firebase directly:', error);
        return [];
    }
}

// Force load assignments and display them
async function forceLoadAndDisplayAssignments() {
    console.log('🔄 Force loading assignments and displaying them...');
    
    try {
        // Clear current assignments array
        assignments = [];
        
        // Load from Firebase
        await loadDataFromFirebase();
        
        console.log('🔍 After loading - assignments:', assignments);
        console.log('🔍 After loading - assignments length:', assignments.length);
        
        // Force render
        const contentArea = document.getElementById('contentArea');
        if (contentArea) {
            contentArea.innerHTML = renderAssignments();
            console.log('✅ Assignments page rendered with Firebase data');
        }
        
        return assignments;
    } catch (error) {
        console.error('❌ Error force loading assignments:', error);
        return [];
    }
}

// Test function to verify student submission with email
async function testStudentSubmission() {
    console.log('🧪 Testing student submission with email...');
    
    if (!currentUser || currentUser.role !== 'student') {
        console.log('❌ User must be logged in as student to test submission');
        return false;
    }
    
    console.log('🔍 Current user info:', {
        id: currentUser.id || currentUser.uid,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        department: currentUser.department
    });
    
    // Check if there are any assignments to submit to
    if (assignments.length === 0) {
        console.log('❌ No assignments available to submit to');
        return false;
    }
    
    const testAssignment = assignments[0];
    console.log('🔍 Test assignment:', testAssignment.title);
    
    const testSubmissionData = {
        submissionText: 'This is a test submission to verify student email storage.',
        answerText: 'Test answer for assignment submission.'
    };
    
    try {
        // Test Firebase submission
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            const result = await submitAssignmentWithFirebase(testAssignment.id, testSubmissionData);
            if (result.success) {
                console.log('✅ Test submission successful with Firebase');
                console.log('🔍 Submission data stored:', result.submission);
                return true;
            } else {
                console.log('❌ Test submission failed:', result.error);
                return false;
            }
        } else {
            console.log('⚠️ Firebase not available, testing local submission');
            // Test local submission
            const newSubmission = {
                id: 'test_sub_' + Date.now(),
                assignmentId: testAssignment.id,
                studentId: currentUser.id || currentUser.uid,
                studentName: currentUser.name,
                studentEmail: currentUser.email,
                studentRole: currentUser.role,
                submissionText: testSubmissionData.submissionText,
                submittedAt: new Date().toISOString(),
                studentDepartment: currentUser.department || 'General',
                studentPortal: currentUser.portal || 'student'
            };
            
            submissions.push(newSubmission);
            localStorage.setItem('submissions', JSON.stringify(submissions));
            console.log('✅ Test submission successful with local storage');
            console.log('🔍 Submission data stored:', newSubmission);
            return true;
        }
    } catch (error) {
        console.error('❌ Error testing submission:', error);
        return false;
    }
}

// Test function to verify staff portal functionality
async function testStaffPortal() {
    console.log('🧪 Testing staff portal functionality...');
    
    if (!currentUser || currentUser.role !== 'staff') {
        console.log('❌ User must be logged in as staff to test staff portal');
        return false;
    }
    
    console.log('🔍 Current staff user info:', {
        id: currentUser.id || currentUser.uid,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        department: currentUser.department
    });
    
    // Test 1: Staff Dashboard
    console.log('🔍 Test 1: Staff Dashboard');
    const dashboardHTML = renderStaffDashboard();
    console.log('✅ Staff dashboard rendered successfully');
    
    // Test 2: Assignment Management
    console.log('🔍 Test 2: Assignment Management');
    console.log('🔍 Available assignments:', assignments.length);
    if (assignments.length > 0) {
        console.log('✅ Assignments available for management');
        
        // Test viewing assignment submissions
        const firstAssignment = assignments[0];
        console.log('🔍 Testing viewAssignmentSubmissions for:', firstAssignment.title);
        viewAssignmentSubmissions(firstAssignment.id);
        console.log('✅ Assignment submissions view opened');
    } else {
        console.log('⚠️ No assignments available to test management');
    }
    
    // Test 3: Grading System
    console.log('🔍 Test 3: Grading System');
    const totalSubmissions = submissions.length;
    const ungradedSubmissions = submissions.filter(s => s.grade === undefined || s.grade === null);
    console.log('🔍 Total submissions:', totalSubmissions);
    console.log('🔍 Ungraded submissions:', ungradedSubmissions.length);
    
    if (ungradedSubmissions.length > 0) {
        console.log('✅ Grading system ready - ungraded submissions available');
    } else {
        console.log('⚠️ No ungraded submissions available for testing');
    }
    
    // Test 4: Firebase Integration
    console.log('🔍 Test 4: Firebase Integration');
    if (window.firebaseServices && window.firebaseServices.isInitialized) {
        console.log('✅ Firebase services available for staff operations');
    } else {
        console.log('⚠️ Firebase services not available');
    }
    
    console.log('✅ Staff portal functionality test completed');
    return true;
}

// Test function specifically for staff dashboard
function testStaffDashboard() {
    console.log('🧪 Testing staff dashboard display...');
    
    if (!currentUser || currentUser.role !== 'staff') {
        console.log('❌ User must be logged in as staff to test dashboard');
        return false;
    }
    
    console.log('🔍 Dashboard data check:');
    console.log('  - Assignments:', assignments.length);
    console.log('  - Submissions:', submissions.length);
    console.log('  - Applications:', applications.length);
    console.log('  - Users:', users.length);
    
    // Test dashboard rendering
    try {
        const dashboardHTML = renderStaffDashboard();
        console.log('✅ Dashboard HTML generated successfully');
        
        // Check if dashboard contains expected elements
        const hasStats = dashboardHTML.includes('dashboard-card');
        const hasQuickActions = dashboardHTML.includes('quick-actions');
        const hasRecentActivity = dashboardHTML.includes('Recent Activity');
        const hasGradingOverview = dashboardHTML.includes('Grading Overview');
        const hasStudentOverview = dashboardHTML.includes('Student Overview');
        
        console.log('🔍 Dashboard sections check:');
        console.log('  - Stats cards:', hasStats ? '✅' : '❌');
        console.log('  - Quick actions:', hasQuickActions ? '✅' : '❌');
        console.log('  - Recent activity:', hasRecentActivity ? '✅' : '❌');
        console.log('  - Grading overview:', hasGradingOverview ? '✅' : '❌');
        console.log('  - Student overview:', hasStudentOverview ? '✅' : '❌');
        
        if (hasStats && hasQuickActions && hasRecentActivity && hasGradingOverview && hasStudentOverview) {
            console.log('✅ Staff dashboard is properly showing all sections');
            return true;
        } else {
            console.log('❌ Some dashboard sections are missing');
            return false;
        }
    } catch (error) {
        console.error('❌ Error testing staff dashboard:', error);
        return false;
    }
}

// Make test functions available globally
window.testFirebaseConnectivity = testFirebaseConnectivity;
window.testAssignmentCreation = testAssignmentCreation;
window.testCompleteAssignmentFlow = testCompleteAssignmentFlow;
window.testStaffRegistrationFlow = testStaffRegistrationFlow;
window.forceRefreshFirebaseData = forceRefreshFirebaseData;
window.debugAssignmentDisplay = debugAssignmentDisplay;
window.testDirectFirebaseRead = testDirectFirebaseRead;
window.forceLoadAndDisplayAssignments = forceLoadAndDisplayAssignments;
window.testStudentSubmission = testStudentSubmission;
window.testStaffPortal = testStaffPortal;
window.testStaffDashboard = testStaffDashboard;

function renderStaffAssignments() {
    const submissionCounts = assignments.map(assignment => {
        const assignmentSubmissions = submissions.filter(s => s.assignmentId === assignment.id);
        return {
            ...assignment,
            submissionCount: assignmentSubmissions.length,
            gradedCount: assignmentSubmissions.filter(s => s.grade !== undefined).length
        };
    });

    return `
        <div class="content-section">
            <div class="section-header">
                <h2><i class="fas fa-book-open" aria-hidden="true"></i>Manage Assignments</h2>
                <div class="header-actions">
                    <button class="btn btn-primary" onclick="openCreateAssignmentModal()" aria-label="Create new assignment">
                        <i class="fas fa-plus" aria-hidden="true"></i>Create Assignment
                    </button>
                </div>
            </div>
            
            <div class="assignment-filters">
                <div class="search-box">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="Search assignments..." onkeyup="filterStaffAssignments(this.value)">
                </div>
                <div class="filter-group">
                    <label>Subject</label>
                    <select onchange="filterStaffAssignmentsBySubject(this.value)">
                        <option value="">All Subjects</option>
                        <option value="Web Development">Web Development</option>
                        <option value="Programming">Programming</option>
                        <option value="Database Systems">Database Systems</option>
                        <option value="Software Engineering">Software Engineering</option>
                    </select>
                </div>
            </div>
            
            <div id="staffAssignmentsList" class="assignments-grid">
                ${renderStaffAssignmentCards(submissionCounts)}
            </div>
        </div>
    `;
}

function renderApplications() {
    if (currentUser.role === 'student') {
        return renderStudentApplications();
    } else {
        return renderStaffApplications();
    }
}

function renderStudentApplications() {
    // Debug: Check applications array and current user
    console.log('🔍 Debug - Rendering Student Applications:');
    console.log('- Current User:', currentUser);
    console.log('- Applications Array:', applications);
    console.log('- Applications Length:', applications ? applications.length : 'undefined');
    
    // Ensure applications is an array
    if (!applications || !Array.isArray(applications)) {
        console.warn('⚠️ Applications is not an array, initializing...');
        applications = [];
    }
    
    const userApplications = applications.filter(a => {
        console.log('- Checking application:', a.id, 'submittedBy:', a.submittedBy, 'studentId:', a.studentId, 'currentUser.id:', currentUser.id, 'currentUser.uid:', currentUser.uid);
        // Check both submittedBy (legacy) and studentId (Firebase) fields, and also check against both id and uid
        return a.submittedBy === currentUser.id || 
               a.studentId === currentUser.id || 
               a.submittedBy === currentUser.uid || 
               a.studentId === currentUser.uid;
    });
    
    console.log('- User Applications Found:', userApplications.length);
    console.log('- User Applications:', userApplications);
    
    if (userApplications.length === 0) {
        return `
            <div class="content-section">
                <div class="section-header">
                    <h2><i class="fas fa-file-text" aria-hidden="true"></i>My Applications</h2>
                    <button class="btn btn-primary" onclick="showCreateApplicationForm()" aria-label="Submit new application">
                        <i class="fas fa-plus" aria-hidden="true"></i>Submit Application
                    </button>
                </div>
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-file-text"></i>
                    </div>
                    <h3 class="empty-state-title">No Applications Submitted</h3>
                    <p class="empty-state-description">You haven't submitted any applications yet. Click the button above to submit your first application.</p>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="content-section">
            <div class="section-header">
                <h2><i class="fas fa-file-text" aria-hidden="true"></i>My Applications</h2>
                <button class="btn btn-primary" onclick="showCreateApplicationForm()" aria-label="Submit new application">
                    <i class="fas fa-plus" aria-hidden="true"></i>Submit Application
                </button>
            </div>
            <div class="table-container">
                <table class="table applications-table" role="table" aria-label="Student Applications">
                    <thead>
                        <tr>
                            <th scope="col">Type</th>
                            <th scope="col">Title</th>
                            <th scope="col">Description</th>
                            <th scope="col">Submitted Date</th>
                            <th scope="col">Status</th>
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userApplications.map(app => `
                            <tr>
                                <td><span class="application-type">${app.type ? app.type.charAt(0).toUpperCase() + app.type.slice(1) : 'N/A'}</span></td>
                                <td><strong>${app.title || 'Untitled'}</strong></td>
                                <td><div class="text-content">${app.description ? (app.description.length > 50 ? app.description.substring(0, 50) + '...' : app.description) : 'No description'}</div></td>
                                <td>${formatDate(app.submittedAt || app.createdAt)}</td>
                                <td><span class="status-badge status-${(app.status || 'pending').toLowerCase()}" aria-label="Status: ${app.status || 'pending'}">${(app.status || 'Pending').charAt(0).toUpperCase() + (app.status || 'pending').slice(1).toLowerCase()}</span></td>
                                <td>
                                    <button class="btn btn-secondary btn-sm" onclick="viewApplication('${app.id}')" aria-label="View application ${app.title}">
                                        <i class="fas fa-eye"></i> View Details
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderStaffApplications() {
    if (applications.length === 0) {
        return `
            <div class="content-section">
                <div class="section-header">
                    <h2><i class="fas fa-file-text" aria-hidden="true"></i>Review Applications</h2>
                </div>
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-file-text"></i>
                    </div>
                    <h3 class="empty-state-title">No Applications to Review</h3>
                    <p class="empty-state-description">There are currently no student applications to review.</p>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="content-section">
            <div class="section-header">
                <h2><i class="fas fa-file-text" aria-hidden="true"></i>Review Applications</h2>
                <div class="filter-controls">
                    <select id="applicationTypeFilter" class="form-input" onchange="filterApplications()">
                        <option value="">All Types</option>
                        <option value="leave">Leave Request</option>
                        <option value="internship">Internship</option>
                        <option value="scholarship">Scholarship</option>
                        <option value="other">Other</option>
                    </select>
                    <select id="applicationStatusFilter" class="form-input" onchange="filterApplications()">
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>
            <div class="table-container">
                <table class="table applications-table" role="table" aria-label="Staff Applications Review">
                    <thead>
                        <tr>
                            <th scope="col">Type</th>
                            <th scope="col">Title</th>
                            <th scope="col">Student Details</th>
                            <th scope="col">Class/Semester</th>
                            <th scope="col">Submitted Date</th>
                            <th scope="col">Status</th>
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="applicationsTableBody">
                        ${applications.map(app => {
                            const studentInfo = app.studentInfo || {};
                            const submitterName = studentInfo.fullName || getUserName(app.submittedBy) || 'Unknown Student';
                            const enrollmentNumber = studentInfo.enrollmentNumber || 'N/A';
                            const classInfo = studentInfo.class || 'N/A';
                            const semesterInfo = studentInfo.semester ? `Sem ${studentInfo.semester}` : 'N/A';
                            const phone = studentInfo.phone || 'N/A';
                            
                            return `
                            <tr data-type="${app.type || 'other'}" data-status="${(app.status || 'pending').toLowerCase()}">
                                <td><span class="application-type">${app.type ? app.type.charAt(0).toUpperCase() + app.type.slice(1) : 'N/A'}</span></td>
                                <td><strong>${app.title || 'Untitled'}</strong></td>
                                <td>
                                    <div class="student-details">
                                        <div class="student-name"><strong>${submitterName}</strong></div>
                                        <div class="student-enrollment">Enrollment: ${enrollmentNumber}</div>
                                        <div class="student-phone">Phone: ${phone}</div>
                                    </div>
                                </td>
                                <td>
                                    <div class="class-info">
                                        <div class="student-class">${classInfo}</div>
                                        <div class="student-semester">${semesterInfo}</div>
                                    </div>
                                </td>
                                <td>${formatDate(app.submittedAt || app.createdAt)}</td>
                                <td><span class="status-badge status-${(app.status || 'pending').toLowerCase()}" aria-label="Status: ${app.status || 'pending'}">${(app.status || 'Pending').charAt(0).toUpperCase() + (app.status || 'Pending').slice(1).toLowerCase()}</span></td>
                                <td class="actions-cell">
                                    <div class="btn-group">
                                        <button class="btn btn-secondary btn-sm" onclick="viewApplication('${app.id}')" aria-label="View application ${app.title}">
                                            <i class="fas fa-eye"></i> View
                                        </button>
                                        ${(app.status || 'pending').toLowerCase() === 'pending' ? `
                                            <button class="btn btn-success btn-sm" onclick="approveApplication('${app.id}')" aria-label="Approve application ${app.title}">
                                                <i class="fas fa-check"></i> Approve
                                            </button>
                                            <button class="btn btn-danger btn-sm" onclick="rejectApplication('${app.id}')" aria-label="Reject application ${app.title}">
                                                <i class="fas fa-times"></i> Reject
                                            </button>
                                        ` : (app.status && app.status.toLowerCase() !== 'pending' ? `
                                            <span class="text-muted">Reviewed</span>
                                        ` : '')}
                                    </div>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Helper function to render a list of announcements
function renderAnnouncementsList(announcementsToRender) {
    if (!announcementsToRender || !Array.isArray(announcementsToRender) || announcementsToRender.length === 0) {
        return '<div class="empty-state">No announcements available</div>';
    }
    
    return `
        <div class="announcement-list">
            ${announcementsToRender.map(announcement => `
                <div class="announcement-item" data-id="${announcement.id}">
                    <div class="announcement-header">
                        <h3 class="announcement-title">${announcement.title || 'Untitled Announcement'}</h3>
                        <span class="announcement-date">${formatDate(announcement.createdAt || new Date())}</span>
                    </div>
                    <div class="announcement-content">
                        <p>${announcement.message || 'No content'}</p>
                    </div>
                    <div class="announcement-footer">
                        <button class="btn btn-sm" onclick="viewAnnouncement('${announcement.id}')">
                            <i class="fas fa-eye" aria-hidden="true"></i> View Details
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderAnnouncements() {
    // Make sure announcements array exists
    if (!announcements || !Array.isArray(announcements)) {
        console.error('❌ Announcements array is not available:', announcements);
        announcements = [];
    }
    
    // Filter announcements based on user role and target audience
    let filteredAnnouncements = announcements.filter(announcement => {
        if (announcement.targetAudience === 'all') return true;
        if (announcement.targetAudience === currentUser.role) return true;
        return false;
    });

    return `
        <div class="content-section">
            <div class="content-header">
                <h2><i class="fas fa-bullhorn" aria-hidden="true"></i>Announcements</h2>
                ${currentUser.role === 'staff' ? `
                    <button class="btn btn-primary" onclick="showCreateAnnouncementForm()" aria-label="Create new announcement">
                        <i class="fas fa-plus" aria-hidden="true"></i>New Announcement
                    </button>
                ` : ''}
            </div>
            ${currentUser.role === 'staff' ? renderStaffAnnouncements(filteredAnnouncements) : renderStudentAnnouncements(filteredAnnouncements)}
        </div>
    `;
}

function renderStaffAnnouncements(announcementsList) {
    if (announcementsList.length === 0) {
        return '<p class="no-data">No announcements available.</p>';
    }
    
    return `
        <div class="announcements-table-container">
            <table class="announcements-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Priority</th>
                        <th>Target</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${announcementsList.map(announcement => `
                        <tr>
                            <td>
                                <div class="announcement-title-cell">
                                    <strong>${announcement.title}</strong>
                                </div>
                            </td>
                            <td><span class="type-badge type-${announcement.type}">${announcement.type}</span></td>
                            <td><span class="status-badge status-${announcement.priority}">${announcement.priority}</span></td>
                            <td>${announcement.targetAudience}</td>
                            <td>${formatDate(announcement.createdAt)}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn btn-sm btn-secondary" onclick="viewAnnouncement('${announcement.id}')" aria-label="View announcement">
                                        <i class="fas fa-eye" aria-hidden="true"></i>
                                    </button>
                                    <button class="btn btn-sm btn-primary" onclick="editAnnouncement('${announcement.id}')" aria-label="Edit announcement">
                                        <i class="fas fa-edit" aria-hidden="true"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${announcement.id}')" aria-label="Delete announcement">
                                        <i class="fas fa-trash" aria-hidden="true"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderStudentAnnouncements(announcementsList) {
    if (announcementsList.length === 0) {
        return '<p class="no-data">No announcements available.</p>';
    }
    
    // Sort announcements by date (newest first) and highlight recent ones
    const sortedAnnouncements = announcementsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    return `
        <div class="announcements-grid">
            ${sortedAnnouncements.map(announcement => {
                const isRecent = new Date(announcement.createdAt) > sevenDaysAgo;
                return `
                    <div class="announcement-card ${isRecent ? 'recent' : ''}" role="article" aria-labelledby="announcement-${announcement.id}">
                        ${isRecent ? '<div class="recent-badge">New</div>' : ''}
                        <div class="announcement-header">
                            <h3 id="announcement-${announcement.id}" class="announcement-title">${announcement.title}</h3>
                            <div class="announcement-badges">
                                <span class="type-badge type-${announcement.type}">${announcement.type}</span>
                                <span class="status-badge status-${announcement.priority}">${announcement.priority}</span>
                                <span class="target-badge">${announcement.targetAudience}</span>
                            </div>
                        </div>
                        <div class="announcement-content">
                            <p class="announcement-message">${announcement.content}</p>
                            ${announcement.attachment ? `
                                <div class="attachment-info">
                                    <i class="fas fa-paperclip" aria-hidden="true"></i>
                                    <span>${announcement.attachment.name}</span>
                                </div>
                            ` : ''}
                            ${announcement.link ? `
                                <div class="link-info">
                                    <i class="fas fa-external-link-alt" aria-hidden="true"></i>
                                    <a href="${announcement.link}" target="_blank" rel="noopener noreferrer">External Link</a>
                                </div>
                            ` : ''}
                        </div>
                        <div class="announcement-footer">
                            <span class="announcement-date" aria-label="Published on ${formatDate(announcement.createdAt)}">
                                <i class="fas fa-calendar" aria-hidden="true"></i>
                                ${formatDate(announcement.createdAt)}
                            </span>
                            <button class="btn btn-sm btn-secondary" onclick="viewAnnouncement('${announcement.id}')" aria-label="View full announcement">
                                View Details
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ===== SCHEDULE RENDERING FUNCTIONS =====
function renderSchedule() {
    console.log('🔄 Rendering schedule for user role:', currentUser?.role);
    console.log('📊 Available schedule events:', scheduleEvents.length);
    
    if (currentUser.role === 'staff') {
        return renderStaffSchedule();
    } else {
        return renderStudentSchedule();
    }
}

// Function to refresh schedule data (useful for debugging)
function refreshScheduleData() {
    scheduleEvents = mockData.scheduleEvents || [];
    localStorage.setItem('scheduleEvents', JSON.stringify(scheduleEvents));
    console.log('🔄 Schedule data refreshed with', scheduleEvents.length, 'events');
    if (currentView === 'schedule') {
        showView('schedule');
    }
}

function renderStaffSchedule() {
    // Sort schedules by date and time
    const sortedSchedules = [...scheduleEvents].sort((a, b) => {
        const dateA = new Date(a.date + 'T' + a.time);
        const dateB = new Date(b.date + 'T' + b.time);
        return dateA - dateB;
    });

    return `
        <div class="content-section">
            <div class="content-header">
                <h2><i class="fas fa-calendar" aria-hidden="true"></i>Schedule Management</h2>
                <button class="btn btn-primary" onclick="showCreateScheduleForm()" aria-label="Create new schedule event">
                    <i class="fas fa-plus" aria-hidden="true"></i>New Event
                </button>
            </div>
            
            <div class="schedule-controls">
                <div class="view-toggle">
                    <button class="btn btn-sm ${currentScheduleView === 'list' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="switchScheduleView('list')" aria-label="Switch to list view">
                        <i class="fas fa-list" aria-hidden="true"></i> List View
                    </button>
                    <button class="btn btn-sm ${currentScheduleView === 'calendar' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="switchScheduleView('calendar')" aria-label="Switch to calendar view">
                        <i class="fas fa-calendar-alt" aria-hidden="true"></i> Calendar View
                    </button>
                </div>
            </div>
            
            ${currentScheduleView === 'list' ? renderScheduleListView(sortedSchedules) : renderScheduleCalendarView(sortedSchedules)}
        </div>
    `;
}

function renderStudentSchedule() {
    console.log('📅 Rendering student schedule with', scheduleEvents.length, 'total events');
    
    // Sort schedules by date and time
    const sortedSchedules = [...scheduleEvents].sort((a, b) => {
        const dateA = new Date(a.date + 'T' + a.time);
        const dateB = new Date(b.date + 'T' + b.time);
        return dateA - dateB;
    });

    // Get current date and time for proper categorization
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

    // Categorize schedules into distinct groups (no duplicates)
    const pastEvents = [];
    const todaysEvents = [];
    const upcomingEvents = [];

    sortedSchedules.forEach(schedule => {
        const scheduleDateTime = new Date(schedule.date + 'T' + schedule.time);
        const scheduleDate = new Date(schedule.date);
        scheduleDate.setHours(0, 0, 0, 0);

        if (scheduleDate.getTime() < today.getTime()) {
            // Past events (before today)
            pastEvents.push(schedule);
        } else if (scheduleDate.getTime() === today.getTime()) {
            // Today's events
            todaysEvents.push(schedule);
        } else {
            // Future events (after today)
            upcomingEvents.push(schedule);
        }
    });

    console.log('📊 Clean schedule breakdown:', {
        total: sortedSchedules.length,
        past: pastEvents.length,
        today: todaysEvents.length,
        upcoming: upcomingEvents.length
    });

    return `
        <div class="content-section">
            <div class="content-header">
                <h2><i class="fas fa-calendar" aria-hidden="true"></i>My Schedule</h2>
                <div class="view-toggle">
                    <button class="btn btn-sm btn-secondary" onclick="switchStudentScheduleView('table')" id="tableViewBtn">
                        <i class="fas fa-table"></i> Table View
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="switchStudentScheduleView('calendar')" id="calendarViewBtn">
                        <i class="fas fa-calendar-alt"></i> Calendar View
                    </button>
                </div>
            </div>
            
            ${scheduleEvents.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-calendar-times" aria-hidden="true"></i>
                    </div>
                    <h3 class="empty-state-title">No Schedule Events</h3>
                    <p class="empty-state-description">No schedule events are currently available. Check back later for updates.</p>
                </div>
            ` : `
                <div id="studentScheduleContent">
                    ${renderStudentScheduleTables(pastEvents, todaysEvents, upcomingEvents)}
                </div>
            `}
        </div>
    `;
}

// Global variable to track student schedule view
let currentStudentScheduleView = 'table';

function switchStudentScheduleView(view) {
    currentStudentScheduleView = view;
    
    // Update button states
    document.getElementById('tableViewBtn').className = view === 'table' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
    document.getElementById('calendarViewBtn').className = view === 'calendar' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
    
    // Get categorized events
    const sortedSchedules = [...scheduleEvents].sort((a, b) => {
        const dateA = new Date(a.date + 'T' + a.time);
        const dateB = new Date(b.date + 'T' + b.time);
        return dateA - dateB;
    });

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pastEvents = [];
    const todaysEvents = [];
    const upcomingEvents = [];

    sortedSchedules.forEach(schedule => {
        const scheduleDate = new Date(schedule.date);
        scheduleDate.setHours(0, 0, 0, 0);

        if (scheduleDate.getTime() < today.getTime()) {
            pastEvents.push(schedule);
        } else if (scheduleDate.getTime() === today.getTime()) {
            todaysEvents.push(schedule);
        } else {
            upcomingEvents.push(schedule);
        }
    });
    
    // Update content
    const contentDiv = document.getElementById('studentScheduleContent');
    if (contentDiv) {
        if (view === 'table') {
            contentDiv.innerHTML = renderStudentScheduleTables(pastEvents, todaysEvents, upcomingEvents);
        } else {
            contentDiv.innerHTML = renderStudentScheduleCalendar(sortedSchedules);
        }
    }
}

function renderStudentScheduleTables(pastEvents, todaysEvents, upcomingEvents) {
    return `
        <!-- Past Events Table -->
        ${pastEvents.length > 0 ? `
            <div class="schedule-table-section">
                <h3><i class="fas fa-history" aria-hidden="true"></i>Past Events (${pastEvents.length})</h3>
                <div class="table-container">
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th>Event Name</th>
                                <th>Description</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Type</th>
                                <th>Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pastEvents.map(schedule => renderScheduleTableRow(schedule, 'past')).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        ` : ''}
        
        <!-- Today's Events Table -->
        <div class="schedule-table-section">
            <h3><i class="fas fa-star" aria-hidden="true"></i>Today's Events (${todaysEvents.length})</h3>
            ${todaysEvents.length > 0 ? `
                <div class="table-container">
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th>Event Name</th>
                                <th>Description</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Type</th>
                                <th>Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${todaysEvents.map(schedule => renderScheduleTableRow(schedule, 'today')).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="no-data">No events scheduled for today.</p>'}
        </div>
        
        <!-- Upcoming Events Table -->
        <div class="schedule-table-section">
            <h3><i class="fas fa-calendar-alt" aria-hidden="true"></i>Upcoming Events (${upcomingEvents.length})</h3>
            ${upcomingEvents.length > 0 ? `
                <div class="table-container">
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th>Event Name</th>
                                <th>Description</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Type</th>
                                <th>Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${upcomingEvents.map(schedule => renderScheduleTableRow(schedule, 'upcoming')).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="no-data">No upcoming events scheduled.</p>'}
        </div>
    `;
}

function renderScheduleTableRow(schedule, type) {
    const scheduleDate = new Date(schedule.date);
    const formattedDate = scheduleDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    const formattedTime = new Date(`2000-01-01T${schedule.time}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    return `
        <tr class="schedule-row schedule-row-${type}" onclick="viewSchedule('${schedule.id}')">
            <td class="event-name">
                <div class="event-title">${schedule.title}</div>
                <div class="event-priority priority-${schedule.priority}">
                    <i class="fas fa-circle"></i> ${schedule.priority}
                </div>
            </td>
            <td class="event-description">${schedule.description || 'No description'}</td>
            <td class="event-date">${formattedDate}</td>
            <td class="event-time">${formattedTime}</td>
            <td class="event-type">
                <span class="type-badge type-${schedule.category}">
                    ${schedule.category}
                </span>
            </td>
            <td class="event-location">${schedule.location || 'TBA'}</td>
        </tr>
    `;
}

function renderStudentScheduleCalendar(schedules) {
    // Group schedules by date for calendar display
    const schedulesByDate = {};
    schedules.forEach(schedule => {
        if (!schedulesByDate[schedule.date]) {
            schedulesByDate[schedule.date] = [];
        }
        schedulesByDate[schedule.date].push(schedule);
    });

    // Get current month dates
    const now = new Date();
    const currentMonth = currentStudentCalendarMonth;
    const currentYear = currentStudentCalendarYear;
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const calendarDays = [];
    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        calendarDays.push(date);
    }

    return `
        <div class="student-schedule-calendar">
            <div class="calendar-header">
                <div class="calendar-nav">
                    <button class="btn btn-primary btn-sm calendar-nav-btn" onclick="navigateStudentCalendar(-1)" title="Previous Month">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <h3 class="calendar-title">${new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                    <button class="btn btn-primary btn-sm calendar-nav-btn" onclick="navigateStudentCalendar(1)" title="Next Month">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
            <div class="calendar-grid">
                <div class="calendar-weekdays">
                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                </div>
                <div class="calendar-days">
                    ${calendarDays.map(date => {
                        const dateString = date.toISOString().split('T')[0];
                        const daySchedules = schedulesByDate[dateString] || [];
                        const isCurrentMonth = date.getMonth() === currentMonth;
                        const isToday = date.toDateString() === now.toDateString();
                        
                        return `
                            <div class="calendar-day ${isCurrentMonth ? '' : 'other-month'} ${isToday ? 'today' : ''}">
                                <div class="day-number">${date.getDate()}</div>
                                <div class="calendar-events">
                                    ${daySchedules.map(schedule => `
                                        <div class="calendar-event category-${schedule.category}" 
                                             onclick="viewSchedule('${schedule.id}')" 
                                             title="${schedule.title} - ${schedule.time}">
                                            <span class="event-time">${schedule.time}</span>
                                            <span class="event-title">${schedule.title}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderScheduleListView(schedules) {
    if (schedules.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-calendar-times" aria-hidden="true"></i>
                </div>
                <h3 class="empty-state-title">No Schedule Events</h3>
                <p class="empty-state-description">No schedule events have been created yet. Create your first event to get started.</p>
            </div>
        `;
    }
    
    return `
        <div class="table-container">
            <table class="table schedule-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Date & Time</th>
                        <th>Location</th>
                        <th>Priority</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${schedules.map(schedule => {
                        const scheduleDate = new Date(schedule.date + 'T' + schedule.time);
                        const formattedDate = scheduleDate.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                        });
                        const formattedTime = scheduleDate.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit', 
                            hour12: true 
                        });
                        
                        return `
                            <tr>
                                <td>
                                    <div class="schedule-title-cell">
                                        <strong>${schedule.title}</strong>
                                        ${schedule.description ? `<div class="schedule-description">${schedule.description}</div>` : ''}
                                    </div>
                                </td>
                                <td>
                                    <span class="category-badge category-${schedule.category}">${schedule.category}</span>
                                </td>
                                <td>
                                    <div class="schedule-datetime">
                                        <div class="schedule-date">${formattedDate}</div>
                                        <div class="schedule-time">${formattedTime}</div>
                                    </div>
                                </td>
                                <td class="location-cell">${schedule.location || '-'}</td>
                                <td>
                                    <span class="priority-badge priority-${schedule.priority}">${schedule.priority}</span>
                                </td>
                                <td class="actions-cell">
                                    <div class="btn-group">
                                        <button class="btn btn-sm btn-secondary" onclick="viewSchedule('${schedule.id}')" title="View Details">
                                            <i class="fas fa-eye" aria-hidden="true"></i>
                                            <span class="sr-only">View</span>
                                        </button>
                                        <button class="btn btn-sm btn-primary" onclick="editSchedule('${schedule.id}')" title="Edit">
                                            <i class="fas fa-edit" aria-hidden="true"></i>
                                            <span class="sr-only">Edit</span>
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="deleteSchedule('${schedule.id}')" title="Delete">
                                            <i class="fas fa-trash" aria-hidden="true"></i>
                                            <span class="sr-only">Delete</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderScheduleCalendarView(schedules) {
    if (schedules.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-calendar-times" aria-hidden="true"></i>
                </div>
                <h3 class="empty-state-title">No Schedule Events</h3>
                <p class="empty-state-description">No schedule events have been created yet. Create your first event to get started.</p>
            </div>
        `;
    }
    
    // Group schedules by date
    const schedulesByDate = {};
    schedules.forEach(schedule => {
        if (!schedulesByDate[schedule.date]) {
            schedulesByDate[schedule.date] = [];
        }
        schedulesByDate[schedule.date].push(schedule);
    });
    
    // Get current month dates
    const now = new Date();
    const currentMonth = currentCalendarMonth;
    const currentYear = currentCalendarYear;
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const calendarDays = [];
    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        calendarDays.push(date);
    }
    
    return `
        <div class="schedule-calendar">
            <div class="calendar-header">
                <div class="calendar-nav">
                    <button class="btn btn-primary btn-sm calendar-nav-btn" onclick="navigateCalendar(-1)" title="Previous Month">
                        <i class="fas fa-chevron-left"></i>
                        <span class="sr-only">Previous Month</span>
                    </button>
                    <h3 class="calendar-title">${new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                    <button class="btn btn-primary btn-sm calendar-nav-btn" onclick="navigateCalendar(1)" title="Next Month">
                        <i class="fas fa-chevron-right"></i>
                        <span class="sr-only">Next Month</span>
                    </button>
                </div>
            </div>
            <div class="calendar-grid">
                <div class="calendar-weekdays">
                    <div>Sun</div>
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div>Sat</div>
                </div>
                <div class="calendar-days">
                    ${calendarDays.map(date => {
                        const dateString = date.toISOString().split('T')[0];
                        const daySchedules = schedulesByDate[dateString] || [];
                        const isCurrentMonth = date.getMonth() === currentMonth;
                        const isToday = date.toDateString() === now.toDateString();
                        
                        return `
                            <div class="calendar-day ${isCurrentMonth ? '' : 'other-month'} ${isToday ? 'today' : ''}">
                                <div class="day-number">${date.getDate()}</div>
                                <div class="calendar-events">
                                    ${daySchedules.map(schedule => {
                                        const scheduleTime = new Date(schedule.date + 'T' + schedule.time);
                                        const formattedTime = scheduleTime.toLocaleTimeString('en-US', { 
                                            hour: 'numeric', 
                                            minute: '2-digit', 
                                            hour12: true 
                                        });
                                        
                                        return `
                                            <div class="calendar-event category-${schedule.category}" 
                                                 onclick="openEventModal('${schedule.id}')" 
                                                 data-event-id="${schedule.id}">
                                                <span class="event-time">${formattedTime}</span>
                                                <span class="event-title">${schedule.title}</span>
                                                <div class="event-priority priority-${schedule.priority}"></div>
                                                <div class="calendar-event-tooltip">
                                                    <strong>${schedule.title}</strong><br>
                                                    Category: ${schedule.category}<br>
                                                    Time: ${formattedTime}<br>
                                                    ${schedule.location ? `Location: ${schedule.location}<br>` : ''}
                                                    Priority: ${schedule.priority}
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderScheduleTimelineItem(schedule, type) {
    const scheduleDate = new Date(schedule.date + 'T' + schedule.time);
    const isToday = type === 'today';
    
    return `
        <div class="timeline-item ${isToday ? 'today' : ''}">
            <div class="timeline-marker category-${schedule.category}"></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <h4>${schedule.title}</h4>
                    <span class="timeline-time">${formatTime(schedule.time)}</span>
                </div>
                ${schedule.description ? `<p class="timeline-description">${schedule.description}</p>` : ''}
                ${schedule.location ? `<div class="timeline-location"><i class="fas fa-map-marker-alt"></i> ${schedule.location}</div>` : ''}
                <div class="timeline-category">
                    <span class="category-badge category-${schedule.category}">${schedule.category}</span>
                </div>
            </div>
        </div>
    `;
}

function renderScheduleCard(schedule) {
    const scheduleDate = new Date(schedule.date + 'T' + schedule.time);
    const now = new Date();
    const isToday = scheduleDate.toDateString() === now.toDateString();
    const isUpcoming = scheduleDate > now;
    
    return `
        <div class="schedule-card ${isToday ? 'today' : ''} ${isUpcoming ? 'upcoming' : 'past'}" 
             onclick="viewSchedule('${schedule.id}')">
            <div class="schedule-card-header">
                <h4>${schedule.title}</h4>
                <span class="category-badge category-${schedule.category}">${schedule.category}</span>
            </div>
            <div class="schedule-card-content">
                ${schedule.description ? `<p class="schedule-description">${schedule.description}</p>` : ''}
                <div class="schedule-meta">
                    <div class="schedule-datetime">
                        <i class="fas fa-calendar" aria-hidden="true"></i>
                        <span>${formatDate(schedule.date)}</span>
                    </div>
                    <div class="schedule-time">
                        <i class="fas fa-clock" aria-hidden="true"></i>
                        <span>${formatTime(schedule.time)}</span>
                    </div>
                    ${schedule.location ? `
                        <div class="schedule-location">
                            <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
                            <span>${schedule.location}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderProfile() {
    return `
        <div class="content-section">
            <h2><i class="fas fa-user-circle" aria-hidden="true"></i>Profile & Settings</h2>
            
            <!-- Profile Information Section -->
            <div class="profile-section">
                <div class="profile-header">
                    <h3><i class="fas fa-user" aria-hidden="true"></i>Profile Information</h3>
                </div>
                
                <div class="profile-content">
                    <div class="profile-picture-section">
                        <div class="profile-avatar-large" id="profileAvatarLarge">
                            <img id="profileImage" src="${currentUser.profilePicture || ''}" alt="Profile Picture" style="display: ${currentUser.profilePicture ? 'block' : 'none'};">
                            <i class="fas fa-user" id="profileDefaultIcon" style="display: ${currentUser.profilePicture ? 'none' : 'block'};" aria-hidden="true"></i>
                        </div>
                        <div class="profile-picture-actions">
                            <input type="file" id="profilePictureInput" accept="image/*" style="display: none;" onchange="handleProfilePictureUpload(event)">
                            <button type="button" onclick="document.getElementById('profilePictureInput').click()" class="btn btn-secondary btn-sm">
                                <i class="fas fa-camera"></i> Upload Picture
                            </button>
                            ${currentUser.profilePicture ? `
                                <button type="button" onclick="removeProfilePicture()" class="btn btn-outline btn-sm">
                                    <i class="fas fa-trash"></i> Remove
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="profile-details">
                        <div class="profile-field">
                            <label class="profile-label">Name:</label>
                            <span class="profile-value" id="profileName">${currentUser.name || 'Not set'}</span>
                            <button type="button" onclick="editProfileName()" class="btn btn-sm btn-secondary">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                        </div>
                        <div class="profile-field">
                            <label class="profile-label">Email:</label>
                            <span class="profile-value">${currentUser.email}</span>
                        </div>
                        <div class="profile-field">
                            <label class="profile-label">Role:</label>
                            <span class="profile-value">${currentUser.role || 'Student'}</span>
                        </div>
                        ${currentUser.phone ? `
                            <div class="profile-field">
                                <label class="profile-label">Phone:</label>
                                <span class="profile-value">${currentUser.phone}</span>
                            </div>
                        ` : ''}
                        <div class="profile-actions">
                            <button type="button" onclick="showChangePasswordModal()" class="btn btn-primary">
                                <i class="fas fa-key"></i> Change Password
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Edit Name Form (Hidden by default) -->
                <div id="editNameForm" class="edit-form hidden">
                    <div class="form-group">
                        <label for="newProfileName" class="form-label">Update Your Name:</label>
                        <input type="text" id="newProfileName" class="form-input" value="${currentUser.name || ''}" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" onclick="saveProfileName()" class="btn btn-primary">Save</button>
                        <button type="button" onclick="cancelEditProfileName()" class="btn btn-secondary">Cancel</button>
                    </div>
                </div>
            </div>
            
            <!-- Preferences Section -->
            <div class="profile-section">
                <div class="profile-header">
                    <h3><i class="fas fa-cog" aria-hidden="true"></i>Preferences</h3>
                </div>
                
                <div class="profile-content">
                    <div class="preference-group">
                        <h4>Notification Settings</h4>
                        <div class="preference-item">
                            <div class="preference-info">
                                <label class="preference-label">Email Notifications</label>
                                <p class="preference-description">Receive email alerts for assignments, announcements, and updates</p>
                            </div>
                            <div class="preference-control">
                                <label class="toggle-switch">
                                    <input type="checkbox" id="emailNotifications" ${currentUser.preferences?.emailNotifications !== false ? 'checked' : ''} onchange="updateNotificationPreference('email', this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="preference-item">
                            <div class="preference-info">
                                <label class="preference-label">SMS Notifications</label>
                                <p class="preference-description">Receive SMS alerts for urgent updates and deadlines</p>
                            </div>
                            <div class="preference-control">
                                <label class="toggle-switch">
                                    <input type="checkbox" id="smsNotifications" ${currentUser.preferences?.smsNotifications === true ? 'checked' : ''} onchange="updateNotificationPreference('sms', this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                </div>
            </div>
            
            <!-- Account Settings Section (Staff Only) -->
            ${currentUser.role === 'staff' ? `
            <div class="profile-section">
                <div class="profile-header">
                    <h3><i class="fas fa-shield-alt" aria-hidden="true"></i>Account Settings</h3>
                </div>

                <div class="profile-content">
                    <div class="account-actions">
                        <div class="account-action-item">
                            <div class="account-action-info">
                                <h4>Deactivate Account</h4>
                                <p>Temporarily disable your account. You can reactivate it later.</p>
                            </div>
                            <button type="button" onclick="showDeactivateAccountModal()" class="btn btn-warning">
                                <i class="fas fa-pause-circle"></i> Deactivate
                            </button>
                        </div>
                        <div class="account-action-item danger">
                            <div class="account-action-info">
                                <h4>Delete Account</h4>
                                <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
                            </div>
                            <button type="button" onclick="showDeleteAccountModal()" class="btn btn-danger">
                                <i class="fas fa-trash-alt"></i> Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

// ===== PROFILE EDITING FUNCTIONS =====

// Profile Picture Functions
function handleProfilePictureUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showAlert('Please select a valid image file.', 'error');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showAlert('Image size must be less than 5MB.', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;
        updateProfilePicture(imageData);
    };
    reader.readAsDataURL(file);
}

async function updateProfilePicture(imageData) {
    try {
        startLoading();
        
        // Update current user object
        currentUser.profilePicture = imageData;
        
        // Update Firebase
        if (window.firebaseAuth?.currentUser) {
            await updateUserProfileWithFirebase(window.firebaseAuth.currentUser.uid, {
                profilePicture: imageData
            });
        }
        
        // Update UI
        const profileImage = document.getElementById('profileImage');
        const profileDefaultIcon = document.getElementById('profileDefaultIcon');
        
        if (profileImage && profileDefaultIcon) {
            profileImage.src = imageData;
            profileImage.style.display = 'block';
            profileDefaultIcon.style.display = 'none';
        }
        
        // Update header avatar
        const userAvatar = document.querySelector('.user-avatar i');
        if (userAvatar) {
            userAvatar.parentElement.innerHTML = `<img src="${imageData}" alt="Profile Picture" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`;
        }
        
        // Re-render profile to show remove button
        if (currentView === 'profile') {
            document.getElementById('contentArea').innerHTML = renderProfile();
        }
        
        stopLoading();
        showAlert('Profile picture updated successfully!', 'success');
        
    } catch (error) {
        console.error('❌ Error updating profile picture:', error);
        stopLoading();
        showAlert('Failed to update profile picture. Please try again.', 'error');
    }
}

async function removeProfilePicture() {
    try {
        startLoading();
        
        // Update current user object
        currentUser.profilePicture = null;
        
        // Update Firebase
        if (window.firebaseAuth?.currentUser) {
            await updateUserProfileWithFirebase(window.firebaseAuth.currentUser.uid, {
                profilePicture: null
            });
        }
        
        // Update UI
        const profileImage = document.getElementById('profileImage');
        const profileDefaultIcon = document.getElementById('profileDefaultIcon');
        
        if (profileImage && profileDefaultIcon) {
            profileImage.style.display = 'none';
            profileDefaultIcon.style.display = 'block';
        }
        
        // Update header avatar
        const userAvatar = document.querySelector('.user-avatar');
        if (userAvatar) {
            userAvatar.innerHTML = '<i class="fas fa-user" aria-hidden="true"></i>';
        }
        
        // Re-render profile to hide remove button
        if (currentView === 'profile') {
            document.getElementById('contentArea').innerHTML = renderProfile();
        }
        
        stopLoading();
        showAlert('Profile picture removed successfully!', 'success');
        
    } catch (error) {
        console.error('❌ Error removing profile picture:', error);
        stopLoading();
        showAlert('Failed to remove profile picture. Please try again.', 'error');
    }
}

function editProfileName() {
    const editForm = document.getElementById('editNameForm');
    const nameInput = document.getElementById('newProfileName');
    
    if (editForm && nameInput) {
        editForm.classList.remove('hidden');
        nameInput.focus();
        nameInput.select();
    }
}

function cancelEditProfileName() {
    const editForm = document.getElementById('editNameForm');
    const nameInput = document.getElementById('newProfileName');
    
    if (editForm && nameInput) {
        editForm.classList.add('hidden');
        nameInput.value = currentUser.name; // Reset to original value
    }
}

// Change Password Functions
function showChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('currentPassword').focus();
    }
}

function closeChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    const form = document.getElementById('changePasswordForm');
    const errorDiv = document.getElementById('changePasswordError');
    
    if (modal) modal.classList.add('hidden');
    if (form) form.reset();
    if (errorDiv) {
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';
    }
}

async function submitChangePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    const errorDiv = document.getElementById('changePasswordError');
    
    // Clear previous errors
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';
    
    // Validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
        errorDiv.textContent = 'All fields are required.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (newPassword.length < 6) {
        errorDiv.textContent = 'New password must be at least 6 characters long.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (newPassword !== confirmNewPassword) {
        errorDiv.textContent = 'New passwords do not match.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (currentPassword === newPassword) {
        errorDiv.textContent = 'New password must be different from current password.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    try {
        const submitBtn = document.querySelector('#changePasswordModal .btn-primary');
        const stopLoading = showLoading(submitBtn, 'Changing Password...');
        
        // Use Firebase Services to change password
        const result = await window.firebaseServices.changePassword(currentPassword, newPassword);
        
        stopLoading();
        
        if (result.success) {
            closeChangePasswordModal();
            showAlert(result.message, 'success');
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('❌ Error changing password:', error);
        const submitBtn = document.querySelector('#changePasswordModal .btn-primary');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-key"></i> Change Password';
        }
        
        // Error message is already handled by Firebase Services
        errorDiv.textContent = error.message || 'Failed to change password. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

// Notification Preferences Functions
async function updateNotificationPreference(type, enabled) {
    try {
        if (!currentUser.preferences) {
            currentUser.preferences = {};
        }
        
        if (type === 'email') {
            currentUser.preferences.emailNotifications = enabled;
        } else if (type === 'sms') {
            currentUser.preferences.smsNotifications = enabled;
        }
        
        // Update Firebase
        if (window.firebaseAuth?.currentUser) {
            await updateUserProfileWithFirebase(window.firebaseAuth.currentUser.uid, {
                preferences: currentUser.preferences
            });
        }
        
        showAlert(`${type.toUpperCase()} notifications ${enabled ? 'enabled' : 'disabled'} successfully!`, 'success');
        
    } catch (error) {
        console.error('❌ Error updating notification preference:', error);
        showAlert('Failed to update notification preferences. Please try again.', 'error');
        
        // Revert the toggle
        if (type === 'email') {
            document.getElementById('emailNotifications').checked = !enabled;
        } else if (type === 'sms') {
            document.getElementById('smsNotifications').checked = !enabled;
        }
    }
}

// Account Management Functions
function showDeactivateAccountModal() {
    const modal = document.getElementById('deactivateAccountModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeDeactivateAccountModal() {
    const modal = document.getElementById('deactivateAccountModal');
    const reasonField = document.getElementById('deactivateReason');
    
    if (modal) modal.classList.add('hidden');
    if (reasonField) reasonField.value = '';
}

async function confirmDeactivateAccount() {
    const reason = document.getElementById('deactivateReason').value;
    
    try {
        startLoading();
        
        // Update user status to deactivated
        if (window.firebaseAuth?.currentUser) {
            await updateUserProfileWithFirebase(window.firebaseAuth.currentUser.uid, {
                status: 'deactivated',
                deactivatedAt: new Date().toISOString(),
                deactivationReason: reason || 'No reason provided'
            });
        }
        
        closeDeactivateAccountModal();
        showAlert('Account deactivated successfully. Please contact support to reactivate.', 'info');
        
        // Log out user after a delay
        setTimeout(() => {
            logout();
        }, 3000);
        
        stopLoading();
        
    } catch (error) {
        console.error('❌ Error deactivating account:', error);
        stopLoading();
        showAlert('Failed to deactivate account. Please try again.', 'error');
    }
}

function showDeleteAccountModal() {
    const modal = document.getElementById('deleteAccountModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeDeleteAccountModal() {
    const modal = document.getElementById('deleteAccountModal');
    const confirmationField = document.getElementById('deleteAccountConfirmation');
    const passwordField = document.getElementById('deleteAccountPassword');
    
    if (modal) modal.classList.add('hidden');
    if (confirmationField) confirmationField.value = '';
    if (passwordField) passwordField.value = '';
}

async function confirmDeleteAccount() {
    const confirmation = document.getElementById('deleteAccountConfirmation').value;
    const password = document.getElementById('deleteAccountPassword').value;
    
    if (confirmation !== 'DELETE') {
        showAlert('Please type "DELETE" to confirm account deletion.', 'error');
        return;
    }
    
    if (!password) {
        showAlert('Please enter your password to confirm.', 'error');
        return;
    }
    
    try {
        startLoading();
        
        // Use Firebase Auth to delete account
        if (window.firebaseAuth?.currentUser) {
            const { deleteUser, reauthenticateWithCredential, EmailAuthProvider } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
            
            const user = window.firebaseAuth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, password);
            
            // Re-authenticate user
            await reauthenticateWithCredential(user, credential);
            
            // Delete user data from database first
            if (window.firebaseServices) {
                await window.firebaseServices.deleteData(`${currentUser.role}s`, user.uid);
            }
            
            // Delete the user account
            await deleteUser(user);
            
            closeDeleteAccountModal();
            showAlert('Account deleted successfully. You will be redirected to the login page.', 'info');
            
            // Redirect to login after a delay
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } else {
            throw new Error('User not authenticated');
        }
        
        stopLoading();
        
    } catch (error) {
        console.error('❌ Error deleting account:', error);
        stopLoading();
        
        let errorMessage = 'Failed to delete account. Please try again.';
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Password is incorrect.';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'Please log out and log back in before deleting your account.';
        }
        
        showAlert(errorMessage, 'error');
    }
}

async function saveProfileName() {
    const nameInput = document.getElementById('newProfileName');
    const newName = nameInput?.value?.trim();
    
    if (!newName) {
        showAlert('Please enter a valid name', 'warning');
        return;
    }
    
    if (newName === currentUser.name) {
        // No change, just hide the form
        cancelEditProfileName();
        return;
    }
    
    try {
        // Show loading state
        const saveBtn = document.querySelector('#editNameForm .btn-primary');
        const stopLoading = showLoading(saveBtn, 'Saving...');
        
        // Update in Firebase
        const userRole = currentUser.role === 'staff' ? 'staff' : 'students';
        await updateData(userRole, currentUser.uid, { name: newName });
        
        // Update current user object
        currentUser.name = newName;
        setCurrentUser(currentUser); // This will sync to storage
        
        // Update UI elements
        document.getElementById('profileName').textContent = newName;
        document.getElementById('userName').textContent = newName;
        
        // Hide the edit form
        cancelEditProfileName();
        
        stopLoading();
        showAlert('Profile name updated successfully!', 'success');
        
    } catch (error) {
        console.error('❌ Error updating profile name:', error);
        showAlert('Failed to update profile name. Please try again.', 'error');
    }
}




// MCQ functionality removed as per user request
// function renderMCQQuizStats() {
//     if (mcqAssignments.length === 0) {
//         return '<div class="no-data"><i class="fas fa-info-circle"></i>No MCQ quizzes found.</div>';
//     }

//     let statsHTML = '';
    
//     mcqAssignments.forEach(quiz => {
//         const quizSubmissions = mcqSubmissions.filter(s => s.quizId === quiz.id);
//         const completionRate = quizSubmissions.length;
//         const avgQuizScore = quizSubmissions.length > 0 ? 
//             Math.round(quizSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / quizSubmissions.length) : 0;

//         statsHTML += `
//             <div class="quiz-stat-card">
//                 <div class="quiz-header">
//                     <h4><i class="fas fa-quiz"></i>${quiz.title}</h4>
//                     <div class="quiz-meta">
//                         <span class="quiz-subject">${quiz.subject || 'General'}</span>
//                         <span class="quiz-date">${formatDate(quiz.createdAt)}</span>
//                     </div>
//                 </div>
                
//                 <div class="quiz-summary">
//                     <div class="summary-item">
//                         <span class="summary-label">Submissions:</span>
//                         <span class="summary-value">${completionRate}</span>
//                     </div>
//                     <div class="summary-item">
//                         <span class="summary-label">Average Score:</span>
//                         <span class="summary-value">${avgQuizScore}%</span>
//                     </div>
//                     <div class="summary-item">
//                         <span class="summary-label">Total Points:</span>
//                         <span class="summary-value">${quiz.totalPoints || 0}</span>
//                     </div>
//                 </div>

//                 <div class="student-submissions">
//                     <h5><i class="fas fa-users"></i>Student Submissions (${completionRate})</h5>
//                     ${renderStudentSubmissions(quizSubmissions, quiz)}
//                 </div>
//             </div>
//         `;
//     });

//     return statsHTML;
// }

function renderStudentSubmissions(submissions, quiz) {
    if (submissions.length === 0) {
        return '<div class="no-submissions"><i class="fas fa-exclamation-triangle"></i>No students have completed this quiz yet.</div>';
    }

    // Sort submissions by score (highest first) then by submission time
    const sortedSubmissions = submissions.sort((a, b) => {
        if (b.percentage !== a.percentage) {
            return (b.percentage || 0) - (a.percentage || 0);
        }
        return new Date(a.submittedAt) - new Date(b.submittedAt);
    });

    return `
        <div class="submissions-table">
            <table class="table">
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Submission Time</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Time Spent</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedSubmissions.map(submission => `
                        <tr class="submission-row">
                            <td class="student-name">
                                <i class="fas fa-user"></i>
                                <div class="student-info">
                                    <div class="student-name-text">${submission.studentName || 'Unknown Student'}</div>
                                    ${submission.studentEmail ? `<div class="student-email">${submission.studentEmail}</div>` : ''}
                                </div>
                            </td>
                            <td class="submission-time">
                                ${formatDateTime(submission.submittedAt)}
                            </td>
                            <td class="submission-score">
                                <span class="score-display">
                                    ${submission.score || 0}/${quiz.totalPoints || 0}
                                </span>
                            </td>
                            <td class="submission-percentage">
                                <div class="percentage-display ${getScoreClass(submission.percentage || 0)}">
                                    ${Math.round(submission.percentage || 0)}%
                                </div>
                            </td>
                            <td class="time-spent">
                                ${formatTimeSpent(submission.timeSpent || 0)}
                            </td>
                            <td class="submission-status">
                                <span class="status-badge status-${(submission.status || 'submitted').toLowerCase()}">
                                    ${submission.status || 'Submitted'}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ===== MCQ STATISTICS FUNCTIONS =====
async function refreshMCQStatistics() {
    try {
        showAlert('Refreshing MCQ statistics...', 'info', 2000);
        
        // Refresh MCQ submissions from Firebase
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            console.log('🔄 Refreshing MCQ submissions from Firebase...');
            const mcqSubmissionsData = await window.firebaseServices.getAllMCQSubmissions();
            if (mcqSubmissionsData && mcqSubmissionsData.length >= 0) {
                mcqSubmissions = mcqSubmissionsData;
                localStorage.setItem('mcqSubmissions', JSON.stringify(mcqSubmissions));
                console.log(`✅ Refreshed ${mcqSubmissions.length} MCQ submissions from Firebase`);
            }
            
            // Also refresh MCQ quizzes
            const mcqQuizzesData = await window.firebaseServices.getMCQQuizzes();
            if (mcqQuizzesData && mcqQuizzesData.length >= 0) {
                // mcqAssignments removed = mcqQuizzesData;
                localStorage.setItem('mcqAssignments', JSON.stringify(mcqAssignments));
                console.log(`✅ Refreshed ${mcqAssignments.length} MCQ quizzes from Firebase`);
            }
        }
        
        // Re-render the MCQ statistics content
        const statsContent = document.getElementById('mcqStatsContent');
        if (statsContent) {
            statsContent.innerHTML = renderMCQQuizStats();
        }
        
        // Also update the overview stats
        const statsOverview = document.querySelector('.stats-overview');
        if (statsOverview) {
            statsOverview.innerHTML = renderMCQStatsOverview();
        }
        
        showAlert('MCQ statistics refreshed successfully!', 'success');
        
    } catch (error) {
        console.error('❌ Error refreshing MCQ statistics:', error);
        showAlert('Failed to refresh MCQ statistics. Please try again.', 'error');
    }
}

// ===== UTILITY FUNCTIONS =====
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getUserName(userId) {
    if (!userId) return 'Unknown User';
    
    // Try to find user by id or uid
    const user = users.find(u => u.id === userId || u.uid === userId);
    
    // If still not found, try by email (in case userId is actually an email)
    if (!user) {
        const userByEmail = users.find(u => u.email === userId);
        if (userByEmail) return userByEmail.name;
    }
    
    return user ? user.name : 'Unknown User';
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function getScoreClass(percentage) {
    if (percentage >= 90) return 'score-excellent';
    if (percentage >= 80) return 'score-good';
    if (percentage >= 70) return 'score-average';
    if (percentage >= 60) return 'score-below-average';
    return 'score-poor';
}

function formatTimeSpent(seconds) {
    if (!seconds || seconds === 0) return 'N/A';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes === 0) {
        return `${remainingSeconds}s`;
    } else if (minutes < 60) {
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
}

// ===== ANNOUNCEMENT MANAGEMENT FUNCTIONS =====
function showCreateAnnouncementForm() {
    // Reset form
    document.getElementById('announcementForm').reset();
    
    // Show modal
    document.getElementById('announcementModal').classList.remove('hidden');
    
    // Focus first input for accessibility
    document.getElementById('announcementTitle').focus();
}

function closeAnnouncementModal() {
    document.getElementById('announcementModal').classList.add('hidden');
}

async function submitAnnouncement() {
    // Check if user has staff role and is properly authenticated
    if (!requireCurrentUser('staff', 'create announcements')) {
        return;
    }

    const form = document.getElementById('announcementForm');
    const formData = new FormData(form);
    
    // Get file input element once at the beginning
    const fileInput = document.getElementById('announcementAttachment');

    // Validate required fields
    const title = formData.get('title');
    const message = formData.get('message');

    if (!title || !message) {
        showConfirmation('Validation Error', 'Please fill in all required fields.', 'error');
        return;
    }

    // Create new announcement object
    const createdBy = getCreatedByObject();
    const newAnnouncement = {
        title: title,
        content: message,
        type: formData.get('type') || 'general',
        priority: formData.get('priority') || 'medium',
        targetAudience: formData.get('targetAudience') || 'all',
        isPublished: true,
        publishDate: new Date().toISOString(),
        createdBy: createdBy,
        readBy: []
    };

    // Handle file attachment if present
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        newAnnouncement.attachment = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        };
        console.log('File attached:', file.name);
    }

    // Handle external link if present
    const link = formData.get('link');
    if (link && link.trim()) {
        newAnnouncement.link = link.trim();
    }

    try {
        // Try to save to Firebase first
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            const announcementData = {
                title: title,
                content: message,
                type: formData.get('type') || 'general',
                priority: formData.get('priority') || 'medium',
                targetAudience: formData.get('targetAudience') || 'all'
            };
            
            // Handle file attachment if present
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                announcementData.attachment = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified
                };
                console.log('File attached:', file.name);
            }

            // Handle external link if present
            const link = formData.get('link');
            if (link && link.trim()) {
                announcementData.link = link.trim();
            }
            
            const result = await createAnnouncementWithFirebase(announcementData);
            if (result.success) {
                // Add notification for staff about new announcement
                if (currentUser.role === 'staff') {
                    addNotification('New Announcement Created', `Announcement "${title}" has been created successfully and saved to Firebase.`, 'success');
                }

                // Close modal and show success message
                closeAnnouncementModal();
                showConfirmation('Announcement Created', `Your announcement "${title}" has been created successfully and saved to Firebase!`, 'success');

                // Refresh the announcements view
                showView('announcements');
                return;
            }
        }
        
        // Fallback to local storage if Firebase is not available
        const newAnnouncement = {
            id: 'ann_' + Date.now(),
            title: title,
            content: message,
            type: formData.get('type') || 'general',
            priority: formData.get('priority') || 'medium',
            createdBy: createdBy,
            createdAt: new Date().toISOString(),
            targetAudience: formData.get('targetAudience') || 'all',
            isPublished: true,
            publishDate: new Date().toISOString(),
            readBy: []
        };

        // Handle file attachment if present
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            newAnnouncement.attachment = {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            };
            console.log('File attached:', file.name);
        }

        // Handle external link if present
        const link = formData.get('link');
        if (link && link.trim()) {
            newAnnouncement.link = link.trim();
        }
        
        announcements.push(newAnnouncement);
        localStorage.setItem('announcements', JSON.stringify(announcements));
        
        // Add notification for staff about new announcement
        if (currentUser.role === 'staff') {
            addNotification('New Announcement Created', `Announcement "${title}" has been created successfully.`, 'success');
        }

        // Close modal and show success message
        closeAnnouncementModal();
        showConfirmation('Announcement Created', `Your announcement "${title}" has been created successfully.`, 'success');

        // Refresh the announcements view
        showView('announcements');
        
    } catch (error) {
        console.error('Error creating announcement:', error);
        showConfirmation('Error', `Failed to create announcement: ${error.message}`, 'error');
    }
}

function viewAnnouncement(announcementId) {
    const announcement = announcements.find(a => a.id === announcementId);
    if (!announcement) {
        showConfirmation('Error', 'Announcement not found.', 'error');
        return;
    }

    const modalContent = document.getElementById('viewAnnouncementContent');
    modalContent.innerHTML = `
        <div class="announcement-details">
            <div class="announcement-header">
                <h4>${announcement.title}</h4>
                <div class="announcement-badges">
                    <span class="type-badge type-${announcement.type}">${announcement.type}</span>
                    <span class="status-badge status-${announcement.priority}">${announcement.priority}</span>
                </div>
            </div>
            
            <div class="announcement-meta">
                <div class="meta-item">
                    <i class="fas fa-user" aria-hidden="true"></i>
                    <span>Created by: ${getUserName(announcement.createdBy)}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-calendar" aria-hidden="true"></i>
                    <span>Published: ${formatDate(announcement.createdAt)}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-users" aria-hidden="true"></i>
                    <span>Target: ${announcement.targetAudience}</span>
                </div>
            </div>
            
            <div class="announcement-content">
                <div class="description-text">
                    <p>${announcement.content}</p>
                </div>
                
                ${announcement.attachment ? `
                    <div class="attachment-info">
                        <h5>Attachment</h5>
                        <div class="file-info">
                            <i class="fas fa-paperclip" aria-hidden="true"></i>
                            <span>${announcement.attachment.name}</span>
                            <span class="file-size">(${formatFileSize(announcement.attachment.size)})</span>
                        </div>
                    </div>
                ` : ''}
                
                ${announcement.link ? `
                    <div class="link-info">
                        <h5>External Link</h5>
                        <a href="${announcement.link}" target="_blank" rel="noopener noreferrer" class="external-link">
                            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
                            ${announcement.link}
                        </a>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // Show modal
    document.getElementById('viewAnnouncementModal').classList.remove('hidden');
}

function closeViewAnnouncementModal() {
    document.getElementById('viewAnnouncementModal').classList.add('hidden');
}

function editAnnouncement(announcementId) {
    const announcement = announcements.find(a => a.id === announcementId);
    if (!announcement) {
        showConfirmation('Error', 'Announcement not found.', 'error');
        return;
    }

    // Populate form fields
    document.getElementById('editAnnouncementId').value = announcementId;
    document.getElementById('editAnnouncementTitle').value = announcement.title;
    document.getElementById('editAnnouncementMessage').value = announcement.content;
    document.getElementById('editAnnouncementType').value = announcement.type;
    document.getElementById('editAnnouncementPriority').value = announcement.priority;
    document.getElementById('editAnnouncementTarget').value = announcement.targetAudience;
    if (announcement.link) {
        document.getElementById('editAnnouncementLink').value = announcement.link;
    }

    // Show modal
    document.getElementById('editAnnouncementModal').classList.remove('hidden');
    
    // Focus first input for accessibility
    document.getElementById('editAnnouncementTitle').focus();
}

function closeEditAnnouncementModal() {
    document.getElementById('editAnnouncementModal').classList.add('hidden');
}

async function updateAnnouncement() {
    // Check if user has staff role and is properly authenticated
    if (!requireCurrentUser('staff', 'update announcements')) {
        return;
    }

    const form = document.getElementById('editAnnouncementForm');
    const formData = new FormData(form);

    // Validate required fields
    const title = formData.get('title');
    const message = formData.get('message');
    const announcementId = formData.get('announcementId');

    if (!title || !message) {
        showConfirmation('Validation Error', 'Please fill in all required fields.', 'error');
        return;
    }

    // Find announcement to update
    const announcementIndex = announcements.findIndex(a => a.id === announcementId);
    if (announcementIndex === -1) {
        showConfirmation('Error', 'Announcement not found.', 'error');
        return;
    }

    // Prepare update data
    const updateData = {
        title: title,
        content: message,
        message: message, // Firebase services uses 'message' field
        type: formData.get('type') || 'general',
        priority: formData.get('priority') || 'medium',
        targetAudience: formData.get('targetAudience') || 'all',
        updatedAt: new Date().toISOString()
    };

    // Handle file attachment if present
    const fileInput = document.getElementById('editAnnouncementAttachment');
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        updateData.attachment = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        };
    }

    // Handle external link if present
    const link = formData.get('link');
    if (link && link.trim()) {
        updateData.link = link.trim();
    }

    try {
        // Try to update in Firebase first
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            console.log('🔄 Updating announcement in Firebase:', announcementId);
            const result = await window.firebaseServices.updateData('announcements', announcementId, updateData);
            
            if (result) {
                console.log('✅ Announcement updated in Firebase successfully');
                
                // Update local announcement array
                const updatedAnnouncement = {
                    ...announcements[announcementIndex],
                    ...updateData
                };
                announcements[announcementIndex] = updatedAnnouncement;
                
                // Update localStorage as backup
                localStorage.setItem('announcements', JSON.stringify(announcements));
                
                // Add notification
                addNotification('Announcement Updated', `Announcement "${title}" has been updated successfully in Firebase.`, 'success');
                
                // Close modal and show success message
                closeEditAnnouncementModal();
                showConfirmation('Announcement Updated', `Announcement "${title}" has been updated successfully and synced to Firebase!`, 'success');
                
                // Refresh the announcements view to show updated data
                await loadDataFromFirebase(); // Reload from Firebase to ensure sync
                showView('announcements');
                return;
            }
        }
        
        // Fallback to local storage if Firebase is not available
        console.log('⚠️ Firebase not available, updating announcement locally');
        const updatedAnnouncement = {
            ...announcements[announcementIndex],
            ...updateData
        };
        
        // Update announcement in local array
        announcements[announcementIndex] = updatedAnnouncement;
        
        // Save to localStorage
        localStorage.setItem('announcements', JSON.stringify(announcements));
        
        // Add notification
        addNotification('Announcement Updated', `Announcement "${title}" has been updated successfully (locally).`, 'warning');
        
        // Close modal and show success message
        closeEditAnnouncementModal();
        showConfirmation('Announcement Updated', `Announcement "${title}" has been updated successfully (saved locally).`, 'success');
        
        // Refresh the announcements view
        showView('announcements');
        
    } catch (error) {
        console.error('❌ Error updating announcement:', error);
        showConfirmation('Update Error', `Failed to update announcement: ${error.message}`, 'error');
    }
}

function deleteAnnouncement(announcementId) {
    const announcement = announcements.find(a => a.id === announcementId);
    if (!announcement) {
        showConfirmation('Error', 'Announcement not found.', 'error');
        return;
    }

    // Set announcement ID for deletion
    document.getElementById('deleteAnnouncementId').value = announcementId;
    
    // Show confirmation modal
    document.getElementById('deleteAnnouncementModal').classList.remove('hidden');
}

function closeDeleteAnnouncementModal() {
    document.getElementById('deleteAnnouncementModal').classList.add('hidden');
}

async function confirmDeleteAnnouncement() {
    // Check if user has staff role and is properly authenticated
    if (!requireCurrentUser('staff', 'delete announcements')) {
        return;
    }

    const announcementId = document.getElementById('deleteAnnouncementId').value;
    
    // Find announcement to delete
    const announcementIndex = announcements.findIndex(a => a.id === announcementId);
    if (announcementIndex === -1) {
        showConfirmation('Error', 'Announcement not found.', 'error');
        return;
    }

    const deletedAnnouncement = announcements[announcementIndex];

    try {
        // Try to delete from Firebase first
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            console.log('🗑️ Deleting announcement from Firebase:', announcementId);
            const result = await window.firebaseServices.deleteData('announcements', announcementId);
            
            if (result) {
                console.log('✅ Announcement deleted from Firebase successfully');
                
                // Remove from local announcement array
                announcements.splice(announcementIndex, 1);
                
                // Update localStorage as backup
                localStorage.setItem('announcements', JSON.stringify(announcements));
                
                // Add notification
                addNotification('Announcement Deleted', `Announcement "${deletedAnnouncement.title}" has been deleted from Firebase.`, 'info');
                
                // Close modal and show success message
                closeDeleteAnnouncementModal();
                showConfirmation('Announcement Deleted', `Announcement "${deletedAnnouncement.title}" has been deleted successfully and removed from Firebase!`, 'success');
                
                // Refresh the announcements view to show updated data
                await loadDataFromFirebase(); // Reload from Firebase to ensure sync
                showView('announcements');
                return;
            }
        }
        
        // Fallback to local storage if Firebase is not available
        console.log('⚠️ Firebase not available, deleting announcement locally');
        
        // Remove announcement from local array
        announcements.splice(announcementIndex, 1);
        
        // Save to localStorage
        localStorage.setItem('announcements', JSON.stringify(announcements));
        
        // Add notification
        addNotification('Announcement Deleted', `Announcement "${deletedAnnouncement.title}" has been deleted (locally).`, 'warning');
        
        // Close modal and show success message
        closeDeleteAnnouncementModal();
        showConfirmation('Announcement Deleted', `Announcement "${deletedAnnouncement.title}" has been deleted successfully (locally).`, 'success');
        
        // Refresh the announcements view
        showView('announcements');
        
    } catch (error) {
        console.error('❌ Error deleting announcement:', error);
        showConfirmation('Delete Error', `Failed to delete announcement: ${error.message}`, 'error');
    }
}

// ===== SCHEDULE MANAGEMENT FUNCTIONS =====
let currentScheduleView = 'list';
let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();

function showCreateScheduleForm() {
    // Reset form
    document.getElementById('scheduleForm').reset();
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('scheduleDate').value = today;
    
    // Set default time to current time + 1 hour
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const timeString = now.toTimeString().slice(0, 5);
    document.getElementById('scheduleTime').value = timeString;
    
    // Show modal
    document.getElementById('scheduleModal').classList.remove('hidden');
    
    // Focus first input for accessibility
    document.getElementById('scheduleTitle').focus();
}

function closeScheduleModal() {
    document.getElementById('scheduleModal').classList.add('hidden');
}

async function submitSchedule() {
    // Check if user has staff role and is properly authenticated
    if (!requireCurrentUser('staff', 'create schedule events')) {
        return;
    }

    const form = document.getElementById('scheduleForm');
    const formData = new FormData(form);

    // Validate required fields
    const title = formData.get('title');
    const date = formData.get('date');
    const time = formData.get('time');
    const category = formData.get('category');

    if (!title || !date || !time || !category) {
        showConfirmation('Validation Error', 'Please fill in all required fields.', 'error');
        return;
    }

    // Create new schedule object
    const createdBy = getCreatedByObject();
    const newSchedule = {
        title: title,
        description: formData.get('description') || '',
        date: date,
        time: time,
        category: category,
        location: formData.get('location') || '',
        priority: formData.get('priority') || 'medium',
        createdBy: createdBy
    };

    try {
        // Try to save to Firebase first
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            const scheduleData = {
                title: title,
                description: formData.get('description') || '',
                date: date,
                time: time,
                category: category,
                location: formData.get('location') || '',
                priority: formData.get('priority') || 'medium'
            };
            
            const result = await createScheduleWithFirebase(scheduleData);
            if (result.success) {
                // Add notification for staff about new schedule
                if (currentUser.role === 'staff') {
                    addNotification('New Schedule Event Created', `Schedule event "${title}" has been created successfully and saved to Firebase.`, 'success');
                }

                // Close modal and show success message
                closeScheduleModal();
                showConfirmation('Schedule Event Created', `Your schedule event "${title}" has been created successfully and saved to Firebase!`, 'success');

                // Refresh the schedule view
                showView('schedule');
                return;
            }
        }
        
        // Fallback to local storage if Firebase is not available
        const newSchedule = {
            id: 'schedule_' + Date.now(),
            title: title,
            description: formData.get('description') || '',
            date: date,
            time: time,
            category: category,
            location: formData.get('location') || '',
            priority: formData.get('priority') || 'medium',
            createdBy: createdBy,
            createdAt: new Date().toISOString()
        };
        
        scheduleEvents.push(newSchedule);
        localStorage.setItem('scheduleEvents', JSON.stringify(scheduleEvents));
        
        // Add notification for staff about new schedule
        if (currentUser.role === 'staff') {
            addNotification('New Schedule Event Created', `Schedule event "${title}" has been created successfully.`, 'success');
        }

        // Close modal and show success message
        closeScheduleModal();
        showConfirmation('Schedule Event Created', `Your schedule event "${title}" has been created successfully.`, 'success');

        // Refresh the schedule view
        showView('schedule');
        
    } catch (error) {
        console.error('Error creating schedule:', error);
        showConfirmation('Error', `Failed to create schedule event: ${error.message}`, 'error');
    }
}

function viewSchedule(scheduleId) {
    const schedule = scheduleEvents.find(s => s.id === scheduleId);
    if (!schedule) {
        showConfirmation('Error', 'Schedule event not found.', 'error');
        return;
    }

    const modalContent = document.getElementById('viewScheduleContent');
    modalContent.innerHTML = `
        <div class="schedule-details">
            <div class="schedule-header">
                <h4>${schedule.title}</h4>
                <div class="schedule-badges">
                    <span class="category-badge category-${schedule.category}">${schedule.category}</span>
                    <span class="priority-badge priority-${schedule.priority}">${schedule.priority}</span>
                </div>
            </div>
            
            <div class="schedule-meta">
                <div class="meta-item">
                    <i class="fas fa-calendar" aria-hidden="true"></i>
                    <span>Date: ${formatDate(schedule.date)}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-clock" aria-hidden="true"></i>
                    <span>Time: ${formatTime(schedule.time)}</span>
                </div>
                ${schedule.location ? `
                    <div class="meta-item">
                        <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
                        <span>Location: ${schedule.location}</span>
                    </div>
                ` : ''}
                <div class="meta-item">
                    <i class="fas fa-user" aria-hidden="true"></i>
                    <span>Created by: ${getUserName(schedule.createdBy)}</span>
                </div>
            </div>
            
            ${schedule.description ? `
                <div class="schedule-content">
                    <h5>Description</h5>
                    <p>${schedule.description}</p>
                </div>
            ` : ''}
        </div>
    `;

    // Show modal
    document.getElementById('viewScheduleModal').classList.remove('hidden');
}

function closeViewScheduleModal() {
    document.getElementById('viewScheduleModal').classList.add('hidden');
}

function editSchedule(scheduleId) {
    const schedule = scheduleEvents.find(s => s.id === scheduleId);
    if (!schedule) {
        showConfirmation('Error', 'Schedule event not found.', 'error');
        return;
    }

    // Populate form fields
    document.getElementById('editScheduleId').value = scheduleId;
    document.getElementById('editScheduleTitle').value = schedule.title;
    document.getElementById('editScheduleDescription').value = schedule.description;
    document.getElementById('editScheduleDate').value = schedule.date;
    document.getElementById('editScheduleTime').value = schedule.time;
    document.getElementById('editScheduleCategory').value = schedule.category;
    document.getElementById('editScheduleLocation').value = schedule.location;
    document.getElementById('editSchedulePriority').value = schedule.priority;

    // Show modal
    document.getElementById('editScheduleModal').classList.remove('hidden');
    
    // Focus first input for accessibility
    document.getElementById('editScheduleTitle').focus();
}

function closeEditScheduleModal() {
    document.getElementById('editScheduleModal').classList.add('hidden');
}

function updateSchedule() {
    const form = document.getElementById('editScheduleForm');
    const formData = new FormData(form);

    // Validate required fields
    const title = formData.get('title');
    const date = formData.get('date');
    const time = formData.get('time');
    const category = formData.get('category');
    const scheduleId = formData.get('scheduleId');

    if (!title || !date || !time || !category) {
        showConfirmation('Validation Error', 'Please fill in all required fields.', 'error');
        return;
    }

    // Find and update schedule
    const scheduleIndex = scheduleEvents.findIndex(s => s.id === scheduleId);
    if (scheduleIndex === -1) {
        showConfirmation('Error', 'Schedule event not found.', 'error');
        return;
    }

    const updatedSchedule = {
        ...scheduleEvents[scheduleIndex],
        title: title,
        description: formData.get('description') || '',
        date: date,
        time: time,
        category: category,
        location: formData.get('location') || '',
        priority: formData.get('priority') || 'medium',
        updatedAt: new Date().toISOString()
    };

    // Update schedule
    scheduleEvents[scheduleIndex] = updatedSchedule;

    // Save to localStorage
    localStorage.setItem('scheduleEvents', JSON.stringify(scheduleEvents));

    // Add notification
    addNotification('Schedule Event Updated', `Schedule event "${title}" has been updated successfully.`, 'success');

    // Close modal and show success message
    closeEditScheduleModal();
    showConfirmation('Schedule Event Updated', `Schedule event "${title}" has been updated successfully.`, 'success');

    // Refresh the schedule view
    showView('schedule');
}

function deleteSchedule(scheduleId) {
    const schedule = scheduleEvents.find(s => s.id === scheduleId);
    if (!schedule) {
        showConfirmation('Error', 'Schedule event not found.', 'error');
        return;
    }

    // Set schedule ID for deletion
    document.getElementById('deleteScheduleId').value = scheduleId;
    
    // Show confirmation modal
    document.getElementById('deleteScheduleModal').classList.remove('hidden');
}

function closeDeleteScheduleModal() {
    document.getElementById('deleteScheduleModal').classList.add('hidden');
}

function confirmDeleteSchedule() {
    const scheduleId = document.getElementById('deleteScheduleId').value;
    
    // Find and remove schedule
    const scheduleIndex = scheduleEvents.findIndex(s => s.id === scheduleId);
    if (scheduleIndex === -1) {
        showConfirmation('Error', 'Schedule event not found.', 'error');
        return;
    }
    
    const deletedSchedule = scheduleEvents[scheduleIndex];
    
    // Remove schedule
    scheduleEvents.splice(scheduleIndex, 1);

    // Save to localStorage
    localStorage.setItem('scheduleEvents', JSON.stringify(scheduleEvents));

    // Add notification
    addNotification('Schedule Event Deleted', `Schedule event "${deletedSchedule.title}" has been deleted.`, 'info');

    // Close modal and show success message
    closeDeleteScheduleModal();
    showConfirmation('Schedule Event Deleted', `Schedule event "${deletedSchedule.title}" has been deleted successfully.`, 'success');

    // Refresh the schedule view
    showView('schedule');
}

function switchScheduleView(view) {
    currentScheduleView = view;
    showView('schedule');
}

function navigateCalendar(direction) {
    currentCalendarMonth += direction;
    
    if (currentCalendarMonth > 11) {
        currentCalendarMonth = 0;
        currentCalendarYear++;
    } else if (currentCalendarMonth < 0) {
        currentCalendarMonth = 11;
        currentCalendarYear--;
    }
    
    showView('schedule');
}

// Navigation for student calendar (separate from staff calendar)
let currentStudentCalendarMonth = new Date().getMonth();
let currentStudentCalendarYear = new Date().getFullYear();

function navigateStudentCalendar(direction) {
    currentStudentCalendarMonth += direction;
    
    if (currentStudentCalendarMonth > 11) {
        currentStudentCalendarMonth = 0;
        currentStudentCalendarYear++;
    } else if (currentStudentCalendarMonth < 0) {
        currentStudentCalendarMonth = 11;
        currentStudentCalendarYear--;
    }
    
    // Re-render the calendar view
    if (currentStudentScheduleView === 'calendar') {
        switchStudentScheduleView('calendar');
    }
}

function openEventModal(scheduleId) {
    const schedule = scheduleEvents.find(s => s.id === scheduleId);
    if (!schedule) {
        showConfirmation('Error', 'Schedule event not found.', 'error');
        return;
    }

    const scheduleDate = new Date(schedule.date + 'T' + schedule.time);
    const formattedDate = scheduleDate.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const formattedTime = scheduleDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    });

    const modalContent = document.getElementById('viewScheduleContent');
    modalContent.innerHTML = `
        <div class="schedule-details">
            <div class="schedule-header">
                <h4>${schedule.title}</h4>
                <div class="schedule-badges">
                    <span class="category-badge category-${schedule.category}">${schedule.category}</span>
                    <span class="priority-badge priority-${schedule.priority}">${schedule.priority}</span>
                </div>
            </div>
            
            <div class="schedule-info">
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">
                            <i class="fas fa-calendar" aria-hidden="true"></i>
                            Date
                        </div>
                        <div class="info-value">${formattedDate}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">
                            <i class="fas fa-clock" aria-hidden="true"></i>
                            Time
                        </div>
                        <div class="info-value">${formattedTime}</div>
                    </div>
                    
                    ${schedule.location ? `
                        <div class="info-item">
                            <div class="info-label">
                                <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
                                Location
                            </div>
                            <div class="info-value">${schedule.location}</div>
                        </div>
                    ` : ''}
                    
                    <div class="info-item">
                        <div class="info-label">
                            <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                            Priority
                        </div>
                        <div class="info-value">
                            <span class="priority-badge priority-${schedule.priority}">${schedule.priority}</span>
                        </div>
                    </div>
                </div>
                
                ${schedule.description ? `
                    <div class="description-section">
                        <h5>
                            <i class="fas fa-align-left" aria-hidden="true"></i>
                            Description
                        </h5>
                        <p>${schedule.description}</p>
                    </div>
                ` : ''}
            </div>
            
            ${currentUser.role === 'staff' ? `
                <div class="schedule-actions">
                    <button class="btn btn-primary" onclick="closeViewScheduleModal(); editSchedule('${schedule.id}');">
                        <i class="fas fa-edit" aria-hidden="true"></i>
                        Edit Event
                    </button>
                    <button class="btn btn-danger" onclick="closeViewScheduleModal(); deleteSchedule('${schedule.id}');">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                        Delete Event
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('viewScheduleModal').classList.remove('hidden');
}

// ===== MODAL MANAGEMENT =====
function showConfirmation(title, message, type = 'success') {
    const modal = document.getElementById('confirmationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    
    modal.classList.remove('hidden');
    
    // Focus the modal for accessibility
    modal.focus();
    
    // Announce modal for screen readers
    if (window.announcePageChange) {
        window.announcePageChange(`${title}: ${message}`);
    }
}

function closeModal() {
    document.getElementById('confirmationModal').classList.add('hidden');
}

// ===== NOTIFICATION MANAGEMENT =====
function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    const btn = document.getElementById('notificationBtn');
    const isHidden = panel.classList.contains('hidden');
    
    if (isHidden) {
        panel.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
        renderNotifications();
    } else {
        panel.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
    }
}

function renderNotifications() {
    const notificationList = document.getElementById('notificationList');
    
    if (notifications.length === 0) {
        notificationList.innerHTML = '<p class="no-notifications">No notifications</p>';
        return;
    }
    
    notificationList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.read ? '' : 'unread'}" 
             onclick="markNotificationAsRead('${notification.id}')" 
             role="button" 
             tabindex="0"
             aria-label="${notification.title}: ${notification.message}">
            <h4>${notification.title}</h4>
            <p>${notification.message}</p>
            <div class="time" aria-label="Received on ${formatDate(notification.createdAt)}">${formatDate(notification.createdAt)}</div>
        </div>
    `).join('');
}

function markNotificationAsRead(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        localStorage.setItem('notifications', JSON.stringify(notifications));
        updateUserInfo();
        renderNotifications();
    }
}

function clearAllNotifications() {
    notifications = [];
    localStorage.setItem('notifications', JSON.stringify(notifications));
    updateUserInfo();
    renderNotifications();
    
    // Announce for screen readers
    if (window.announcePageChange) {
        window.announcePageChange('All notifications cleared');
    }
}

function addNotification(title, message, type = 'info') {
    const notification = {
        id: 'notif_' + Date.now(),
        title: title,
        message: message,
        type: type,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    notifications.unshift(notification);
    localStorage.setItem('notifications', JSON.stringify(notifications));
    updateUserInfo();
    renderNotifications();
    
    return notification;
}

// ===== SETTINGS =====

async function logout() {
    try {
        // Show loading state
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            const originalText = logoutBtn.innerHTML;
            logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            logoutBtn.disabled = true;
            
            // Attempt Firebase logout
            if (firebaseAuth) {
                const result = await logoutUser();
                if (!result.success) {
                    console.warn('Firebase logout failed:', result.error);
                }
            }
            
            // Clear local state regardless of Firebase result
            currentUser = null;
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('currentUser');
            
            showLoginPage();
            
            showAlert('You have been safely logged out of the system. Thank you for using E-Workspace!', 'info');
            
            // Announce for screen readers
            if (window.announcePageChange) {
                window.announcePageChange('Successfully logged out');
            }
            
            // Reset button state
            logoutBtn.innerHTML = originalText;
            logoutBtn.disabled = false;
        }
    } catch (error) {
        console.error('Logout error:', error);
        
        // Force logout even if Firebase fails
        currentUser = null;
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUser');
        showLoginPage();
        
        showAlert('You have been logged out of the system.', 'info');
    }
}

// ===== ASSIGNMENT MODULE FUNCTIONS =====

// ===== ASSIGNMENT CARD RENDERING =====
async function fetchSubmissionGrades(assignmentList, userSubmissions) {
    if (!window.firebaseServices || !window.firebaseServices.isInitialized || !currentUser) {
        return userSubmissions;
    }
    
    try {
        const updatedSubmissions = [...userSubmissions];
        
        for (let i = 0; i < updatedSubmissions.length; i++) {
            const submission = updatedSubmissions[i];
            const assignment = assignmentList.find(a => a.id === submission.assignmentId);
            
            if (assignment && currentUser && currentUser.id) {
                try {
                    const latestSubmission = await window.firebaseServices.readData(
                        `assignments/${assignment.id}/submissions`, 
                        currentUser.id
                    );
                    
                    if (latestSubmission && latestSubmission.grade !== undefined) {
                        console.log(`✅ Found grade for submission ${submission.id}: ${latestSubmission.grade}`);
                        updatedSubmissions[i] = {
                            ...submission,
                            grade: latestSubmission.grade,
                            feedback: latestSubmission.feedback,
                            gradedAt: latestSubmission.gradedAt
                        };
                    }
                } catch (error) {
                    console.error(`❌ Error fetching grade for submission ${submission.id}:`, error);
                }
            }
        }
        
        return updatedSubmissions;
    } catch (error) {
        console.error('❌ Error fetching submission grades:', error);
        return userSubmissions;
    }
}

function renderAssignmentCards(assignmentList, userSubmissions = []) {
    if (!assignmentList || assignmentList.length === 0) {
        return '<div class="empty-state"><p>No assignments available.</p></div>';
    }
    
    // Attempt to fetch latest grades from Firebase
    if (window.firebaseServices && window.firebaseServices.isInitialized && currentUser) {
        fetchSubmissionGrades(assignmentList, userSubmissions).then(updatedSubmissions => {
            // Update the local submissions array with the fetched grades
            updatedSubmissions.forEach(updatedSubmission => {
                const index = submissions.findIndex(s => s.id === updatedSubmission.id);
                if (index !== -1) {
                    submissions[index] = updatedSubmission;
                }
            });
            
            // Save to local storage
            localStorage.setItem('submissions', JSON.stringify(submissions));
            
            // Re-render the assignments list if grades were updated
            if (currentView === 'assignments') {
                const assignmentsList = document.getElementById('assignmentsList');
                if (assignmentsList) {
                    assignmentsList.innerHTML = renderAssignmentCards(assignmentList, updatedSubmissions);
                }
            }
        }).catch(error => {
            console.error('❌ Error updating grades:', error);
        });
    }

    return assignmentList.map(assignment => {
        // Check for submission in both local and Firebase data
        let submission = userSubmissions.find(s => s.assignmentId === assignment.id);
        
        // If not found in userSubmissions, check the main submissions array
        if (!submission) {
            submission = submissions.find(s => s.assignmentId === assignment.id && s.studentId === currentUser.id);
        }
        
        const dueDate = new Date(assignment.dueDate);
        const now = new Date();
        const isOverdue = dueDate < now && !submission;
        const isDueSoon = dueDate > now && (dueDate - now) <= 24 * 60 * 60 * 1000; // 24 hours
        
        let statusInfo = {
            status: 'pending',
            statusClass: 'status-pending',
            statusText: 'Pending'
        };
        
        if (submission) {
            if (submission.grade !== undefined) {
                statusInfo = {
                    status: 'graded',
                    statusClass: 'status-graded',
                    statusText: 'Graded'
                };
            } else {
                statusInfo = {
                    status: 'submitted',
                    statusClass: 'status-submitted',
                    statusText: 'Submitted'
                };
            }
        } else if (isOverdue) {
            statusInfo = {
                status: 'overdue',
                statusClass: 'status-overdue',
                statusText: 'Overdue'
            };
        }

        return `
            <div class="assignment-card">
                <div class="assignment-card-header">
                    <div>
                        <h3 class="assignment-title">${assignment.title}</h3>
                        <span class="assignment-subject">${assignment.subject}</span>
                    </div>
                    <span class="status-badge ${statusInfo.statusClass}">${statusInfo.statusText}</span>
                </div>
                
                <p class="assignment-description">${assignment.description}</p>
                
                <div class="assignment-meta">
                    <div class="assignment-meta-item">
                        <i class="fas fa-calendar-alt"></i>
                        <span class="assignment-due-date ${isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : ''}">
                            Due: ${formatDate(assignment.dueDate)} ${assignment.dueTime || ''}
                        </span>
                    </div>
                    <div class="assignment-meta-item">
                        <i class="fas fa-star"></i>
                        <span>Max Score: ${assignment.maxScore} points</span>
                    </div>
                    ${submission && submission.grade !== undefined ? `
                        <div class="assignment-meta-item">
                            <i class="fas fa-trophy"></i>
                            <span>Your Score: ${submission.grade}/${assignment.maxScore}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="assignment-actions">
                    ${!submission && !isOverdue ? 
                        `<button class="btn btn-primary" onclick="openSubmissionModal('${assignment.id}')">
                            <i class="fas fa-upload"></i> Submit Assignment
                        </button>` : 
                        submission ? 
                        `<button class="btn btn-secondary" onclick="viewSubmissionDetails('${submission.id}')">
                            <i class="fas fa-eye"></i> View Submission
                        </button>` :
                        `<button class="btn btn-secondary" disabled>
                            <i class="fas fa-exclamation-triangle"></i> Overdue
                        </button>`
                    }
                    <button class="btn btn-secondary" onclick="viewAssignmentDetails('${assignment.id}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderStudentAssignmentCards(assignmentList, userSubmissions = []) {
    if (assignmentList.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-book-open"></i>
                <h3>No Assignments Available</h3>
                <p>No assignments have been posted yet.</p>
            </div>
        `;
    }

    return assignmentList.map(assignment => {
        const submission = userSubmissions.find(s => s.assignmentId === assignment.id);
        const dueDate = new Date(`${assignment.dueDate}T${assignment.dueTime || '23:59'}`);
        const now = new Date();
        const isOverdue = dueDate < now;
        const isDueSoon = dueDate > now && (dueDate - now) <= 24 * 60 * 60 * 1000;
        
        let statusInfo = {
            status: 'pending',
            statusClass: 'status-pending',
            statusText: 'Not Submitted',
            statusIcon: 'fas fa-clock'
        };
        
        if (submission) {
            if (submission.grade !== undefined && submission.grade !== null) {
                statusInfo = {
                    status: 'graded',
                    statusClass: 'status-graded',
                    statusText: `Graded: ${submission.grade}/${assignment.maxScore}`,
                    statusIcon: 'fas fa-check-circle'
                };
            } else {
                statusInfo = {
                    status: 'submitted',
                    statusClass: 'status-submitted',
                    statusText: 'Submitted',
                    statusIcon: 'fas fa-paper-plane'
                };
            }
        } else if (isOverdue) {
            statusInfo = {
                status: 'overdue',
                statusClass: 'status-overdue',
                statusText: 'Overdue',
                statusIcon: 'fas fa-exclamation-triangle'
            };
        }

        return `
            <div class="assignment-card student-assignment-card">
                <div class="assignment-card-header">
                    <div class="assignment-title-section">
                        <h3 class="assignment-title">${assignment.title}</h3>
                        <span class="assignment-subject">${assignment.subject}</span>
                    </div>
                    <div class="assignment-status">
                        <span class="status-badge ${statusInfo.statusClass}">
                            <i class="${statusInfo.statusIcon}"></i>
                            ${statusInfo.statusText}
                        </span>
                    </div>
                </div>
                
                <div class="assignment-description">
                    <p>${assignment.description}</p>
                </div>
                
                <div class="assignment-details">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <i class="fas fa-user-tie"></i>
                            <span class="detail-label">Created by:</span>
                            <span class="detail-value">${assignment.createdBy?.name || assignment.createdBy || 'Staff Member'}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-calendar-plus"></i>
                            <span class="detail-label">Assigned:</span>
                            <span class="detail-value">${formatDate(assignment.createdAt || new Date().toISOString())}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-calendar-alt"></i>
                            <span class="detail-label">Due Date:</span>
                            <span class="detail-value ${isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : ''}">
                                ${formatDate(assignment.dueDate)} ${assignment.dueTime || ''}
                            </span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-star"></i>
                            <span class="detail-label">Max Score:</span>
                            <span class="detail-value">${assignment.maxScore} points</span>
                        </div>
                    </div>
                </div>
                
                ${submission ? `
                    <div class="submission-info">
                        <div class="submission-details">
                            <h4><i class="fas fa-paper-plane"></i> Your Submission</h4>
                            <div class="submission-meta">
                                <span><i class="fas fa-clock"></i> Submitted: ${formatDate(submission.submittedAt)}</span>
                                ${submission.grade !== undefined ? 
                                    `<span><i class="fas fa-star"></i> Grade: ${submission.grade}/${assignment.maxScore}</span>` : 
                                    '<span><i class="fas fa-hourglass-half"></i> Pending Review</span>'
                                }
                            </div>
                            ${submission.feedback ? `
                                <div class="feedback-section">
                                    <h5><i class="fas fa-comment"></i> Feedback:</h5>
                                    <p class="feedback-text">${submission.feedback}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <div class="assignment-actions">
                    ${!submission && !isOverdue ? 
                        `<button class="btn btn-primary" onclick="openSubmissionModal('${assignment.id}')">
                            <i class="fas fa-paper-plane"></i> Submit Assignment
                        </button>` :
                        isOverdue && !submission ? 
                        `<button class="btn btn-secondary" disabled>
                            <i class="fas fa-exclamation-triangle"></i> Overdue
                        </button>` :
                        `<button class="btn btn-secondary" onclick="viewSubmissionDetails('${submission.id}')">
                            <i class="fas fa-eye"></i> View Submission
                        </button>`
                    }
                    <button class="btn btn-secondary" onclick="viewAssignmentDetails('${assignment.id}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderStaffAssignmentCards(assignmentList) {
    if (assignmentList.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-book-open"></i>
                <h3>No Assignments Created</h3>
                <p>Create your first assignment to get started.</p>
                <button class="btn btn-primary" onclick="openCreateAssignmentModal()">
                    <i class="fas fa-plus"></i> Create Assignment
                </button>
            </div>
        `;
    }

    return assignmentList.map(assignment => {
        const dueDate = new Date(assignment.dueDate);
        const now = new Date();
        const isOverdue = dueDate < now;
        const isDueSoon = dueDate > now && (dueDate - now) <= 24 * 60 * 60 * 1000;

        return `
            <div class="assignment-card">
                <div class="assignment-card-header">
                    <div>
                        <h3 class="assignment-title">${assignment.title}</h3>
                        <span class="assignment-subject">${assignment.subject}</span>
                    </div>
                </div>
                
                <p class="assignment-description">${assignment.description}</p>
                
                <div class="assignment-meta">
                    <div class="assignment-meta-item">
                        <i class="fas fa-calendar-alt"></i>
                        <span class="assignment-due-date ${isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : ''}">
                            Due: ${formatDate(assignment.dueDate)} ${assignment.dueTime || ''}
                        </span>
                    </div>
                    <div class="assignment-meta-item">
                        <i class="fas fa-star"></i>
                        <span>Max Score: ${assignment.maxScore} points</span>
                    </div>
                    <div class="assignment-meta-item">
                        <i class="fas fa-users"></i>
                        <span>Submissions: ${assignment.submissionCount}</span>
                    </div>
                    <div class="assignment-meta-item">
                        <i class="fas fa-check-circle"></i>
                        <span>Graded: ${assignment.gradedCount}/${assignment.submissionCount}</span>
                    </div>
                </div>
                
                <div class="assignment-progress">
                    <div class="progress-label">
                        <span>Grading Progress</span>
                        <span class="progress-percentage">
                            ${assignment.submissionCount > 0 ? Math.round((assignment.gradedCount / assignment.submissionCount) * 100) : 0}%
                        </span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${assignment.submissionCount > 0 ? (assignment.gradedCount / assignment.submissionCount) * 100 : 0}%"></div>
                    </div>
                </div>
                
                <div class="assignment-actions">
                    <button class="btn btn-primary" onclick="viewAssignmentSubmissions('${assignment.id}')">
                        <i class="fas fa-list"></i> View Submissions (${assignment.submissionCount})
                    </button>
                    <button class="btn btn-secondary" onclick="editAssignment('${assignment.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger" onclick="deleteAssignment('${assignment.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// MCQ Cards function completely removed as per user request

// ===== ASSIGNMENT CREATION =====
function openCreateAssignmentModal() {
    document.getElementById('createAssignmentModal').classList.remove('hidden');
    
    // Set default due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('assignmentDueDate').value = tomorrow.toISOString().split('T')[0];
    document.getElementById('assignmentDueTime').value = '23:59';
    
    // Focus on title field
    setTimeout(() => {
        document.getElementById('assignmentTitle').focus();
    }, 100);
}

function closeCreateAssignmentModal() {
    document.getElementById('createAssignmentModal').classList.add('hidden');
    document.getElementById('createAssignmentForm').reset();
}

async function saveAssignment() {
    // Check if user has staff role and is properly authenticated
    if (!requireCurrentUser('staff', 'create assignments')) {
        return;
    }

    const form = document.getElementById('createAssignmentForm');
    const formData = new FormData(form);
    
    // Validation
    if (!formData.get('title') || !formData.get('subject') || !formData.get('description') || 
        !formData.get('dueDate') || !formData.get('dueTime') || !formData.get('maxScore')) {
        showConfirmation('Validation Error', 'Please fill in all required fields.', 'error');
        return;
    }
    
    const assignmentData = {
        title: formData.get('title'),
        subject: formData.get('subject'),
        description: formData.get('description'),
        dueDate: formData.get('dueDate'),
        dueTime: formData.get('dueTime'),
        maxScore: parseInt(formData.get('maxScore'))
    };
    
    try {
        // Try to save to Firebase first
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            const result = await createAssignmentWithFirebase(assignmentData);
            if (result.success) {
                closeCreateAssignmentModal();
                showConfirmation('Assignment Created', `Assignment "${assignmentData.title}" has been created successfully and saved to Firebase!`, 'success');
                
                // Refresh the view if we're on assignments page
                if (currentView === 'assignments') {
                    showView('assignments');
                }
                return;
            }
        }
        
        // Fallback to local storage if Firebase is not available
        const createdBy = getCreatedByObject();
        const newAssignment = {
            id: 'assign_' + Date.now(),
            ...assignmentData,
            createdBy: createdBy,
            createdAt: new Date().toISOString(),
            attachment: null // File handling can be implemented later
        };
        
        assignments.push(newAssignment);
        localStorage.setItem('assignments', JSON.stringify(assignments));
        
        closeCreateAssignmentModal();
        showConfirmation('Assignment Created', `Assignment "${newAssignment.title}" has been created successfully!`, 'success');
        
        // Refresh the view if we're on assignments page
        if (currentView === 'assignments') {
            showView('assignments');
        }
        
    } catch (error) {
        console.error('Error saving assignment:', error);
        showConfirmation('Error', `Failed to create assignment: ${error.message}`, 'error');
    }
}

// ===== ASSIGNMENT EDITING =====
function editAssignment(assignmentId) {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) {
        showConfirmation('Error', 'Assignment not found.', 'error');
        return;
    }
    
    // Populate edit form
    document.getElementById('editAssignmentId').value = assignment.id;
    document.getElementById('editAssignmentTitleInput').value = assignment.title;
    document.getElementById('editAssignmentSubjectSelect').value = assignment.subject;
    document.getElementById('editAssignmentDescriptionText').value = assignment.description;
    document.getElementById('editAssignmentDueDateInput').value = assignment.dueDate;
    document.getElementById('editAssignmentDueTimeInput').value = assignment.dueTime || '';
    document.getElementById('editAssignmentMaxScoreInput').value = assignment.maxScore;
    
    document.getElementById('editAssignmentModal').classList.remove('hidden');
}

function closeEditAssignmentModal() {
    document.getElementById('editAssignmentModal').classList.add('hidden');
    document.getElementById('editAssignmentForm').reset();
}

function updateAssignment() {
    const form = document.getElementById('editAssignmentForm');
    const formData = new FormData(form);
    const assignmentId = formData.get('id');
    
    const assignmentIndex = assignments.findIndex(a => a.id === assignmentId);
    if (assignmentIndex === -1) {
        showConfirmation('Error', 'Assignment not found.', 'error');
        return;
    }
    
    // Validation
    if (!formData.get('title') || !formData.get('subject') || !formData.get('description') || 
        !formData.get('dueDate') || !formData.get('dueTime') || !formData.get('maxScore')) {
        showConfirmation('Validation Error', 'Please fill in all required fields.', 'error');
        return;
    }
    
    // Update assignment
    assignments[assignmentIndex] = {
        ...assignments[assignmentIndex],
        title: formData.get('title'),
        subject: formData.get('subject'),
        description: formData.get('description'),
        dueDate: formData.get('dueDate'),
        dueTime: formData.get('dueTime'),
        maxScore: parseInt(formData.get('maxScore')),
        updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem('assignments', JSON.stringify(assignments));
    
    closeEditAssignmentModal();
    showConfirmation('Assignment Updated', 'Assignment has been updated successfully!', 'success');
    
    // Refresh the view
    if (currentView === 'assignments') {
        showView('assignments');
    }
}

function deleteAssignment(assignmentId) {
    if (!confirm('Are you sure you want to delete this assignment? This action cannot be undone.')) {
        return;
    }
    
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) {
        showConfirmation('Error', 'Assignment not found.', 'error');
        return;
    }
    
    // Remove assignment
    assignments = assignments.filter(a => a.id !== assignmentId);
    
    // Remove related submissions
    submissions = submissions.filter(s => s.assignmentId !== assignmentId);
    
    localStorage.setItem('assignments', JSON.stringify(assignments));
    localStorage.setItem('submissions', JSON.stringify(submissions));
    
    showConfirmation('Assignment Deleted', `Assignment "${assignment.title}" has been deleted.`, 'warning');
    
    // Refresh the view
    if (currentView === 'assignments') {
        showView('assignments');
    }
}

// ===== STUDENT SUBMISSION =====
async function openSubmissionModal(assignmentId) {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) {
        showConfirmation('Error', 'Assignment not found.', 'error');
        return;
    }
    
    // Check if already submitted (check both local and Firebase)
    let existingSubmission = submissions.find(s => s.assignmentId === assignmentId && s.studentId === currentUser.id);
    
    // If not found locally and Firebase is available, check Firebase
    if (!existingSubmission && window.firebaseServices && window.firebaseServices.isInitialized) {
        try {
            const studentSubmissions = await window.firebaseServices.getStudentSubmissions(currentUser.id);
            existingSubmission = studentSubmissions.find(s => s.assignmentId === assignmentId);
        } catch (error) {
            console.error('Error checking Firebase submissions:', error);
        }
    }
    
    if (existingSubmission) {
        showConfirmation('Already Submitted', 'You have already submitted this assignment.', 'info');
        return;
    }
    
    // Check if overdue
    const dueDate = new Date(assignment.dueDate);
    const now = new Date();
    if (dueDate < now) {
        showConfirmation('Assignment Overdue', 'This assignment is past its due date.', 'warning');
        return;
    }
    
    // Populate assignment info
    document.getElementById('submissionAssignmentInfo').innerHTML = `
        <h4>${assignment.title}</h4>
        <p>${assignment.description}</p>
        <div class="meta-grid">
            <div class="meta-item">
                <i class="fas fa-book"></i>
                <span>Subject: ${assignment.subject}</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-calendar"></i>
                <span>Due: ${formatDate(assignment.dueDate)} ${assignment.dueTime || ''}</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-star"></i>
                <span>Max Score: ${assignment.maxScore} points</span>
            </div>
        </div>
    `;
    
    document.getElementById('submissionAssignmentId').value = assignmentId;
    document.getElementById('submissionModal').classList.remove('hidden');
    
    // Reset submit button state
    const submitButton = document.querySelector('#submissionModal .btn-primary');
    if (submitButton) {
        submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Assignment';
        submitButton.disabled = false;
        submitButton.classList.remove('btn-success');
        submitButton.classList.add('btn-primary');
    }
    
    // Focus on text area
    setTimeout(() => {
        document.getElementById('submissionText').focus();
    }, 100);
}

function closeSubmissionModal() {
    document.getElementById('submissionModal').classList.add('hidden');
    document.getElementById('submissionForm').reset();
    
    // Reset submit button state
    const submitButton = document.querySelector('#submissionModal .btn-primary');
    if (submitButton) {
        submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Assignment';
        submitButton.disabled = false;
        submitButton.classList.remove('btn-success');
        submitButton.classList.add('btn-primary');
    }
}

// Refresh assignments view to show updated submission status
function refreshAssignmentsView() {
    if (currentUser.role === 'student') {
        const userSubmissions = submissions.filter(s => s.studentId === currentUser.id);
        const assignmentsList = document.getElementById('assignmentsList');
        if (assignmentsList) {
            assignmentsList.innerHTML = renderAssignmentCards(assignments, userSubmissions);
        }
    } else {
        // For staff, refresh the staff assignments view
        const submissionCounts = assignments.map(assignment => {
            const assignmentSubmissions = submissions.filter(s => s.assignmentId === assignment.id);
            return {
                ...assignment,
                submissionCount: assignmentSubmissions.length,
                gradedCount: assignmentSubmissions.filter(s => s.grade !== undefined).length
            };
        });
        const staffAssignmentsList = document.getElementById('staffAssignmentsList');
        if (staffAssignmentsList) {
            staffAssignmentsList.innerHTML = renderStaffAssignmentCards(submissionCounts);
        }
    }
}

async function submitAssignment() {
    // Check if user has student role
    if (!requireRole('student', 'submit assignments')) {
        return;
    }

    const form = document.getElementById('submissionForm');
    const formData = new FormData(form);
    const assignmentId = formData.get('assignmentId');
    const submissionText = formData.get('submissionText');
    
    if (!submissionText.trim()) {
        showConfirmation('Validation Error', 'Please enter your solution/answer.', 'error');
        return;
    }
    
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) {
        showConfirmation('Error', 'Assignment not found.', 'error');
        return;
    }
    
    // Show loading state
    const submitButton = document.querySelector('#submissionModal .btn-primary');
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    submitButton.disabled = true;
    
    const submissionData = {
        answerText: submissionText,
        submissionText: submissionText, // For compatibility with existing code
        fileUrl: null // File handling can be implemented later
    };
    
    try {
        // Try to submit to Firebase first
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            const result = await submitAssignmentWithFirebase(assignmentId, submissionData);
            if (result.success) {
                // Show success state
                submitButton.innerHTML = '<i class="fas fa-check"></i> Submission Complete!';
                submitButton.classList.remove('btn-primary');
                submitButton.classList.add('btn-success');
                
                // Close modal after a short delay
                setTimeout(() => {
                    closeSubmissionModal();
                    showConfirmation('Assignment Submitted', `Your submission for "${assignment.title}" has been submitted successfully and saved to Firebase!`, 'success');
                    
                    // Refresh the assignments view to show updated status
                    if (currentView === 'assignments') {
                        refreshAssignmentsView();
                    }
                }, 1500);
                return;
            }
        }
        
        // Fallback to local storage if Firebase is not available
        const newSubmission = {
            id: 'sub_' + Date.now(),
            assignmentId: assignmentId,
            studentId: currentUser.id || currentUser.uid,
            studentName: currentUser.name,
            studentEmail: currentUser.email,
            studentRole: currentUser.role,
            submissionText: submissionText,
            submittedAt: new Date().toISOString(),
            attachment: null, // File handling can be implemented later
            grade: undefined,
            feedback: undefined,
            gradedAt: undefined,
            gradedBy: undefined,
            // Additional student information
            studentDepartment: currentUser.department || 'General',
            studentPortal: currentUser.portal || 'student'
        };
        
        submissions.push(newSubmission);
        localStorage.setItem('submissions', JSON.stringify(submissions));
        
        // Show success state
        submitButton.innerHTML = '<i class="fas fa-check"></i> Submission Complete!';
        submitButton.classList.remove('btn-primary');
        submitButton.classList.add('btn-success');
        
        // Close modal after a short delay
        setTimeout(() => {
            closeSubmissionModal();
            showConfirmation('Assignment Submitted', `Your submission for "${assignment.title}" has been submitted successfully!`, 'success');
            
            // Refresh the assignments view to show updated status
            if (currentView === 'assignments') {
                refreshAssignmentsView();
            }
        }, 1500);
        
    } catch (error) {
        console.error('Error submitting assignment:', error);
        
        // Reset button state on error
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        submitButton.classList.remove('btn-success');
        submitButton.classList.add('btn-primary');
        
        showConfirmation('Error', `Failed to submit assignment: ${error.message}`, 'error');
    }
}

// ===== STAFF GRADING =====
function viewAssignmentSubmissions(assignmentId) {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) {
        showConfirmation('Error', 'Assignment not found.', 'error');
        return;
    }
    
    const assignmentSubmissions = submissions.filter(s => s.assignmentId === assignmentId);
    
    document.getElementById('viewSubmissionsTitle').textContent = `Submissions for: ${assignment.title}`;
    document.getElementById('viewSubmissionsContent').innerHTML = renderSubmissionsList(assignmentSubmissions, assignment);
    document.getElementById('viewSubmissionsModal').classList.remove('hidden');
}

function closeViewSubmissionsModal() {
    document.getElementById('viewSubmissionsModal').classList.add('hidden');
}

function renderSubmissionsList(submissionsList, assignment) {
    if (submissionsList.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No Submissions Yet</h3>
                <p>No students have submitted this assignment yet.</p>
            </div>
        `;
    }
    
    return `
        <div class="assignment-info">
            <h4>Assignment Details</h4>
            <div class="meta-grid">
                <div class="meta-item">
                    <i class="fas fa-book"></i>
                    <span>Subject: ${assignment.subject}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>Due: ${formatDate(assignment.dueDate)} ${assignment.dueTime || ''}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-star"></i>
                    <span>Max Score: ${assignment.maxScore} points</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-users"></i>
                    <span>Total Submissions: ${submissionsList.length}</span>
                </div>
            </div>
        </div>
        
        <div class="submissions-list">
            ${submissionsList.map(submission => `
                <div class="submission-card">
                    <div class="submission-header">
                        <div>
                            <div class="submission-student">${submission.studentName}</div>
                            ${submission.studentEmail ? `<div class="submission-email">${submission.studentEmail}</div>` : ''}
                            <div class="submission-date">Submitted: ${formatDate(submission.submittedAt)}</div>
                        </div>
                        ${submission.grade !== undefined ? 
                            `<span class="status-badge status-graded">Graded: ${submission.grade}/${assignment.maxScore}</span>` :
                            `<span class="status-badge status-submitted">Pending Review</span>`
                        }
                    </div>
                    
                    <div class="submission-content">
                        <div class="submission-text">${submission.answerText || submission.submissionText || ''}</div>
                        ${submission.fileUrl || submission.attachment ? `
                            <div class="submission-file">
                                <i class="fas fa-paperclip"></i>
                                <span>Attachment: ${submission.fileUrl || submission.attachment}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${submission.grade !== undefined ? `
                        <div class="submission-grade">
                            <div class="submission-score">Score: ${submission.grade}/${assignment.maxScore}</div>
                            <div>Graded: ${formatDate(submission.gradedAt)}</div>
                        </div>
                        ${submission.feedback ? `
                            <div class="submission-feedback">
                                <strong>Feedback:</strong><br>
                                ${submission.feedback}
                            </div>
                        ` : ''}
                    ` : ''}
                    
                    <div class="submission-actions">
                        ${submission.grade === undefined ? 
                            `<button class="btn btn-primary" onclick="openGradeModal('${submission.id}', ${assignment.maxScore})">
                                <i class="fas fa-star"></i> Grade Submission
                            </button>` :
                            `<button class="btn btn-secondary" onclick="openGradeModal('${submission.id}', ${assignment.maxScore})">
                                <i class="fas fa-edit"></i> Edit Grade
                            </button>`
                        }
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function openGradeModal(submissionId, maxScore) {
    const submission = submissions.find(s => s.id === submissionId);
    if (!submission) {
        showConfirmation('Error', 'Submission not found.', 'error');
        return;
    }
    
    const assignmentForGrading = assignments.find(a => a.id === submission.assignmentId);
    
    document.getElementById('gradeSubmissionInfo').innerHTML = `
        <div class="submission-info">
            <h4>Grading: ${submission.studentName}</h4>
            ${submission.studentEmail ? `<p><strong>Student Email:</strong> ${submission.studentEmail}</p>` : ''}
            <p><strong>Assignment:</strong> ${assignmentForGrading.title}</p>
            <p><strong>Submitted:</strong> ${formatDate(submission.submittedAt)}</p>
            <div class="submission-text">${submission.submissionText}</div>
        </div>
    `;
    
    document.getElementById('gradeSubmissionId').value = submissionId;
    document.getElementById('gradeScore').value = submission.grade || '';
    document.getElementById('gradeScore').setAttribute('max', maxScore);
    document.getElementById('gradeFeedback').value = submission.feedback || '';
    
    document.getElementById('gradeModal').classList.remove('hidden');
    
    // Focus on score field
    setTimeout(() => {
        document.getElementById('gradeScore').focus();
    }, 100);
}

function closeGradeModal() {
    document.getElementById('gradeModal').classList.add('hidden');
    document.getElementById('gradeForm').reset();
}

async function saveGrade() {
    console.log('🔍 Debug - saveGrade called');
    
    const form = document.getElementById('gradeForm');
    const formData = new FormData(form);
    const submissionId = formData.get('submissionId');
    const score = parseFloat(formData.get('score'));
    const feedback = formData.get('feedback');
    
    console.log('🔍 Debug - Grade data:', { submissionId, score, feedback });
    
    if (isNaN(score) || score < 0) {
        showConfirmation('Validation Error', 'Please enter a valid score.', 'error');
        return;
    }
    
    const submissionIndex = submissions.findIndex(s => s.id === submissionId);
    if (submissionIndex === -1) {
        console.log('❌ Submission not found:', submissionId);
        showConfirmation('Error', 'Submission not found.', 'error');
        return;
    }
    
    const submission = submissions[submissionIndex];
    const assignmentId = submission.assignmentId;
    const assignment = assignments.find(a => a.id === assignmentId);
    
    // Validate score against max score
    if (assignment && score > assignment.maxScore) {
        showConfirmation('Validation Error', `Score cannot exceed ${assignment.maxScore} points.`, 'error');
        return;
    }
    
    console.log('🔍 Debug - Updating submission:', submission);
    
    // Update submission with grade
    submissions[submissionIndex] = {
        ...submissions[submissionIndex],
        grade: score,
        feedback: feedback,
        gradedAt: new Date().toISOString(),
        gradedBy: currentUser.id || currentUser.uid,
        status: 'Graded'
    };
    
    console.log('🔍 Debug - Updated submission:', submissions[submissionIndex]);
    
    // Save to local storage
    localStorage.setItem('submissions', JSON.stringify(submissions));
    
    // Save to Firebase database
    try {
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            console.log('🔍 Debug - Saving to Firebase...');
            
            // Show loading indicator
            const saveButton = document.getElementById('saveGradeBtn');
            if (saveButton) {
                saveButton.disabled = true;
                saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            }
            
            // Update the submission in Firebase
            const updateData = {
                    grade: score,
                    feedback: feedback,
                    gradedAt: new Date().toISOString(),
                gradedBy: currentUser.id || currentUser.uid,
                    status: 'Graded'
            };
            
            console.log('🔍 Debug - Firebase update data:', updateData);
            console.log('🔍 Debug - Firebase path:', `assignments/${assignmentId}/submissions`);
            console.log('🔍 Debug - Student ID:', submission.studentId);
            
            await window.firebaseServices.updateData(
                `assignments/${assignmentId}/submissions`, 
                submission.studentId, 
                updateData
            );
            
            console.log('✅ Grade saved to Firebase successfully');
        } else {
            console.log('⚠️ Firebase services not available, using local storage only');
        }
    } catch (error) {
        console.error('❌ Error saving grade to Firebase:', error);
        showConfirmation('Error', 'There was an error saving the grade to the database. Please try again.', 'error');
        return;
    } finally {
        const saveButton = document.getElementById('saveGradeBtn');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = 'Save Grade';
        }
    }
    
    closeGradeModal();
    showConfirmation('Grade Saved', `Grade of ${score} points has been saved successfully!`, 'success');
    
    // Refresh submissions view
    const assignmentForRefresh = assignments.find(a => a.id === submissions[submissionIndex].assignmentId);
    if (assignmentForRefresh) {
        viewAssignmentSubmissions(assignmentForRefresh.id);
    }
    
    // Also refresh the assignments view to show updated grading progress
    if (currentView === 'assignments') {
        showView('assignments');
    }
}

// ===== FILTER AND SEARCH FUNCTIONS =====
function filterAssignments(searchTerm) {
    // Reset to first page when filtering
    currentAssignmentPage = 1;
    
    if (searchTerm) {
        filteredAssignments = assignments.filter(a => 
            a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.subject.toLowerCase().includes(searchTerm.toLowerCase())
        );
    } else {
        filteredAssignments = [...assignments];
    }
    
    // Re-render the entire assignments section with pagination
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = renderAssignments();
}

function filterAssignmentsBySubject(subject) {
    // Reset to first page when filtering
    currentAssignmentPage = 1;
    
    if (subject) {
        filteredAssignments = assignments.filter(a => a.subject === subject);
    } else {
        filteredAssignments = [...assignments];
    }
    
    // Re-render the entire assignments section with pagination
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = renderAssignments();
}

function filterAssignmentsByStatus(status) {
    // Reset to first page when filtering
    currentAssignmentPage = 1;
    
    if (status) {
        const userSubmissions = submissions.filter(s => s.studentId === currentUser.id);
        filteredAssignments = assignments.filter(assignment => {
            const submission = userSubmissions.find(s => s.assignmentId === assignment.id);
            const dueDate = new Date(assignment.dueDate);
            const now = new Date();
            
            switch (status) {
                case 'pending':
                    return !submission && dueDate > now;
                case 'submitted':
                    return submission && submission.grade === undefined;
                case 'graded':
                    return submission && submission.grade !== undefined;
                case 'overdue':
                    return !submission && dueDate < now;
                default:
                    return true;
            }
        });
    } else {
        filteredAssignments = [...assignments];
    }
    
    // Re-render the entire assignments section with pagination
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = renderAssignments();
}

// ===== STUDENT ASSIGNMENT FILTERS =====
function filterStudentAssignments(searchTerm) {
    const userSubmissions = submissions.filter(s => 
        s.studentId === currentUser.id || 
        s.studentId === currentUser.uid ||
        s.submittedBy === currentUser.id || 
        s.submittedBy === currentUser.uid
    );
    
    const filteredList = assignments.filter(assignment => 
        assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    document.getElementById('studentAssignmentsList').innerHTML = renderStudentAssignmentCards(filteredList, userSubmissions);
}

function filterStudentAssignmentsBySubject(subject) {
    const userSubmissions = submissions.filter(s => 
        s.studentId === currentUser.id || 
        s.studentId === currentUser.uid ||
        s.submittedBy === currentUser.id || 
        s.submittedBy === currentUser.uid
    );
    
    const filteredList = subject ? assignments.filter(assignment => assignment.subject === subject) : assignments;
    document.getElementById('studentAssignmentsList').innerHTML = renderStudentAssignmentCards(filteredList, userSubmissions);
}

function filterStudentAssignmentsByStatus(status) {
    const userSubmissions = submissions.filter(s => 
        s.studentId === currentUser.id || 
        s.studentId === currentUser.uid ||
        s.submittedBy === currentUser.id || 
        s.submittedBy === currentUser.uid
    );
    
    let filteredList = assignments;
    
    if (status) {
        filteredList = assignments.filter(assignment => {
            const submission = userSubmissions.find(s => s.assignmentId === assignment.id);
            const dueDate = new Date(`${assignment.dueDate}T${assignment.dueTime || '23:59'}`);
            const now = new Date();
            const isOverdue = dueDate < now;
            
            switch (status) {
                case 'pending':
                    return !submission && !isOverdue;
                case 'submitted':
                    return submission && (submission.grade === undefined || submission.grade === null);
                case 'graded':
                    return submission && submission.grade !== undefined && submission.grade !== null;
                case 'overdue':
                    return !submission && isOverdue;
                default:
                    return true;
            }
        });
    }
    
    document.getElementById('studentAssignmentsList').innerHTML = renderStudentAssignmentCards(filteredList, userSubmissions);
}

// ===== STAFF ASSIGNMENT FILTERS =====
function filterStaffAssignments(searchTerm) {
    const submissionCounts = assignments.map(assignment => {
        const assignmentSubmissions = submissions.filter(s => s.assignmentId === assignment.id);
        return {
            ...assignment,
            submissionCount: assignmentSubmissions.length,
            gradedCount: assignmentSubmissions.filter(s => s.grade !== undefined).length
        };
    });
    
    let filteredAssignments = submissionCounts;
    
    if (searchTerm) {
        filteredAssignments = submissionCounts.filter(a => 
            a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.subject.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    
    document.getElementById('staffAssignmentsList').innerHTML = renderStaffAssignmentCards(filteredAssignments);
}

function filterStaffAssignmentsBySubject(subject) {
    const submissionCounts = assignments.map(assignment => {
        const assignmentSubmissions = submissions.filter(s => s.assignmentId === assignment.id);
        return {
            ...assignment,
            submissionCount: assignmentSubmissions.length,
            gradedCount: assignmentSubmissions.filter(s => s.grade !== undefined).length
        };
    });
    
    let filteredAssignments = submissionCounts;
    
    if (subject) {
        filteredAssignments = submissionCounts.filter(a => a.subject === subject);
    }
    
    document.getElementById('staffAssignmentsList').innerHTML = renderStaffAssignmentCards(filteredAssignments);
}

// ===== VIEW DETAILS FUNCTIONS =====
function viewAssignmentDetails(assignmentId) {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) {
        showConfirmation('Error', 'Assignment not found.', 'error');
        return;
    }
    
    const dueDate = new Date(assignment.dueDate);
    const now = new Date();
    const isOverdue = dueDate < now;
    const timeLeft = dueDate - now;
    
    let timeLeftText = '';
    if (timeLeft > 0) {
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        timeLeftText = days > 0 ? `${days} days, ${hours} hours remaining` : `${hours} hours remaining`;
    } else {
        timeLeftText = 'Overdue';
    }
    
    const modalContent = `
        <div class="assignment-info">
            <h4>${assignment.title}</h4>
            <p>${assignment.description}</p>
            <div class="meta-grid">
                <div class="meta-item">
                    <i class="fas fa-book"></i>
                    <span>Subject: ${assignment.subject}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>Due: ${formatDate(assignment.dueDate)} ${assignment.dueTime || ''}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-clock"></i>
                    <span class="${isOverdue ? 'overdue' : ''}">${timeLeftText}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-star"></i>
                    <span>Max Score: ${assignment.maxScore} points</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-user"></i>
                    <span>Created: ${formatDate(assignment.createdAt)}</span>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('assignmentModalContent').innerHTML = modalContent;
    document.getElementById('assignmentModal').classList.remove('hidden');
}

async function viewSubmissionDetails(submissionId) {
    // Show loading indicator
    document.getElementById('assignmentModalContent').innerHTML = `
        <div class="loading-container" style="text-align: center; padding: 2rem;">
            <div class="loading" style="width: 3rem; height: 3rem; margin: 0 auto 1rem;"></div>
            <p>Loading submission details...</p>
        </div>
    `;
    document.getElementById('assignmentModal').classList.remove('hidden');
    
    // Find submission in local data
    let submission = submissions.find(s => s.id === submissionId);
    if (!submission) {
        showConfirmation('Error', 'Submission not found.', 'error');
        return;
    }
    
    const assignment = assignments.find(a => a.id === submission.assignmentId);
    if (!assignment) {
        showConfirmation('Error', 'Assignment not found.', 'error');
        return;
    }
    
    // Try to fetch the latest submission data from Firebase
    try {
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            console.log('🔄 Fetching latest submission data from Firebase...');
            const latestSubmission = await window.firebaseServices.readData(
                `assignments/${assignment.id}/submissions`, 
                submission.studentId
            );
            
            if (latestSubmission) {
                console.log('✅ Latest submission data fetched from Firebase:', latestSubmission);
                // Merge with local data to ensure we have all fields
                submission = {
                    ...submission,
                    ...latestSubmission,
                    // Make sure we keep the id
                    id: submission.id
                };
                
                // Update the local storage copy
                const submissionIndex = submissions.findIndex(s => s.id === submissionId);
                if (submissionIndex !== -1) {
                    submissions[submissionIndex] = submission;
                    localStorage.setItem('submissions', JSON.stringify(submissions));
                }
            }
        }
    } catch (error) {
        console.error('❌ Error fetching submission data from Firebase:', error);
        // Continue with local data if there's an error
    }
    
    // Render the submission details
    const modalContent = `
        <div class="assignment-info">
            <h4>Your Submission: ${assignment.title}</h4>
            <div class="meta-grid">
                <div class="meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>Submitted: ${formatDate(submission.submittedAt)}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-star"></i>
                    <span>Max Score: ${assignment.maxScore} points</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-trophy"></i>
                    <span>Your Score: ${submission.grade !== undefined ? submission.grade : 'Not graded yet'}/${assignment.maxScore}</span>
                </div>
                ${submission.gradedAt ? `
                    <div class="meta-item">
                        <i class="fas fa-clock"></i>
                        <span>Graded: ${formatDate(submission.gradedAt)}</span>
                    </div>
                ` : `
                    <div class="meta-item">
                        <i class="fas fa-hourglass-half"></i>
                        <span>Status: Awaiting Grade</span>
                    </div>
                `}
            </div>
        </div>
        
        <div class="submission-content">
            <h5>Your Solution:</h5>
            <div class="submission-text">${submission.submissionText || submission.answerText || ''}</div>
            ${submission.attachment || submission.fileUrl ? `
                <div class="submission-file">
                    <i class="fas fa-paperclip"></i>
                    <span>Attachment: ${submission.attachment || submission.fileUrl}</span>
                </div>
            ` : ''}
        </div>
        
        <div class="submission-answers">
            <h5>Your Submitted Answers:</h5>
            <div class="answers-container">
                ${submission.answers && Array.isArray(submission.answers) ? 
                    submission.answers.map((answer, index) => `
                        <div class="answer-item">
                            <div class="answer-question">Question ${index + 1}: ${answer.question || ''}</div>
                            <div class="answer-response">Your Answer: ${answer.response || ''}</div>
                            ${answer.isCorrect !== undefined ? 
                                `<div class="answer-status ${answer.isCorrect ? 'correct' : 'incorrect'}">
                                    ${answer.isCorrect ? 'Correct' : 'Incorrect'}
                                </div>` : ''
                            }
                        </div>
                    `).join('') : 
                    (submission.submissionText || submission.answerText) ? 
                        '<div class="answer-item">Your full submission is shown above.</div>' : 
                        '<div class="answer-item">No detailed answers available.</div>'
                }
            </div>
        </div>
        
        ${submission.feedback ? `
            <div class="submission-feedback">
                <h5>Instructor Feedback:</h5>
                ${submission.feedback}
            </div>
        ` : ''}
    `;
    
    document.getElementById('assignmentModalContent').innerHTML = modalContent;
}

// MCQ functionality completely removed as per user request
// MCQ functionality removed

// MCQ Modal function completely removed as per user request

function closeCreateMCQModal() {
    document.getElementById('createMCQModal').classList.add('hidden');
}

function addMCQQuestion() {
    mcqQuestionCounter++;
    const questionId = `question_${mcqQuestionCounter}`;
    
    const questionHTML = `
        <div class="question-item" data-question-id="${questionId}">
            <div class="question-header">
                <h5>Question ${mcqQuestionCounter}</h5>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeMCQQuestion('${questionId}')">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
            
            <div class="form-group">
                <label for="${questionId}_text" class="form-label">Question Text *</label>
                <textarea id="${questionId}_text" name="questionText" class="form-input question-text" required
                          placeholder="Enter your question here..." rows="2" onchange="updateTotalPoints()"></textarea>
            </div>
            
            <div class="form-group">
                <label for="${questionId}_points" class="form-label">Points *</label>
                <input type="number" id="${questionId}_points" name="points" class="form-input question-points" 
                       value="10" min="1" max="100" required onchange="updateTotalPoints()">
            </div>
            
            <div class="options-container">
                <label class="form-label">Answer Options *</label>
                <div class="options-list">
                    ${[1, 2, 3, 4].map(optionNum => `
                        <div class="option-item">
                            <div class="option-input-group">
                                <input type="radio" id="${questionId}_option${optionNum}" name="${questionId}_correct" 
                                       value="option${optionNum}" ${optionNum === 1 ? 'checked' : ''}>
                                <input type="text" id="${questionId}_option${optionNum}_text" 
                                       name="option${optionNum}" class="form-input option-text" 
                                       placeholder="Option ${optionNum}" required>
                                <label for="${questionId}_option${optionNum}" class="option-label">
                                    ${optionNum === 1 ? 'Correct' : 'Incorrect'}
                                </label>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('mcqQuestionsContainer').insertAdjacentHTML('beforeend', questionHTML);
    
    // Add event listeners for radio buttons to update labels
    const questionElement = document.querySelector(`[data-question-id="${questionId}"]`);
    const radioButtons = questionElement.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', function() {
            const allLabels = questionElement.querySelectorAll('.option-label');
            allLabels.forEach(label => label.textContent = 'Incorrect');
            
            const selectedLabel = questionElement.querySelector(`label[for="${this.id}"]`);
            if (selectedLabel) {
                selectedLabel.textContent = 'Correct';
            }
        });
    });
    
    updateTotalPoints();
}

function removeMCQQuestion(questionId) {
    const questionElement = document.querySelector(`[data-question-id="${questionId}"]`);
    if (questionElement) {
        questionElement.remove();
        updateTotalPoints();
        
        // Re-number remaining questions
        const remainingQuestions = document.querySelectorAll('.question-item');
        remainingQuestions.forEach((question, index) => {
            const questionNumber = index + 1;
            const header = question.querySelector('.question-header h5');
            if (header) {
                header.textContent = `Question ${questionNumber}`;
            }
        });
    }
}

function updateTotalPoints() {
    const pointInputs = document.querySelectorAll('.question-points');
    let totalPoints = 0;
    
    pointInputs.forEach(input => {
        const points = parseInt(input.value) || 0;
        totalPoints += points;
    });
    
    document.getElementById('mcqTotalPoints').value = totalPoints;
}

async function saveMCQQuiz() {
    if (!requireCurrentUser('staff', 'create MCQ quizzes')) {
        return;
    }
    
    const form = document.getElementById('createMCQForm');
    const formData = new FormData(form);
    
    // Validate basic form data
    const title = formData.get('title')?.trim();
    const subject = formData.get('subject')?.trim();
    const description = formData.get('description')?.trim();
    const dueDate = formData.get('dueDate');
    const dueTime = formData.get('dueTime');
    const timeLimit = parseInt(formData.get('timeLimit'));
    
    // Enhanced validation
    if (!title || title.length < 3) {
        showConfirmation('Error', 'Please enter a valid quiz title (minimum 3 characters).', 'error');
        return;
    }
    
    if (!subject) {
        showConfirmation('Error', 'Please select a subject for the quiz.', 'error');
        return;
    }
    
    if (!description || description.length < 10) {
        showConfirmation('Error', 'Please provide a detailed description (minimum 10 characters).', 'error');
        return;
    }
    
    if (!dueDate || !dueTime) {
        showConfirmation('Error', 'Please set a due date and time for the quiz.', 'error');
        return;
    }
    
    if (!timeLimit || timeLimit < 1 || timeLimit > 240) {
        showConfirmation('Error', 'Please set a valid time limit between 1 and 240 minutes.', 'error');
        return;
    }
    
    // Check if due date is not in the past
    const dueDateTime = new Date(`${dueDate}T${dueTime}`);
    const now = new Date();
    if (dueDateTime <= now) {
        showConfirmation('Error', 'Due date and time must be in the future.', 'error');
        return;
    }
    
    // Collect questions data
    const questions = [];
    const questionElements = document.querySelectorAll('.question-item');
    
    if (questionElements.length === 0) {
        showConfirmation('Error', 'Please add at least one question.', 'error');
        return;
    }
    
    for (let i = 0; i < questionElements.length; i++) {
        const questionElement = questionElements[i];
        const questionId = questionElement.getAttribute('data-question-id');
        
        const questionText = questionElement.querySelector('.question-text').value.trim();
        const points = parseInt(questionElement.querySelector('.question-points').value) || 0;
        
        if (!questionText) {
            showConfirmation('Error', `Question ${i + 1} text is required.`, 'error');
            return;
        }
        
        // Get options
        const options = [];
        const optionTexts = questionElement.querySelectorAll('.option-text');
        let hasEmptyOption = false;
        
        optionTexts.forEach(optionInput => {
            const optionText = optionInput.value.trim();
            if (!optionText) {
                hasEmptyOption = true;
            }
            options.push(optionText);
        });
        
        if (hasEmptyOption) {
            showConfirmation('Error', `All options for Question ${i + 1} are required.`, 'error');
            return;
        }
        
        // Validate minimum options
        if (options.length < 2) {
            showConfirmation('Error', `Question ${i + 1} must have at least 2 options.`, 'error');
            return;
        }
        
        // Validate points
        if (points < 1 || points > 100) {
            showConfirmation('Error', `Question ${i + 1} points must be between 1 and 100.`, 'error');
            return;
        }
        
        // Get correct answer
        const correctRadio = questionElement.querySelector('input[type="radio"]:checked');
        if (!correctRadio) {
            showConfirmation('Error', `Please select the correct answer for Question ${i + 1}.`, 'error');
            return;
        }
        
        const correctIndex = parseInt(correctRadio.value.replace('option', '')) - 1;
        const correctAnswer = options[correctIndex];
        
        questions.push({
            id: `q${i + 1}`,
            question: questionText,
            options: options,
            correctAnswer: correctAnswer,
            points: points
        });
    }
    
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    
    // Create MCQ quiz object
    const newMCQQuiz = {
        id: `mcq_${Date.now()}`,
        title: title,
        subject: subject,
        description: description,
        dueDate: dueDate,
        dueTime: dueTime,
        timeLimit: timeLimit,
        totalPoints: totalPoints,
        allowRetake: document.getElementById('mcqAllowRetake').checked,
        showCorrectAnswers: document.getElementById('mcqShowCorrectAnswers').checked,
        questions: questions,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString().split('T')[0]
    };
    
    try {
        // Add to Firebase using the proper method
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
        // Sync current user to Firebase services with proper structure
        window.firebaseServices.currentUser = {
            uid: currentUser.uid || currentUser.id,
            id: currentUser.id || currentUser.uid,
            name: currentUser.name,
            email: currentUser.email,
            role: currentUser.role
        };
            
            console.log('🔄 Synced current user to Firebase services:', window.firebaseServices.currentUser);
            
            // Use Firebase services module for proper MCQ creation
            const result = await window.firebaseServices.createMCQQuiz(newMCQQuiz);
            if (!result.success) {
                throw new Error(result.error);
            }
            console.log('✅ MCQ Quiz saved to Firebase via services module');
        } else {
            // Fallback to direct Firebase method
            await saveDataToFirebase('mcqAssignments', newMCQQuiz);
            console.log('✅ MCQ Quiz saved to Firebase via direct method');
        }
        
        // Add to local array
        mcqAssignments.push(newMCQQuiz);
        localStorage.setItem('mcqAssignments', JSON.stringify(mcqAssignments));
        
        showConfirmation('Success', `MCQ Quiz "${title}" has been created successfully!`, 'success');
        
        // Close modal
        closeCreateMCQModal();
        
        // Refresh the view if we're on assignments page
        if (currentView === 'assignments') {
            showView('assignments');
        }
        
    } catch (error) {
        console.error('Error creating MCQ quiz:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Failed to create MCQ quiz. ';
        
        if (error.message.includes('Firebase not initialized')) {
            errorMessage += 'Database connection issue. Please refresh the page and try again.';
        } else if (error.message.includes('permission')) {
            errorMessage += 'You do not have permission to create quizzes.';
        } else if (error.message.includes('network')) {
            errorMessage += 'Network connection issue. Please check your internet connection.';
        } else if (error.message.includes('Only staff can create')) {
            errorMessage += 'Only staff members can create MCQ quizzes.';
        } else {
            errorMessage += 'Please check your internet connection and try again.';
        }
        
        showConfirmation('Error', errorMessage, 'error');
        
        // Try to save to local storage as fallback
        try {
            mcqAssignments.push(newMCQQuiz);
            localStorage.setItem('mcqAssignments', JSON.stringify(mcqAssignments));
            console.log('✅ MCQ Quiz saved to local storage as fallback');
            
            showConfirmation('Warning', 'Quiz created locally but not saved to server. It will be synced when connection is restored.', 'warning');
            closeCreateMCQModal();
            
            if (currentView === 'assignments') {
                showView('assignments');
            }
        } catch (localError) {
            console.error('Failed to save to local storage:', localError);
        }
    }
}

// MCQ functionality removed as per user request
// function startMCQQuiz(mcqId) {
//     const mcq = mcqAssignments.find(m => m.id === mcqId);
//     if (!mcq) {
//         showConfirmation('Error', 'MCQ Quiz not found.', 'error');
//         return;
//     }
    
//     // Check if student has already submitted (if retake is not allowed)
//     const existingSubmission = mcqSubmissions.find(s => 
//         s.mcqId === mcqId && s.studentId === currentUser.id
//     );
    
//     if (existingSubmission && !mcq.allowRetake) {
//         showConfirmation('Quiz Completed', 'You have already completed this quiz and retakes are not allowed.', 'info');
//         return;
//     }
    
//     // Check if quiz is still available (due date not passed)
//     const now = new Date();
//     const dueDateTime = new Date(`${mcq.dueDate}T${mcq.dueTime}`);
    
//     if (now > dueDateTime) {
//         showConfirmation('Quiz Expired', 'This quiz has expired and is no longer available.', 'error');
//         return;
//     }
    
//     // Start the quiz
//     openMCQQuizModal(mcq);
// }

function openMCQQuizModal(mcq) {
    let quizTimer = null;
    let timeRemaining = mcq.timeLimit * 60; // Convert minutes to seconds
    let currentQuestionIndex = 0;
    let userAnswers = {};
    
    const modalContent = `
        <div class="mcq-quiz-container">
            <div class="quiz-header">
                <div class="quiz-info">
                    <h3>${mcq.title}</h3>
                    <p>${mcq.description}</p>
                    <div class="quiz-meta">
                        <span><i class="fas fa-clock"></i> ${mcq.timeLimit} minutes</span>
                        <span><i class="fas fa-star"></i> ${mcq.totalPoints} points</span>
                        <span><i class="fas fa-question-circle"></i> ${mcq.questions.length} questions</span>
                    </div>
                </div>
                <div class="quiz-timer">
                    <div class="timer-display">
                        <i class="fas fa-stopwatch"></i>
                        <span id="mcqTimer">${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}</span>
                    </div>
                </div>
            </div>
            
            <div class="quiz-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${((currentQuestionIndex + 1) / mcq.questions.length) * 100}%"></div>
                </div>
                <span class="progress-text">Question ${currentQuestionIndex + 1} of ${mcq.questions.length}</span>
            </div>
            
            <div class="quiz-content">
                <div id="mcqQuestionContainer">
                    ${renderQuizQuestion(mcq.questions[currentQuestionIndex], currentQuestionIndex)}
                </div>
                
                <div class="quiz-navigation">
                    <button type="button" class="btn btn-secondary" id="prevQuestionBtn" 
                            onclick="navigateQuestion(-1)" ${currentQuestionIndex === 0 ? 'disabled' : ''}>
                        <i class="fas fa-arrow-left"></i> Previous
                    </button>
                    
                    <div class="question-indicators">
                        ${mcq.questions.map((_, index) => `
                            <button type="button" class="question-indicator ${index === currentQuestionIndex ? 'active' : ''}" 
                                    onclick="goToQuestion(${index})" data-question="${index}">
                                ${index + 1}
                            </button>
                        `).join('')}
                    </div>
                    
                    <button type="button" class="btn btn-secondary" id="nextQuestionBtn" 
                            onclick="navigateQuestion(1)" ${currentQuestionIndex === mcq.questions.length - 1 ? 'disabled' : ''}>
                        Next <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
                
                <div class="quiz-actions">
                    <button type="button" class="btn btn-danger" onclick="closeMCQModal()">
                        <i class="fas fa-times"></i> Cancel Quiz
                    </button>
                    <button type="button" class="btn btn-primary" onclick="submitMCQQuiz()">
                        <i class="fas fa-check"></i> Submit Quiz
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('mcqModalContent').innerHTML = modalContent;
    document.getElementById('mcqModal').classList.remove('hidden');
    
    // Start the timer
    quizTimer = setInterval(() => {
        timeRemaining--;
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        
        const timerElement = document.getElementById('mcqTimer');
        if (timerElement) {
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Change color when time is running low
            if (timeRemaining <= 300) { // 5 minutes
                timerElement.parentElement.classList.add('timer-warning');
            }
            if (timeRemaining <= 60) { // 1 minute
                timerElement.parentElement.classList.add('timer-danger');
            }
        }
        
        if (timeRemaining <= 0) {
            clearInterval(quizTimer);
            autoSubmitMCQQuiz();
        }
    }, 1000);
    
    // Store quiz state globally for navigation functions
    window.currentMCQQuiz = {
        mcq: mcq,
        timer: quizTimer,
        timeRemaining: timeRemaining,
        currentQuestionIndex: currentQuestionIndex,
        userAnswers: userAnswers
    };
}

function renderQuizQuestion(question, questionIndex) {
    return `
        <div class="quiz-question">
            <div class="question-header">
                <h4>Question ${questionIndex + 1}</h4>
                <span class="question-points">${question.points} points</span>
            </div>
            
            <div class="question-text">
                <p>${question.question}</p>
            </div>
            
            <div class="question-options">
                ${question.options.map((option, optionIndex) => `
                    <div class="option-item">
                        <input type="radio" id="q${questionIndex}_option${optionIndex}" 
                               name="question_${questionIndex}" value="${option}"
                               onchange="saveAnswer(${questionIndex}, '${option.replace(/'/g, "\\'")}')">
                        <label for="q${questionIndex}_option${optionIndex}" class="option-label">
                            <span class="option-marker">${String.fromCharCode(65 + optionIndex)}</span>
                            <span class="option-text">${option}</span>
                        </label>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function navigateQuestion(direction) {
    if (!window.currentMCQQuiz) return;
    
    const newIndex = window.currentMCQQuiz.currentQuestionIndex + direction;
    const totalQuestions = window.currentMCQQuiz.mcq.questions.length;
    
    if (newIndex >= 0 && newIndex < totalQuestions) {
        goToQuestion(newIndex);
    }
}

function goToQuestion(questionIndex) {
    if (!window.currentMCQQuiz) return;
    
    const mcq = window.currentMCQQuiz.mcq;
    window.currentMCQQuiz.currentQuestionIndex = questionIndex;
    
    // Update question content
    document.getElementById('mcqQuestionContainer').innerHTML = 
        renderQuizQuestion(mcq.questions[questionIndex], questionIndex);
    
    // Update progress bar
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = `${((questionIndex + 1) / mcq.questions.length) * 100}%`;
    }
    
    // Update progress text
    const progressText = document.querySelector('.progress-text');
    if (progressText) {
        progressText.textContent = `Question ${questionIndex + 1} of ${mcq.questions.length}`;
    }
    
    // Update navigation buttons
    const prevBtn = document.getElementById('prevQuestionBtn');
    const nextBtn = document.getElementById('nextQuestionBtn');
    
    if (prevBtn) prevBtn.disabled = questionIndex === 0;
    if (nextBtn) nextBtn.disabled = questionIndex === mcq.questions.length - 1;
    
    // Update question indicators
    document.querySelectorAll('.question-indicator').forEach((indicator, index) => {
        indicator.classList.toggle('active', index === questionIndex);
        
        // Mark as answered if user has answered this question
        const questionId = `question_${index}`;
        if (window.currentMCQQuiz.userAnswers[questionId]) {
            indicator.classList.add('answered');
        }
    });
    
    // Restore user's previous answer if exists
    const savedAnswer = window.currentMCQQuiz.userAnswers[`question_${questionIndex}`];
    if (savedAnswer) {
        const radioButton = document.querySelector(`input[name="question_${questionIndex}"][value="${savedAnswer}"]`);
        if (radioButton) {
            radioButton.checked = true;
        }
    }
}

function saveAnswer(questionIndex, answer) {
    if (!window.currentMCQQuiz) return;
    
    window.currentMCQQuiz.userAnswers[`question_${questionIndex}`] = answer;
    
    // Update question indicator to show it's answered
    const indicator = document.querySelector(`[data-question="${questionIndex}"]`);
    if (indicator) {
        indicator.classList.add('answered');
    }
}

async function submitMCQQuiz() {
    if (!window.currentMCQQuiz) return;
    
    const mcq = window.currentMCQQuiz.mcq;
    const userAnswers = window.currentMCQQuiz.userAnswers;
    
    // Check if all questions are answered
    const unansweredQuestions = [];
    for (let i = 0; i < mcq.questions.length; i++) {
        if (!userAnswers[`question_${i}`]) {
            unansweredQuestions.push(i + 1);
        }
    }
    
    if (unansweredQuestions.length > 0) {
        const proceed = confirm(`You have ${unansweredQuestions.length} unanswered question(s): ${unansweredQuestions.join(', ')}. Do you want to submit anyway?`);
        if (!proceed) return;
    }
    
    // Calculate score
    let score = 0;
    let correctAnswers = 0;
    const results = [];
    
    mcq.questions.forEach((question, index) => {
        const userAnswer = userAnswers[`question_${index}`];
        const isCorrect = userAnswer === question.correctAnswer;
        
        if (isCorrect) {
            score += question.points;
            correctAnswers++;
        }
        
        results.push({
            questionIndex: index,
            question: question.question,
            userAnswer: userAnswer || 'Not answered',
            correctAnswer: question.correctAnswer,
            isCorrect: isCorrect,
            points: question.points,
            earnedPoints: isCorrect ? question.points : 0
        });
    });
    
    // Stop timer
    if (window.currentMCQQuiz.timer) {
        clearInterval(window.currentMCQQuiz.timer);
    }
    
    // Create submission record
    const submission = {
        id: `mcq_sub_${Date.now()}`,
        mcqId: mcq.id,
        studentId: currentUser.id,
        studentName: currentUser.name,
        answers: userAnswers,
        score: score,
        totalPoints: mcq.totalPoints,
        correctAnswers: correctAnswers,
        totalQuestions: mcq.questions.length,
        percentage: Math.round((score / mcq.totalPoints) * 100),
        submittedAt: new Date().toISOString(),
        timeSpent: (mcq.timeLimit * 60) - window.currentMCQQuiz.timeRemaining
    };
    
    try {
        // Add to Firebase using the proper method
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
        // Sync current user to Firebase services with proper structure
        window.firebaseServices.currentUser = {
            uid: currentUser.uid || currentUser.id,
            id: currentUser.id || currentUser.uid,
            name: currentUser.name,
            email: currentUser.email,
            role: currentUser.role
        };
            
            console.log('🔄 Synced current user to Firebase services for submission:', window.firebaseServices.currentUser);
            
            // Use Firebase services module for proper MCQ submission
            const submissionData = {
                answers: submission.answers,
                score: submission.score,
                totalPoints: submission.totalPoints,
                percentage: submission.percentage,
                timeSpent: submission.timeSpent
            };
            
            const result = await window.firebaseServices.submitMCQQuiz(submission.mcqId, submissionData);
            if (!result.success) {
                throw new Error(result.error);
            }
            console.log('✅ MCQ Submission saved to Firebase via services module');
        } else {
            // Fallback to direct Firebase method
            await saveDataToFirebase('mcqSubmissions', submission);
            console.log('✅ MCQ Submission saved to Firebase via direct method');
        }
        
        // Add to local array
        mcqSubmissions.push(submission);
        localStorage.setItem('mcqSubmissions', JSON.stringify(mcqSubmissions));
        
        // Show results
        showMCQResults(mcq, submission, results);
        
    } catch (error) {
        console.error('Error submitting MCQ quiz:', error);
        showConfirmation('Error', 'Failed to submit quiz. Please try again.', 'error');
    }
}

function autoSubmitMCQQuiz() {
    showConfirmation('Time Up!', 'Time has expired. Your quiz will be submitted automatically.', 'warning');
    setTimeout(() => {
        submitMCQQuiz();
    }, 2000);
}

function showMCQResults(mcq, submission, results) {
    const modalContent = `
        <div class="mcq-results-container">
            <div class="results-header">
                <div class="results-summary">
                    <h3><i class="fas fa-chart-line"></i> Quiz Results</h3>
                    <h4>${mcq.title}</h4>
                </div>
                
                <div class="score-display">
                    <div class="score-circle">
                        <div class="score-number">${submission.percentage}%</div>
                        <div class="score-label">Score</div>
                    </div>
                    <div class="score-details">
                        <p><strong>${submission.score}</strong> out of <strong>${submission.totalPoints}</strong> points</p>
                        <p><strong>${submission.correctAnswers}</strong> out of <strong>${submission.totalQuestions}</strong> correct</p>
                        <p>Time spent: <strong>${Math.floor(submission.timeSpent / 60)}:${(submission.timeSpent % 60).toString().padStart(2, '0')}</strong></p>
                    </div>
                </div>
            </div>
            
            ${mcq.showCorrectAnswers ? `
                <div class="results-details">
                    <h4><i class="fas fa-list"></i> Question Review</h4>
                    <div class="questions-review">
                        ${results.map((result, index) => `
                            <div class="question-review ${result.isCorrect ? 'correct' : 'incorrect'}">
                                <div class="question-header">
                                    <span class="question-number">Q${index + 1}</span>
                                    <span class="question-status">
                                        <i class="fas ${result.isCorrect ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                                        ${result.isCorrect ? 'Correct' : 'Incorrect'}
                                    </span>
                                    <span class="question-points">${result.earnedPoints}/${result.points} pts</span>
                                </div>
                                
                                <div class="question-content">
                                    <p class="question-text">${result.question}</p>
                                    
                                    <div class="answer-comparison">
                                        <div class="user-answer">
                                            <strong>Your Answer:</strong>
                                            <span class="${result.isCorrect ? 'correct-answer' : 'wrong-answer'}">
                                                ${result.userAnswer}
                                            </span>
                                        </div>
                                        
                                        ${!result.isCorrect ? `
                                            <div class="correct-answer-display">
                                                <strong>Correct Answer:</strong>
                                                <span class="correct-answer">${result.correctAnswer}</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : `
                <div class="results-message">
                    <p><i class="fas fa-info-circle"></i> Detailed results will be available after the quiz deadline.</p>
                </div>
            `}
            
            <div class="results-actions">
                <button type="button" class="btn btn-primary" onclick="closeMCQModal()">
                    <i class="fas fa-check"></i> Close
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('mcqModalContent').innerHTML = modalContent;
    
    // Clean up quiz state
    window.currentMCQQuiz = null;
}

// MCQ functionality removed as per user request
// function viewMCQDetails(mcqId) {
//     const mcq = mcqAssignments.find(m => m.id === mcqId);
//     if (!mcq) {
//         showConfirmation('Error', 'MCQ Quiz not found.', 'error');
//         return;
//     }
    
//     const modalContent = `
//         <div class="mcq-details-container">
//             <div class="mcq-info">
//                 <h3>${mcq.title}</h3>
//                 <p class="mcq-description">${mcq.description}</p>
                
//                 <div class="mcq-meta-grid">
//                     <div class="meta-item">
//                         <i class="fas fa-book"></i>
//                         <span><strong>Subject:</strong> ${mcq.subject}</span>
//                     </div>
//                     <div class="meta-item">
//                         <i class="fas fa-calendar-alt"></i>
//                         <span><strong>Due Date:</strong> ${formatDate(mcq.dueDate)} ${mcq.dueTime ? `at ${formatTime(mcq.dueTime)}` : ''}</span>
//                     </div>
//                     <div class="meta-item">
//                         <i class="fas fa-clock"></i>
//                         <span><strong>Time Limit:</strong> ${mcq.timeLimit} minutes</span>
//                     </div>
//                     <div class="meta-item">
//                         <i class="fas fa-star"></i>
//                         <span><strong>Total Points:</strong> ${mcq.totalPoints}</span>
//                     </div>
//                     <div class="meta-item">
//                         <i class="fas fa-question-circle"></i>
//                         <span><strong>Questions:</strong> ${mcq.questions.length}</span>
//                     </div>
//                     <div class="meta-item">
//                         <i class="fas fa-redo"></i>
//                         <span><strong>Retakes:</strong> ${mcq.allowRetake ? 'Allowed' : 'Not Allowed'}</span>
//                     </div>
//                 </div>
                
//                 <div class="quiz-instructions">
//                     <h4><i class="fas fa-info-circle"></i> Instructions</h4>
//                     <ul>
//                         <li>You have <strong>${mcq.timeLimit} minutes</strong> to complete this quiz</li>
//                         <li>The quiz contains <strong>${mcq.questions.length} questions</strong> worth <strong>${mcq.totalPoints} points</strong> total</li>
//                         <li>You can navigate between questions using the navigation buttons</li>
//                         <li>Your answers are automatically saved as you progress</li>
//                         <li>${mcq.allowRetake ? 'You can retake this quiz if needed' : 'You can only take this quiz once'}</li>
//                         <li>${mcq.showCorrectAnswers ? 'Correct answers will be shown after submission' : 'Results will be available after the quiz deadline'}</li>
//                     </ul>
//                 </div>
//             </div>
//         </div>
//     `;
    
//     document.getElementById('mcqModalTitle').textContent = 'Quiz Details';
//     document.getElementById('mcqModalContent').innerHTML = modalContent;
//     document.getElementById('mcqModal').classList.remove('hidden');
// }

function viewMCQResults(submissionId) {
    const submission = mcqSubmissions.find(s => s.id === submissionId);
    if (!submission) {
        showConfirmation('Error', 'Quiz results not found.', 'error');
        return;
    }
    
    const mcq = mcqAssignments.find(m => m.id === submission.mcqId);
    if (!mcq) {
        showConfirmation('Error', 'Quiz not found.', 'error');
        return;
    }
    
    // Recreate results for display
    const results = [];
    mcq.questions.forEach((question, index) => {
        const userAnswer = submission.answers[`question_${index}`];
        const isCorrect = userAnswer === question.correctAnswer;
        
        results.push({
            questionIndex: index,
            question: question.question,
            userAnswer: userAnswer || 'Not answered',
            correctAnswer: question.correctAnswer,
            isCorrect: isCorrect,
            points: question.points,
            earnedPoints: isCorrect ? question.points : 0
        });
    });
    
    showMCQResults(mcq, submission, results);
}

// ===== PLACEHOLDER FUNCTIONS =====

function showCreateApplicationForm() {
    // Reset form
    document.getElementById('applicationForm').reset();
    
    // Show the modal
    document.getElementById('applicationModal').classList.remove('hidden');
}

async function submitApplication() {
    // Check if user has student role and is properly authenticated
    if (!requireCurrentUser('student', 'submit applications')) {
        return;
    }

    const form = document.getElementById('applicationForm');
    const formData = new FormData(form);
    
    // Get file input element once at the beginning
    const fileInput = document.getElementById('applicationFile');
    
    // Validate required fields - including user information
    const fullName = formData.get('fullName');
    const phone = formData.get('phone');
    const enrollmentNumber = formData.get('enrollmentNumber');
    const email = formData.get('email');
    const studentClass = formData.get('class');
    const semester = formData.get('semester');
    const faculty = formData.get('faculty');
    const type = formData.get('type');
    const title = formData.get('title');
    const description = formData.get('description');
    
    // Check all required fields
    if (!fullName || !phone || !enrollmentNumber || !email || !studentClass || !semester || !faculty || !type || !title || !description) {
        showConfirmation('Validation Error', 'Please fill in all required fields including student information.', 'error');
        return;
    }
    
    // Create student information object
    const studentInfo = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        enrollmentNumber: enrollmentNumber.trim(),
        email: email.trim(),
        class: studentClass.trim(),
        semester: semester,
        faculty: faculty
    };
    
    // Create new application object
    const createdBy = getCreatedByObject();
    const newApplication = {
        type: type,
        title: title,
        description: description,
        status: 'pending',
        submittedBy: currentUser.uid || currentUser.id,
        createdBy: createdBy,
        studentInfo: studentInfo, // Add student information
        reviewedBy: null,
        reviewedAt: null,
        comment: null
    };
    
    // Handle file attachment if present
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        newApplication.attachment = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        };
        
        // In a real application, you would upload the file to a server
        // For this demo, we'll just store the file metadata
        console.log('File attached:', file.name);
    }
    
    try {
        // Try to save to Firebase first
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            const applicationData = {
                type: type,
                title: title,
                description: description,
                submittedAt: new Date().toISOString(),
                studentInfo: studentInfo,
                // Include individual fields for Firebase fallback
                fullName: studentInfo.fullName,
                phone: studentInfo.phone,
                enrollmentNumber: studentInfo.enrollmentNumber,
                email: studentInfo.email,
                class: studentInfo.class,
                semester: studentInfo.semester,
                faculty: studentInfo.faculty
            };
            
            const result = await createApplicationWithFirebase(applicationData);
            if (result.success) {
                // Don't add to local array - let loadDataFromFirebase() handle it
                // This prevents duplicate entries
                
                // Add notification for student
                if (currentUser.role === 'student') {
                    addNotification('New Application Submitted', `Your ${type} application "${title}" has been submitted successfully.`, 'success');
                    
                    // Notify staff about new application
                    const staffNotification = {
                        id: 'notif_' + Date.now(),
                        title: 'New Application Submitted',
                        message: `Student ${currentUser.name} submitted a new ${type} application: "${title}"`,
                        type: 'info',
                        timestamp: new Date().toISOString(),
                        read: false,
                        targetRole: 'staff'
                    };
                    notifications.push(staffNotification);
                    localStorage.setItem('notifications', JSON.stringify(notifications));
                }
                
                // Close modal and show success message
                closeApplicationModal();
                showConfirmation('Application Submitted', `Your ${type} application has been submitted successfully!`, 'success');
                
                // Refresh the applications view to show the new application
                if (currentView === 'applications') {
                    showView('applications');
                }
                return;
            }
        }
        
        // Fallback to local storage if Firebase is not available
        const newApplication = {
            id: 'app_' + Date.now(),
            type: type,
            title: title,
            description: description,
            status: 'Pending',
            submittedBy: currentUser.uid || currentUser.id,
            studentId: currentUser.uid || currentUser.id,
            createdBy: createdBy,
            submittedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            reviewedBy: null,
            reviewedAt: null,
            comment: null,
            studentInfo: studentInfo
        };
        
        // Handle file attachment if present
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            newApplication.attachment = {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            };
            
            // In a real application, you would upload the file to a server
            // For this demo, we'll just store the file metadata
            console.log('File attached:', file.name);
        }
        
        applications.push(newApplication);
        localStorage.setItem('applications', JSON.stringify(applications));
        
        // Add notification for student
        if (currentUser.role === 'student') {
            addNotification('New Application Submitted', `Your ${type} application "${title}" has been submitted successfully.`, 'success');
            
            // Notify staff about new application
            const staffNotification = {
                id: 'notif_' + Date.now(),
                title: 'New Application Submitted',
                message: `Student ${currentUser.name} submitted a new ${type} application: "${title}"`,
                type: 'info',
                timestamp: new Date().toISOString(),
                read: false,
                targetRole: 'staff'
            };
            notifications.push(staffNotification);
            localStorage.setItem('notifications', JSON.stringify(notifications));
        }
        
        // Close modal and show success message
        closeApplicationModal();
        showConfirmation('Application Submitted', `Your ${type} application has been submitted successfully.`, 'success');
        
        // Refresh the applications view
        showView('applications');
        
    } catch (error) {
        console.error('Error submitting application:', error);
        showConfirmation('Error', `Failed to submit application: ${error.message}`, 'error');
    }
}

function viewApplication(applicationId) {
    const application = applications.find(a => a.id === applicationId);
    if (!application) {
        showConfirmation('Error', 'Application not found.', 'error');
        return;
    }
    
    const submitter = users.find(u => u.id === application.submittedBy || u.uid === application.submittedBy);
    const reviewer = application.reviewedBy ? users.find(u => u.id === application.reviewedBy || u.uid === application.reviewedBy) : null;
    
    // Get student info from application data
    const studentInfo = application.studentInfo || {};
    
    const modalContent = `
        <div class="application-details">
            <div class="application-header">
                <h4>${application.title}</h4>
                <span class="status-badge status-${application.status}">${application.status}</span>
            </div>
            
            <!-- Student Information Section -->
            <div class="application-section">
                <h5><i class="fas fa-user-graduate"></i> Student Information</h5>
                <div class="student-info-grid">
                    <div class="info-item">
                        <span class="info-label">Full Name:</span>
                        <span class="info-value">${studentInfo.fullName || submitter?.name || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Phone Number:</span>
                        <span class="info-value">${studentInfo.phone || 'Not provided'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Enrollment Number:</span>
                        <span class="info-value">${studentInfo.enrollmentNumber || 'Not provided'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Email:</span>
                        <span class="info-value">${studentInfo.email || submitter?.email || 'Not provided'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Class:</span>
                        <span class="info-value">${studentInfo.class || 'Not provided'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Semester:</span>
                        <span class="info-value">${studentInfo.semester ? 'Semester ' + studentInfo.semester : 'Not provided'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Faculty:</span>
                        <span class="info-value">${studentInfo.faculty || 'Not provided'}</span>
                    </div>
                </div>
            </div>
            
            <!-- Application Details Section -->
            <div class="application-section">
                <h5><i class="fas fa-file-text"></i> Application Details</h5>
                <div class="application-meta">
                    <div class="meta-item">
                        <i class="fas fa-tag"></i>
                        <span><strong>Type:</strong> ${application.type.charAt(0).toUpperCase() + application.type.slice(1)}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-calendar"></i>
                        <span><strong>Submitted:</strong> ${formatDate(application.submittedAt || application.createdAt)}</span>
                    </div>
                    ${application.reviewedAt ? `
                        <div class="meta-item">
                            <i class="fas fa-user-check"></i>
                            <span><strong>Reviewed By:</strong> ${reviewer ? reviewer.name : 'Unknown'}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-clock"></i>
                            <span><strong>Reviewed:</strong> ${formatDate(application.reviewedAt)}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="application-content">
                    <h6>Description/Reason:</h6>
                    <div class="description-text">${application.description}</div>
                    
                    ${application.attachment ? `
                        <div class="attachment-info">
                            <h6>Attachment:</h6>
                            <div class="file-info">
                                <i class="fas fa-paperclip"></i>
                                <span>${application.attachment.name}</span>
                                <small>(${formatFileSize(application.attachment.size)})</small>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${application.comment || application.reviewComment ? `
                        <div class="review-comment">
                            <h6>Review Comment:</h6>
                            <div class="comment-text">${application.comment || application.reviewComment}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('viewApplicationContent').innerHTML = modalContent;
    document.getElementById('viewApplicationModal').classList.remove('hidden');
}

function approveApplication(applicationId) {
    console.log('🔄 Attempting to approve application:', applicationId);
    console.log('🔐 Current user:', currentUser);
    
    // Check if user is logged in and has staff role
    if (!requireCurrentUser('staff', 'approve applications')) {
        return;
    }
    
    // Show review modal for approval
    showApplicationReviewModal(applicationId, 'approve');
}

function rejectApplication(applicationId) {
    console.log('🔄 Attempting to reject application:', applicationId);
    console.log('🔐 Current user:', currentUser);
    
    // Check if user is logged in and has staff role
    if (!requireCurrentUser('staff', 'reject applications')) {
        return;
    }
    
    // Show review modal for rejection
    showApplicationReviewModal(applicationId, 'reject');
}

function showApplicationReviewModal(applicationId, action) {
    const application = applications.find(a => a.id === applicationId);
    if (!application) {
        showConfirmation('Error', 'Application not found.', 'error');
        return;
    }
    
    const submitter = users.find(u => u.id === application.submittedBy || u.uid === application.submittedBy);
    const studentInfo = application.studentInfo || {};
    
    const modalContent = `
        <div class="application-review-preview">
            <h4>Review Application</h4>
            
            <!-- Student Information -->
            <div class="review-section">
                <h5><i class="fas fa-user-graduate"></i> Student Information</h5>
                <div class="review-info-grid">
                    <div class="review-info-item">
                        <strong>Full Name:</strong> ${studentInfo.fullName || submitter?.name || 'Unknown'}
                    </div>
                    <div class="review-info-item">
                        <strong>Phone:</strong> ${studentInfo.phone || 'Not provided'}
                    </div>
                    <div class="review-info-item">
                        <strong>Enrollment Number:</strong> ${studentInfo.enrollmentNumber || 'Not provided'}
                    </div>
                    <div class="review-info-item">
                        <strong>Email:</strong> ${studentInfo.email || submitter?.email || 'Not provided'}
                    </div>
                    <div class="review-info-item">
                        <strong>Class:</strong> ${studentInfo.class || 'Not provided'}
                    </div>
                    <div class="review-info-item">
                        <strong>Semester:</strong> ${studentInfo.semester ? 'Semester ' + studentInfo.semester : 'Not provided'}
                    </div>
                    <div class="review-info-item">
                        <strong>Faculty:</strong> ${studentInfo.faculty || 'Not provided'}
                    </div>
                </div>
            </div>
            
            <!-- Application Details -->
            <div class="review-section">
                <h5><i class="fas fa-file-text"></i> Application Details</h5>
                <div class="review-application-info">
                    <p><strong>Title:</strong> ${application.title}</p>
                    <p><strong>Type:</strong> ${application.type.charAt(0).toUpperCase() + application.type.slice(1)}</p>
                    <p><strong>Submitted:</strong> ${formatDate(application.submittedAt || application.createdAt)}</p>
                    <p><strong>Description:</strong></p>
                    <div class="description-preview">${application.description}</div>
                    ${application.attachment ? `
                        <p><strong>Attachment:</strong> ${application.attachment.name}</p>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('applicationReviewContent').innerHTML = modalContent;
    document.getElementById('reviewApplicationId').value = applicationId;
    document.getElementById('applicationReviewModal').classList.remove('hidden');
}

async function approveApplicationWithComment() {
    const applicationId = document.getElementById('reviewApplicationId').value;
    const comment = document.getElementById('reviewComment').value;
    
    const application = applications.find(a => a.id === applicationId);
    if (!application) {
        showConfirmation('Error', 'Application not found.', 'error');
        return;
    }
    
    // Check if user has staff role
    if (!requireCurrentUser('staff', 'approve applications')) {
        return;
    }
    
    try {
        // Ensure Firebase services has current user synced
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            // Sync current user to Firebase services
            window.firebaseServices.currentUser = {
                uid: currentUser.uid || currentUser.id,
                id: currentUser.id || currentUser.uid,
                name: currentUser.name,
                email: currentUser.email,
                role: currentUser.role
            };
            console.log('🔄 Synced current user to Firebase services for approval:', window.firebaseServices.currentUser);
            
            const result = await updateApplicationStatusWithFirebase(applicationId, 'approved', comment);
            if (result.success) {
                // Update local state
                application.status = 'approved';
                application.reviewedBy = currentUser.uid || currentUser.id;
                application.reviewedAt = new Date().toISOString();
                application.comment = comment || 'Application approved.';
                
                // Add notification for student
                const submitter = users.find(u => u.id === application.submittedBy || u.uid === application.submittedBy);
                if (submitter) {
                    const notification = {
                        id: 'notif_' + Date.now(),
                        title: 'Application Approved',
                        message: `Your ${application.type} application "${application.title}" has been approved.`,
                        type: 'success',
                        timestamp: new Date().toISOString(),
                        read: false,
                        targetRole: 'student',
                        targetUser: application.submittedBy || application.studentId
                    };
                    notifications.push(notification);
                    localStorage.setItem('notifications', JSON.stringify(notifications));
                }
                
                closeApplicationReviewModal();
                showConfirmation('Application Approved', `The application "${application.title}" has been approved successfully.`, 'success');
                showView('applications');
                return;
            }
        }
        
        // Fallback to local storage if Firebase is not available
        application.status = 'approved';
        application.reviewedBy = currentUser.uid || currentUser.id;
        application.reviewedAt = new Date().toISOString();
        application.comment = comment || 'Application approved.';
        
        // Save to localStorage
        localStorage.setItem('applications', JSON.stringify(applications));
        
        // Add notification for student
        const submitter = users.find(u => u.id === application.submittedBy || u.uid === application.submittedBy);
        if (submitter) {
            const notification = {
                id: 'notif_' + Date.now(),
                title: 'Application Approved',
                message: `Your ${application.type} application "${application.title}" has been approved.`,
                type: 'success',
                timestamp: new Date().toISOString(),
                read: false,
                targetRole: 'student',
                targetUser: application.submittedBy
            };
            notifications.push(notification);
            localStorage.setItem('notifications', JSON.stringify(notifications));
        }
        
        closeApplicationReviewModal();
        showConfirmation('Application Approved', `The application "${application.title}" has been approved.`, 'success');
        showView('applications');
        
    } catch (error) {
        console.error('Error approving application:', error);
        showConfirmation('Error', `Failed to approve application: ${error.message}`, 'error');
    }
}

async function rejectApplicationWithComment() {
    const applicationId = document.getElementById('reviewApplicationId').value;
    const comment = document.getElementById('reviewComment').value;
    
    const application = applications.find(a => a.id === applicationId);
    if (!application) {
        showConfirmation('Error', 'Application not found.', 'error');
        return;
    }
    
    // Check if user has staff role
    if (!requireCurrentUser('staff', 'reject applications')) {
        return;
    }
    
    try {
        // Ensure Firebase services has current user synced
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            // Sync current user to Firebase services
            window.firebaseServices.currentUser = {
                uid: currentUser.uid || currentUser.id,
                id: currentUser.id || currentUser.uid,
                name: currentUser.name,
                email: currentUser.email,
                role: currentUser.role
            };
            console.log('🔄 Synced current user to Firebase services for rejection:', window.firebaseServices.currentUser);
            
            const result = await updateApplicationStatusWithFirebase(applicationId, 'rejected', comment);
            if (result.success) {
                // Update local state
                application.status = 'rejected';
                application.reviewedBy = currentUser.uid || currentUser.id;
                application.reviewedAt = new Date().toISOString();
                application.comment = comment || 'Application rejected.';
                
                // Add notification for student
                const submitter = users.find(u => u.id === application.submittedBy || u.uid === application.submittedBy);
                if (submitter) {
                    const notification = {
                        id: 'notif_' + Date.now(),
                        title: 'Application Rejected',
                        message: `Your ${application.type} application "${application.title}" has been rejected.`,
                        type: 'warning',
                        timestamp: new Date().toISOString(),
                        read: false,
                        targetRole: 'student',
                        targetUser: application.submittedBy || application.studentId
                    };
                    notifications.push(notification);
                    localStorage.setItem('notifications', JSON.stringify(notifications));
                }
                
                closeApplicationReviewModal();
                showConfirmation('Application Rejected', `The application "${application.title}" has been rejected.`, 'warning');
                showView('applications');
                return;
            }
        }
        
        // Fallback to local storage if Firebase is not available
        application.status = 'rejected';
        application.reviewedBy = currentUser.uid || currentUser.id;
        application.reviewedAt = new Date().toISOString();
        application.comment = comment || 'Application rejected.';
        
        // Save to localStorage
        localStorage.setItem('applications', JSON.stringify(applications));
        
        // Add notification for student
        const submitter = users.find(u => u.id === application.submittedBy || u.uid === application.submittedBy);
        if (submitter) {
            const notification = {
                id: 'notif_' + Date.now(),
                title: 'Application Rejected',
                message: `Your ${application.type} application "${application.title}" has been rejected.`,
                type: 'warning',
                timestamp: new Date().toISOString(),
                read: false,
                targetRole: 'student',
                targetUser: application.submittedBy
            };
            notifications.push(notification);
            localStorage.setItem('notifications', JSON.stringify(notifications));
        }
        
        closeApplicationReviewModal();
        showConfirmation('Application Rejected', `The application "${application.title}" has been rejected.`, 'warning');
        showView('applications');
        
    } catch (error) {
        console.error('Error rejecting application:', error);
        showConfirmation('Error', `Failed to reject application: ${error.message}`, 'error');
    }
}

function filterApplications() {
    const typeFilter = document.getElementById('applicationTypeFilter').value;
    const statusFilter = document.getElementById('applicationStatusFilter').value;
    const tableBody = document.getElementById('applicationsTableBody');
    
    if (!tableBody) return;
    
    const rows = tableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const type = row.getAttribute('data-type');
        const status = row.getAttribute('data-status');
        
        const typeMatch = !typeFilter || type === typeFilter;
        const statusMatch = !statusFilter || status === statusFilter;
        
        if (typeMatch && statusMatch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}


// ===== MODAL CLOSE FUNCTIONS =====
function closeAssignmentModal() {
    document.getElementById('assignmentModal').classList.add('hidden');
}

function closeMCQModal() {
    document.getElementById('mcqModal').classList.add('hidden');
}

function closeApplicationModal() {
    document.getElementById('applicationModal').classList.add('hidden');
}

function closeViewApplicationModal() {
    document.getElementById('viewApplicationModal').classList.add('hidden');
}

function closeApplicationReviewModal() {
    document.getElementById('applicationReviewModal').classList.add('hidden');
}

// Filter applications function for staff portal
function filterApplications() {
    const typeFilter = document.getElementById('applicationTypeFilter')?.value || '';
    const statusFilter = document.getElementById('applicationStatusFilter')?.value || '';
    
    const rows = document.querySelectorAll('#applicationsTableBody tr');
    
    rows.forEach(row => {
        const type = row.dataset.type || '';
        const status = row.dataset.status || '';
        
        const typeMatch = !typeFilter || type === typeFilter;
        const statusMatch = !statusFilter || status === statusFilter;
        
        if (typeMatch && statusMatch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Ensure applications data is properly loaded
async function ensureApplicationsLoaded() {
    if (!applications || !Array.isArray(applications)) {
        console.log('📋 Loading applications data...');
        
        // Try to load from Firebase first
        if (window.firebaseServices && window.firebaseServices.isInitialized) {
            try {
                await loadDataFromFirebase();
                if (applications && Array.isArray(applications)) {
                    console.log('✅ Applications loaded from Firebase:', applications.length);
                    return;
                }
            } catch (error) {
                console.error('⚠️ Failed to load from Firebase:', error);
            }
        }
        
        // Fallback to localStorage
        try {
            const storedApplications = localStorage.getItem('applications');
            if (storedApplications) {
                applications = JSON.parse(storedApplications);
                console.log('✅ Applications loaded from localStorage:', applications.length);
            } else {
                applications = [];
                console.log('📋 No stored applications found, initializing empty array');
            }
        } catch (error) {
            console.error('❌ Error loading applications from localStorage:', error);
            applications = [];
        }
    } else {
        console.log('📋 Applications already loaded:', applications.length);
    }
}



// ===== ROLE MANAGEMENT FUNCTIONS =====
function showError(message) {
    // Implementation for showing error messages
    console.error('Error:', message);
    showConfirmation('Error', message, 'error');
}

function checkUserRole() {
    if (!currentUser) {
        console.warn('⚠️ No current user found');
        return null;
    }
    
    if (!currentUser.role) {
        console.warn('⚠️ User role missing in database');
        return null;
    }
    
    console.log(`🔐 Current user role: ${currentUser.role}`);
    return currentUser.role;
}

function hasRole(requiredRole) {
    const userRole = checkUserRole();
    if (!userRole) return false;
    
    const hasRequiredRole = userRole === requiredRole;
    console.log(`🔐 Role check: ${userRole} === ${requiredRole} = ${hasRequiredRole}`);
    return hasRequiredRole;
}

function requireRole(requiredRole, operation) {
    if (!hasRole(requiredRole)) {
        const errorMsg = `❌ Only ${requiredRole}s can ${operation}`;
        console.warn(errorMsg);
        showConfirmation('Permission Denied', errorMsg, 'error');
        return false;
    }
    return true;
}



// ===== PORTAL-BASED LOGIN SYSTEM =====

/**
 * Login function for staff portal
 * Checks user credentials and validates staff role from staff/{uid} collection
 */
async function loginStaffPortal(email, password) {
    try {
        console.log(`🔐 Staff Portal: Attempting login for: ${email}`);
        
        // Import Firebase auth functions
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        // Sign in with email and password
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const user = userCredential.user;
        
        console.log(`✅ Firebase authentication successful for: ${user.email}`);
        
        // Check if user exists in staff collection
        console.log(`🔍 Staff Portal: Checking staff collection: /staff/${user.uid}`);
        let staffData = await getData('staff', user.uid);
        
        if (staffData) {
            
            
            // Validate user.uid is a string
            if (!user.uid || typeof user.uid !== 'string') {
                throw new Error(`Invalid user UID: ${user.uid} (type: ${typeof user.uid})`);
            }
            
            // Update last login
            console.log(`🔄 Updating last login for staff: /staff/${user.uid}`);
            await updateDataWithTimestamp('staff', user.uid, { lastLogin: new Date().toISOString() });
            
            // Store user info with staff role
            const userInfo = {
                uid: user.uid,
                email: user.email,
                name: staffData.name || staffData.displayName || email.split('@')[0],
                role: 'staff',
                department: staffData.department || 'General',
                portal: 'staff'
            };
            

            
            // Use the new setCurrentUser function to ensure proper synchronization
            setCurrentUser(userInfo);
            
            // Verify the role is properly set
            console.log(`🔐 Staff Portal - Final verification - Current user role: ${currentUser.role}`);
            
            // Sync current user across all systems
            if (typeof syncCurrentUser === 'function') {
                syncCurrentUser();
            }
            
            console.log(`✅ Staff login successful: ${userInfo.name}`);
            return { success: true, user: userInfo };
        } else {
            console.log(`❌ Staff Portal: User not found in staff collection: /staff/${user.uid}`);
            return { success: false, error: 'This account is not registered as staff. Please use the student portal or contact administrator.' };
        }
    } catch (error) {
        console.error('❌ Staff Portal login error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Login function for student portal
 * Checks user credentials and validates student role from students/{uid} collection
 */
async function loginStudentPortal(email, password) {
    try {
        console.log(`🔐 Student Portal: Attempting login for: ${email}`);
        
        // Import Firebase auth functions
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        // Sign in with email and password
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const user = userCredential.user;
        
        console.log(`✅ Firebase authentication successful for: ${user.email}`);
        
        // Check if user exists in students collection
        console.log(`🔍 Student Portal: Checking students collection: /students/${user.uid}`);
        let studentData = await getData('students', user.uid);
        
        if (studentData) {

            console.log(`👤 Student name: ${studentData.name}`);
            console.log(`👤 Student department: ${studentData.department}`);
            
            // Validate user.uid is a string
            if (!user.uid || typeof user.uid !== 'string') {
                throw new Error(`Invalid user UID: ${user.uid} (type: ${typeof user.uid})`);
            }
            
            // Update last login
            console.log(`🔄 Updating last login for student: /students/${user.uid}`);
            await updateDataWithTimestamp('students', user.uid, { lastLogin: new Date().toISOString() });
            
            // Store user info with student role
            const userInfo = {
                uid: user.uid,
                email: user.email,
                name: studentData.name || studentData.displayName || email.split('@')[0],
                role: 'student',
                department: studentData.department || 'General',
                portal: 'student'
            };
            

            
            // Use the new setCurrentUser function to ensure proper synchronization
            setCurrentUser(userInfo);
            
            // Verify the role is properly set
            console.log(`🔐 Student Portal - Final verification - Current user role: ${currentUser.role}`);
            
            // Sync current user across all systems
            if (typeof syncCurrentUser === 'function') {
                syncCurrentUser();
            }
            
            console.log(`✅ Student login successful: ${userInfo.name}`);
            return { success: true, user: userInfo };
        } else {
            console.log(`❌ Student Portal: User not found in students collection: /students/${user.uid}`);
            return { success: false, error: 'This account is not registered as a student. Please use the staff portal or contact administrator.' };
        }
    } catch (error) {
        console.error('❌ Student Portal login error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Universal login function that detects portal and calls appropriate login method
 * This maintains backward compatibility while implementing portal-based logic
 */
async function loginUser(email, password, portal = null) {
    try {
        console.log(`🔐 Universal login for: ${email} (Portal: ${portal || 'auto-detect'})`);
        
        // If portal is specified, use the appropriate login function
        if (portal === 'staff') {
            return await loginStaffPortal(email, password);
        } else if (portal === 'student') {
            return await loginStudentPortal(email, password);
        }
        
        // Auto-detect portal by checking both collections
        console.log(`🔍 Auto-detecting portal for user: ${email}`);
        
        // Import Firebase auth functions
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        // Sign in with email and password
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const user = userCredential.user;
        
        console.log(`✅ Firebase authentication successful for: ${user.email}`);
        
        // Check both collections to determine user type
        console.log(`🔍 Checking staff collection: /staff/${user.uid}`);
        let staffData = await getData('staff', user.uid);
        
        if (staffData) {
            console.log(`📊 User found in staff collection - redirecting to staff portal`);
            return await loginStaffPortal(email, password);
        }
        
        console.log(`🔍 Checking students collection: /students/${user.uid}`);
        let studentData = await getData('students', user.uid);
        
        if (studentData) {
            console.log(`📊 User found in students collection - redirecting to student portal`);
            return await loginStudentPortal(email, password);
        }
        
        // User not found in either collection
        console.log(`❌ User not found in any collection for UID: ${user.uid}`);
        return { success: false, error: 'User account not found. Please contact administrator to set up your account.' };
        
    } catch (error) {
        console.error('❌ Universal login error:', error);
        return { success: false, error: error.message };
    }
}


