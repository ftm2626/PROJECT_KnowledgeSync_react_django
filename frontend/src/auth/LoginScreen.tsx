import { useState, type FormEvent } from 'react'
import { ArrowRight, GraduationCap, LockKeyhole, Sparkles } from 'lucide-react'
import { useLanguage } from '../i18n'
import { useAuth } from './AuthProvider'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { errorMessage } from '../api/client'

export function LoginScreen() {
  const {t, language} = useLanguage()
  const auth = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try { await auth.login.mutateAsync({username: username.trim(), password}) }
    catch { setPassword('') }
  }
  return <AuthLayout>
    <div className="auth-symbol"><LockKeyhole size={25}/></div>
    <p className="eyebrow">{t('A SHARED SPACE FOR CURIOUS MINDS')}</p>
    <h1>{t('Welcome back.')}</h1>
    <p className="auth-description">{t('Sign in to learn, share, and grow with your team.')}</p>
    <form className="topic-form auth-form" onSubmit={submit}>
      <label htmlFor="login-username">{t('Username')}<input id="login-username" name="username" dir="auto" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={150} value={username} onChange={event => {setUsername(event.target.value); auth.login.reset()}} autoFocus disabled={auth.login.isPending}/></label>
      <label htmlFor="login-password">{t('Password')}<input id="login-password" name="password" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={event => {setPassword(event.target.value); auth.login.reset()}} disabled={auth.login.isPending}/></label>
      {auth.login.isError && <p className="error-message" role="alert">{errorMessage(auth.login.error, language)}</p>}
      <button className="button primary auth-submit" disabled={auth.login.isPending}>{t(auth.login.isPending ? 'Signing in…' : 'Sign in')}<ArrowRight size={17}/></button>
    </form>
    <p className="auth-admin-note">{t('Need an account or a password reset? Contact your administrator.')}</p>
  </AuthLayout>
}
export function AuthStatus() {
  const {t, language} = useLanguage()
  const auth = useAuth()
  return <AuthLayout><div className="auth-symbol"><Sparkles size={25}/></div>
    <h2 className="auth-status-heading">{t(auth.checkError ? 'We couldn’t verify your sign-in.' : 'Checking your sign-in…')}</h2>
    {auth.checkError ? <><p className="auth-description" role="alert">{errorMessage(auth.checkError, language)}</p><button className="button primary" onClick={auth.retry}>{t('Try again')}</button></> : <p className="auth-description" role="status">{t('Getting your learning space ready.')}</p>}
  </AuthLayout>
}
function AuthLayout({children}: {children: React.ReactNode}) {
  const {t, language} = useLanguage()
  return <div className="app-shell auth-shell"><header className="site-header"><div className="header-inner"><a className="brand" href="/" aria-label={t('KnowledgeSync home')}><span className="brand-mark"><GraduationCap size={25}/></span><span>{language === 'fa' ? 'هم‌آموز' : <>Knowledge<span className="brand-light">Sync</span></>}<small>{t('GOOD IDEAS TRAVEL TOGETHER')}</small></span></a><LanguageSwitch/></div></header>
    <main className="auth-main"><section className="auth-card">{children}</section><p className="auth-tagline">{t('Built on curiosity. Better together.')}</p></main>
  </div>
}
