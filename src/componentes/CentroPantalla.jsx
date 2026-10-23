import { QRCodeSVG } from 'qrcode.react'
import { FASES } from '../lib/juego'
import { REACCIONES } from '../lib/config'
import Crono from './Crono'
import Ruleta from './Ruleta'
import Podio from './Podio'

const POSTURA_TXT = { defiende: 'Defiende', ataca: 'Ataca', elige: 'Tú eliges' }
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

  if (fase === FASES.RULETA_POSTURA)
    return (
      <div className="centro-ruleta">
        <p className="centro-orador">
          {estado.oradorNombre} · <em>{estado.ficha?.nombre}</em>
        </p>
        <Ruleta
          key={`s${estado.turno}`}
          titulo="¿Qué postura toma?"
          opciones={['Defiende', 'Ataca', 'Tú eliges']}
          ganador={POSTURA_TXT[estado.posturaSorteo]}
          duracionMs={3200}
        />
        {estado.posturaSorteo === 'elige' && (
          <div className="eligiendo">
            {estado.postura ? (
              <p className={`postura grande ${estado.postura}`}>{POSTURA_TXT[estado.postura]}</p>
            ) : (
              <>
                <Crono restante={restante} total={estado.duracion} grande />
                <p>{estado.oradorNombre} está eligiendo desde su celular…</p>
              </>
            )}
          </div>
        )}
      </div>
    )

  return (
    <div className="centro-turno">
      <TarjetaFicha estado={estado} restante={restante} />
      {fase === FASES.IMPRESION && <Impresion respuestas={respuestas} presentes={presentes} />}
      {fase === FASES.ARGUMENTO && <Argumento sentimientos={sentimientos} personas={personas} />}
      {fase === FASES.VOTO && <Votando respuestas={respuestas} presentes={presentes} />}
      {fase === FASES.RESULTADO && <Resultado estado={estado} />}
    </div>
  )
}

function TarjetaFicha({ estado, restante }) {
  const conCrono = [FASES.IMPRESION, FASES.ARGUMENTO, FASES.VOTO].includes(estado.fase)
  return (
    <div className="tarjeta-ficha">
      <div className="tf-texto">
        <p className="tf-orador">
          {estado.oradorNombre}
          {estado.postura && <span className={`postura ${estado.postura}`}>{POSTURA_TXT[estado.postura]}</span>}
        </p>
        <p className="tf-nombre">{estado.ficha?.nombre}</p>
        <p className="tf-cat">{estado.ficha?.categoria}</p>
        {estado.fase !== FASES.RESULTADO && <p className="tf-desc">{estado.ficha?.descripcion}</p>}
      </div>
      {conCrono && (
        <div className="tf-crono">
          <Crono restante={restante} total={estado.duracion} grande />
          {restante == null && <p className="ayuda">Esperando que el anfitrión inicie el tiempo</p>}
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
        <p>Predicen que a la mayoría…</p>
        <Barra partes={[{ txt: 'Le servirá', n: c('prediccion', 'si'), clase: 'si' }, { txt: 'No', n: c('prediccion', 'no'), clase: 'no' }]} />
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

function Resultado({ estado }) {
  const r = estado.resultado
  if (!r) return null
  if (r.saltado) return <p className="grande centro">Turno saltado. {estado.oradorNombre} sigue pendiente.</p>
  const icono = { si: '👍', no: '👎', ni: '🤷' }
  return (
    <div className="resultado">
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
          <span className="cifra-txt">persuadidos {r.pctPersuadido != null ? `(${r.pctPersuadido}%)` : ''}</span>
        </div>
        <div>
          <span className="cifra">{r.aciertos}</span>
          <span className="cifra-txt">acertaron la predicción</span>
        </div>
        <div className="destacada">
          <span className="cifra">+{r.puntosOrador}</span>
          <span className="cifra-txt">pts para {estado.oradorNombre}</span>
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
      {r.enContra > 0 && <p className="ayuda">{r.enContra} cambiaron en contra de la postura (no resta puntos).</p>}
    </div>
  )
}
