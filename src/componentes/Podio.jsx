const INSIGNIAS = [
  ['persuasor', '🗣️ El Persuasor'],
  ['abogado', '😈 Abogado del Diablo'],
  ['aplaudido', '🔥 El Más Aplaudido'],
  ['ojoClinico', '🔬 Ojo Clínico'],
]
const RANKINGS = [
  ['conocida', 'La más conocida'],
  ['desconocida', 'La más desconocida'],
  ['joya', 'La joya oculta'],
  ['polemica', 'La más polémica'],
  ['engano', 'La que más engañó'],
]

export default function Podio({ estado, fichas }) {
  const top = estado.top || []
  const [a, b, c] = [top[0], top[1], top[2]]
  const porExplorar = fichas.filter((f) => f.estado !== 'jugada')
  const m = estado.marcador || {}
  const p = estado.premios
  return (
    <div className="podio">
      <h2>🏁 Podio final</h2>
      <div className="escalones">
        {[b, a, c].map((t, i) =>
          t ? (
            <div key={t.id} className={`escalon e${[2, 1, 3][i]}`}>
              <span className="escalon-nombre">{t.nombre}</span>
              <span className="escalon-pts">{t.total} pts</span>
              <span className="escalon-desglose">
                {m[t.id]?.participacion ?? 0} participación · {m[t.id]?.prediccion ?? 0} predicción de evidencia ·{' '}
                {m[t.id]?.argumento ?? 0} argumento · {m[t.id]?.rachas ?? 0} rachas
                {m[t.id]?.robos ? ` · +${m[t.id].robos} robados` : ''}
                {m[t.id]?.robado ? ` · −${m[t.id].robado} le robaron` : ''}
              </span>
              <span className="escalon-base">{t.posicion}</span>
            </div>
          ) : (
            <div key={i} className="escalon vacio" />
          ),
        )}
      </div>
      <div className="podio-resto">
        <div>
          <h3>Insignias</h3>
          <ul className="premios">
            {INSIGNIAS.map(([k, titulo]) => (
              <li key={k}>
                <span className="premio-titulo">{titulo}</span>
                <span>
                  <span className="premio-quien">{p?.insignias?.[k]?.nombre ?? '—'}</span>
                  {p?.insignias?.[k]?.detalle && <span className="premio-detalle"> · {p.insignias[k].detalle}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Fichas</h3>
          <ul className="premios">
            {RANKINGS.map(([k, titulo]) => (
              <li key={k}>
                <span className="premio-titulo">{titulo}</span>
                <span>
                  <span className="premio-quien">{p?.fichas?.[k]?.ficha ?? '—'}</span>
                  {p?.fichas?.[k]?.detalle && <span className="premio-detalle"> · {p.fichas[k].detalle}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <ol start={4}>
            {top.slice(3, 12).map((t) => (
              <li key={t.id}>
                {t.posicion}. {t.nombre} · {t.total}
              </li>
            ))}
          </ol>
          <div className="por-explorar">
            <h3>Quedaron por explorar ({porExplorar.length})</h3>
            <p>{porExplorar.map((f) => f.nombre).join(' · ')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
