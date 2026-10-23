import { useState } from 'react'
import { db } from '../lib/firebase'
import { excluirFicha, leerNiveles, reemplazarFichas } from '../lib/acciones-pantalla'
import { NIVELES, leerFichas } from '../lib/csv'

const ESTADO_TXT = {
  libre: 'Sin repartir',
  repartida: 'Repartida',
  en_juego: 'En juego',
  jugada: 'Jugada',
  excluida: 'Excluida',
}

const lista = (obj) =>
  Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}: ${n}`)
    .join(' · ')

/** Fichas en el cajón del anfitrión: importar el CSV, ver niveles (solo aquí), filtrar y excluir. */
export default function CajonFichas({ estado, fichas, hacer, setFallo }) {
  const [importe, setImporte] = useState(null)
  const [niveles, setNiveles] = useState(null)
  const [cat, setCat] = useState('')
  const [nivel, setNivel] = useState('')

  const categorias = [...new Set(fichas.map((f) => f.categoria))].sort()
  const filtradas = fichas.filter(
    (f) => (!cat || f.categoria === cat) && (!nivel || (niveles && niveles[f.n] === nivel)),
  )
  const invalidas = fichas.filter((f) => f.invalida && f.estado === 'libre').length

  return (
    <>
      <h3>Fichas ({fichas.length})</h3>
      {invalidas > 0 && (
        <p className="aviso error">
          {invalidas} ficha(s) sin nivel de evidencia válido. Exclúyelas o importa el CSV corregido antes de iniciar.
        </p>
      )}

      {!estado.iniciada && (
        <div className="cajon-import">
          <p className="ayuda">
            Importar CSV (reemplaza la tabla completa). Columnas: nombre, categoria, que_es, ejemplo, como_se_aplica,
            evidencia_nivel, evidencia_texto, mito_limites, origen.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              if (!archivo) return
              archivo.text().then((t) => {
                const r = leerFichas(t)
                if (!r.fichas.length) return setFallo('El CSV no tiene fichas.')
                setImporte(r)
              })
            }}
          />
          {importe && (
            <div className="resumen-import">
              <p>
                <strong>{importe.resumen.total}</strong> fichas en el archivo
              </p>
              <p className="ayuda">Por categoría: {lista(importe.resumen.porCategoria)}</p>
              <p className="ayuda">Por nivel: {lista(importe.resumen.porNivel)}</p>
              {importe.resumen.conAviso.length > 0 && (
                <details>
                  <summary>{importe.resumen.conAviso.length} con aviso</summary>
                  <ul>
                    {importe.resumen.conAviso.map((f) => (
                      <li key={f.n}>
                        #{f.n} {f.nombre}: {f.avisos.join(', ')}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {importe.resumen.invalidas.length > 0 && (
                <div className="aviso error">
                  {importe.resumen.invalidas.length} inválidas (nivel distinto de {NIVELES.join(' / ')}):
                  <ul>
                    {importe.resumen.invalidas.map((f) => (
                      <li key={f.n}>
                        #{f.n} {f.nombre} → «{f.nivel || 'vacío'}»
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="cajon-botones">
                <button
                  className="ctl principal"
                  onClick={hacer(async () => {
                    await reemplazarFichas(db, estado, importe.fichas, fichas)
                    setImporte(null)
                    setNiveles(null)
                  })}
                >
                  Reemplazar la tabla ({importe.fichas.length})
                </button>
                <button className="ctl" onClick={() => setImporte(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="cajon-filtros">
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {niveles ? (
          <select value={nivel} onChange={(e) => setNivel(e.target.value)}>
            <option value="">Todos los niveles</option>
            {NIVELES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        ) : (
          <button className="ctl mini" onClick={hacer(async () => setNiveles(await leerNiveles(db)))}>
            Ver niveles de evidencia (solo aquí)
          </button>
        )}
      </div>
      <ul className="cajon-fichas">
        {filtradas.map((f) => (
          <li key={f.n} className={f.estado}>
            <span className="cf-nombre">
              #{f.n} {f.nombre}
              {f.invalida && <span className="etiqueta mala">sin nivel válido</span>}
              {f.aviso && <span className="etiqueta" title={f.aviso}>aviso</span>}
            </span>
            <span className="cf-cat">{f.categoria}</span>
            {niveles && <span className="cf-nivel">{niveles[f.n] ?? '—'}</span>}
            <span className="cf-estado">{ESTADO_TXT[f.estado] ?? f.estado}</span>
            {(f.estado === 'libre' || f.estado === 'excluida') && (
              <button className="ctl mini" onClick={hacer(() => excluirFicha(db, f, f.estado === 'libre'))}>
                {f.estado === 'libre' ? 'Excluir' : 'Incluir'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
