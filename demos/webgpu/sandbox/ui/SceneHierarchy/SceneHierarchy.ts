import './scene-hierarchy.css';
import { createIconButton } from '../primitives/index';
import { createInput }      from '../primitives/index';

const NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9]*$/;

export class SceneHierarchy {
  private readonly _list:       HTMLElement;
  private readonly _onSelect:   (index: number) => void;
  private readonly _onRename:   (index: number, newName: string) => boolean;
  private readonly _onRemove:   (index: number) => void;
  private readonly _onDeselect: (() => void) | undefined;

  private _rows:         HTMLElement[] = [];
  private _selectedIndex = -1;

  constructor(
    container: HTMLElement,
    onSelect: (index: number) => void,
    onRename: (index: number, newName: string) => boolean,
    onRemove: (index: number) => void,
    onDeselect?: () => void,
  ) {
    this._onSelect   = onSelect;
    this._onRename   = onRename;
    this._onRemove   = onRemove;
    this._onDeselect = onDeselect;

    this._list = container.querySelector<HTMLElement>('#scene-list')!;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  addObject(name: string): void {
    const index = this._rows.length;
    const row   = this._buildRow(index, name);
    this._rows.push(row);
    this._list.appendChild(row);
  }

  removeRow(index: number): void {
    const row = this._rows[index];
    if (!row) return;
    row.remove();
    this._rows.splice(index, 1);
    // Re-index remaining rows
    for (let i = index; i < this._rows.length; i++) {
      this._rows[i].dataset.index = String(i);
    }
    if (this._selectedIndex === index) {
      this._selectedIndex = -1;
    } else if (this._selectedIndex > index) {
      this._selectedIndex--;
    }
  }

  setSelected(index: number): void {
    if (this._selectedIndex >= 0 && this._rows[this._selectedIndex]) {
      this._rows[this._selectedIndex].classList.remove('selected');
    }
    this._selectedIndex = index;
    if (index >= 0 && this._rows[index]) {
      this._rows[index].classList.add('selected');
    }
  }

  renameRow(index: number, name: string): void {
    const row = this._rows[index];
    if (!row) return;
    const span = row.querySelector<HTMLElement>('.hier-name');
    if (span) span.textContent = name;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _buildRow(index: number, name: string): HTMLElement {
    const template = document.querySelector<HTMLTemplateElement>('#hier-row-tpl')!;
    const rowElement = (template.content.cloneNode(true) as DocumentFragment)
      .querySelector<HTMLElement>('.hier-row')!;

    rowElement.dataset.index = String(index);

    const span = rowElement.querySelector<HTMLElement>('.hier-name')!;
    span.textContent = name;

    const removeButton = createIconButton('×', () => {
      const currentIndex = Number(rowElement.dataset.index);
      this._onRemove(currentIndex);
    }, { title: 'Remove' });
    removeButton.classList.add('hier-remove');
    rowElement.appendChild(removeButton);

    // Single click on row (not remove button) → select
    rowElement.addEventListener('click', (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('.hier-remove')) return;
      const currentIndex = Number(rowElement.dataset.index);
      this.setSelected(currentIndex);
      this._onSelect(currentIndex);
    });

    // Double click on name → inline rename
    span.addEventListener('dblclick', (event: MouseEvent) => {
      event.stopPropagation();
      this._beginRename(rowElement, span);
    });

    // Double click on the row background (outside the name span) → deselect.
    // The span's dblclick calls stopPropagation(), so this only fires when the
    // non-text portion of the row is double-clicked.
    rowElement.addEventListener('dblclick', () => {
      this.setSelected(-1);
      this._onDeselect?.();
    });

    return rowElement;
  }

  private _beginRename(row: HTMLElement, span: HTMLElement): void {
    const currentName = span.textContent ?? '';

    const input = createInput({ type: 'text', value: currentName, spellcheck: false });
    input.classList.add('hier-rename-input');

    row.replaceChild(input, span);
    input.focus();
    input.select();

    const commit = (): void => {
      const newName = input.value.trim();
      if (!NAME_REGEX.test(newName)) {
        input.classList.add('sb-input--invalid');
        setTimeout(() => input.classList.remove('sb-input--invalid'), 600);
        return;
      }
      const idx = Number(row.dataset.index);
      if (this._onRename(idx, newName)) {
        span.textContent = newName;
      }
      row.replaceChild(span, input);
    };

    const cancel = (): void => {
      row.replaceChild(span, input);
    };

    input.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter')  { event.preventDefault(); commit(); }
      if (event.key === 'Escape') { event.preventDefault(); cancel(); }
    });

    input.addEventListener('blur', () => {
      if (input.parentElement) cancel();
    });
  }
}
