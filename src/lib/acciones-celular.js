// Escrituras del celular. Reciben `db` (y `rtdb` para la presencia) para poder usarse desde
// los scripts de simulación en Node.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { onDisconnect, onValue, ref, set } from 'firebase/database'
import { nombreUnico } from './juego.js'

export const codigoPersonal = (rnd = Math.random) => String(Math.floor(rnd() * 10000)).padStart(4, '0')

/** Inscribe a la persona con su uid como id. Devuelve { personaId, nombre, codigo }. */
export async function inscribirse(db, uid, estado, nombre, rnd = Math.random) {
  const snap = await getDocs(query(collection(db, 'personas'), where('generacion', '==', estado.generacion)))
  const final = nombreUnico(nombre, snap.docs.map((d) => d.data().nombre))
  const codigo = codigoPersonal(rnd)
  const batch = writeBatch(db)
  batch.set(doc(db, 'personas', uid), {
    nombre: final,
    uids: [uid],
    codigoSala: estado.codigoSala,
    generacion: estado.generacion,
    creado: serverTimestamp(),
    paso: false,
    ausente: false,
  })
  batch.set(doc(db, 'codigos', uid), { codigo })
  await batch.commit()
  return { personaId: uid, nombre: final, codigo }
}

/** Busca si este navegador ya está inscrito en la generación vigente. */
export async function buscarPersona(db, uid, personaGuardada, generacion) {
  for (const id of [personaGuardada, uid].filter(Boolean)) {
    const snap = await getDoc(doc(db, 'personas', id))
    if (snap.exists() && snap.data().generacion === generacion && snap.data().uids.includes(uid))
      return { id, ...snap.data() }
  }
  return null
}

export async function pedirRecuperacion(db, uid, nombre, codigo) {
  await setDoc(doc(db, 'reclamos', uid), { nombre: nombre.trim(), codigo: codigo.trim(), creado: serverTimestamp() })
}

export const idRespuesta = (estado, personaId) =>
  `${estado.generacion}_${estado.turno}_${estado.fase}_${personaId}`

/** Una respuesta por fase. Las reglas rechazan duplicados y respuestas fuera de tiempo. */
export async function responder(db, uid, personaId, estado, valores) {
  await setDoc(doc(db, 'respuestas', idRespuesta(estado, personaId)), {
    uid,
    personaId,
    generacion: estado.generacion,
    turno: estado.turno,
    fase: estado.fase,
    valores,
    creado: serverTimestamp(),
  })
}

export async function yaRespondi(db, estado, personaId) {
  try {
    const snap = await getDoc(doc(db, 'respuestas', idRespuesta(estado, personaId)))
    return snap.exists() ? snap.data().valores : null
  } catch {
    return null // no existe → las reglas niegan leerlo; equivale a "no respondí"
  }
}

export async function elegirPostura(db, estado, eleccion) {
  await setDoc(doc(db, 'postura', `${estado.generacion}_${estado.turno}`), { eleccion })
}

export async function enviarSentimiento(db, uid, personaId, estado, s) {
  await setDoc(doc(db, 'sentimiento', uid), {
    personaId,
    generacion: estado.generacion,
    turno: estado.turno,
    barra: s.barra,
    movio: s.movio,
    reacciones: s.reacciones,
  })
}

/**
 * Presencia: marca al conectar y el servidor la borra solo cuando se cae la conexión.
 * Devuelve la función para dejar de escuchar.
 */
export function marcarPresencia(rtdb, uid, personaId) {
  const mio = ref(rtdb, `presencia/${uid}`)
  return onValue(ref(rtdb, '.info/connected'), (snap) => {
    if (snap.val() !== true) return
    onDisconnect(mio)
      .remove()
      .then(() => set(mio, { personaId, t: Date.now() }))
      .catch((err) => console.warn('presencia', err))
  })
}
