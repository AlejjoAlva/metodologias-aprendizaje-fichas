import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FASES,
  siguienteFase,
  sortear,
  sortearReto,
  sortearSinElegir,
  textoReto,
  esContracorriente,
  repartir,
  calcularTurno,
  aplicarTurno,
  ranking,
  candidatosRuleta,
  nombreUnico,
  premios,
} from '../src/lib/juego.js'
import { PUNTOS } from '../src/lib/config.js'

const rndFijo = (v) => () => v

test('la secuencia de fases de un turno', () => {
  assert.equal(siguienteFase(FASES.SALA), FASES.RULETA_PERSONA)
  assert.equal(siguienteFase(FASES.RULETA_PERSONA), FASES.RULETA_FICHA)
  assert.equal(siguienteFase(FASES.RULETA_FICHA), FASES.RULETA_RETO)
  assert.equal(siguienteFase(FASES.RULETA_RETO), FASES.IMPRESION)
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

test('reto 35/25/25/15 y pesos editables', () => {
  assert.equal(sortearReto(rndFijo(0.1)), 'aplicala')
  assert.equal(sortearReto(rndFijo(0.349)), 'aplicala')
  assert.equal(sortearReto(rndFijo(0.35)), 'defiende')
  assert.equal(sortearReto(rndFijo(0.6)), 'ataca')
  assert.equal(sortearReto(rndFijo(0.85)), 'elige')
  assert.equal(sortearReto(rndFijo(0.999)), 'elige')
  assert.equal(sortearReto(rndFijo(0.99), { aplicala: 0, defiende: 1, ataca: 0, elige: 0 }), 'defiende')
})

test('"Tú eliges" sin elección: sortea entre los otros tres con pesos relativos (35/25/25 de 85)', () => {
  assert.equal(sortearSinElegir(rndFijo(0.4)), 'aplicala') // 0.4 × 85 = 34 < 35
  assert.equal(sortearSinElegir(rndFijo(0.5)), 'defiende') // 42.5
  assert.equal(sortearSinElegir(rndFijo(0.99)), 'ataca')
})

test('texto del reto: lema especial en efectos y mitos', () => {
  assert.equal(textoReto('defiende', 'Técnicas').lema, null)
  assert.equal(textoReto('defiende', 'Mitos y conceptos a desmentir').lema, 'es real y importa')
  assert.equal(textoReto('ataca', 'Efectos de la memoria y sesgos cognitivos').lema, 'está sobrevalorado o no se sostiene')
  assert.equal(textoReto('aplicala', 'Mitos y conceptos a desmentir').lema, null)
  assert.equal(textoReto('aplicala', 'X').pasos.length, 3)
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

test('repartir evita, en lo posible, dos fichas de la misma categoría o nivel', () => {
  const info = {}
  const cats = ['A', 'B', 'C']
  const nivs = ['Respaldada', 'Debatida', 'Poco respaldada']
  for (let n = 1; n <= 18; n++) info[n] = { categoria: cats[n % 3], nivel: nivs[Math.floor(n / 3) % 3] }
  const personas = Array.from({ length: 9 }, (_, i) => `p${i}`)
  for (let semilla = 1; semilla < 30; semilla++) {
    let x = semilla
    const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280)
    const r = repartir(Object.keys(info).map(Number), personas, rnd, info)
    assert.equal(new Set(Object.values(r).flat()).size, 18)
    // Con un mazo variado, las primeras personas siempre reciben fichas distintas en ambas cosas.
    const [a, b] = r.p0
    assert.notEqual(info[a].categoria, info[b].categoria)
    assert.notEqual(info[a].nivel, info[b].nivel)
  }
  // Si no hay forma, igual reparte.
  const igual = { 1: { categoria: 'A', nivel: 'Debatida' }, 2: { categoria: 'A', nivel: 'Debatida' } }
  assert.deepEqual(repartir([1, 2], ['x'], rndFijo(0), igual).x.sort(), [1, 2])
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

// Turno de ejemplo: orador "o" defiende una ficha Respaldada. Público p1..p5.
function turnoBase(reto = 'defiende', nivel = 'Respaldada') {
  return {
    reto,
    nivel,
    oradorId: 'o',
    impresiones: {
      o: { conoce: true, util: 'si', prediccion: 'Respaldada' },
      p1: { conoce: true, util: 'si', prediccion: 'Respaldada' },
      p2: { conoce: false, util: 'no', prediccion: 'Debatida' },
      p3: { conoce: false, util: 'ni', prediccion: 'Respaldada' },
      p4: { conoce: true, util: 'no', prediccion: 'Poco respaldada' },
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
  // Postura "si". No estaban en "si": p2 (no), p3 (ni), p4 (no). p5 sin impresión no cuenta.
  assert.equal(c.base, 3)
  assert.deepEqual(c.persuadidos.sort(), ['p2', 'p3'])
  assert.equal(c.pctPersuadido, 67)
  assert.equal(c.pctPersuadibles, 60)
  assert.equal(c.persuasionFija, false)
  assert.deepEqual(c.enContra, [])
})

test('predicción de evidencia: se compara con el nivel real, incluye al orador', () => {
  const c = calcularTurno(turnoBase())
  assert.deepEqual(c.aciertos.sort(), ['o', 'p1', 'p3'])
  assert.equal(c.predijeron, 5)
  const d = calcularTurno(turnoBase('defiende', 'Debatida'))
  assert.deepEqual(d.aciertos, ['p2'])
})

test('Aplícala se mide igual que Defiende', () => {
  const a = calcularTurno(turnoBase('aplicala'))
  const d = calcularTurno(turnoBase('defiende'))
  assert.deepEqual(a.persuadidos.sort(), d.persuadidos.sort())
  assert.equal(a.pctPersuadido, d.pctPersuadido)
})

test('calcularTurno: ataca mide hacia "no" y registra cambios en contra', () => {
  const c = calcularTurno(turnoBase('ataca'))
  // Postura "no". No estaban en "no": p1 (si), p3 (ni). Terminan en "no": ninguno.
  assert.equal(c.base, 2)
  assert.deepEqual(c.persuadidos, [])
  assert.equal(c.pctPersuadido, 0)
  assert.deepEqual(c.enContra, ['p2'])
})

test('menos del 30 % de persuadibles: 5 puntos fijos en vez de la persuasión', () => {
  const t = turnoBase()
  // Solo p2 es persuadible: 1 de 5 votantes = 20 %.
  t.impresiones.p3.util = 'si'
  t.impresiones.p4.util = 'si'
  const c = calcularTurno(t)
  assert.equal(c.pctPersuadibles, 20)
  assert.equal(c.persuasionFija, true)
  assert.equal(c.puntosPersuasion, PUNTOS.persuasionFija)
  // orador: 5 base + round(3.8 × 2) = 8 + 5 fijos
  assert.equal(c.puntosTurno.o.argumento, 5 + 8 + 5)
})

test('la persuasión tiene un máximo de 10 puntos', () => {
  const c = calcularTurno({ ...turnoBase(), puntos: { oradorPorDiezPct: 5 } })
  assert.equal(c.puntosPersuasion, 10)
})

test('contracorriente: solo Ataca en Respaldada o Defiende en Poco respaldada, con nota ≥ 4', () => {
  assert.equal(esContracorriente('ataca', 'Respaldada'), true)
  assert.equal(esContracorriente('defiende', 'Poco respaldada'), true)
  assert.equal(esContracorriente('defiende', 'Respaldada'), false)
  assert.equal(esContracorriente('ataca', 'Debatida'), false)
  assert.equal(esContracorriente('defiende', 'Debatida'), false)
  assert.equal(esContracorriente('aplicala', 'Poco respaldada'), false)
  const alta = (reto, nivel) => {
    const t = turnoBase(reto, nivel)
    for (const v of Object.values(t.votos)) v.nota = 5
    return calcularTurno(t)
  }
  assert.equal(alta('ataca', 'Respaldada').contracorriente, true)
  assert.equal(alta('ataca', 'Debatida').contracorriente, false)
  assert.equal(alta('aplicala', 'Poco respaldada').contracorriente, false)
  // Nota 3.8 < 4: no hay contracorriente.
  assert.equal(calcularTurno(turnoBase('ataca', 'Respaldada')).contracorriente, false)
  const c = alta('ataca', 'Respaldada')
  const sin = alta('defiende', 'Respaldada')
  assert.equal(c.puntosTurno.o.argumento - c.puntosPersuasion, sin.puntosTurno.o.argumento - sin.puntosPersuasion + PUNTOS.contracorriente)
})

test('calcularTurno: el orador no vota aunque lo intente', () => {
  const t = turnoBase()
  t.votos.o = { sirve: 'no', nota: 1 }
  const c = calcularTurno(t)
  assert.equal(c.votantes, 5)
})

test('calcularTurno: sin votos no revienta', () => {
  const c = calcularTurno({ reto: 'defiende', nivel: 'Debatida', oradorId: 'o', impresiones: {}, votos: {}, sentimientos: {} })
  assert.equal(c.votantes, 0)
  assert.equal(c.pctSi, null)
  assert.equal(c.notaPromedio, null)
  assert.equal(c.persuasionFija, false)
  assert.deepEqual(c.aciertos, [])
})

test('puntos del turno: público (hasta 7) y orador', () => {
  const c = calcularTurno(turnoBase())
  const p = c.puntosTurno
  // p1: impresión 1 + reacción 1 + voto 2 + predicción 3
  assert.deepEqual(p.p1, { participacion: 4, prediccion: 3, argumento: 0 })
  // p2: impresión 1 + voto 2, predicción falla
  assert.deepEqual(p.p2, { participacion: 3, prediccion: 0, argumento: 0 })
  // p5: solo voto
  assert.deepEqual(p.p5, { participacion: 2, prediccion: 0, argumento: 0 })
  // orador: impresión 1 + predicción 3; argumento 5 + round(3.8×2)=8 + 6 (67 % → 6 decenas)
  assert.deepEqual(p.o, { participacion: 1, prediccion: 3, argumento: 5 + 8 + 6 })
})

test('aplicarTurno suma, lleva la racha y la rompe', () => {
  const c = calcularTurno(turnoBase())
  let m = {}
  m = aplicarTurno(m, c, ['o', 'p1', 'p2', 'p3', 'p4', 'p5'])
  assert.equal(m.p1.total, 7)
  assert.equal(m.p1.aciertos, 1)
  assert.equal(m.p1.racha, 1)
  assert.equal(m.p5.racha, 0) // sin impresión no cuenta para racha
  assert.equal(m.o.racha, 0) // el orador ni suma ni rompe: queda como estaba
  m = aplicarTurno(m, c, ['o', 'p1'])
  m = aplicarTurno(m, c, ['o', 'p1'])
  assert.equal(m.p1.racha, 3)
  assert.equal(m.p1.rachas, PUNTOS.racha)
  assert.equal(m.p1.total, 7 * 3 + PUNTOS.racha)
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

test('premios: insignias y rankings de fichas', () => {
  const t = (oradorNombre, ficha, resultado) => ({ oradorNombre, ficha, resultado })
  const turnos = [
    t('Ana', 'F1', { base: 4, pctPersuadido: 75, persuadidos: 3, contracorriente: false, notaPromedio: 4.5, fuegos: 9, votantes: 10, pctSi: 80, pctConoce: 90, predijeron: 10, aciertos: 9 }),
    t('Luis', 'F2', { base: 5, pctPersuadido: 40, persuadidos: 2, contracorriente: true, notaPromedio: 4.2, fuegos: 3, votantes: 10, pctSi: 50, pctConoce: 20, predijeron: 10, aciertos: 1 }),
    t('Sara', 'F3', { base: 2, pctPersuadido: 50, persuadidos: 1, contracorriente: true, notaPromedio: 4.8, fuegos: 0, votantes: 10, pctSi: 70, pctConoce: 40, predijeron: 10, aciertos: 5 }),
    t('Saltado', 'F4', { saltado: true }),
  ]
  const marcador = { a: { aciertos: 2 }, b: { aciertos: 3 }, c: { aciertos: 3 } }
  const p = premios(turnos, marcador, { a: 'Ana', b: 'Luis', c: 'Sara' })
  assert.equal(p.insignias.persuasor.nombre, 'Ana')
  assert.equal(p.insignias.abogado.nombre, 'Sara')
  assert.equal(p.insignias.aplaudido.nombre, 'Ana')
  assert.equal(p.insignias.ojoClinico.nombre, 'Luis, Sara')
  assert.equal(p.fichas.conocida.ficha, 'F1')
  assert.equal(p.fichas.desconocida.ficha, 'F2')
  assert.equal(p.fichas.joya.ficha, 'F3')
  assert.equal(p.fichas.polemica.ficha, 'F2')
  assert.equal(p.fichas.engano.ficha, 'F2')
  assert.match(p.fichas.engano.detalle, /90%/)
  const vacio = premios([], {}, {})
  assert.equal(vacio.insignias.abogado, null)
  assert.equal(vacio.fichas.engano, null)
})
