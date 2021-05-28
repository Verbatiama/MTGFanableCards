from PIL import Image, ImageDraw, ImageFont
im = Image.open("Assets\\Card\\acard.png").convert('RGBA')
# box = (400, 400, 800, 800)
# box2 = (800, 600)
# region = im.crop(box)
# region = region.transpose(Image.ROTATE_180)
# im.paste(region, box2)

# make a blank image for the text, initialized to transparent text color
txt = Image.new("RGBA", im.size, (255,255,255,0))

    # get a font
fnt = ImageFont.truetype("Assets\\Fonts\\Beleren Small Caps.ttf",30)
    # get a drawing context
d = ImageDraw.Draw(txt)

    # draw text, half opacity
d.text((30,25), "A Magic Card Name", font=fnt, fill=(0,0,0,255))
    # draw text, full opacity
d.text((30,320,10,400), "All the text that goes in a text box", font=fnt, fill=(0,0,0,255))

out = Image.alpha_composite(im, txt)

out.show()