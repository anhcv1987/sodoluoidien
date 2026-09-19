import type { DocStore } from '../core/doc';
import type { Entity, Id, Pt, SubstationEntity } from '../core/types';
import { project } from '../data/geo';

/**
 * Giãn các khối trạm bị chồng lên nhau.
 *
 * Trên sơ đồ tỉnh, nhiều trạm nằm rất gần nhau ngoài thực địa (KCN Yên Bình,
 * khu Lưu Xá - Gang Thép...), nên khi đặt đúng toạ độ địa lý thì các khối trạm
 * che nhau. Hàm này đẩy các khối ra vừa đủ để không chồng nhau, đồng thời vẫn
 * kéo từng trạm về gần vị trí địa lý gốc -> sơ đồ đọc được mà vị trí vẫn "gần đúng".
 *
 * Các nút đầu/cuối đường dây gắn với trạm (node.substationId) được dời theo.
 */
export function declutterSubstations(store: DocStore, iterations = 400, maxShiftKm = 7): number {
  const subs = store.entities.filter((e): e is SubstationEntity => e.kind === 'substation');
  if (subs.length < 2) return 0;

  const home = new Map<Id, Pt>();
  const pos = new Map<Id, Pt>();
  for (const s of subs) {
    home.set(s.id, { ...s.p });
    pos.set(s.id, { ...s.p });
  }

  const gap = 0.6; // khoang ho toi thieu giua hai khoi (km)
  for (let it = 0; it < iterations; it++) {
    let moved = 0;
    for (let i = 0; i < subs.length; i++) {
      for (let j = i + 1; j < subs.length; j++) {
        const a = subs[i];
        const b = subs[j];
        const pa = pos.get(a.id)!;
        const pb = pos.get(b.id)!;
        const needX = (a.w + b.w) / 2 + gap;
        const needY = (a.h + b.h) / 2 + gap;
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const ovX = needX - Math.abs(dx);
        const ovY = needY - Math.abs(dy);
        if (ovX <= 0 || ovY <= 0) continue;
        // Đẩy theo phương chồng ít hơn để hình dạng tổng thể ít bị méo.
        if (ovX < ovY) {
          const push = (ovX / 2) * 0.6 * (dx >= 0 || dx !== 0 ? Math.sign(dx) || 1 : 1);
          pa.x -= push;
          pb.x += push;
        } else {
          const push = (ovY / 2) * 0.6 * (Math.sign(dy) || 1);
          pa.y -= push;
          pb.y += push;
        }
        moved++;
      }
    }
    // Khong keo dan ve goc (se trietieu luc day), ma GIOI HAN do lech toi da so
    // voi vi tri dia ly that -> so do van "gan dung vi tri".
    for (const s of subs) {
      const p = pos.get(s.id)!;
      const h = home.get(s.id)!;
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      const d = Math.hypot(dx, dy);
      if (d > maxShiftKm) {
        p.x = h.x + (dx / d) * maxShiftKm;
        p.y = h.y + (dy / d) * maxShiftKm;
      }
    }
    if (!moved) break;
  }

  let changed = 0;
  store.transact('Giãn các trạm chồng lấn', () => {
    for (const s of subs) {
      const p = pos.get(s.id)!;
      const h = home.get(s.id)!;
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) continue;
      changed++;
      store.update(s.id, (e: Entity) => {
        if (e.kind === 'substation') {
          e.p.x += dx;
          e.p.y += dy;
        }
      });
      for (const n of store.entities) {
        if (n.kind === 'node' && n.substationId === s.id) {
          store.update(n.id, (e: Entity) => {
            if (e.kind === 'node') {
              e.p.x += dx;
              e.p.y += dy;
            }
          });
        }
      }
    }
  });
  return changed;
}

/** Đưa toàn bộ trạm về đúng toạ độ địa lý đã khai báo (huỷ kết quả giãn). */
export function resetSubstationsToGeo(store: DocStore): number {
  const subs = store.entities.filter((e): e is SubstationEntity => e.kind === 'substation');
  let n = 0;
  store.transact('Đưa trạm về đúng toạ độ địa lý', () => {
    for (const s of subs) {
      if (s.lat === undefined || s.lon === undefined) continue;
      const target = project(s.lat, s.lon);
      const dx = target.x - s.p.x;
      const dy = target.y - s.p.y;
      if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) continue;
      n++;
      store.update(s.id, (e: Entity) => {
        if (e.kind === 'substation') e.p = target;
      });
      for (const node of store.entities) {
        if (node.kind === 'node' && node.substationId === s.id) {
          store.update(node.id, (e: Entity) => {
            if (e.kind === 'node') {
              e.p.x += dx;
              e.p.y += dy;
            }
          });
        }
      }
    }
  });
  return n;
}
