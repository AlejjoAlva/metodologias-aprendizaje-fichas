import { useEffect, useRef, useState } from 'react'
import { db } from '../lib/firebase'
import { useRestante } from '../lib/datos'
import { FASES, textoReto } from '../lib/juego'
import {
  INTERVALO_SENTIMIENTO_MS,
  NIVELES_EVIDENCIA,
  REACCIONES,
  REACCIONES_MAX,
  REACCION_ESPERA_MS,
} from '../lib/config'
import { elegirReto, enviarSentimiento, responder, yaRespondi } from '../lib/acciones-celular'
import Crono from './Crono'

const RETO_TXT = { aplicala: 'Aplícala', defiende: 'Defiende', ataca: 'Ataca', elige: 'Tú eliges' }

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
      {soyOrador && fase === FASES.IMPRESION ? (
        <>
          <Guion estado={estado} />
          <Formulario key={`${estado.turno}-i`} uid={uid} persona={persona} estado={estado} tipo="impresion" />
        </>
      ) : soyOrador ? (
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

function RetoEtiqueta({ estado }) {
  if (!estado.reto) return null
  const t = textoReto(estado.reto, estado.ficha?.categoria)
  return (
    <span className={`postura ${estado.reto}`}>
      {t.titulo}
      {t.lema ? ` · ${t.lema}` : ''}
    </span>
  )
}

function Guion({ estado }) {
  const t = textoReto(estado.reto, estado.ficha?.categoria)
  if (!t) return null
  return (
    <section className="tarjeta guion-cel">
      <h2>Tu guion: {t.titulo}</h2>
      {t.lema && <p className="ayuda">{t.lema}</p>}
      <ol>
        {t.pasos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <p className="ayuda">Mientras preparas, responde tu primera impresión: también sumas por ella.</p>
    </section>
  )
}

const FASES_CON_DESCRIPCION = [FASES.IMPRESION, FASES.ARGUMENTO, FASES.VOTO]

function FichaEnJuego({ estado, soyOrador }) {
  const ruletaPersona = estado.fase === FASES.RULETA_PERSONA
  if (!estado.oradorNombre || estado.fase === FASES.RESULTADO) return null
  const f = estado.ficha
  return (
    <section className={`ficha-juego ${soyOrador ? 'soy-orador' : ''}`}>
      <p className="ficha-juego-quien">
        {soyOrador ? '¡Te tocó a ti!' : `Turno de ${estado.oradorNombre}`}
        <RetoEtiqueta estado={estado} />
      </p>
      {!ruletaPersona && f && (
        <>
          <p className="ficha-juego-nombre">{f.nombre}</p>
          <p className="ficha-juego-cat">{f.categoria}</p>
          {FASES_CON_DESCRIPCION.includes(estado.fase) && (
            <>
              <p className="ficha-juego-desc">{f.que_es ?? f.descripcion}</p>
              {f.ejemplo && (
                <p className="ficha-juego-desc">
                  <strong>Ejemplo:</strong> {f.ejemplo}
                </p>
              )}
              {f.como_se_aplica && (
                <details className="plegable">
                  <summary>Cómo se aplica</summary>
                  <p className="ficha-juego-desc pre">{f.como_se_aplica}</p>
                </details>
              )}
            </>
          )}
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

  if (fase === FASES.RULETA_RETO && estado.retoSorteo === 'elige' && !estado.reto)
    return (
      <section className="tarjeta">
        <h2>Tú eliges tu reto</h2>
        <Crono restante={restante} total={estado.duracion} />
        <div className="opciones n3">
          {['aplicala', 'defiende', 'ataca'].map((p) => (
            <button
              key={p}
              className={`boton opcion ${p}`}
              disabled={eligiendo || restante === 0}
              onClick={async () => {
                setEligiendo(true)
                try {
                  await elegirReto(db, estado, p)
                } catch {
                  setError('No alcanzó a llegar. La ruleta decide.')
                }
              }}
            >
              {RETO_TXT[p]}
            </button>
          ))}
        </div>
        {eligiendo && !error && <p className="ayuda">Elección enviada ✓</p>}
        {error && <p className="aviso">{error}</p>}
      </section>
    )

  const texto = {
    [FASES.ARGUMENTO]: '¡Tu turno de hablar! Convence a la sala.',
    [FASES.VOTO]: 'La sala está votando.',
    [FASES.RESULTADO]: null,
  }[fase] ?? 'Mira la pantalla grande.'

  if (fase === FASES.RESULTADO) return <MiResultado persona={{ id: estado.oradorId }} estado={estado} />
  return (
    <section className="tarjeta centro">
      {restante != null && <Crono restante={restante} total={estado.duracion} />}
      <p className="grande">{texto}</p>
      <p className="ayuda">En tu turno no votas el final: tus puntos salen de cómo argumentes.</p>
    </section>
  )
}

const OPCIONES = {
  impresion: [
    { campo: 'conoce', titulo: '¿La conoces?', ops: [[true, 'La conozco'], [false, 'No la conozco']] },
    { campo: 'util', titulo: '¿Suena útil?', ops: [['si', 'Sí'], ['no', 'No'], ['ni', 'Ni idea']] },
    {
      campo: 'prediccion',
      titulo: '¿Qué nivel de evidencia tiene?',
      ops: NIVELES_EVIDENCIA.map((n) => [n.valor, n.valor, n.ayuda]),
    },
  ],
  voto: [
    { campo: 'sirve', titulo: '¿Te sirve?', ayuda: 'Usarla o tenerla en cuenta.', ops: [['si', 'Sí'], ['no', 'No']] },
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
          {p.ayuda && <p className="ayuda">{p.ayuda}</p>}
          <div className={`opciones n${p.ops.length} ${p.ops[0][2] ? 'con-ayuda' : ''}`}>
            {p.ops.map(([v, txt, ayuda]) => (
              <button
                key={String(v)}
                type="button"
                className={`boton opcion ${valores[p.campo] === v ? 'activa' : ''}`}
                onClick={() => setValores((x) => ({ ...x, [p.campo]: v }))}
              >
                {txt}
                {ayuda && <span className="opcion-ayuda">{ayuda}</span>}
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
  const acerte = soyOrador ? r.oradorAcerto : mio?.acierto
  const rev = r.revelacion || {}
  return (
    <>
      <section className="tarjeta revelacion-cel">
        <p className="ayuda">«{estado.ficha?.nombre}» tiene evidencia…</p>
        <p className={`rev-valor-cel nivel-${rev.nivel === 'Respaldada' ? 'si' : rev.nivel === 'Debatida' ? 'ni' : 'no'}`}>
          {rev.nivel ?? '—'}
        </p>
        <p className={`aviso ${acerte ? 'ok' : ''}`}>
          {acerte ? '🎯 ¡Acertaste la predicción!' : 'No acertaste esta vez.'} {r.aciertos} de {r.predijeron} acertaron.
        </p>
        {rev.texto && (
          <p>
            <strong>Evidencia:</strong> {rev.texto}
          </p>
        )}
        {rev.mito && (
          <p>
            <strong>Mito y límites:</strong> {rev.mito}
          </p>
        )}
        {rev.origen && (
          <p className="ayuda">
            <strong>Origen:</strong> {rev.origen}
          </p>
        )}
      </section>
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
          <p className="aviso ok">
            Ganaste {r.puntosOrador} puntos en tu turno{r.contracorriente ? ' (⚡ incluye contracorriente)' : ''}.
          </p>
        ) : mio ? (
          <>
            <p className="aviso ok">+{mio.puntos} puntos en este turno</p>
            {mio.persuadido && <p className="ayuda">🔄 Te convencieron: cambiaste de opinión.</p>}
          </>
        ) : (
          <p className="ayuda">No respondiste en este turno.</p>
        )}
      </section>
    </>
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
