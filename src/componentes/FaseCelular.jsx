import { useEffect, useRef, useState } from 'react'
import { db } from '../lib/firebase'
import { useRestante } from '../lib/datos'
import { FASES } from '../lib/juego'
import { INTERVALO_SENTIMIENTO_MS, REACCIONES, REACCIONES_MAX, REACCION_ESPERA_MS } from '../lib/config'
import { elegirPostura, enviarSentimiento, responder, yaRespondi } from '../lib/acciones-celular'
import Crono from './Crono'

const POSTURA_TXT = { defiende: 'Defiende', ataca: 'Ataca', elige: 'Tú eliges' }

export default function FaseCelular({ uid, persona, estado }) {
  const soyOrador = estado.oradorId === persona.id
  const { fase } = estado

  if (fase === FASES.SALA || !estado.iniciada)
    return (
      <section className="tarjeta centro">
        <p className="grande">Ya estás dentro 🙌</p>
        <p className="ayuda">Mira la pantalla grande. Cuando el anfitrión inicie, te llegan tus 2 fichas.</p>
      </section>
    )

  if (fase === FASES.FINAL) return <Final persona={persona} estado={estado} />

  return (
    <>
      <FichaEnJuego estado={estado} soyOrador={soyOrador} />
      {soyOrador ? (
        <VistaOrador estado={estado} />
      ) : fase === FASES.IMPRESION ? (
        <Formulario key={`${estado.turno}-i`} uid={uid} persona={persona} estado={estado} tipo="impresion" />
      ) : fase === FASES.ARGUMENTO ? (
        <Sentimiento key={`${estado.turno}-a`} uid={uid} persona={persona} estado={estado} />
      ) : fase === FASES.VOTO ? (
        <Formulario key={`${estado.turno}-v`} uid={uid} persona={persona} estado={estado} tipo="voto" />
      ) : fase === FASES.RESULTADO ? (
        <MiResultado persona={persona} estado={estado} />
      ) : (
        <section className="tarjeta centro">
          <p className="grande">🎡 Girando la ruleta…</p>
          <p className="ayuda">Mira la pantalla grande.</p>
        </section>
      )}
    </>
  )
}

function FichaEnJuego({ estado, soyOrador }) {
  const ruletaPersona = estado.fase === FASES.RULETA_PERSONA
  if (!estado.oradorNombre || estado.fase === FASES.RESULTADO) return null
  return (
    <section className={`ficha-juego ${soyOrador ? 'soy-orador' : ''}`}>
      <p className="ficha-juego-quien">
        {soyOrador ? '¡Te tocó a ti!' : `Turno de ${estado.oradorNombre}`}
        {estado.postura && <span className={`postura ${estado.postura}`}>{POSTURA_TXT[estado.postura]}</span>}
      </p>
      {!ruletaPersona && estado.ficha && (
        <>
          <p className="ficha-juego-nombre">{estado.ficha.nombre}</p>
          <p className="ficha-juego-cat">{estado.ficha.categoria}</p>
          <p className="ficha-juego-desc">{estado.ficha.descripcion}</p>
        </>
      )}
    </section>
  )
}

function VistaOrador({ estado }) {
  const restante = useRestante(estado)
  const [eligiendo, setEligiendo] = useState(false)
  const [error, setError] = useState(null)
  const { fase } = estado

  if (fase === FASES.RULETA_POSTURA && estado.posturaSorteo === 'elige' && !estado.postura)
    return (
      <section className="tarjeta">
        <h2>Tú eliges tu postura</h2>
        <Crono restante={restante} total={estado.duracion} />
        <div className="opciones dos">
          {['defiende', 'ataca'].map((p) => (
            <button
              key={p}
              className={`boton opcion ${p}`}
              disabled={eligiendo || restante === 0}
              onClick={async () => {
                setEligiendo(true)
                try {
                  await elegirPostura(db, estado, p)
                } catch {
                  setError('No alcanzó a llegar. La ruleta decide.')
                }
              }}
            >
              {POSTURA_TXT[p]}
            </button>
          ))}
        </div>
        {eligiendo && !error && <p className="ayuda">Elección enviada ✓</p>}
        {error && <p className="aviso">{error}</p>}
      </section>
    )

  const texto = {
    [FASES.IMPRESION]: 'La sala está dando su primera impresión. Prepara tu argumento.',
    [FASES.ARGUMENTO]: '¡Tu turno de hablar! Convence a la sala.',
    [FASES.VOTO]: 'La sala está votando.',
    [FASES.RESULTADO]: null,
  }[fase] ?? 'Mira la pantalla grande.'

  if (fase === FASES.RESULTADO) return <MiResultado persona={{ id: estado.oradorId }} estado={estado} />
  return (
    <section className="tarjeta centro">
      {restante != null && <Crono restante={restante} total={estado.duracion} />}
      <p className="grande">{texto}</p>
      <p className="ayuda">En tu turno no votas: tus puntos salen de cómo argumentes.</p>
    </section>
  )
}

const OPCIONES = {
  impresion: [
    { campo: 'conoce', titulo: '¿La conoces?', ops: [[true, 'La conozco'], [false, 'No la conozco']] },
    { campo: 'util', titulo: '¿Suena útil?', ops: [['si', 'Sí'], ['no', 'No'], ['ni', 'Ni idea']] },
    {
      campo: 'prediccion',
      titulo: 'Al final, ¿la mayoría dirá que le sirve?',
      ops: [['si', 'Sí'], ['no', 'No']],
    },
  ],
  voto: [
    { campo: 'sirve', titulo: '¿Te sirve?', ops: [['si', 'Sí'], ['no', 'No']] },
    { campo: 'nota', titulo: 'Nota del argumento', ops: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']] },
  ],
}

function Formulario({ uid, persona, estado, tipo }) {
  const restante = useRestante(estado)
  const [valores, setValores] = useState({})
  const [envio, setEnvio] = useState('revisando') // revisando | libre | enviando | enviada | tarde | error
  const preguntas = OPCIONES[tipo]
  const completo = preguntas.every((p) => valores[p.campo] !== undefined)
  const corriendo = restante != null && restante > 0
  const cerrado = restante === 0

  // Tras una recarga: ¿ya había respondido esta fase?
  useEffect(() => {
    let vivo = true
    yaRespondi(db, estado, persona.id).then((v) => {
      if (!vivo) return
      if (v) {
        setValores(v)
        setEnvio('enviada')
      } else setEnvio('libre')
    })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enviar = async () => {
    setEnvio('enviando')
    try {
      await responder(db, uid, persona.id, estado, valores)
      setEnvio('enviada')
    } catch (err) {
      console.warn(err)
      setEnvio(cerrado || (restante != null && restante < 1.5) ? 'tarde' : 'error')
    }
  }

  const bloqueado = envio === 'enviada' || envio === 'enviando' || cerrado

  return (
    <section className="tarjeta">
      <div className="fila-titulo">
        <h2>{tipo === 'impresion' ? 'Primera impresión' : 'Voto final'}</h2>
        <Crono restante={restante} total={estado.duracion} />
      </div>
      {preguntas.map((p) => (
        <fieldset key={p.campo} className="pregunta" disabled={bloqueado}>
          <legend>{p.titulo}</legend>
          <div className={`opciones n${p.ops.length}`}>
            {p.ops.map(([v, txt]) => (
              <button
                key={String(v)}
                type="button"
                className={`boton opcion ${valores[p.campo] === v ? 'activa' : ''}`}
                onClick={() => setValores((x) => ({ ...x, [p.campo]: v }))}
              >
                {txt}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      {envio === 'enviada' ? (
        <p className="aviso ok">Respuesta enviada ✓</p>
      ) : envio === 'tarde' || (cerrado && envio !== 'enviada') ? (
        <p className="aviso">Se cerró el tiempo de esta fase.</p>
      ) : (
        <button className="boton principal" disabled={!completo || !corriendo || envio !== 'libre' && envio !== 'error'} onClick={enviar}>
          {envio === 'enviando'
            ? 'Enviando…'
            : !corriendo
              ? 'Espera a que arranque el tiempo'
              : completo
                ? 'Enviar'
                : 'Responde todo para enviar'}
        </button>
      )}
      {envio === 'error' && <p className="aviso error">No se pudo enviar. Intenta otra vez.</p>}
    </section>
  )
}

/** Barra + reacciones. Se acumula local y se manda como mucho cada 5 s, solo si cambió. */
function Sentimiento({ uid, persona, estado }) {
  const restante = useRestante(estado)
  const [barra, setBarra] = useState(0)
  const [conteo, setConteo] = useState({ fuego: 0, duda: 0, cerebro: 0 })
  const [espera, setEspera] = useState(false)
  const pendiente = useRef(false)
  const actual = useRef({ barra: 0, movio: false, reacciones: { fuego: 0, duda: 0, cerebro: 0 } })
  const estadoRef = useRef(estado)
  estadoRef.current = estado

  useEffect(() => {
    const mandar = () => {
      if (!pendiente.current) return
      pendiente.current = false
      enviarSentimiento(db, uid, persona.id, estadoRef.current, actual.current).catch(() => {
        pendiente.current = true
      })
    }
    const t = setInterval(mandar, INTERVALO_SENTIMIENTO_MS)
    return () => {
      clearInterval(t)
      mandar() // lo último que quedó sin mandar al cerrar la fase
    }
  }, [uid, persona.id])

  const total = conteo.fuego + conteo.duda + conteo.cerebro

  return (
    <section className="tarjeta">
      <div className="fila-titulo">
        <h2>¿Te convence?</h2>
        <Crono restante={restante} total={estado.duracion} />
      </div>
      <input
        type="range"
        min={-100}
        max={100}
        value={barra}
        className="barra-sentimiento"
        onChange={(e) => {
          const v = Number(e.target.value)
          setBarra(v)
          actual.current = { ...actual.current, barra: v / 100, movio: true }
          pendiente.current = true
        }}
      />
      <div className="barra-etiquetas">
        <span>No me convence</span>
        <span>Me convence</span>
      </div>
      <div className="opciones n3 reacciones">
        {REACCIONES.map((r) => (
          <button
            key={r.clave}
            className="boton reaccion"
            disabled={espera || total >= REACCIONES_MAX}
            onClick={() => {
              const n = { ...conteo, [r.clave]: conteo[r.clave] + 1 }
              setConteo(n)
              actual.current = { ...actual.current, reacciones: n }
              pendiente.current = true
              setEspera(true)
              setTimeout(() => setEspera(false), REACCION_ESPERA_MS)
            }}
          >
            <span className="reaccion-emoji">{r.emoji}</span>
            <span className="reaccion-txt">{r.texto}</span>
          </button>
        ))}
      </div>
      {total >= REACCIONES_MAX && <p className="ayuda">Llegaste al máximo de reacciones de este turno.</p>}
    </section>
  )
}

function MiResultado({ persona, estado }) {
  const r = estado.resultado
  if (!r) return null
  if (r.saltado)
    return (
      <section className="tarjeta centro">
        <p className="grande">Turno saltado</p>
        <p className="ayuda">Esa persona sigue pendiente. Ya viene el siguiente sorteo.</p>
      </section>
    )
  const mio = r.detalle?.find((d) => d.id === persona.id)
  const soyOrador = estado.oradorId === persona.id
  return (
    <section className="tarjeta">
      <h2>Resultado</h2>
      <div className="cifras">
        <div>
          <span className="cifra">{r.pctSi ?? '—'}%</span>
          <span className="cifra-txt">dice que le sirve</span>
        </div>
        <div>
          <span className="cifra">{r.notaPromedio ?? '—'}</span>
          <span className="cifra-txt">nota del argumento</span>
        </div>
        <div>
          <span className="cifra">{r.persuadidos}</span>
          <span className="cifra-txt">cambiaron de opinión</span>
        </div>
      </div>
      {soyOrador ? (
        <p className="aviso ok">Ganaste {r.puntosOrador} puntos por tu argumento.</p>
      ) : mio ? (
        <>
          <p className="aviso ok">+{mio.puntos} puntos en este turno</p>
          {mio.acierto && <p className="ayuda">🎯 Acertaste la predicción.</p>}
          {mio.persuadido && <p className="ayuda">🔄 Te convencieron: cambiaste de opinión.</p>}
        </>
      ) : (
        <p className="ayuda">No respondiste en este turno.</p>
      )}
    </section>
  )
}

function Final({ persona, estado }) {
  const top = estado.top || []
  const yo = top.find((t) => t.id === persona.id)
  return (
    <section className="tarjeta centro">
      <p className="grande">🏁 ¡Fin del juego!</p>
      {yo && (
        <p className="cifra">
          #{yo.posicion} · {yo.total} pts
        </p>
      )}
      <ol className="podio-mini">
        {top.slice(0, 3).map((t) => (
          <li key={t.id}>
            {t.posicion}. {t.nombre} — {t.total} pts
          </li>
        ))}
      </ol>
      <p className="ayuda">Mira en la pantalla grande las fichas que quedaron por explorar.</p>
    </section>
  )
}
