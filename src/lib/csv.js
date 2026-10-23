// Lee la tabla de fichas. Formato nuevo, por nombre de columna:
//   nombre, categoria, que_es, ejemplo, como_se_aplica, evidencia_nivel, evidencia_texto, mito_limites, origen
// Las columnas desconocidas se ignoran. También acepta el formato viejo (nombre, descripcion,
// categoria): la descripción pasa a que_es y el nivel queda "Debatida" provisional.
// Soporta comillas dobles, comas y saltos de línea dentro de comillas, y separador ; o ,.

export const NIVELES = ['Respaldada', 'Debatida', 'Poco respaldada']

function filas(texto) {
  const primera = texto.split('\n')[0]
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : ','
  const out = []
  let fila = []
  let campo = ''
  let comillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') comillas = false
      else campo += c
    } else if (c === '"') comillas = true
    else if (c === sep) {
      fila.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo)
      out.push(fila)
      fila = []
      campo = ''
    } else campo += c
  }
  if (campo || fila.length) {
    fila.push(campo)
    out.push(fila)
  }
  return out.filter((f) => f.some((x) => x.trim()))
}

const sinTilde = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const limpio = (s) => (s || '').replace(/\r\n/g, '\n').trim()

/**
 * Devuelve { fichas, resumen }.
 * fichas: [{ n, nombre, categoria, que_es, ejemplo, como_se_aplica, avisos, invalida,
 *            evidencia: { nivel, texto, mito, origen } }], con n = número de fila de datos.
 */
export function leerFichas(texto) {
  let lista = filas(texto.replace(/^\uFEFF/, ''))
  const cab = lista[0]?.map(sinTilde) || []
  const col = (...nombres) => cab.findIndex((c) => nombres.some((n) => c === n || c.startsWith(n)))
  let idx
  let viejo = false
  if (cab.includes('nombre')) {
    lista = lista.slice(1)
    viejo = !cab.includes('evidencia_nivel')
    idx = {
      nombre: cab.indexOf('nombre'),
      categoria: cab.indexOf('categoria'),
      que_es: viejo ? col('descrip', 'defini') : cab.indexOf('que_es'),
      ejemplo: cab.indexOf('ejemplo'),
      como_se_aplica: cab.indexOf('como_se_aplica'),
      nivel: cab.indexOf('evidencia_nivel'),
      texto: cab.indexOf('evidencia_texto'),
      mito: cab.indexOf('mito_limites'),
      origen: cab.indexOf('origen'),
      jugable: cab.indexOf('jugable'),
    }
  } else {
    // Sin encabezado: el formato viejo de tres columnas.
    viejo = true
    idx = { nombre: 0, que_es: 1, categoria: 2, ejemplo: -1, como_se_aplica: -1, nivel: -1, texto: -1, mito: -1, origen: -1, jugable: -1 }
  }
  const de = (f, k) => (idx[k] >= 0 ? limpio(f[idx[k]]) : '')

  const fichas = []
  lista.forEach((f, i) => {
    const nombre = de(f, 'nombre')
    if (!nombre) return
    const nivel = viejo ? 'Debatida' : de(f, 'nivel')
    const ficha = {
      n: i + 1,
      nombre,
      categoria: de(f, 'categoria'),
      que_es: de(f, 'que_es'),
      ejemplo: de(f, 'ejemplo'),
      como_se_aplica: de(f, 'como_se_aplica'),
      evidencia: { nivel, texto: de(f, 'texto'), mito: de(f, 'mito'), origen: de(f, 'origen') },
      avisos: [],
      invalida: !NIVELES.includes(nivel),
    }
    // Columna de control opcional: lo que no es "Sí" (No, Reservada, Dividir…) entra excluido;
    // una ficha inválida también. Desde el cajón se pueden volver a incluir.
    const jugable = sinTilde(de(f, 'jugable'))
    ficha.excluida = ficha.invalida || !['', 'si', 'yes'].includes(jugable)
    if (!['', 'si', 'yes'].includes(jugable)) ficha.avisos.push(`jugable: ${de(f, 'jugable')}`)
    if (!ficha.que_es) ficha.avisos.push('sin «qué es»')
    if (!ficha.ejemplo) ficha.avisos.push('sin ejemplo')
    if (viejo) ficha.avisos.push('formato viejo: nivel provisional')
    fichas.push(ficha)
  })
  return { fichas, resumen: resumir(fichas) }
}

export function resumir(fichas) {
  const contar = (clave) =>
    fichas.reduce((m, f) => {
      const k = clave(f) || '(vacío)'
      m[k] = (m[k] || 0) + 1
      return m
    }, {})
  return {
    total: fichas.length,
    porCategoria: contar((f) => f.categoria),
    porNivel: contar((f) => (f.invalida ? null : f.evidencia.nivel)),
    conAviso: fichas.filter((f) => f.avisos.length).map((f) => ({ n: f.n, nombre: f.nombre, avisos: f.avisos })),
    invalidas: fichas.filter((f) => f.invalida).map((f) => ({ n: f.n, nombre: f.nombre, nivel: f.evidencia.nivel })),
    excluidas: fichas.filter((f) => f.excluida).length,
    jugables: fichas.filter((f) => !f.excluida).length,
  }
}
