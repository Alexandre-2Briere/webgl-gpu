import './load-modal.css';

export class LoadModal {
  private readonly _dialog:   HTMLDialogElement;
  private readonly _textarea: HTMLTextAreaElement;
  private _onConfirm: ((encodedString: string) => void) | null = null;

  constructor() {
    this._dialog = document.createElement('dialog');
    this._dialog.className = 'load-modal';

    const title = document.createElement('p');
    title.className = 'load-modal-title';
    title.textContent = 'Load Scene';

    this._textarea = document.createElement('textarea');
    this._textarea.className = 'load-modal-textarea';
    this._textarea.placeholder = 'Paste encoded scene string here…';

    const actions = document.createElement('div');
    actions.className = 'load-modal-actions';

    const cancelButton = document.createElement('button');
    cancelButton.className = 'load-modal-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => { this.close(); });

    const confirmButton = document.createElement('button');
    confirmButton.className = 'load-modal-confirm';
    confirmButton.textContent = 'Load';
    confirmButton.addEventListener('click', () => {
      const encodedValue = this._textarea.value.trim();
      if (encodedValue.length > 0) {
        this._onConfirm?.(encodedValue);
      }
      this.close();
    });

    actions.appendChild(cancelButton);
    actions.appendChild(confirmButton);

    this._dialog.appendChild(title);
    this._dialog.appendChild(this._textarea);
    this._dialog.appendChild(actions);

    document.body.appendChild(this._dialog);
  }

  open(onConfirm: (encodedString: string) => void): void {
    this._onConfirm = onConfirm;
    this._textarea.value = '';
    this._dialog.showModal();
  }

  close(): void {
    this._dialog.close();
    this._onConfirm = null;
  }
}
