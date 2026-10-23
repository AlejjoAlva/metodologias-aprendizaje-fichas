import { useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'

const hora = (t) => t?.toDate().toLocaleTimeString('es-CO', { hour12: false }) ?? '…'
const GRAVE = /error|rechaz|nueva_partida|empezar_de_cero|sin_internet|ya_hecho/

/** Últimos eventos de la bitácora. Se leen solo al pulsar (40 lecturas). */
export default function CajonBitacora({ hacer }) {
  const [filas, setFilas] = useState(null)
  const cargar = hacer(async () => {
    const s = await getDocs(query(collection(db, 'bitacora'), orderBy('t', 'desc'), limit(40)))
    setFilas(s.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
  return (
    <>
      <h3>Bitácora</h3>
      <button className="ctl mini" onClick={cargar}>
        {filas ? 'Actualizar' : 'Ver los últimos 40 eventos'}
      </button>
      {filas && (
        <ul className="bitacora">
          {filas.map((f) => (
            <li key={f.id} className={GRAVE.test(f.tipo) ? 'grave' : ''}>
              <span className="bt-hora">{hora(f.t)}</span>
              <span className="bt-tipo">
                {f.quien} · {f.tipo}
                {f.nombre ? ` · ${f.nombre}` : ''}
              </span>
              {f.detalle && <span className="bt-detalle">{f.detalle}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
