var fs = require('fs'),
    glm = require('gl-matrix'),
    _ = require('lodash'),
    Canvas = require('canvas'),
    TransformStack = require('./lib/transform-stack');

var RAD = Math.PI / 180,
    stack = Object.create(TransformStack),
    vec3 = (a) => glm.glMatrix.ARRAY_TYPE.from.call(glm.glMatrix.ARRAY_TYPE, a || [0,0,0]),
    mat4 = () => new Float32Array(16);



function readSceneFile(fileName){
    var reSkip = /(:?^\s*#|^$)/,
        data = fs.readFileSync(fileName, {encoding: 'utf8'});

    return data.split('\n').reduce((res, line) => {
        if (!reSkip.test(line)){
            line = line.trim().split(' ');
            var cmd = line[0],
                params =  _(line).tail().map(parseFloat).run();

            switch(cmd){
                case 'output':
                    res.outout = line[1]; break;
                case 'size':
                    res.size = { width: params[0], height: params[1] }; break;
                case 'camera':
                    var fovy = params[9] * RAD;
                    res.camera = {
                        eye: vec3(params.slice(0, 3)),
                        center: vec3(params.slice(3, 6)),
                        up: vec3(params.slice(6, 9)),
                        fovy: fovy,
                        fovx: fovy * res.size.width / res.size.height
                    }; break;
                case 'vertex':
                    res.vertex.push(vec3(params)); break;
                case 'vertexnormal':
                    res.vertexNorm.push({
                        v: vec3(params.slice(0, 3)),
                        n: vec3(params.slice(3, 6))
                    }); break;
                default:
                    res.states.push({ cmd,  params });
            }
        }
        return res;
    }, { vertex: [], vertexNorm: [], states: [{ cmd: 'ambient', params: [.2, .2, .2]}] });
}

function writePNG (fileName, canvas){
    var out = fs.createWriteStream(fileName),
        stream = canvas.pngStream();

    stream.on('data', function(chunk){
        out.write(chunk);
    });

    stream.on('end', function(){
        console.log('saved png');
    });
}

function rayTruPixel(camera, width, height, i, j){
    var a = glm.vec3.subtract(vec3(), camera.eye, camera.center),
        b = camera.up,
        w = glm.vec3.normalize(vec3(), a),
        u = glm.vec3.normalize(vec3(), glm.vec3.cross(vec3, b, w)),
        v = glm.vec3.cross(vec3(), w, u),
        alpha = Math.tan(camera.fovx / 2) * ((j - (width / 2)) / (width / 2)),
        beta = Math.tan(camera.fovy / 2) * ((i - (height / 2)) / (height / 2)),
        alphaU = u.map(i => i * alpha),
        betaV = v.map(i => i * beta),
        aUbVW = glm.vec3.subtract(vec3(), glm.vec3.add(vec3(), alphaU, betaV), w);

    return glm.vec3.add(vec3(), camera.eye, glm.vec3.normalize(vec3(), aUbVW));
}

function intersect (ray, world){

}

function findColor (hit){
    return vec3([255, 0, 0, 255]);
}

function putPixel (img, x, y, color){
    var idx = y * (img.width * 4) + (x * 4);
    color.forEach((c, offset) => img.data[idx + offset] = c);
}

function raytrace(img, camera, world, width, height){
    for(var i = 0; i < height; i++){
        for (var j = 0; j < width; j++){
            var ray = rayTruPixel(camera, i, j),
                hit = intersect (ray, world);
            putPixel(img, j, i, findColor (hit));
        }
    }
}

function createWorld(stack, scene){

    return scene.states.reduce((world, state) => {
         switch (state.cmd){
             case 'pushTransform':
                 stack.push(); break;
             case 'popTransform':
                 stack.pop(); break;
             case 'scale':
                 stack.scale(vec3(state.params)); break;
             case 'translate':
                 stack.translate(vec3(state.params)); break;
             case 'rotate':
                 stack.rotate(vec3(state.params * RAD, state.params.slice(0,3))); break;
             case 'tri':
                 world.objects.push(
                     state.params.map((idx) =>
                         glm.vec3.transformMat4(vec3(), vec3(scene.vertex[idx]), stack.top())
                     )
                 ); break;
             case 'trinormal':
             case 'sphere':
                 break;
         }
        return world;
    }, {objects: []});
}

// read scene
var scene = readSceneFile(__dirname + '/scene1.test'),
    world = {},
    width = scene.size.width,
    height = scene.size.height,
    canvas = new Canvas(width, height),
    ctx = canvas.getContext('2d'),
    imgData = ctx.createImageData(width, height);

// setup the scene
var projection = glm.mat4.perspective(mat4(), 45, 1, 0.001, 100),
    view = glm.mat4.lookAt(mat4(), scene.camera.eye, scene.camera.center, scene.camera.up),
    model = glm.mat4.identity(mat4()),
    VP = glm.mat4.multiply(mat4(), projection, view),
    MVP = glm.mat4.multiply(mat4(), VP, model);

stack.push(MVP);
world = createWorld(stack, scene);
// calculate raytrace

raytrace(imgData, scene.camera, world, width, height);

ctx.putImageData(imgData, 0, 0);

// save result
writePNG(__dirname + '/' + (scene.outout || 'test.png'), canvas);