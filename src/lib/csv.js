// Lee la tabla de fichas: columnas nombre, descripcion, categoria (en ese orden o con encabezado).
// Soporta comillas dobles, comas y saltos de línea dentro de comillas, y separador ; o ,.

function filas(texto) {
  const sep = (texto.split('\n')[0].match(/;/g) || []).length > (texto.split('\n')[0].match(/,/g) || []).length ? ';' : ','
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

const sinTilde = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** Devuelve [{ n, nombre, descripcion, categoria }], con n = número de fila desde 1. */
export function leerFichas(texto) {
  let lista = filas(texto.replace(/^\uFEFF/, ''))
  let iNombre = 0
  let iDesc = 1
  let iCat = 2
  const cab = lista[0]?.map(sinTilde) || []
  if (cab.includes('nombre')) {
    iNombre = cab.indexOf('nombre')
    iDesc = cab.findIndex((c) => c.startsWith('descrip') || c.startsWith('defini'))
    iCat = cab.indexOf('categoria')
    lista = lista.slice(1)
  }
  return lista
    .map((f) => ({
      nombre: (f[iNombre] || '').trim(),
      descripcion: (f[iDesc] || '').trim(),
      categoria: (f[iCat] || '').trim(),
    }))
    .filter((f) => f.nombre)
    .map((f, i) => ({ n: i + 1, ...f }))
}
