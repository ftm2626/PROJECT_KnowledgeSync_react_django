import { useLanguage } from '../i18n'
import { ArrowUp, ArrowUpRight, CalendarDays, Check, Clock3, Download, ExternalLink, Hand, Mic2, Sparkles, Pencil, Trash2 } from 'lucide-react'
import type { Topic, User } from '../types'
import type { FormMode } from './TopicForm'
export function initials(name: string) {return name.split(' ').map(part => part[0]).slice(0,2).join('')}
export function downloadCalendar(topic: Topic) {
  if(!topic.scheduled_at) return
  const start = new Date(topic.scheduled_at)
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KnowledgeSync//Team Learning//EN', 'BEGIN:VEVENT', 'UID:topic-' + topic.id + '@knowledgesync.local', 'DTSTAMP:' + stamp(new Date()), 'DTSTART:' + stamp(start), 'DTEND:' + stamp(new Date(start.getTime() + topic.duration_minutes * 60000)), 'SUMMARY:' + escape(topic.title), 'DESCRIPTION:' + escape(topic.description), 'LOCATION:' + escape(topic.meeting_link || ''), 'END:VEVENT', 'END:VCALENDAR']
  const url = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], {type: 'text/calendar;charset=utf-8'}))
  const link = document.createElement('a'); link.href = url; link.download = 'knowledgesync-' + topic.id + '.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function TopicCard({topic, user, busy, onVote, onClaim, onForm}: {topic: Topic; user: User | null; busy: boolean; onVote: () => void; onClaim: () => void; onForm: (mode: FormMode) => void}) {
  const { t, locale, number } = useLanguage()
  const dateFormat = new Intl.DateTimeFormat(locale, {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'})
  const proposed = topic.status === 'PROPOSED'
  const mine = topic.presenter?.id === user?.id
  return <article className="topic-card">
    <div className="card-top"><span className={'kind-badge ' + (topic.kind === 'OFFER' ? 'offer' : 'request')}>{topic.kind === 'OFFER' ? <Mic2 size={13}/> : <Sparkles size={13}/>}{topic.kind === 'OFFER' ? t("Offering to share") : t("Curious to learn")}</span><span className="duration"><Clock3 size={14}/>{number(topic.duration_minutes)} {t("min")}</span></div>
    <h3 dir="auto">{topic.title}</h3><p className="card-description" dir="auto">{topic.description}</p>
    {topic.scheduled_at && <div className="session-date"><CalendarDays size={17}/><time dateTime={topic.scheduled_at}>{dateFormat.format(new Date(topic.scheduled_at))}</time></div>}
    <div className="card-person"><span className={'avatar avatar-' + topic.proposer.id % 5}>{initials(topic.proposer.name)}</span><div><span className="person-name" dir="auto">{topic.proposer.name}</span><span className="person-role">{topic.presenter?.id === topic.proposer.id ? t("Proposer & presenter") : t("Proposed this topic")}</span></div></div>
    {topic.presenter && topic.presenter.id !== topic.proposer.id && <p className="presenter-note"><Mic2 size={13}/>{t("Presenter: {name}", {name: topic.presenter.name})}</p>}
    {topic.proposer.id === user?.id && <div className="creator-actions" aria-label={t('Manage your idea')}>
      <button className="text-button" disabled={busy} onClick={() => onForm({type:'edit', topic})} aria-label={t('Edit idea: {title}', {title: topic.title})}><Pencil size={14}/>{t('Edit')}</button>
      <button className="text-button delete-action" disabled={busy} onClick={() => onForm({type:'delete', topic})} aria-label={t('Delete idea: {title}', {title: topic.title})}><Trash2 size={14}/>{t('Delete')}</button>
    </div>}
    <div className="card-footer">
      {proposed ? <button className={'vote-button ' + (topic.has_voted ? 'voted' : '')} aria-label={(topic.has_voted ? t("Remove vote for ") : t("Vote for ")) + topic.title} aria-pressed={topic.has_voted} disabled={!user || busy} onClick={onVote}><ArrowUp size={18}/><strong>{number(topic.vote_count)}</strong><span>{t("votes")}</span></button> : <span className="interest"><Check size={15}/>{number(topic.vote_count)} {t("interested")}</span>}
      {proposed && !topic.presenter && <button className="text-button" disabled={!user || busy} onClick={onClaim}><Hand size={15}/>{t("Volunteer to present")}</button>}
      {proposed && topic.presenter && mine && <button className="text-button" onClick={() => onForm({type:'schedule',topic})}>{t("Schedule")}<ArrowUpRight size={16}/></button>}
      {proposed && topic.presenter && !mine && <span className="ready-label">{t("Presenter ready")}<Check size={14}/></span>}
      {topic.status === 'SCHEDULED' && <div className="session-actions"><button className="icon-button" onClick={() => downloadCalendar(topic)} title={t("Download calendar event")} aria-label={t("Download calendar event for ") + topic.title}><Download size={17}/></button>{topic.meeting_link && <a className="text-button" href={topic.meeting_link} target="_blank" rel="noreferrer">{t("Join session")}<ExternalLink size={14}/></a>}</div>}
      {topic.status === 'COMPLETED' && (topic.slides_url ? <a href={topic.slides_url} className="text-button" target="_blank" rel="noreferrer">{t("View materials")}<ArrowUpRight size={16}/></a> : <span className="ready-label">{t("Session delivered")}</span>)}
    </div>
    {topic.status === 'SCHEDULED' && mine && <button className="complete-button" onClick={() => onForm({type:'complete',topic})}><Check size={14}/>{t("Mark complete & share materials")}</button>}
  </article>
}
