// ===== SECURITY CONFIGURATION =====
// Security settings and constants for E-Workspace

const SECURITY_CONFIG = {
    // Input validation limits
    MAX_TITLE_LENGTH: 100,
    MIN_TITLE_LENGTH: 3,
    MAX_DESCRIPTION_LENGTH: 2000,
    MIN_DESCRIPTION_LENGTH: 10,
    MAX_SUBMISSION_LENGTH: 5000,
    MIN_SUBMISSION_LENGTH: 10,
    MAX_FEEDBACK_LENGTH: 1000,
    
    // Score validation
    MAX_SCORE: 1000,
    MIN_SCORE: 0,
    
    // Password requirements
    MIN_PASSWORD_LENGTH: 6,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: false,
    
    // Rate limiting (requests per minute)
    MAX_LOGIN_ATTEMPTS: 5,
    MAX_REGISTRATION_ATTEMPTS: 3,
    MAX_SUBMISSION_ATTEMPTS: 10,
    
    // Session timeout (milliseconds)
    SESSION_TIMEOUT: 3600000, // 1 hour
    
    // File upload limits
    MAX_FILE_SIZE: 10485760, // 10MB
    ALLOWED_FILE_TYPES: ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'],
    
    // XSS Protection
    ALLOWED_HTML_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    STRIP_SCRIPT_TAGS: true,
    
    // CSRF Protection
    CSRF_TOKEN_LENGTH: 32,
    
    // Debug mode
    DEBUG_MODE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    
    // Logging
    LOG_LEVEL: 'INFO', // DEBUG, INFO, WARN, ERROR
    LOG_SECURITY_EVENTS: true,
    
    // Content Security Policy
    CSP_NONCE_LENGTH: 16
};

// Security utility functions
const SecurityUtils = {
    /**
     * Generate CSRF token
     */
    generateCSRFToken() {
        const array = new Uint8Array(SECURITY_CONFIG.CSRF_TOKEN_LENGTH);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },
    
    /**
     * Generate nonce for CSP
     */
    generateNonce() {
        const array = new Uint8Array(SECURITY_CONFIG.CSP_NONCE_LENGTH);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },
    
    /**
     * Validate file type
     */
    isValidFileType(filename) {
        const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return SECURITY_CONFIG.ALLOWED_FILE_TYPES.includes(extension);
    },
    
    /**
     * Validate file size
     */
    isValidFileSize(size) {
        return size <= SECURITY_CONFIG.MAX_FILE_SIZE;
    },
    
    /**
     * Rate limiting check
     */
    checkRateLimit(action, identifier) {
        const key = `${action}_${identifier}`;
        const now = Date.now();
        const window = 60000; // 1 minute
        
        if (!window.rateLimitStore) {
            window.rateLimitStore = new Map();
        }
        
        const attempts = window.rateLimitStore.get(key) || [];
        const recentAttempts = attempts.filter(time => now - time < window);
        
        const maxAttempts = SECURITY_CONFIG[`MAX_${action.toUpperCase()}_ATTEMPTS`] || 5;
        
        if (recentAttempts.length >= maxAttempts) {
            return false;
        }
        
        recentAttempts.push(now);
        window.rateLimitStore.set(key, recentAttempts);
        return true;
    },
    
    /**
     * Log security event
     */
    logSecurityEvent(event, details = {}) {
        if (SECURITY_CONFIG.LOG_SECURITY_EVENTS) {
            console.warn(`🔒 Security Event: ${event}`, {
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                ...details
            });
        }
    }
};

// Export for use in other files
if (typeof window !== 'undefined') {
    window.SECURITY_CONFIG = SECURITY_CONFIG;
    window.SecurityUtils = SecurityUtils;
}

// For Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SECURITY_CONFIG, SecurityUtils };
}
