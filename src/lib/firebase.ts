// src/lib/firebase.ts
// Firebase bootstrap + helpers
// - ignoreUndefinedProperties habilitado
// - addEmpreendimento sanitiza campos undefined

import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

// ---------- Tipos ----------
export type Foto = {
  id: string;
  url: string;
  descricao?: string;
};

export type Emp = {
  id?: string;
  nome: string;
  endereco?: string;
  lat?: number;
  lng?: number;
  descricao?: string;

  // Ficha técnica
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

  // Imagens
  capaUrl?: string | null;
  fotos?: Foto[];
};

export type AppUserDoc = {
  name: string;
  email: string;
  role: "admin" | "user";
  mustChangePassword: boolean;
};

// ---------- Config ----------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// **Ignora campos undefined nos writes**
initializeFirestore(app, { ignoreUndefinedProperties: true });
export const db = getFirestore(app);

// Auth
export const auth = getAuth(app);

// ---------- Auth helpers ----------
export function listenAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function login(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
}

// ---------- Users (coleção `users`) ----------
export async function getUserDoc(uid: string): Promise<AppUserDoc | null> {
  const d = await getDoc(doc(db, "users", uid));
  return d.exists() ? (d.data() as AppUserDoc) : null;
}

export async function ensureUserDoc(uid: string, data: AppUserDoc) {
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

// ---------- Empreendimentos ----------

// remove undefined do nível superior
function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export function listenEmpreendimentos(cb: (arr: (Emp & { id: string })[]) => void) {
  const q = query(collection(db, "empreendimentos"), orderBy("nome"));
  return onSnapshot(q, (snap) => {
    const out: (Emp & { id: string })[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...(d.data() as Emp) }));
    cb(out);
  });
}

export async function addEmpreendimento(emp: Emp): Promise<string> {
  // limpa undefined e garante defaults seguros
  const payload = cleanUndefined({
    ...emp,
    capaUrl: emp.capaUrl ?? null,
    fotos: emp.fotos ?? [],
  });
  const ref = await addDoc(collection(db, "empreendimentos"), payload);
  return ref.id;
}

export async function deleteEmpreendimento(id: string) {
  await deleteDoc(doc(db, "empreendimentos", id));
}
