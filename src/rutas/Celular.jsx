import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { asegurarAnonimo, db, rtdb } from '../lib/firebase'
import { useEstado } from '../lib/datos'
import { buscarPersona, inscribirse, marcarPresencia, pedirRecuperacion } from '../lib/acciones-celular'
import { ranking } from '../lib/juego'
import FaseCelular from '../componentes/FaseCelular'
import MisFichas from '../componentes/MisFichas'

const GUARDADO = 'fichas_persona'
const GUARDADO_CODIGO = 'fichas_codigo'
const GUARDADO_SALA = 'fichas_sala'

const leer = (k) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const guardar = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* sin almacenamiento: la app sigue, solo no recuerda */
  }
}

export default function Celular() {
  const [uid, setUid] = useState(null)
  const [errorAuth, setErrorAuth] = useState(false)
  const { estado, error } = useEstado()
  const [persona, setPersona] = useState(undefined) // undefined = buscando, null = no inscrito
  const [salaOk, setSalaOk] = useState(false)

  useEffect(() => {
    asegurarAnonimo().then((u) => setUid(u.uid), () => setErrorAuth(true))
  }, [])

  // ¿Este navegador ya está inscrito en la partida vigente?
  const generacion = estado?.generacion
  useEffect(() => {
    if (!uid || generacion == null) return
    let vivo = true
    setPersona(undefined)
    buscarPersona(db, uid, leer(GUARDADO), generacion)
      .then((p) => vivo && setPersona(p))
      .catch(() => vivo && setPersona(null))
    return () => {
      vivo = false
    }
  }, [uid, generacion])

  // Código de sala: viene en el QR (?sala=XXXX) o se escribe a mano una vez.
  useEffect(() => {
    if (!estado) return
    const enUrl = new URLSearchParams(location.search).get('sala')?.toUpperCase()
    if (enUrl === estado.codigoSala || leer(GUARDADO_SALA) === estado.codigoSala) {
      guardar(GUARDADO_SALA, estado.codigoSala)
      setSalaOk(true)
    }
  }, [estado])

  useEffect(() => {
    if (!uid || !persona) return undefined
    return marcarPresencia(rtdb, uid, persona.id)
  }, [uid, persona])

  if (errorAuth || error)
    return (
      <Marco>
        <p className="aviso error">No pudimos conectarte. Revisa tu internet y recarga la página.</p>
      </Marco>
    )
  if (!uid || estado === undefined || (estado && persona === undefined))
    return (
      <Marco>
        <p className="ayuda">Conectando…</p>
      </Marco>
    )
  if (estado === null)
    return (
      <Marco>
        <p className="ayuda">La sala todavía no está abierta. Espera a que el anfitrión la abra y recarga.</p>
      </Marco>
    )

  if (!persona) {
    if (!salaOk) return <CodigoSala estado={estado} onOk={() => setSalaOk(true)} />
    return (
      <Registro
        uid={uid}
        estado={estado}
        onListo={(p, codigo) => {
          guardar(GUARDADO, p.id)
          if (codigo) guardar(GUARDADO_CODIGO, codigo)
          setPersona(p)
        }}
      />
    )
  }

  return <Juego uid={uid} persona={persona} estado={estado} codigo={leer(GUARDADO_CODIGO)} />
}

function Marco({ children }) {
  return (
    <main className="celular">
      <header className="cel-cabecera">
        <div>
          <p className="cel-marca">Metodologías de aprendizaje</p>
          <p className="cel-sub">Fichas · UACE</p>
        </div>
        <img src="/uace-logo.png" alt="UACE" className="cel-logo" />
      </header>
      {children}
    </main>
  )
}

function CodigoSala({ estado, onOk }) {
  const [codigo, setCodigo] = useState('')
  const [mal, setMal] = useState(false)
  return (
    <Marco>
      <form
        className="tarjeta"
        onSubmit={(e) => {
          e.preventDefault()
          if (codigo.trim().toUpperCase() === estado.codigoSala) {
            guardar(GUARDADO_SALA, estado.codigoSala)
            onOk()
          } else setMal(true)
        }}
      >
        <h2>Código de sala</h2>
        <p className="ayuda">Está en la pantalla grande, junto al código QR.</p>
        <input
          className="campo campo-codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          maxLength={4}
          autoCapitalize="characters"
          autoFocus
        />
        {mal && <p className="aviso error">Ese código no coincide.</p>}
        <button className="boton principal">Entrar</button>
      </form>
    </Marco>
  )
}

function Registro({ uid, estado, onListo }) {
  const [modo, setModo] = useState('nuevo') // nuevo | recuperar | codigo
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [hecho, setHecho] = useState(null)

  // Mientras se recupera, escuchar SOLO el propio pedido.
  useEffect(() => {
    if (modo !== 'esperando') return undefined
    return onSnapshot(doc(db, 'reclamos', uid), async (s) => {
      const r = s.data()
      if (r?.estado === 'ok') {
        const p = await buscarPersona(db, uid, r.personaId, estado.generacion)
        if (p) onListo(p, codigo)
      } else if (r?.estado === 'rechazado') {
        setModo('recuperar')
        setError('El nombre o el código no coinciden. Revisa e intenta otra vez, o pide ayuda al anfitrión.')
      }
    })
  }, [modo, uid, estado.generacion, codigo, onListo])

  if (hecho)
    return (
      <Marco>
        <div className="tarjeta">
          <h2>¡Listo, {hecho.p.nombre}!</h2>
          <p>Este es tu código personal. Guárdalo: sirve para volver a entrar si cambias de navegador o de celular.</p>
          <p className="codigo-personal">{hecho.codigo}</p>
          <button className="boton principal" onClick={() => onListo(hecho.p, hecho.codigo)}>
            Entendido
          </button>
        </div>
      </Marco>
    )

  return (
    <Marco>
      {modo === 'nuevo' && (
        <form
          className="tarjeta"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!nombre.trim() || enviando) return
            setEnviando(true)
            setError(null)
            try {
              const r = await inscribirse(db, uid, estado, nombre.slice(0, 30))
              setHecho({ p: { id: r.personaId, nombre: r.nombre, uids: [uid] }, codigo: r.codigo })
            } catch (err) {
              console.error(err)
              setError('No se pudo inscribir. Revisa tu conexión e intenta de nuevo.')
            } finally {
              setEnviando(false)
            }
          }}
        >
          <h2>¿Cómo te llamas?</h2>
          <input
            className="campo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={30}
            placeholder="Tu nombre"
            autoFocus
          />
          {error && <p className="aviso error">{error}</p>}
          <button className="boton principal" disabled={enviando || !nombre.trim()}>
            {enviando ? 'Entrando…' : 'Entrar al juego'}
          </button>
          <button type="button" className="boton enlace" onClick={() => setModo('recuperar')}>
            Ya me había inscrito (tengo mi código)
          </button>
        </form>
      )}
      {(modo === 'recuperar' || modo === 'esperando') && (
        <form
          className="tarjeta"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            try {
              await pedirRecuperacion(db, uid, nombre, codigo)
              setModo('esperando')
            } catch {
              setError('Ya hay un pedido desde este navegador. Pide ayuda al anfitrión.')
            }
          }}
        >
          <h2>Volver a entrar</h2>
          <p className="ayuda">Escribe tu nombre tal como aparece en la pantalla y tu código de 4 dígitos.</p>
          <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" />
          <input
            className="campo campo-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            maxLength={4}
            placeholder="0000"
          />
          {error && <p className="aviso error">{error}</p>}
          <button className="boton principal" disabled={modo === 'esperando' || codigo.length !== 4 || !nombre.trim()}>
            {modo === 'esperando' ? 'Verificando…' : 'Recuperar'}
          </button>
          <button type="button" className="boton enlace" onClick={() => setModo('nuevo')}>
            Soy nuevo
          </button>
        </form>
      )}
    </Marco>
  )
}

function Juego({ uid, persona, estado, codigo }) {
  const [fichas, setFichas] = useState([])
  const enResultado = estado.fase === 'resultado'

  // Mis fichas: se leen una vez y otra cada vez que cambia el reparto o termina un turno.
  useEffect(() => {
    let vivo = true
    getDocs(query(collection(db, 'fichas'), where('dueno', '==', persona.id)))
      .then((s) => vivo && setFichas(s.docs.map((d) => d.data()).filter((f) => f.generacion === estado.generacion)))
      .catch((e) => console.warn('fichas', e))
    return () => {
      vivo = false
    }
  }, [persona.id, estado.repartoVersion, estado.generacion, estado.turno, enResultado])

  const yo = useMemo(() => {
    const r = ranking(estado.marcador || {})
    const f = r.find((x) => x.personaId === persona.id)
    return { total: f?.total ?? 0, posicion: f?.posicion ?? null, de: r.length }
  }, [estado.marcador, persona.id])

  return (
    <Marco>
      <section className="cel-yo">
        <div>
          <p className="cel-nombre">{persona.nombre}</p>
          {codigo && <p className="cel-codigo">Tu código: {codigo}</p>}
        </div>
        <div className="cel-puntos">
          <span className="cel-puntos-num">{yo.total}</span>
          <span className="cel-puntos-txt">pts{yo.posicion ? ` · #${yo.posicion}` : ''}</span>
        </div>
      </section>
      <FaseCelular uid={uid} persona={persona} estado={estado} />
      <MisFichas fichas={fichas} estado={estado} />
    </Marco>
  )
}
