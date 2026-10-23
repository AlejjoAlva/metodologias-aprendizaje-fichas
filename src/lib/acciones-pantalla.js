// Escrituras de la pantalla grande (anfitrión). Reciben `db` para poder usarse también desde los
// scripts de simulación en Node.
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { DURACION } from './config.js'
import {
  FASES,
  aplicarTurno,
  calcularTurno,
  candidatosRuleta,
  ranking,
  repartir,
  sortear,
  sortearPostura,
} from './juego.js'

const ESTADO = 'juego/estado'
const MAX_EVENTOS = 8

const codigoSala = (rnd = Math.random) =>
  Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(rnd() * 24)]).join('')

export function estadoInicial(generacion = 0, codigo = codigoSala()) {
  return {
    fase: FASES.SALA,
    generacion,
    codigoSala: codigo,
    turno: 0,
    iniciada: false,
    oradorId: null,
    oradorNombre: null,
    oradorUids: [],
    candidatasFicha: [],
    fichaId: null,
    ficha: null,
    posturaSorteo: null,
    postura: null,
    cronoInicio: null,
    duracion: 0,
    resultado: null,
    marcador: {},
    top: [],
    eventos: [],
    repartoVersion: 0,
  }
}

const evento = (estado, texto) => [...(estado.eventos || []), { texto, t: Date.now() }].slice(-MAX_EVENTOS)

/** Crea el estado y carga las fichas si todavía no existen. */
export async function prepararSala(db, fichas) {
  const ref = doc(db, ESTADO)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data()
  const estado = estadoInicial()
  const batch = writeBatch(db)
  batch.set(ref, estado)
  for (const f of fichas) batch.set(doc(db, 'fichas', String(f.n)), fichaLibre(f, 0))
  await batch.commit()
  return estado
}

const fichaLibre = (f, generacion) => ({
  n: f.n,
  nombre: f.nombre,
  descripcion: f.descripcion,
  categoria: f.categoria,
  dueno: null,
  estado: 'libre',
  generacion,
})

/** Reparte 2 fichas a cada persona conectada y arranca la partida. */
export async function iniciarPartida(db, estado, { fichas, personas, conectados, rnd = Math.random }) {
  const presentes = personas.filter((p) => !p.ausente && conectados.has(p.id)).map((p) => p.id)
  const libres = fichas.filter((f) => f.estado === 'libre').map((f) => f.n)
  const reparto = repartir(libres, presentes, rnd)
  const batch = writeBatch(db)
  for (const [pid, ns] of Object.entries(reparto))
    for (const n of ns) batch.update(doc(db, 'fichas', String(n)), { dueno: pid, estado: 'repartida' })
  batch.update(doc(db, ESTADO), {
    iniciada: true,
    repartoVersion: (estado.repartoVersion || 0) + 1,
    eventos: evento(estado, `Empieza la partida: ${Object.keys(reparto).length} personas con fichas`),
  })
  await batch.commit()
  return reparto
}

/** Fichas para quien entra tarde. Devuelve los números asignados o [] si no alcanzan. */
export async function asignarFichas(db, estado, persona, fichas, rnd = Math.random) {
  const libres = fichas.filter((f) => f.estado === 'libre').map((f) => f.n)
  const r = repartir(libres, [persona.id], rnd)[persona.id]
  if (!r) return []
  const batch = writeBatch(db)
  for (const n of r) batch.update(doc(db, 'fichas', String(n)), { dueno: persona.id, estado: 'repartida' })
  batch.update(doc(db, ESTADO), { repartoVersion: (estado.repartoVersion || 0) + 1 })
  await batch.commit()
  return r
}

/** Ruleta 1. Devuelve false si no queda nadie por pasar. */
export async function girarPersona(db, estado, { personas, conectados, fichas, excluir = [], rnd = Math.random }) {
  const conFichas = new Set(
    fichas.filter((f) => f.dueno && (f.estado === 'repartida')).map((f) => f.dueno),
  )
  const candidatos = candidatosRuleta(personas, conectados, conFichas).filter((id) => !excluir.includes(id))
  const elegido = sortear(candidatos, rnd)
  if (!elegido) return false
  const p = personas.find((x) => x.id === elegido)
  const candidatas = fichas.filter((f) => f.dueno === elegido && f.estado === 'repartida').map((f) => f.n)
  await updateDoc(doc(db, ESTADO), {
    fase: FASES.RULETA_PERSONA,
    turno: estado.turno + 1,
    oradorId: elegido,
    oradorNombre: p.nombre,
    oradorUids: p.uids,
    candidatasFicha: candidatas,
    fichaId: null,
    ficha: null,
    posturaSorteo: null,
    postura: null,
    cronoInicio: null,
    duracion: 0,
    resultado: null,
    ruletaPersonas: candidatos.map((id) => personas.find((x) => x.id === id).nombre),
    eventos: evento(estado, `🎯 La ruleta eligió a ${p.nombre}`),
  })
  return true
}

/** Ruleta 2. */
export async function girarFicha(db, estado, fichas, rnd = Math.random) {
  const n = sortear(estado.candidatasFicha, rnd)
  const f = fichas.find((x) => x.n === n)
  const batch = writeBatch(db)
  batch.update(doc(db, 'fichas', String(n)), { estado: 'en_juego' })
  batch.update(doc(db, ESTADO), {
    fase: FASES.RULETA_FICHA,
    fichaId: n,
    ficha: { nombre: f.nombre, categoria: f.categoria, descripcion: f.descripcion },
    eventos: evento(estado, `🃏 ${estado.oradorNombre} juega «${f.nombre}»`),
  })
  await batch.commit()
}

/** Ruleta 3. Con "Tú eliges" arranca la ventana de 10 s del orador. */
export async function girarPostura(db, estado, rnd = Math.random) {
  const s = sortearPostura(rnd)
  await updateDoc(doc(db, ESTADO), {
    fase: FASES.RULETA_POSTURA,
    posturaSorteo: s,
    postura: s === 'elige' ? null : s,
    cronoInicio: s === 'elige' ? serverTimestamp() : null,
    duracion: s === 'elige' ? DURACION.elige : 0,
    eventos: evento(estado, s === 'elige' ? `🎲 ${estado.oradorNombre} elige su postura` : `🎲 Postura: ${s === 'defiende' ? 'Defiende' : 'Ataca'}`),
  })
}

/** Cierra "Tú eliges": lo que eligió el orador o, si no eligió, un sorteo entre defiende y ataca. */
export async function resolverEleccion(db, estado, rnd = Math.random) {
  const snap = await getDoc(doc(db, 'postura', `${estado.generacion}_${estado.turno}`))
  const eleccion = snap.exists() ? snap.data().eleccion : rnd() < 0.5 ? 'defiende' : 'ataca'
  await updateDoc(doc(db, ESTADO), {
    postura: eleccion,
    cronoInicio: null,
    duracion: 0,
    eventos: evento(
      estado,
      `${snap.exists() ? '🗣️ Eligió' : '🎲 No eligió a tiempo; salió'}: ${eleccion === 'defiende' ? 'Defiende' : 'Ataca'}`,
    ),
  })
  return eleccion
}

/** Pasa a una fase con cronómetro (aún sin iniciar: lo arranca el anfitrión). */
export async function pasarA(db, estado, fase) {
  const texto = {
    [FASES.IMPRESION]: '👀 Primera impresión',
    [FASES.ARGUMENTO]: `🎤 Argumenta ${estado.oradorNombre}`,
    [FASES.VOTO]: '🗳️ Voto final',
  }[fase]
  await updateDoc(doc(db, ESTADO), {
    fase,
    cronoInicio: null,
    duracion: DURACION[fase] || 0,
    eventos: texto ? evento(estado, texto) : estado.eventos,
  })
}

export async function iniciarCrono(db, estado) {
  await updateDoc(doc(db, ESTADO), { cronoInicio: serverTimestamp(), duracion: DURACION[estado.fase] || estado.duracion })
}

const delTurno = (estado) => [
  where('generacion', '==', estado.generacion),
  where('turno', '==', estado.turno),
]

/** Lee respuestas de una fase del turno vigente, indexadas por personaId. */
export async function leerRespuestas(db, estado, fase) {
  const snap = await getDocs(query(collection(db, 'respuestas'), ...delTurno(estado), where('fase', '==', fase)))
  return Object.fromEntries(snap.docs.map((d) => [d.data().personaId, d.data().valores]))
}

/** Sentimientos del turno, solo de celulares que de verdad pertenecen a esa persona. */
export async function leerSentimientos(db, estado, personas) {
  const snap = await getDocs(query(collection(db, 'sentimiento'), ...delTurno(estado)))
  return sentimientosValidos(snap.docs.map((d) => ({ uid: d.id, ...d.data() })), personas)
}

export function sentimientosValidos(lista, personas) {
  const porId = new Map(personas.map((p) => [p.id, p]))
  const out = {}
  for (const s of lista) {
    const p = porId.get(s.personaId)
    if (!p || !p.uids?.includes(s.uid)) continue
    const prev = out[s.personaId]
    const r = s.reacciones || {}
    const total = (r.fuego || 0) + (r.duda || 0) + (r.cerebro || 0)
    out[s.personaId] = {
      movio: !!s.movio || !!prev?.movio,
      reacciones: total + (prev?.reacciones || 0),
      fuego: (r.fuego || 0) + (prev?.fuego || 0),
      barra: s.barra,
    }
  }
  return out
}

/** Cierra el voto: calcula el turno, suma al marcador y revela el resultado. */
export async function cerrarTurno(db, estado, { personas, conectados }) {
  const [impresiones, votos, sentimientos] = await Promise.all([
    leerRespuestas(db, estado, FASES.IMPRESION),
    leerRespuestas(db, estado, FASES.VOTO),
    leerSentimientos(db, estado, personas),
  ])
  const postura = estado.postura === 'ataca' ? 'ataca' : 'defiende'
  const calculo = calcularTurno({ postura, oradorId: estado.oradorId, impresiones, votos, sentimientos })
  const presentes = personas.filter((p) => !p.ausente && conectados.has(p.id)).map((p) => p.id)
  const marcador = aplicarTurno(estado.marcador || {}, calculo, presentes)
  const nombre = Object.fromEntries(personas.map((p) => [p.id, p.nombre]))
  const persuadidos = new Set(calculo.persuadidos)
  const aciertos = new Set(calculo.aciertos)

  const detalle = Object.keys({ ...impresiones, ...votos })
    .filter((id) => id !== estado.oradorId && nombre[id])
    .map((id) => ({
      id,
      nombre: nombre[id],
      antes: impresiones[id]?.util ?? null,
      sirve: votos[id]?.sirve ?? null,
      nota: votos[id]?.nota ?? null,
      conoce: impresiones[id]?.conoce ?? null,
      prediccion: impresiones[id]?.prediccion ?? null,
      persuadido: persuadidos.has(id),
      acierto: aciertos.has(id),
      puntos: Object.values(calculo.puntosTurno[id] || {}).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const resultado = {
    votantes: calculo.votantes,
    pctSi: calculo.pctSi,
    notaPromedio: calculo.notaPromedio,
    mayoriaSi: calculo.mayoriaSi,
    base: calculo.base,
    pctPersuadido: calculo.pctPersuadido,
    persuadidos: calculo.persuadidos.length,
    enContra: calculo.enContra.length,
    aciertos: calculo.aciertos.length,
    fuegos: calculo.fuegos,
    pctConoce: calculo.pctConoce,
    puntosOrador: calculo.puntosTurno[estado.oradorId]?.argumento ?? 0,
    detalle,
  }

  const batch = writeBatch(db)
  batch.set(doc(db, 'turnos', `${estado.generacion}_${estado.turno}`), {
    generacion: estado.generacion,
    turno: estado.turno,
    oradorId: estado.oradorId,
    oradorNombre: estado.oradorNombre,
    fichaId: estado.fichaId,
    ficha: estado.ficha?.nombre ?? null,
    postura,
    resultado,
    puntosTurno: calculo.puntosTurno,
    creado: serverTimestamp(),
  })
  batch.update(doc(db, 'personas', estado.oradorId), { paso: true })
  if (estado.fichaId != null) batch.update(doc(db, 'fichas', String(estado.fichaId)), { estado: 'jugada' })
  batch.update(doc(db, ESTADO), {
    fase: FASES.RESULTADO,
    cronoInicio: null,
    duracion: 0,
    resultado,
    marcador,
    top: topConNombres(marcador, nombre, 10),
    eventos: evento(
      estado,
      `✅ «${estado.ficha?.nombre}»: ${calculo.pctSi ?? 0}% le sirve · ${estado.oradorNombre} +${resultado.puntosOrador} pts`,
    ),
  })
  await batch.commit()
  return { calculo, resultado, marcador }
}

export function topConNombres(marcador, nombre, n = 10) {
  return ranking(marcador)
    .filter((f) => nombre[f.personaId])
    .slice(0, n)
    .map((f) => ({ id: f.personaId, nombre: nombre[f.personaId], total: f.total, posicion: f.posicion }))
}

/** Salta el turno: la ficha vuelve a la mano y la persona sigue pendiente. */
export async function saltarTurno(db, estado) {
  const batch = writeBatch(db)
  if (estado.fichaId != null) batch.update(doc(db, 'fichas', String(estado.fichaId)), { estado: 'repartida' })
  batch.update(doc(db, ESTADO), {
    fase: FASES.RESULTADO,
    resultado: { saltado: true },
    cronoInicio: null,
    duracion: 0,
    fichaId: null,
    ficha: null,
    eventos: evento(estado, `⏭️ Se saltó el turno de ${estado.oradorNombre}`),
  })
  await batch.commit()
}

export async function terminarPartida(db, estado, personas) {
  const nombre = Object.fromEntries(personas.map((p) => [p.id, p.nombre]))
  await updateDoc(doc(db, ESTADO), {
    fase: FASES.FINAL,
    cronoInicio: null,
    top: topConNombres(estado.marcador || {}, nombre, 30),
    eventos: evento(estado, '🏁 Fin de la partida'),
  })
}

export async function marcarAusente(db, persona, ausente) {
  await updateDoc(doc(db, 'personas', persona.id), { ausente })
}

export async function renombrar(db, persona, nombre) {
  await updateDoc(doc(db, 'personas', persona.id), { nombre: nombre.trim().slice(0, 30) })
}

/** Recuperación desde otro navegador: nombre + código de 4 dígitos. */
export async function resolverReclamo(db, reclamo, personas) {
  const nombre = (reclamo.nombre || '').trim().toLowerCase()
  const p = personas.find((x) => x.nombre.trim().toLowerCase() === nombre)
  let ok = false
  if (p) {
    const c = await getDoc(doc(db, 'codigos', p.id))
    ok = c.exists() && c.data().codigo === reclamo.codigo
  }
  const batch = writeBatch(db)
  if (ok) batch.update(doc(db, 'personas', p.id), { uids: arrayUnion(reclamo.uid) })
  batch.update(doc(db, 'reclamos', reclamo.uid), ok ? { estado: 'ok', personaId: p.id } : { estado: 'rechazado' })
  await batch.commit()
  return ok
}

/**
 * Empezar de cero. No borra nada (las reglas no lo permiten): sube la generación, así los
 * celulares vuelven al registro y la pantalla deja de ver a los inscritos anteriores.
 */
export async function empezarDeCero(db, estado, fichas) {
  const batch = writeBatch(db)
  const generacion = (estado.generacion || 0) + 1
  batch.set(doc(db, ESTADO), estadoInicial(generacion, estado.codigoSala))
  for (const f of fichas) batch.set(doc(db, 'fichas', String(f.n)), fichaLibre(f, generacion))
  await batch.commit()
}

/** Reemplaza la tabla de fichas (solo antes de iniciar). */
export async function reemplazarFichas(db, estado, nuevas, viejas) {
  const batch = writeBatch(db)
  const nuevasN = new Set(nuevas.map((f) => f.n))
  for (const f of nuevas) batch.set(doc(db, 'fichas', String(f.n)), fichaLibre(f, estado.generacion))
  for (const f of viejas) if (!nuevasN.has(f.n)) batch.update(doc(db, 'fichas', String(f.n)), { estado: 'retirada' })
  await batch.commit()
}

