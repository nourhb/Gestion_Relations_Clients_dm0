// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore"; // Added Firestore
import { getStorage, type FirebaseStorage } from "firebase/storage"; // Added Firebase Storage

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if all essential Firebase config values are present.
const areAllConfigValuesPresent = 
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    // Prevent placeholder values from being treated as valid
    !Object.values(firebaseConfig).some(v => v?.includes('REPLACE_WITH_YOUR'));

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

if (areAllConfigValuesPresent) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
    storageInstance = getStorage(app);
  } catch (error) {
    console.error("[CRITICAL] Firebase initialization failed with an exception, even though keys were present. Check if keys are valid.", error);
    app = null;
    authInstance = null;
    dbInstance = null;
    storageInstance = null;
  }
} else {
  console.error(`
    ********************************************************************************
    *** FIREBASE NOT CONFIGURED ***
    * Firebase configuration is missing or contains placeholder values.
    * Please ensure you have a .env.local file in the project root
    * with all NEXT_PUBLIC_FIREBASE_... variables set correctly.
    * You must restart the Next.js development server after editing .env.local.
    ********************************************************************************
  `);
}

// Export potentially null instances. The application must handle these cases gracefully.
export const auth = authInstance;
export const db = dbInstance;
export const storage = storageInstance;
export const firebaseApp = app;
export const isFirebaseConfigured = !!app; // Export a boolean for easy checking

export default app;
