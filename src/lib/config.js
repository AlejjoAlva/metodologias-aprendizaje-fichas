// Valores por defecto del juego. El anfitrión puede cambiarlos desde el cajón: se guardan en
// `juego/estado.ajustes` y se combinan con estos con `ajustesDe(estado)`.

export const PUNTOS = {
  impresion: 1, // primera impresión completa (conozco, suena útil y predicción)
  reaccion: 1, // reaccionar al menos una vez durante el argumento (con 🔥, 🤔 o 🧠)
  voto: 2, // voto final completo (me sirve y nota)
  prediccion: 3, // predicción de evidencia acertada (se compara con la base, no con la sala)
  racha: 3, // cada 3 turnos seguidos con impresión y voto completos
  rachaCada: 3,
  oradorBase: 5,
  oradorPorNota: 2, // nota promedio × 2
  oradorPorDiezPct: 1, // 1 punto por cada 10 % de persuadidos…
  oradorPersuasionMax: 10, // …con este máximo
  persuasionFija: 5, // si los persuadibles son menos del umbral, esto en vez de lo anterior
  umbralPersuadibles: 30, // % de votantes del turno
  contracorriente: 3,
  contracorrienteNota: 4, // nota promedio mínima para contracorriente
}

// Duraciones en segundos.
export const DURACION = {
  elige: 10,
  impresion: 25,
  argumento: 60,
  voto: 15,
  resultado: 30,
}

// Ruleta 3: el reto. `postura` es la que se usa para medir la persuasión.
export const RETOS = [
  {
    valor: 'aplicala',
    peso: 35,
    texto: 'Aplícala',
    postura: 'si',
    pasos: [
      'Para quién o en qué situación sirve o aparece.',
      'Un ejemplo concreto.',
      'Un límite o error común.',
    ],
  },
  {
    valor: 'defiende',
    peso: 25,
    texto: 'Defiende',
    postura: 'si',
    pasos: ['En qué situación funciona mejor.', 'Un ejemplo real.', 'Una condición en la que dejaría de funcionar.'],
  },
  {
    valor: 'ataca',
    peso: 25,
    texto: 'Ataca',
    postura: 'no',
    pasos: ['Qué problema o costo tiene.', 'Un ejemplo real.', 'Una situación en la que sí funciona.'],
  },
  { valor: 'elige', peso: 15, texto: 'Tú eliges', pasos: ['Elige en tu celular: Aplícala, Defiende o Ataca.'] },
]

// En estas categorías, Defiende y Ataca se explican de otra forma.
export const CATEGORIAS_EFECTO = ['Efectos de la memoria y sesgos cognitivos', 'Mitos y conceptos a desmentir']
export const LEMA_EFECTO = { defiende: 'es real y importa', ataca: 'está sobrevalorado o no se sostiene' }

export const NIVELES_EVIDENCIA = [
  { valor: 'Respaldada', ayuda: 'La investigación la apoya.' },
  { valor: 'Debatida', ayuda: 'Resultados mixtos o efectos pequeños.' },
  { valor: 'Poco respaldada', ayuda: 'Poca o ninguna evidencia, o es un mito popular.' },
]

export const AJUSTES = {
  puntos: PUNTOS,
  duracion: DURACION,
  pesosReto: Object.fromEntries(RETOS.map((r) => [r.valor, r.peso])),
}

/** Ajustes vigentes: los del estado encima de los de por defecto. */
export function ajustesDe(estado) {
  const a = estado?.ajustes || {}
  return {
    puntos: { ...PUNTOS, ...a.puntos },
    duracion: { ...DURACION, ...a.duracion },
    pesosReto: { ...AJUSTES.pesosReto, ...a.pesosReto },
  }
}

// El celular manda sus reacciones como máximo una vez cada tantos milisegundos (y al cerrar la
// fase). En 60 s de argumento son, a lo sumo, 8 escrituras por celular y turno.
export const INTERVALO_SENTIMIENTO_MS = 8000
// Una reacción cada tantos milisegundos y un máximo por turno, por persona.
export const REACCION_ESPERA_MS = 2500
export const REACCIONES_MAX = 12

export const REACCIONES = [
  { clave: 'fuego', emoji: '🔥', texto: 'Buen punto' },
  { clave: 'duda', emoji: '🤔', texto: 'Lo dudo' },
  { clave: 'cerebro', emoji: '🧠', texto: 'No lo sabía' },
]
