// The close button's X for menus (menu.ts).

// The close button's X: two thick strokes with square ends and a soft drop
// shadow, drawn smooth on a canvas (crisp at any screen density) in `color`.
export function closeCross(size: number, color: string, shadow: string): HTMLCanvasElement {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(size * ratio);
  canvas.style.width = canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const s = canvas.width;
  const inset = s * 0.24;
  const draw = (offset: number, stroke: string) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = s * 0.17;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(inset, inset + offset);
    ctx.lineTo(s - inset, s - inset + offset);
    ctx.moveTo(s - inset, inset + offset);
    ctx.lineTo(inset, s - inset + offset);
    ctx.stroke();
  };
  draw(s * 0.06, shadow);
  draw(0, color);
  return canvas;
}
