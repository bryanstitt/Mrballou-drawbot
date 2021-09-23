const arg = process.argv[2];
if (arg === "debug") {
  var debug = true;
} else {
  var debug = false;
}
const robot = require("robotjs");
const Jimp = require("jimp");
const fs = require("fs");
const mcfsd = require("mcfsd");
const express = require("express");
const Eta = require("node-eta");
const DitherJS = require('ditherjs/server');

/*

console.log(eta.format(
        "elapsed: {{elapsed}},eta: {{eta}}, estimated: {{estimated}}, progress: {{progress}}, etah: {{etah}}, last: {{last}}"
      )
    );
*/

var resizeSteps = 1,
  retries = 5,
  dither,
  sortColors,
  fast,
  bucket,
  resizing = true,
  platform,
  totallines,
  oneLineIs,
  accuracy,
  delayBetweenColors,
  colors,
  file,
  ditherAccuracy,
  config,
  resizeDelay = 5,
  nearestColor,
  ignoringColors,
  manuIgnoreColor,
  aborting = false,
  mousePos,
  tries = 0;
function main() {
  var port = 49152;
  var nextline;
  //var resizingFactor = 1
  var resizeDelay = 5;

  const app = express();
  app.listen(port, () => {
    console.log("listining on", port);
  });
  app.use(express.static("public"));

  if (debug) console.log(`loading config from:`, "./server/config.json");
  config = JSON.parse(fs.readFileSync("./server/config.json"));
  if (debug) console.log(`config loaded:`, config);

  app.get("/draw", (request, response) => {
    tries = 0
    response.send({});
    function try_() {
      tries++
      var eta = new Eta(5);
      eta.start();
      //console.log('got instructions')
      if (debug) console.log(`got instruction to draw`);
      if (debug) console.log(`loaded config:`, config);
      aborting = false;

      fs.unlink("./server/aborting.json", () => {
        if (debug) console.log(`deleted "aborting.json" file`);
      });
      var gui = JSON.parse(fs.readFileSync("./server/gui.json"));
      if (debug) console.log(`gui loaded:`, gui);

      dither = gui.dither;
      sortColors = gui.sortColors;
      fast = gui.fast;
      bucket = gui.bucket;

      var { image, speed } = gui;
      delayBetweenColors = gui.delayBetweenColors;
      accuracy = gui.accuracy;
      totallines = gui.totallines;
      oneLineIs = gui.oneLineIs;
      platform = gui.platform;
      ditherAccuracy = gui.ditherAccuracy;
      manuIgnoreColor = gui.ignoreColor
      robot.setMouseDelay(speed);
      if (debug) console.log(`config for platform:`, config[platform]);
      if (typeof config[platform] === "undefined")
        return console.error("invalid platform");
      colors = config[platform].colors;
      //console.log(colors)
      nearestColor = require("nearest-color").from(colors);
      eta.iterate("index complete");

      //console.log(nearestColor)

      download(image, (error, file) => {
        if (error) {
          console.log(error, 'try', tries)
          if (tries >= retries) {
            console.log('retrying aborted with', tries, 'tries')
            return
          }
          try_()
          return
        }
        eta.iterate("download complete");
        console.log(eta.format("elapsed time: {{elapsed}}seconds, expected rest time: {{etah}}"));


        resize(file, (file) => {
          eta.iterate("resize complete");
          console.log(eta.format("elapsed time: {{elapsed}}seconds, expected rest time: {{etah}}"));


          dither_(file, (file) => {

            initDraw(file, (drawInstructions, drawInstructionsBu, usedColors) => {
              //console.log(drawInstructions)
              eta.iterate("initing complete");
              console.log(eta.format("elapsed time: {{elapsed}}seconds, expected rest time: {{etah}}"));


              sortDraw(drawInstructions, drawInstructionsBu, usedColors, (drawInstructions) => {
                eta.iterate("sort complete");
                console.log(eta.format("elapsed time: {{elapsed}}seconds, expected rest time: {{etah}}"));
                console.log("done initializing");
                //console.log(drawInstructions);
                draw(drawInstructions);
              }
              );
            });
          });
        });
      });
    }
    try_()
  });
}

function download(link, callback) {
  if (debug) console.log(`downloading image`);

  Jimp.read(link, function (err, image) {
    if (typeof image === "undefined") {
      callback("Invalid image provided", "./server/images/downloaded_image.png");
      return
    }
    image.write("./server/images/downloaded_image.png", () => {
      if (typeof callback === "function") {
        //return './server/images/downloaded_image.png'
        callback(undefined, "./server/images/downloaded_image.png");
      }
    });
  });
}
function dither_(image_path, callback) {
  if (dither) {
    console.log("dithering", image_path);
    //console.log(config[platform])
    var ditherArray = [];
    for (let c in config[platform].colors) {
      ditherArray.push([])
      var hex = config[platform].colors[c]
      var rgb = hexToRgb(hex)
      ditherArray[ditherArray.length - 1].push(rgb.r, rgb.g, rgb.b)
    }
    console.log(ditherArray)

    var buffer = fs.readFileSync(image_path)
    var options = {
      "step": ditherAccuracy, // The step for the pixel quantization n = 1,2,3...
      "palette": ditherArray, // an array of colors as rgb arrays
      "algorithm": "atkinson" // one of ["ordered", "diffusion", "atkinson"]
    };

    var ditherjs = new DitherJS(options);


    // Get a buffer that can be loaded into a canvas
    //console.log(buffer)

    var newBuffer = ditherjs.dither(buffer, options)

    fs.writeFileSync(`./server/images/dithered_image.png`, newBuffer)
    if (typeof callback === 'function') callback(`./server/images/dithered_image.png`)

  } else {
    if (typeof callback === "function") callback(image_path);
  }
}
function resize(image_path, callback) {
  console.log("resizing", image_path);

  var w = Math.round(
    (config[platform].positions.bottomright.x -
      config[platform].positions.topleft.x) /
    oneLineIs
  );
  var h = Math.round(
    (config[platform].positions.bottomright.y -
      config[platform].positions.topleft.y) /
    oneLineIs
  );
  console.log("max dimentions:", w, h);
  Jimp.read(image_path, function (err, image) {
    var newWidth, newHeight, tempnewWidth, tempnewHeight, canDraw, type;
    getMaxSize(w, h, image.bitmap.width, image.bitmap.height);
    async function getMaxSize(mwidth, mheight, cwidth, cheight) {
      if (typeof newHeight === "undefined" || typeof newWidth === "undefined") {
        newHeight = cheight;
        newWidth = cwidth;
        tempnewHeight = cheight;
        tempnewWidth = cwidth;
      }
      if ((cwidth < mwidth || cheight < mheight) && type !== "min") {
        //maximise
        //if (typeof resizeSteps !== "undefined") {
        //  tempnewWidth = Math.round(cwidth + resizeSteps);
        //  tempnewHeight = Math.round(cheight + resizeSteps);
        //} else {
        tempnewWidth = Math.round(cwidth * 1.05);
        tempnewHeight = Math.round(cheight * 1.05);
        //}
        if (tempnewHeight > mheight || tempnewWidth > mwidth) {
          canDraw = true;
        } else {
          type = "max";

          setTimeout(() => {
            console.log(
              "resizing to:",
              tempnewWidth,
              tempnewHeight,
              "(maximising)"
            );

            getMaxSize(mwidth, mheight, tempnewWidth, tempnewHeight);
          }, resizeDelay);
        }
      }
      if (cwidth > mwidth || (cheight > mheight && type !== "max")) {
        //minimise
        if (
          typeof resizeSteps !== "undefined" &&
          (Math.round(cheight / 1.05) === cheight ||
            Math.round(cwidth / 1.05) === cwidth)
        ) {
          newWidth = Math.round(cwidth - resizeSteps);
          newHeight = Math.round(cheight - resizeSteps);
        } else {
          newWidth = Math.round(cwidth / 1.05);
          newHeight = Math.round(cheight / 1.05);
        }
        type = "min";
        canDraw = false;
        setTimeout(() => {
          console.log("resizing to:", newWidth, newHeight, "(minimising)");

          getMaxSize(mwidth, mheight, newWidth, newHeight);
        }, resizeDelay);
      } else {
        //console.log('can draw:', canDraw,'type:', type)
        if (type === "min") {
          canDraw = true;
        }
      }
      if (canDraw) {
        if (cwidth <= 0 || cheight <= 0)
          return console.log("can't process that image");

        //var newImage = await resizeImg(fs.readFileSync(image_path), { width: cwidth, height: cheight });
        file = "./server/images/resized_image.png";
        image
          .resize(cwidth, cheight)
          .write("./server/images/resized_image.png", () => {
            if (typeof callback === "function") callback(file);
          });
      }
    }
  });
}
function sortOBJ(obj) {
  var largest = {
    value: 0,
    name: "",
  };
  for (let i in obj) {
    if (largest.value <= obj[i]) {
      largest.value = obj[i];
      largest.name = i;
    }
  }
  return largest;
}
function sortOBJBySize(obj) {
  var sortable = [];
  for (var i in obj) {
    sortable.push([i, obj[i]]);
  }

  sortable.sort(function (a, b) {
    return a[1] - b[1];
  });
  var objSorted = {};
  sortable.forEach(function (item) {
    objSorted[item[0]] = item[1];
  });
  return objSorted;
}

var rgbToHex = function (rgb) {
  var hex = Number(rgb).toString(16);
  if (hex.length < 2) {
    hex = "0" + hex;
  }
  return hex;
};

var fullColorHex = function (r, g, b) {
  var red = rgbToHex(r);
  var green = rgbToHex(g);
  var blue = rgbToHex(b);
  return red + green + blue;
};
function countColors(image_path, callback) {
  var usedColors = {};
  Jimp.read(image_path, function (err, image) {
    for (let y = 0; y < image.bitmap.height; y++) {
      for (let x = 0; x < image.bitmap.width; x++) {
        var color = Jimp.intToRGBA(image.getPixelColor(x, y));
        var fullHex = fullColorHex(color.r, color.g, color.b);
        var nearest = nearestColor("#" + fullHex);
        if (typeof usedColors[nearest.value] === "undefined") {
          usedColors[nearest.value] = 1;
        }
        usedColors[nearest.value] = usedColors[nearest.value] + 1;
        if (
          y + 2 > image.bitmap.height &&
          x + 2 > image.bitmap.width &&
          typeof callback === "function"
        )
          callback(usedColors, image);
      }
    }
  });
}

function initDraw(image_path, callback) {
  console.log("writing instructions with", image_path);
  var drawInstructions = [[]];
  var drawInstructionsBu = [];

  drawInstructionsBu.push({
    x: [config[platform].positions.topleft.x],
    y: [config[platform].positions.topleft.y],
    color: null,
    type: "ins",
  });
  mousePos = {
    x: parseInt(drawInstructionsBu[0].x),
    y: parseInt(drawInstructionsBu[0].y),
  };

  countColors(image_path, (usedColors, image) => {
    //console.log(usedColors)
    var largest = sortOBJ(usedColors);
    //console.log(usedColors)
    if (sortColors) {
      if (debug) console.log(`corting colors by size (biggest goes last)`);
      usedColors = sortOBJBySize(usedColors);
    }

    //console.log(largest);

    if (bucket) {
      drawInstructionsBu.push({
        x: [config[platform].positions.fillbucket.x],
        y: [config[platform].positions.fillbucket.y],
        color: null,
        type: "ins",
      });
      drawInstructionsBu.push({
        x: [config[platform].positions[largest.name].x],
        y: [config[platform].positions[largest.name].y],
        color: null,
        type: "ins",
      });
      drawInstructionsBu.push({
        x: [mousePos.x + 10],
        y: [mousePos.y + 10],
        color: null,
        type: "ins",
      });
      drawInstructionsBu.push({
        x: [config[platform].positions.pen.x],
        y: [config[platform].positions.pen.y],
        color: null,
        type: "ins",
      });
      delete usedColors[largest.name];
      ignoringColors = largest.name;
    } else {
      delete usedColors[manuIgnoreColor];
      ignoringColors = manuIgnoreColor;
    }
    console.log(usedColors);

    var colors = [];
    if (debug) console.log(`pushing colors to array`);
    for (let o in usedColors) {
      colors.push(o);
    }
    colors = removearr(colors, ignoringColors);
    colors = removearr(colors, ignoringColors);

    //return console.log(colors);
    var iy = 0
    if (debug) console.log("color array:", colors);
    for (let y = 0; y < image.bitmap.height; y += accuracy) {
      iy++
      for (let x = 0; x < image.bitmap.width; x += accuracy) {
        var color = Jimp.intToRGBA(image.getPixelColor(x, y));
        if (color.a == 0) continue
        var fullHex = fullColorHex(color.r, color.g, color.b);
        var nearest = nearestColor("#" + fullHex);
        if (y >= totallines) continue;
        if (nearest.value === ignoringColors) continue;
        if (typeof drawInstructions[iy] === 'undefined') drawInstructions[iy] = []
        drawInstructions[iy].push({
          x: [x * oneLineIs],
          y: [y * oneLineIs],
          //y: [y * (oneLineIs - 0.45)],
          color: nearest.value,
        });
      }
    }

    if (typeof callback === "function")
      callback(drawInstructions, drawInstructionsBu, usedColors);
  });
}
function sortDraw(drawInstructions, drawInstructionsBu, colors, callback) {
  var newins = [],
    di,
    ly = 0,
    looping,
    lines = 0,
    nc,
    nextlines = 1,
    ni = -1,
    lc = "";

  //console.log("di", drawInstructions[0]);
  for (let c in colors) {
    ly = 0;
    nextlines = 1;
    if (c === ignoringColors) continue;
    ni = 0;
    newins.push({
      x: [config[platform].positions[c].x],
      y: [config[platform].positions[c].y],
      color: null,
    });

    for (let y in drawInstructions) {
      for (let x in drawInstructions[y]) {
        x = parseInt(x)
        y = parseInt(y)
        di = drawInstructions[y][x]
        if (di.color === null) {
          //console.log('di', di)
          newins.push({
            x: [di.x[0]],
            y: [di.y[0]],
            color: null,
          });
          continue;
        }
        nextlines--
        looping = true
        if (nextlines <= 0) {

          if (fast) {
            if (di.color === c) {
              for (let l = 0; looping; l++) {
                nc = drawInstructions[y][x + l + 1]?.color
                if (x == drawInstructions[y].length - 1) {
                  //last pixel in color
                  looping = false
                  lines = l
                  continue
                }
                if (nc !== c) {
                  lines = l
                  looping = false
                }
              }
              newins.push({
                x: [
                  mousePos.x + di.x[0],
                  mousePos.x + (di.x[0] + lines * oneLineIs * accuracy + 1),
                ],
                y: [mousePos.y + di.y[0], mousePos.y + di.y[0]],
                color: c,
              });
              nextlines = lines;
            }
          }
          else {
            if (di.color == c) {
              nextline = 0;
              newins.push({
                x: [mousePos.x + di.x[0]],
                y: [mousePos.y + di.y[0]],
                color: c,
              })
            }
          }
        }
      }
    }
  }
  var output = newins,
    ind = -1,
    ins = 0;
  for (let a in drawInstructionsBu) {
    if (drawInstructionsBu[a].type == "ins") {
      output = addElementToArray(ins, drawInstructionsBu[a], output);
      ins++;
    } else {
      output = addElementToArray(ind + 1, drawInstructionsBu[a], output);
    }
    ind++;
  }
  if (typeof callback === "function") {
    callback(output);
  }
}
function draw(drawInstructions) {
  var deta = new Eta(Math.round(drawInstructions.length / 100));
  deta.start();
  var di,
    drag,
    co = 0,
    co2 = 0,
    color = "",
    lc = "";
  for (let c in drawInstructions) {
    c = parseInt(c);
    if (aborting) continue;
    di = drawInstructions[c];
    if (typeof di.x[1] === "undefined") drag = false;
    else drag = true;
    if (lc !== di.color && di.color !== null) color = di.color;
    if (drag) {
      robot.moveMouse(di.x[0], di.y[0]);
      robot.mouseToggle("down");
      robot.dragMouse(di.x[1], di.y[1]);
      robot.mouseToggle("up");
    } else {
      robot.moveMouse(di.x[0], di.y[0]);
      robot.mouseClick();
    }
    co++;
    co2++;
    if (co >= 20) {
      //console.log(percent(c, drawInstructions.length));
      co = 0;
      if (fs.existsSync("./server/aborting.json")) {
        aborting = true;
      }
    }
    if (co2 >= 100) {
      co2 = 0;
      deta.iterate(1);
      printProgress(
        color,
        percent(c + 1, drawInstructions.length),
        deta.format(
          "elapsed time: {{elapsed}}seconds, expected rest time: {{etah}}"
        )
      );
    }
    if (c + 1 >= drawInstructions.length) {
      printProgress("Done", 100, deta.format("took {{elapsed}} seconds and", tries, 'tries'));
      console.log("\n");
      console.log(`
                        *----------------------------*
                        |                            |
                        |   drawbot by mrballou      |   
                        |   support this work        |
                        |   on patreon               |
                        |   patreon.com/mrballou     |
                        |                            |
                        |                            |
                        *----------------------------*`);
    }
    lc = di.color;
  }
}
function percent(x, y) {
  return parseFloat((x * 100) / y).toFixed(2);
}
function printProgress(c, progress, resttime = "") {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(c + "(" + progress + "%" + ")" + resttime);
}
function addElementToArray(index, element, arr) {
  var newArr = [];
  for (let i in arr) {
    if (i == index) {
      newArr.push(element);
      newArr.push(arr[i]);
    } else {
      newArr.push(arr[i]);
    }
  }
  return newArr;
}
function objSize(obj) {
  var c = 0;
  for (let i in obj) {
    c++;
  }

  return c;
}
function removearr(arr, value) {
  var newarr = [];
  for (let i of arr) {
    if (i !== value) {
      newarr.push(i);
    }
  }
  return newarr;
}
function sort(value, large) {
  var newValue = {},
    size = objSize(value),
    temp = {};
  for (let c = 0; c < size; c++)
    if (large) {
      for (let i in value) {
      }
    }
  return newValue;
}
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}
main();
