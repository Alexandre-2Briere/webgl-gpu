import keybindings from '../constants/cameraKeybindings.json';

const KEYS = Object.fromEntries(keybindings.map(b => [b.action, b.key])) as Record<string, string>;

// Converts a KeyboardEvent.code or mouse label into a short display string.
function formatKey(code: string): string {
    if (code.startsWith('Key'))   return code.slice(3);   // KeyW  → W
    if (code.startsWith('Digit')) return code.slice(5);   // Digit1 → 1
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
    if (code === 'MouseLeft')  return 'Mouse L';
    if (code === 'MouseRight') return 'Mouse R';
    return code;
}

export class HelpOverlay {
    private readonly overlay: HTMLElement;
    private visible: boolean = true;

    constructor() {
        // Clone the inert <template> defined in index.html.
        const template = document.getElementById('help-overlay-template') as HTMLTemplateElement;
        const fragment = template.content.cloneNode(true) as DocumentFragment;
        const overlay  = fragment.querySelector('.help-overlay') as HTMLElement;

        // Populate the bindings list.
        const list = overlay.querySelector('.help-list') as HTMLElement;
        for (const binding of keybindings) {
            const row = document.createElement('div');
            row.className = 'help-row';

            const badge = document.createElement('span');
            badge.className   = 'help-badge';
            badge.textContent = formatKey(binding.key);

            const desc = document.createElement('span');
            desc.className   = 'help-desc';
            desc.textContent = binding.description;

            row.appendChild(badge);
            row.appendChild(desc);
            list.appendChild(row);
        }

        // Fill the footer hint.
        const hint = overlay.querySelector('.help-hint') as HTMLElement;
        hint.textContent = `[${formatKey(KEYS['toggleHelp'])}] toggle`;

        // Wire the close button.
        const closeBtn = overlay.querySelector('.help-close') as HTMLButtonElement;
        closeBtn.addEventListener('click', () => this.hide());

        document.body.appendChild(overlay);
        this.overlay = overlay;

        window.addEventListener('keydown', this.handleKeyDown);
    }

    private handleKeyDown = (event: KeyboardEvent): void => {
        if (event.code === KEYS['toggleHelp']) this.toggle();
    };

    private show(): void {
        this.overlay.style.display = 'flex';
        this.visible = true;
    }

    private hide(): void {
        this.overlay.style.display = 'none';
        this.visible = false;
    }

    toggle(): void {
        if (this.visible) this.hide(); else this.show();
    }

    destroy(): void {
        window.removeEventListener('keydown', this.handleKeyDown);
        this.overlay.remove();
    }
}
