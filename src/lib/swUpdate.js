/**
 * Tiny pub-sub for the Workbox SW update lifecycle. main.jsx pushes
 * controller state into here; React components subscribe to it.
 */

let state = { needsRefresh: false, offlineReady: false, update: null };
const listeners = new Set();

export function setSWUpdateController(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export function getSWUpdateState() {
  return state;
}

export function onSWUpdate(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}
