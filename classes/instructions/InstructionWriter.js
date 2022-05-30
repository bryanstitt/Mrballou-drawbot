const Jimp = require("jimp")
const Config = require("../config/Config")
const DrawInstruction = require("./DrawInstruction")
const NearestColor = require("nearest-rgba")
const Setting = require("../config/Setting")
const Positions = require("../config/Positions")

module.exports = class InstructionWriter {
    /**
     * @param {Config} config
     */
    constructor(config) {
        this.config = config.data
        /**
         * @type {NearestColor}
         */
        this.nc = null
    }

    /**
     * @param {Jimp} img
     * @returns {DrawInstruction[]}
     * @param {Positions} positions
     * @param {Setting} settings
     */
    write(img, positions, settings) {
        this.settings = settings.data
        let instructions = []

        let position = positions.getPlatform(this.settings.name)



        let hexColors = Object.keys(position.colors)

        console.log(hexColors)

        this.ns = new NearestColor().fromHEX(hexColors)

        // recolor image to nearest colors and count colors
        let recolored = img.clone()
        let colors = {}
        for (let x = 0; x < img.bitmap.width; x++) {
            for (let y = 0; y < img.bitmap.height; y++) {
                let hex = img.getPixelColor(x, y)
                let rgba = Jimp.intToRGBA(hex)
                let nearest = this.ns.nearest(rgba, false)

                let nearestint = Jimp.rgbaToInt(nearest.r, nearest.g, nearest.b, nearest.a)
                let nearesthex = rgbToHex(nearest)
                recolored.setPixelColor(nearestint, x, y)
                colors[nearesthex] = colors[nearesthex] ? colors[nearesthex] + 1 : 1
            }
        }

        recolored.write(this.config.temp + 'recolored.png')
        colors = Object.fromEntries(
            Object.entries(colors).sort(([,a],[,b]) => b-a)
        );
        console.log(colors)

        // make first dot at topleft to make sure we are focused in the right window

        instructions.push(new DrawInstruction('DOT', {
            x1: position.topleft.x,
            y1: position.topleft.y
        }, 'INIT_WINDOW'))

        let lastColor = null

        for (let color in colors) {

            if (settings.data.ignoreColors.includes(color)) continue


            for (let y = 0; y < recolored.bitmap.height; y++) {
                let solidLine = true
                let breakX = false
                for (let x = 0; x < recolored.bitmap.width; x++) {
                    let numb = recolored.getPixelColor(x, y)
                    let rgba = Jimp.intToRGBA(numb)
                    let hex = rgbToHex(rgba)

                    if (color != hex) continue
                    if (!lastColor || hex !== lastColor) {
                        lastColor = hex
                        let pos = position.colors[hex]

                        let instruction = new DrawInstruction('DOT', {
                            x1: pos.x,
                            y1: pos.y,
                            delay: this.settings.delay + this.settings.colorDelay
                        },
                            "SET_COLOR")
                        instructions.push(instruction)
                    }

                    if (this.settings.fast) {
                        let pixels = 0
                        let looping = true

                        for (let fx = x; fx < recolored.bitmap.width && looping; fx++) { //852
                            let fy = y
                            let fnumb = recolored.getPixelColor(fx, fy)
                            let frgba = Jimp.intToRGBA(fnumb)
                            let fhex = rgbToHex(frgba)

                            if (fhex == hex) {
                                pixels++
                                if(fx == recolored.bitmap.width - 1) {
                                    let instruction = new DrawInstruction('DRAG', {
                                        x1: x + position.topleft.x,
                                        y1: y + position.topleft.y,
                                        x2: x + position.topleft.x + (pixels - 1),
                                        y2: y + position.topleft.y,
    
                                        delay: this.settings.delay,
                                    }, "DRAW_LINE")
                                    instructions.push(instruction)
                                    looping = false
                                    breakX = true
                                }
                            }
                            else {
                                let instruction = new DrawInstruction('DRAG', {
                                    x1: x + position.topleft.x,
                                    y1: y + position.topleft.y,
                                    x2: x + position.topleft.x + (pixels - 1),
                                    y2: y + position.topleft.y,

                                    delay: this.settings.delay,
                                }, "DRAW_LINE")
                                instructions.push(instruction)
                                x = fx - 1
                                looping = false
                            }
                            
                        }
                       
                        if(breakX) break;
                        
                    }
                    else {
                        let instruction = new DrawInstruction('DOT', {
                            x1: (x * this.settings.distancing) + position.topleft.x,
                            y1: (y * this.settings.distancing) + position.topleft.y,
                            delay: this.settings.delay
                        }, "DRAW_PIXEL")
                        instructions.push(instruction)
                    }
                }
            }

        }

        // make shure EVERY draw instruction is in bounds

        // for (let instruction of instructions) {
        //     if (instruction.comment.toLowerCase().includes('draw')) {
        //         if (instruction.cords.x1 < position.topleft.x || instruction.cords.x1 > position.bottomright.x ||
        //             instruction.cords.y1 < position.topleft.y || instruction.cords.y1 > position.bottomright.y ||

        //             instruction.cords.x2 < position.topleft.x || instruction.cords.x2 > position.bottomright.x ||
        //             instruction.cords.y2 < position.topleft.y || instruction.cords.y2 > position.bottomright.y
        //         ) {

        //             if (instruction.type == 'DRAG') {
        //                 instruction.cords.x2 = instruction.cords.x2 > position.bottomright.x ? position.bottomright.x : instruction.cords.x2
        //                 instruction.cords.x2 = instruction.cords.x2 < position.topleft.x ? position.topleft.x : instruction.cords.x2

        //                 instruction.cords.y2 = instruction.cords.y2 > position.bottomright.y ? position.bottomright.y : instruction.cords.y2
        //                 instruction.cords.y2 = instruction.cords.y2 < position.topleft.y ? position.topleft.y : instruction.cords.y2

        //                 instruction.cords.x1 = instruction.cords.x1 > position.bottomright.x ? position.bottomright.x : instruction.cords.x1
        //                 instruction.cords.x1 = instruction.cords.x1 < position.topleft.x ? position.topleft.x : instruction.cords.x1

        //                 instruction.cords.y1 = instruction.cords.y1 > position.bottomright.y ? position.bottomright.y : instruction.cords.y1
        //                 instruction.cords.y1 = instruction.cords.y1 < position.topleft.y ? position.topleft.y : instruction.cords.y1
        //             }
        //             else {
        //                 instruction.comment = 'OUT_OF_BOUNDS'
        //             }
        //         }
        //     }

        // }

        // // remove every out of bounds
        // instructions = instructions.filter(i => i.comment !== 'OUT_OF_BOUNDS')

        //remove any directly repeating set color instructions

        return instructions
    }
}

function rgbToHex(rgb) {
    let r = rgb.r.toString(16)
    let g = rgb.g.toString(16)
    let b = rgb.b.toString(16)
    if (r.length < 2) r = "0" + r
    if (g.length < 2) g = "0" + g
    if (b.length < 2) b = "0" + b
    return "#" + r + g + b
}