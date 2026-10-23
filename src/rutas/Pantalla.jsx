import { useEffect, useMemo, useRef, useState } from 'react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { QRCodeSVG } from 'qrcode.react'
import { auth, db, usuarioActual } from '../lib/firebase'
import {
  useEstado,
  useFichas,
  usePersonas,
  usePresencia,
  useReclamos,
  useRespuestasFase,
  useRestante,
  useSentimientos,
} from '../lib/datos'
import {
  asignarFichas,
  cerrarTurno,
  girarFicha,
  girarPersona,
  girarPostura,
  migrarFichasViejas,
  pasarA,
  prepararSala,
  resolverEleccion,
  resolverReclamo,
  terminarPartida,
} from '../lib/acciones-pantalla'
import { FASES } from '../lib/juego'
import { leerFichas } from '../lib/csv'
import fichasCsv from '../datos/fichas.csv?raw'
import CentroPantalla from '../componentes/CentroPantalla'
import ListaFichas from '../componentes/ListaFichas'
import Controles from '../componentes/Controles'

// Cuánto dura la animación de cada ruleta antes de pasar sola a la siguiente.
const PAUSA_RULETA_MS = { [FASES.RULETA_PERSONA]: 6000, [FASES.RULETA_FICHA]: 5000, [FASES.RULETA_POSTURA]: 4500 }
// Margen tras llegar a cero antes de leer los votos (las reglas aceptan hasta 1 s de gracia).
const MARGEN_CIERRE_MS = 1500

export default function Pantalla() {
  const [usuario, setUsuario] = useState(undefined)
  useEffect(() => {
    usuarioActual().then((u) => setUsuario(u && !u.isAnonymous ? u : null))
  }, [])
  if (usuario === undefined) return <main className="pantalla-login"><p>Cargando…</p></main>
  if (!usuario) return <Login onListo={setUsuario} />
  return <Tablero />
}

function Login({ onListo }) {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState(null)
  return (
    <main className="pantalla-login">
      <form
        className="tarjeta"
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          try {
            if (auth.currentUser?.isAnonymous) await signOut(auth)
            const c = await signInWithEmailAndPassword(auth, correo.trim(), clave)
            onListo(c.user)
          } catch {
            setError('Correo o contraseña incorrectos.')
          }
        }}
      >
        <h2>Pantalla del anfitrión</h2>
        <input className="campo" type="email" placeholder="Correo" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        <input className="campo" type="password" placeholder="Contraseña" value={clave} onChange={(e) => setClave(e.target.value)} />
        {error && <p className="aviso error">{error}</p>}
        <button className="boton principal">Entrar</button>
      </form>
    </main>
  )
}

function Tablero() {
  const { estado, error } = useEstado()
  const fichasBase = useMemo(() => leerFichas(fichasCsv).fichas, [])
  const fichas = useFichas(true)
    .filter((f) => f.estado !== 'retirada')
    .sort((a, b) => a.n - b.n)
  const fichasVisibles = fichas.filter((f) => f.estado !== 'excluida')
  const personas = usePersonas(estado?.generacion)
  const presencia = usePresencia(true)
  const reclamos = useReclamos(true)
  const fase = estado?.fase
  const conRespuesta = fase === FASES.IMPRESION || fase === FASES.VOTO
  const respuestas = useRespuestasFase(estado, !!estado && conRespuesta)
  const sentimientos = useSentimientos(estado, fase === FASES.ARGUMENTO)
  const restante = useRestante(estado)
  const [fallo, setFallo] = useState(null)
  const hecho = useRef(new Set())
  const saltados = useRef([])

  // Persona conectada = alguno de sus uids tiene marca de presencia.
  const conectados = useMemo(
    () => new Set(personas.filter((p) => p.uids?.some((u) => presencia.has(u))).map((p) => p.id)),
    [personas, presencia],
  )

  const ctx = { personas, conectados, fichas }
  const unaVez = (clave, fn) => {
    if (hecho.current.has(clave)) return
    hecho.current.add(clave)
    fn().catch((e) => {
      console.error(clave, e)
      hecho.current.delete(clave)
      setFallo(`No se pudo completar (${clave.split(':')[0]}). Revisa la conexión.`)
    })
  }

  useEffect(() => {
    if (estado === null) prepararSala(db, fichasBase).catch((e) => setFallo(String(e.message || e)))
  }, [estado, fichasBase])

  // Fichas del formato viejo (sin que_es): se convierten una sola vez.
  useEffect(() => {
    if (fichas.some((f) => f.que_es === undefined)) unaVez('migrar', () => migrarFichasViejas(db, fichas))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichas.length])

  // Ruletas: cada una gira, se ve unos segundos y pasa sola a la siguiente.
  useEffect(() => {
    if (!estado) return undefined
    const k = `${estado.generacion}_${estado.turno}`
    let accion = null
    if (fase === FASES.RULETA_PERSONA && estado.oradorId)
      accion = [`ficha:${k}`, () => girarFicha(db, estado, fichas)]
    else if (fase === FASES.RULETA_FICHA) accion = [`postura:${k}`, () => girarPostura(db, estado)]
    else if (fase === FASES.RULETA_POSTURA && estado.postura)
      accion = [`impresion:${k}`, () => pasarA(db, estado, FASES.IMPRESION)]
    if (!accion) return undefined
    const t = setTimeout(() => unaVez(...accion), PAUSA_RULETA_MS[fase])
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, estado?.turno, estado?.postura, estado?.oradorId, fichas.length])

  // Cronómetros: al llegar a cero la fase se cierra sola.
  useEffect(() => {
    if (!estado || restante !== 0) return undefined
    const k = `${estado.generacion}_${estado.turno}`
    let accion = null
    if (fase === FASES.RULETA_POSTURA && !estado.postura) accion = [`elige:${k}`, () => resolverEleccion(db, estado)]
    else if (fase === FASES.IMPRESION) accion = [`argumento:${k}`, () => pasarA(db, estado, FASES.ARGUMENTO)]
    else if (fase === FASES.ARGUMENTO) accion = [`voto:${k}`, () => pasarA(db, estado, FASES.VOTO)]
    else if (fase === FASES.VOTO) accion = [`cierre:${k}`, () => cerrarTurno(db, estado, ctx)]
    if (!accion) return undefined
    const t = setTimeout(() => unaVez(...accion), fase === FASES.VOTO || !estado.postura ? MARGEN_CIERRE_MS : 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante === 0, fase, estado?.turno])

  // Quien llega con la partida empezada recibe 2 fichas sin repartir.
  useEffect(() => {
    if (!estado?.iniciada || !fichas.length) return
    const conFichas = new Set(fichas.filter((f) => f.dueno).map((f) => f.dueno))
    for (const p of personas)
      if (!conFichas.has(p.id) && !p.ausente)
        unaVez(`tarde:${estado.generacion}_${p.id}`, () => asignarFichas(db, estado, p, fichas))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personas.length, estado?.iniciada, fichas.length])

  // Recuperaciones desde otro navegador.
  useEffect(() => {
    for (const r of reclamos) unaVez(`reclamo:${r.id}`, () => resolverReclamo(db, { uid: r.id, ...r }, personas))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reclamos.length, personas.length])

  if (error) return <main className="pantalla-login"><p className="aviso error">Sin permiso o sin conexión: {error.message}</p></main>
  if (!estado) return <main className="pantalla-login"><p>Preparando la sala…</p></main>

  const urlSala = `${location.origin}/?sala=${estado.codigoSala}`
  const nombre = Object.fromEntries(personas.map((p) => [p.id, p.nombre]))
  const respondieron = respuestas.map((r) => nombre[r.personaId]).filter(Boolean)

  const siguiente = async () => {
    setFallo(null)
    const k = `${estado.generacion}_${estado.turno}`
    try {
      if (fase === FASES.SALA || fase === FASES.RESULTADO) {
        const excluir = estado.resultado?.saltado ? saltados.current : []
        const hay = await girarPersona(db, estado, { ...ctx, excluir })
        saltados.current = []
        if (!hay) await terminarPartida(db, estado, personas)
      } else if (fase === FASES.IMPRESION) unaVez(`argumento:${k}`, () => pasarA(db, estado, FASES.ARGUMENTO))
      else if (fase === FASES.ARGUMENTO) unaVez(`voto:${k}`, () => pasarA(db, estado, FASES.VOTO))
      else if (fase === FASES.VOTO) unaVez(`cierre:${k}`, () => cerrarTurno(db, estado, ctx))
    } catch (e) {
      console.error(e)
      setFallo('No se pudo avanzar. Revisa la conexión e intenta otra vez.')
    }
  }

  const presentes = personas.filter((p) => !p.ausente && conectados.has(p.id))
  const noVotan = estado.oradorId ? 1 : 0

  return (
    <main className="pantalla">
      <header className="pt-cabecera">
        <div>
          <h1>Metodologías de aprendizaje</h1>
          <p className="pt-sub">Fichas · ¿Te sirve o no te sirve? · UACE</p>
        </div>
        <div className="pt-entrar">
          <QRCodeSVG value={urlSala} size={96} marginSize={1} />
          <div>
            <p className="pt-entrar-txt">Entra con el QR</p>
            <p className="pt-codigo">{estado.codigoSala}</p>
          </div>
        </div>
        <img src="/uace-logo.png" alt="UACE" className="pt-logo" />
      </header>

      <ListaFichas fichas={fichasVisibles} estado={estado} nombre={nombre} />

      <section className="pt-centro">
        <CentroPantalla
          estado={estado}
          fichas={fichasVisibles}
          restante={restante}
          respuestas={respuestas}
          sentimientos={sentimientos}
          personas={personas}
          presentes={presentes.length - noVotan}
          urlSala={urlSala}
        />
      </section>

      <aside className="pt-lateral">
        <section className="pt-bloque">
          <h3>Top 5</h3>
          {(estado.top || []).length === 0 ? (
            <p className="ayuda">Aún sin puntos.</p>
          ) : (
            <ol className="top">
              {estado.top.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <span className="top-pos">{t.posicion}</span>
                  <span className="top-nombre">{t.nombre}</span>
                  <span className="top-pts">{t.total}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="pt-bloque">
          <h3>
            Conectados <span className="num">{presentes.length}</span>
            <span className="ayuda"> / {personas.length} inscritos</span>
          </h3>
          {conRespuesta && (
            <>
              <p className="pt-respondieron-titulo">
                Ya respondieron <span className="num">{respondieron.length}</span>
              </p>
              <ul className="nombres">
                {respondieron.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      </aside>

      <footer className="pt-eventos">
        {(estado.eventos || []).slice(-3).map((e) => (
          <span key={e.t} className="pt-evento">
            {e.texto}
          </span>
        ))}
      </footer>

      <Controles
        estado={estado}
        restante={restante}
        personas={personas}
        conectados={conectados}
        fichas={fichas}
        onSiguiente={siguiente}
        onSaltar={() => {
          if (estado.oradorId) saltados.current = [estado.oradorId]
        }}
        fallo={fallo}
        setFallo={setFallo}
      />
    </main>
  )
}
