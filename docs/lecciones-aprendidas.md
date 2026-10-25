# Lecciones aprendidas

Errores reales de la construcción y del día del evento, y las decisiones que conviene no deshacer.
Es la parte del conocimiento que el código no cuenta por sí solo.

## Incidentes

**El script de carga expulsó a los participantes (11:04).** `scripts/cargar-fichas.mjs` hace
«Empezar de cero», que sube la generación, y se ejecutó con tres personas de prueba conectadas. No era
un fallo de la app sino de cómo se operó. *Arreglo:* el script se niega a correr si hay gente en la
generación vigente, salvo con `--forzar`.

**«No se pudo inscribir» al escanear el QR (11:21).** Un celular que ya había jugado tenía su
registro de una generación anterior, y las reglas trataban volver a inscribirse como un `update`
prohibido. *Arreglo:* la reinscripción se permite cuando la generación del registro viejo es
distinta de la vigente; el dueño puede crear y actualizar su código; los reclamos ya resueltos se
pueden repetir.

**Votos de una partida anterior se contaban.** *Arreglo:* las reglas exigen
`persona.generacion == estado.generacion` y el cierre del turno filtra por generación.

**Dos pantallas de anfitrión giraron dos fichas.** Se descubrió por casualidad, con dos pestañas
abiertas. *Arreglo:* cada transición es una transacción que verifica generación, turno y fase y
falla con `YaHecho` si otra pantalla se adelantó.

## Decisiones que no se deben deshacer

- **La evidencia real nunca viaja a los celulares antes del Resultado.** Es la base de la mecánica
  de «predecir» y es lo que impide hacer trampa con las herramientas del navegador.
- **Los celulares solo escuchan `juego/estado`.** Cada listener extra multiplica las lecturas por
  25 celulares.
- **La presencia va en Realtime Database.** `onDisconnect` no gasta escrituras de Firestore.
- **«Empezar de cero» no borra.** Sube una generación; borrar desde el cliente abriría un permiso
  que cualquiera con la consola del navegador podría usar.
- **El plan B existe desde el principio.** Fue más barato construir `/respaldo` y el podio de
  emergencia que imaginar qué hacer con 25 personas mirando una pantalla rota.
- **Medir antes de optimizar.** Antes de tocar un listener, mide el consumo con Cloud Monitoring.

## Del diseño a lo que se construyó

La primera versión (especificación y plan en [`diseno/`](diseno)) tenía solo ruletas y votación. A
media mañana del día del evento el diseño cambió a lo que hoy es el juego: un **reto** por turno
(Aplícala, Defiende, Ataca, Tú eliges), una **predicción del nivel de evidencia** y su **revelación**,
puntos por persuasión y por ir contra la evidencia, y el evento sorpresa. Lo que facilitó el cambio:
toda la lógica es de funciones puras con pruebas, así que cambiar las reglas no obligó a tocar
Firebase.

## Ideas que quedaron sin construir

Réplica automática (que un porcentaje de la sala pueda responder al orador), ronda 2, ficha de
reserva, «Réplica de Oro» y color por categoría.

## Para quien lo vuelva a montar

1. Ensaya en el **emulador** con `scripts/bots.mjs`; en producción, solo pruebas cortas.
2. Una sola pantalla de anfitrión, y el portátil sin suspensión.
3. Guarda la contraseña del anfitrión fuera del repositorio.
4. Si algo se ve raro, **recarga** y, si sigue, lee la bitácora antes de cambiar nada.
