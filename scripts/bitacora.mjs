// Informe de la bitácora: qué pasó, quién y cuándo (hora de Bogotá).
//   node --env-file=.env scripts/bitacora.mjs --clave=CONTRASEÑA [--horas=6] [--solo=errores]
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { Timestamp, collection, getDocs, getFirestore, orderBy, query, terminate, where } from 'firebase/firestore'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const app = initializeApp({
  apiKey: process.env.VITE_FB_API_KEY,
  authDomain: process.env.VITE_FB_AUTH_DOMAIN,
  projectId: process.env.VITE_FB_PROJECT_ID,
})
await signInWithEmailAndPassword(getAuth(app), 'anfitrion@metodologias-fichas.uace', args.clave)
const db = getFirestore(app)
const desde = Timestamp.fromMillis(Date.now() - Number(args.horas || 6) * 3600e3)
const snap = await getDocs(query(collection(db, 'bitacora'), where('t', '>=', desde), orderBy('t')))
const hora = (t) => t?.toDate().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: false }) ?? '--:--:--'
let filas = snap.docs.map((d) => d.data())
if (args.solo === 'errores') filas = filas.filter((f) => /error|rechaz|nueva_partida|empezar_de_cero|sin_internet|ya_hecho/.test(f.tipo))
for (const f of filas)
  console.log(
    `${hora(f.t)}  ${f.quien.padEnd(8)} ${f.tipo.padEnd(22)} ${f.nombre ? `[${f.nombre}] ` : ''}` +
      `${f.generacion != null ? `g${f.generacion}/t${f.turno}/${f.fase} ` : ''}${f.detalle}`,
  )
const cuenta = filas.reduce((m, f) => ((m[f.tipo] = (m[f.tipo] || 0) + 1), m), {})
console.log(`\n${filas.length} eventos:`, cuenta)
await terminate(db)
process.exit(0)
