import admin from 'firebase-admin';

if (!admin.apps.length) {
  let serviceAccount;

  // Option A: Use environment variable (recommended for production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (error) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', error);
    }
  }
  // Option B: Use individual environment variables (Vercel friendly)
  else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Handle private key newlines for Vercel
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  // Option C: Use service account file (for local development)
  else {
    try {
      // Use fs to avoid webpack bundling issues
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path');

      const possiblePaths = [
        path.join(process.cwd(), 'firebase-service-account.json'),
        path.join(process.cwd(), '..', 'firebase-service-account.json')
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
          break;
        }
      }

      if (!serviceAccount) {
        console.warn('Firebase service account file not found in standard locations.');
      }
    } catch (error) {
      console.warn('Error loading service account file:', error);
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    // Fallback for build time or if no creds (might fail at runtime if used)
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Initializing Firebase Admin without credentials (this may fail if used).');
    }
    try {
      admin.initializeApp({
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } catch (e) {
      // Ignore re-initialization error
    }
  }
}

export default admin;

