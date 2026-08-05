import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, collection, addDoc, query, orderBy, limit, getDocs, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// ─── Google Workspace access (Calendar + Gmail) ──────────────────────────────
// Rather than running a second OAuth flow, we ask for the extra scopes during
// the Google sign-in that already happens. The user consents once.
//
// LIMITATION worth knowing: Firebase web auth returns an access token but no
// refresh token, so this expires after roughly an hour. When it does, calendar
// and mail tools fail with a clear "sign in again" message rather than
// silently doing nothing. Fixing that properly needs a real OAuth server flow.
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.modify');

let googleAccessToken: string | null = null;
let googleTokenAcquiredAt = 0;
const TOKEN_ASSUMED_LIFETIME_MS = 55 * 60 * 1000; // Google's is ~60min; expire early

export function setGoogleAccessToken(token: string | null) {
  googleAccessToken = token;
  googleTokenAcquiredAt = token ? Date.now() : 0;
}

export function getGoogleAccessToken(): string | null {
  if (!googleAccessToken) return null;
  if (Date.now() - googleTokenAcquiredAt > TOKEN_ASSUMED_LIFETIME_MS) {
    googleAccessToken = null;
    return null;
  }
  return googleAccessToken;
}

/** Shared fetch wrapper for Google REST APIs. */
export async function googleApiFetch(url: string, init: RequestInit = {}) {
  const token = getGoogleAccessToken();
  if (!token) {
    return {
      ok: false,
      needsAuth: true,
      error: 'Google access has expired. Ask the user to sign out and sign back in to reconnect Calendar and Gmail.',
    } as const;
  }

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

    if (res.status === 401 || res.status === 403) {
      setGoogleAccessToken(null);
      return {
        ok: false,
        needsAuth: true,
        error: 'Google denied the request — the sign-in may have expired or the permission was not granted. Ask the user to sign out and back in.',
      } as const;
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, needsAuth: false, error: body?.error?.message || `Google API error ${res.status}` } as const;
    }
    return { ok: true, data: body } as const;
  } catch (e: any) {
    return { ok: false, needsAuth: false, error: e.message || 'Network error contacting Google.' } as const;
  }
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Memory Service
export const memoryService = {
  async getUserMemory(uid: string) {
    const path = `users/${uid}/memory/main`;
    try {
      const docRef = doc(db, path);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  async saveFact(uid: string, fact: string) {
    const path = `users/${uid}/memory/main`;
    try {
      const docRef = doc(db, path);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, {
          uid,
          facts: [fact],
          lastInteraction: new Date().toISOString(),
          preferences: {}
        });
      } else {
        await updateDoc(docRef, {
          facts: arrayUnion(fact),
          lastInteraction: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getRecentSummaries(uid: string, count = 3) {
    const path = `users/${uid}/summaries`;
    try {
      const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(count));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async saveSummary(uid: string, summary: string) {
    const path = `users/${uid}/summaries`;
    try {
      await addDoc(collection(db, path), {
        uid,
        summary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateFacts(uid: string, facts: string[]) {
    const path = `users/${uid}/memory/main`;
    try {
      const docRef = doc(db, path);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, { uid, facts, lastInteraction: new Date().toISOString(), preferences: {} });
      } else {
        await updateDoc(docRef, { facts, lastInteraction: new Date().toISOString() });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async updateCustomInstructions(uid: string, customInstructions: string) {
    const path = `users/${uid}/memory/main`;
    try {
      const docRef = doc(db, path);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, { uid, facts: [], customInstructions, lastInteraction: new Date().toISOString(), preferences: {} });
      } else {
        await updateDoc(docRef, { customInstructions, lastInteraction: new Date().toISOString() });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // ─── People ────────────────────────────────────────────────────────────────
  // Structured memory about the humans in the user's life. `facts` is a flat
  // string list, which can't answer "who is Priya?" — this can. Stored one doc
  // per person under users/{uid}/people so it scales past the 100-fact cap.

  async savePerson(uid: string, person: {
    name: string; relationship?: string; details?: string[];
  }) {
    const key = person.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const path = `users/${uid}/people/${key}`;
    try {
      const docRef = doc(db, path);
      const docSnap = await getDoc(docRef);
      const now = new Date().toISOString();

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          uid,
          name: person.name.trim(),
          relationship: person.relationship || '',
          details: person.details || [],
          updatedAt: now,
        });
      } else {
        const existing = docSnap.data();
        // Merge new details in rather than replacing — each mention typically
        // adds one thing, and we don't want it to clobber prior knowledge.
        const merged = Array.from(new Set([...(existing.details || []), ...(person.details || [])])).slice(0, 40);
        await updateDoc(docRef, {
          name: person.name.trim(),
          relationship: person.relationship || existing.relationship || '',
          details: merged,
          updatedAt: now,
        });
      }
      return key;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getPeople(uid: string, count = 50) {
    const path = `users/${uid}/people`;
    try {
      const q = query(collection(db, path), orderBy('updatedAt', 'desc'), limit(count));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },
};
