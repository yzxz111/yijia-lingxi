from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
scale = 4
im = Image.new('RGBA', (256 * scale, 256 * scale))
d = ImageDraw.Draw(im)
def box(values): return tuple(int(x * scale) for x in values)
d.rounded_rectangle(box((0, 0, 256, 256)), radius=72 * scale, fill='#6959eb')
d.line(box((68, 136, 188, 136)), fill='white', width=24 * scale)
d.line(box((128, 76, 128, 196)), fill='white', width=24 * scale)
for x, y in [(68,136),(188,136),(128,76),(128,196)]:
    d.ellipse(box((x-12,y-12,x+12,y+12)), fill='white')
d.polygon([(int(x*scale),int(y*scale)) for x,y in [(184,38),(193,62),(218,72),(193,82),(184,108),(174,82),(149,72),(174,62)]], fill='#caefba')
im = im.resize((256, 256), Image.Resampling.LANCZOS)
im.save(root / 'assets' / 'icon.png')
im.save(root / 'assets' / 'icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('Created PNG / ICO application icons.')
