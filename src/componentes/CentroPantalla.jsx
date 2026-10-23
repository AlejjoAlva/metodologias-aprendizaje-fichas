import { QRCodeSVG } from 'qrcode.react'
import { FASES, textoReto } from '../lib/juego'
import { NIVELES_EVIDENCIA, REACCIONES } from '../lib/config'
import Crono from './Crono'
import Ruleta from './Ruleta'
import Podio from './Podio'

const RETO_TXT = { aplicala: 'Aplícala', defiende: 'Defiende', ataca: 'Ataca', elige: 'Tú eliges' }
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)

export default function CentroPantalla({ estado, fichas, restante, respuestas, sentimientos, personas, presentes, urlSala }) {
  const { fase } = estado

  if (fase === FASES.SALA)
    return (
      <div className="sala">
        <QRCodeSVG value={urlSala} size={340} marginSize={2} className="sala-qr" />
        <div className="sala-info">
          <p className="sala-titulo">Escanea y entra</p>
          <p className="sala-url">{urlSala.replace(/^https?:\/\//, '')}</p>
          <p className="sala-codigo-txt">
            Código de sala <strong>{estado.codigoSala}</strong>
          </p>
          <p className="sala-cuenta">
            <span className="num">{personas.length}</span> personas dentro
          </p>
          <ul className="nombres grandes">
            {personas.map((p) => (
              <li key={p.id}>{p.nombre}</li>
            ))}
          </ul>
          {estado.iniciada && <p className="aviso ok">Fichas repartidas. ¡A girar la ruleta!</p>}
        </div>
      </div>
    )

  if (fase === FASES.FINAL) return <Podio estado={estado} fichas={fichas} />

  if (fase === FASES.RULETA_PERSONA)
    return (
      <Ruleta
        key={`p${estado.turno}`}
        titulo="¿Quién argumenta?"
        opciones={estado.ruletaPersonas || []}
        ganador={estado.oradorNombre}
        duracionMs={4800}
      />
    )

  if (fase === FASES.RULETA_FICHA) {
    const nombres = (estado.candidatasFicha || []).map((n) => fichas.find((f) => f.n === n)?.nombre).filter(Boolean)
    return (
      <div className="centro-ruleta">
        <p className="centro-orador">{estado.oradorNombre}</p>
        <Ruleta key={`f${estado.turno}`} titulo="¿Qué ficha juega?" opciones={nombres} ganador={estado.ficha?.nombre} duracionMs={3600} />
      </div>
    )
  }

  if (fase === FASES.RULETA_RETO)
    return (
      <div className="centro-ruleta">
        <p className="centro-orador">
          {estado.oradorNombre} · <em>{estado.ficha?.nombre}</em>
        </p>
        <Ruleta
          key={`s${estado.turno}`}
          titulo="¿Qué reto le toca?"
          opciones={['Aplícala', 'Defiende', 'Ataca', 'Tú eliges']}
          ganador={RETO_TXT[estado.retoSorteo]}
          duracionMs={3200}
        />
        {estado.retoSorteo === 'elige' && (
          <div className="eligiendo">
            {estado.reto ? (
              <p className={`postura grande ${estado.reto}`}>{RETO_TXT[estado.reto]}</p>
            ) : (
              <>
                <Crono restante={restante} total={estado.duracion} grande />
                <p>{estado.oradorNombre} está eligiendo desde su celular: Aplícala, Defiende o Ataca…</p>
              </>
            )}
          </div>
        )}
      </div>
    )

  return (
    <div className="centro-turno">
      <TarjetaFicha estado={estado} restante={restante} />
      {fase === FASES.IMPRESION && (
        <div className="impresion-y-guion">
          <Guion estado={estado} />
          <Impresion respuestas={respuestas} presentes={presentes} />
        </div>
      )}
      {fase === FASES.ARGUMENTO && <Argumento sentimientos={sentimientos} personas={personas} />}
      {fase === FASES.VOTO && <Votando respuestas={respuestas} presentes={presentes} />}
      {fase === FASES.RESULTADO && <Resultado estado={estado} />}
    </div>
  )
}

export function Reto({ estado, grande }) {
  if (!estado.reto) return null
  const t = textoReto(estado.reto, estado.ficha?.categoria)
  return (
    <span className={`postura ${estado.reto} ${grande ? 'grande' : ''}`}>
      {t.titulo}
      {t.lema && <span className="reto-lema"> · {t.lema}</span>}
    </span>
  )
}

function Guion({ estado }) {
  const t = textoReto(estado.reto, estado.ficha?.categoria)
  if (!t) return null
  return (
    <div className={`guion ${estado.reto}`}>
      <p className="guion-titulo">
        Guion de {estado.oradorNombre}: <strong>{t.titulo}</strong>
        {t.lema && <em> ({t.lema})</em>}
      </p>
      <ol>
        {t.pasos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
    </div>
  )
}

function TarjetaFicha({ estado, restante }) {
  const conCrono = [FASES.IMPRESION, FASES.ARGUMENTO, FASES.VOTO, FASES.RESULTADO].includes(estado.fase)
  const enResultado = estado.fase === FASES.RESULTADO
  return (
    <div className={`tarjeta-ficha ${enResultado ? 'compacta' : ''}`}>
      <div className="tf-texto">
        <p className="tf-orador">
          {estado.oradorNombre}
          <Reto estado={estado} />
        </p>
        <p className="tf-nombre">{estado.ficha?.nombre}</p>
        <p className="tf-cat">{estado.ficha?.categoria}</p>
        {!enResultado && (
          <>
            <p className="tf-desc">{estado.ficha?.que_es ?? estado.ficha?.descripcion}</p>
            {estado.ficha?.ejemplo && (
              <p className="tf-ejemplo">
                <strong>Ejemplo:</strong> {estado.ficha.ejemplo}
              </p>
            )}
          </>
        )}
      </div>
      {conCrono && (
        <div className="tf-crono">
          <Crono restante={restante} total={estado.duracion} grande={!enResultado} />
          {restante == null && !enResultado && <p className="ayuda">Esperando que el anfitrión inicie el tiempo</p>}
        </div>
      )}
    </div>
  )
}

function Barra({ partes }) {
  const total = partes.reduce((s, p) => s + p.n, 0)
  return (
    <div className="barra-partes">
      {partes.map((p) => (
        <div key={p.txt} className={`parte ${p.clase}`} style={{ flexGrow: total ? p.n : 1 }}>
          <span>
            {p.txt} {total ? `${pct(p.n, total)}%` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

function Impresion({ respuestas, presentes }) {
  const v = respuestas.map((r) => r.valores)
  const c = (campo, valor) => v.filter((x) => x[campo] === valor).length
  return (
    <div className="medidores">
      <p className="medidor-cuenta">
        <span className="num">{v.length}</span> de {Math.max(presentes, v.length)} respondieron
      </p>
      <div className="medidor">
        <p>¿La conocen?</p>
        <Barra partes={[{ txt: 'La conozco', n: c('conoce', true), clase: 'si' }, { txt: 'No', n: c('conoce', false), clase: 'no' }]} />
      </div>
      <div className="medidor">
        <p>¿Suena útil?</p>
        <Barra
          partes={[
            { txt: 'Sí', n: c('util', 'si'), clase: 'si' },
            { txt: 'Ni idea', n: c('util', 'ni'), clase: 'ni' },
            { txt: 'No', n: c('util', 'no'), clase: 'no' },
          ]}
        />
      </div>
      <div className="medidor">
        <p>¿Qué nivel de evidencia predicen?</p>
        <Barra
          partes={[
            { txt: 'Respaldada', n: c('prediccion', 'Respaldada'), clase: 'si' },
            { txt: 'Debatida', n: c('prediccion', 'Debatida'), clase: 'ni' },
            { txt: 'Poco respaldada', n: c('prediccion', 'Poco respaldada'), clase: 'no' },
          ]}
        />
      </div>
    </div>
  )
}

function Argumento({ sentimientos, personas }) {
  // Solo cuentan los celulares que de verdad pertenecen a la persona que dicen ser.
  const validos = sentimientos.filter((s) => personas.find((p) => p.id === s.personaId)?.uids?.includes(s.id))
  const conBarra = validos.filter((s) => s.movio)
  const prom = conBarra.length ? conBarra.reduce((a, s) => a + (s.barra || 0), 0) / conBarra.length : 0
  const suma = (k) => validos.reduce((a, s) => a + (s.reacciones?.[k] || 0), 0)
  return (
    <div className="medidores">
      <div className="termometro">
        <span>No me convence</span>
        <div className="termometro-pista">
          <div className="termometro-marca" style={{ left: `${50 + prom * 50}%` }} />
        </div>
        <span>Me convence</span>
      </div>
      <p className="ayuda centro">Se actualiza cada pocos segundos · {conBarra.length} moviendo la barra</p>
      <div className="contadores">
        {REACCIONES.map((r) => (
          <div key={r.clave} className="contador">
            <span className="contador-emoji">{r.emoji}</span>
            <span className="contador-num">{suma(r.clave)}</span>
            <span className="contador-txt">{r.texto}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Votando({ respuestas, presentes }) {
  const total = Math.max(presentes, respuestas.length)
  return (
    <div className="medidores">
      <p className="medidor-cuenta grande">
        <span className="num">{respuestas.length}</span> de {total} ya votaron
      </p>
      <div className="progreso">
        <div style={{ width: `${pct(respuestas.length, total)}%` }} />
      </div>
      <p className="ayuda centro">Los resultados se revelan al cerrar la votación.</p>
    </div>
  )
}

const CLASE_NIVEL = { Respaldada: 'si', Debatida: 'ni', 'Poco respaldada': 'no' }

function Resultado({ estado }) {
  const r = estado.resultado
  if (!r) return null
  if (r.saltado) return <p className="grande centro">Turno saltado. {estado.oradorNombre} sigue pendiente.</p>
  const icono = { si: '👍', no: '👎', ni: '🤷' }
  const rev = r.revelacion || {}
  const ayuda = NIVELES_EVIDENCIA.find((n) => n.valor === rev.nivel)?.ayuda
  return (
    <div className="resultado">
      <div className="revelacion">
        <div className={`rev-nivel ${CLASE_NIVEL[rev.nivel] ?? ''}`}>
          <span className="rev-etq">Evidencia</span>
          <span className="rev-valor">{rev.nivel ?? '—'}</span>
          {ayuda && <span className="rev-ayuda">{ayuda}</span>}
          <span className="rev-aciertos">
            🎯 {r.aciertos} de {r.predijeron} lo acertaron
          </span>
          {r.aciertosNombres?.length > 0 && <span className="rev-nombres">{r.aciertosNombres.join(' · ')}</span>}
        </div>
        <div className="rev-textos">
          {rev.texto && (
            <p>
              <strong>Qué dice la evidencia.</strong> {rev.texto}
            </p>
          )}
          {rev.mito && (
            <p>
              <strong>Mito y límites.</strong> {rev.mito}
            </p>
          )}
          {rev.origen && (
            <p className="rev-origen">
              <strong>Origen.</strong> {rev.origen}
            </p>
          )}
        </div>
      </div>
      <div className="cifras grandes">
        <div>
          <span className="cifra">{r.pctSi ?? '—'}%</span>
          <span className="cifra-txt">dice «me sirve»</span>
        </div>
        <div>
          <span className="cifra">{r.notaPromedio ?? '—'}</span>
          <span className="cifra-txt">nota del argumento</span>
        </div>
        <div>
          <span className="cifra">
            {r.persuadidos}
            <small>/{r.base}</small>
          </span>
          <span className="cifra-txt">
            {r.persuasionFija
              ? `pocos persuadibles (${r.pctPersuadibles}%): +${r.puntosPersuasion} fijos`
              : `cambiaron de opinión ${r.pctPersuadido != null ? `(${r.pctPersuadido}%)` : ''}`}
          </span>
        </div>
        <div>
          <span className="cifra">{r.fuegos}</span>
          <span className="cifra-txt">🔥 buen punto</span>
        </div>
        <div className="destacada">
          <span className="cifra">+{r.puntosOrador}</span>
          <span className="cifra-txt">
            pts para {estado.oradorNombre}
            {r.contracorriente ? ' · ⚡ contracorriente' : ''}
          </span>
        </div>
      </div>
      <ul className="votos">
        {r.detalle.map((d) => (
          <li key={d.id} className={d.persuadido ? 'persuadido' : ''}>
            <span className="v-nombre">{d.nombre}</span>
            <span className="v-cambio">
              {icono[d.antes] ?? '·'} → {icono[d.sirve] ?? '·'}
            </span>
            <span className="v-nota">{d.nota ? `${d.nota}★` : ''}</span>
            <span className="v-extra">{d.acierto ? '🎯' : ''}</span>
            <span className="v-pts">+{d.puntos}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
