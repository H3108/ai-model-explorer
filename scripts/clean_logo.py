from PIL import Image

SRC = "assets/brand/logo-c.png"
OUT = "assets/brand/logo.png"
FAV = "assets/brand/favicon.png"

img = Image.open(SRC).convert("RGB")
W, H = img.size
px = img.load()

def is_white(r, g, b):
    return r > 248 and g > 248 and b > 248

# 1) 去除右下角水印（仅清理极端角落，不动中心图形）
x0, y0 = int(W * 0.78), int(H * 0.82)
xs, ys = [], []
for y in range(y0, H):
    for x in range(x0, W):
        r, g, b = px[x, y]
        if not is_white(r, g, b):
            xs.append(x); ys.append(y)
if xs:
    pad = 8
    minx = max(0, min(xs) - pad); maxx = min(W - 1, max(xs) + pad)
    miny = max(0, min(ys) - pad); maxy = min(H - 1, max(ys) + pad)
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            px[x, y] = (255, 255, 255)

# 2) 泛洪填充：从四条边出发，连通的白色区域视为背景 -> 透明
alpha = [bytearray([255]) * W for _ in range(H)]
stack = []
for x in range(W):
    for y in (0, H - 1):
        if is_white(*px[x, y]) and alpha[y][x]:
            stack.append((x, y))
for y in range(H):
    for x in (0, W - 1):
        if is_white(*px[x, y]) and alpha[y][x]:
            stack.append((x, y))
while stack:
    x, y = stack.pop()
    if not (0 <= x < W and 0 <= y < H):
        continue
    if not alpha[y][x]:
        continue
    if not is_white(*px[x, y]):
        continue
    alpha[y][x] = 0
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < W and 0 <= ny < H and alpha[ny][nx]:
            stack.append((nx, ny))

out = Image.new("RGBA", (W, H))
op = out.load()
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        op[x, y] = (r, g, b, alpha[y][x])
out.save(OUT, "PNG")
print("saved", OUT, out.size, "transparent-bg")

# 3) favicon：居中裁剪 + 缩到 256，转透明
s = int(min(W, H) * 0.7)
left = (W - s) // 2
crop = out.crop((left, left, left + s, left + s)).resize((256, 256), Image.LANCZOS)
crop.save(FAV, "PNG")
print("saved", FAV, crop.size)
