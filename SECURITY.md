# Política de seguridad

## Cómo reportar una vulnerabilidad

Usa **Security › Report a vulnerability** en la página de este repositorio de GitHub (reporte
privado). No abras una *issue* pública con detalles de una vulnerabilidad.

## Alcance y límites conocidos

Este proyecto se hizo para una actividad en una sala supervisada, con un grupo conocido. Algunos
límites son **decisiones de diseño**, no fallos, y están documentados en `docs/`:

- No usa Cloud Functions, así que parte de la lógica corre en el navegador y está protegida solo por
  las reglas de Firestore.
- Las claves de configuración de Firebase (`VITE_FB_*`) son públicas por diseño: van dentro del
  JavaScript del navegador. Lo que protege los datos son las reglas de seguridad.

Si despliegas tu propia copia:

- **No subas nunca** `.env`, `.env.local` ni `.firebaserc` (ya están en `.gitignore`).
- Revisa y despliega las reglas antes de abrir la app al público; después del evento déjalas en solo
  lectura o cierra el proyecto.
- Las contraseñas del panel de anfitrión se generan o eligen por instalación y **no** deben
  guardarse en el repositorio.
- Mantén las dependencias al día (`npm audit`).
