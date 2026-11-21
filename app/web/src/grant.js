// Host grants live in this browser only. Losing it means losing host rights for that meeting.
const k = (room) => `iris.grant.${room}`
export const getGrant = (room) => { try { return localStorage.getItem(k(room)) || '' } catch { return '' } }
export const setGrant = (room, g) => { try { localStorage.setItem(k(room), g) } catch { /* private mode */ } }
