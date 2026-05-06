import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, collection, addDoc, query, orderBy, limit, getDocs, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

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
  }
};
