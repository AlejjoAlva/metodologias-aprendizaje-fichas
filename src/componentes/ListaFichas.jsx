import { useEffect, useRef } from 'react'

const ESTADO_TXT = { libre: 'Sin repartir', repartida: 'Repartida', en_juego: 'En juego', jugada: 'Jugada' }

export default function ListaFichas({ fichas, estado, nombre }) {
  const enJuego = useRef(null)
  useEffect(() => {
    enJuego.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [estado.fichaId])

  const cuenta = fichas.reduce((m, f) => ({ ...m, [f.estado]: (m[f.estado] || 0) + 1 }), {})

  return (
    <aside className="pt-fichas">
      <h3>
        Fichas <span className="num">{fichas.length}</span>
      </h3>
      <p className="pt-fichas-cuenta">
        {cuenta.jugada || 0} jugadas · {(cuenta.repartida || 0) + (cuenta.en_juego || 0)} en manos ·{' '}
        {cuenta.libre || 0} sin repartir
      </p>
      <ul className="lista-fichas">
        {fichas.map((f) => (
          <li
            key={f.n}
            ref={f.estado === 'en_juego' ? enJuego : null}
            className={`lf ${f.estado}`}
            title={f.descripcion}
          >
            <span className="lf-nombre">{f.nombre}</span>
            <span className="lf-cat">{f.categoria}</span>
            <span className="lf-estado">
              {f.estado === 'jugada' || f.estado === 'en_juego'
                ? nombre[f.dueno] ?? ESTADO_TXT[f.estado]
                : ESTADO_TXT[f.estado]}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
