import { useState } from 'react'
import { db } from '../lib/firebase'
import { guardarAjustes } from '../lib/acciones-pantalla'
import { RETOS, ajustesDe } from '../lib/config'

const CAMPOS = [
  ['Ruleta de reto (pesos)', 'pesosReto', RETOS.map((r) => [r.valor, r.texto])],
  [
    'Puntos',
    'puntos',
    [
      ['prediccion', 'Predicción de evidencia acertada'],
      ['impresion', 'Primera impresión completa'],
      ['reaccion', 'Reaccionar en el argumento'],
      ['voto', 'Voto final completo'],
      ['racha', 'Racha'],
      ['rachaCada', 'Racha cada (turnos)'],
      ['oradorBase', 'Orador: base'],
      ['oradorPorNota', 'Orador: × nota promedio'],
      ['oradorPorDiezPct', 'Orador: por cada 10 % persuadido'],
      ['oradorPersuasionMax', 'Orador: máximo por persuasión'],
      ['umbralPersuadibles', 'Umbral de persuadibles (%)'],
      ['persuasionFija', 'Persuasión fija bajo el umbral'],
      ['contracorriente', 'Contracorriente'],
      ['contracorrienteNota', 'Contracorriente: nota mínima'],
      ['roboCada', 'Evento sorpresa cada (turnos, 0 = manual)'],
    ],
  ],
  [
    'Duraciones (segundos)',
    'duracion',
    [
      ['elige', 'Tú eliges'],
      ['impresion', 'Primera impresión'],
      ['argumento', 'Argumento'],
      ['voto', 'Voto final'],
      ['resultado', 'Resultado'],
    ],
  ],
]

/** Puntos, pesos y duraciones editables. Se guardan en el estado: una sola escritura. */
export default function CajonAjustes({ estado, hacer }) {
  const [valores, setValores] = useState(() => ajustesDe(estado))
  const [guardado, setGuardado] = useState(false)

  return (
    <>
      <h3>Puntos y umbrales</h3>
      <div className="cajon-ajustes">
        {CAMPOS.map(([titulo, grupo, campos]) => (
          <div key={grupo} style={{ display: 'contents' }}>
            <h4>{titulo}</h4>
            {campos.map(([k, txt]) => (
              <label key={k} style={{ display: 'contents' }}>
                <span>{txt}</span>
                <input
                  type="number"
                  min={0}
                  value={valores[grupo][k]}
                  onChange={(e) => {
                    setGuardado(false)
                    setValores((v) => ({ ...v, [grupo]: { ...v[grupo], [k]: Number(e.target.value) } }))
                  }}
                />
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="cajon-botones">
        <button
          className="ctl principal"
          onClick={hacer(async () => {
            await guardarAjustes(db, valores)
            setGuardado(true)
          })}
        >
          Guardar ajustes
        </button>
        <button className="ctl" onClick={() => setValores(ajustesDe({}))}>
          Valores por defecto
        </button>
        {guardado && <span className="ayuda">Guardado ✓ (aplica desde la próxima fase)</span>}
      </div>
    </>
  )
}
