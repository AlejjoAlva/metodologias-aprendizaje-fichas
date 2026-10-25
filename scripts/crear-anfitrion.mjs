// Crea (o renueva la contraseña de) la cuenta del anfitrión en PRODUCCIÓN, con el UID fijo que
// exigen las reglas. Usa la sesión de la CLI de Firebase de este computador.
//   firebase projects:list > /dev/null   (refresca la sesión)
//   node --env-file=.env scripts/crear-anfitrion.mjs
// Imprime la contraseña nueva una sola vez: anótala.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { randomInt } from 'node:crypto'

const PROYECTO = process.env.VITE_FB_PROJECT_ID
if (!PROYECTO) {
  console.error('Falta VITE_FB_PROJECT_ID. Corre: node --env-file=.env scripts/crear-anfitrion.mjs')
  process.exit(1)
}
const UID = 'anfitrion-fichas-2026'
const CORREO = 'anfitrion@metodologias-fichas.uace'

const token = JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8')).tokens.access_token
const letras = 'abcdefghjkmnpqrstuvwxyz23456789'
const clave = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => letras[randomInt(letras.length)]).join('')).join('-')

const api = (ruta, cuerpo) =>
  fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROYECTO}/${ruta}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROYECTO, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  }).then((r) => r.json())

let r = await api('accounts', { localId: UID, email: CORREO, password: clave, emailVerified: true })
if (r.error?.message?.includes('EXISTS')) r = await api('accounts:update', { localId: UID, password: clave })
if (r.error) {
  console.error('No se pudo:', r.error.message, '\n(¿sesión vencida? corre primero: firebase projects:list)')
  process.exit(1)
}
console.log(`Cuenta del anfitrión lista.\n  Correo:     ${CORREO}\n  Contraseña: ${clave}\n  UID:        ${r.localId || UID}`)
