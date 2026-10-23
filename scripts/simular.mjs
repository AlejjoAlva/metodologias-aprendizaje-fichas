// Partida simulada con N celulares. Por defecto contra el emulador (no gasta cuota):
//   firebase emulators:exec --only auth,firestore,database "node scripts/simular.mjs"
// Contra producción (gasta cuota real; una sola corrida corta):
//   node --env-file=.env scripts/simular.mjs --prod --clave=<clave del anfitrión>
import { initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { connectFirestoreEmulator, doc, getDoc, getDocs, collection, getFirestore, terminate, updateDoc } from 'firebase/firestore'
import { connectDatabaseEmulator, get, getDatabase, goOffline, ref } from 'firebase/database'
import {
  cerrarTurno,
  girarFicha,
  girarPersona,
  girarReto,
  iniciarCrono,
  iniciarPartida,
  asignarFichas,
  pasarA,
  prepararSala,
  resolverEleccion,
  resolverReclamo,
  empezarDeCero,
  excluirFicha,
  leerNiveles,
  reemplazarFichas,
} from '../src/lib/acciones-pantalla.js'
import {
  elegirReto,
  enviarSentimiento,
  inscribirse,
  marcarPresencia,
  pedirRecuperacion,
  responder,
} from '../src/lib/acciones-celular.js'
import { FASES, calcularTurno } from '../src/lib/juego.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const PROD = 'prod' in args
const N = Number(args.n || 25)
const TURNOS = Number(args.turnos || 3)
const UID_ANFITRION = 'anfitrion-fichas-2026'
const CORREO = args.correo || 'anfitrion@metodologias-fichas.uace'
const CLAVE = args.clave || 'clave-del-emulador'

const config = PROD
  ? {
      apiKey: process.env.VITE_FB_API_KEY,
      authDomain: process.env.VITE_FB_AUTH_DOMAIN,
      projectId: process.env.VITE_FB_PROJECT_ID,
      databaseURL: process.env.VITE_FB_DATABASE_URL,
      appId: process.env.VITE_FB_APP_ID,
    }
  : { apiKey: 'demo', projectId: 'TU-PROYECTO-FIREBASE', databaseURL: 'http://127.0.0.1:9000/?ns=TU-PROYECTO-FIREBASE-default-rtdb' }

let fallos = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`)
  if (!cond) fallos++
}
const azar = (lista) => lista[Math.floor(Math.random() * lista.length)]

function cliente(nombre) {
  const app = initializeApp(config, nombre)
  const auth = getAuth(app)
  const db = getFirestore(app)
  const rtdb = getDatabase(app)
  if (!PROD) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    connectDatabaseEmulator(rtdb, '127.0.0.1', 9000)
  }
  return { app, auth, db, rtdb }
}

async function crearAnfitrionEmulador() {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/TU-PROYECTO-FIREBASE/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: UID_ANFITRION, email: CORREO, password: CLAVE }),
  })
  if (!r.ok && !(await r.text()).includes('DUPLICATE')) throw new Error('no se creó el anfitrión')
}

const leerEstado = async (db) => (await getDoc(doc(db, 'juego/estado'))).data()

async function contexto(host) {
  const estado = await leerEstado(host.db)
  const personas = (await getDocs(collection(host.db, 'personas')))
    .docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.generacion === estado.generacion)
  const presencia = (await get(ref(host.rtdb, 'presencia'))).val() || {}
  const conectados = new Set(personas.filter((p) => p.uids.some((u) => presencia[u])).map((p) => p.id))
  const fichas = (await getDocs(collection(host.db, 'fichas'))).docs.map((d) => d.data()).filter((f) => f.estado !== 'retirada')
  return { estado, personas, conectados, fichas }
}

const NIVELES = ['Respaldada', 'Debatida', 'Poco respaldada']
const fichasPrueba = Array.from({ length: 70 }, (_, i) => ({
  n: i + 1,
  nombre: `Ficha de prueba ${i + 1}`,
  categoria: ['Memoria', 'Organización', 'Comprensión', 'Mitos y conceptos a desmentir'][i % 4],
  que_es: 'Qué es, de prueba',
  ejemplo: 'Ejemplo de prueba',
  como_se_aplica: 'Paso 1\nPaso 2',
  evidencia: { nivel: NIVELES[Math.floor(i / 4) % 3], texto: 'Texto', mito: 'Mito', origen: 'Origen' },
  avisos: [],
  invalida: false,
}))
const nivelDe = Object.fromEntries(fichasPrueba.map((f) => [f.n, f.evidencia.nivel]))

async function main() {
  console.log(`Simulación: ${N} celulares, ${TURNOS} turnos, ${PROD ? 'PRODUCCIÓN' : 'emulador'}`)
  if (!PROD) await crearAnfitrionEmulador()

  const host = cliente('anfitrion')
  await signInWithEmailAndPassword(host.auth, CORREO, CLAVE)
  ok(host.auth.currentUser.uid === UID_ANFITRION, 'el anfitrión inicia sesión con su UID fijo')

  let estado = await prepararSala(host.db, fichasPrueba)
  if (estado.iniciada || estado.turno > 0) {
    // Base usada: empezar de cero sin borrar nada.
    const viejas = (await getDocs(collection(host.db, 'fichas'))).docs.map((d) => d.data())
    await empezarDeCero(host.db, estado, viejas.filter((f) => f.estado !== 'retirada'))
    estado = await leerEstado(host.db)
    await reemplazarFichas(host.db, estado, fichasPrueba, viejas)
  }

  // Celulares entrando a la vez.
  const t0 = Date.now()
  const celulares = await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const c = cliente(`cel${i}`)
      const { user } = await signInAnonymously(c.auth)
      const nombre = i === 1 ? 'Ana' : i === 2 ? 'ana' : `Persona ${i}`
      const r = await inscribirse(c.db, user.uid, estado, nombre)
      c.stopPresencia = marcarPresencia(c.rtdb, user.uid, r.personaId)
      return { ...c, uid: user.uid, ...r }
    }),
  )
  console.log(`  ${N} inscripciones en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  ok(new Set(celulares.map((c) => c.nombre)).size === N, 'nombres únicos (Ana / ana 2)')
  await new Promise((r) => setTimeout(r, 1500)) // que la presencia llegue

  let ctx = await contexto(host)
  ok(ctx.conectados.size === N, `presencia: ${ctx.conectados.size}/${N} conectados`)
  // Una ficha inválida bloquea el inicio hasta excluirla.
  await updateDoc(doc(host.db, 'fichas', '70'), { invalida: true })
  ctx = await contexto(host)
  let bloqueo = false
  try {
    await iniciarPartida(host.db, ctx.estado, ctx)
  } catch (e) {
    bloqueo = /evidencia/.test(e.message)
  }
  ok(bloqueo, 'no se puede iniciar con una ficha sin nivel válido')
  await excluirFicha(host.db, { n: 70 }, true)
  ctx = await contexto(host)
  await iniciarPartida(host.db, ctx.estado, { ...ctx, niveles: await leerNiveles(host.db) })
  ctx = await contexto(host)
  const repartidas = ctx.fichas.filter((f) => f.dueno)
  ok(repartidas.length === N * 2, `reparto: ${repartidas.length} fichas para ${N} personas`)
  ok(!repartidas.some((f) => f.n === 70), 'la ficha excluida no se reparte')
  const manos = {}
  for (const f of repartidas) (manos[f.dueno] ??= []).push(f)
  const variadas = Object.values(manos).filter(([a, b]) => a.categoria !== b.categoria && nivelDe[a.n] !== nivelDe[b.n]).length
  ok(variadas >= N * 0.8, `reparto variado: ${variadas}/${N} con categoría y nivel distintos`)
  // Lo que ve un celular: ni la evidencia ni los niveles.
  let espia = false
  try {
    await getDoc(doc(celulares[0].db, 'evidencia', '1'))
    espia = true
  } catch {
    /* esperado */
  }
  const fichaCel = (await getDoc(doc(celulares[0].db, 'fichas', '1'))).data()
  ok(!espia && !('evidencia' in fichaCel) && !('nivel' in fichaCel), 'el celular no puede leer la evidencia')

  // Llega tarde.
  const tarde = cliente('tarde')
  const { user: uTarde } = await signInAnonymously(tarde.auth)
  const rTarde = await inscribirse(tarde.db, uTarde.uid, ctx.estado, 'Llegó Tarde')
  ctx = await contexto(host)
  const asignadas = await asignarFichas(host.db, ctx.estado, ctx.personas.find((p) => p.id === rTarde.personaId), ctx.fichas)
  ok(asignadas.length === 2, 'quien llega tarde recibe 2 fichas sin repartir')

  // Recuperación desde otro navegador.
  const otro = cliente('otro-navegador')
  const { user: uOtro } = await signInAnonymously(otro.auth)
  await pedirRecuperacion(otro.db, uOtro.uid, celulares[3].nombre, celulares[3].codigo)
  ctx = await contexto(host)
  ok(await resolverReclamo(host.db, { uid: uOtro.uid, nombre: celulares[3].nombre, codigo: celulares[3].codigo }, ctx.personas), 'recuperación con nombre + código')
  const malo = cliente('impostor')
  const { user: uMalo } = await signInAnonymously(malo.auth)
  await pedirRecuperacion(malo.db, uMalo.uid, celulares[4].nombre, '0000' === celulares[4].codigo ? '1111' : '0000')
  ok(!(await resolverReclamo(host.db, { uid: uMalo.uid, nombre: celulares[4].nombre, codigo: '0000' === celulares[4].codigo ? '1111' : '0000' }, ctx.personas)), 'código equivocado se rechaza')

  // Desconexión: un celular se va y no debe salir en la ruleta.
  goOffline(celulares[5].rtdb)
  await new Promise((r) => setTimeout(r, 1500))
  ctx = await contexto(host)
  ok(!ctx.conectados.has(celulares[5].personaId), 'quien se desconecta sale de los conectados')

  const porId = new Map(celulares.map((c) => [c.personaId, c]))
  for (let t = 0; t < TURNOS; t++) {
    ctx = await contexto(host)
    const hay = await girarPersona(host.db, ctx.estado, ctx)
    ok(hay, `turno ${t + 1}: la ruleta eligió a alguien`)
    let e = await leerEstado(host.db)
    ok(e.oradorId !== celulares[5].personaId, `turno ${t + 1}: no salió el desconectado`)
    const orador = porId.get(e.oradorId)
    await girarFicha(host.db, e, ctx.fichas)
    e = await leerEstado(host.db)
    // Turno 1 fuerza "Tú eliges" para probarlo.
    await girarReto(host.db, e, t === 0 ? () => 0.99 : Math.random)
    e = await leerEstado(host.db)
    if (e.retoSorteo === 'elige') {
      if (orador) await elegirReto(orador.db, e, 'aplicala')
      await resolverEleccion(host.db, e)
      e = await leerEstado(host.db)
      ok(!orador || e.reto === 'aplicala', `turno ${t + 1}: "Tú eliges" respeta la elección (Aplícala)`)
    }
    ok(['aplicala', 'defiende', 'ataca'].includes(e.reto), `turno ${t + 1}: reto efectivo ${e.reto} (salió ${e.retoSorteo})`)
    ok(Object.keys(e.ficha).every((k) => ['nombre', 'categoria', 'que_es', 'ejemplo', 'como_se_aplica'].includes(k)) && !e.resultado,
      `turno ${t + 1}: el estado no lleva la evidencia antes del resultado`)
    await pasarA(host.db, e, FASES.IMPRESION)
    e = await leerEstado(host.db)
    await iniciarCrono(host.db, e)
    e = await leerEstado(host.db)

    const publico = celulares.filter((c) => c.personaId !== e.oradorId && c !== celulares[5])
    const impresiones = {}
    await Promise.all(
      publico.map(async (c) => {
        const v = { conoce: Math.random() < 0.5, util: azar(['si', 'no', 'ni']), prediccion: azar(NIVELES) }
        impresiones[c.personaId] = v
        await responder(c.db, c.uid, c.personaId, e, v)
      }),
    )
    let doble = false
    try {
      await responder(publico[0].db, publico[0].uid, publico[0].personaId, e, impresiones[publico[0].personaId])
      doble = true
    } catch {
      /* esperado */
    }
    ok(!doble, `turno ${t + 1}: la segunda respuesta se rechaza`)
    if (orador) {
      const v = { conoce: true, util: 'si', prediccion: nivelDe[e.fichaId] }
      impresiones[orador.personaId] = v
      await responder(orador.db, orador.uid, orador.personaId, e, v)
    }

    await pasarA(host.db, e, FASES.ARGUMENTO)
    e = await leerEstado(host.db)
    await iniciarCrono(host.db, e)
    e = await leerEstado(host.db)
    const sentimientos = {}
    await Promise.all(
      publico.slice(0, Math.ceil(publico.length / 2)).map(async (c) => {
        const s = { barra: Math.random() * 2 - 1, movio: true, reacciones: { fuego: 2, duda: 0, cerebro: 1 } }
        sentimientos[c.personaId] = { movio: true, reacciones: 3, fuego: 2 }
        await enviarSentimiento(c.db, c.uid, c.personaId, e, s)
      }),
    )

    await pasarA(host.db, e, FASES.VOTO)
    e = await leerEstado(host.db)
    await iniciarCrono(host.db, e)
    e = await leerEstado(host.db)
    const votos = {}
    await Promise.all(
      publico.map(async (c) => {
        const v = { sirve: azar(['si', 'no']), nota: 1 + Math.floor(Math.random() * 5) }
        votos[c.personaId] = v
        await responder(c.db, c.uid, c.personaId, e, v)
      }),
    )

    let orVota = false
    if (orador)
      try {
        await responder(orador.db, orador.uid, orador.personaId, e, { sirve: 'si', nota: 5 })
        orVota = true
      } catch {
        /* esperado */
      }
    ok(!orVota, `turno ${t + 1}: el orador no puede votar su turno`)

    ctx = await contexto(host)
    const { resultado, marcador } = await cerrarTurno(host.db, e, ctx)
    const esperado = calcularTurno({
      reto: e.reto,
      nivel: nivelDe[e.fichaId],
      oradorId: e.oradorId,
      impresiones,
      votos,
      sentimientos,
    })
    ok(resultado.votantes === publico.length, `turno ${t + 1}: ${resultado.votantes} votos contados de ${publico.length}`)
    ok(resultado.pctSi === esperado.pctSi && resultado.persuadidos === esperado.persuadidos.length,
      `turno ${t + 1}: resultado = cálculo independiente (${resultado.pctSi}% sí, ${resultado.persuadidos} persuadidos)`)
    const po = esperado.puntosTurno[e.oradorId]
    ok(resultado.puntosOrador === po.argumento + po.participacion + po.prediccion, `turno ${t + 1}: orador +${resultado.puntosOrador}`)
    ok(resultado.revelacion.nivel === nivelDe[e.fichaId] && resultado.aciertos === esperado.aciertos.length,
      `turno ${t + 1}: revelación ${resultado.revelacion.nivel}, ${resultado.aciertos} aciertos contra la base`)
    ok(!orador || resultado.oradorAcerto, `turno ${t + 1}: la predicción del orador cuenta`)
    const turnoDoc = (await getDoc(doc(celulares[0].db, 'turnos', `${e.generacion}_${e.turno}`))).data()
    ok(turnoDoc.reto === e.reto && turnoDoc.retoSorteo === e.retoSorteo && turnoDoc.revelacion.nivel === nivelDe[e.fichaId],
      `turno ${t + 1}: el turno guarda reto que salió, reto efectivo y revelación`)
    const eCel = (await getDoc(doc(celulares[0].db, 'juego/estado'))).data()
    ok(eCel.resultado.revelacion.nivel === nivelDe[e.fichaId] && eCel.duracion === 30, `turno ${t + 1}: el celular recibe la revelación al abrir el Resultado (30 s)`)
    const f = (await getDoc(doc(host.db, 'fichas', String(e.fichaId)))).data()
    ok(f.estado === 'jugada', `turno ${t + 1}: la ficha queda jugada`)
    const total = Object.values(marcador).reduce((s, m) => s + m.total, 0)
    console.log(`  marcador acumulado: ${total} pts repartidos`)
  }

  // Limpieza de conexiones.
  for (const c of [...celulares, tarde, otro, malo, host]) {
    c.stopPresencia?.()
    goOffline(c.rtdb)
    await terminate(c.db)
  }
  console.log(fallos ? `\n${fallos} comprobaciones fallaron` : '\nTodas las comprobaciones pasaron')
  process.exit(fallos ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
