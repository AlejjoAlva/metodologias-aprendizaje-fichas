import { useEffect, useState } from 'react'

/**
 * Ruleta tipo tómbola: resalta opciones cada vez más despacio hasta caer en `ganador`.
 * Si `ganador` llega tarde (recarga a mitad de fase), se muestra directo.
 */
export default function Ruleta({ titulo, opciones, ganador, duracionMs = 4200 }) {
  const lista = opciones.length ? opciones : [ganador]
  const destino = Math.max(0, lista.indexOf(ganador))
  const [i, setI] = useState(0)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    if (!ganador) return undefined
    setListo(false)
    // Vueltas completas + caer en el destino, con pasos cada vez más lentos.
    const pasos = lista.length * Math.max(2, Math.ceil(24 / lista.length)) + destino
    const tiempos = Array.from({ length: pasos }, (_, k) => {
      const x = (k + 1) / pasos
      return duracionMs * x * x * x
    })
    const timers = tiempos.map((t, k) => setTimeout(() => setI((k + 1) % lista.length), t))
    timers.push(setTimeout(() => setListo(true), duracionMs + 50))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganador, lista.length])

  const visibles = lista.length > 9 ? [-2, -1, 0, 1, 2].map((d) => lista[(i + d + lista.length) % lista.length]) : lista
  const actual = lista[i]

  return (
    <div className={`ruleta ${listo ? 'lista' : ''}`}>
      <p className="ruleta-titulo">{titulo}</p>
      <div className={`ruleta-cinta ${lista.length > 9 ? 'tambor' : 'rejilla'}`}>
        {visibles.map((op, k) => (
          <span key={`${op}-${k}`} className={`ruleta-op ${op === actual ? 'activa' : ''}`}>
            {op}
          </span>
        ))}
      </div>
      {listo && <p className="ruleta-ganador">{ganador}</p>}
    </div>
  )
}
