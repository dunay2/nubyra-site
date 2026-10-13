/**
 * Composición gráfica de la camiseta. Unidades: px de un lienzo 1024 x 1536.
 * Los tamaños en px no son cotas físicas de impresión: el patrón real mandará.
 */
export const DESIGN_SIZE = Object.freeze({ width: 1024, height: 1536 });
export const VIEW_ZONES = Object.freeze({
  front: Object.freeze({
    brand: { x: 278, y: 307, width: 124, height: 100 },
    crest: { x: 630, y: 307, width: 126, height: 112 },
    team: { x: 254, y: 482, width: 516, height: 112 },
    sponsor: { x: 260, y: 633, width: 504, height: 112 },
    number: { x: 310, y: 819, width: 404, height: 350 }
  }),
  back: Object.freeze({
    brand: { x: 405, y: 278, width: 214, height: 96 },
    sponsorTop: { x: 275, y: 426, width: 474, height: 108 },
    surname: { x: 274, y: 593, width: 476, height: 120 },
    number: { x: 305, y: 789, width: 414, height: 380 },
    sponsorBottom: { x: 306, y: 1265, width: 412, height: 96 }
  })
});

export const PRESETS = Object.freeze({
  oceano: { label: 'Océano', base: '#102d50', accent: '#f8c12e', trim: '#f9f3e7', text: '#ffffff' },
  canaria: { label: 'Canaria', base: '#ffd028', accent: '#123a63', trim: '#f5f8ff', text: '#102d50' },
  lava: { label: 'Lava', base: '#101216', accent: '#f26924', trim: '#fbe5c6', text: '#ffffff' },
  brisa: { label: 'Brisa', base: '#eef4f7', accent: '#1580bd', trim: '#071d33', text: '#071d33' }
});

export const DEFAULT_STATE = Object.freeze({
  team: 'NUBYRA CANARIAS', surname: 'PÉREZ', number: '12',
  sponsorFront: 'PATROCINADOR A', sponsorTop: 'PATROCINADOR B',
  sponsorBottom: '', crest: null, crestName: '', ...PRESETS.oceano
});

export function normalizeText(value, max = 40) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function normalizeNumber(value) {
  const number = String(value ?? '').replace(/\D/g, '').slice(0, 2);
  if (number === '' || number === '00' || number === '0') return number;
  if (/^0[1-9]$/.test(number)) return String(Number(number));
  const int = Number(number);
  return int <= 99 && int >= 1 ? String(int) : '';
}

export function validNumber(value) {
  return /^(?:0|00|[1-9][0-9]?)$/.test(String(value ?? ''));
}

export function hexColor(value, fallback = '#102d50') {
  return /^#[\da-f]{6}$/i.test(String(value)) ? String(value).toLowerCase() : fallback;
}

/** Fitting basado en métricas reales de Canvas; sin transform scaleX ni desbordamientos. */
export function fitText(ctx, value, box, options = {}) {
  const text = normalizeText(value, options.maxLength ?? 44).toLocaleUpperCase('es-ES');
  if (!text) return { text: '', fit: true, fontSize: 0, tracking: 0 };
  const min = options.minFont ?? 27;
  const max = options.maxFont ?? 68;
  const weight = options.weight ?? 800;
  const family = options.family ?? 'Arial, sans-serif';
  const margin = options.margin ?? 14;
  const allowedWidth = Math.max(0, box.width - 2 * margin);
  const allowedHeight = Math.max(0, box.height - 2 * margin);
  for (let size = Math.min(max, Math.floor(allowedHeight * 0.84)); size >= min; size -= 1) {
    ctx.font = `${weight} ${size}px ${family}`;
    const tracking = Math.min(options.maxTracking ?? 0.8, size * 0.016);
    const width = ctx.measureText(text).width + Math.max(0, text.length - 1) * tracking;
    if (width <= allowedWidth) return { text, fit: true, fontSize: size, tracking };
  }
  return { text, fit: false, fontSize: min, tracking: 0,
    reason: 'Texto excesivo para la zona; acórtalo o revisa la composición' };
}

export function rectsOverlap(a, b, distance = 0) {
  return a.x < b.x + b.width + distance && a.x + a.width + distance > b.x &&
    a.y < b.y + b.height + distance && a.y + a.height + distance > b.y;
}

export function getCollisionWarnings(view = 'front', gap = 18) {
  const zones = VIEW_ZONES[view];
  if (!zones) throw new Error('Vista no reconocida');
  const pairs = Object.entries(zones), warnings = [];
  for (let i = 0; i < pairs.length; i += 1) {
    for (let j = i + 1; j < pairs.length; j += 1) {
      if (rectsOverlap(pairs[i][1], pairs[j][1], gap)) warnings.push(`${pairs[i][0]} / ${pairs[j][0]}`);
    }
  }
  return warnings;
}

export function profileInfo(profile = 'FCB_BASE_2026_27') {
  if (profile === 'FCB_BASE_2026_27') return {
    label: 'FCB · baloncesto femenino de formación · 2026/27',
    minimumFrontCm: 8, minimumBackCm: 16, advertisingToNumberCm: 4,
    maxSponsorArea: null, verifiedPrintScale: false
  };
  return { label: 'Perfil pendiente de verificar', verifiedPrintScale: false };
}

export function serializeProposal(state) {
  return {
    schema: 'nubyra.graphic-3d-proposal/0.2', status: 'draft-not-manufacturing-approved',
    profile: 'FCB_BASE_2026_27', colors: { base: state.base, accent: state.accent, trim: state.trim, text: state.text },
    team: normalizeText(state.team), surname: normalizeText(state.surname), number: normalizeNumber(state.number),
    sponsors: { front: normalizeText(state.sponsorFront), top: normalizeText(state.sponsorTop), bottom: normalizeText(state.sponsorBottom) },
    crestFileName: state.crestName || null, containsCrestImage: false,
    manufacturingApproved: false,
    note: 'Visualización conceptual. Ninguna superficie de marcaje equivale a una cota real de fabricación. El archivo JSON no contiene imágenes; no se han enviado datos a un servidor.'
  };
}
