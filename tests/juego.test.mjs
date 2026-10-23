import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FASES,
  siguienteFase,
  sortear,
  sortearPostura,
  repartir,
  calcularTurno,
  aplicarTurno,
  ranking,
  candidatosRuleta,
  nombreUnico,
} from '../src/lib/juego.js'
import { PUNTOS } from '../src/lib/config.js'

const rndFijo = (v) => () => v

test('la secuencia de fases de un turno', () => {
  assert.equal(siguienteFase(FASES.SALA), FASES.RULETA_PERSONA)
  assert.equal(siguienteFase(FASES.RULETA_PERSONA), FASES.RULETA_FICHA)
  assert.equal(siguienteFase(FASES.RULETA_FICHA), FASES.RULETA_POSTURA)
  assert.equal(siguienteFase(FASES.RULETA_POSTURA), FASES.IMPRESION)
  assert.equal(siguienteFase(FASES.IMPRESION), FASES.ARGUMENTO)
  assert.equal(siguienteFase(FASES.ARGUMENTO), FASES.VOTO)
  assert.equal(siguienteFase(FASES.VOTO), FASES.RESULTADO)
  assert.equal(siguienteFase(FASES.RESULTADO, { quedan: 3 }), FASES.RULETA_PERSONA)
  assert.equal(siguienteFase(FASES.RESULTADO, { quedan: 0 }), FASES.FINAL)
})

test('sortear usa el aleatorio inyectado', () => {
  assert.equal(sortear(['a', 'b', 'c'], rndFijo(0)), 'a')
  assert.equal(sortear(['a', 'b', 'c'], rndFijo(0.99)), 'c')
  assert.equal(sortear([], rndFijo(0.5)), null)
})

test('postura 40/40/20', () => {
  assert.equal(sortearPostura(rndFijo(0.1)), 'defiende')
  assert.equal(sortearPostura(rndFijo(0.39)), 'defiende')
  assert.equal(sortearPostura(rndFijo(0.4)), 'ataca')
  assert.equal(sortearPostura(rndFijo(0.79)), 'ataca')
  assert.equal(sortearPostura(rndFijo(0.8)), 'elige')
  assert.equal(sortearPostura(rndFijo(0.999)), 'elige')
})

test('repartir da 2 fichas por persona sin repetir', () => {
  let i = 0
  const rnd = () => ((i++ * 0.37) % 1)
  const r = repartir([1, 2, 3, 4, 5, 6, 7], ['a', 'b', 'c'], rnd)
  const todas = Object.values(r).flat()
  assert.equal(Object.keys(r).length, 3)
  for (const p of ['a', 'b', 'c']) assert.equal(r[p].length, 2)
  assert.equal(new Set(todas).size, 6)
})

test('repartir con pocas fichas deja sin fichas a quien no alcanza', () => {
  const r = repartir([1, 2, 3], ['a', 'b'], rndFijo(0))
  assert.equal(r.a.length, 2)
  assert.equal(r.b, undefined)
})

test('candidatos de ruleta: presentes, no ausentes, que no han pasado, con fichas', () => {
  const personas = [
    { id: 'a', paso: false, ausente: false },
    { id: 'b', paso: true, ausente: false },
    { id: 'c', paso: false, ausente: true },
    { id: 'd', paso: false, ausente: false },
    { id: 'e', paso: false, ausente: false },
  ]
  const conectados = new Set(['a', 'b', 'c', 'e'])
  const conFichas = new Set(['a', 'b', 'c', 'd'])
  assert.deepEqual(candidatosRuleta(personas, conectados, conFichas), ['a'])
})

test('nombre repetido recibe número', () => {
  assert.equal(nombreUnico('Ana', ['Luis']), 'Ana')
  assert.equal(nombreUnico('Ana', ['Ana']), 'Ana 2')
  assert.equal(nombreUnico('ana ', ['Ana', 'Ana 2']), 'ana 3')
})

// Turno de ejemplo: orador "o" defiende. Público p1..p5.
function turnoBase(postura = 'defiende') {
  return {
    postura,
    oradorId: 'o',
    impresiones: {
      p1: { conoce: true, util: 'si', prediccion: 'si' },
      p2: { conoce: false, util: 'no', prediccion: 'si' },
      p3: { conoce: false, util: 'ni', prediccion: 'no' },
      p4: { conoce: true, util: 'no', prediccion: 'si' },
      // p5 no hizo primera impresión
    },
    votos: {
      p1: { sirve: 'si', nota: 5 },
      p2: { sirve: 'si', nota: 4 },
      p3: { sirve: 'si', nota: 3 },
      p4: { sirve: 'no', nota: 2 },
      p5: { sirve: 'si', nota: 5 },
    },
    sentimientos: { p1: { reacciones: 2 }, p3: { movio: true } },
  }
}

test('calcularTurno: porcentajes, nota y persuadidos (defiende)', () => {
  const c = calcularTurno(turnoBase())
  assert.equal(c.votantes, 5)
  assert.equal(c.pctSi, 80)
  assert.equal(c.notaPromedio, 3.8)
  assert.equal(c.mayoriaSi, true)
  // Postura "si". No estaban en "si": p2 (no), p3 (ni), p4 (no). p5 sin impresión no cuenta.
  assert.equal(c.base, 3)
  assert.deepEqual(c.persuadidos.sort(), ['p2', 'p3'])
  assert.equal(c.pctPersuadido, 67)
  assert.deepEqual(c.enContra, [])
  // Predicción "si" acierta: p1, p2, p4.
  assert.deepEqual(c.aciertos.sort(), ['p1', 'p2', 'p4'])
})

test('calcularTurno: ataca mide hacia "no" y registra cambios en contra', () => {
  const t = turnoBase('ataca')
  const c = calcularTurno(t)
  // Postura "no". No estaban en "no": p1 (si), p3 (ni). Terminan en "no": ninguno.
  assert.equal(c.base, 2)
  assert.deepEqual(c.persuadidos, [])
  assert.equal(c.pctPersuadido, 0)
  // Estaban en "no" y terminaron fuera: p2.
  assert.deepEqual(c.enContra, ['p2'])
})

test('calcularTurno: si todos ya estaban en la postura, no hay base', () => {
  const c = calcularTurno({
    postura: 'defiende',
    oradorId: 'o',
    impresiones: { p1: { conoce: true, util: 'si', prediccion: 'si' } },
    votos: { p1: { sirve: 'si', nota: 4 } },
    sentimientos: {},
  })
  assert.equal(c.base, 0)
  assert.equal(c.pctPersuadido, null)
})

test('calcularTurno: el orador no cuenta aunque haya respondido', () => {
  const t = turnoBase()
  t.votos.o = { sirve: 'no', nota: 1 }
  t.impresiones.o = { conoce: true, util: 'no', prediccion: 'no' }
  const c = calcularTurno(t)
  assert.equal(c.votantes, 5)
})

test('calcularTurno: sin votos no revienta', () => {
  const c = calcularTurno({ postura: 'defiende', oradorId: 'o', impresiones: {}, votos: {}, sentimientos: {} })
  assert.equal(c.votantes, 0)
  assert.equal(c.pctSi, null)
  assert.equal(c.notaPromedio, null)
  assert.equal(c.mayoriaSi, null)
  assert.deepEqual(c.aciertos, [])
})

test('puntos del turno: público y orador', () => {
  const c = calcularTurno(turnoBase())
  const p = c.puntosTurno
  // p1: impresión 1 + reacción 1 + voto 2 + predicción 2
  assert.deepEqual(p.p1, { participacion: 4, prediccion: 2, argumento: 0 })
  // p3: impresión 1 + reacción (movió la barra) 1 + voto 2, predicción falla
  assert.deepEqual(p.p3, { participacion: 4, prediccion: 0, argumento: 0 })
  // p5: solo voto
  assert.deepEqual(p.p5, { participacion: 2, prediccion: 0, argumento: 0 })
  // orador: 5 + 3.8×2 = 7.6 → 8 (redondeo) + 6 (67 % → 6 decenas)
  assert.deepEqual(p.o, { participacion: 0, prediccion: 0, argumento: 5 + 8 + 6 })
})

test('aplicarTurno suma, lleva la racha y la rompe', () => {
  const c = calcularTurno(turnoBase())
  let m = {}
  m = aplicarTurno(m, c, ['o', 'p1', 'p2', 'p3', 'p4', 'p5'])
  assert.equal(m.p1.total, 6)
  assert.equal(m.p1.racha, 1)
  assert.equal(m.p5.racha, 0) // sin impresión no cuenta para racha
  assert.equal(m.o.racha, 0) // el orador ni suma ni rompe: queda como estaba
  m = aplicarTurno(m, c, ['o', 'p1'])
  m = aplicarTurno(m, c, ['o', 'p1'])
  assert.equal(m.p1.racha, 3)
  assert.equal(m.p1.rachas, PUNTOS.racha)
  assert.equal(m.p1.total, 6 * 3 + PUNTOS.racha)
})

test('aplicarTurno: el orador conserva su racha', () => {
  const c = calcularTurno(turnoBase())
  let m = { o: { total: 0, participacion: 0, prediccion: 0, argumento: 0, rachas: 0, racha: 2 } }
  m = aplicarTurno(m, c, ['o'])
  assert.equal(m.o.racha, 2)
})

test('aplicarTurno: quien no participa pierde la racha', () => {
  let m = { x: { total: 3, participacion: 3, prediccion: 0, argumento: 0, rachas: 0, racha: 2 } }
  const c = calcularTurno(turnoBase())
  m = aplicarTurno(m, c, ['x'])
  assert.equal(m.x.racha, 0)
  assert.equal(m.x.total, 3)
})

test('ranking con empates compartidos', () => {
  const r = ranking({ a: { total: 10 }, b: { total: 7 }, c: { total: 10 }, d: { total: 3 } })
  assert.deepEqual(r.map((x) => [x.personaId, x.posicion]), [['a', 1], ['c', 1], ['b', 3], ['d', 4]])
})
