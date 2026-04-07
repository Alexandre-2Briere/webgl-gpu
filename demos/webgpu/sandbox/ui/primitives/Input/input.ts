import inputHtml from './input.html?raw'
import './input.css'

let _registered = false

function _register(): void {
  if (_registered) return
  const host = document.createElement('div')
  host.hidden = true
  host.innerHTML = inputHtml
  document.body.appendChild(host)
  _registered = true
}

export function createInput(options?: {
  type?:        string
  step?:        string
  min?:         string
  max?:         string
  maxLength?:   number
  placeholder?: string
  value?:       string
  spellcheck?:  boolean
}): HTMLInputElement {
  _register()
  const template = document.querySelector<HTMLTemplateElement>('#sb-input-tpl')!
  const input = (template.content.cloneNode(true) as DocumentFragment)
    .querySelector<HTMLInputElement>('.sb-input')!

  if (options?.type)        input.type        = options.type
  if (options?.step)        input.step        = options.step
  if (options?.min  !== undefined) input.min  = options.min
  if (options?.max  !== undefined) input.max  = options.max
  if (options?.maxLength !== undefined) input.maxLength = options.maxLength
  if (options?.placeholder) input.placeholder = options.placeholder
  if (options?.value)       input.value       = options.value
  if (options?.spellcheck !== undefined) input.spellcheck = options.spellcheck

  return input
}
