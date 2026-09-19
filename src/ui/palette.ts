import { BLOCKS, blockGroups, type BlockDef } from '../symbols/blocks';
import { primBounds } from '../symbols/prims';
import { el } from './dom';

/** Ve hinh thu nho cua mot block ra SVG de hien trong bang chon thiet bi. */
export function blockThumb(def: BlockDef, size = 34, color = '#e5e9f0'): SVGSVGElement {
  const b = primBounds(def.prims);
  const w = Math.max(0.2, b.maxX - b.minX);
  const h = Math.max(0.2, b.maxY - b.minY);
  const pad = Math.max(w, h) * 0.18 + 0.05;
  const vb = [b.minX - pad, -(b.maxY + pad), w + pad * 2, h + pad * 2];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', vb.map((v) => Math.round(v * 1000) / 1000).join(' '));
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  const sw = Math.max(w, h) * 0.05;
  for (const p of def.prims) {
    let node: SVGElement | null = null;
    if (p.t === 'line' || p.t === 'poly') {
      const d: string[] = [];
      for (let i = 0; i + 1 < p.pts.length; i += 2) {
        d.push(`${i ? 'L' : 'M'}${p.pts[i]} ${-p.pts[i + 1]}`);
      }
      if (p.t === 'poly' && p.close) d.push('Z');
      node = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      node.setAttribute('d', d.join(' '));
      node.setAttribute('fill', p.t === 'poly' && p.fill ? color : 'none');
    } else if (p.t === 'circle') {
      node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      node.setAttribute('cx', String(p.c[0]));
      node.setAttribute('cy', String(-p.c[1]));
      node.setAttribute('r', String(p.r));
      node.setAttribute('fill', p.fill ? color : 'none');
    } else if (p.t === 'arc') {
      const a0 = (p.a0 * Math.PI) / 180;
      const a1 = (p.a1 * Math.PI) / 180;
      const x0 = p.c[0] + p.r * Math.cos(a0);
      const y0 = -(p.c[1] + p.r * Math.sin(a0));
      const x1 = p.c[0] + p.r * Math.cos(a1);
      const y1 = -(p.c[1] + p.r * Math.sin(a1));
      const large = Math.abs(p.a1 - p.a0) > 180 ? 1 : 0;
      node = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      node.setAttribute('d', `M${x0} ${y0} A${p.r} ${p.r} 0 ${large} 0 ${x1} ${y1}`);
      node.setAttribute('fill', 'none');
    } else if (p.t === 'text') {
      node = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      node.setAttribute('x', String(p.p[0]));
      node.setAttribute('y', String(-p.p[1]));
      node.setAttribute('font-size', String(p.h));
      node.setAttribute('fill', color);
      node.textContent = p.s;
    }
    if (node) {
      if (node.tagName !== 'text') {
        node.setAttribute('stroke', color);
        node.setAttribute('stroke-width', String(sw));
        node.setAttribute('stroke-linejoin', 'round');
        node.setAttribute('stroke-linecap', 'round');
      }
      svg.append(node);
    }
  }
  return svg;
}

/** Bang chon thiet bi (thu vien block). */
export function buildPalette(
  current: () => string,
  onPick: (id: string) => void,
): { root: HTMLElement; refresh: () => void } {
  const root = el('div', { class: 'palette' });
  const items: { id: string; node: HTMLElement }[] = [];

  for (const g of blockGroups()) {
    if (!g.blocks.length) continue;
    root.append(el('div', { class: 'palette-group', text: g.group }));
    const grid = el('div', { class: 'palette-grid' });
    for (const b of g.blocks) {
      const cell = el('button', {
        class: 'palette-item',
        type: 'button',
        title: `${b.name}\n${b.source}`,
      });
      cell.append(blockThumb(b, 32));
      cell.append(el('span', { class: 'palette-name', text: b.abbr }));
      cell.addEventListener('click', () => onPick(b.id));
      grid.append(cell);
      items.push({ id: b.id, node: cell });
    }
    root.append(grid);
  }

  const refresh = (): void => {
    const c = current();
    for (const it of items) it.node.classList.toggle('active', it.id === c);
  };
  refresh();
  return { root, refresh };
}

export { BLOCKS };
