import tkinter as tk
import requests
import json
import threading
from pynput.keyboard import Key, Listener
import os

ditherAlgorithms = ["ordered", "diffusion", "atkinson", "mcfsd"]

dropdownValues = []
f = open("./server/config.json", "r")
for d in json.load(f):
    dropdownValues.append(d)
    print(d)



URL = 'http://localhost:49152/draw'


def windowopener():

    def draw():
        if e1.get() == '' or e1.get() == ''  or e3.get() == '' or e4.get() == '' or e5.get() == '' or e6.get() == '' or num.get == '':

            w = tk.Label(
                window, text="ERROR! at least one value is empty", fg='red')
            w.grid(column=1)

        else:

            image = e1.get()

            f = open("./server/gui.json", "w")
            json.dump({
                # "platform": e2.get(),
                "platform": dropdown.get(),
                "image": image,
                "speed": float(e3.get()),
                "oneLineIs": float(e4.get()),
                "accuracy": float(e5.get()),
                "dither": dithering.get(),
                "ditherAccuracy": float(e6.get()),
                "totallines": float(num.get()),
                "sortColors": box.get(),
                "delayBetweenColors":  float(delay.get()),
                "fast": resizing.get(),
                "bucket": bucket.get(),
                "ignoreColor": ignoreColor.get(),
                "ditherAlgorithm":  ditherAlg.get()
            }, f)
            f.close()
            requests.get(url=URL, params={})

    window = tk.Tk()

    window.title('Drawbot by mrballou')
    dropdown = tk.StringVar(window)
    ditherAlg = tk.StringVar(window)

    dtha = tk.OptionMenu(window, ditherAlg, *ditherAlgorithms)
    dtha.config(height=1)
    
    dtha.bind()
    dtha.place(x=116, y=150)

    opt = tk.OptionMenu(window, dropdown, *dropdownValues)
    opt.config(height=1)
    
    opt.bind()
    opt.place(x=116, y=0)

    tk.Label(window, text="Platform").grid(row=0)
    tk.Label(window, text="Speed").grid(row=1)
    tk.Label(window, text="One line is").grid(row=2)
    tk.Label(window, text="Accuracy").grid(row=3)
    tk.Label(window, text="DitherAccuracy").grid(row=4)
    tk.Label(window, text="Ignore color").grid(row=8)
    tk.Label(window, text="Total lines").grid(row=9)
    tk.Label(window, text="Delay between colors").grid(row=10)
    tk.Label(window, text="Image URL").grid(row=11)
    tk.Label(window, text="Dither Algorithm").grid(row=7)

    e1 = tk.Entry(window)
    e3 = tk.Entry(window)
    e4 = tk.Entry(window)
    e5 = tk.Entry(window)
    e6 = tk.Entry(window)
    num = tk.Entry(window)
    delay = tk.Entry(window)
    ignoreColor = tk.Entry(window)


    s = open("./server/gui.json", "r")
    data = json.load(s)

    

    # print(data['image'])

    e1.insert(
        0, data['image'])
    #e2.insert(0, data['platform'])
    dropdown.set(data['platform'])
    ditherAlg.set(data['ditherAlgorithm'])
    e3.insert(0, data['speed'])
    e4.insert(0, data['oneLineIs'])
    e5.insert(0, data['accuracy'])
    e6.insert(0, data['ditherAccuracy'])
    num.insert(0, data['totallines'])
    delay.insert(0, data['delayBetweenColors'])
    ignoreColor.insert(0, data['ignoreColor'])

    e1.grid(row=11, column=1)
    e3.grid(row=1, column=1)
    e4.grid(row=2, column=1)
    e5.grid(row=3, column=1)
    e6.grid(row=4, column=1)
    num.grid(row=9, column=1)
    delay.grid(row=10, column=1)
    ignoreColor.grid(row=8, column=1)

    dithering = tk.IntVar()
    tk.Checkbutton(window, text="Dither",
                   variable=dithering).grid(row=5, column=1)
    box = tk.IntVar()

    tk.Checkbutton(window, text="Sort colors",
                   variable=box).grid(row=5, column=0)

    #googleImageing = tk.IntVar()
    # tk.Checkbutton(window, text="Google imageing",
    #               variable=googleImageing).grid(row=10, column=1)
    resizing = tk.IntVar()
    tk.Checkbutton(window, text="Fast mode",
                   variable=resizing).grid(row=6, column=0)
    bucket = tk.IntVar()
    tk.Checkbutton(window, text="Bucket",
                   variable=bucket).grid(row=6, column=1)

    button = tk.Button(window, text='Draw', width=5, command=draw)
    button.grid(column=1)

    button = tk.Button(window, text='Quit', fg="red", width=8, command=quit)
    button.grid(column=0)

    if data['dither'] == 1:
        dithering.set(True)
    else:
        dithering.set(False)

    if data['sortColors'] == 1:
        box.set(True)
    else:
        box.set(False)
    if data['fast'] == 1:
        resizing.set(True)
    else:
        resizing.set(False)
    if data['bucket'] == 1:
        bucket.set(True)
    else:
        bucket.set(False)

    window.mainloop()


x = threading.Thread(target=windowopener, args=())
x.start()


def on_release(key):
    if key == Key.esc:
        print('ESC pressed. Aborting print')
        f = open("./server/aborting.json", "w")
        f.close()
        # quit()


with Listener(on_release=on_release) as Listener:
    Listener.join()
