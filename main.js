'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let sphere;
let userPoint;
let angle;
let texture, texture2, video, track, background, stereoCamera;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

function StereoCamera(
    Convergence,
    EyeSeparation,
    AspectRatio,
    FOV,
    NearClippingDistance,
    FarClippingDistance
) {
    this.mConvergence = Convergence;
    this.mEyeSeparation = EyeSeparation;
    this.mAspectRatio = AspectRatio;
    this.mFOV = FOV;
    this.mNearClippingDistance = NearClippingDistance;
    this.mFarClippingDistance = FarClippingDistance;

    this.mProjectionMatrix = null;
    this.mModelViewMatrix = null;

    this.ApplyLeftFrustum = function () {
        let top, bottom, left, right;
        top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
        bottom = -top;

        let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
        let b = a - this.mEyeSeparation / 2;
        let c = a + this.mEyeSeparation / 2;

        left = (-b * this.mNearClippingDistance) / this.mConvergence;
        right = (c * this.mNearClippingDistance) / this.mConvergence;

        // Set the Projection Matrix
        this.mProjectionMatrix = m4.frustum(
            left,
            right,
            bottom,
            top,
            this.mNearClippingDistance,
            this.mFarClippingDistance
        );

        // Displace the world to right
        this.mModelViewMatrix = m4.translation(
            this.mEyeSeparation / 2,
            0.0,
            0.0
        );
    };

    this.ApplyRightFrustum = function () {
        let top, bottom, left, right;
        top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
        bottom = -top;

        let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
        let b = a - this.mEyeSeparation / 2;
        let c = a + this.mEyeSeparation / 2;

        left = (-c * this.mNearClippingDistance) / this.mConvergence;
        right = (b * this.mNearClippingDistance) / this.mConvergence;

        // Set the Projection Matrix
        this.mProjectionMatrix = m4.frustum(
            left,
            right,
            bottom,
            top,
            this.mNearClippingDistance,
            this.mFarClippingDistance
        );

        // Displace the world to left
        this.mModelViewMatrix = m4.translation(
            -this.mEyeSeparation / 2,
            0.0,
            0.0
        );
    };

    this.updateValues = function () {
        let values = document.getElementsByClassName("value");
        let eyeSep = 70.0;
        eyeSep = document.getElementById("input1").value;
        values[0].innerHTML = eyeSep;
        this.mEyeSeparation = eyeSep;
        let ratio = 1.0;
        let fov = 0.8;
        fov = document.getElementById("input2").value;
        values[1].innerHTML = fov;
        this.mFOV = fov;
        let nearClip = 5.0;
        nearClip = document.getElementById("input3").value - 0.0;
        values[2].innerHTML = nearClip;
        this.mNearClippingDistance = nearClip
        let convergence = 2000.0;
        convergence = document.getElementById("input4").value;
        values[3].innerHTML = convergence;
        this.mConvergence = convergence
    }
}



// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iVertexTextureBuffer = gl.createBuffer();
    this.count = 0;
    this.textureCount = 0;

    this.BufferData = function (vertices) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        this.count = vertices.length / 3;
    }
    this.TextureBufferData = function (vertices) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexTextureBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        this.textureCount = vertices.length / 2;
    }

    this.Draw = function () {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexTextureBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertexTexture, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertexTexture);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
    }
    this.DrawSphere = function () {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
    }
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    this.iAttribVertexTexture = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.iTMU = -1;
    this.iUserPoint = -1;
    this.iAngle = 0;
    this.iTranslateSphere = -1;

    this.Use = function () {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
    gl.clearColor(1., 1., 1., 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI / 8, 1, 8, 12);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();
    let modelViewZeroParalax = m4.identity();

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);
    let matAccumZP =
        m4.multiply(m4.scaling(3.66, 3.66, 1),
            m4.multiply(m4.translation(-0.5, -0.5, -10),
                m4.multiply(m4.axisRotation([0.707, 0.707, 0], 0.0),
                    modelViewZeroParalax)))

    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccumZP);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);

    gl.uniform1i(shProgram.iTMU, 0);
    gl.enable(gl.TEXTURE_2D);
    gl.uniform2fv(shProgram.iUserPoint, [userPoint.x, userPoint.y]);
    gl.uniform1f(shProgram.iAngle, angle);
    gl.uniform1f(shProgram.iB, -1);

    gl.uniform3fv(shProgram.iTranslateSphere, [-0., -0., -0.])
    gl.bindTexture(gl.TEXTURE_2D, texture2);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        video
    );
    background.Draw();
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    stereoCamera.updateValues();
    stereoCamera.ApplyLeftFrustum()
    gl.colorMask(false, true, true, false);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, stereoCamera.mProjectionMatrix);
    surface.Draw();
    gl.clear(gl.DEPTH_BUFFER_BIT);
    stereoCamera.ApplyRightFrustum()
    gl.colorMask(true, false, false, false);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, stereoCamera.mProjectionMatrix);
    surface.Draw();
    gl.colorMask(true, true, true, true);

    // let translate = parametric(map(userPoint.x, 0, 1, -9, 9), map(userPoint.y, 0, 1, 1, 9))
    // gl.uniform3fv(shProgram.iTranslateSphere, [translate.x, translate.y, translate.z])
    // gl.uniform1f(shProgram.iB, 1);
    // sphere.DrawSphere();
}

function draww() {
    draw();
    window.requestAnimationFrame(draww);
}

function CreateSurfaceData()
{
    let vertexList = [];        
    let vertexListTest = []

    let L = 4;
    /*let B = 0.5;
    let T = 2;*/

    for(let u = 0; u < 1; u +=0.05)
    {
        for(let v = 0; v < 150; v += 0.05) {
            let x = calcuateX(L, u);
            let y = calcuateY(1,v);
            let z = calcuateZ(1,v);
            vertexListTest.push(x, y, z);
        }

    }

    for(let i = 0; i <= vertexListTest.length - 9003; i += 3){
        vertexList.push(vertexListTest[i]);
        vertexList.push(vertexListTest[i+1]);
        vertexList.push(vertexListTest[i+2]);
        vertexList.push(vertexListTest[i + 9003]);
        vertexList.push(vertexListTest[i + 9004]);
        vertexList.push(vertexListTest[i + 9005]);
   }

    return vertexList;
}

function map(val, f1, t1, f2, t2) {
    let m;
    m = (val - f1) * (t2 - f2) / (t1 - f1) + f2
    return Math.min(Math.max(m, f2), t2);
}

function CreateSurfaceTextureData() {
    let vertexTextureList = [];
    const INC = 0.05
    for(let u = 0; u < 1; u +=0.05)
    {
        for(let v = 0; v < 150; v += 0.05) {
            let u1 = map(u, 0, 1, 0, 1)
            let v1 = map(v, 0, 150, 0, 1)
            vertexTextureList.push(u1, v1)
            u1 = map(u + INC, 0, 1, 0, 1)
            vertexTextureList.push(u1, v1)
            u1 = map(u, 0, 1, 0, 1)
            v1 = map(v + INC, 0, 150, 0, 1)
            vertexTextureList.push(u1, v1)
            u1 = map(u + INC, 0, 1, 0, 1)
            v1 = map(v, 0, 150, 0, 1)
            vertexTextureList.push(u1, v1)
            v1 = map(v + INC, 0, 150, 0, 1)
            vertexTextureList.push(u1, v1)
            u1 = map(u, 0, 1, 0, 1)
            v1 = map(v + INC, 0, 150, 0, 1)
            vertexTextureList.push(u1, v1)
        }
    }
    return vertexTextureList;
}

function parametric(u, v) {
    let L = 4;
    let x = calcuateX(L, u);
    let y = calcuateY(1,v);
    let z = calcuateZ(1,v);

    return {
        x: x,
        y: y,
        z: z
    }
}

function calcuateX(L, u){
    return L * u;
}

function calcuateY(a,p){
    //return 2.5426 * B * (1 - u) * Math.sqrt((1 - v)/( 1/3 + v));
    return (3 * a * p * p) / (1 + Math.pow(p,3));
}

function calcuateZ(a,p){
    //return (T * u) / Math.sqrt(3) + T * (1 - v);
    return (3 * a * p) / (1 + Math.pow(p,3));

}



/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribVertexTexture = gl.getAttribLocation(prog, "vertexTexture");
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iTMU = gl.getUniformLocation(prog, 'TMU');
    shProgram.iUserPoint = gl.getUniformLocation(prog, 'userPoint');;
    shProgram.iAngle = gl.getUniformLocation(prog, 'rotate');
    shProgram.iTranslateSphere = gl.getUniformLocation(prog, 'translateSphere');
    shProgram.iB = gl.getUniformLocation(prog, 'b');

    LoadTexture()
    surface = new Model('Surface');
    surface.BufferData(CreateSurfaceData());
    surface.TextureBufferData(CreateSurfaceTextureData());
    sphere = new Model('Sphere');
    sphere.BufferData(CreateSphereSurface())
    background = new Model('Background')
    background.BufferData([0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0]);
    background.TextureBufferData([1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1]);
    gl.enable(gl.DEPTH_TEST);
}

function CreateSphereSurface(r = 0.05) {
    let vertexList = [];
    let lon = -Math.PI;
    let lat = -Math.PI * 0.5;
    while (lon < Math.PI) {
        while (lat < Math.PI * 0.5) {
            let v1 = sphereSurfaceDate(r, lon, lat);
            let v2 = sphereSurfaceDate(r, lon + 0.5, lat);
            let v3 = sphereSurfaceDate(r, lon, lat + 0.5);
            let v4 = sphereSurfaceDate(r, lon + 0.5, lat + 0.5);
            vertexList.push(v1.x, v1.y, v1.z);
            vertexList.push(v2.x, v2.y, v2.z);
            vertexList.push(v3.x, v3.y, v3.z);
            vertexList.push(v2.x, v2.y, v2.z);
            vertexList.push(v4.x, v4.y, v4.z);
            vertexList.push(v3.x, v3.y, v3.z);
            lat += 0.5;
        }
        lat = -Math.PI * 0.5
        lon += 0.5;
    }
    return vertexList;
}

function sphereSurfaceDate(r, u, v) {
    let x = r * Math.sin(u) * Math.cos(v);
    let y = r * Math.sin(u) * Math.sin(v);
    let z = r * Math.cos(u);
    return { x: x, y: y, z: z };
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    stereoCamera = new StereoCamera(
        2000,
        70.0,
        1,
        0.8,
        5,
        100
    );
    let canvas;
    userPoint = { x: 0.7, y: 0.6 }
    angle = 0.0;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        video = document.createElement('video');
        video.setAttribute('autoplay', true);
        window.vid = video;
        getWebcam();
        texture2 = CreateWebCamTexture();
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    draww();
}

function LoadTexture() {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const image = new Image();
    image.crossOrigin = 'anonymus';

    image.src = "https://raw.githubusercontent.com/ChyzhykNazar/MSVR/PA1/texture.jpeg";
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );
        draw()
    }
}

function getWebcam() {
    navigator.getUserMedia({ video: true, audio: false }, function (stream) {
        video.srcObject = stream;
        track = stream.getTracks()[0];
    }, function (e) {
        console.error('Rejected!', e);
    });
}

function CreateWebCamTexture() {
    let textureID = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textureID);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return textureID;
}