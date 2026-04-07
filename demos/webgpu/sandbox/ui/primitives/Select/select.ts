import selectHtml from './select.html?raw'
import './select.css'

let _registered = false

function _register(): void {
  if (_registered) return
  const host = document.createElement('div')
  host.hidden = true
  host.innerHTML = selectHtml
  document.body.appendChild(host)
  _registered = true
}

export function createSelect(options?: {
  options?: { value: string; label: string }[]
}): HTMLSelectElement {
  _register()
  const template = document.querySelector<HTMLTemplateElement>('#sb-select-tpl')!
  const select = (template.content.cloneNode(true) as DocumentFragment)
    .querySelector<HTMLSelectElement>('.sb-select')!

  if (options?.options) {
    for (const { value, label } of options.options) {
      const option = document.createElement('option')
      option.value       = value
      option.textContent = label
      select.appendChild(option)
    }
  }

  return select
}
