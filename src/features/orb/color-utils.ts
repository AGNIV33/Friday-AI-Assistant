export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function lerpC(a: [number,number,number], b: [number,number,number], t: number): [number,number,number] {
  return [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)];
}

export function rgba(c: [number,number,number], a: number) { return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`; }
