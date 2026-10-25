# Metodologías de aprendizaje — Fichas

Juego de debate en vivo para una sala de 20 a 30 personas: **una pantalla grande y los celulares de
cada asistente**. Cada persona recibe fichas de técnicas de estudio; tres ruletas eligen al orador,
la ficha y el reto; la sala da su primera impresión y **predice qué tan respaldada está la técnica
por la investigación**; el orador argumenta 60 segundos; se vota; y al final se **revela la
evidencia real**.

Se construyó para el evento de la Unidad de Análisis en Ciencias Económicas (UACE) del 23 de octubre
de 2026 y funcionó con la sala completa. Este repositorio contiene todo lo necesario para repetirlo:
código, reglas de seguridad, las 130 fichas, scripts de operación y la documentación de lo que
aprendimos.

> **Stack:** Vite + React 18 · Firebase (Firestore, Realtime Database, Auth anónima y de correo,
> Hosting) · plan gratuito **Spark** · sin Cloud Functions.

## Cómo se juega, en un minuto

1. La gente escanea un QR y entra con su nombre desde el celular.
2. En la pantalla grande giran tres ruletas: **quién habla**, **qué ficha** y **qué reto**
   (Aplícala, Defiende, Ataca o Tú eliges).
3. **Primera impresión (25 s):** ¿la conoces?, ¿suena útil?, ¿qué nivel de evidencia crees que
   tiene (Respaldada, Debatida, Poco respaldada)?
4. **Argumento (60 s):** el orador defiende o ataca la técnica según su reto; la sala reacciona.
5. **Voto (15 s):** ¿te sirve?, y una nota.
6. **Resultado (30 s):** se revela la evidencia real, quién acertó y los puntos del turno.

Las reglas y los puntos están en [`docs/reglas-del-juego.md`](docs/reglas-del-juego.md).

## Rutas

| Ruta | Para quién |
|---|---|
| `/` | Celular de cada asistente |
| `/pantalla` | Pantalla grande y controles del anfitrión (requiere iniciar sesión) |
| `/respaldo` | Plan B: marcador guardado en el computador, funciona sin Firebase |

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/replicar.md`](docs/replicar.md) | **Montar todo desde cero** en tu propio Firebase, paso a paso |
| [`docs/reglas-del-juego.md`](docs/reglas-del-juego.md) | Fases, puntos, retos, premios y evento sorpresa |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Cómo está hecho y por qué: autoridad única, cuota, seguridad |
| [`docs/operacion.md`](docs/operacion.md) | Antes, durante y después del evento; qué hacer si algo falla |
| [`docs/contenido-fichas.md`](docs/contenido-fichas.md) | Formato del CSV y cómo cargar tus propias fichas |
| [`docs/lecciones-aprendidas.md`](docs/lecciones-aprendidas.md) | Errores reales y decisiones que conviene no deshacer |
| [`docs/diseno/`](docs/diseno) | Especificación y plan de la primera versión |

## Inicio rápido (local, sin Firebase real)

```bash
npm install
npm run emu            # terminal 1: emuladores de Auth, Firestore y Realtime Database (requiere Java)
cp .env.local.example .env.local   # valores de demostración para el emulador
npm run dev:emu        # terminal 2: la app apuntando al emulador
node scripts/bots.mjs --n=12   # terminal 3: celulares falsos que juegan solos
```

Para ponerlo en internet con tu propio proyecto, sigue [`docs/replicar.md`](docs/replicar.md).

## Pruebas

```bash
npm test               # 35 pruebas de la lógica pura del juego y del lector de CSV
npm run lint
npm run test:reglas    # 18 pruebas de las reglas de seguridad contra el emulador (requiere Java)
node scripts/simular.mjs --n=25 --turnos=3   # simula 25 celulares jugando (con el emulador activo)
```

## Estructura

```
src/lib/        juego.js (reglas puras) · config.js (puntos, duraciones, retos) · csv.js
                acciones-pantalla.js · acciones-celular.js · datos.js (suscripciones)
                bitacora.js · respaldo.js · texto.js · firebase.js
src/rutas/      Pantalla.jsx (anfitrión) · Celular.jsx
src/componentes/ Ruleta · CentroPantalla · FaseCelular · Podio · Actividad · Emergencia · ...
src/datos/      fichas.csv (las 130 fichas del evento)
scripts/        simular · bots · crear-anfitrion · cargar-fichas · bitacora
tests/          juego · csv · reglas (emulador)
firestore.rules · database.rules.json
```

## Autoría y licencia

Diseñado y desarrollado por **Alejandro V. Alvarado** ([@AlejjoAlva](https://github.com/AlejjoAlva))
para la Unidad de Análisis en Ciencias Económicas.

Código bajo licencia **MIT**. El logo de la UACE y el contenido de las fichas tienen condiciones
propias: ver [`NOTICE.md`](NOTICE.md).
