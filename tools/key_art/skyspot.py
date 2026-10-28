"""find the open-sky spot (upper part) that fits the largest moon box; prints moon_at fractions."""
import sys, numpy as np
d = np.load(f'temp/key_art/{sys.argv[1]}.npz'); hit = np.isfinite(d['zb'])
H, W = hit.shape; frac = float(sys.argv[2]) if len(sys.argv) > 2 else 0.07
n = int(frac * H * 1.8)  # moon plus a margin of open sky
I = np.pad(hit.astype(np.int32).cumsum(0).cumsum(1), ((1, 0), (1, 0)))
best = None
for y in range(0, int(H * 0.45) - n, 2):
    for x in range(int(W * 0.08), int(W * 0.92) - n, 2):
        s = I[y + n, x + n] - I[y, x + n] - I[y + n, x] + I[y, x]
        if s == 0:
            score = -y  # prefer higher spots
            if best is None or score > best[0]:
                best = (score, x, y)
print(None if best is None else [round((best[1] + n / 2) / W, 3), round((best[2] + n / 2) / H, 3), frac])
