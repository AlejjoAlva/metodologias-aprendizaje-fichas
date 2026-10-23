// Bitácora: lo que pasó, quién lo hizo y cuándo, para diagnosticar pruebas y partidas.
// Una escritura por evento importante (no por clic). Solo la lee el anfitrión.
// Informe: node --env-file=.env scripts/bitacora.mjs --clave=CONTRASEÑA
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

/** Quién escribe desde este proceso: la pantalla por defecto; los scripts lo cambian a 'script'. */
export const origen = { quien: 'pantalla' }

// Tope por sesión para que un celular con problemas no gaste cuota en bucle.
const TOPE = 40
let enviados = 0

/**
 * quien: 'pantalla' | 'celular' | 'script'. tipo: palabra corta ('entrada', 'nueva_partida', 'error'…).
 * contexto: { uid, personaId, nombre, estado } (todo opcional).
 */
export function registrar(db, quien, tipo, detalle = '', contexto = {}) {
  const e = contexto.estado
  const fila = {
    t: serverTimestamp(),
    quien,
    tipo: String(tipo).slice(0, 40),
    detalle: String(detalle ?? '').slice(0, 400),
    uid: contexto.uid ?? null,
    personaId: contexto.personaId ?? null,
    nombre: contexto.nombre ?? null,
    generacion: e?.generacion ?? null,
    fase: e?.fase ?? null,
    turno: e?.turno ?? null,
  }
  console.info('[bitácora]', quien, tipo, detalle)
  if (quien === 'celular' && enviados >= TOPE) return Promise.resolve()
  enviados++
  return addDoc(collection(db, 'bitacora'), fila).catch((err) => console.warn('bitácora', err))
}

/** Texto corto de un error para la bitácora. */
export const textoError = (e) => `${e?.code ?? e?.name ?? 'error'}: ${e?.message ?? e}`.slice(0, 400)
