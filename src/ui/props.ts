import type { Editor } from '../editor/editor';
import type { Entity, LineKind, VoltageKv } from '../core/types';
import { allStyles } from '../core/voltage';
import { MA_DAY, tietDienTuMa } from '../data/grid110';
import { getBlock } from '../symbols/blocks';
import { unproject, project, formatLatLon } from '../data/geo';
import { branchPoints } from '../render/shapes';
import { polylineLength } from '../core/geom';
import { checkbox, el, input, labeled, select } from './dom';

const LINE_KINDS: LineKind[] = ['ĐDK', 'Cáp ngầm', 'Cáp vặn xoắn', 'Thanh cái'];

/** Danh sach ma day dan de goi y (datalist dung chung). */
export function conductorDatalist(): HTMLDataListElement {
  const dl = el('datalist', { id: 'ma-day' });
  for (const list of Object.values(MA_DAY)) {
    for (const code of list) dl.append(el('option', { value: code }));
  }
  return dl as HTMLDataListElement;
}

const kvOptions = (): { value: string; label: string }[] =>
  allStyles().map((s) => ({ value: String(s.kv), label: s.name }));

/** Ve bang thuoc tinh cho doi tuong dang chon. */
export function buildProps(ed: Editor, sel: Entity[]): HTMLElement {
  const root = el('div', { class: 'props' });
  if (!sel.length) {
    root.append(
      el('p', {
        class: 'muted',
        text: 'Chưa chọn đối tượng nào. Bấm vào một đối tượng trên bản vẽ để xem và sửa thuộc tính.',
      }),
    );
    return root;
  }

  if (sel.length > 1) {
    root.append(el('div', { class: 'props-title', text: `Đang chọn ${sel.length} đối tượng` }));
    root.append(
      labeled(
        'Cấp điện áp (áp dụng cho tất cả)',
        select(kvOptions(), String(sel[0].kv), (v) => {
          const kv = Number(v) as VoltageKv;
          ed.store.transact('Đổi cấp điện áp', () => {
            for (const e of sel) {
              ed.store.update(e.id, (x: Entity) => {
                x.kv = kv;
                x.layer = allStyles().find((s) => s.kv === kv)?.layer ?? x.layer;
              });
            }
          });
          ed.events.onSelection?.(ed.selectedEntities());
        }),
      ),
    );
    const row = el('div', { class: 'row' });
    for (const deg of [90, 180, 270]) {
      const b = el('button', { class: 'btn', type: 'button', text: `Quay ${deg}°` });
      b.addEventListener('click', () => ed.rotateSelection(deg));
      row.append(b);
    }
    root.append(row);
    return root;
  }

  const e = sel[0];
  const upd = (fn: (x: Entity) => void, label = 'Sửa thuộc tính'): void => {
    ed.store.transact(label, () => ed.store.update(e.id, fn));
    ed.events.onSelection?.(ed.selectedEntities());
    ed.requestDraw();
  };

  const kindName: Record<Entity['kind'], string> = {
    node: 'Nút',
    branch: 'Tuyến / đường dây',
    device: 'Thiết bị',
    substation: 'Trạm biến áp',
    text: 'Ghi chú',
    boundary: 'Nền bản đồ',
    circle: 'Hình tròn',
  };
  root.append(el('div', { class: 'props-title', text: kindName[e.kind] }));

  root.append(
    labeled(
      'Cấp điện áp',
      select(kvOptions(), String(e.kv), (v) => {
        const kv = Number(v) as VoltageKv;
        upd((x) => {
          x.kv = kv;
          x.layer = allStyles().find((s) => s.kv === kv)?.layer ?? x.layer;
        }, 'Đổi cấp điện áp');
      }),
    ),
  );
  root.append(
    labeled(
      'Lớp',
      select(
        Object.keys(ed.store.drawing.layers).map((n) => ({ value: n, label: n })),
        e.layer,
        (v) => upd((x) => void (x.layer = v), 'Đổi lớp'),
      ),
    ),
  );

  /* --------------------------- duong day --------------------------- */
  if (e.kind === 'branch') {
    const pts = branchPoints(ed.store, e);
    const hinh = polylineLength(pts);
    root.append(
      labeled('Tên tuyến / lộ', input(e.label ?? '', (v) => upd((x) => void ((x as typeof e).label = v || undefined), 'Đổi tên tuyến'), { placeholder: 'VD: 471 E6.5' })),
    );
    root.append(
      labeled(
        'Loại',
        select(
          LINE_KINDS.map((k) => ({ value: k, label: k })),
          e.lineKind,
          (v) => upd((x) => void ((x as typeof e).lineKind = v as LineKind), 'Đổi loại tuyến'),
        ),
      ),
    );
    root.append(
      labeled(
        'Mã hiệu dây / cáp',
        input(
          e.conductor?.code ?? '',
          (v) =>
            upd((x) => {
              const b = x as typeof e;
              b.conductor = v ? { ...(b.conductor ?? {}), code: v, section: tietDienTuMa(v) } : undefined;
            }, 'Đổi mã hiệu dây'),
          { list: 'ma-day', placeholder: 'VD: AC-120 hoặc Cu/XLPE/PVC 3x240' },
        ),
      ),
    );
    root.append(
      labeled(
        'Số mạch',
        input(String(e.conductor?.circuits ?? 1), (v) =>
          upd((x) => {
            const b = x as typeof e;
            b.conductor = { ...(b.conductor ?? { code: '' }), circuits: Math.max(1, Number(v) || 1) };
          }, 'Đổi số mạch'),
        { type: 'number', step: '1' },
        ),
      ),
    );
    root.append(
      labeled(
        'Chiều dài (km)',
        input(String(e.lengthKm ?? Math.round(hinh * 1000) / 1000), (v) =>
          upd((x) => void ((x as typeof e).lengthKm = Number(v) || undefined), 'Đổi chiều dài'),
        { type: 'number', step: '0.01' },
        ),
      ),
    );
    root.append(
      el('p', { class: 'muted small', text: `Chiều dài theo hình vẽ: ${hinh.toFixed(3)} km — số đỉnh: ${pts.length}` }),
    );
  }

  /* ---------------------------- thiet bi --------------------------- */
  if (e.kind === 'device') {
    const def = getBlock(e.block);
    root.append(el('p', { class: 'muted small', text: `Ký hiệu: ${def?.name ?? e.block} — ${def?.source ?? ''}` }));
    root.append(
      labeled('Tên / số hiệu', input(e.label ?? '', (v) => upd((x) => void ((x as typeof e).label = v || undefined), 'Đổi tên thiết bị'), { placeholder: 'VD: 131, 471-7, REC Đán 1' })),
    );
    if (def?.switching) {
      root.append(
        labeled(
          'Trạng thái',
          select(
            [
              { value: 'dong', label: 'Đóng' },
              { value: 'mo', label: 'Mở / Cắt' },
              { value: 'khong-xac-dinh', label: 'Không xác định' },
            ],
            e.state ?? 'dong',
            (v) => upd((x) => void ((x as typeof e).state = v as typeof e.state), 'Đổi trạng thái'),
          ),
        ),
      );
    }
    root.append(
      labeled('Góc quay (độ)', input(String(Math.round(e.rot)), (v) => upd((x) => void ((x as typeof e).rot = Number(v) || 0), 'Quay thiết bị'), { type: 'number', step: '15' })),
    );
    root.append(
      labeled('Cỡ ký hiệu', input(String(e.scale), (v) => upd((x) => void ((x as typeof e).scale = Math.max(0.05, Number(v) || 1)), 'Đổi cỡ'), { type: 'number', step: '0.1' })),
    );
  }

  /* ------------------------------ tram ----------------------------- */
  if (e.kind === 'substation') {
    root.append(labeled('Mã trạm', input(e.code, (v) => upd((x) => void ((x as typeof e).code = v), 'Đổi mã trạm'), { placeholder: 'VD: E6.5' })));
    root.append(labeled('Tên trạm', input(e.name, (v) => upd((x) => void ((x as typeof e).name = v), 'Đổi tên trạm'))));
    root.append(labeled('Khu vực / xã phường', input(e.commune ?? '', (v) => upd((x) => void ((x as typeof e).commune = v || undefined), 'Đổi khu vực'))));
    const ll = unproject(e.p);
    root.append(
      labeled('Vĩ độ (B)', input(String(Math.round((e.lat ?? ll.lat) * 1e5) / 1e5), (v) => {
        const lat = Number(v);
        if (!Number.isFinite(lat)) return;
        const p = project(lat, e.lon ?? ll.lon);
        upd((x) => {
          const s = x as typeof e;
          s.lat = lat;
          s.p = p;
        }, 'Đặt lại toạ độ trạm');
      }, { type: 'number', step: '0.0001' })),
    );
    root.append(
      labeled('Kinh độ (Đ)', input(String(Math.round((e.lon ?? ll.lon) * 1e5) / 1e5), (v) => {
        const lon = Number(v);
        if (!Number.isFinite(lon)) return;
        const p = project(e.lat ?? ll.lat, lon);
        upd((x) => {
          const s = x as typeof e;
          s.lon = lon;
          s.p = p;
        }, 'Đặt lại toạ độ trạm');
      }, { type: 'number', step: '0.0001' })),
    );
    root.append(el('p', { class: 'muted small', text: formatLatLon(e.lat ?? ll.lat, e.lon ?? ll.lon) }));
    root.append(
      labeled('Máy biến áp', input(e.transformers.map((t) => `${t.name} ${t.capacity}`).join(', '), (v) => {
        const list = v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s, i) => {
            const m = s.match(/^(\S+)\s+(.*)$/);
            return { name: m?.[1] ?? `T${i + 1}`, capacity: m?.[2] ?? s, ratio: e.levels.join('/') + ' kV' };
          });
        upd((x) => void ((x as typeof e).transformers = list), 'Sửa danh sách MBA');
      }, { placeholder: 'VD: T1 40 MVA, T2 40 MVA' })),
    );
    const row = el('div', { class: 'row' });
    row.append(
      labeled('Rộng', input(String(e.w), (v) => upd((x) => void ((x as typeof e).w = Math.max(0.5, Number(v) || 6)), 'Đổi kích thước'), { type: 'number', step: '0.5' })),
    );
    row.append(
      labeled('Cao', input(String(e.h), (v) => upd((x) => void ((x as typeof e).h = Math.max(0.5, Number(v) || 4)), 'Đổi kích thước'), { type: 'number', step: '0.5' })),
    );
    root.append(row);
  }

  /* ------------------------------ chu ------------------------------ */
  if (e.kind === 'text') {
    const ta = el('textarea', { class: 'input', rows: 3 });
    ta.value = e.text;
    ta.addEventListener('change', () => upd((x) => void ((x as typeof e).text = ta.value), 'Sửa ghi chú'));
    root.append(labeled('Nội dung', ta));
    root.append(labeled('Chiều cao chữ', input(String(e.height), (v) => upd((x) => void ((x as typeof e).height = Math.max(0.05, Number(v) || 1)), 'Đổi cỡ chữ'), { type: 'number', step: '0.1' })));
    root.append(
      labeled(
        'Căn lề',
        select(
          [
            { value: 'left', label: 'Trái' },
            { value: 'center', label: 'Giữa' },
            { value: 'right', label: 'Phải' },
          ],
          e.align,
          (v) => upd((x) => void ((x as typeof e).align = v as typeof e.align), 'Đổi căn lề'),
        ),
      ),
    );
    root.append(labeled('Góc quay (độ)', input(String(e.rot), (v) => upd((x) => void ((x as typeof e).rot = Number(v) || 0), 'Quay chữ'), { type: 'number', step: '15' })));
  }

  /* ---------------------------- hinh tron -------------------------- */
  if (e.kind === 'circle') {
    root.append(
      labeled('Bán kính', input(String(e.r), (v) => upd((x) => void ((x as typeof e).r = Math.max(0.001, Number(v) || 1)), 'Đổi bán kính'), { type: 'number', step: '0.1' })),
    );
    root.append(checkbox('Tô đặc', !!e.filled, (v) => upd((x) => void ((x as typeof e).filled = v || undefined), 'Đổi kiểu tô')));
  }

  /* ----------------------------- ghi chu --------------------------- */
  const noteBox = el('textarea', { class: 'input', rows: 2, placeholder: 'Ghi chú tự do…' });
  noteBox.value = e.note ?? '';
  noteBox.addEventListener('change', () => upd((x) => void (x.note = noteBox.value || undefined), 'Sửa ghi chú'));
  root.append(labeled('Ghi chú', noteBox));

  if (e.note?.includes('rà soát')) {
    root.append(
      el('p', {
        class: 'warn small',
        text: '⚠ Dữ liệu sơ bộ do phần mềm tạo sẵn — đề nghị đối chiếu với hồ sơ quản lý vận hành rồi xoá dòng ghi chú này.',
      }),
    );
  }

  const del = el('button', { class: 'btn danger', type: 'button', text: 'Xoá đối tượng' });
  del.addEventListener('click', () => ed.deleteSelection());
  root.append(del);
  return root;
}

/** Bang danh sach cac lop. */
export function buildLayers(ed: Editor, onChange: () => void): HTMLElement {
  const root = el('div', { class: 'layers' });
  const names = Object.keys(ed.store.drawing.layers).sort();
  for (const name of names) {
    const l = ed.store.drawing.layers[name];
    const row = el('div', { class: 'layer-row' });
    row.append(
      checkbox('', l.visible, (v) => {
        ed.store.setLayerVisible(name, v);
        onChange();
      }),
    );
    const sw = el('span', { class: 'swatch' });
    sw.style.background = l.color ?? '#888';
    row.append(sw);
    row.append(el('span', { class: 'layer-name', text: name }));
    const lock = el('button', {
      class: 'icon-btn',
      type: 'button',
      title: l.locked ? 'Đang khoá - bấm để mở khoá' : 'Khoá lớp',
      text: l.locked ? '🔒' : '🔓',
    });
    lock.addEventListener('click', () => {
      ed.store.setLayerLocked(name, !l.locked);
      onChange();
    });
    row.append(lock);
    root.append(row);
  }
  return root;
}
