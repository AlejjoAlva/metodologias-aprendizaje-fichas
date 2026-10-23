/** Cronómetro circular. `restante` en segundos (null = aún no arranca). */
export default function Crono({ restante, total, grande = false }) {
  if (restante == null) return <span className={`crono espera ${grande ? 'grande' : ''}`}>⏸</span>
  const frac = total ? restante / total : 0
  const urgente = restante <= 5
  return (
    <span
      className={`crono ${urgente ? 'urgente' : ''} ${grande ? 'grande' : ''}`}
      style={{ '--frac': frac }}
      role="timer"
      aria-label={`${Math.ceil(restante)} segundos`}
    >
      {Math.ceil(restante)}
    </span>
  )
}
