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
      <h1>{isLogin ? 'Log in to MindMap' : 'Sign Up'}</h1>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
      <input type="password" placeholder={isLogin ? 'Password' : 'Password (8+ characters)'} value={password}
        onChange={e => setPassword(e.target.value)} required minLength={isLogin ? 1 : 8} />
      {error && <div className="error">{error}</div>}
      <button className="primary" disabled={busy}>{isLogin ? 'Log In' : 'Sign Up'}</button>
      <div className="muted">
        {isLogin ? <>Don't have an account? <Link to="/register">Sign Up</Link></>
          : <>Already have an account? <Link to="/login">Log In</Link></>}
      </div>
    </form>
  )
}
