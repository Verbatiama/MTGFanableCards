#Source - https://stackoverflow.com/a/43828315
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

            # min/max(..., subset +/- 1) are to avoid looping infinitely over a wrong value
            if width < max_width - letter_size and text_size >= subset: # Too short
                subset = max(int(max_width * subset / width), subset + 1)
            elif width > max_width: # Too large
                subset = min(int(max_width * subset / width), subset - 1)
            else: # Subset fits, we exit
                break

        yield txt[:subset]
        txt = txt[subset:]   
        text_size = len(txt)