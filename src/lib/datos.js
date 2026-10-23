// Suscripciones. Regla de oro: el celular solo escucha `juego/estado` (más su propio reclamo
// mientras recupera). Todo lo demás lo escucha únicamente la pantalla grande.
import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { onValue, ref } from 'firebase/database'
import { db, rtdb } from './firebase'

export function useEstado() {
  const [estado, setEstado] = useState(undefined) // undefined = cargando, null = no existe
  const [error, setError] = useState(null)
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'juego/estado'),
        { includeMetadataChanges: false },
        (s) => setEstado(s.exists() ? s.data({ serverTimestamps: 'estimate' }) : null),
        (e) => setError(e),
      ),
    [],
  )
  return { estado, error }
}

/** Escucha una consulta mientras `activa` sea verdadero. `deps` define cuándo se rehace. */
export function useConsulta(construir, deps, activa = true) {
  const [docs, setDocs] = useState([])
  useEffect(() => {
    if (!activa) {
      setDocs([])
      return undefined
    }
    return onSnapshot(
      construir(),
      (s) => setDocs(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.warn('consulta', e),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, activa])
  return docs
}

export const usePersonas = (generacion) =>
  useConsulta(
    () => query(collection(db, 'personas'), where('generacion', '==', generacion)),
    [generacion],
    generacion != null,
  )

export const useFichas = (activa) => useConsulta(() => collection(db, 'fichas'), [], activa)

/** Pedidos de recuperación sin resolver (los resueltos llevan `estado`). */
export function useReclamos(activa) {
  return useConsulta(() => collection(db, 'reclamos'), [], activa).filter((r) => !r.estado)
}

export const useRespuestasFase = (estado, activa) =>
  useConsulta(
    () =>
      query(
        collection(db, 'respuestas'),
        where('generacion', '==', estado?.generacion ?? -1),
        where('turno', '==', estado?.turno ?? -1),
        where('fase', '==', estado?.fase ?? ''),
      ),
    [estado?.generacion, estado?.turno, estado?.fase],
    activa,
  )

export const useSentimientos = (estado, activa) =>
  useConsulta(
    () =>
      query(
        collection(db, 'sentimiento'),
        where('generacion', '==', estado?.generacion ?? -1),
        where('turno', '==', estado?.turno ?? -1),
      ),
    [estado?.generacion, estado?.turno],
    activa,
  )

/** uids conectados ahora mismo (Realtime Database). */
export function usePresencia(activa) {
  const [uids, setUids] = useState(new Set())
  useEffect(() => {
    if (!activa) return undefined
    return onValue(
      ref(rtdb, 'presencia'),
      (s) => setUids(new Set(Object.keys(s.val() || {}))),
      (e) => console.warn('presencia', e),
    )
  }, [activa])
  return uids
}

/** Segundos que quedan del cronómetro del estado (null si no hay cronómetro corriendo). */
export function useRestante(estado) {
  const fin =
    estado?.cronoInicio && estado.duracion
      ? estado.cronoInicio.toMillis() + estado.duracion * 1000
      : null
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    if (!fin) return undefined
    const t = setInterval(() => setAhora(Date.now()), 200)
    return () => clearInterval(t)
  }, [fin])
  if (!fin) return null
  return Math.max(0, (fin - ahora) / 1000)
}
