// WGS84 <-> British National Grid by the OS Helmert transform + Transverse
// Mercator (docs/adr/0008-helmert-datum.md, docs/pseudocode-3d.md §1.2).
// Formulas and constants: Ordnance Survey, "A guide to coordinate systems in
// Great Britain", sections 6.2 and C.1–C.2. Horizontal error vs OSTN15: ~±5 m.

const RAD = Math.PI / 180;
const SEC = RAD / 3600;

type Ellipsoid = { a: number; b: number };
const AIRY_1830: Ellipsoid = { a: 6377563.396, b: 6356256.909 };
const WGS84: Ellipsoid = { a: 6378137.0, b: 6356752.314245 };

const F0 = 0.9996012717;
const PHI0 = 49 * RAD;
const LAMBDA0 = -2 * RAD;
const E0 = 400000;
const N0 = -100000;

// WGS84 -> OSGB36; the reverse uses the negated parameters.
const HELMERT = { tx: -446.448, ty: 125.157, tz: -542.06, s: 20.4894e-6, rx: -0.1502 * SEC, ry: -0.247 * SEC, rz: -0.8421 * SEC };

const e2Of = ({ a, b }: Ellipsoid) => (a * a - b * b) / (a * a);

function meridionalArc(phi: number): number {
  const { a, b } = AIRY_1830;
  const n = (a - b) / (a + b);
  const n2 = n * n;
  const n3 = n2 * n;
  const dp = phi - PHI0;
  const sp = phi + PHI0;
  return (
    b *
    F0 *
    ((1 + n + (5 / 4) * n2 + (5 / 4) * n3) * dp -
      (3 * n + 3 * n2 + (21 / 8) * n3) * Math.sin(dp) * Math.cos(sp) +
      ((15 / 8) * n2 + (15 / 8) * n3) * Math.sin(2 * dp) * Math.cos(2 * sp) -
      (35 / 24) * n3 * Math.sin(3 * dp) * Math.cos(3 * sp))
  );
}

function radii(phi: number) {
  const { a } = AIRY_1830;
  const e2 = e2Of(AIRY_1830);
  const s2 = Math.sin(phi) ** 2;
  const nu = (a * F0) / Math.sqrt(1 - e2 * s2);
  const rho = (a * F0 * (1 - e2)) / (1 - e2 * s2) ** 1.5;
  return { nu, rho, eta2: nu / rho - 1 };
}

/** Transverse Mercator on the Airy 1830 ellipsoid: OSGB36 lat/lon (degrees) to grid metres. */
export function tmForward(latDeg: number, lonDeg: number): { e: number; n: number } {
  const phi = latDeg * RAD;
  const dl = lonDeg * RAD - LAMBDA0;
  const { nu, rho, eta2 } = radii(phi);
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const tan2 = Math.tan(phi) ** 2;
  const I = meridionalArc(phi) + N0;
  const II = (nu / 2) * sin * cos;
  const III = (nu / 24) * sin * cos ** 3 * (5 - tan2 + 9 * eta2);
  const IIIA = (nu / 720) * sin * cos ** 5 * (61 - 58 * tan2 + tan2 * tan2);
  const IV = nu * cos;
  const V = (nu / 6) * cos ** 3 * (nu / rho - tan2);
  const VI = (nu / 120) * cos ** 5 * (5 - 18 * tan2 + tan2 * tan2 + 14 * eta2 - 58 * tan2 * eta2);
  return {
    n: I + II * dl ** 2 + III * dl ** 4 + IIIA * dl ** 6,
    e: E0 + IV * dl + V * dl ** 3 + VI * dl ** 5,
  };
}

/** Inverse of tmForward. */
export function tmInverse(e: number, n: number): { lat: number; lon: number } {
  const { a } = AIRY_1830;
  let phi = (n - N0) / (a * F0) + PHI0;
  let m = meridionalArc(phi);
  for (let i = 0; i < 20 && Math.abs(n - N0 - m) >= 1e-5; i++) {
    phi += (n - N0 - m) / (a * F0);
    m = meridionalArc(phi);
  }
  const { nu, rho, eta2 } = radii(phi);
  const t = Math.tan(phi);
  const t2 = t * t;
  const sec = 1 / Math.cos(phi);
  const de = e - E0;
  const VII = t / (2 * rho * nu);
  const VIII = (t / (24 * rho * nu ** 3)) * (5 + 3 * t2 + eta2 - 9 * t2 * eta2);
  const IX = (t / (720 * rho * nu ** 5)) * (61 + 90 * t2 + 45 * t2 * t2);
  const X = sec / nu;
  const XI = (sec / (6 * nu ** 3)) * (nu / rho + 2 * t2);
  const XII = (sec / (120 * nu ** 5)) * (5 + 28 * t2 + 24 * t2 * t2);
  const XIIA = (sec / (5040 * nu ** 7)) * (61 + 662 * t2 + 1320 * t2 * t2 + 720 * t2 * t2 * t2);
  const lat = phi - VII * de ** 2 + VIII * de ** 4 - IX * de ** 6;
  const lon = LAMBDA0 + X * de - XI * de ** 3 + XII * de ** 5 - XIIA * de ** 7;
  return { lat: lat / RAD, lon: lon / RAD };
}

type Xyz = [number, number, number];

function toCartesian(latDeg: number, lonDeg: number, ell: Ellipsoid): Xyz {
  const phi = latDeg * RAD;
  const lambda = lonDeg * RAD;
  const e2 = e2Of(ell);
  const nu = ell.a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  return [nu * Math.cos(phi) * Math.cos(lambda), nu * Math.cos(phi) * Math.sin(lambda), (1 - e2) * nu * Math.sin(phi)];
}

function toGeodetic([x, y, z]: Xyz, ell: Ellipsoid): { lat: number; lon: number } {
  const e2 = e2Of(ell);
  const p = Math.hypot(x, y);
  let phi = Math.atan2(z, p * (1 - e2));
  for (let i = 0; i < 10; i++) {
    const nu = ell.a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const next = Math.atan2(z + e2 * nu * Math.sin(phi), p);
    if (Math.abs(next - phi) < 1e-13) {
      phi = next;
      break;
    }
    phi = next;
  }
  return { lat: phi / RAD, lon: Math.atan2(y, x) / RAD };
}

function helmert([x, y, z]: Xyz, sign: 1 | -1): Xyz {
  const { tx, ty, tz, s, rx, ry, rz } = HELMERT;
  const k = 1 + sign * s;
  return [
    sign * tx + k * x - sign * rz * y + sign * ry * z,
    sign * ty + sign * rz * x + k * y - sign * rx * z,
    sign * tz - sign * ry * x + sign * rx * y + k * z,
  ];
}

export function wgs84ToBng(lon: number, lat: number): { e: number; n: number } {
  const osgb = toGeodetic(helmert(toCartesian(lat, lon, WGS84), 1), AIRY_1830);
  return tmForward(osgb.lat, osgb.lon);
}

export function bngToWgs84(e: number, n: number): { lon: number; lat: number } {
  const osgb = tmInverse(e, n);
  const wgs = toGeodetic(helmert(toCartesian(osgb.lat, osgb.lon, AIRY_1830), -1), WGS84);
  return { lon: wgs.lon, lat: wgs.lat };
}
