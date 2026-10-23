// Reglas del juego como funciones puras: sin Firebase, sin React, sin reloj.
// La pantalla grande es la única que las ejecuta y escribe el resultado.
import { CATEGORIAS_EFECTO, LEMA_EFECTO, PUNTOS, RETOS } from './config.js'

export const FASES = {
  SALA: 'sala',
  RULETA_PERSONA: 'ruleta_persona',
  RULETA_FICHA: 'ruleta_ficha',
  RULETA_RETO: 'ruleta_reto',
  IMPRESION: 'impresion',
  ARGUMENTO: 'argumento',
  VOTO: 'voto',
  RESULTADO: 'resultado',
  FINAL: 'final',
}

const SECUENCIA = [
  FASES.SALA,
  FASES.RULETA_PERSONA,
  FASES.RULETA_FICHA,
  FASES.RULETA_RETO,
  FASES.IMPRESION,
  FASES.ARGUMENTO,
  FASES.VOTO,
  FASES.RESULTADO,
]

/** Fases con cronómetro: el celular puede responder mientras corre. */
export const FASES_CON_RESPUESTA = [FASES.IMPRESION, FASES.VOTO]

/** `quedan`: cuántas personas pueden salir todavía en la ruleta. */
export function siguienteFase(fase, { quedan = 1 } = {}) {
  if (fase === FASES.RESULTADO) return quedan > 0 ? FASES.RULETA_PERSONA : FASES.FINAL
  if (fase === FASES.FINAL) return FASES.FINAL
  const i = SECUENCIA.indexOf(fase)
  return SECUENCIA[i + 1]
}

export function sortear(lista, rnd = Math.random) {
  if (!lista.length) return null
  return lista[Math.min(lista.length - 1, Math.floor(rnd() * lista.length))]
}

/** Sorteo con pesos: `pesos` es { valor: peso }; los pesos no tienen que sumar 100. */
export function sortearConPesos(pesos, rnd = Math.random) {
  const entradas = Object.entries(pesos).filter(([, p]) => p > 0)
  const total = entradas.reduce((s, [, p]) => s + p, 0)
  if (!total) return entradas[0]?.[0] ?? null
  const r = rnd() * total
  let acumulado = 0
  for (const [v, p] of entradas) {
    acumulado += p
    if (r < acumulado - 1e-9) return v
  }
  return entradas[entradas.length - 1][0]
}

const PESOS_RETO = Object.fromEntries(RETOS.map((r) => [r.valor, r.peso]))

/** Ruleta 3: aplicala | defiende | ataca | elige. */
export const sortearReto = (rnd = Math.random, pesos = PESOS_RETO) => sortearConPesos(pesos, rnd)

/** "Tú eliges" sin elección a tiempo: sorteo entre los otros tres con sus pesos relativos. */
export function sortearSinElegir(rnd = Math.random, pesos = PESOS_RETO) {
  return sortearConPesos(Object.fromEntries(Object.entries(pesos).filter(([v]) => v !== 'elige')), rnd)
}

/** Postura que se mide para la persuasión: Aplícala cuenta como Defiende. */
export const posturaDe = (reto) => (reto === 'ataca' ? 'no' : 'si')

/** Título, lema y guion de 3 pasos para mostrar en pantalla. */
export function textoReto(reto, categoria) {
  const r = RETOS.find((x) => x.valor === reto)
  if (!r) return null
  const lema = CATEGORIAS_EFECTO.includes(categoria) ? LEMA_EFECTO[reto] ?? null : null
  return { titulo: r.texto, lema, pasos: r.pasos }
}

function barajar(lista, rnd) {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Reparte 2 fichas por persona, sin repetir. Quien no alcanza queda sin fichas.
 * `info` (opcional) es { n: { categoria, nivel } }: la segunda ficha de cada persona se busca,
 * en lo posible, de otra categoría y otro nivel que la primera.
 */
export function repartir(libres, personas, rnd = Math.random, info = {}) {
  const mazo = barajar(libres, rnd)
  const reparto = {}
  const distinta = (a, b, campo) => {
    const x = info[a]?.[campo]
    const y = info[b]?.[campo]
    return x == null || y == null || x !== y
  }
  for (const p of personas) {
    if (mazo.length < 2) break
    const primera = mazo.shift()
    const criterios = [
      (n) => distinta(primera, n, 'categoria') && distinta(primera, n, 'nivel'),
      (n) => distinta(primera, n, 'categoria'),
      (n) => distinta(primera, n, 'nivel'),
      () => true,
    ]
    let i = -1
    for (const ok of criterios) {
      i = mazo.findIndex(ok)
      if (i >= 0) break
    }
    reparto[p] = [primera, mazo.splice(i, 1)[0]]
  }
  return reparto
}

/** Quién puede salir en la ruleta de personas. */
export function candidatosRuleta(personas, conectados, conFichas) {
  return personas
    .filter((p) => !p.paso && !p.ausente && conectados.has(p.id) && conFichas.has(p.id))
    .map((p) => p.id)
}

export function nombreUnico(nombre, existentes) {
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  const usados = new Set(existentes.map((n) => n.trim().toLowerCase()))
  if (!usados.has(limpio.toLowerCase())) return limpio
  let n = 2
  while (usados.has(`${limpio} ${n}`.toLowerCase())) n++
  return `${limpio} ${n}`
}

const impresionCompleta = (i) =>
  !!i && typeof i.conoce === 'boolean' && !!i.util && !!i.prediccion
const votoCompleto = (v) => !!v && !!v.sirve && Number.isFinite(v.nota)
const reacciono = (s) => !!s && (s.reacciones ?? 0) > 0

/** ¿El turno es contracorriente? Solo Defiende/Ataca contra el veredicto, nunca Debatida. */
export function esContracorriente(reto, nivel) {
  return (reto === 'ataca' && nivel === 'Respaldada') || (reto === 'defiende' && nivel === 'Poco respaldada')
}

/**
 * Resultado de un turno. Todos los mapas van indexados por personaId.
 * reto: el reto efectivo (aplicala | defiende | ataca). nivel: la evidencia real de la ficha.
 * impresiones: { conoce: bool, util: 'si'|'no'|'ni', prediccion: nivel de evidencia }
 *   (el orador también responde la impresión: suma por ella y por su predicción)
 * votos: { sirve: 'si'|'no', nota: 1..5 } (el orador no vota)
 * sentimientos: { reacciones: número total, fuego: número }
 */
export function calcularTurno({ reto, nivel, oradorId, impresiones, votos, sentimientos, puntos = PUNTOS }) {
  const P = { ...PUNTOS, ...puntos }
  const sinOrador = (mapa) => Object.entries(mapa || {}).filter(([id]) => id !== oradorId)
  const votosValidos = sinOrador(votos).filter(([, v]) => votoCompleto(v))
  const todasImps = Object.fromEntries(Object.entries(impresiones || {}).filter(([, i]) => impresionCompleta(i)))
  const imps = Object.fromEntries(Object.entries(todasImps).filter(([id]) => id !== oradorId))

  const votantes = votosValidos.length
  const si = votosValidos.filter(([, v]) => v.sirve === 'si').length
  const pctSi = votantes ? Math.round((si / votantes) * 100) : null
  const notaPromedio = votantes
    ? Math.round((votosValidos.reduce((s, [, v]) => s + v.nota, 0) / votantes) * 10) / 10
    : null

  // Persuadibles: no estaban en la postura defendida (estaban en la contraria o en "Ni idea").
  const objetivo = posturaDe(reto)
  const conAmbas = votosValidos.filter(([id]) => imps[id])
  const fuera = conAmbas.filter(([id]) => imps[id].util !== objetivo)
  const persuadidos = fuera.filter(([, v]) => v.sirve === objetivo).map(([id]) => id)
  const enContra = conAmbas
    .filter(([id, v]) => imps[id].util === objetivo && v.sirve !== objetivo)
    .map(([id]) => id)
  const base = fuera.length
  const pctPersuadido = base ? Math.round((persuadidos.length / base) * 100) : null
  const pctPersuadibles = votantes ? Math.round((base / votantes) * 100) : null
  const persuasionFija = votantes > 0 && pctPersuadibles < P.umbralPersuadibles

  // Predicción de evidencia: se compara con la base de datos, no con la sala.
  const predijeron = Object.keys(todasImps)
  const aciertos = nivel ? predijeron.filter((id) => todasImps[id].prediccion === nivel) : []

  const contracorriente = esContracorriente(reto, nivel) && (notaPromedio ?? 0) >= P.contracorrienteNota

  const puntosTurno = {}
  const sumar = (id, campo, n) => {
    puntosTurno[id] ??= { participacion: 0, prediccion: 0, argumento: 0 }
    puntosTurno[id][campo] += n
  }
  for (const id of predijeron) sumar(id, 'participacion', P.impresion)
  for (const [id, s] of sinOrador(sentimientos)) if (reacciono(s)) sumar(id, 'participacion', P.reaccion)
  for (const [id] of votosValidos) sumar(id, 'participacion', P.voto)
  for (const id of aciertos) sumar(id, 'prediccion', P.prediccion)
  const puntosPersuasion = persuasionFija
    ? P.persuasionFija
    : Math.min(P.oradorPersuasionMax, Math.floor((pctPersuadido ?? 0) / 10) * P.oradorPorDiezPct)
  sumar(
    oradorId,
    'argumento',
    P.oradorBase +
      Math.round((notaPromedio ?? 0) * P.oradorPorNota) +
      puntosPersuasion +
      (contracorriente ? P.contracorriente : 0),
  )

  const fuegos = Object.values(sentimientos || {}).reduce((s, x) => s + (x?.fuego ?? 0), 0)
  const conocen = Object.values(imps).filter((i) => i.conoce).length

  return {
    votantes,
    pctSi,
    notaPromedio,
    base,
    persuadidos,
    pctPersuadido,
    pctPersuadibles,
    persuasionFija,
    puntosPersuasion,
    contracorriente,
    enContra,
    predijeron: predijeron.length,
    aciertos,
    fuegos,
    pctConoce: Object.keys(imps).length ? Math.round((conocen / Object.keys(imps).length) * 100) : null,
    completos: Object.keys(imps).filter((id) => votoCompleto(votos?.[id])),
    puntosTurno,
    oradorId,
  }
}

const vacio = () => ({ total: 0, participacion: 0, prediccion: 0, argumento: 0, rachas: 0, racha: 0, aciertos: 0 })

/**
 * Suma un turno al marcador (devuelve uno nuevo). La racha avanza con impresión y voto
 * completos; el orador la conserva tal cual; cualquier otro que no complete la pierde.
 */
export function aplicarTurno(marcador, calculo, presentes = [], puntos = PUNTOS) {
  const P = { ...PUNTOS, ...puntos }
  const m = Object.fromEntries(Object.entries(marcador).map(([id, v]) => [id, { ...v }]))
  const acerto = new Set(calculo.aciertos)
  const ids = new Set([...Object.keys(m), ...presentes, ...Object.keys(calculo.puntosTurno)])
  const completos = new Set(calculo.completos)
  for (const id of ids) {
    const fila = (m[id] ??= vacio())
    const p = calculo.puntosTurno[id]
    if (p) {
      fila.participacion += p.participacion
      fila.prediccion += p.prediccion
      fila.argumento += p.argumento
      fila.total += p.participacion + p.prediccion + p.argumento
    }
    if (acerto.has(id)) fila.aciertos = (fila.aciertos || 0) + 1
    if (id === calculo.oradorId) continue
    if (completos.has(id)) {
      fila.racha += 1
      if (fila.racha % P.rachaCada === 0) {
        fila.rachas += P.racha
        fila.total += P.racha
      }
    } else {
      fila.racha = 0
    }
  }
  return m
}

/** Orden por total; empates comparten posición (1, 1, 3…). */
export function ranking(marcador) {
  const filas = Object.entries(marcador)
    .map(([personaId, v]) => ({ personaId, ...v }))
    .sort((a, b) => b.total - a.total)
  filas.forEach((f, i) => {
    f.posicion = i > 0 && f.total === filas[i - 1].total ? filas[i - 1].posicion : i + 1
  })
  return filas
}

const mejor = (lista, valor) =>
  lista.reduce((m, x) => (valor(x) != null && (m == null || valor(x) > valor(m)) ? x : m), null)

/**
 * Insignias y rankings de fichas del podio final, a partir de los turnos jugados.
 * turnos: [{ oradorId, oradorNombre, ficha, resultado }]; marcador: el del estado.
 */
export function premios(turnos, marcador, nombre) {
  const jugados = turnos.filter((t) => t.resultado && !t.resultado.saltado)
  const r = (t) => t.resultado
  const insignia = (t, detalle) => (t ? { nombre: t.oradorNombre, ficha: t.ficha, detalle } : null)

  const persuasor = mejor(
    jugados.filter((t) => r(t).base > 0),
    (t) => r(t).pctPersuadido * 1000 + r(t).persuadidos,
  )
  // Abogado del Diablo: le tocó ir contra la evidencia (Ataca una Respaldada o Defiende una Poco
  // respaldada) y fue quien mejor nota sacó haciéndolo. Los +3 de contracorriente piden nota ≥ 4.
  const abogado = mejor(
    jugados.filter((t) => r(t).contracorriente || esContracorriente(t.reto, t.revelacion?.nivel)),
    (t) => r(t).notaPromedio,
  )
  const aplaudido = mejor(
    jugados.filter((t) => r(t).fuegos > 0),
    (t) => r(t).fuegos,
  )
  const maxAciertos = Math.max(0, ...Object.values(marcador || {}).map((m) => m.aciertos || 0))
  const ojo = maxAciertos
    ? Object.entries(marcador)
        .filter(([, m]) => m.aciertos === maxAciertos)
        .map(([id]) => nombre[id])
        .filter(Boolean)
    : []

  const conVotos = jugados.filter((t) => r(t).votantes > 0)
  const conImpresion = jugados.filter((t) => r(t).pctConoce != null)
  const ficha = (t, detalle) => (t ? { ficha: t.ficha, detalle } : null)
  const conocida = mejor(conImpresion, (t) => r(t).pctConoce)
  const desconocida = mejor(conImpresion, (t) => -r(t).pctConoce)
  const joya = mejor(
    conVotos.filter((t) => r(t).pctConoce != null && r(t).pctConoce <= 50),
    (t) => r(t).pctSi,
  )
  const polemica = mejor(conVotos, (t) => -Math.abs(r(t).pctSi - 50))
  const engano = mejor(
    jugados.filter((t) => r(t).predijeron > 0),
    (t) => (r(t).predijeron - r(t).aciertos) / r(t).predijeron,
  )
  const pctErrado = (t) => Math.round(((r(t).predijeron - r(t).aciertos) / r(t).predijeron) * 100)

  return {
    insignias: {
      persuasor: insignia(persuasor, persuasor && `${r(persuasor).pctPersuadido}% persuadido`),
      abogado: insignia(abogado, abogado && `contracorriente con nota ${r(abogado).notaPromedio}`),
      aplaudido: insignia(aplaudido, aplaudido && `${r(aplaudido).fuegos} 🔥`),
      ojoClinico: ojo.length ? { nombre: ojo.join(', '), detalle: `${maxAciertos} predicciones acertadas` } : null,
    },
    fichas: {
      conocida: ficha(conocida, conocida && `${r(conocida).pctConoce}% la conocía`),
      desconocida: ficha(desconocida, desconocida && `${r(desconocida).pctConoce}% la conocía`),
      joya: ficha(joya, joya && `poco conocida, a ${r(joya).pctSi}% le sirve`),
      polemica: ficha(polemica, polemica && `${r(polemica).pctSi}% le sirve`),
      engano: ficha(engano, engano && `${pctErrado(engano)}% predijo mal su evidencia`),
    },
  }
}

/**
 * Por qué sumó puntos cada quien en el turno, en frases cortas («Voto final +2»).
 * Para el orador: base, nota, persuasión, contracorriente, más su impresión y predicción.
 */
export function motivosTurno(id, { oradorId, impresiones, votos, sentimientos, calculo, rachaNueva = false, puntos = PUNTOS }) {
  const P = { ...PUNTOS, ...puntos }
  const m = []
  if (impresionCompleta(impresiones?.[id])) m.push(`Primera impresión +${P.impresion}`)
  if (calculo.aciertos.includes(id)) m.push(`Predicción de evidencia acertada +${P.prediccion}`)
  if (id === oradorId) {
    m.push(`Base de orador +${P.oradorBase}`)
    m.push(`Nota ${calculo.notaPromedio ?? 0} × ${P.oradorPorNota} = +${Math.round((calculo.notaPromedio ?? 0) * P.oradorPorNota)}`)
    m.push(
      calculo.persuasionFija
        ? `Pocos persuadibles (${calculo.pctPersuadibles}%): +${calculo.puntosPersuasion} fijos`
        : `Persuasión ${calculo.pctPersuadido ?? 0}%: +${calculo.puntosPersuasion}`,
    )
    if (calculo.contracorriente) m.push(`Contracorriente +${P.contracorriente}`)
    return m
  }
  if (reacciono(sentimientos?.[id])) m.push(`Reaccionaste +${P.reaccion}`)
  if (votoCompleto(votos?.[id])) m.push(`Voto final +${P.voto}`)
  if (rachaNueva) m.push(`Racha de ${P.rachaCada} turnos +${P.racha}`)
  return m
}

/**
 * Evento sorpresa: un ladrón le quita la tercera parte de sus puntos a alguien del podio.
 * presentes: ids que pueden participar. Devuelve { ladron, victima, puntos, marcador } o null.
 */
export function robo(marcador, presentes, rnd = Math.random) {
  const filas = ranking(Object.fromEntries(Object.entries(marcador).filter(([id]) => presentes.includes(id))))
  const victimas = filas.filter((f) => f.total >= 3).slice(0, 3)
  if (!victimas.length) return null
  const v = victimas[Math.min(victimas.length - 1, Math.floor(rnd() * victimas.length))]
  // El ladrón sale de la mitad de abajo (si se puede), nunca es la víctima.
  const otros = filas.filter((f) => f.personaId !== v.personaId)
  const abajo = otros.slice(Math.floor(otros.length / 2))
  const pool = abajo.length ? abajo : otros
  const l = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))] ?? presentes.find((id) => id !== v.personaId)
  const ladron = typeof l === 'string' ? l : l?.personaId
  if (!ladron) return null
  const puntos = Math.floor(v.total / 3)
  const m = Object.fromEntries(Object.entries(marcador).map(([id, x]) => [id, { ...x }]))
  m[ladron] ??= { total: 0, participacion: 0, prediccion: 0, argumento: 0, rachas: 0, racha: 0, aciertos: 0 }
  m[v.personaId].total -= puntos
  m[v.personaId].robado = (m[v.personaId].robado || 0) + puntos
  m[ladron].total += puntos
  m[ladron].robos = (m[ladron].robos || 0) + puntos
  return { ladron, victima: v.personaId, puntos, marcador: m }
}
