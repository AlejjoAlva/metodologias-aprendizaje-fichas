# Metodologías de aprendizaje — Fichas · Versión mínima (evento 2026-10-23, 2 p.m.)

El modelo conceptual completo del juego está en el documento "Debate de metodologías de estudio:
modelo conceptual" (2026-10-23). Esta especificación define **qué se construye hoy** y **cómo**, con
las lecciones de La Bolsa (`~/Proyectos/bolsa-semillero`) aplicadas desde el inicio.

## 1. Alcance

**Entra hoy**
- Sala: entrada con nombre por QR o enlace (el código de sala va en la URL), entrada tardía,
  nombres repetidos con número, reconexión automática en el mismo navegador y recuperación con
  código personal de 4 dígitos en otro navegador.
- Fichas precargadas (nombre, descripción, categoría; ID = número de fila), lista completa en la
  pantalla grande con estados sin repartir / repartida / en juego / jugada (tachada).
- Reparto de 2 fichas al iniciar; a quien llega tarde, 2 sin repartir.
- Turno completo de ronda 1: ruleta persona → ruleta ficha → ruleta postura (40/40/20, "Tú eliges"
  10 s desde el celular del orador) → primera impresión (20 s) → argumento (60 s, barra y
  reacciones) → voto final (15 s) → resultado.
- Resultado: votos con nombre, % "Me sirve", persuadidos según la regla del documento, nota
  promedio, aciertos de predicción y puntos del turno.
- Puntos con la tabla del documento (incluida la racha), top 5 en pantalla, puntaje y posición en
  el celular, podio final con desglose.
- Controles del anfitrión: barra discreta (siguiente fase, iniciar/reiniciar cronómetro, saltar
  turno, ocultar controles) y cajón mínimo (iniciar partida, anular turno, marcar ausente,
  renombrar, terminar y mostrar podio, empezar de cero).
- **Presencia automática** (quién está conectado) con Realtime Database, sin costo en escrituras de
  Firestore (ver §2).

**Queda para después**: réplica, ronda 2, insignias, rankings de fichas, carga de CSV desde el
panel, edición de puntos y umbrales desde el panel, exportación, pestaña Registro del celular,
pausa del cronómetro.

## 2. Arquitectura

Vite + React + Firestore + Firebase Auth + Hosting, plan **Spark**, proyecto nuevo bajo
`la cuenta institucional del semillero`, repo privado `uamffcebog123/metodologias-aprendizaje-fichas`.
Sin Cloud Functions (no hay Blaze).

**Presencia con Realtime Database (RTDB)**: Firestore no detecta desconexiones sin escrituras
periódicas (≈5.000 en el evento). RTDB sí, de forma nativa: cada celular escribe
`presencia/{uid} = true` al conectar y registra `onDisconnect().remove()`; el servidor de Firebase
borra la marca cuando se cae la conexión (cierre de pestaña, pérdida de red, celular bloqueado
durante un rato). RTDB en Spark **no cobra por operación** (límites: 100 conexiones simultáneas,
1 GB guardado, 10 GB/mes de descarga), así que cuesta cero de la cuota de Firestore. Solo la
pantalla escucha `presencia`. La ruleta de personas sortea entre inscritos **conectados**, no
ausentes y que no han pasado. El anfitrión puede seguir marcando ausente a mano.

Dos rutas:
- **`/`** — celular. Usuario anónimo de Firebase.
- **`/pantalla`** — pantalla grande + controles del anfitrión. Inicia sesión con **correo y
  contraseña de anfitrión**. Es la **única autoridad de cálculo**: sortea, cierra fases, calcula
  resultados y puntos y los escribe.

Unidades:
- `src/lib/juego.js` — funciones puras: máquina de fases, sorteos, persuadidos, puntos, racha,
  podio. Sin Firebase. Probadas con `node --test`.
- `src/lib/datos.js` — suscripciones y lecturas (hooks).
- `src/lib/acciones.js` — escrituras.
- `src/rutas/Celular.jsx`, `src/rutas/Pantalla.jsx` y componentes por fase.

## 3. Datos

| Documento | Quién escribe | Quién escucha |
|---|---|---|
| `juego/estado` — fase, turno, orador, ficha en juego, postura, `cronoInicio` (hora del servidor) + `duracion`, código de sala, generación, mapa de puntos y top 5, resultado del turno revelado | solo anfitrión | **celulares** y pantalla |
| `personas/{personaId}` — nombre, `uids[]`, ausente, ha pasado | celular al inscribirse; anfitrión | pantalla; celular lee una vez |
| `codigos/{personaId}` — código de recuperación | celular al inscribirse | solo anfitrión |
| `reclamos/{uid}` — personaId + código para recuperar en otro navegador | celular | pantalla |
| `fichas/{n}` — nombre, descripción, categoría, dueño, estado | anfitrión | pantalla; celular lee sus 2 |
| `respuestas/{turno}_{fase}_{uid}` — valores de la fase | celular, una vez | pantalla (al cerrar la fase) |
| `sentimiento/{uid}` — barra + contadores de reacciones del turno | celular, máx. cada 5 s y solo si cambió | **solo pantalla** |
| `postura/{turno}` — elección de "Tú eliges" | orador | pantalla |
| `turnos/{turno}` — resumen del turno | anfitrión | pantalla |

Regla de oro (lección de La Bolsa): **los celulares solo escuchan `juego/estado`**, que cambia unas
12 veces por turno. Nada de alta frecuencia toca ese documento.

## 4. Seguridad (reglas de Firestore)

- Lectura solo autenticada; `codigos` solo la lee el anfitrión.
- Anfitrión = el UID de la cuenta de correo, fijo en las reglas. Solo él escribe `juego`,
  `fichas`, `turnos` y modifica `personas`.
- Inscripción: el celular crea `personas/{id}` con su propio UID y el código de sala correcto.
- Respuestas: solo `create`, el ID termina en el UID propio, la fase coincide con la actual y
  **`request.time` es anterior a `cronoInicio + duracion`** (hora del servidor, no del celular).
  No se editan ni se borran.
- `sentimiento/{uid}`: solo el propio UID.
- Nada se borra desde el cliente. "Empezar de cero" sube la generación (como en La Bolsa).

## 5. Presupuesto de cuota (25 personas, 25 turnos)

| | Estimado | Tope Spark |
|---|---|---|
| Escrituras | 5.000-9.000 (barra + reacciones agrupadas cada 5 s es el grueso) | 20.000 |
| Lecturas | ~18.000 (celulares escuchando `estado` ~7.500, pantalla ~10.000) | 50.000 |

Hoy la cuota del evento y la de las pruebas son la misma (reinicio a las 2 a.m. de Bogotá). Por eso
**todas las pruebas de desarrollo van contra el emulador**; contra producción solo una prueba de
carga corta (25 clientes, ~3 turnos), medida luego en Cloud Monitoring.

## 6. Pruebas

1. Unitarias de `juego.js` (puntos, persuadidos, racha, sorteos, máquina de fases).
2. Reglas de Firestore contra el emulador (`@firebase/rules-unit-testing`): votos tardíos,
   doble voto, voto ajeno, escritura de estado por un celular — todo debe fallar.
3. Simulación de partida completa contra el emulador con 25 celulares.
4. Una prueba de carga corta contra producción y lectura del consumo real.
5. Presencia: cerrar la pestaña de un celular simulado y ver que sale de la ruleta.
6. Revisión visual tuya en la pantalla grande antes del evento.

## 7. Entregables antes de las 2 p.m.

Desplegado, base limpia, QR listo, credenciales del anfitrión entregadas, runbook corto (qué hacer
si algo falla), README y **guía de uso** para el anfitrión (cómo funciona, cómo explicarlo a la sala
y cómo operar cada fase).
