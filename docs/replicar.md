# Montar el juego desde cero

Esta guía te lleva de un computador vacío a una partida funcionando en internet, con **tu propio
proyecto de Firebase**. No necesitas tarjeta de crédito: todo cabe en el plan gratuito **Spark**.

Tiempo estimado: 30–40 minutos la primera vez.

## 0. Requisitos

- **Node.js 20 o superior** (recomendado 22). Con `nvm`: `nvm install 22`.
- **Firebase CLI**: `npm install -g firebase-tools` y luego `firebase login`.
- **Java 11 o superior**, solo si vas a usar los emuladores y las pruebas de reglas
  (`sudo apt install default-jre` en Ubuntu).
- Una cuenta de Google.

```bash
git clone https://github.com/AlejjoAlva/metodologias-aprendizaje-fichas.git
cd metodologias-aprendizaje-fichas
npm install
```

## 1. Crear el proyecto en Firebase

En la [consola de Firebase](https://console.firebase.google.com):

1. **Agregar proyecto.** Desactiva Google Analytics. Anota el *ID del proyecto* (por ejemplo
   `mi-fichas-2026`).
2. **Compilación › Firestore Database › Crear base de datos.** Modo **producción**. La ubicación
   no se puede cambiar después (`nam5` o `southamerica-east1` son buenas opciones).
3. **Compilación › Realtime Database › Crear base de datos.** Modo **bloqueado**. Se usa solo para
   la presencia (quién está conectado) porque `onDisconnect` no gasta escrituras de Firestore.
4. **Compilación › Authentication › Comenzar**, pestaña *Método de acceso*. Habilita **dos**
   proveedores:
   - **Anónimo** (los celulares).
   - **Correo electrónico/contraseña** (la pantalla del anfitrión).
5. **Configuración del proyecto (⚙️) › Tus apps › `</>` Web.** Registra una app con cualquier
   apodo y **no** marques Hosting ahí. Copia el bloque `firebaseConfig`.

## 2. Configurar la app

```bash
cp .env.example .env
cp .firebaserc.example .firebaserc
```

- Edita `.firebaserc` y pon el ID de tu proyecto.
- Edita `.env` con los valores del `firebaseConfig`. `VITE_FB_DATABASE_URL` tiene la forma
  `https://<tu-proyecto>-default-rtdb.firebaseio.com` (también aparece en la consola de Realtime
  Database; si la creaste en otra región, copia la URL exacta de ahí).

> **Importante:** Vite congela estos valores dentro del JavaScript al compilar. Si cambias el
> `.env` después de desplegar, hay que volver a hacer `npm run build` **y** `firebase deploy`.
>
> Las claves de `firebaseConfig` **son públicas por diseño**: van en el navegador de cada
> asistente. Lo que protege los datos son las reglas de seguridad, no esas claves.

## 3. Publicar reglas y sitio

> **Antes de compilar**, comprueba que **no** exista un `.env.local`: Vite lo carga por encima de `.env` y
> hornearía el modo emulador dentro del sitio publicado.

```bash
firebase login
npm run build
firebase deploy --only firestore:rules,firestore:indexes,database,hosting
```

Al terminar imprime la URL (`https://<tu-proyecto>.web.app`). Esa es la que va en el QR.

Si falla con "site not found" o un 404, abre *Compilación › Hosting › Comenzar* en la consola, avanza
hasta ver el panel y repite el deploy.

## 4. Crear la cuenta del anfitrión

Las reglas reconocen al anfitrión por un **UID fijo**: `anfitrion-fichas-2026`. Así, aunque
cualquiera pueda iniciar sesión como anónimo, solo esa cuenta puede controlar el juego. Un correo
y contraseña normales no bastan porque la consola no te deja elegir el UID. Hay dos caminos:

**A. Con el script (recomendado).** Usa la sesión de tu CLI de Firebase:

```bash
firebase projects:list > /dev/null          # refresca la sesión
node --env-file=.env scripts/crear-anfitrion.mjs
```

Imprime el correo (`anfitrion@metodologias-fichas.uace`, no es un buzón real) y una **contraseña
nueva que se muestra una sola vez**: anótala. Puedes repetir el comando para renovarla.

**B. A mano.** Crea un usuario con correo y contraseña en la consola, copia su UID y reemplaza
`anfitrion-fichas-2026` por ese UID en `firestore.rules` (función `anfitrion()`) y en
`database.rules.json`. Vuelve a desplegar las reglas.

## 5. Cargar las fichas

El repositorio trae las 130 fichas del evento en `src/datos/fichas.csv` (118 jugables y 12
excluidas). Para cargarlas:

```bash
node --env-file=.env scripts/cargar-fichas.mjs --csv=src/datos/fichas.csv --clave=LA_CONTRASEÑA
```

Hace "Empezar de cero" y reemplaza la tabla de fichas. **Se niega a correr si hay gente jugando**
(salvo con `--forzar`), porque expulsaría a todos. También puedes importar el CSV desde la pantalla
del anfitrión: cajón de ajustes › Importar CSV. Para usar tus propias fichas, mira
[`contenido-fichas.md`](contenido-fichas.md).

## 6. Probar

1. Abre `https://<tu-proyecto>.web.app/pantalla` e inicia sesión con el correo y la contraseña del
   paso 4. Es la pantalla grande: **usa una sola a la vez**.
2. Abre `https://<tu-proyecto>.web.app/` en un celular (o en ventanas de incógnito, cada una cuenta
   como una persona distinta) e inscríbete.
3. Inicia un turno desde la pantalla.

Para ensayar sin gente y sin gastar cuota, usa los emuladores y los bots:

```bash
npm run emu                                  # terminal 1
cp .env.local.example .env.local             # modo emulador (vale para ambas terminales)
npm run dev:emu                              # terminal 2: http://localhost:5173
node scripts/bots.mjs --n=12                 # terminal 3: 12 celulares falsos
```

Mientras exista `.env.local`, **todo va al emulador y nada toca producción**. Bórralo para volver al
proyecto real.

## 7. Verificar antes del evento

```bash
npm test               # 35 pruebas de lógica
npm run lint
npm run test:reglas    # 18 pruebas de reglas contra el emulador
node scripts/simular.mjs --n=25 --turnos=3   # 25 celulares simulados contra el emulador
```

Después, lee [`operacion.md`](operacion.md): tiene la lista de comprobación del día, qué hacer si algo
falla y qué **no** tocar con gente jugando.

## Cuenta de servicio, secretos y qué no subir

- No hay claves secretas en este repositorio y no deben añadirse. `.env`, `.env.local` y
  `.firebaserc` están en `.gitignore`.
- La contraseña del anfitrión se genera al vuelo y **no se guarda en ningún archivo**: guárdala en un
  gestor de contraseñas, no en el repositorio ni en una página compartida.
- Las credenciales de la CLI de Firebase caducan. Si un comando falla con *"Your credentials are no
  longer valid"*, ejecuta `firebase login --reauth` (es interactivo).

## Límites del plan gratuito

Spark permite 50.000 lecturas y 20.000 escrituras de Firestore por día, con reinicio a medianoche
hora del Pacífico. Una partida de 25 personas y 25 turnos proyecta unas 18.000 lecturas y entre 4.500 y
7.000 escrituras: alcanza, pero no hay mucho margen para ensayar el mismo día. Detalles en
[`arquitectura.md`](arquitectura.md#cuota).

Firebase Auth también limita las **cuentas anónimas nuevas a 100 por hora y por IP**. Los celulares de
una sala comparten IP; si varios no logran inscribirse a la vez, que usen datos móviles.
