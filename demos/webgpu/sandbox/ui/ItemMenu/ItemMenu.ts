import './item-menu.css'
import { createSidebarButton } from '../primitives/index'
import type { ItemEntry, ItemRegistry } from '../../items/types'

export class ItemMenu {
  private readonly _container: HTMLElement
  private readonly _onSpawn:   (key: string, entry: ItemEntry) => void

  private _buttons: HTMLButtonElement[] = []
  private _enabled = false

  constructor(
    container: HTMLElement,
    registry:  ItemRegistry,
    onSpawn:   (key: string, entry: ItemEntry) => void,
  ) {
    this._container = container
    this._onSpawn   = onSpawn
    this._render(registry)
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  setEnabled(enabled: boolean): void {
    this._enabled = enabled
    for (const button of this._buttons) {
      if (!button.dataset.unavailable) {
        button.disabled = !enabled
      }
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _render(registry: ItemRegistry): void {
    const sectionTemplate = document.querySelector<HTMLTemplateElement>('#menu-section-tpl')!

    for (const [sectionName, entries] of Object.entries(registry)) {
      const fragment = new DocumentFragment()

      const sectionLabel = (sectionTemplate.content.cloneNode(true) as DocumentFragment)
        .querySelector<HTMLElement>('.menu-section-label')!
      sectionLabel.textContent = sectionName
      fragment.appendChild(sectionLabel)

      for (const entry of entries) {
        const isUnavailable = !entry.isReady
        const button = createSidebarButton(
          entry.label,
          () => this._onSpawn(entry.key, entry),
          {
            badge:    isUnavailable ? 'soon' : undefined,
            disabled: isUnavailable || !this._enabled,
          },
        )

        if (isUnavailable) {
          button.dataset.unavailable = 'true'
        }

        fragment.appendChild(button)
        this._buttons.push(button)
      }

      this._container.appendChild(fragment)
    }
  }
}
