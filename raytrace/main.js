import fs from 'fs';
import glm from 'gl-matrix';
import _ from 'lodash';
import Canvas from 'canvas';
import TransformStack from './transform-stack';

var {map, pick, isFunction} = _;

const RAD = Math.PI / 180,
      stack = Object.create(TransformStack),
      vec3 = (a) => glm.glMatrix.ARRAY_TYPE.from.call(glm.glMatrix.ARRAY_TYPE, a || [0,0,0]),
      mat4 = () => new Float32Array(16),
      print = console.log.bind(console),
      tap = (a) => (print(a), a);

map(pick(glm.vec3, isFunction), (fn, name) => {
    vec3[name === 'length' ? 'len' : name]  = (...a) => fn(vec3(), ...a)
});


var dump = {ray : [], tri:[], obj: []};

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
                    };
                    dump.camera = res.camera; break;
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
    var a = vec3.subtract(camera.eye, camera.center),
        b = camera.up,
        w = vec3.normalize(a),
        u = vec3.normalize(vec3.cross(b, w)),
        v = vec3.cross(w, u),
        alpha = Math.tan(camera.fovx / 2) * ((j - (width / 2)) / (width / 2)),
        beta = Math.tan(camera.fovy / 2) * ((i - (height / 2)) / (height / 2)),
        alphaU = u.map(i => i * alpha),
        betaV = v.map(i => i * beta),
        aUbVW = vec3.subtract(vec3.add(alphaU, betaV), w),
        ray = {
            p0: camera.eye,
            dir: vec3.add(camera.eye, vec3.normalize(aUbVW))
        };
    dump.ray.push(_.toArray(ray.dir));
    return ray;
}

function intersection (ray, world){
    var minDist = Infinity,
        hitObj = null;

    world.objects.forEach(function (obj) {
        var t = intersect(ray, obj);
        if (t > 0 && t < minDist){
            minDist = t;
            hitObj = obj;
        }
    });
    return Number.isFinite(minDist) && hitObj !== null ? {dist: minDist, obj: hitObj} : null;
}

function triangleIntersect(ray, object){
    var A = object.data[0],
        n = object.norm;
    var x = vec3.divide(vec3.subtract(vec3.mul(A, n), vec3.mul(ray.p0, n)), vec3.mul(ray.dir, n));
    console.log(n);
    dump.tri.push(_.toArray(x));
    return x;
}

function intersect(ray, object){
    switch (object.type){
        case 'try': return triangleIntersect(ray, object);
        default: return 0;
    }
}

function findColor (hit){
    return hit === null ? vec3([0, 0, 0, 0]) : vec3([255, 0, 0, 255]);
}

function putPixel (img, x, y, color){
    var idx = y * (img.width * 4) + (x * 4);
    color.forEach((c, offset) => img.data[idx + offset] = c);
}

function raytrace(img, camera, world, width, height){
    for(var i = 0; i < height; i++){
        for (var j = 0; j < width; j++){
            var ray = rayTruPixel(camera, width, height, i, j),
                hit = intersection (ray, world);
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
                 let points = state.params.map((idx) =>
                         vec3.transformMat4(vec3(scene.vertex[idx]), stack.top())
                     ),
                     [A, B, C] = points,
                     n = vec3.normalize(vec3.cross(vec3.subtract(C, A), vec3.subtract(B, A))),
                     tri = {
                         type: 'try',
                         data: points,
                         norm: n
                     };
                 dump.obj.push(tri);
                 world.objects.push(tri);
                 break;
             case 'trinormal':
             case 'sphere':
                 break;
         }
        return world;
    }, {objects: []});
}

// read scene
var scene = readSceneFile(__dirname + '/scenes/scene1.test'),
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
fs.writeFileSync(__dirname + '/../viewer/dump.json', JSON.stringify(dump), 'utf8');
// save result
writePNG(__dirname + '/../viewer/' + (scene.outout || 'test.png'), canvas);