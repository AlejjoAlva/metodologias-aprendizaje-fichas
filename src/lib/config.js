// Valores por defecto del juego. Salen de la tabla "Puntos" del modelo conceptual.

export const PUNTOS = {
  impresion: 1, // primera impresión completa (conozco, suena útil y predicción)
  reaccion: 1, // reaccionar al menos una vez durante el argumento
  voto: 2, // voto final completo (me sirve y nota)
  prediccion: 2, // predicción acertada
  racha: 3, // cada 3 turnos seguidos con impresión y voto completos
  rachaCada: 3,
  oradorBase: 5,
  oradorPorNota: 2, // nota promedio × 2
  oradorPorDiezPct: 1, // 1 punto por cada 10 % de persuadidos
}

// Duraciones en segundos.
export const DURACION = {
  elige: 10,
  impresion: 20,
  argumento: 60,
  voto: 15,
}

// Probabilidades de la ruleta de postura.
export const POSTURAS = [
  { valor: 'defiende', peso: 0.4, texto: 'Defiende' },
  { valor: 'ataca', peso: 0.4, texto: 'Ataca' },
  { valor: 'elige', peso: 0.2, texto: 'Tú eliges' },
]

// El celular manda barra + reacciones como máximo una vez cada tantos milisegundos.
export const INTERVALO_SENTIMIENTO_MS = 5000
// Una reacción cada tantos milisegundos y un máximo por turno, por persona.
export const REACCION_ESPERA_MS = 2000
export const REACCIONES_MAX = 15

export const REACCIONES = [
  { clave: 'fuego', emoji: '🔥', texto: 'Buen punto' },
  { clave: 'duda', emoji: '🤔', texto: 'Lo dudo' },
  { clave: 'cerebro', emoji: '🧠', texto: 'No lo sabía' },
]
