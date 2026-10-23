// Carga un CSV de fichas y deja la sala lista: "Empezar de cero" + reemplazar la tabla de fichas.
// Lo mismo que hacer en el cajón: Empezar de cero → Importar CSV → Reemplazar la tabla.
//   node --env-file=.env scripts/cargar-fichas.mjs --csv=src/datos/fichas.csv --clave=CONTRASEÑA
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, getFirestore, terminate } from 'firebase/firestore'
import { empezarDeCero, prepararSala, reemplazarFichas } from '../src/lib/acciones-pantalla.js'
import { leerFichas } from '../src/lib/csv.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const app = initializeApp({
  apiKey: process.env.VITE_FB_API_KEY,
  authDomain: process.env.VITE_FB_AUTH_DOMAIN,
  projectId: process.env.VITE_FB_PROJECT_ID,
})
await signInWithEmailAndPassword(getAuth(app), 'anfitrion@metodologias-fichas.uace', args.clave)
const db = getFirestore(app)

const { fichas, resumen } = leerFichas(readFileSync(args.csv, 'utf8'))
console.log(`${resumen.total} fichas · ${resumen.jugables} para jugar · ${resumen.excluidas} excluidas`)
console.log('inválidas:', resumen.invalidas.map((f) => `${f.nombre} («${f.nivel}»)`).join(', ') || 'ninguna')

let estado = (await getDoc(doc(db, 'juego/estado'))).data()
if (!estado) estado = await prepararSala(db, [])
const viejas = (await getDocs(collection(db, 'fichas'))).docs.map((d) => d.data())
await empezarDeCero(db, estado, viejas.filter((f) => f.estado !== 'retirada'))
estado = (await getDoc(doc(db, 'juego/estado'))).data()
await reemplazarFichas(db, estado, fichas, viejas)
console.log(`Listo: generación ${estado.generacion}, código de sala ${estado.codigoSala}`)
await terminate(db)
process.exit(0)
