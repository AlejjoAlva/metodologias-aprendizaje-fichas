import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { leerFichas } from '../src/lib/csv.js'

const ejemplo = readFileSync(new URL('./fichas-ejemplo.csv', import.meta.url), 'utf8')

test('CSV de ejemplo: campos multilínea, comillas dobles y columnas desconocidas', () => {
  const { fichas, resumen } = leerFichas(ejemplo)
  assert.equal(fichas.length, 6)
  assert.deepEqual(fichas.map((f) => f.n), [1, 2, 3, 4, 5, 6])
  const [a, b] = fichas
  assert.equal(a.como_se_aplica.split('\n').length, 3)
  assert.equal(a.evidencia.nivel, 'Respaldada')
  assert.equal(a.evidencia.origen, 'Hermann Ebbinghaus, 1885.')
  assert.match(b.evidencia.mito, /"ilusión de dominio"/)
  // Las columnas incluir/revisar no se cuelan en la ficha.
  assert.equal('incluir' in a || 'revisar' in a, false)
  assert.deepEqual(Object.keys(a).sort(), ['avisos', 'categoria', 'como_se_aplica', 'ejemplo', 'evidencia', 'invalida', 'n', 'nombre', 'que_es'])
  assert.equal(resumen.total, 6)
  assert.equal(resumen.porCategoria['Técnicas de estudio'], 2)
  assert.deepEqual(resumen.porNivel, { Respaldada: 2, 'Poco respaldada': 2, Debatida: 1, '(vacío)': 1 })
})

test('ejemplo vacío = aviso; nivel fuera de la lista = inválida', () => {
  const { fichas, resumen } = leerFichas(ejemplo)
  assert.deepEqual(fichas[2].avisos, ['sin ejemplo'])
  assert.equal(fichas[2].invalida, false)
  assert.equal(fichas[5].invalida, true)
  assert.deepEqual(resumen.invalidas.map((f) => f.nivel), ['Rarísima'])
  assert.equal(resumen.conAviso.length, 2)
})

test('el nivel debe ser exacto: minúsculas o vacío no valen', () => {
  const cab = 'nombre,categoria,que_es,ejemplo,evidencia_nivel\n'
  const { fichas } = leerFichas(cab + 'A,C,q,e,respaldada\nB,C,q,e,\nC,C,q,e,Poco respaldada\n')
  assert.deepEqual(fichas.map((f) => f.invalida), [true, true, false])
})

test('columnas en cualquier orden, separador ; y BOM', () => {
  const t = '﻿origen;evidencia_nivel;nombre;categoria;que_es;ejemplo\r\nO;Debatida;N;Cat;Q;E\r\n'
  const [f] = leerFichas(t).fichas
  assert.equal(f.nombre, 'N')
  assert.equal(f.evidencia.origen, 'O')
  assert.equal(f.evidencia.nivel, 'Debatida')
})

test('formato viejo (nombre, descripción, categoría): migra a que_es con nivel Debatida', () => {
  const { fichas } = leerFichas('nombre,descripción,categoría\nA,"uno, dos",Cat\n')
  assert.equal(fichas[0].que_es, 'uno, dos')
  assert.equal(fichas[0].evidencia.nivel, 'Debatida')
  assert.equal(fichas[0].invalida, false)
  assert.equal(leerFichas('X;desc;cat\r\nY;d2;c2').fichas[1].nombre, 'Y')
})
