var vr_mode = false;
var camera, scene, renderer;
var effect, controls;
var element, container;
var model;

var video, canvas, fcontext;
var drawing, pcontext;
var webgl;
var positions, fd, img, ctrack;

init();

function init() {
    //frame
    video = document.getElementById('video');
    video.style.display = 'none';
    canvas = document.getElementById('canvas');
    fcontext = canvas.getContext('2d');

    //people
    drawing = document.getElementById('drawing');
    pcontext = drawing.getContext('2d');

    //face
    webgl = document.getElementById('webgl');

    positions = 0;
    fd = new faceDeformer();

    img = new Image(); //画像オブジェクト作成
    img.src = "data/p.png";
    img.onload = function() {
        // 読み込み終了した状態を保存
        imageLoadDone = true;
    };

    ctrack = new clm.tracker({
        useWebGL: true
    });
    ctrack.init(pModel);


    // レンダラの作成
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Webページへの埋め込み設定
    element = renderer.domElement;
    container = document.getElementById('example');
    container.appendChild(element);

    // エフェクトの作成
    effect = new THREE.CardboardEffect(renderer);

    // シーンの作成
    scene = new THREE.Scene();

    // カメラの作成
    camera = new THREE.PerspectiveCamera(90, 1, 0.001, 1000);
    camera.position.set(0, 20, 0);
    scene.add(camera);

    // マウスによる視点操作の設定
    controls = new THREE.OrbitControls(camera, element);
    //controls.rotateUp(Math.PI / 4);
    controls.target.set(
        camera.position.x + 0.1,
        camera.position.y,
        camera.position.z
    );
    controls.noZoom = true;
    controls.noPan = true;

    // 視点コントロール
    function setOrientationControls(e) {
        if (!e.alpha) {
            return;
        }
        controls = new THREE.DeviceOrientationControls(camera, true);
        controls.connect();
        controls.update();
        element.addEventListener('click', fullscreen, false);
        window.removeEventListener('deviceorientation', setOrientationControls, true);
    }

    window.addEventListener('deviceorientation', setOrientationControls, true); // デバイスの傾きが変化した時の処理を設定
    window.addEventListener('resize', resize, false); // ウィンドウのリサイズが発生した時の処理を設定
    setTimeout(resize, 1); // 1秒後にリサイズ処理を実行

    // 照明の作成
    var light = new THREE.HemisphereLight(0xFFFFFF, 0x000000, 0.6);
    scene.add(light);

    // model
    var onProgress = function(xhr) {
        if (xhr.lengthComputable) {
            var percentComplete = xhr.loaded / xhr.total * 100;
            console.log(Math.round(percentComplete, 2) + '% downloaded');
        }
    };
    var onError = function(xhr) {};
    THREE.Loader.Handlers.add(/\.dds$/i, new THREE.DDSLoader());

    var mtlLoader = new THREE.MTLLoader();
    mtlLoader.setPath('data/');
    mtlLoader.load('prismheart.mtl', function(materials) {
        materials.preload();
        var objLoader = new THREE.OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.setPath('data/');
        objLoader.load('prismheart.obj', function(object) {
            object.position.set(0, 30, 40);
            object.scale.set(10, 10, 10);
            model = object;
            scene.add(model);
        }, onProgress, onError);
    });

    // テクスチャの作成
    var texture = THREE.ImageUtils.loadTexture(
        'data/checker.png'
    );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat = new THREE.Vector2(50, 50);
    texture.anisotropy = renderer.getMaxAnisotropy();

    // マテリアル（材質）の作成
    var material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        specular: 0xffffff,
        shininess: 20,
        shading: THREE.FlatShading,
        map: texture
    });

    // 床面の作成
    var geometry = new THREE.PlaneGeometry(1000, 1000);
    var mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);

    // Textureとして指定する．以下Three.jsでよくあるオブジェクト描画と同じ
    var imagetexture = new THREE.Texture(canvas);
    imagetexture.needsUpdate = true;
    var imagematerial = new THREE.SpriteMaterial({
        map: imagetexture,
        color: 0xffffff
    });
    var imagesprite = new THREE.Sprite(imagematerial);
    imagesprite.scale.set(200, 200, 200);
    imagesprite.position.set(0, 0, 0);

    scene.add(imagesprite);

    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
    navigator.getUserMedia({
        video: true,
        audio: false
    }, function(stream) {
        video.src = URL.createObjectURL(stream);
        ctrack.start(video);
        animate();
    }, function() {});
}

function animate() {
    model.rotation.set(0, model.rotation.y + 0.03, model.rotation.z + 0.03);
    controls.update();
    if (vr_mode) {
        effect.render(scene, camera); // ステレオエフェクトまたはカードボードエフェクトでレンダリング
    } else {
        renderer.render(scene, camera); // 通常のレンダリング
    }
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        fcontext.drawImage(video, 0, 0, canvas.width, canvas.height);
        frame();
        positions = ctrack.getCurrentPosition();
        setupFaceDeformation();
    }
    requestAnimationFrame(animate);
}

// 描画領域のリサイズ
function resize() {
    var width = container.offsetWidth;
    var height = container.offsetHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    effect.setSize(width, height);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
}


// フルスクリーン化
function fullscreen() {
    if (container.requestFullscreen) {
        container.requestFullscreen();
    } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
    } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
    } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
    }
}

function setupFaceDeformation() {
    // draw face deformation model
    positions = ctrack.getCurrentPosition();
    fd.init(webgl); //document.getElementById('webgl'));
    if (positions != 0) {
        fd.load(video, positions, pModel);
        fd.draw(positions);
        pcontext.clearRect(0, 0, canvas.width, canvas.height);
        var radX = getDistance(positions[62][0], positions[62][1], positions[1][0], positions[1][1]);
        var radY = getDistance(positions[62][0], positions[62][1], positions[7][0], positions[7][1]);
        //console.log(radX+","+radY);
        pcontext.beginPath();
        pcontext.drawImage(img, positions[7][0] - radX * 1, positions[7][1] - radY * 1, radX * 2, radY * 2);

        pcontext.fillStyle = 'rgb(255,255,255)';
        pcontext.arc(positions[62][0], positions[62][1], radY * 1.1, 0, Math.PI * 2, false);
        pcontext.fill();

        /*pcontext.beginPath(); // 1.Pathで描画を開始する
        pcontext.moveTo(positions[7][0], positions[7][1]); // 2.描画する位置を指定する
        pcontext.lineTo(positions[7][0], positions[7][1] + 50); // 3.指定座標まで線を引く
        pcontext.stroke(); // 4.Canvas上に描画する
*/
        pcontext.closePath();
    }
}

function getDistance(posX1, posY1, posX2, posY2) {
    return Math.sqrt(Math.pow(posX1 - posX2, 2) + Math.pow(posY1 - posY2, 2));
};

var frame = function() {
    // キャンバス全体のピクセル情報を取得
    var imageData = fcontext.getImageData(0, 0, canvas.width, canvas.height);
    var width = imageData.width,
        height = imageData.height;
    var pixels = imageData.data; // ピクセル配列：RGBA4要素で1ピクセル
    // dataはUint8ClampedArray
    // 長さはcanvasの width * height * 4(r,g,b,a)
    // 先頭から、一番左上のピクセルのr,g,b,aの値が順に入っており、
    // 右隣のピクセルのr,g,b,aの値が続く
    // n から n+4 までが1つのピクセルの情報となる
    var aData = fcontext.createImageData(width, height);
    var a = aData.data;

    var w = width * 0.1;
    var h = height * 0.1;

    for (var y = 1; y < height - 1; y++) {
        for (var x = 1; x < width - 1; x++) {
            var base = (y * width + x) * 4;
            a[base + 0] = pixels[base + 0];
            a[base + 1] = pixels[base + 1];
            a[base + 2] = pixels[base + 2];
            if (w < x && x < width - w && h < y && y < height - h) {
                a[base + 3] = 0;
            } else {
                a[base + 3] = 255;
            }
        }
    }
    // 変更した内容をキャンバスに書き戻す
    fcontext.putImageData(aData, 0, 0);
};
