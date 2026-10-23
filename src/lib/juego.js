// Reglas del juego como funciones puras: sin Firebase, sin React, sin reloj.
// La pantalla grande es la única que las ejecuta y escribe el resultado.
import { PUNTOS, POSTURAS } from './config.js'

export const FASES = {
  SALA: 'sala',
  RULETA_PERSONA: 'ruleta_persona',
  RULETA_FICHA: 'ruleta_ficha',
  RULETA_POSTURA: 'ruleta_postura',
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
  FASES.RULETA_POSTURA,
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

export function sortearPostura(rnd = Math.random) {
  const r = rnd()
  let acumulado = 0
  for (const p of POSTURAS) {
    acumulado += p.peso
    if (r < acumulado - 1e-9) return p.valor
  }
  return POSTURAS[POSTURAS.length - 1].valor
}

function barajar(lista, rnd) {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Reparte 2 fichas por persona, sin repetir. Quien no alcanza queda fuera del resultado. */
export function repartir(libres, personas, rnd = Math.random) {
  const mazo = barajar(libres, rnd)
  const reparto = {}
  for (const p of personas) {
    if (mazo.length < 2) break
    reparto[p] = [mazo.shift(), mazo.shift()]
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
const reacciono = (s) => !!s && (s.movio || (s.reacciones ?? 0) > 0)

/**
 * Resultado de un turno. Todos los mapas van indexados por personaId.
 * impresiones: { conoce: bool, util: 'si'|'no'|'ni', prediccion: 'si'|'no' }
 * votos: { sirve: 'si'|'no', nota: 1..5 }
 * sentimientos: { movio: bool, reacciones: número total, fuego: número }
 */
export function calcularTurno({ postura, oradorId, impresiones, votos, sentimientos }) {
  const sinOrador = (mapa) => Object.entries(mapa || {}).filter(([id]) => id !== oradorId)
  const votosValidos = sinOrador(votos).filter(([, v]) => votoCompleto(v))
  const imps = Object.fromEntries(sinOrador(impresiones).filter(([, i]) => impresionCompleta(i)))

  const votantes = votosValidos.length
  const si = votosValidos.filter(([, v]) => v.sirve === 'si').length
  const pctSi = votantes ? Math.round((si / votantes) * 100) : null
  const notaPromedio = votantes
    ? Math.round((votosValidos.reduce((s, [, v]) => s + v.nota, 0) / votantes) * 10) / 10
    : null
  const mayoriaSi = !votantes || si * 2 === votantes ? null : si * 2 > votantes

  const objetivo = postura === 'ataca' ? 'no' : 'si'
  const conAmbas = votosValidos.filter(([id]) => imps[id])
  const fuera = conAmbas.filter(([id]) => imps[id].util !== objetivo)
  const persuadidos = fuera.filter(([, v]) => v.sirve === objetivo).map(([id]) => id)
  const enContra = conAmbas
    .filter(([id, v]) => imps[id].util === objetivo && v.sirve !== objetivo)
    .map(([id]) => id)
  const base = fuera.length
  const pctPersuadido = base ? Math.round((persuadidos.length / base) * 100) : null

  const aciertos =
    mayoriaSi === null
      ? []
      : Object.entries(imps)
          .filter(([id, i]) => votos?.[id] && i.prediccion === (mayoriaSi ? 'si' : 'no'))
          .map(([id]) => id)

  const puntosTurno = {}
  const sumar = (id, campo, n) => {
    puntosTurno[id] ??= { participacion: 0, prediccion: 0, argumento: 0 }
    puntosTurno[id][campo] += n
  }
  for (const id of Object.keys(imps)) sumar(id, 'participacion', PUNTOS.impresion)
  for (const [id, s] of sinOrador(sentimientos)) if (reacciono(s)) sumar(id, 'participacion', PUNTOS.reaccion)
  for (const [id] of votosValidos) sumar(id, 'participacion', PUNTOS.voto)
  for (const id of aciertos) sumar(id, 'prediccion', PUNTOS.prediccion)
  sumar(
    oradorId,
    'argumento',
    PUNTOS.oradorBase +
      Math.round((notaPromedio ?? 0) * PUNTOS.oradorPorNota) +
      Math.floor((pctPersuadido ?? 0) / 10) * PUNTOS.oradorPorDiezPct,
  )

  const fuegos = Object.values(sentimientos || {}).reduce((s, x) => s + (x?.fuego ?? 0), 0)
  const conocen = Object.values(imps).filter((i) => i.conoce).length

  return {
    votantes,
    pctSi,
    notaPromedio,
    mayoriaSi,
    base,
    persuadidos,
    pctPersuadido,
    enContra,
    aciertos,
    fuegos,
    pctConoce: Object.keys(imps).length ? Math.round((conocen / Object.keys(imps).length) * 100) : null,
    completos: Object.keys(imps).filter((id) => votoCompleto(votos?.[id])),
    puntosTurno,
    oradorId,
  }
}

const vacio = () => ({ total: 0, participacion: 0, prediccion: 0, argumento: 0, rachas: 0, racha: 0 })

/**
 * Suma un turno al marcador (devuelve uno nuevo). La racha avanza con impresión y voto
 * completos; el orador la conserva tal cual; cualquier otro que no complete la pierde.
 */
export function aplicarTurno(marcador, calculo, presentes = []) {
  const m = Object.fromEntries(Object.entries(marcador).map(([id, v]) => [id, { ...v }]))
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
    if (id === calculo.oradorId) continue
    if (completos.has(id)) {
      fila.racha += 1
      if (fila.racha % PUNTOS.rachaCada === 0) {
        fila.rachas += PUNTOS.racha
        fila.total += PUNTOS.racha
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
