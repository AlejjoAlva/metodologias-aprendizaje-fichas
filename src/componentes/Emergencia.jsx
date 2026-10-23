// Plan B: si Firebase se cae (cuota agotada, sin internet), la pantalla muestra el marcador con lo
// último que tenía. Se guarda en este computador (localStorage) cada vez que cambian los puntos,
// así funciona aunque se recargue la página sin conexión: /respaldo.

import { leerRespaldo } from '../lib/respaldo'

/** Podio con lo último guardado. `motivo` explica por qué se muestra. */
export default function PodioEmergencia({ motivo, onCerrar }) {
  const r = leerRespaldo()
  const hora = r ? new Date(r.t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : null
  return (
    <div className="emergencia">
      <div className="emergencia-caja">
        <h2>🏁 Resultados hasta el momento</h2>
        <p className="ayuda">
          {motivo ?? 'Marcador guardado en este computador.'}{' '}
          {r ? `Último guardado: ${hora}, tras el turno ${r.turno}.` : 'Todavía no hay puntos guardados.'}
        </p>
        {r && (
          <ol className="emergencia-lista">
            {r.filas.slice(0, 30).map((f) => (
              <li key={f.nombre} className={f.posicion <= 3 ? `e-pos${f.posicion}` : ''}>
                <span className="e-pos">{f.posicion}</span>
                <span className="e-nombre">{f.nombre}</span>
                <span className="e-pts">{f.total} pts</span>
              </li>
            ))}
          </ol>
        )}
        {onCerrar && (
          <button className="ctl" onClick={onCerrar}>
            Volver al juego
          </button>
        )}
      </div>
    </div>
  )
}
