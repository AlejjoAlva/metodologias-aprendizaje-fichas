// Corre dentro del emulador: npm run test:reglas
import { test, before, after, beforeEach } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore'

const reglas = readFileSync('firestore.rules', 'utf8')
const ANFITRION = reglas.match(/request\.auth\.uid == '([^']+)'/)[1]

let env
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-fichas',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8080 },
  })
})
after(() => env.cleanup())

const ahora = () => Timestamp.now()
const haceSeg = (s) => Timestamp.fromMillis(Date.now() - s * 1000)

async function preparar(estado = {}) {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'juego/estado'), {
      fase: 'impresion',
      turno: 1,
      generacion: 0,
      codigoSala: 'ABCD',
      oradorId: 'orador',
      oradorUids: ['orador'],
      cronoInicio: ahora(),
      duracion: 20,
      ...estado,
    })
    await setDoc(doc(db, 'personas/ana'), { nombre: 'Ana', uids: ['ana'], codigoSala: 'ABCD', generacion: 0, paso: false, ausente: false })
    await setDoc(doc(db, 'personas/orador'), { nombre: 'Orador', uids: ['orador'], codigoSala: 'ABCD', generacion: 0, paso: false, ausente: false })
  })
}
beforeEach(() => preparar())

const celular = (uid) => env.authenticatedContext(uid).firestore()
const pantalla = () => env.authenticatedContext(ANFITRION).firestore()

const resp = (extra = {}) => ({
  uid: 'ana',
  personaId: 'ana',
  generacion: 0,
  turno: 1,
  fase: 'impresion',
  valores: { conoce: true, util: 'si', prediccion: 'si' },
  ...extra,
})
const idResp = (r) => `${r.generacion}_${r.turno}_${r.fase}_${r.personaId}`

test('sin sesión no se lee nada', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'juego/estado')))
})

test('un celular no puede mover el juego; el anfitrión sí', async () => {
  await assertFails(updateDoc(doc(celular('ana'), 'juego/estado'), { fase: 'final' }))
  await assertFails(setDoc(doc(celular('ana'), 'fichas/1'), { nombre: 'x' }))
  await assertSucceeds(updateDoc(doc(pantalla(), 'juego/estado'), { fase: 'argumento' }))
})

test('respuesta válida a tiempo se acepta una sola vez', async () => {
  const r = resp()
  await assertSucceeds(setDoc(doc(celular('ana'), 'respuestas', idResp(r)), r))
  await assertFails(setDoc(doc(celular('ana'), 'respuestas', idResp(r)), r))
})

test('respuesta tardía se rechaza', async () => {
  await preparar({ cronoInicio: haceSeg(30) })
  const r = resp()
  await assertFails(setDoc(doc(celular('ana'), 'respuestas', idResp(r)), r))
})

test('respuesta sin cronómetro iniciado se rechaza', async () => {
  await preparar({ cronoInicio: null })
  const r = resp()
  await assertFails(setDoc(doc(celular('ana'), 'respuestas', idResp(r)), r))
})

test('respuesta en fase o turno equivocado se rechaza', async () => {
  const r1 = resp({ fase: 'voto' })
  await assertFails(setDoc(doc(celular('ana'), 'respuestas', idResp(r1)), r1))
  const r2 = resp({ turno: 2 })
  await assertFails(setDoc(doc(celular('ana'), 'respuestas', idResp(r2)), r2))
})

test('no se puede responder por otra persona ni con id inventado', async () => {
  const r = resp({ uid: 'luis' })
  await assertFails(setDoc(doc(celular('luis'), 'respuestas', idResp(r)), r))
  const r2 = resp()
  await assertFails(setDoc(doc(celular('ana'), 'respuestas', 'otro_id'), r2))
})

test('el orador da su primera impresión pero no vota su propio turno', async () => {
  const r = resp({ uid: 'orador', personaId: 'orador', valores: { conoce: true, util: 'si', prediccion: 'Debatida' } })
  await assertSucceeds(setDoc(doc(celular('orador'), 'respuestas', idResp(r)), r))
  await preparar({ fase: 'voto' })
  const v = resp({ uid: 'orador', personaId: 'orador', fase: 'voto', valores: { sirve: 'si', nota: 5 } })
  await assertFails(setDoc(doc(celular('orador'), 'respuestas', idResp(v)), v))
})

test('los votos ajenos no se leen; los propios sí', async () => {
  const r = resp()
  await assertSucceeds(setDoc(doc(celular('ana'), 'respuestas', idResp(r)), r))
  await assertSucceeds(getDoc(doc(celular('ana'), 'respuestas', idResp(r))))
  await assertFails(getDoc(doc(celular('luis'), 'respuestas', idResp(r))))
  await assertSucceeds(getDoc(doc(pantalla(), 'respuestas', idResp(r))))
})

test('inscripción: propia, con código de sala y generación vigentes', async () => {
  const p = { nombre: 'Luis', uids: ['luis'], codigoSala: 'ABCD', generacion: 0, paso: false, ausente: false, creado: serverTimestamp() }
  await assertFails(setDoc(doc(celular('luis'), 'personas/luis'), { ...p, codigoSala: 'ZZZZ' }))
  await assertFails(setDoc(doc(celular('luis'), 'personas/otro'), p))
  await assertFails(setDoc(doc(celular('luis'), 'personas/luis'), { ...p, paso: true }))
  await assertSucceeds(setDoc(doc(celular('luis'), 'personas/luis'), p))
  await assertFails(updateDoc(doc(celular('luis'), 'personas/luis'), { nombre: 'Otro' }))
})

test('el código de recuperación solo lo lee el anfitrión', async () => {
  await assertSucceeds(setDoc(doc(celular('luis'), 'codigos/luis'), { codigo: '1234' }))
  await assertFails(getDoc(doc(celular('luis'), 'codigos/luis')))
  await assertSucceeds(getDoc(doc(pantalla(), 'codigos/luis')))
})

test('sentimiento: solo el propio y solo lo lee la pantalla', async () => {
  await assertSucceeds(setDoc(doc(celular('ana'), 'sentimiento/ana'), { barra: 0.5 }))
  await assertFails(setDoc(doc(celular('ana'), 'sentimiento/luis'), { barra: 0.5 }))
  await assertFails(getDoc(doc(celular('ana'), 'sentimiento/ana')))
  await assertSucceeds(getDoc(doc(pantalla(), 'sentimiento/ana')))
})

test('"Tú eliges": solo el orador, en la ruleta de reto, entre los tres retos', async () => {
  await assertFails(setDoc(doc(celular('orador'), 'reto/0_1'), { eleccion: 'ataca' }))
  await preparar({ fase: 'ruleta_reto' })
  await assertFails(setDoc(doc(celular('ana'), 'reto/0_1'), { eleccion: 'ataca' }))
  await assertFails(setDoc(doc(celular('orador'), 'reto/0_1'), { eleccion: 'elige' }))
  await assertSucceeds(setDoc(doc(celular('orador'), 'reto/0_1'), { eleccion: 'aplicala' }))
  await assertFails(setDoc(doc(celular('orador'), 'reto/0_1'), { eleccion: 'defiende' }))
})

test('la evidencia de las fichas no la lee ningún celular; el anfitrión sí', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'evidencia/1'), { nivel: 'Respaldada' }))
  await assertFails(getDoc(doc(celular('ana'), 'evidencia/1')))
  await assertFails(setDoc(doc(celular('ana'), 'evidencia/1'), { nivel: 'Debatida' }))
  await assertSucceeds(getDoc(doc(pantalla(), 'evidencia/1')))
})
