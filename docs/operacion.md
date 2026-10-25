# Operación del evento

Qué hacer antes, durante y después de una partida, y qué **no** tocar con gente jugando.

## Antes (el día anterior y la mañana del evento)

- [ ] `npm test && npm run lint` y, con el emulador, `npm run test:reglas`.
- [ ] `npm run build && firebase deploy` con el `.env` de **producción** (borra `.env.local` antes de
      compilar: si existe, el build se hornea apuntando al emulador).
- [ ] Reglas e índices publicados e idénticos al repositorio.
- [ ] Cuenta del anfitrión creada y la contraseña **guardada en un gestor de contraseñas**.
- [ ] Fichas cargadas (`scripts/cargar-fichas.mjs`) y revisadas en el cajón.
- [ ] Pantalla grande: **una sola pestaña** abierta en `/pantalla`, portátil conectado a la corriente
      y sin suspensión automática.
- [ ] Ensayo corto en producción (3 dispositivos, 3 turnos) y luego «Empezar de cero». Para ensayos
      largos usa el emulador y `scripts/bots.mjs`.
- [ ] Consumo del día revisado: no ensayes con 25 bots contra producción el mismo día del evento.

## Durante

1. Proyecta `/pantalla` e inicia sesión. Muestra el QR de inscripción.
2. Deja que la gente se inscriba; el instructivo está abierto en la sala de espera del celular.
3. Inicia los turnos. Los controles del anfitrión están en la cabecera; el cajón tiene ajustes,
   fichas y bitácora.
4. Para cerrar antes de tiempo: 🏁 *Terminar* (muestra el podio con los turnos cerrados).

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Varias personas no logran inscribirse a la vez | Se agotaron las 100 cuentas anónimas por hora para la IP de la sala | Que usen **datos móviles** en lugar del wifi |
| «No se pudo inscribir» al escanear el QR | Un celular ya usado tenía un registro de una partida anterior | Corregido en la versión final (reinscripción permitida en una generación nueva); recargar |
| Una persona no ve su sesión al volver | Entró desde otro navegador | «Ya me había inscrito» + nombre; el código de 4 caracteres solo si el nombre sigue conectado |
| La banda «Sin internet» | Cortó la red | Esperar: se reconecta sola. El marcador está guardado localmente |
| Podio de emergencia automático | Firebase devolvió `resource-exhausted` o `unavailable` | Anotar el ranking mostrado; `/respaldo` y el cajón *Ver resultados guardados* conservan los datos |
| Se giraron dos fichas a la vez | Hay **dos pantallas de anfitrión** abiertas | Cerrar una. Las transiciones son transacciones, pero una sola pantalla es lo correcto |
| No sabes qué pasó | — | Cajón › Bitácora, o `node --env-file=.env scripts/bitacora.mjs --clave=… --horas=6` |

Siempre lo primero: **recargar la página**. El estado vive en Firestore, no en el navegador.

## No hacer con gente jugando

- **«Empezar de cero» y `scripts/cargar-fichas.mjs`.** Suben la generación y **expulsan a todos los
  celulares**. Esto ya ocurrió: durante el montaje del evento, correr el script de carga con tres
  personas de prueba dentro las sacó de la partida. El script ahora se niega si hay gente
  (`--forzar` lo salta).
- **Desplegar** reglas o sitio a mitad de la partida.
- **Abrir una segunda pantalla de anfitrión.**

## Después

- Leer la bitácora con la hora de cualquier incidente.
- Medir el consumo real (Cloud Monitoring, ver [`arquitectura.md`](arquitectura.md#cuota)).
- Si no vas a volver a usar la base, deja las reglas en solo lectura (`allow write: if false` y
  lectura solo autenticada) y despliega: así el enlace público no puede ser usado para llenar tu
  cuota.
- Anota qué funcionó y qué no en [`lecciones-aprendidas.md`](lecciones-aprendidas.md).

## Credenciales de la CLI de Firebase

Caducan. Si un comando falla con *"Your credentials are no longer valid"* o *"Failed to fetch
documents to delete"*, ejecuta `firebase login --reauth` (interactivo). Se detecta con
`firebase projects:list`.
