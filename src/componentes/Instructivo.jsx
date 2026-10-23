import { ajustesDe } from '../lib/config'

/**
 * Instructivo para los participantes: cómo se juega, para qué sirve cada botón, cómo se ganan
 * puntos e insignias. Abierto en la sala de espera; plegado durante el juego.
 */
export default function Instructivo({ estado, abierto = false }) {
  const P = ajustesDe(estado).puntos
  const D = ajustesDe(estado).duracion
  const maxTurno = P.impresion + P.prediccion + P.reaccion + P.voto
  return (
    <details className="mis-fichas instructivo" open={abierto}>
      <summary>📖 Cómo se juega y cómo ganar puntos</summary>

      <h4>La idea</h4>
      <p>
        Cada quien recibe 2 fichas con una técnica o idea sobre cómo estudiar. Una ruleta elige quién habla, cuál de
        sus fichas y qué reto le toca. La sala opina, apuesta cuánta evidencia científica tiene la ficha y al final se
        revela la verdad.
      </p>

      <h4>Cada turno, paso a paso</h4>
      <ol>
        <li>
          <strong>Ruletas.</strong> Salen la persona, la ficha y el reto: <em>Aplícala</em> (para quién sirve, un ejemplo,
          un límite), <em>Defiende</em>, <em>Ataca</em> o <em>Tú eliges</em>.
        </li>
        <li>
          <strong>Primera impresión ({D.impresion} s).</strong> Tres botones: ¿la conoces?, ¿suena útil? y ¿qué nivel de
          evidencia tiene? (Respaldada, Debatida o Poco respaldada). Toca Enviar: se manda una sola vez.
        </li>
        <li>
          <strong>Argumento ({D.argumento} s).</strong> Quien salió habla. Tú reaccionas con 🔥 Buen punto, 🤔 Lo dudo o
          🧠 No lo sabía (hasta 12 por turno).
        </li>
        <li>
          <strong>Voto final ({D.voto} s).</strong> ¿Te sirve (usarla o tenerla en cuenta)? y una nota de 1 a 5 para el
          argumento.
        </li>
        <li>
          <strong>Resultado.</strong> Se revela el nivel real de evidencia, quién acertó 🎯, quién cambió de opinión 🔄 y
          tus puntos del turno.
        </li>
      </ol>

      <h4>Puntos en cada turno (hasta {maxTurno})</h4>
      <ul>
        <li>
          Responder la primera impresión completa: <strong>+{P.impresion}</strong>
        </li>
        <li>
          Acertar el nivel de evidencia: <strong>+{P.prediccion}</strong> (se compara con la investigación, no con lo que
          diga la sala)
        </li>
        <li>
          Reaccionar al menos una vez: <strong>+{P.reaccion}</strong> (más reacciones no dan más puntos, pero suman para
          el 🔥 del orador)
        </li>
        <li>
          Votar al final: <strong>+{P.voto}</strong>
        </li>
        <li>
          Racha: cada {P.rachaCada} turnos seguidos con impresión y voto, <strong>+{P.racha}</strong> extra
        </li>
      </ul>

      <h4>Cuando te toca hablar</h4>
      <ul>
        <li>
          Base <strong>+{P.oradorBase}</strong> y la nota promedio × {P.oradorPorNota} (hasta +{5 * P.oradorPorNota}).
        </li>
        <li>
          Convencer: <strong>+{P.oradorPorDiezPct}</strong> por cada 10 % de quienes pensaban distinto y cambiaron (máx.
          +{P.oradorPersuasionMax}). Si casi toda la sala ya pensaba como tu reto, recibes +{P.persuasionFija} fijos.
        </li>
        <li>
          Contracorriente <strong>+{P.contracorriente}</strong>: si te toca atacar una ficha respaldada o defender una
          poco respaldada y la sala te pone {P.contracorrienteNota} o más.
        </li>
        <li>Ganas por convencer, no por tener la razón. También das tu primera impresión y puedes acertar.</li>
      </ul>

      <h4>Evento sorpresa ⚡</h4>
      <p>
        {P.roboCada ? `Cada ${P.roboCada} turnos, o cuando el anfitrión quiera, ` : 'Cuando el anfitrión quiera, '}
        alguien de la mitad de abajo de la tabla le roba la tercera parte de sus puntos a alguien del podio. Es la única
        forma de perder puntos.
      </p>

      <h4>Insignias del final</h4>
      <ul>
        <li>
          🗣️ <strong>El Persuasor:</strong> quien más % de la sala hizo cambiar de opinión.
        </li>
        <li>
          😈 <strong>Abogado del Diablo:</strong> quien, teniendo que ir contra la evidencia (atacar una ficha respaldada o
          defender una poco respaldada), sacó la mejor nota. Solo existe si a alguien le toca ese reto.
        </li>
        <li>
          🔥 <strong>El Más Aplaudido:</strong> el turno con más 🔥 Buen punto.
        </li>
        <li>
          🔬 <strong>Ojo Clínico:</strong> quien más veces acertó el nivel de evidencia.
        </li>
      </ul>
      <p className="ayuda">
        También se premian fichas: la más conocida, la más desconocida, la joya oculta (poco conocida pero útil), la más
        polémica (la sala partida en dos) y la que más engañó (la que más gente predijo mal).
      </p>

      <h4>Si te sales</h4>
      <p className="ayuda">
        Vuelve a abrir el enlace en el mismo navegador y entras solo. Desde otro celular: «Ya me había inscrito» y tu
        nombre.
      </p>
    </details>
  )
}
