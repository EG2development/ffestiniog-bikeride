"""One walking stride as tables over the gait cycle (pure maths, no Blender): the stance feet, the hip's height and the
swinging leg, for gait.py to read per frame.

Where the old cycle hung the hips from the longer leg's full reach, the stance knee stayed locked near straight and the
swinging knee snapped straight in two or three frames as its foot reached forward: robotic. Here the knees follow the
normal walking pattern (Perry; Winter):
- in stance, a little give as the foot takes the weight (about 15 degrees at a seventh of the cycle), then nearly
  straight over mid-stance;
- the hip's height is what the stance legs allow with that bend, smoothed;
- the swinging leg moves in joint space, its knee folding to about 60 degrees early in the swing and opening out again,
  slowing into the next heel strike;
- the swing's ends match the stance's positions and velocities, so nothing jumps where the two meet.
"""
import math

import numpy as np

N = 720  # samples per cycle

# the stance knee's bend (degrees) at fractions of the cycle: contact, loading response, mid-stance, heel off; eased between
STANCE_KNEE = ((0.0, 4.0), (0.14, 16.0), (0.40, 5.0), (0.60, 9.0))
KNEE_MIN = math.radians(2.5)
HEEL_OFF, HEEL_RISE = 0.5, 3.0  # the stance fraction at which the heel leaves the ground, and how it quickens
TOES_UP = 0.55  # the swing fraction by which the foot has come up to the heel strike's angle
CLEARANCE = 0.012  # the least a swinging foot's heel, ball and toes clear the ground by, m
BEARS = 0.42  # the cycle fraction to which a stance leg holds the hips up with the stance knee's bend
ANTICIPATE = 3.0  # how soon a swinging leg starts to bear on the hips' height: metres per cycle squared  # never straighter: the IK's knee stays defined


def smooth(s):
    """0 to 1 with no velocity or acceleration at either end."""
    s = np.clip(s, 0.0, 1.0)
    return s * s * s * (s * (6 * s - 15) + 10)


def hermite(p0, p1, m0, m1, q):
    q2, q3 = q * q, q * q * q
    return (2 * q3 - 3 * q2 + 1) * p0 + (q3 - 2 * q2 + q) * m0 + (-2 * q3 + 3 * q2) * p1 + (q3 - q2) * m1


def reach(a, b, knee):
    """Hip-to-ankle distance of a leg with thigh `a` and shin `b` bent `knee` radians."""
    return np.sqrt(a * a + b * b + 2 * a * b * np.cos(knee))


def bend(a, b, d):
    """The knee bend (radians) that puts the ankle `d` from the hip."""
    c = (d * d - a * a - b * b) / (2 * a * b)
    return np.arccos(np.clip(c, -1.0, 1.0))


def stance_knee(u, give=1.0):
    """The stance knee's bend (radians) at cycle fraction u (0 is heel strike), `give` scaling the loading flexion."""
    pts = [(x, y if i != 1 else 4.0 + (y - 4.0) * give) for i, (x, y) in enumerate(STANCE_KNEE)]
    out = np.full_like(u, pts[-1][1], dtype=np.float64)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        sel = (u >= x0) & (u < x1)
        out[sel] = y0 + (y1 - y0) * smooth((u[sel] - x0) / (x1 - x0))
    return np.radians(out)


def pivot(x, z, off, pitch):
    """The ankle when the foot pitches about a contact point `off` (forward, up) from the flat foot's ankle at (x, z)."""
    c, s = np.cos(-pitch), np.sin(-pitch)
    rx, rz = off[0] * c + off[1] * s, -off[0] * s + off[1] * c
    return x + off[0] - rx, z + off[1] - rz


def softmin(values, r):
    """A minimum with its corners rounded over about `r`, never above the true one (rows: alternatives)."""
    v = np.asarray(values)
    m = v.min(axis=0)
    return m - r * np.log(np.exp(-(v - m) / r).sum(axis=0))


def circular_blur(x, sigma):
    """A periodic Gaussian blur over the cycle (sigma in cycles)."""
    n = len(x)
    k = np.arange(-n // 2, n // 2)
    w = np.exp(-0.5 * (k / (sigma * n)) ** 2)
    w /= w.sum()
    return np.real(np.fft.ifft(np.fft.fft(x) * np.fft.fft(np.fft.ifftshift(w))))


def cycle(g, S, dims, st, pelvis):
    """Tables over one cycle (N samples, u = i / N, the left foot's phase; the right foot is half a cycle on).

    g: the gait's parameters (gait.GAIT); S: stride (m); dims: thigh, shin, ankle_z, ball, heel, hip_w, rest_hip, toe and
    hip_x, the hip joints' rest offset forward of the root (m, scaled); st: the person's style (gait.style: knee_peak,
    push, give); pelvis(u) -> (surge, sway, twist, tilt).
    Returns body (N, 3): the hips' offset (forward, left, up) from rest; foot (N, 5): the left ankle (forward, left, up),
    its pitch (+ toes up) and the toes' bend at the ball (+ up), in root space."""
    u = np.arange(N) / N
    duty = g["duty"]
    a, b, az = dims["thigh"], dims["shin"], dims["ankle_z"]
    ball, heel, hip_w = dims["ball"], dims["heel"], dims["hip_w"]
    hip_x = dims.get("hip_x", 0.0)  # the hip joints' rest offset forward of the root
    strike, toe_off = math.radians(12), math.radians(st.get("push", -45.0))
    foot_y = hip_w * 0.85
    surge, sway, tw, ls = pelvis(u)

    def stance(uu):
        """The stance foot at cycle fractions uu < duty: ankle (x, z) and pitch."""
        s = uu / duty
        x = hip_x + S * (0.25 - uu)  # as far ahead of the hips at its heel strike as the other foot is behind
        p = np.zeros_like(s)
        load = s < 0.15  # the forefoot lowers onto the ground, easing in and out
        p[load] = strike * (1 - smooth(s[load] / 0.15))
        off = s > HEEL_OFF  # the heel rises, pivoting on the ball (the toes stay down), quickening into toe-off
        p[off] = toe_off * ((s[off] - HEEL_OFF) / (1 - HEEL_OFF)) ** HEEL_RISE
        ax, azz = np.array(x, dtype=np.float64), np.full_like(s, az)
        ax[load], azz[load] = pivot(x[load], az, heel, p[load])
        ax[off], azz[off] = pivot(x[off], az, ball, p[off])
        return ax, azz, p

    def hip_joint(side, i):
        sgn = 1 if side == "l" else -1
        return (hip_x + surge[i] + sgn * hip_w * np.cos(ls[i]) * np.sin(tw[i]), sway[i] + sgn * hip_w * np.cos(ls[i]) * np.cos(tw[i]), sgn * hip_w * np.sin(ls[i]))

    # the hips as high as the stance legs allow with the stance knee's bend: lowest in double support, highest over
    # mid-stance (the inverted pendulum), the corners where one leg hands over to the other blurred out
    phases = {"l": u, "r": (u + 0.5) % 1.0}
    allowed, limit = [], []
    for side, uu in phases.items():
        sgn = 1 if side == "l" else -1
        on = uu < duty
        ax, azz, _ = stance(np.where(on, uu, 0.0))
        hx, hy, hz = hip_joint(side, slice(None))
        flat2 = (ax - hx) ** 2 + (sgn * foot_y - hy) ** 2
        for knee, out in ((stance_knee(uu, st.get("give", 1.0)), allowed), (np.full_like(uu, KNEE_MIN), limit)):
            d = reach(a, b, knee)
            z = azz + np.sqrt(np.maximum(d * d - flat2, 1e-6)) - hz
            # a swinging leg already counts as it comes down to its heel strike, as it did leaving the ground: the hips
            # ease down into each step instead of dropping when the foot lands
            # and a leg pushing off bears less and less from mid-stance on (the other has taken the weight): its knee
            # bends as its heel rises
            bear = on & (uu <= BEARS)
            i0, i1 = 0, int(round(BEARS * N))
            if sgn < 0:
                i0, i1 = (i0 + N // 2) % N, (i1 + N // 2) % N
            ahead, behind = 1.0 - uu, uu - BEARS
            free = np.minimum(z[i0] + ANTICIPATE * ahead ** 2, z[i1] + ANTICIPATE * behind ** 2)
            out.append(np.where(bear, z, free) if out is allowed else np.where(on, z, 10.0))
    hip = circular_blur(softmin(allowed, 0.006), 0.01)
    hip = softmin([hip, np.array(limit).min(axis=0) - 0.003], 0.003)  # (only where a leg would straighten fully)
    body = np.column_stack([surge, sway, hip - dims["rest_hip"]])

    # the left foot over the whole cycle: stance from the table, swing in joint space between the stance's ends
    foot = np.zeros((N, 5))
    on = u < duty
    ax, azz, p = stance(np.where(on, u, 0.0))
    foot[on, 0], foot[on, 1], foot[on, 2], foot[on, 3] = ax[on], foot_y, azz[on], p[on]

    def joint_space(uu):
        """(sagittal angle, knee bend, pitch) of the left leg at stance fractions uu (array), with the hips there."""
        i = np.round(np.asarray(uu) * N).astype(int) % N
        sx, sz, sp = stance(np.asarray(uu, dtype=np.float64))
        hx, hy, hz = hip_joint("l", i)
        vx, vy, vz = sx - hx, foot_y - hy, sz - (hip[i] + hz)
        return np.arctan2(vx, -vz), bend(a, b, np.sqrt(vx * vx + vy * vy + vz * vz)), sp

    h = 2.0 / N
    a0, k0, p0 = (v[0] for v in joint_space([duty - 1e-9]))
    a0m, k0m, p0m = (v[0] for v in joint_space([duty - h]))
    a1, k1, p1 = (v[0] for v in joint_space([0.0]))
    a1p, k1p, p1p = (v[0] for v in joint_space([h]))
    span = 1.0 - duty
    sw = ~on
    q = (u[sw] - duty) / span
    da0, dk0, dp0 = (a0 - a0m) / h * span, (k0 - k0m) / h * span, (p0 - p0m) / h * span
    da1, dk1 = (a1p - a1) / h * span, (k1p - k1) / h * span
    alpha = hermite(a0, a1, da0, da1, q)
    base = hermite(k0, k1, dk0, dk1, q)
    bump = q ** 1.5 * (1 - q) ** 2.5
    bump /= bump.max()
    peak = math.radians(st.get("knee_peak", 60.0))
    lo, hi = 0.0, 4.0  # the bump that brings the swing's highest bend to `peak`
    for _ in range(30):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if (base + mid * bump).max() < peak else (lo, mid)
    knee = base + lo * bump
    # the toes come up from toe-off to the heel strike's angle by mid-swing, clear of the ground, then hold
    qp = np.minimum(1.0, q / TOES_UP)
    pitch = np.where(q < TOES_UP, hermite(p0, strike, dp0 * TOES_UP, 0.0, qp), strike)
    hx, hy, hz = hip_joint("l", np.nonzero(sw)[0])
    d = reach(a, b, knee)
    vy = foot_y - hy
    r = np.sqrt(np.maximum(d * d - vy * vy, 1e-6))
    foot[sw, 0] = hx + r * np.sin(alpha)
    foot[sw, 1] = foot_y
    foot[sw, 2] = hip[sw] + hz - r * np.cos(alpha)
    foot[sw, 3] = pitch
    # the toes bend at the ball while the heel is up, and straighten early in the swing
    foot[:, 4] = np.maximum(0.0, -foot[:, 3])
    foot[sw, 4] *= 1 - smooth(q / 0.3)
    # the swinging foot clears the ground by CLEARANCE wherever it would come lower (a short, low stride): lifted
    # more by the hip and knee through the middle of the swing
    def lowest(i):
        z, pt, toe = foot[i, 2], foot[i, 3], foot[i, 4]
        return np.minimum.reduce([z + _rot_z(heel, pt), z + _rot_z(ball, pt), z + _rot_z(ball, pt) + dims["toe"] * np.sin(pt + toe)])
    mid = sw & (u >= duty + 0.15 * span) & (u <= duty + 0.85 * span)
    rise = np.sin(np.pi * q)
    need = (CLEARANCE - lowest(np.nonzero(sw)[0]))[mid[sw]] / rise[mid[sw]]
    foot[sw, 2] += max(0.0, need.max()) * rise
    return body, foot


def _rot_z(off, pitch):
    """The height above the ankle of a point `off` (forward, up) of the foot pitched `pitch` (+ toes up)."""
    return off[0] * np.sin(pitch) + off[1] * np.cos(pitch)


def sample(table, u):
    """A cycle table read at cycle fractions u (periodic, linear between samples)."""
    x = (np.asarray(u) % 1.0) * N
    i = np.floor(x).astype(int)
    f = (x - i)[:, None] if table.ndim == 2 else x - i
    return table[i % N] * (1 - f) + table[(i + 1) % N] * f
