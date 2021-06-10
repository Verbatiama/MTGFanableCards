from PIL import Image, ImageDraw, ImageFont
import time
#from . import helper

#work out imports
def break_text(txt, font, max_width):

    # We share the subset to remember the last finest guess over 
    # the text breakpoint and make it faster
    subset = len(txt)
    letter_size = None

    text_size = len(txt)
    while text_size > 0:

        # Let's find the appropriate subset size
        while True:
            width, height = font.getsize(txt[:subset])
            letter_size = width / subset
            
            #TODO stop loop
            # min/max(..., subset +/- 1) are to avoid looping infinitely over a wrong value
            if width < max_width and text_size >= subset: # Too short
                subset = max(int(max_width * subset / width), subset + 1)
            elif width > max_width: # Too large
                subset = min(int(max_width * subset / width), subset - 1)
                break
            else: # Subset fits, we exit
                break

        yield txt[:subset]
        txt = txt[subset:]   
        text_size = len(txt)

def fontMaxHeight(font):
    width, height = font.getsize("".join(list(map(chr, range(32, 123)))))
    return height

im = Image.open("Assets\\Card\\acard.jpg").convert('RGBA')
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
#d.text((30,320,10,400), "All the text that goes in a text box", font=fnt, fill=(0,0,0,255))

fnt = ImageFont.truetype("Assets\\Fonts\\Beleren Small Caps.ttf",10)

height = fontMaxHeight(fnt)

for i, line in enumerate(break_text("".join(list(map(chr, range(32, 123))))*2, fnt, 300)):
    d.text((30, 330+height*i), line, (0,0,0,255), font=fnt)   

out = Image.alpha_composite(im, txt)

out.show()