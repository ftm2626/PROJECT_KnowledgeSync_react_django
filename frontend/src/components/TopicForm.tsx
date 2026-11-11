import { useLanguage } from '../i18n'
import { useState, type FormEvent } from 'react'
import { ArrowRight, Mic2, Sparkles } from 'lucide-react'
import { Modal } from './Modal'
import { useTopicMutation } from '../api/hooks'
import { errorMessage } from '../api/client'
import type { Topic } from '../types'
export type FormMode = {type: 'propose'} | {type: 'schedule' | 'complete'; topic: Topic}
export function TopicForm({mode, onClose}: {mode: FormMode; onClose: () => void}) {
  const { t, number, language } = useLanguage()
  const mutation = useTopicMutation()
  const [kind, setKind] = useState<'OFFER' | 'REQUEST'>('OFFER')
  const [error, setError] = useState<unknown>(null)
  const title = mode.type === 'propose' ? t("What shall we learn next?") : mode.type === 'schedule' ? t("Make it a date.") : t("Share the takeaways.")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null)
    const data = new FormData(event.currentTarget)
    try {
      if(mode.type === 'propose') await mutation.mutateAsync({path: 'topics/', data: {title: data.get("title"), description: data.get("description"), kind, duration_minutes: Number(data.get("duration_minutes"))}})
      else if(mode.type === 'schedule') await mutation.mutateAsync({path: 'topics/' + mode.topic.id + '/schedule/', method: 'patch', data: {scheduled_at: new Date(String(data.get("scheduled_at"))).toISOString(), duration_minutes: Number(data.get("duration_minutes")), meeting_link: data.get("meeting_link") || ''}})
      else await mutation.mutateAsync({path: 'topics/' + mode.topic.id + '/complete/', method: 'patch', data: {slides_url: data.get("slides_url") || ''}})
      onClose()
    } catch(error) {setError(error)}
  }
  return <Modal title={title} description={mode.type === 'propose' ? t("Share something you know, or something you’re curious about.") : mode.topic.title} onClose={onClose}>
    <form onSubmit={submit} className="topic-form">
      {mode.type === 'propose' && <><fieldset><legend>{t("I’d like to…")}</legend><div className="kind-options"><button type="button" aria-pressed={kind === 'OFFER'} className={kind === 'OFFER' ? 'chosen' : ''} onClick={() => setKind('OFFER')}><Mic2 size={18}/> {t("Share what I know")}</button><button type="button" aria-pressed={kind === 'REQUEST'} className={kind === 'REQUEST' ? 'chosen' : ''} onClick={() => setKind('REQUEST')}><Sparkles size={18}/> {t("Learn something new")}</button></div></fieldset><label>{t("Topic title")}<input name="title" dir="auto" placeholder={t("e.g. A practical introduction to Docker")} maxLength={200} required autoFocus/></label><label>{t("What’s it about?")}<textarea name="description" dir="auto" placeholder={t("Give the team a little context. What will we take away?")} required rows={4}/></label></>}
      {mode.type === 'schedule' && <><label>{t("Date & time")}<input type="datetime-local" dir="ltr" name="scheduled_at" required autoFocus/><span className="field-hint">{t("Your local time zone:")} <bdi>{Intl.DateTimeFormat().resolvedOptions().timeZone}</bdi></span></label><label>{t("Meeting link")} <span className="optional">{t("(optional)")}</span><input type="url" dir="ltr" name="meeting_link" placeholder="https://meet.google.com/…"/></label></>}
      {mode.type !== 'complete' && <label>{t("Estimated duration")}<select name="duration_minutes" defaultValue={mode.type === 'schedule' ? mode.topic.duration_minutes : 30}>{Array.from(new Set([15, 30, 45, 60, 90, 120, ...(mode.type === 'schedule' ? [mode.topic.duration_minutes] : [])])).sort((a,b) => a-b).map(minutes => <option key={minutes} value={minutes}>{t("{count} minutes", {count: number(minutes)})}</option>)}</select></label>}
      {mode.type === 'complete' && <label>{t("Slides or recap link")}<span className="optional">{t("(optional)")}</span><input type="url" dir="ltr" name="slides_url" placeholder="https://…" autoFocus/><span className="field-hint">{t("Leave this blank if there aren’t any materials to share yet.")}</span></label>}
      {!!error && <p className="error-message" role="alert">{errorMessage(error, language)}</p>}
      <div className="form-footer"><button className="button secondary" type="button" onClick={onClose}>{t("Cancel")}</button><button className="button primary" disabled={mutation.isPending}>{mutation.isPending ? t("Saving…") : mode.type === 'propose' ? t("Propose topic") : mode.type === 'schedule' ? t("Schedule session") : t("Mark complete")}<ArrowRight size={17}/></button></div>
    </form>
  </Modal>
}
