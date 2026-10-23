# Metodologías de aprendizaje — Fichas · Plan de implementación (versión mínima)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (ejecución en línea, con
> puntos de control). Pasos con casillas `- [ ]`.

**Goal:** juego en vivo de debate de metodologías de estudio jugable por 25-30 celulares + una
pantalla grande, desplegado antes de las 2 p.m. del 2026-10-23.

**Architecture:** Vite + React. La pantalla grande (`/pantalla`, usuario de correo) es la única
autoridad: sortea, cierra fases y calcula puntos con funciones puras de `src/lib/juego.js`; los
celulares (`/`, usuarios anónimos) solo escuchan `juego/estado` y escriben sus respuestas una vez.
Presencia con Realtime Database (`onDisconnect`).

**Tech Stack:** Vite, React 18, Firebase JS SDK v11 (Firestore, Auth, Realtime Database),
`node --test`, `@firebase/rules-unit-testing`, emuladores de Firebase.

**Spec:** `docs/superpowers/specs/2026-10-23-version-minima-design.md`

## Global Constraints

- Plan Spark: 50.000 lecturas, 20.000 escrituras al día; reinicio 2 a.m. Bogotá. Hoy pruebas y
  evento comparten cuota → **desarrollo y pruebas solo contra el emulador**.
- Los celulares solo escuchan `juego/estado`. Nada de alta frecuencia escribe en ese documento.
- Sentimiento + reacciones: un envío por celular cada 5 s como máximo y solo si cambió.
- Respuestas: solo `create`, una vez, antes de `cronoInicio + duracion` (hora del servidor).
- Nada se borra desde el cliente. "Empezar de cero" sube la generación.
- Textos de la interfaz en español. Mobile-first en `/`; `/pantalla` para pantalla grande 16:9 sin
  scroll de página, medidas de altura en `vh`.
- Identidad de commit local del semillero. Repo privado `uamffcebog123/metodologias-aprendizaje-fichas`.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/juego.js` | Lógica pura: fases, sorteos, reparto, cálculo de turno, puntos, racha, podio |
| `src/lib/config.js` | Tabla de puntos, duraciones y umbrales por defecto |
| `src/lib/fichas.js` | Fichas precargadas (nombre, descripción, categoría) |
| `src/lib/firebase.js` | Inicialización; conecta a emuladores si `VITE_EMU=1` |
| `src/lib/datos.js` | Hooks de lectura (`useEstado`, `useColeccion`, `usePresencia`) |
| `src/lib/acciones-celular.js` | Inscripción, recuperación, respuestas, sentimiento, presencia |
| `src/lib/acciones-pantalla.js` | Transiciones de fase, reparto, cierre y cálculo de turno |
| `src/rutas/Celular.jsx`, `src/rutas/Pantalla.jsx` | Las dos vistas |
| `src/componentes/*` | Ruleta, cronómetro, lista de fichas, ranking, podio, controles |
| `firestore.rules`, `database.rules.json` | Reglas |
| `tests/juego.test.mjs`, `tests/reglas.test.mjs` | Pruebas |
| `scripts/simular.mjs` | Partida con N celulares contra emulador o producción |

## Tareas

### Tarea 1: Infraestructura y andamiaje
- [ ] APIs, Firestore `(default)` en `nam5`, RTDB, app web, Auth anónima + correo, usuario anfitrión.
- [ ] Vite + React + firebase; `firebase.json` con emuladores (auth, firestore, database, hosting).
- [ ] `.env` fuera de git; `firebase.js` falla con mensaje visible si faltan variables.
- [ ] Commit.

### Tarea 2: Lógica pura (`juego.js`, TDD)
**Produces:**
- `FASES`, `siguienteFase(fase, ctx) → fase`
- `sortear(lista, rnd) → elemento`; `sortearPostura(rnd) → 'defiende'|'ataca'|'elige'` (40/40/20)
- `repartir(libres: number[], personas: string[], rnd) → { [personaId]: [n, n] }`
- `calcularTurno({ postura, oradorId, impresiones, votos, sentimientos, config }) → { pctSi,
  votantes, notaPromedio, persuadidos, base, pctPersuadido, enContra, mayoriaSi, aciertos,
  puntosTurno: { [personaId]: { participacion, prediccion, argumento } } }`
  (impresiones/votos/sentimientos indexados por personaId)
- `aplicarTurno(marcador, calculo, presentes, config) → marcador` (suma puntos, racha +3 cada 3
  turnos completos seguidos; quien no completa pierde la racha; el orador no rompe su racha)
- `ranking(marcador) → [{ personaId, total, posicion }]` (empates comparten posición)
- [ ] Pruebas primero: persuadidos con defiende/ataca/"ni idea", pctPersuadido sin base, nota×2,
  predicción, racha, empates, reparto sin repetir, sorteo de postura con rnd fijo.
- [ ] Implementar, pruebas en verde, commit.

### Tarea 3: Reglas (TDD contra emulador)
- [ ] Pruebas: celular no escribe `juego/estado`; respuesta ajena falla; doble respuesta falla;
  respuesta tardía falla; respuesta en fase equivocada falla; inscripción con código de sala
  erróneo falla; `codigos` ilegible para celulares; sin auth no se lee nada; anfitrión sí escribe.
- [ ] Escribir `firestore.rules` y `database.rules.json`; en verde; commit.

### Tarea 4: Celular
- [ ] Inscripción (nombre, número si se repite, código de 4 dígitos visible), reconexión por
  localStorage + uid, recuperación con código vía `reclamos`.
- [ ] Vista por fase: espera, mis 2 fichas, "Tú eliges" (solo orador), primera impresión,
  argumento (barra + reacciones agrupadas cada 5 s), voto final, resultado, final.
- [ ] Puntaje y posición desde `estado.marcador`. Presencia RTDB.

### Tarea 5: Pantalla + controles
- [ ] Login de anfitrión; 3 zonas fijas (fichas izquierda, top 5 + conectados + quién respondió a
  la derecha, últimos 3 eventos abajo) y centro por fase; ruletas animadas.
- [ ] Barra discreta y cajón mínimo; autocierre al llegar a cero; cálculo y escritura del turno.

### Tarea 6: Simulación y verificación
- [ ] `scripts/simular.mjs`: 25 celulares, partida de 3 turnos contra el emulador; comprobar puntos.
- [ ] Una corrida corta contra producción; leer consumo en Cloud Monitoring.

### Tarea 7: Despliegue y documentación
- [ ] Fichas reales del usuario, deploy, base limpia, QR.
- [ ] README, runbook y guía de uso (artifact).
