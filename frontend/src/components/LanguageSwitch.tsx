import { useLanguage } from '../i18n'
export function LanguageSwitch() {
  const { t, language, setLanguage } = useLanguage()
  return <div className="language-switch" role="group" aria-label={t('Language')}>
    <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
    <button type="button" lang="fa" aria-pressed={language === 'fa'} onClick={() => setLanguage('fa')}>فارسی</button>
  </div>
}
