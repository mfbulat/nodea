import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './store/auth'
import AuthPage from './pages/AuthPage'
import MapsPage from './pages/MapsPage'
import EditorPage from './pages/EditorPage'
import AccountPage from './pages/AccountPage'

export default function App() {
  const { user, loaded, load } = useAuth()
  useEffect(() => { load() }, [load])
  if (!loaded) return <div className="page muted">Загрузка…</div>
  if (!user) {
    return (
      <Routes>
        <Route path="/s/:token" element={<EditorPage shared />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="*" element={<AuthPage mode="login" />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route path="/" element={<MapsPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/map/:id" element={<EditorPage />} />
      <Route path="/s/:token" element={<EditorPage shared />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
