import { FormEvent, useState } from 'react'
import { api } from '../api/client'
import TopBar from './TopBar'

export default function AccountPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await api('/api/auth/change-password', { method: 'POST', json: { current_password: current, new_password: next } })
      setMsg({ ok: true, text: 'Пароль изменён. Остальные сессии завершены.' })
      setCurrent(''); setNext('')
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }) }
  }

  return (
    <>
      <TopBar />
      <form className="auth" onSubmit={submit}>
        <h1>Смена пароля</h1>
        <input type="password" placeholder="Текущий пароль" value={current} onChange={e => setCurrent(e.target.value)} required />
        <input type="password" placeholder="Новый пароль (от 8 символов)" value={next} onChange={e => setNext(e.target.value)} required minLength={8} />
        {msg && <div className={msg.ok ? 'muted' : 'error'}>{msg.text}</div>}
        <button className="primary">Сменить пароль</button>
      </form>
    </>
  )
}
