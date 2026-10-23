import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { CONFIG_FALTANTE } from './lib/firebase'
import Celular from './rutas/Celular'
import Pantalla from './rutas/Pantalla'

export default function App() {
  // Build hecho sin .env: no tiene sentido intentar conectarse a ningún lado.
  if (CONFIG_FALTANTE.length > 0)
    return (
      <main className="celular">
        <p className="aviso error">
          Falta config de Firebase en el build: {CONFIG_FALTANTE.join(', ')}. Llena <code>.env</code> y vuelve a
          compilar.
        </p>
      </main>
    )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/pantalla" element={<Pantalla />} />
        <Route path="*" element={<Celular />} />
      </Routes>
    </BrowserRouter>
  )
}
