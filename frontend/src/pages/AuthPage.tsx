import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isLogin = mode === 'login'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      await (isLogin ? login : register)(email, password)
      nav('/')
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>{isLogin ? 'Вход в MindMap' : 'Регистрация'}</h1>
      <input type="email" placeholder="Почта" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
      <input type="password" placeholder={isLogin ? 'Пароль' : 'Пароль (от 8 символов)'} value={password}
        onChange={e => setPassword(e.target.value)} required minLength={isLogin ? 1 : 8} />
      {error && <div className="error">{error}</div>}
      <button className="primary" disabled={busy}>{isLogin ? 'Войти' : 'Зарегистрироваться'}</button>
      <div className="muted">
        {isLogin ? <>Нет аккаунта? <Link to="/register">Регистрация</Link></>
          : <>Уже есть аккаунт? <Link to="/login">Войти</Link></>}
      </div>
    </form>
  )
}
