/** Tao phan tu DOM ngan gon. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | undefined> = {},
  children: (Node | string | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'text') e.textContent = String(v);
    else if (k === 'html') e.innerHTML = String(v);
    else if (k.startsWith('data-') || k === 'title' || k === 'id') e.setAttribute(k, String(v));
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined) continue;
    e.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

export function button(
  label: string,
  onClick: () => void,
  opts: { title?: string; class?: string } = {},
): HTMLButtonElement {
  const b = el('button', { class: opts.class ?? 'btn', title: opts.title ?? label, type: 'button' }, [label]);
  b.addEventListener('click', onClick);
  return b;
}

export function labeled(label: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), control]);
}

export function select(
  options: { value: string; label: string }[],
  value: string,
  onChange: (v: string) => void,
): HTMLSelectElement {
  const s = el('select', { class: 'input' });
  for (const o of options) {
    const opt = el('option', { value: o.value }, [o.label]);
    if (o.value === value) opt.selected = true;
    s.append(opt);
  }
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

export function input(
  value: string,
  onChange: (v: string) => void,
  opts: { type?: string; step?: string; placeholder?: string; list?: string } = {},
): HTMLInputElement {
  const i = el('input', {
    class: 'input',
    type: opts.type ?? 'text',
    value,
    step: opts.step,
    placeholder: opts.placeholder,
    list: opts.list,
  });
  i.value = value;
  i.addEventListener('change', () => onChange(i.value));
  return i;
}

export function checkbox(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const i = el('input', { type: 'checkbox' });
  i.checked = checked;
  i.addEventListener('change', () => onChange(i.checked));
  return el('label', { class: 'check' }, [i, el('span', { text: label })]);
}

/** Hop thoai don gian (modal). */
export function dialog(title: string, body: HTMLElement, actions: HTMLElement[]): () => void {
  const overlay = el('div', { class: 'overlay' });
  const box = el('div', { class: 'dialog' }, [
    el('div', { class: 'dialog-title', text: title }),
    el('div', { class: 'dialog-body' }, [body]),
    el('div', { class: 'dialog-actions' }, actions),
  ]);
  overlay.append(box);
  document.body.append(overlay);
  const close = (): void => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  return close;
}

export function toast(msg: string, kind: 'info' | 'warn' | 'error' = 'info'): void {
  const t = el('div', { class: `toast toast-${kind}`, text: msg });
  document.body.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, kind === 'error' ? 6000 : 3200);
}
