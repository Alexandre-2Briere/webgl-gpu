export type RGBA = {
    r: number;
    g: number;
    b: number;
    a: number;
}

export type HexadecimalColor = `#${string}`;

export function hexToRGBA(hex: HexadecimalColor): RGBA {
    if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
        console.error(`Invalid hexadecimal color: ${hex}`);
        return { r: 0, g: 0, b: 0, a: 1 };
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b, a: 1 };
}

export function rgbaToHex({ r, g, b, a }: RGBA): HexadecimalColor {
    const toHex = (value: number) => {
        const hex = value.toString(16).toUpperCase();
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `${rgbToHex({ r, g, b , a})}${toHex(a)}`;
}

export function rgbToHex({ r, g, b }: RGBA): HexadecimalColor {
    const toHex = (value: number) => {
        const hex = value.toString(16).toUpperCase();
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}