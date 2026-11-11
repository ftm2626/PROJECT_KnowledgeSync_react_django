import { useLanguage } from '../i18n'
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
export function Modal({title, description, children, onClose}: {title: string; description: string; children: ReactNode; onClose: () => void}) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const element = dialog.current!; element.showModal(); const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => {element.close(); document.body.style.overflow = old} }, [])
  return <dialog ref={dialog} onCancel={onClose} onClick={event => {if(event.target === dialog.current) onClose()}} aria-labelledby="modal-title" className="modal">
    <div className="modal-heading"><div><p className="eyebrow">{t("A LITTLE KNOWLEDGE GOES A LONG WAY")}</p><h2 id="modal-title">{title}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label={t("Close dialog")}><X size={20}/></button></div>
    <p className="modal-description" dir="auto">{description}</p>{children}
  </dialog>
}
