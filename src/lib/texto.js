// Ayudas de presentación para los textos de las fichas (no cambian el contenido).

/** El texto ya empieza con su etiqueta («Ejemplo ilustrativo: …», «Límites. …»)? Entonces no se repite. */
export const traeEtiqueta = (texto, ...palabras) =>
  palabras.some((p) => (texto || '').trim().toLowerCase().startsWith(p.toLowerCase()))

/** Separa «… Fuentes: url ; url» en el texto y la lista de fuentes. */
export function separarFuentes(texto) {
  const i = (texto || '').search(/\bFuentes?:/)
  if (i < 0) return { texto: texto || '', fuentes: [] }
  const fuentes = texto
    .slice(i)
    .replace(/^Fuentes?:\s*/, '')
    .split(/\s*;\s*|\s+(?=https?:)/)
    .map((x) => x.trim())
    .filter(Boolean)
  return { texto: texto.slice(0, i).trim(), fuentes }
}
