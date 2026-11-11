/* =========================================================================
   내보내기 — PNG/JPG (9:16 · 크기: 사진 원본 화질 / 2배 / 1080×1920) · 여러 장은 ZIP (외부 라이브러리 없이 직접 묶음)
   ========================================================================= */
import { W, H, state, h, toast, sanitizeName, assets, deepClone, clamp } from './core.js';
import { renderPageCanvas, nativeScale } from './render.js';
import { findViolations } from './overlay.js';
import { openModal, confirmBox } from './modal.js';

/* ---------- ZIP (무압축 · UTF-8 파일명) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export async function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const d = new Date();
  const dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  const used = new Set();
  for (const f of files) {
    let name = f.name;
    for (let k = 2; used.has(name); k++) name = f.name.replace(/(\.[a-z0-9]+)$/i, `_${k}$1`);
    used.add(name);
    const data = new Uint8Array(await f.blob.arrayBuffer());
    const nb = enc.encode(name);
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nb.length, true); lh.setUint16(28, 0, true);
    parts.push(lh, nb, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nb.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true);
    ch.setUint32(42, offset, true);
    central.push(ch, nb);
    offset += 30 + nb.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
  end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

/** 클로드 아티팩트 안에서 열렸는지 (그 안에서는 페이지가 직접 다운로드를 못 하고 '저장 확인창'을 거친다) */
export const inClaude = () => !!(window.claude && typeof window.claude.use === 'function');

/** 파일 저장. 저장됐으면 true (아티팩트에서 취소·실패하면 false) */
export async function download(blob, name) {
  if (inClaude()) {
    let dl = null;
    try { dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
    if (!dl) { toast('이 화면에서는 파일 저장을 쓸 수 없어요 — 클로드 앱이나 claude.ai 에서 열어 주세요', 'err', 4200); return false; }
    try {
      await dl.save({ filename: name, data: blob });
      return true;
    } catch (e) {
      const code = e && e.code;
      if (code === 'declined') toast('저장을 취소했어요', 'info', 1600);
      else if (code === 'rate_limited') toast('저장 확인창이 이미 떠 있어요 — 잠시 후 다시 눌러 주세요', 'warn', 3200);
      else if (code === 'rejected_extension' || code === 'extension_not_enabled') toast('이 파일 형식은 여기서 저장할 수 없어요', 'err', 3600);
      else toast('저장하지 못했어요' + (e && e.message ? ` (${e.message})` : ''), 'err', 4200);
      return false;
    }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: name, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 8000);
  return true;
}

const ext = () => (state.prefs.exportFmt === 'png' ? 'png' : 'jpg');
function fileName(pg) {
  const p = state.project;
  const i = p.pages.indexOf(pg);
  return `${sanitizeName(p.name, 30)}_${String(i + 1).padStart(2, '0')}_${sanitizeName(pg.name, 24)}.${ext()}`;
}

/** 저장 크기 — orig: 페이지에서 가장 큰 사진의 해상도 그대로 (최대 MAX_SCALE배) */
export const MAX_SCALE = 4; // 4320 × 7680
export const SIZE_OPTS = [
  { v: 'orig', label: '원본 화질', title: '사진 해상도 그대로 — 사진을 줄이지 않아요 (최대 4320×7680)' },
  { v: '2x', label: '2배', title: '2160 × 3840' },
  { v: '1x', label: '1080×1920', title: '메타 릴스·스토리 권장 최소 크기 (가장 가벼움)' },
];
function exportScale(pg) {
  const k = state.prefs.exportSize || 'orig';
  if (k === '1x') return 1;
  if (k === '2x') return 2;
  return clamp(nativeScale(pg), 1, MAX_SCALE);
}
/** 한 페이지 → { blob, w, h }. 사진은 원본 파일로 그린다 (편집 화면용 작은 사본 X) */
async function pageBlob(pg) {
  const png = state.prefs.exportFmt === 'png';
  await assets.loadMany(pg.layers.filter((l) => l.type === 'image' && !l.hidden).map((l) => l.asset)); // 배율 계산에 사진 크기가 필요
  let s = exportScale(pg);
  try {
    for (;;) {
      const c = await renderPageCanvas(pg, s, { full: true });
      const w = c.width, hh = c.height;
      const b = await new Promise((res) => c.toBlob(res, png ? 'image/png' : 'image/jpeg', png ? undefined : state.prefs.jpgQuality || 0.95));
      c.width = 0; c.height = 0; // 큰 캔버스 메모리 바로 반납
      if (b) return { blob: b, w, h: hh };
      if (s <= 1.001) throw new Error('이미지 만들기 실패');
      s = Math.max(1, s / 1.5); // 브라우저가 못 만들 만큼 크면 줄여서 다시
    }
  } finally {
    assets.releaseFull();
  }
}
const mb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

/** pages: 페이지 객체 배열 */
export async function exportPages(pages, { zip } = {}) {
  if (!pages || !pages.length) return;
  const p = state.project;
  const pl = p.settings.placement;
  const warnV = pages.filter((pg) => findViolations(pg, pl).length);
  const warnE = pages.filter((pg) => pg.layers.some((l) => l.type === 'image' && !l.hidden && !l.asset));
  if (warnV.length || warnE.length) {
    const lines = [];
    if (warnV.length) lines.push(`⚠ 글자가 릴스·스토리 UI에 가려지는 페이지 ${warnV.length}개 (${warnV.slice(0, 6).map((x) => p.pages.indexOf(x) + 1).join(', ')}${warnV.length > 6 ? '…' : ''}번)`);
    if (warnE.length) lines.push(`⚠ 이미지가 비어 있는 페이지 ${warnE.length}개 (${warnE.slice(0, 6).map((x) => p.pages.indexOf(x) + 1).join(', ')}${warnE.length > 6 ? '…' : ''}번)`);
    const ok = await confirmBox('저장 전에 확인', lines.join('\n') + '\n\n그래도 저장할까요?', { ok: '그래도 저장', cancel: '돌아가서 고치기' });
    if (!ok) return;
  }
  const many = pages.length > 1;
  const useZip = inClaude() ? many : (zip ?? many); // 아티팩트에선 저장 확인창이 한 번에 하나라 여러 장은 늘 ZIP
  const bar = h('div', { class: 'prog-bar' }, h('i'));
  const label = h('div', { class: 'prog-l' }, '준비 중…');
  let m = many ? openModal({ title: '내보내는 중', cls: 'modal-sm', body: [label, bar], dismissable: false }) : null;
  try {
    const files = [];
    for (let i = 0; i < pages.length; i++) {
      label.textContent = `${i + 1} / ${pages.length} · ${pages[i].name}`;
      bar.firstChild.style.width = `${Math.round((i / pages.length) * 100)}%`;
      // 렌더 중 문서가 바뀌어도 영향 없게 복사본으로
      const copy = deepClone(pages[i]);
      const out = await pageBlob(copy);
      files.push({ name: fileName(pages[i]), blob: out.blob, w: out.w, h: out.h });
      await new Promise((r) => setTimeout(r, 0));
    }
    bar.firstChild.style.width = '100%';
    let zipBlob = null;
    if (useZip) {
      label.textContent = 'ZIP으로 묶는 중…';
      zipBlob = await makeZip(files);
    }
    if (m) { m.close(); m = null; } // 저장 확인창이 뜨기 전에 진행 창은 닫기
    let saved = true;
    if (zipBlob) saved = await download(zipBlob, `${sanitizeName(p.name, 30)}_${files.length}장_${stamp()}.zip`);
    else for (const f of files) saved = (await download(f.blob, f.name)) && saved;
    if (saved) {
      const sizes = [...new Set(files.map((f) => `${f.w}×${f.h}`))];
      const dims = sizes.length === 1 ? sizes[0] : `${Math.min(...files.map((f) => f.w))}~${Math.max(...files.map((f) => f.w))}px 폭`;
      const total = files.reduce((n, f) => n + f.blob.size, 0);
      toast(`${files.length}장 저장 완료 · ${dims} ${ext().toUpperCase()} · ${mb(total)}${useZip ? ' (ZIP)' : ''}`, 'ok', 3600);
    }
  } catch (e) {
    console.error(e);
    toast('저장 중 문제가 생겼어요: ' + (e.message || e), 'err', 5000);
  } finally {
    if (m) m.close();
  }
}

/* ---------- 프로젝트 파일 (.bbstudio · 아티팩트에선 .bbstudio.json) ---------- */
function blobToDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}
/** data: 주소 → Blob (아티팩트에선 fetch(data:) 가 막혀 있어서 직접 푼다) */
function dataURLToBlob(u) {
  const i = u.indexOf(',');
  const meta = u.slice(5, i);
  const body = u.slice(i + 1);
  const bin = /;base64/i.test(meta) ? atob(body) : decodeURIComponent(body);
  const arr = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
  return new Blob([arr], { type: meta.split(';')[0] || 'application/octet-stream' });
}
export async function exportProjectFile(collectIds, dbGet) {
  const p = state.project;
  const ids = [...collectIds(p)];
  // 사진(원본 파일)이 커도 문자열 하나로 합치지 않고 조각째 Blob 으로 묶는다 (메모리 아끼기)
  const parts = [`{"format":"bb-content-studio","v":1,"exportedAt":${Date.now()},"project":`, JSON.stringify(deepClone(p)), ',"assets":['];
  let n = 0;
  for (const id of ids) {
    const rec = await dbGet('assets', id);
    if (!rec || !rec.blob) continue;
    parts.push((n ? ',' : '') + JSON.stringify({ id, name: rec.name, data: await blobToDataURL(rec.blob) }));
    n++;
  }
  parts.push(']}');
  const blob = new Blob(parts, { type: 'application/json' });
  const ok = await download(blob, `${sanitizeName(p.name, 40)}.bbstudio${inClaude() ? '.json' : ''}`);
  if (ok) toast(`프로젝트 파일 저장 (이미지 ${n}장 원본 포함 · ${mb(blob.size)}) — 다른 컴퓨터에서 '파일 불러오기'로 열 수 있어요`, 'ok', 4200);
}
export async function readProjectFile(file) {
  const text = await file.text();
  const d = JSON.parse(text);
  if (!d || d.format !== 'bb-content-studio' || !d.project) throw new Error('컨텐츠 스튜디오 파일이 아니에요');
  for (const a of d.assets || []) {
    if (assets.get(a.id) && assets.ready(a.id)) continue;
    const blob = dataURLToBlob(a.data);
    await assets.putBlob(a.id, blob, { name: a.name });
  }
  return d.project;
}
