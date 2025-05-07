import { Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import NotFoundPage from './pages/NotFoundPage'
import Landing from './pages/Landing'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}

export default App
