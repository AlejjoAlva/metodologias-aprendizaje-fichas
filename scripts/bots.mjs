// Celulares falsos que juegan solos, para ensayar la pantalla grande SIN gente.
// Solo contra el emulador (no gasta cuota):
//   npm run emu            (en otra terminal)
//   node scripts/bots.mjs --n=12
// Crea también la cuenta del anfitrión del emulador: anfitrion@metodologias-fichas.uace / clave-del-emulador
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getFirestore, onSnapshot } from 'firebase/firestore'
import { connectDatabaseEmulator, getDatabase } from 'firebase/database'
import { elegirReto, enviarSentimiento, inscribirse, marcarPresencia, responder } from '../src/lib/acciones-celular.js'
import { FASES } from '../src/lib/juego.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const N = Number(args.n || 12)
const PROYECTO = 'demo-fichas'
const NOMBRES = ['Ana', 'Luis', 'Camila', 'Mateo', 'Valentina', 'Santiago', 'Sofía', 'Daniel', 'Laura', 'Andrés',
  'Mariana', 'Felipe', 'Paula', 'Juan', 'Isabella', 'Nicolás', 'Gabriela', 'Sebastián', 'Natalia', 'Tomás',
  'Manuela', 'David', 'Carolina', 'Esteban', 'Lucía', 'Julián', 'Sara', 'Diego', 'Daniela', 'Samuel']

await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROYECTO}/accounts`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ localId: 'anfitrion-fichas-2026', email: 'anfitrion@metodologias-fichas.uace', password: 'clave-del-emulador' }),
})

const azar = (l) => l[Math.floor(Math.random() * l.length)]
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

function cliente(nombre) {
  const app = initializeApp({ apiKey: 'demo', projectId: PROYECTO, databaseURL: `http://127.0.0.1:9000/?ns=${PROYECTO}-default-rtdb` }, nombre)
  const auth = getAuth(app)
  const db = getFirestore(app)
  const rtdb = getDatabase(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectDatabaseEmulator(rtdb, '127.0.0.1', 9000)
  return { auth, db, rtdb }
}

console.log('Esperando a que la pantalla abra la sala…')
const vigia = cliente('vigia')
await signInAnonymously(vigia.auth)
let primerEstado = await new Promise((res) => {
  const stop = onSnapshot(doc(vigia.db, 'juego/estado'), (s) => {
    if (s.exists()) {
      stop()
      res(s.data())
    }
  })
})

async function bot(i) {
  const c = cliente(`bot${i}`)
  const { user } = await signInAnonymously(c.auth)
  const yo = await inscribirse(c.db, user.uid, primerEstado, NOMBRES[i % NOMBRES.length])
  marcarPresencia(c.rtdb, user.uid, yo.personaId)
  const hecho = new Set()
  const opinion = Math.random() // cada bot tiene su tendencia
  onSnapshot(doc(c.db, 'juego/estado'), async (s) => {
    const e = s.data({ serverTimestamps: 'estimate' })
    if (!e) return
    const clave = `${e.generacion}_${e.turno}_${e.fase}`
    const soyOrador = e.oradorId === yo.personaId
    if (e.fase === FASES.RULETA_RETO && soyOrador && e.retoSorteo === 'elige' && !hecho.has(clave)) {
      hecho.add(clave)
      await espera(2000 + Math.random() * 4000)
      elegirReto(c.db, e, azar(['aplicala', 'defiende', 'ataca'])).catch(() => {})
    }
    // El orador solo responde la primera impresión.
    if ((soyOrador && e.fase !== FASES.IMPRESION) || !e.cronoInicio || hecho.has(clave)) return
    if (e.fase === FASES.IMPRESION) {
      hecho.add(clave)
      await espera(1500 + Math.random() * 15000)
      const v = {
        conoce: Math.random() < 0.55,
        util: azar(['si', 'si', 'no', 'ni']),
        prediccion: azar(['Respaldada', 'Debatida', 'Poco respaldada']),
      }
      responder(c.db, user.uid, yo.personaId, e, v).catch(() => {})
    } else if (e.fase === FASES.ARGUMENTO) {
      hecho.add(clave)
      const r = { fuego: 0, duda: 0, cerebro: 0 }
      for (let k = 0; k < 6; k++) {
        await espera(4000 + Math.random() * 4000)
        r[azar(['fuego', 'fuego', 'duda', 'cerebro'])]++
        enviarSentimiento(c.db, user.uid, yo.personaId, e, { reacciones: { ...r } }).catch(() => {})
      }
    } else if (e.fase === FASES.VOTO) {
      hecho.add(clave)
      await espera(1000 + Math.random() * 9000)
      const v = { sirve: Math.random() < 0.3 + opinion * 0.5 ? 'si' : 'no', nota: 1 + Math.floor(Math.random() * 5) }
      responder(c.db, user.uid, yo.personaId, e, v).catch(() => {})
    }
  })
  return yo
}

for (let i = 0; i < N; i++) {
  const yo = await bot(i)
  console.log(`  bot ${yo.nombre} inscrito (código ${yo.codigo})`)
  await espera(300)
}
console.log(`${N} bots jugando. Ctrl+C para terminar.`)
