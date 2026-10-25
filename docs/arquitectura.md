# Arquitectura

## Idea central: una sola autoridad

La **pantalla grande es la única que mueve el juego**. Inicia sesión con una cuenta de correo cuyo
UID está fijo en las reglas (`anfitrion-fichas-2026`). Gira las ruletas, cierra las fases por
cronómetro, calcula los puntos con funciones puras (`src/lib/juego.js`) y escribe el resultado.

Los **celulares** (usuarios anónimos de Firebase Auth) solo pueden hacer tres cosas: inscribirse,
responder y reaccionar. No ejecutan lógica del juego y no ven nada que no les corresponda.

Esto tiene dos consecuencias buenas: no hay Cloud Functions (y por tanto no hace falta el plan de
pago), y no hay dos fuentes de verdad que se contradigan.

```
 celulares (anónimos)                 pantalla grande (anfitrión)
 ┌────────────────────┐               ┌──────────────────────────────┐
 │ se inscriben        │──personas───▶│ lee personas, respuestas,     │
 │ responden (1 vez)   │──respuestas─▶│ sentimiento                   │
 │ reaccionan          │──sentimiento▶│ calcula con juego.js          │
 │                     │               │ escribe juego/estado, turnos  │
 │ escuchan SOLO       │◀─juego/estado─│ publica la evidencia al       │
 │ juego/estado        │               │ abrir el Resultado            │
 └────────────────────┘               └──────────────────────────────┘
```

## Modelo de datos

| Colección / ruta | Quién escribe | Quién lee | Para qué |
|---|---|---|---|
| `juego/estado` | anfitrión | todos | Fase, turno, orador, ficha, reto, cronómetro, marcador, ajustes, código de sala, generación |
| `fichas/{n}` | anfitrión | todos | Ficha sin el nivel de evidencia |
| `evidencia/{n}` | anfitrión | **solo anfitrión** | Nivel, texto, mito y origen de cada ficha |
| `turnos/{generación_turno}` | anfitrión | todos | Resultado y revelación de cada turno |
| `personas/{uid}` | el celular (create) / anfitrión | todos | Inscripción; el id es el uid |
| `codigos/{uid}` | el dueño | solo anfitrión | Código de 4 caracteres para recuperar la sesión |
| `reclamos/{uid}` | el dueño | anfitrión y dueño | Pedido de volver a entrar desde otro celular |
| `respuestas/{gen_turno_fase_persona}` | el celular (**solo create**) | anfitrión y dueño | Impresión y voto; una por persona, turno y fase |
| `sentimiento/{uid}` | el dueño | solo anfitrión | Reacciones acumuladas |
| `reto/{gen_turno}` | el orador | todos | Elección en «Tú eliges» |
| `bitacora/{id}` | cualquiera (create) | solo anfitrión | Diagnóstico del evento |
| Realtime DB `presencia/{uid}` | el dueño | solo anfitrión | Quién está conectado (`onDisconnect`) |

Las reglas están en `firestore.rules` y `database.rules.json`, con 18 pruebas en
`tests/reglas.test.mjs`.

## Decisiones de diseño y su porqué

**La evidencia vive aparte.** El nivel de evidencia real de cada ficha está en `evidencia/` y solo
lo lee el anfitrión. Al cerrar el voto, la pantalla lo copia a `turnos/` y a
`estado.resultado.revelacion`. Así nadie puede consultar la respuesta antes de predecir, ni desde
las herramientas del navegador.

**Los celulares solo escuchan un documento.** Cada celular está suscrito a `juego/estado`. Todo lo
demás (la lista de fichas, los turnos, su propia respuesta) se pide una vez o se deduce de ese
documento. Esa es la regla de oro de la cuota.

**Presencia con Realtime Database.** `onDisconnect` permite saber quién está conectado sin gastar
escrituras de Firestore. Por eso el proyecto necesita ambas bases.

**Respuestas «solo crear».** Una por persona, turno y fase. El id del documento codifica
`generación_turno_fase_persona`, y las reglas exigen que coincida con el estado vigente y que la
hora del **servidor** (`request.time`) esté dentro del plazo del cronómetro más 1 s. Nadie puede
responder tarde, dos veces ni en nombre de otro.

**Las respuestas ajenas no se leen.** Mientras se vota, ningún celular puede ver los votos de los
demás; la pantalla los revela al cerrar la fase.

**Generaciones.** «Empezar de cero» no borra: sube un contador `generacion` en `juego/estado`.
Cada persona, respuesta y voto lleva la generación en la que se creó, las reglas exigen que
coincida con la vigente, y el cierre de cada turno filtra por ella. Un celular usado en una partida
anterior puede volver a inscribirse porque su registro viejo es de otra generación.

**Transiciones a prueba de dos pantallas.** Cada paso del juego (girar, cerrar fase) es una
transacción que verifica generación, turno y fase antes de escribir, y falla con `YaHecho` si otra
pantalla se adelantó. Se descubrió porque con dos pantallas abiertas se giraron dos fichas a la vez.
Aun así, usa **una sola pantalla de anfitrión**.

**Plan B en tres capas** (ver también [`operacion.md`](operacion.md)):

1. La pantalla guarda el marcador localmente en cada turno (`src/lib/respaldo.js`).
2. Si Firebase falla (`resource-exhausted`, `unavailable`), muestra automáticamente un podio de
   emergencia y una banda «Sin internet».
3. La ruta `/respaldo` funciona sin Firebase y muestra los resultados guardados.

**Bitácora.** Cada entrada, reingreso, corte de internet, error, cierre de fase o evento sorpresa
queda en `bitacora/`, legible desde el cajón del anfitrión o con `scripts/bitacora.mjs`. Fue lo que
permitió diagnosticar incidentes sin adivinar.

## Cuota

Plan Spark: 50.000 lecturas y 20.000 escrituras por día; reinicio a medianoche del Pacífico
(2 a. m. en Bogotá).

Medido el día del evento, hasta las 11:48 (ensayos con 3 dispositivos): 1.856 lecturas y 1.001
escrituras. Proyección para 25 personas y 25 turnos: unas 18.000 lecturas y entre 4.500 y 7.000
escrituras.

Lo que mantiene el consumo bajo:

- los celulares escuchan un solo documento;
- las reacciones se envían agrupadas cada 8 s, con un máximo de 12 por turno y persona;
- la «Actividad en vivo» de la pantalla reutiliza datos que ya está escuchando (0 lecturas extra);
- la evidencia se publica una vez por turno, no se pide por celular.

Para leer el consumo real sin `gcloud`: la API de Cloud Monitoring acepta el `access_token` que la
CLI de Firebase guarda en `~/.config/configstore/firebase-tools.json` (tiene el alcance
`cloud-platform`). Las métricas son `firestore.googleapis.com/document/read_count` y `write_count`,
agregadas por día del Pacífico.

## Seguridad: qué protege y qué no

- Protege: que un celular no pueda mover el juego, ver la evidencia antes de tiempo, leer votos
  ajenos, responder fuera de plazo o dos veces, o hacerse pasar por otro.
- No protege contra: alguien con las herramientas de desarrollador que cree **muchas cuentas
  anónimas** (Auth permite 100 nuevas por hora y por IP) o escriba basura en la `bitacora`. Para
  una sala de 25 personas conocidas es un riesgo asumido.
- La contraseña del anfitrión no está en el código ni en el bundle: se inicia sesión en la página.

## Pruebas

| Qué | Dónde | Cómo |
|---|---|---|
| Lógica del juego y lector de CSV | `tests/juego.test.mjs`, `tests/csv.test.mjs` | `npm test` (35) |
| Reglas de seguridad | `tests/reglas.test.mjs` | `npm run test:reglas` (18, emulador) |
| Partida completa con N celulares | `scripts/simular.mjs` | `node scripts/simular.mjs --n=25 --turnos=3` |
| Celulares falsos para ensayar la pantalla | `scripts/bots.mjs` | `node scripts/bots.mjs --n=12` |

`simular.mjs` también corre contra producción con `--prod`, pero **consume cuota real**: úsalo solo
para pruebas cortas.
