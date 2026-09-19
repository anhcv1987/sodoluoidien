import type { Drawing } from '../core/types';
import { FILE_VERSION } from '../core/types';

/** Ten file goi y theo ngay lap. */
export function suggestName(title: string, ext: string): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${slug}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.${ext}`;
}

export function download(name: string, content: string | Blob, mime = 'text/plain'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // Neu nguoi dung bam Huy thi khong co su kien change -> khong treo Promise
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(new Error(`Không đọc được file ${file.name}`));
    r.readAsText(file, 'utf-8');
  });
}

/**
 * Doc file DXF voi dung bang ma.
 *
 * DXF do cac phien ban CAD cu (AC1009..AC1018) xuat ra khong phai UTF-8 ma theo
 * bang ma ghi trong bien $DWGCODEPAGE (ANSI_1258 = tieng Viet, ANSI_1252 = Tay Au...).
 * Doc thang bang UTF-8 se lam hong toan bo chu tieng Viet, nen phai do bang ma truoc.
 */
export async function readDxf(file: File): Promise<string> {
  return decodeDxfBuffer(await file.arrayBuffer());
}

/** Giai ma noi dung DXF tu byte theo dung bang ma ghi trong file. */
export function decodeDxfBuffer(buf: ArrayBuffer): string {
  const head = new TextDecoder('windows-1252').decode(buf.slice(0, 4096));

  // AutoCAD 2007 tro len (AC1021+) luon ghi DXF bang UTF-8.
  const ver = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d+)/.exec(head)?.[1] ?? '';
  const verNum = Number(ver.replace('AC', '')) || 0;

  let label = 'utf-8';
  if (verNum && verNum < 1021) {
    const cp = /\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*([A-Za-z0-9_]+)/.exec(head)?.[1] ?? '';
    const m = /ANSI_(\d{3,4})/i.exec(cp);
    if (/utf/i.test(cp)) label = 'utf-8';
    else if (m) label = `windows-${m[1]}`;
    else label = 'windows-1252';
  }
  try {
    // fatal:true de phat hien file khong phai UTF-8 that su.
    return new TextDecoder(label, { fatal: label === 'utf-8' }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

export function serialize(d: Drawing): string {
  return JSON.stringify({ ...d, updatedAt: new Date().toISOString() }, null, 1);
}

/** Doc file ban ve, kiem tra so bo cau truc. */
export function deserialize(text: string): Drawing {
  const d = JSON.parse(text) as Drawing;
  if (typeof d !== 'object' || d === null) throw new Error('File không hợp lệ');
  if (!Array.isArray(d.sheets) || !d.sheets.length) throw new Error('File không có trang bản vẽ nào');
  if (typeof d.version !== 'number') d.version = FILE_VERSION;
  if (d.version > FILE_VERSION) {
    throw new Error(
      `File được tạo bởi phiên bản mới hơn (v${d.version}). Vui lòng cập nhật phần mềm.`,
    );
  }
  if (!d.layers) d.layers = {};
  if (!d.sheets.some((s) => s.id === d.activeSheet)) d.activeSheet = d.sheets[0].id;
  for (const s of d.sheets) if (!s.entities) s.entities = {};
  return d;
}

/* ---------------------- luu tam vao trinh duyet ----------------------- */

const LS_KEY = 'sodoluoidien.autosave.v1';

export function autosave(d: Drawing): boolean {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(d));
    return true;
  } catch {
    // Het dung luong localStorage (ban ve qua lon) - khong pha vo phien lam viec.
    return false;
  }
}

export function loadAutosave(): Drawing | null {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (!s) return null;
    return deserialize(s);
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* khong lam gi */
  }
}

/** Xuat anh PNG tu canvas dang hien thi. */
export function exportPng(canvas: HTMLCanvasElement, name: string): void {
  canvas.toBlob((blob) => {
    if (blob) download(name, blob, 'image/png');
  }, 'image/png');
}
