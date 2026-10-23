import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'

// La config sale de .env. Sin valores por defecto a propósito: si falta alguno, la app lo dice
// en pantalla en vez de arrancar apuntando a un proyecto que no existe.
const CAMPOS = [
  ['apiKey', 'VITE_FB_API_KEY', import.meta.env.VITE_FB_API_KEY],
  ['authDomain', 'VITE_FB_AUTH_DOMAIN', import.meta.env.VITE_FB_AUTH_DOMAIN],
  ['projectId', 'VITE_FB_PROJECT_ID', import.meta.env.VITE_FB_PROJECT_ID],
  ['storageBucket', 'VITE_FB_STORAGE_BUCKET', import.meta.env.VITE_FB_STORAGE_BUCKET],
  ['messagingSenderId', 'VITE_FB_SENDER_ID', import.meta.env.VITE_FB_SENDER_ID],
  ['appId', 'VITE_FB_APP_ID', import.meta.env.VITE_FB_APP_ID],
  ['databaseURL', 'VITE_FB_DATABASE_URL', import.meta.env.VITE_FB_DATABASE_URL],
]

export const CONFIG_FALTANTE = CAMPOS.filter(([, , valor]) => !valor).map(([, env]) => env)

const firebaseConfig = Object.fromEntries(
  CAMPOS.map(([clave, env, valor]) => [clave, valor || `https://falta-${env.toLowerCase()}.invalid`]),
)

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Caché persistente: al recargar, las escuchas se reanudan y Firestore manda solo lo que cambió.
function abrirFirestore() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (err) {
    console.warn('Sin caché persistente; sigo con la de memoria.', err)
    return getFirestore(app)
  }
}

export const db = abrirFirestore()
export const rtdb = getDatabase(app)

export const USANDO_EMULADOR = import.meta.env.VITE_USE_EMULATOR === 'true'

if (USANDO_EMULADOR && !globalThis.__fichasEmulador) {
  globalThis.__fichasEmulador = true
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectDatabaseEmulator(rtdb, '127.0.0.1', 9000)
}

/** Espera a que Auth sepa quién es el usuario (o que no hay nadie). */
export function usuarioActual() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (u) => {
      stop()
      resolve(u)
    })
  })
}

/** Celular: reutiliza el usuario anónimo guardado en el navegador o crea uno. */
export async function asegurarAnonimo() {
  const u = await usuarioActual()
  if (u) return u
  const cred = await signInAnonymously(auth)
  return cred.user
}
