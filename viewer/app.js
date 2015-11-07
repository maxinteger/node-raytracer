var container,
    stats,
    camera,
    scene,
    renderer,
    mesh,
    parent_node,
    dump;

fetch('dump.json')
    .then(function (resp) {
        return resp.json();
    })
    .then(function (data) {
        dump = data;
        init();
        animate();
    });

function init() {

    container = document.getElementById( 'container' );

    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 10000 );
    //camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, 1, 1000 );
    camera.position.z = 15;
    var controls = new THREE.OrbitControls( camera );

    scene = new THREE.Scene();

    var geometry = new THREE.BufferGeometry();
    var material = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors });

    var positions = [];
    var next_positions_index = 0;
    var colors = [];
    var indices_array = [],
        GRID_SIZE = 10,
        WHITE = new THREE.Vector3(1,1,1),
        GRAY = new THREE.Vector3(.5,.5,.5),
        RED = new THREE.Vector3(1,0,0),
        GREEN = new THREE.Vector3(0,1,0),
        BLUE = new THREE.Vector3(0,0,1)
        ;

    function add_vertex(v, color) {
        color = color || WHITE;
        if (next_positions_index == 0xffff) throw new Error("Too many points");

        positions.push(v.x, v.y, v.z);
        colors.push(color.x, color.y, color.z);
        next_positions_index++;
        indices_array.push(next_positions_index-1);
    }

    add_vertex(new THREE.Vector3(-100, 0, 0), RED);
    add_vertex(new THREE.Vector3(100, 0, 0), RED);
    add_vertex(new THREE.Vector3(0, -100, 0), GREEN);
    add_vertex(new THREE.Vector3(0, 100, 0), GREEN);
    add_vertex(new THREE.Vector3(0, 0, -100), BLUE);
    add_vertex(new THREE.Vector3(0, 0, 100), BLUE);

    // grid
    for (var x = -GRID_SIZE; x <= GRID_SIZE; x++){
        if (x !== 0){
            add_vertex(new THREE.Vector3(-10, 0, x), GRAY);
            add_vertex(new THREE.Vector3( 10, 0, x), GRAY);
            add_vertex(new THREE.Vector3(x, 0, -10), GRAY);
            add_vertex(new THREE.Vector3(x, 0,  10), GRAY);
        }
    }

    var eye = new THREE.Vector3(dump.camera.eye['0'], dump.camera.eye['1'], dump.camera.eye['2']);
    for (var i = 0; i < dump.ray.length; i ++){
        add_vertex(eye);
        add_vertex(new THREE.Vector3(dump.ray[i][0],dump.ray[i][1],dump.ray[i][2]));

        add_vertex(new THREE.Vector3(dump.tri[i][0],dump.tri[i][1],dump.tri[i][2]));
        add_vertex(new THREE.Vector3(dump.tri[i][0],dump.tri[i][1],dump.tri[i][2]).multiplyScalar(1.1));
    }

    for (var i = 0; i < dump.obj.length; i ++){
        var obj = dump.obj[i].data;
        for (var j = 0; j < obj.length; j++){
            var x = j === 0 ? obj.length-1 : j-1;
            add_vertex(new THREE.Vector3(obj[x]['0'], obj[x]['1'], obj[x]['2']));
            add_vertex(new THREE.Vector3(obj[j]['0'], obj[j]['1'], obj[j]['2']));
        }
    }

    // --------------------------------

    geometry.setIndex( new THREE.BufferAttribute( new Uint16Array( indices_array ), 1 ) );
    geometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( positions ), 3 ) );
    geometry.addAttribute( 'color', new THREE.BufferAttribute( new Float32Array( colors ), 3 ) );
    geometry.computeBoundingSphere();

    mesh = new THREE.LineSegments( geometry, material );
    //mesh.position.x -= 1200;
    //mesh.position.y -= 1200;

    parent_node = new THREE.Object3D();
    parent_node.add(mesh);

    scene.add( parent_node );

    renderer = new THREE.WebGLRenderer( { antialias: false } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );

    renderer.gammaInput = true;
    renderer.gammaOutput = true;

    container.appendChild( renderer.domElement );

    //
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild( stats.domElement );

    window.addEventListener( 'resize', onWindowResize, false );
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}
//

function animate() {
    requestAnimationFrame( animate );
    render();
    stats.update();
}

function render() {
    var time = Date.now() * 0.001;
    //mesh.rotation.x = time * 0.25;
    //mesh.rotation.y = time * 0.5;
    //parent_node.rotation.x = time * 0.5;
    //parent_node.rotation.y = time * 0.5;
    //parent_node.rotation.z = time * 0.5;
    renderer.render( scene, camera );
}