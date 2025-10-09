// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// --- Vite env (adicione as chaves na Vercel e .env local) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ---------- Auth helpers ----------
export function listenAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return signOut(auth);
}

export async function forceChangePassword(newPassword: string) {
  if (!auth.currentUser) throw new Error("Sem usuário logado");
  await updatePassword(auth.currentUser, newPassword);
}

// ---------- Users (perfil/flags em Firestore) ----------
export type AppRole = "admin" | "user";
export type AppUserDoc = {
  name: string;
  email: string;
  role: AppRole;
  mustChangePassword?: boolean; // força troca após primeiro login
};

export async function ensureUserDoc(uid: string, payload: AppUserDoc) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { ...payload }, { merge: true });
}

export async function getUserDoc(uid: string) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as AppUserDoc) : null;
}

export async function markMustChange(uid: string, value: boolean) {
  await updateDoc(doc(db, "users", uid), { mustChangePassword: value });
}

// ---------- Empreendimentos ----------
export type Foto = { id: string; url: string; descricao?: string };
export type Emp = {
  id?: string;
  nome: string;
  endereco: string;
  lat?: number;
  lng?: number;
  descricao?: string;
  capaUrl?: string;
  fotos: Foto[];
  unidade?: string;
  n_unidade?: string;
  area_privativa_m2?: number;
  area_comum_m2?: number;
  area_aberta_m2?: number;
  total_m2?: number;
  area_interna_rs?: number;
  area_externa_rs?: number;
  total_rs?: number;
  entrada_rs?: number;
  reforco_rs?: number;
  parcelas_rs?: number;
  entrega_chaves_rs?: number;
  createdAt?: any;
};

export function listenEmpreendimentos(
  cb: (docs: (Emp & { id: string })[]) => void
) {
  const q = query(collection(db, "empreendimentos"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Emp) }));
    cb(list);
  });
}

export async function addEmpreendimento(emp: Emp) {
  const col = collection(db, "empreendimentos");
  const docRef = await addDoc(col, { ...emp, createdAt: serverTimestamp() });
  return docRef.id;
}

export async function deleteEmpreendimento(id: string) {
  // apaga fotos da pasta desse empreendimento (capa + album)
  try {
    const capaRef = ref(storage, `empreendimentos/${id}/capa.jpg`);
    await deleteObject(capaRef);
  } catch {}
  // como as fotos do álbum têm nomes variáveis, no beta não listamos;
  // se você guardar os paths no Firestore, pode apagar cada uma aqui.

  await deleteDoc(doc(db, "empreendimentos", id));
}

// ---------- Upload helpers ----------
export async function uploadCapaFromDataURL(empId: string, dataURL: string) {
  const r = ref(storage, `empreendimentos/${empId}/capa.jpg`);
  await uploadString(r, dataURL, "data_url");
  return getDownloadURL(r);
}

export async function uploadFotoFromDataURL(
  empId: string,
  fotoId: string,
  dataURL: string
) {
  const r = ref(storage, `empreendimentos/${empId}/album/${fotoId}.jpg`);
  await uploadString(r, dataURL, "data_url");
  return getDownloadURL(r);
}
