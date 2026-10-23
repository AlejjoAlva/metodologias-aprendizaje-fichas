// Escrituras de la pantalla grande (anfitrión). Reciben `db` para poder usarse también desde los
// scripts de simulación en Node.
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { ajustesDe } from './config.js'
import { origen, registrar } from './bitacora.js'

const log = (db, tipo, detalle, estado) => registrar(db, origen.quien, tipo, detalle, { estado })
import {
  FASES,
  aplicarTurno,
  calcularTurno,
  candidatosRuleta,
  premios,
  ranking,
  repartir,
  sortear,
  sortearReto,
  sortearSinElegir,
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
    retoSorteo: null, // lo que salió en la ruleta (puede ser "elige")
    reto: null, // el reto efectivo: aplicala | defiende | ataca
    cronoInicio: null,
    duracion: 0,
    resultado: null,
    marcador: {},
    ajustes: null,
    top: [],
    eventos: [],
    repartoVersion: 0,
  }
}

/** La fase ya cambió (otra pantalla abierta se adelantó): no se repite el paso. */
export class YaHecho extends Error {
  constructor() {
    super('ya hecho')
    this.name = 'YaHecho'
  }
}

/**
 * Escribe solo si el estado sigue en la misma generación, turno y fase que vio quien llama.
 * Así dos pantallas abiertas a la vez no giran dos veces ni cierran dos veces un turno.
 * `escribir(tx)` usa tx.set / tx.update igual que un lote.
 */
async function enFase(db, estado, escribir, extra = () => true) {
  return runTransaction(db, async (tx) => {
    const s = await tx.get(doc(db, ESTADO))
    const e = s.data()
    if (!e || e.generacion !== estado.generacion || e.turno !== estado.turno || e.fase !== estado.fase || !extra(e))
      throw new YaHecho()
    escribir(tx)
  })
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
  for (const f of fichas) escribirFicha(batch, db, f, 0)
  await batch.commit()
  return estado
}

// La ficha pública (la leen los celulares) y su evidencia aparte (solo el anfitrión).
const fichaLibre = (f, generacion) => ({
  n: f.n,
  nombre: f.nombre,
  categoria: f.categoria,
  que_es: f.que_es,
  ejemplo: f.ejemplo,
  como_se_aplica: f.como_se_aplica,
  aviso: f.avisos?.length ? f.avisos.join(', ') : null,
  invalida: !!f.invalida,
  dueno: null,
  estado: f.excluida ? 'excluida' : 'libre',
  generacion,
})

function escribirFicha(batch, db, f, generacion) {
  batch.set(doc(db, 'fichas', String(f.n)), fichaLibre(f, generacion))
  batch.set(doc(db, 'evidencia', String(f.n)), f.evidencia)
}

/** Niveles de evidencia por número de ficha. Solo el anfitrión puede leerlos; no se muestran. */
export async function leerNiveles(db) {
  const snap = await getDocs(collection(db, 'evidencia'))
  return Object.fromEntries(snap.docs.map((d) => [Number(d.id), d.data().nivel]))
}

/**
 * Migración de fichas del formato viejo (nombre, categoría, descripción): la descripción pasa a
 * que_es y la evidencia queda "Debatida" provisional, hasta importar el CSV nuevo.
 */
export async function migrarFichasViejas(db, fichas) {
  const viejas = fichas.filter((f) => f.que_es === undefined)
  if (!viejas.length) return 0
  const batch = writeBatch(db)
  for (const f of viejas) {
    batch.update(doc(db, 'fichas', String(f.n)), {
      que_es: f.descripcion ?? '',
      ejemplo: '',
      como_se_aplica: '',
      aviso: 'formato viejo: nivel provisional',
      invalida: false,
    })
    batch.set(doc(db, 'evidencia', String(f.n)), { nivel: 'Debatida', texto: '', mito: '', origen: '' })
  }
  await batch.commit()
  return viejas.length
}

/** Reparte 2 fichas a cada persona conectada y arranca la partida. */
export async function iniciarPartida(db, estado, { fichas, personas, conectados, niveles = {}, rnd = Math.random }) {
  const presentes = personas.filter((p) => !p.ausente && conectados.has(p.id)).map((p) => p.id)
  const invalidas = fichas.filter((f) => f.estado === 'libre' && f.invalida)
  if (invalidas.length)
    throw new Error(
      `Hay fichas sin nivel de evidencia válido: ${invalidas.map((f) => f.nombre).join(', ')}. Corrígelas o exclúyelas.`,
    )
  const libres = fichas.filter((f) => f.estado === 'libre').map((f) => f.n)
  const reparto = repartir(libres, presentes, rnd, infoReparto(fichas, niveles))
  const batch = writeBatch(db)
  for (const [pid, ns] of Object.entries(reparto))
    for (const n of ns) batch.update(doc(db, 'fichas', String(n)), { dueno: pid, estado: 'repartida' })
  batch.update(doc(db, ESTADO), {
    iniciada: true,
    repartoVersion: (estado.repartoVersion || 0) + 1,
    eventos: evento(estado, `Empieza la partida: ${Object.keys(reparto).length} personas con fichas`),
  })
  await batch.commit()
  log(db, 'iniciar', `${presentes.length} presentes, ${Object.keys(reparto).length} con fichas, ${libres.length} fichas libres`, estado)
  return reparto
}

const infoReparto = (fichas, niveles) =>
  Object.fromEntries(fichas.map((f) => [f.n, { categoria: f.categoria, nivel: niveles[f.n] }]))

/** Fichas para quien entra tarde. Devuelve los números asignados o [] si no alcanzan. */
export async function asignarFichas(db, estado, persona, fichas, niveles = {}, rnd = Math.random) {
  const libres = fichas.filter((f) => f.estado === 'libre').map((f) => f.n)
  const r = repartir(libres, [persona.id], rnd, infoReparto(fichas, niveles))[persona.id]
  if (!r) {
    log(db, 'sin_fichas', `No alcanzan fichas libres para ${persona.nombre}`, estado)
    return []
  }
  const batch = writeBatch(db)
  for (const n of r) batch.update(doc(db, 'fichas', String(n)), { dueno: persona.id, estado: 'repartida' })
  batch.update(doc(db, ESTADO), { repartoVersion: (estado.repartoVersion || 0) + 1 })
  await batch.commit()
  log(db, 'llego_tarde', `${persona.nombre} recibe ${r.length} fichas`, estado)
  return r
}

/** Ruleta 1. Devuelve false si no queda nadie por pasar. */
export async function girarPersona(db, estado, { personas, conectados, fichas, excluir = [], rnd = Math.random }) {
  const conFichas = new Set(fichas.filter((f) => f.dueno && f.estado === 'repartida').map((f) => f.dueno))
  const candidatos = candidatosRuleta(personas, conectados, conFichas).filter((id) => !excluir.includes(id))
  const elegido = sortear(candidatos, rnd)
  if (!elegido) {
    log(db, 'sin_candidatos', `Nadie más puede pasar (${personas.length} inscritos, ${conectados.size} conectados)`, estado)
    return false
  }
  const p = personas.find((x) => x.id === elegido)
  const candidatas = fichas.filter((f) => f.dueno === elegido && f.estado === 'repartida').map((f) => f.n)
  await enFase(db, estado, (tx) =>
    tx.update(doc(db, ESTADO), {
      fase: FASES.RULETA_PERSONA,
      turno: estado.turno + 1,
      oradorId: elegido,
      oradorNombre: p.nombre,
      oradorUids: p.uids,
      candidatasFicha: candidatas,
      fichaId: null,
      ficha: null,
      retoSorteo: null,
      reto: null,
      cronoInicio: null,
      duracion: 0,
      resultado: null,
      ruletaPersonas: candidatos.map((id) => personas.find((x) => x.id === id).nombre),
      eventos: evento(estado, `🎯 La ruleta eligió a ${p.nombre}`),
    }),
  )
  return true
}

/** Ruleta 2. */
export async function girarFicha(db, estado, fichas, rnd = Math.random) {
  const n = sortear(estado.candidatasFicha, rnd)
  const f = fichas.find((x) => x.n === n)
  await enFase(db, estado, (batch) => {
    batch.update(doc(db, 'fichas', String(n)), { estado: 'en_juego' })
    batch.update(doc(db, ESTADO), {
      fase: FASES.RULETA_FICHA,
      fichaId: n,
      ficha: {
        nombre: f.nombre,
        categoria: f.categoria,
        que_es: f.que_es ?? f.descripcion ?? '',
        ejemplo: f.ejemplo ?? '',
        como_se_aplica: f.como_se_aplica ?? '',
      },
      eventos: evento(estado, `🃏 ${estado.oradorNombre} juega «${f.nombre}»`),
    })
  })
}

const TEXTO_RETO = { aplicala: 'Aplícala', defiende: 'Defiende', ataca: 'Ataca', elige: 'Tú eliges' }

/** Ruleta 3: el reto. Con "Tú eliges" arranca la ventana de 10 s del orador. */
export async function girarReto(db, estado, rnd = Math.random) {
  const { pesosReto, duracion } = ajustesDe(estado)
  const s = sortearReto(rnd, pesosReto)
  await enFase(db, estado, (tx) =>
    tx.update(doc(db, ESTADO), {
      fase: FASES.RULETA_RETO,
      retoSorteo: s,
      reto: s === 'elige' ? null : s,
      cronoInicio: s === 'elige' ? serverTimestamp() : null,
      duracion: s === 'elige' ? duracion.elige : 0,
      eventos: evento(estado, s === 'elige' ? `🎲 ${estado.oradorNombre} elige su reto` : `🎲 Reto: ${TEXTO_RETO[s]}`),
    }),
  )
}

/** Cierra "Tú eliges": lo que eligió el orador o, si no eligió, un sorteo entre los otros tres. */
export async function resolverEleccion(db, estado, rnd = Math.random) {
  const snap = await getDoc(doc(db, 'reto', `${estado.generacion}_${estado.turno}`))
  const eleccion = snap.exists() ? snap.data().eleccion : sortearSinElegir(rnd, ajustesDe(estado).pesosReto)
  await enFase(
    db,
    estado,
    (tx) =>
      tx.update(doc(db, ESTADO), {
        reto: eleccion,
        cronoInicio: null,
        duracion: 0,
        eventos: evento(
          estado,
          `${snap.exists() ? '🗣️ Eligió' : '🎲 No eligió a tiempo; salió'}: ${TEXTO_RETO[eleccion]}`,
        ),
      }),
    (e) => !e.reto,
  )
  return eleccion
}

/** Pasa a una fase con cronómetro (aún sin iniciar: lo arranca el anfitrión). */
export async function pasarA(db, estado, fase) {
  const texto = {
    [FASES.IMPRESION]: '👀 Primera impresión',
    [FASES.ARGUMENTO]: `🎤 Argumenta ${estado.oradorNombre}`,
    [FASES.VOTO]: '🗳️ Voto final',
  }[fase]
  await enFase(db, estado, (tx) =>
    tx.update(doc(db, ESTADO), {
      fase,
      cronoInicio: null,
      duracion: ajustesDe(estado).duracion[fase] || 0,
      eventos: texto ? evento(estado, texto) : estado.eventos,
    }),
  )
}

export async function iniciarCrono(db, estado) {
  await updateDoc(doc(db, ESTADO), {
    cronoInicio: serverTimestamp(),
    duracion: ajustesDe(estado).duracion[estado.fase] || estado.duracion,
  })
}

const delTurno = (estado) => [where('generacion', '==', estado.generacion), where('turno', '==', estado.turno)]

/** Lee respuestas de una fase del turno vigente, indexadas por personaId. */
export async function leerRespuestas(db, estado, fase) {
  const snap = await getDocs(query(collection(db, 'respuestas'), ...delTurno(estado), where('fase', '==', fase)))
  return Object.fromEntries(snap.docs.map((d) => [d.data().personaId, d.data().valores]))
}

/** Sentimientos del turno, solo de celulares que de verdad pertenecen a esa persona. */
export async function leerSentimientos(db, estado, personas) {
  const snap = await getDocs(query(collection(db, 'sentimiento'), ...delTurno(estado)))
  return sentimientosValidos(
    snap.docs.map((d) => ({ uid: d.id, ...d.data() })),
    personas,
  )
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

/**
 * Cierra el voto: lee la evidencia de la ficha (solo ahora), calcula el turno, suma al marcador y
 * publica el resultado con la revelación en el turno y en el estado, a la vez para todos.
 */
export async function cerrarTurno(db, estado, { personas, conectados }) {
  const { puntos, duracion } = ajustesDe(estado)
  const [impresiones, votos, sentimientos, evidenciaSnap] = await Promise.all([
    leerRespuestas(db, estado, FASES.IMPRESION),
    leerRespuestas(db, estado, FASES.VOTO),
    leerSentimientos(db, estado, personas),
    estado.fichaId != null ? getDoc(doc(db, 'evidencia', String(estado.fichaId))) : null,
  ])
  const evidencia = evidenciaSnap?.exists() ? evidenciaSnap.data() : {}
  // Solo cuentan las personas inscritas en esta partida.
  const vigentes = new Set(personas.map((p) => p.id))
  for (const mapa of [impresiones, votos]) for (const id of Object.keys(mapa)) if (!vigentes.has(id)) delete mapa[id]
  const reto = estado.reto || 'defiende'
  const calculo = calcularTurno({
    reto,
    nivel: evidencia.nivel ?? null,
    oradorId: estado.oradorId,
    impresiones,
    votos,
    sentimientos,
    puntos,
  })
  const presentes = personas.filter((p) => !p.ausente && conectados.has(p.id)).map((p) => p.id)
  const marcador = aplicarTurno(estado.marcador || {}, calculo, presentes, puntos)
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

  const revelacion = {
    nivel: evidencia.nivel ?? null,
    texto: evidencia.texto ?? '',
    mito: evidencia.mito ?? '',
    origen: evidencia.origen ?? '',
  }
  const resultado = {
    retoSorteo: estado.retoSorteo ?? null,
    reto,
    revelacion,
    predijeron: calculo.predijeron,
    aciertos: calculo.aciertos.length,
    aciertosNombres: calculo.aciertos.map((id) => nombre[id]).filter(Boolean),
    oradorAcerto: aciertos.has(estado.oradorId),
    votantes: calculo.votantes,
    pctSi: calculo.pctSi,
    notaPromedio: calculo.notaPromedio,
    base: calculo.base,
    pctPersuadido: calculo.pctPersuadido,
    pctPersuadibles: calculo.pctPersuadibles,
    persuasionFija: calculo.persuasionFija,
    puntosPersuasion: calculo.puntosPersuasion,
    contracorriente: calculo.contracorriente,
    persuadidos: calculo.persuadidos.length,
    enContra: calculo.enContra.length,
    fuegos: calculo.fuegos,
    pctConoce: calculo.pctConoce,
    puntosOrador: Object.values(calculo.puntosTurno[estado.oradorId] || {}).reduce((a, b) => a + b, 0),
    detalle,
  }

  await enFase(db, estado, (batch) => {
    batch.set(doc(db, 'turnos', `${estado.generacion}_${estado.turno}`), {
      generacion: estado.generacion,
      turno: estado.turno,
      oradorId: estado.oradorId,
      oradorNombre: estado.oradorNombre,
      fichaId: estado.fichaId,
      ficha: estado.ficha?.nombre ?? null,
      categoria: estado.ficha?.categoria ?? null,
      retoSorteo: estado.retoSorteo ?? null,
      reto,
      revelacion,
      resultado,
      puntosTurno: calculo.puntosTurno,
      creado: serverTimestamp(),
    })
    batch.update(doc(db, 'personas', estado.oradorId), { paso: true })
    if (estado.fichaId != null) batch.update(doc(db, 'fichas', String(estado.fichaId)), { estado: 'jugada' })
    batch.update(doc(db, ESTADO), {
      fase: FASES.RESULTADO,
      cronoInicio: serverTimestamp(),
      duracion: duracion.resultado,
      resultado,
      marcador,
      top: topConNombres(marcador, nombre, 10),
      eventos: evento(
        estado,
        `✅ «${estado.ficha?.nombre}» es ${revelacion.nivel ?? '¿?'} · ${calculo.pctSi ?? 0}% le sirve · ${estado.oradorNombre} +${resultado.puntosOrador} pts`,
      ),
    })
  })
  log(
    db,
    'cierre',
    `${estado.oradorNombre} · «${estado.ficha?.nombre}» · ${reto} · ${revelacion.nivel} · ${calculo.votantes} votos, ${calculo.aciertos.length} aciertos, orador +${resultado.puntosOrador}`,
    estado,
  )
  return { calculo, resultado, marcador }
}

/** Guarda los ajustes editables (puntos, pesos del reto, duraciones). */
export async function guardarAjustes(db, ajustes) {
  await updateDoc(doc(db, ESTADO), { ajustes })
  log(db, 'ajustes', JSON.stringify(ajustes).slice(0, 400))
}

export function topConNombres(marcador, nombre, n = 10) {
  return ranking(marcador)
    .filter((f) => nombre[f.personaId])
    .slice(0, n)
    .map((f) => ({ id: f.personaId, nombre: nombre[f.personaId], total: f.total, posicion: f.posicion }))
}

/** Salta el turno: la ficha vuelve a la mano y la persona sigue pendiente. */
export async function saltarTurno(db, estado) {
  await enFase(db, estado, (batch) => {
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
  })
  log(db, 'saltar', `Turno de ${estado.oradorNombre}`, estado)
}

export async function terminarPartida(db, estado, personas) {
  const nombre = Object.fromEntries(personas.map((p) => [p.id, p.nombre]))
  const snap = await getDocs(query(collection(db, 'turnos'), where('generacion', '==', estado.generacion)))
  await updateDoc(doc(db, ESTADO), {
    fase: FASES.FINAL,
    cronoInicio: null,
    top: topConNombres(estado.marcador || {}, nombre, 30),
    premios: premios(
      snap.docs.map((d) => d.data()),
      estado.marcador || {},
      nombre,
    ),
    eventos: evento(estado, '🏁 Fin de la partida'),
  })
  log(db, 'final', `${snap.size} turnos jugados`, estado)
}

export async function marcarAusente(db, persona, ausente) {
  await updateDoc(doc(db, 'personas', persona.id), { ausente })
  log(db, ausente ? 'ausente' : 'presente', persona.nombre)
}

export async function renombrar(db, persona, nombre) {
  await updateDoc(doc(db, 'personas', persona.id), { nombre: nombre.trim().slice(0, 30) })
  log(db, 'renombrar', `${persona.nombre} → ${nombre.trim().slice(0, 30)}`)
}

const normal = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

/**
 * Recuperación desde otro navegador o celular. Con nombre + código, siempre. Solo con el nombre,
 * si esa persona no está conectada ahora mismo (así nadie le quita el lugar a quien sigue jugando).
 */
export async function resolverReclamo(db, reclamo, personas, conectados = new Set()) {
  const p = personas.find((x) => normal(x.nombre) === normal(reclamo.nombre))
  let ok = false
  let motivo = 'no hay nadie con ese nombre en esta partida'
  if (p && reclamo.codigo) {
    const c = await getDoc(doc(db, 'codigos', p.id))
    ok = c.exists() && c.data().codigo === reclamo.codigo
    motivo = ok ? 'nombre y código' : 'código equivocado'
  } else if (p) {
    ok = !conectados.has(p.id)
    motivo = ok ? 'solo nombre (estaba desconectado)' : 'solo nombre, pero sigue conectado en otro celular'
  }
  const batch = writeBatch(db)
  if (ok) batch.update(doc(db, 'personas', p.id), { uids: arrayUnion(reclamo.uid) })
  batch.update(
    doc(db, 'reclamos', reclamo.uid),
    ok ? { estado: 'ok', personaId: p.id } : { estado: 'rechazado', motivo: p && !reclamo.codigo ? 'conectado' : 'datos' },
  )
  await batch.commit()
  log(db, ok ? 'recuperacion_ok' : 'recuperacion_rechazada', `«${reclamo.nombre}»: ${motivo}`)
  return ok
}

/**
 * Empezar de cero. No borra nada (las reglas no lo permiten): sube la generación, así los
 * celulares vuelven al registro y la pantalla deja de ver a los inscritos anteriores.
 */
export async function empezarDeCero(db, estado, fichas) {
  const batch = writeBatch(db)
  const generacion = (estado.generacion || 0) + 1
  batch.set(doc(db, ESTADO), { ...estadoInicial(generacion, estado.codigoSala), ajustes: estado.ajustes ?? null })
  // Las fichas cargadas (también las importadas) vuelven a estar libres; las excluidas siguen fuera.
  for (const f of fichas)
    batch.update(doc(db, 'fichas', String(f.n)), {
      dueno: null,
      estado: f.estado === 'excluida' ? 'excluida' : 'libre',
      generacion,
    })
  await batch.commit()
  log(db, 'empezar_de_cero', `Generación ${estado.generacion} → ${generacion}: todos los celulares vuelven al registro`, estado)
}

/** Reemplaza la tabla de fichas completa (solo antes de iniciar). */
export async function reemplazarFichas(db, estado, nuevas, viejas) {
  const batch = writeBatch(db)
  const nuevasN = new Set(nuevas.map((f) => f.n))
  for (const f of nuevas) escribirFicha(batch, db, f, estado.generacion)
  for (const f of viejas) if (!nuevasN.has(f.n)) batch.update(doc(db, 'fichas', String(f.n)), { estado: 'retirada' })
  await batch.commit()
  log(db, 'fichas', `Tabla reemplazada: ${nuevas.length} fichas (${nuevas.filter((f) => !f.excluida).length} jugables)`, estado)
}

/** Saca una ficha de la partida (o la devuelve). Solo fichas sin repartir. */
export async function excluirFicha(db, ficha, excluir) {
  await updateDoc(doc(db, 'fichas', String(ficha.n)), { estado: excluir ? 'excluida' : 'libre' })
  log(db, excluir ? 'excluir_ficha' : 'incluir_ficha', ficha.nombre ?? `#${ficha.n}`)
}
