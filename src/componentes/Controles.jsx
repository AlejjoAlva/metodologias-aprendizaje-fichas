import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth, db } from '../lib/firebase'
import {
  empezarDeCero,
  iniciarCrono,
  iniciarPartida,
  marcarAusente,
  renombrar,
  reemplazarFichas,
  saltarTurno,
  terminarPartida,
} from '../lib/acciones-pantalla'
import { leerFichas } from '../lib/csv'
import { FASES } from '../lib/juego'

const CON_CRONO = [FASES.IMPRESION, FASES.ARGUMENTO, FASES.VOTO]
const EN_TURNO = [FASES.RULETA_PERSONA, FASES.RULETA_FICHA, FASES.RULETA_POSTURA, ...CON_CRONO]

const TEXTO_SIGUIENTE = {
  [FASES.SALA]: 'Girar ruleta',
  [FASES.IMPRESION]: 'Cerrar y pasar al argumento',
  [FASES.ARGUMENTO]: 'Cortar y pasar al voto',
  [FASES.VOTO]: 'Cerrar votación',
  [FASES.RESULTADO]: 'Siguiente turno',
}

export default function Controles({
  estado,
  restante,
  personas,
  conectados,
  fichas,
  fichasBase,
  onSiguiente,
  onSaltar,
  fallo,
  setFallo,
}) {
  const [visible, setVisible] = useState(true)
  const [cajon, setCajon] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const { fase } = estado

  const hacer = (fn) => async () => {
    if (ocupado) return
    setOcupado(true)
    setFallo(null)
    try {
      await fn()
    } catch (e) {
      console.error(e)
      setFallo('No se pudo completar. Revisa la conexión e intenta otra vez.')
    } finally {
      setOcupado(false)
    }
  }

  if (!visible)
    return (
      <button className="ctl-mostrar" onClick={() => setVisible(true)} title="Mostrar controles">
        ⚙
      </button>
    )

  const puedeSiguiente =
    (fase === FASES.SALA && estado.iniciada) || fase === FASES.RESULTADO || CON_CRONO.includes(fase)

  return (
    <>
      <div className="ctl-barra">
        {fallo && <span className="ctl-fallo">{fallo}</span>}
        {fase === FASES.SALA && !estado.iniciada && (
          <button
            className="ctl principal"
            disabled={ocupado || conectados.size === 0}
            onClick={hacer(() => iniciarPartida(db, estado, { fichas, personas, conectados }))}
          >
            ▶ Iniciar partida ({conectados.size})
          </button>
        )}
        {CON_CRONO.includes(fase) && restante == null && (
          <button className="ctl principal" disabled={ocupado} onClick={hacer(() => iniciarCrono(db, estado))}>
            ▶ Iniciar tiempo
          </button>
        )}
        {CON_CRONO.includes(fase) && restante != null && (
          <button className="ctl" disabled={ocupado} onClick={hacer(() => iniciarCrono(db, estado))} title="Vuelve a empezar el cronómetro">
            ↺ Reiniciar tiempo
          </button>
        )}
        {puedeSiguiente && (
          <button className={`ctl ${fase === FASES.RESULTADO || fase === FASES.SALA ? 'principal' : ''}`} disabled={ocupado} onClick={hacer(onSiguiente)}>
            {TEXTO_SIGUIENTE[fase]} →
          </button>
        )}
        {EN_TURNO.includes(fase) && (
          <button
            className="ctl"
            disabled={ocupado}
            onClick={hacer(async () => {
              if (!confirm(`¿Saltar el turno de ${estado.oradorNombre}? Seguirá pendiente.`)) return
              onSaltar()
              await saltarTurno(db, estado)
            })}
          >
            ⏭ Saltar turno
          </button>
        )}
        <button className="ctl" onClick={() => setCajon((x) => !x)}>
          ☰
        </button>
        <button className="ctl" onClick={() => setVisible(false)} title="Ocultar controles">
          👁
        </button>
      </div>

      {cajon && (
        <aside className="cajon">
          <button className="cajon-cerrar" onClick={() => setCajon(false)}>
            ✕
          </button>

          <h3>Partida</h3>
          <div className="cajon-botones">
            {fase !== FASES.FINAL && estado.iniciada && (
              <button
                className="ctl"
                onClick={hacer(async () => {
                  if (confirm('¿Terminar la partida y mostrar el podio?')) await terminarPartida(db, estado, personas)
                })}
              >
                🏁 Terminar y mostrar podio
              </button>
            )}
            <button
              className="ctl peligro"
              onClick={hacer(async () => {
                const ok = prompt('Esto saca a todos y vuelve a repartir desde cero. Escribe EMPEZAR DE CERO para confirmar.')
                if (ok?.trim().toUpperCase() === 'EMPEZAR DE CERO') await empezarDeCero(db, estado, fichasBase)
              })}
            >
              Empezar de cero
            </button>
          </div>

          {!estado.iniciada && (
            <>
              <h3>Fichas</h3>
              <p className="ayuda">
                {fichas.length} cargadas. Puedes reemplazarlas con un CSV de tres columnas: nombre, descripción, categoría.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const archivo = e.target.files?.[0]
                  if (!archivo) return
                  archivo.text().then((t) => {
                    const nuevas = leerFichas(t)
                    if (!nuevas.length) return setFallo('El CSV no tiene fichas válidas.')
                    if (confirm(`¿Reemplazar las fichas por ${nuevas.length} del archivo?`))
                      hacer(() => reemplazarFichas(db, estado, nuevas, fichas))()
                  })
                }}
              />
            </>
          )}

          <h3>
            Personas ({conectados.size} conectadas / {personas.length})
          </h3>
          <ul className="cajon-personas">
            {[...personas]
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((p) => (
                <li key={p.id} className={p.ausente ? 'ausente' : ''}>
                  <span className={`punto ${conectados.has(p.id) ? 'on' : 'off'}`} />
                  <span className="cp-nombre">
                    {p.nombre}
                    {p.paso && ' ✓'}
                  </span>
                  <button
                    className="ctl mini"
                    onClick={hacer(async () => {
                      const n = prompt('Nuevo nombre', p.nombre)
                      if (n?.trim()) await renombrar(db, p, n)
                    })}
                  >
                    Renombrar
                  </button>
                  <button className="ctl mini" onClick={hacer(() => marcarAusente(db, p, !p.ausente))}>
                    {p.ausente ? 'Volver' : 'Ausente'}
                  </button>
                </li>
              ))}
          </ul>

          <h3>Sesión</h3>
          <button className="ctl" onClick={() => signOut(auth).then(() => location.reload())}>
            Cerrar sesión del anfitrión
          </button>
        </aside>
      )}
    </>
  )
}
