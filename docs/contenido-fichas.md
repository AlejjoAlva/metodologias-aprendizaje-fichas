# Contenido: las fichas

Una **ficha** es una técnica o concepto de estudio (por ejemplo «Ambiente de estudio» o «Apilamiento
de hábitos»), con una descripción, un ejemplo, cómo se aplica y, aparte, **qué tan respaldada está
por la investigación**. El juego gira alrededor de adivinar ese último dato.

El repositorio incluye las 130 fichas del evento en `src/datos/fichas.csv`: **118 jugables y 12
excluidas**: 11 marcadas en la columna `jugable` como `No`, `Dividir` o `Reservada`, y 1 con nivel de
evidencia «Sin asignar». Las fichas excluidas se pueden volver a incluir desde el cajón del anfitrión.

## Formato del CSV

Primera fila con encabezados. Soporta comillas dobles, comas y saltos de línea dentro de comillas, y
tanto `,` como `;` como separador. Las columnas desconocidas se ignoran, así que puedes conservar
columnas de trabajo propias.

| Columna | Obligatoria | Qué es |
|---|---|---|
| `nombre` | sí | Nombre de la ficha |
| `categoria` | sí | Categoría (agrupa y filtra) |
| `que_es` | sí | Definición breve |
| `ejemplo` | recomendada | Ejemplo concreto |
| `como_se_aplica` | recomendada | Pasos para aplicarla |
| `evidencia_nivel` | **sí** | Exactamente `Respaldada`, `Debatida` o `Poco respaldada` |
| `evidencia_texto` | recomendada | Qué dice la investigación (se muestra al revelar) |
| `mito_limites` | recomendada | Límites o mito asociado |
| `origen` | recomendada | De dónde viene la técnica y sus fuentes |
| `jugable` | opcional | Cualquier valor distinto de `Sí` deja la ficha **excluida** (reversible en el cajón) |

Una ficha cuyo `evidencia_nivel` no sea uno de los tres valores válidos se marca como **inválida** y
entra excluida: sin nivel no se puede revelar nada. También se acepta un formato antiguo de tres
columnas (`nombre`, `descripcion`, `categoria`), con el nivel «Debatida» provisional.

`tests/fichas-ejemplo.csv` es un ejemplo mínimo con fichas ficticias para probar el importador.

## Cargar tus propias fichas

Dos formas:

1. **Desde la pantalla del anfitrión:** cajón de ajustes › Importar CSV. Muestra un resumen
   (total, jugables, excluidas, inválidas) antes de reemplazar la tabla.
2. **Desde la terminal:**
   ```bash
   node --env-file=.env scripts/cargar-fichas.mjs --csv=ruta/a/tus-fichas.csv --clave=LA_CONTRASEÑA
   ```
   Hace «Empezar de cero» y reemplaza la tabla. Se niega a correr con gente jugando.

Al cargar, el nivel de evidencia y los textos de respaldo van a la colección `evidencia/`, que solo
lee el anfitrión; el resto va a `fichas/`.

## Sobre el contenido incluido

Las fichas resumen técnicas de estudio con sus fuentes, y se elaboraron para una actividad, no como
material de referencia académica. Las cifras y afirmaciones de cada ficha deberían revisarse contra
sus fuentes antes de citarse. Las URL de las fuentes solo se muestran en el celular (desplegable); la
pantalla grande no repite «Ejemplo ilustrativo:» ni «Límites.» para ahorrar espacio.
