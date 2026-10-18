/** Art-directed display profile, not anthropometric or garment-fit parameters.
 * Coordinates are source metres. Applied once to the display head only.
 * The neck junction, scalp, eyes' centres and metric/collision mesh are untouched.
 */
export const PORTRAIT_STYLE_VERSION = 'portrait-style/1.0-soft-athletic';
export const PORTRAIT_STYLE_LIMITS = Object.freeze({maxDisplacementMm: 8, minY: 1.490, maxY: 1.642});
const smooth = t => {t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const bell = (x,c,w) => Math.exp(-(((x-c)/w)**2));

/** Mutates a disposable display Vector3, never a canonical body vertex. */
export function refinePortraitPoint(point, amount = 1) {
  if (![point.x,point.y,point.z,amount].every(Number.isFinite) || amount < 0 || amount > 1)
    throw new RangeError('Perfil visual fuera del intervalo [0, 1]');
  const {x,y,z}=point,ax=Math.abs(x);
  if (!amount || y<=PORTRAIT_STYLE_LIMITS.minY || y>=PORTRAIT_STYLE_LIMITS.maxY) return point;
  const vertical=smooth((y-1.490)/.014)*(1-smooth((y-1.625)/.017));
  const face=smooth((z-.025)/.062),front=smooth((z-.107)/.027);
  const jaw=bell(y,1.531,.044)*face;
  const chin=bell(y,1.502,.012)*bell(x,0,.027)*front;
  const cheek=bell(ax,.047,.019)*bell(y,1.548,.026)*front;
  const nose=bell(y,1.566,.023)*bell(x,0,.018)*smooth((z-.127)/.020);
  const brow=bell(ax,.031,.022)*bell(y,1.605,.007)*front;
  // Positive aperture at the upper lid without shifting or scaling the eyeball.
  const lid=bell(ax,.0315,.012)*bell(y,1.5925,.004)*smooth((z-.127)/.010);
  let dx=(-x*.105*jaw-x*.18*nose+Math.sign(x)*.00045*cheek)*vertical;
  let dy=(.0033*chin+.0009*cheek+.00235*lid)*vertical;
  let dz=(-.0038*brow-.0030*nose+.0031*cheek-.0024*chin)*vertical;
  const length=Math.hypot(dx,dy,dz),limit=PORTRAIT_STYLE_LIMITS.maxDisplacementMm/1000;
  const gain=amount/Math.sqrt(1+(length/limit)**2);
  point.set(x+dx*gain,y+dy*gain,z+dz*gain);
  return point;
}
