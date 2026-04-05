const NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9]*$/

export class SceneHierarchy {
  private readonly _list:       HTMLElement
  private readonly _onSelect:   (index: number) => void
  private readonly _onRename:   (index: number, newName: string) => boolean
  private readonly _onRemove:   (index: number) => void
  private readonly _onDeselect: (() => void) | undefined

  private _rows:         HTMLElement[] = []
  private _selectedIndex = -1

  constructor(
    container: HTMLElement,
    onSelect: (index: number) => void,
    onRename: (index: number, newName: string) => boolean,
    onRemove: (index: number) => void,
    onDeselect?: () => void,
  ) {
    this._onSelect   = onSelect
    this._onRename   = onRename
    this._onRemove   = onRemove
    this._onDeselect = onDeselect

    this._list = container.querySelector<HTMLElement>('#scene-list')!
  }

  // ── Public API ────────────────────────────────────────────────────────────

  addObject(name: string): void {
    const index = this._rows.length
    const row   = this._buildRow(index, name)
    this._rows.push(row)
    this._list.appendChild(row)
  }

  removeRow(index: number): void {
    const row = this._rows[index]
    if (!row) return
    row.remove()
    this._rows.splice(index, 1)
    // Re-index remaining rows
    for (let i = index; i < this._rows.length; i++) {
      this._rows[i].dataset.index = String(i)
    }
    if (this._selectedIndex === index) {
      this._selectedIndex = -1
    } else if (this._selectedIndex > index) {
      this._selectedIndex--
    }
  }

  setSelected(index: number): void {
    if (this._selectedIndex >= 0 && this._rows[this._selectedIndex]) {
      this._rows[this._selectedIndex].classList.remove('selected')
    }
    this._selectedIndex = index
    if (index >= 0 && this._rows[index]) {
      this._rows[index].classList.add('selected')
    }
  }

  renameRow(index: number, name: string): void {
    const row = this._rows[index]
    if (!row) return
    const span = row.querySelector<HTMLElement>('.hier-name')
    if (span) span.textContent = name
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _buildRow(index: number, name: string): HTMLElement {
    const row = document.createElement('div')
    row.className    = 'hier-row'
    row.dataset.index = String(index)

    const span = document.createElement('span')
    span.className   = 'hier-name'
    span.textContent = name

    const removeBtn = document.createElement('button')
    removeBtn.className = 'hier-remove'
    removeBtn.title     = 'Remove'
    removeBtn.textContent = '×'

    row.appendChild(span)
    row.appendChild(removeBtn)

    // Single click on row (not remove button) → select
    row.addEventListener('click', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.hier-remove')) return
      const idx = Number(row.dataset.index)
      this.setSelected(idx)
      this._onSelect(idx)
    })

    // Double click on name → inline rename
    span.addEventListener('dblclick', (e: MouseEvent) => {
      e.stopPropagation()
      this._beginRename(row, span)
    })

    // Double click on the row background (outside the name span) → deselect.
    // The span's dblclick calls stopPropagation(), so this only fires when the
    // non-text portion of the row is double-clicked.
    row.addEventListener('dblclick', () => {
      this.setSelected(-1)
      this._onDeselect?.()
    })

    // Remove button click
    removeBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      const idx = Number(row.dataset.index)
      this._onRemove(idx)
    })

    return row
  }

  private _beginRename(row: HTMLElement, span: HTMLElement): void {
    const currentName = span.textContent ?? ''

    const input = document.createElement('input')
    input.className   = 'hier-rename-input'
    input.value       = currentName
    input.spellcheck  = false

    row.replaceChild(input, span)
    input.focus()
    input.select()

    const commit = (): void => {
      const newName = input.value.trim()
      if (!NAME_REGEX.test(newName)) {
        // Flash invalid style then restore
        input.classList.add('invalid')
        setTimeout(() => input.classList.remove('invalid'), 600)
        return
      }
      const idx = Number(row.dataset.index)
      if (this._onRename(idx, newName)) {
        span.textContent = newName
      }
      row.replaceChild(span, input)
    }

    const cancel = (): void => {
      row.replaceChild(span, input)
    }

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter')  { e.preventDefault(); commit() }
      if (e.key === 'Escape') { e.preventDefault(); cancel() }
    })

    input.addEventListener('blur', () => {
      // Only cancel if input is still in the DOM (commit() may have already removed it)
      if (input.parentElement) cancel()
    })
  }
}
