import { useEffect, useRef, useState } from 'react'
import { REACCIONES } from '../lib/config'

const EMOJI = Object.fromEntries(REACCIONES.map((r) => [r.clave, r.emoji]))
const MAX = 14

/**
 * Actividad en vivo: quién respondió, quién votó, quién reaccionó. Se arma con los datos que la
 * pantalla ya escucha (respuestas y reacciones), así que no hace lecturas extra a Firebase.
 */
export default function Actividad({ respuestas, sentimientos, nombre, estado }) {
  const [lineas, setLineas] = useState([])
  const vistos = useRef(new Set())
  const conteos = useRef({})
  const turno = `${estado.generacion}_${estado.turno}`

  const agregar = (nuevas) => {
    if (nuevas.length) setLineas((l) => [...nuevas.reverse(), ...l].slice(0, MAX))
  }

  useEffect(() => {
    const nuevas = []
    for (const r of respuestas) {
      const k = r.id
      if (vistos.current.has(k) || !nombre[r.personaId]) continue
      vistos.current.add(k)
      nuevas.push({ k, txt: `${nombre[r.personaId]} ${r.fase === 'voto' ? 'votó 🗳️' : 'dio su primera impresión 👀'}` })
    }
    agregar(nuevas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respuestas.length])

  useEffect(() => {
    const nuevas = []
    for (const s of sentimientos) {
      if (!nombre[s.personaId] || s.turno !== estado.turno || s.generacion !== estado.generacion) continue
      const antes = conteos.current[`${turno}_${s.id}`] || {}
      for (const r of REACCIONES) {
        const d = (s.reacciones?.[r.clave] || 0) - (antes[r.clave] || 0)
        if (d > 0) nuevas.push({ k: `${turno}_${s.id}_${r.clave}_${s.reacciones[r.clave]}`, txt: `${nombre[s.personaId]} ${EMOJI[r.clave].repeat(Math.min(d, 3))}` })
      }
      conteos.current[`${turno}_${s.id}`] = { ...s.reacciones }
    }
    agregar(nuevas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentimientos])

  // Los momentos del juego (ruletas, cierres, eventos sorpresa) también entran al registro.
  const ultimo = estado.eventos?.[estado.eventos.length - 1]
  useEffect(() => {
    if (ultimo && !vistos.current.has(`e${ultimo.t}`)) {
      vistos.current.add(`e${ultimo.t}`)
      agregar([{ k: `e${ultimo.t}`, txt: ultimo.texto, juego: true }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimo?.t])

  return (
    <ul className="actividad">
      {lineas.length === 0 && <li className="ayuda">Aquí aparece lo que va pasando.</li>}
      {lineas.map((l) => (
        <li key={l.k} className={l.juego ? 'juego' : ''}>
          {l.txt}
        </li>
      ))}
    </ul>
  )
}
