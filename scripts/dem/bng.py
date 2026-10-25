"""WGS84 <-> British National Grid: OS Helmert transform + Transverse Mercator.

Mirrors src/three-core/bng.ts (docs/adr/0008-helmert-datum.md); works on numpy
arrays or scalars. Constants: Ordnance Survey, "A guide to coordinate systems
in Great Britain", sections 6.2 and C.1-C.2. Horizontal error vs OSTN15 ~ +/-5 m.

Self-test: python3 scripts/dem/bng.py
"""
import numpy as np

RAD = np.pi / 180
SEC = RAD / 3600
AIRY = (6377563.396, 6356256.909)
WGS84 = (6378137.0, 6356752.314245)
F0, PHI0, LAMBDA0, E0, N0 = 0.9996012717, 49 * RAD, -2 * RAD, 400000.0, -100000.0
HELMERT = dict(tx=-446.448, ty=125.157, tz=-542.06, s=20.4894e-6, rx=-0.1502 * SEC, ry=-0.247 * SEC, rz=-0.8421 * SEC)


def _e2(ell):
    a, b = ell
    return (a * a - b * b) / (a * a)


def _arc(phi):
    a, b = AIRY
    n = (a - b) / (a + b)
    n2, n3 = n * n, n ** 3
    dp, sp = phi - PHI0, phi + PHI0
    return b * F0 * ((1 + n + 1.25 * n2 + 1.25 * n3) * dp
                     - (3 * n + 3 * n2 + 21 / 8 * n3) * np.sin(dp) * np.cos(sp)
                     + (15 / 8 * n2 + 15 / 8 * n3) * np.sin(2 * dp) * np.cos(2 * sp)
                     - 35 / 24 * n3 * np.sin(3 * dp) * np.cos(3 * sp))


def _radii(phi):
    a = AIRY[0]
    e2 = _e2(AIRY)
    s2 = np.sin(phi) ** 2
    nu = a * F0 / np.sqrt(1 - e2 * s2)
    rho = a * F0 * (1 - e2) / (1 - e2 * s2) ** 1.5
    return nu, rho, nu / rho - 1


def tm_forward(lat_deg, lon_deg):
    phi = np.asarray(lat_deg) * RAD
    dl = np.asarray(lon_deg) * RAD - LAMBDA0
    nu, rho, eta2 = _radii(phi)
    s, c, t2 = np.sin(phi), np.cos(phi), np.tan(phi) ** 2
    I = _arc(phi) + N0
    II = nu / 2 * s * c
    III = nu / 24 * s * c ** 3 * (5 - t2 + 9 * eta2)
    IIIA = nu / 720 * s * c ** 5 * (61 - 58 * t2 + t2 * t2)
    IV = nu * c
    V = nu / 6 * c ** 3 * (nu / rho - t2)
    VI = nu / 120 * c ** 5 * (5 - 18 * t2 + t2 * t2 + 14 * eta2 - 58 * t2 * eta2)
    n = I + II * dl ** 2 + III * dl ** 4 + IIIA * dl ** 6
    e = E0 + IV * dl + V * dl ** 3 + VI * dl ** 5
    return e, n


def tm_inverse(e, n):
    e, n = np.asarray(e, dtype=float), np.asarray(n, dtype=float)
    a = AIRY[0]
    phi = (n - N0) / (a * F0) + PHI0
    for _ in range(20):
        m = _arc(phi)
        step = (n - N0 - m) / (a * F0)
        phi = phi + step
        if np.all(np.abs(n - N0 - _arc(phi)) < 1e-5):
            break
    nu, rho, eta2 = _radii(phi)
    t = np.tan(phi)
    t2 = t * t
    sec = 1 / np.cos(phi)
    de = e - E0
    VII = t / (2 * rho * nu)
    VIII = t / (24 * rho * nu ** 3) * (5 + 3 * t2 + eta2 - 9 * t2 * eta2)
    IX = t / (720 * rho * nu ** 5) * (61 + 90 * t2 + 45 * t2 * t2)
    X = sec / nu
    XI = sec / (6 * nu ** 3) * (nu / rho + 2 * t2)
    XII = sec / (120 * nu ** 5) * (5 + 28 * t2 + 24 * t2 * t2)
    XIIA = sec / (5040 * nu ** 7) * (61 + 662 * t2 + 1320 * t2 * t2 + 720 * t2 ** 3)
    lat = phi - VII * de ** 2 + VIII * de ** 4 - IX * de ** 6
    lon = LAMBDA0 + X * de - XI * de ** 3 + XII * de ** 5 - XIIA * de ** 7
    return lat / RAD, lon / RAD


def _cart(lat_deg, lon_deg, ell):
    phi, lam = np.asarray(lat_deg) * RAD, np.asarray(lon_deg) * RAD
    e2 = _e2(ell)
    nu = ell[0] / np.sqrt(1 - e2 * np.sin(phi) ** 2)
    return nu * np.cos(phi) * np.cos(lam), nu * np.cos(phi) * np.sin(lam), (1 - e2) * nu * np.sin(phi)


def _geodetic(x, y, z, ell):
    e2 = _e2(ell)
    p = np.hypot(x, y)
    phi = np.arctan2(z, p * (1 - e2))
    for _ in range(10):
        nu = ell[0] / np.sqrt(1 - e2 * np.sin(phi) ** 2)
        phi = np.arctan2(z + e2 * nu * np.sin(phi), p)
    return phi / RAD, np.arctan2(y, x) / RAD


def _helmert(x, y, z, sign):
    h = HELMERT
    k = 1 + sign * h["s"]
    return (sign * h["tx"] + k * x - sign * h["rz"] * y + sign * h["ry"] * z,
            sign * h["ty"] + sign * h["rz"] * x + k * y - sign * h["rx"] * z,
            sign * h["tz"] - sign * h["ry"] * x + sign * h["rx"] * y + k * z)


def wgs84_to_bng(lon, lat):
    lat_o, lon_o = _geodetic(*_helmert(*_cart(lat, lon, WGS84), 1), AIRY)
    return tm_forward(lat_o, lon_o)


def bng_to_wgs84(e, n):
    lat_o, lon_o = tm_inverse(e, n)
    lat, lon = _geodetic(*_helmert(*_cart(lat_o, lon_o, AIRY), -1), WGS84)
    return lon, lat


if __name__ == "__main__":
    dms = lambda d, m, s: d + m / 60 + s / 3600
    e, n = tm_forward(dms(52, 39, 27.2531), dms(1, 43, 4.5177))
    assert abs(e - 651409.903) < 0.001 and abs(n - 313177.270) < 0.001, (e, n)
    lon, lat = bng_to_wgs84(*wgs84_to_bng(-3.94, 52.94))
    assert abs(lon + 3.94) < 1e-7 and abs(lat - 52.94) < 1e-7, (lon, lat)
    print("bng.py self-test passed: OS worked example", round(float(e), 3), round(float(n), 3))
