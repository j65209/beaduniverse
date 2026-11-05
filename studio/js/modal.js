/* 모달 · 확인창 · 선택창 · 메뉴 */
import { h } from './core.js';

let stack = [];
export const topModal = () => stack[stack.length - 1] || null;

export function openModal({ title, body, footer, cls = '', onClose, dismissable = true }) {
  const root = document.getElementById('modalRoot');
  let api;
  const close = () => {
    if (!el.isConnected) return;
    el.remove();
    stack = stack.filter((m) => m !== api);
    if (onClose) onClose();
  };
  const el = h('div', { class: 'modal-bg' },
    h('div', { class: 'modal ' + cls, role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal-h' },
        h('div', { class: 'modal-t' }, title),
        dismissable ? h('button', { type: 'button', class: 'modal-x', title: '닫기 (Esc)', onclick: () => close() }, '×') : null),
      h('div', { class: 'modal-b' }, body),
      footer ? h('div', { class: 'modal-f' }, footer) : null));
  if (dismissable) el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });
  root.append(el);
  api = { el, close, dismissable };
  stack.push(api);
  return api;
}

export function confirmBox(title, message, { ok = '확인', cancel = '취소', danger = false } = {}) {
  return new Promise((res) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); res(v); };
    const okBtn = h('button', { type: 'button', class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), onclick: () => finish(true) }, ok);
    const m = openModal({
      title, cls: 'modal-sm',
      body: h('p', { class: 'modal-msg' }, message),
      footer: [h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => finish(false) }, cancel), okBtn],
      onClose: () => { if (!done) { done = true; res(false); } },
    });
    setTimeout(() => okBtn.focus(), 30);
  });
}

/** options: [{ v, label, desc, primary }] → 고른 v (닫으면 null) */
export function choiceBox(title, message, options) {
  return new Promise((res) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); res(v); };
    const m = openModal({
      title, cls: 'modal-sm',
      body: [
        message ? h('p', { class: 'modal-msg' }, message) : null,
        h('div', { class: 'choices' }, options.map((o) => h('button', { type: 'button', class: 'choice' + (o.primary ? ' primary' : ''), onclick: () => finish(o.v) },
          h('b', null, o.label), o.desc ? h('span', null, o.desc) : null))),
      ],
      onClose: () => { if (!done) { done = true; res(null); } },
    });
  });
}

let menuEl = null;
/** 열린 메뉴가 있었으면 true */
export function closeMenu() {
  if (!menuEl) return false;
  menuEl.remove();
  menuEl = null;
  document.removeEventListener('pointerdown', menuOutside, true);
  return true;
}
function menuOutside(e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }
/** items: [{ label, onClick, danger, disabled, hint }] 또는 '-' */
export function openMenu(x, y, items, { anchor } = {}) {
  closeMenu();
  const el = h('div', { class: 'menu', role: 'menu' }, items.filter(Boolean).map((it) => {
    if (it === '-') return h('div', { class: 'menu-sep' });
    if (it.node) return it.node;
    return h('button', {
      type: 'button', class: 'menu-it' + (it.danger ? ' danger' : '') + (it.on ? ' on' : ''), disabled: it.disabled || null,
      onclick: () => { closeMenu(); it.onClick && it.onClick(); },
    }, h('span', null, it.label), it.hint ? h('kbd', null, it.hint) : null);
  }));
  document.body.append(el);
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    x = r.right - el.offsetWidth; y = r.bottom + 6;
    if (x < 8) x = r.left;
  }
  const w = el.offsetWidth, hgt = el.offsetHeight;
  x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
  y = Math.max(8, Math.min(y, window.innerHeight - hgt - 8));
  Object.assign(el.style, { left: x + 'px', top: y + 'px' });
  menuEl = el;
  setTimeout(() => document.addEventListener('pointerdown', menuOutside, true), 0);
  return el;
}
