import { traeEtiqueta } from '../lib/texto'

const ESTADO_TXT = { repartida: 'En tu mano', en_juego: 'En juego ahora', jugada: 'Ya se jugó' }

export default function MisFichas({ fichas, estado }) {
  if (!estado.iniciada) return null
  if (!fichas.length)
    return (
      <section className="mis-fichas">
        <h3>Tus fichas</h3>
        <p className="ayuda">Todavía no tienes fichas. Si acabas de llegar, en un momento te llegan dos.</p>
      </section>
    )
  return (
    <section className="mis-fichas">
      <h3>Tus fichas</h3>
      {fichas
        .sort((a, b) => a.n - b.n)
        .map((f) => (
          <details key={f.n} className={`mi-ficha ${f.estado}`} open={f.estado !== 'jugada'}>
            <summary>
              <span className="mi-ficha-nombre">{f.nombre}</span>
              <span className="etiqueta">{ESTADO_TXT[f.estado] ?? ''}</span>
            </summary>
            <p className="mi-ficha-cat">{f.categoria}</p>
            <p className="mi-ficha-desc">{f.que_es ?? f.descripcion}</p>
            {f.ejemplo && (
              <p className="mi-ficha-desc">
                {!traeEtiqueta(f.ejemplo, 'Ejemplo') && <strong>Ejemplo: </strong>}
                {f.ejemplo}
              </p>
            )}
            {f.como_se_aplica && (
              <details className="plegable">
                <summary>Cómo se aplica</summary>
                <p className="mi-ficha-desc pre">{f.como_se_aplica}</p>
              </details>
            )}
          </details>
        ))}
    </section>
  )
}
