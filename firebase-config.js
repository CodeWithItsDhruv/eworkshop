// ===== FIREBASE CONFIGURATION =====
// Your Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyCLCYkgj1YAVBK_1GZJi3IzOLOywVhi7AE",
    authDomain: "eworkspace-a18a3.firebaseapp.com",
    databaseURL: "https://eworkspace-a18a3-default-rtdb.firebaseio.com",
    projectId: "eworkspace-a18a3",
    storageBucket: "eworkspace-a18a3.firebasestorage.app",
    messagingSenderId: "237591179986",
    appId: "1:237591179986:web:69c8e0ee1b8df87fc8330b",
    measurementId: "G-NLY0LW5QQZ"
};

// Export the configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseConfig;
} else {
    // For browser usage
    window.firebaseConfig = firebaseConfig;
}

// ===== SETUP INSTRUCTIONS =====
/*
1. Go to Firebase Console: https://console.firebase.google.com/
2. Create a new project or select an existing one
3. Click on the web app icon (</>) to add a web app
4. Register your app with a nickname
5. Copy the configuration object
6. Replace the values in this file
7. Enable Authentication in Firebase Console:
   - Go to Authentication > Sign-in method
   - Enable Email/Password authentication
8. Enable Realtime Database in Firebase Console:
   - Go to Realtime Database
   - Click "Create database"
   - Choose "Start in test mode" for development
   - Select a location for your database
   - Set up database rules for read/write access

Note: For production, make sure to:
- Set up proper Realtime Database security rules
- Configure authentication providers as needed
- Set up proper CORS policies if required
*/
