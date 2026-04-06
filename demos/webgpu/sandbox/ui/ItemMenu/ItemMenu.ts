import './item-menu.css'
import type { ItemEntry, ItemRegistry } from '../../items/types'

interface ButtonRecord {
  button: HTMLButtonElement
  entry:  ItemEntry
}

export class ItemMenu {
  private readonly _container: HTMLElement
  private readonly _onSpawn:   (key: string, entry: ItemEntry) => void

  private _buttonRecords: ButtonRecord[] = []
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
    for (const { button, entry } of this._buttonRecords) {
      button.disabled = !enabled || !entry.isReady
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _render(registry: ItemRegistry): void {
    for (const [sectionName, entries] of Object.entries(registry)) {
      const sectionLabel = document.createElement('h2')
      sectionLabel.className = 'menu-section-label'
      sectionLabel.textContent = sectionName
      this._container.appendChild(sectionLabel)

      for (const entry of entries) {
        const button = document.createElement('button')
        button.className = 'item-category-btn'
        button.disabled  = !this._enabled || !entry.isReady

        const labelSpan = document.createElement('span')
        labelSpan.className   = 'item-label'
        labelSpan.textContent = entry.label
        button.appendChild(labelSpan)

        if (!entry.isReady) {
          const badge = document.createElement('span')
          badge.className   = 'item-badge'
          badge.textContent = 'soon'
          button.appendChild(badge)
        } else {
          button.addEventListener('click', () => this._onSpawn(entry.key, entry))
        }

        this._container.appendChild(button)
        this._buttonRecords.push({ button, entry })
      }
    }
  }
}
