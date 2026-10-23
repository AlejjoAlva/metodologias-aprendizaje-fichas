// Plan B: respaldo local del marcador (localStorage de la pantalla grande).

const CLAVE = 'fichas_respaldo'

export function guardarRespaldo(estado, nombre) {
  if (!estado?.marcador) return
  const filas = Object.entries(estado.marcador)
    .filter(([id]) => nombre[id])
    .map(([id, m]) => ({ nombre: nombre[id], ...m }))
    .sort((a, b) => b.total - a.total)
  filas.forEach((f, i) => {
    f.posicion = i > 0 && f.total === filas[i - 1].total ? filas[i - 1].posicion : i + 1
  })
  try {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ t: Date.now(), generacion: estado.generacion, turno: estado.turno, filas, premios: estado.premios ?? null }),
    )
  } catch {
    /* sin almacenamiento: no hay respaldo local */
  }
}

export function leerRespaldo() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || 'null')
  } catch {
    return null
  }
}

