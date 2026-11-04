import sys, os
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
w, h, n = 270, 300, 5
rows = (len(files) + n - 1) // n
c = Image.new('RGB', (n * w, rows * (h + 18)), (30, 30, 30)); g = ImageDraw.Draw(c)
for k, f in enumerate(files):
    x, y = (k % n) * w, (k // n) * (h + 18)
    c.paste(Image.open(f).convert('RGB').resize((w, h)), (x, y + 18)); g.text((x + 3, y + 3), os.path.basename(f)[:44], fill=(255, 255, 255))
c.save(out, quality=85)
