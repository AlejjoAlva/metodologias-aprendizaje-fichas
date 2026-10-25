# Reglas del juego

Todas las cifras de esta página son los **valores por defecto** de `src/lib/config.js`. El
anfitrión puede cambiar los puntos, las duraciones y los pesos de la ruleta de retos desde el cajón
de ajustes (se guardan en `juego/estado.ajustes`). La lógica que las aplica está en
`src/lib/juego.js` como funciones puras con pruebas (`tests/juego.test.mjs`).

## Un turno

Cada turno recorre estas fases, en orden. La pantalla grande las dirige y cierra por tiempo.

| Fase | Duración | Qué pasa |
|---|---|---|
| Ruleta de persona | — | Gira entre las personas conectadas con fichas y elige al **orador** |
| Ruleta de ficha | — | Elige una de las fichas **del orador** |
| Ruleta de reto | — | Elige el reto (tabla de abajo) |
| Primera impresión | 25 s | Toda la sala responde 3 preguntas (ver abajo) |
| Argumento | 60 s | El orador habla; la sala puede reaccionar |
| Voto | 15 s | La sala vota «me sirve / no me sirve» y una nota de 1 a 5 |
| Resultado | 30 s | Se **revela la evidencia real** y se reparten los puntos |

Cuando ya no quedan personas por salir en la ruleta, el juego pasa a la fase **final** (podio).
El anfitrión también puede terminar antes con el botón 🏁 *Terminar*.

### Reparto de fichas

Al empezar, cada persona recibe **2 fichas** repartidas al azar entre las fichas jugables.

## Retos

| Reto | Peso | Postura | Guion de 3 pasos que ve la sala |
|---|---|---|---|
| **Aplícala** | 35 | a favor | Para quién o en qué situación sirve · Un ejemplo concreto · Un límite o error común |
| **Defiende** | 25 | a favor | En qué situación funciona mejor · Un ejemplo real · Una condición en la que dejaría de funcionar |
| **Ataca** | 25 | en contra | Qué problema o costo tiene · Un ejemplo real · Una situación en la que sí funciona |
| **Tú eliges** | 15 | — | El orador elige en su celular entre Aplícala, Defiende o Ataca (10 s para decidir) |

*Aplícala* cuenta como *Defiende* para medir la persuasión.

En las categorías **«Efectos de la memoria y sesgos cognitivos»** y **«Mitos y conceptos a
desmentir»**, el reto se explica distinto: *Defiende* = «es real y importa»; *Ataca* = «está
sobrevalorado o no se sostiene».

## Primera impresión

Tres respuestas por persona (el orador también responde):

1. **¿La conoces?** Sí / No.
2. **¿Suena útil?** Sí / No / Ni idea.
3. **Predicción de evidencia:** *Respaldada*, *Debatida* o *Poco respaldada*.

La predicción se compara con el nivel real de la ficha en la **base de datos**, no con lo que opine
la sala. Ese nivel está en una colección aparte (`evidencia`) que solo el anfitrión puede leer, de
modo que nadie puede mirarlo antes de tiempo.

## Puntos

| Concepto | Puntos |
|---|---|
| Primera impresión completa | +1 |
| Reaccionar al menos una vez durante el argumento (🔥 🤔 🧠) | +1 |
| Voto final completo | +2 |
| **Predicción de evidencia acertada** | +3 |
| Racha: cada 3 turnos seguidos con impresión y voto completos | +3 |

### Puntos del orador

```
5 (base) + nota promedio × 2 + persuasión + contracorriente
```

- **Persuasión:** 1 punto por cada 10 % de *persuadibles* que cambiaron a tu postura (máximo 10).
  Persuadible = alguien que antes del argumento no estaba en la postura defendida (estaba en la
  contraria o en «ni idea»). Si los persuadibles son **menos del 30 %** de los votantes, la
  persuasión vale **5 fijos**.
- **Contracorriente (+3):** el orador defendió contra la evidencia (*Ataca* una técnica
  *Respaldada*, o *Defiende* una *Poco respaldada*) **y** sacó nota promedio de 4 o más. Una
  técnica *Debatida* nunca es contracorriente.

El orador no vota, pero sí hace la primera impresión y puede ganar puntos de predicción.

## Evento sorpresa ⚡

Una persona de la **mitad de abajo** del ranking le roba **un tercio de sus puntos** a alguien del
**top 3** (solo si la víctima tiene al menos 3). Es la **única forma de perder puntos**.

- Automático cada 3 turnos, 12 s después del Resultado (`roboCada` en ajustes; `0` lo apaga).
- Manual con el botón ⚡ durante el Resultado.

## Premios del podio

Insignias:

- **Persuasor:** el mayor porcentaje de persuadidos.
- **Abogado del Diablo:** la mejor nota entre quienes fueron contra la evidencia.
- **Más Aplaudido:** más reacciones 🔥 en un turno.
- **Ojo Clínico:** más predicciones de evidencia acertadas.

Rankings de fichas:

- **Más conocida** y **más desconocida** (según «¿la conoces?»).
- **Joya oculta:** poco conocida pero que le sirve a la mayoría.
- **Más polémica:** el voto más cercano al 50 %.
- **La que más engañó:** la que más gente predijo mal.

## Reacciones

Tres: 🔥 *Buen punto*, 🤔 *Lo dudo*, 🧠 *No lo sabía*. Una cada 2,5 s y un máximo de 12 por turno por
persona. Se envían agrupadas cada 8 s para cuidar la cuota de escrituras.

## Cómo volver a entrar

- **Mismo navegador:** entra solo.
- **Otro celular:** «Ya me había inscrito» + el nombre, siempre que ese nombre esté desconectado.
- **El código** solo se pide si el nombre sigue conectado en otro dispositivo.
