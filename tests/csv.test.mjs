import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leerFichas } from '../src/lib/csv.js'

test('lee con encabezado, comillas y comas internas', () => {
  const f = leerFichas('nombre,descripción,categoría\nA,"uno, dos",Cat\n\nB,"dice ""hola""",Otra\n')
  assert.deepEqual(f, [
    { n: 1, nombre: 'A', descripcion: 'uno, dos', categoria: 'Cat' },
    { n: 2, nombre: 'B', descripcion: 'dice "hola"', categoria: 'Otra' },
  ])
})

test('sin encabezado, con punto y coma y columnas en otro orden por encabezado', () => {
  assert.equal(leerFichas('X;desc;cat\r\nY;d2;c2')[1].nombre, 'Y')
  const f = leerFichas('categoria,nombre,definicion\nC,N,D')
  assert.deepEqual(f[0], { n: 1, nombre: 'N', descripcion: 'D', categoria: 'C' })
})
