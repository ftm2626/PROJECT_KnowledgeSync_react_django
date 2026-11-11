import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { localeFor, translate, type Language } from './messages'
export function savedLanguage(): Language {
  try { const saved = localStorage.getItem('knowledgesync.language'); if (saved === 'fa' || saved === 'en') return saved } catch { /* Storage can be unavailable in private browsers. */ }
  return navigator.language.toLowerCase().startsWith('fa') ? 'fa' : 'en'
}
function makeValue(language: Language, setLanguage: (language: Language) => void) {
  const locale = localeFor(language)
  return { language, locale, setLanguage, t: (key: string, values?: Record<string, string | number>) => translate(language, key, values), number: (value: number, minimumIntegerDigits = 1) => new Intl.NumberFormat(locale, {minimumIntegerDigits, useGrouping: false}).format(value) }
}
const LanguageContext = createContext<ReturnType<typeof makeValue> | null>(null)
export function LanguageProvider({children}: {children: ReactNode}) {
  const [language, setLanguage] = useState<Language>(savedLanguage)
  useLayoutEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr'
    document.title = translate(language, 'KnowledgeSync · Learn together')
    try { localStorage.setItem('knowledgesync.language', language) } catch { /* The switch still works without persistence. */ }
  }, [language])
  const value = useMemo(() => makeValue(language, setLanguage), [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('LanguageProvider is required')
  return context
}
