function formatCAD(value: number): string {
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        maximumFractionDigits: 0,
    }).format(value);
}

export function resolveTimingCard(id: string, text: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.remove('pending');
}

export function pendingCard(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '—';
    el.classList.add('pending');
}

export interface TableData {
    nameplates: string[];
    prices: Float32Array;
    rebates: Float32Array;
    displayCount: number;
    totalCount: number;
    tbodyId: string;
    noteId: string;
    /** If provided, use these indices into the data arrays instead of 0..displayCount-1. */
    rowIndices?: number[];
    /** Formatter for the rebate column. Defaults to CAD currency. */
    formatRebate?: (v: number) => string;
}

export interface StringTableData {
    originals: string[];
    processed: string[];
    displayCount: number;
    totalCount: number;
    tbodyId: string;
    noteId: string;
}

export function populateStringTable(data: StringTableData): void {
    const { originals, processed, displayCount, totalCount, tbodyId, noteId } = data;

    const tbody  = document.getElementById(tbodyId)!;
    const noteEl = document.getElementById(noteId);
    tbody.innerHTML = '';
    if (noteEl) noteEl.textContent = '';

    const template = document.getElementById('string-row-template') as HTMLTemplateElement;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < displayCount; i++) {
        const clone = template.content.cloneNode(true) as DocumentFragment;
        (clone.querySelector('.col-index')     as HTMLElement).textContent = String(i + 1);
        (clone.querySelector('.col-original')  as HTMLElement).textContent = originals[i];
        (clone.querySelector('.processed-val') as HTMLElement).textContent = processed[i];
        fragment.appendChild(clone);
    }

    tbody.appendChild(fragment);

    if (totalCount > displayCount && noteEl) {
        noteEl.textContent =
            `Showing ${displayCount} of ${totalCount.toLocaleString('en-CA')} entries` +
            ` — all ${totalCount.toLocaleString('en-CA')} were processed.`;
    }
}

export function populateTable(data: TableData): void {
    const { nameplates, prices, rebates, displayCount, totalCount,
            tbodyId, noteId, rowIndices, formatRebate } = data;
    const fmtRebate = formatRebate ?? formatCAD;

    const tbody  = document.getElementById(tbodyId)!;
    const noteEl = document.getElementById(noteId);
    tbody.innerHTML = '';
    if (noteEl) noteEl.textContent = '';

    const template = document.getElementById('row-template') as HTMLTemplateElement;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < displayCount; i++) {
        const idx   = rowIndices ? rowIndices[i] : i;
        const clone = template.content.cloneNode(true) as DocumentFragment;

        (clone.querySelector('.col-index')     as HTMLElement).textContent = String(i + 1);
        (clone.querySelector('.col-nameplate') as HTMLElement).textContent = nameplates[idx];
        (clone.querySelector('.col-price')     as HTMLElement).textContent = formatCAD(prices[idx]);
        (clone.querySelector('.rebate-val')    as HTMLElement).textContent = fmtRebate(rebates[idx]);

        fragment.appendChild(clone);
    }

    tbody.appendChild(fragment);

    if (totalCount > displayCount && noteEl) {
        noteEl.textContent =
            `Showing ${displayCount} of ${totalCount.toLocaleString('en-CA')} entries` +
            ` — all ${totalCount.toLocaleString('en-CA')} were processed.`;
    }
}
