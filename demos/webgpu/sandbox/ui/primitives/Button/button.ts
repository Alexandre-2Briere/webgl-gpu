import buttonHtml from './button.html?raw'
import './button.css'

let _registered = false

function _register(): void {
  if (_registered) return
  const host = document.createElement('div')
  host.hidden = true
  host.innerHTML = buttonHtml
  document.body.appendChild(host)
  _registered = true
}

function _cloneTemplate(id: string): HTMLButtonElement {
  _register()
  const template = document.querySelector<HTMLTemplateElement>(`#${id}`)!
  return (template.content.cloneNode(true) as DocumentFragment)
    .querySelector<HTMLButtonElement>('.sb-btn')!
}

export function createButton(label: string, onClick: () => void, options?: {
  disabled?: boolean
}): HTMLButtonElement {
  const button = _cloneTemplate('sb-btn-tpl')
  button.textContent = label
  if (options?.disabled) button.disabled = true
  button.addEventListener('click', onClick)
  return button
}

export function createIconButton(symbol: string, onClick: () => void, options?: {
  title?: string
}): HTMLButtonElement {
  const button = _cloneTemplate('sb-btn-icon-tpl')
  button.textContent = symbol
  if (options?.title) button.title = options.title
  button.addEventListener('click', onClick)
  return button
}

export function createTabButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = _cloneTemplate('sb-btn-tab-tpl')
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

export function createSidebarButton(label: string, onClick: () => void, options?: {
  badge?: string
  disabled?: boolean
}): HTMLButtonElement {
  const button = _cloneTemplate('sb-btn-sidebar-tpl')
  button.querySelector<HTMLElement>('.sb-btn-label')!.textContent = label

  if (options?.badge) {
    const badge = document.createElement('span')
    badge.className   = 'item-badge'
    badge.textContent = options.badge
    button.appendChild(badge)
  }

  if (options?.disabled) {
    button.disabled = true
  }
  button.addEventListener('click', onClick)

  return button
}
