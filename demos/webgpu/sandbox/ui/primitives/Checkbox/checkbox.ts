import checkboxHtml from './checkbox.html?raw'
import './checkbox.css'

let _registered = false

function _register(): void {
  if (_registered) return
  const host = document.createElement('div')
  host.hidden = true
  host.innerHTML = checkboxHtml
  document.body.appendChild(host)
  _registered = true
}

export function createCheckbox(options?: {
  checked?: boolean
}): HTMLInputElement {
  _register()
  const template = document.querySelector<HTMLTemplateElement>('#sb-checkbox-tpl')!
  const checkbox = (template.content.cloneNode(true) as DocumentFragment)
    .querySelector<HTMLInputElement>('.sb-checkbox')!

  if (options?.checked) checkbox.checked = options.checked

  return checkbox
}
