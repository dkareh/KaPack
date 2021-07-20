import sceneConfig from "./scene.json";

const $ = document.querySelector.bind(document);

const canvas = $("#canvas");
const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true
});

if (window.parent.__requestAnimFrameId) {
    cancelAnimationFrame(window.parent.__requestAnimFrameId);
}
window.parent.__requestAnimFrameId = requestAnimationFrame(loop);

const initialTime = performance.now();
function loop() {
    window.parent.__requestAnimFrameId = requestAnimationFrame(loop);
    const currentTime = performance.now();
    try {
        render((currentTime - initialTime) / 1000);
    } catch (error) {
        console.error(error);
        cancelAnimationFrame(window.parent.__requestAnimFrameId);
    }
}

const vertShaderSource = $("#vert-shader").text.trim();
const limeFragShaderSource = $("#lime-frag-shader").text.trim();
const pinkFragShaderSource = $("#pink-frag-shader").text.trim();

const vertShader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertShader, vertShaderSource);
gl.compileShader(vertShader);
if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
    throw new Error("vertShader: " + gl.getShaderInfoLog(vertShader));
}

const limeFragShader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(limeFragShader, limeFragShaderSource);
gl.compileShader(limeFragShader);
if (!gl.getShaderParameter(limeFragShader, gl.COMPILE_STATUS)) {
    throw new Error("limeFragShader: " + gl.getShaderInfoLog(limeFragShader));
}

const pinkFragShader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(pinkFragShader, pinkFragShaderSource);
gl.compileShader(pinkFragShader);
if (!gl.getShaderParameter(pinkFragShader, gl.COMPILE_STATUS)) {
    throw new Error("pinkFragShader: " + gl.getShaderInfoLog(pinkFragShader));
}

const limeProgram = gl.createProgram();
gl.attachShader(limeProgram, vertShader);
gl.attachShader(limeProgram, limeFragShader);
gl.linkProgram(limeProgram);
if (!gl.getProgramParameter(limeProgram, gl.LINK_STATUS)) {
    throw new Error("limeProgram: " + gl.getProgramInfoLog(limeProgram));
}

const pinkProgram = gl.createProgram();
gl.attachShader(pinkProgram, vertShader);
gl.attachShader(pinkProgram, pinkFragShader);
gl.linkProgram(pinkProgram);
if (!gl.getProgramParameter(pinkProgram, gl.LINK_STATUS)) {
    throw new Error("pinkProgram: " + gl.getProgramInfoLog(pinkProgram));
}

const limeBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, limeBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -0.9, +0.9,
    +0.9, +0.9,
    +0.9, +0.1,

    -0.9, +0.9,
    -0.9, +0.1,
    +0.9, +0.1,
]), gl.STATIC_DRAW);

const pinkBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, pinkBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -0.9, -0.1,
    +0.9, -0.1,
    +0.9, -0.9,

    -0.9, -0.1,
    -0.9, -0.9,
    +0.9, -0.9,
]), gl.STATIC_DRAW);

gl.enableVertexAttribArray(0); // a_position location == 0

// Okay, time to work with UBOs.

// 1. Create a uniform buffer. This buffer contains the data
// for the uniform block.
const uniformBuffer = gl.createBuffer();
gl.bindBuffer(gl.UNIFORM_BUFFER, uniformBuffer);
gl.bufferData(gl.UNIFORM_BUFFER, new Float32Array([
    // Okay, in the vertex shader, we specified the layout
    // of the uniform block to be std140. This is a standard
    // layout that is the same on any implementation of
    // WebGL. In our case, we have a vec2 and a float.
    // The float goes first, which is scale in our case.
    0.9,

    // Next up is the vec2, which is translate. vec2s must
    // be aligned to the size of two floats. What that means
    // is that the offset of the first byte in a vec2 from
    // the start of the buffer must be a multiple of 2 times
    // the size of a float. But currently we only have an
    // offset of one float currently, because of scale. So
    // we need padding in between the data.
    0.0,

    // Now we can put our translate data as you'd expect.
    0.1, -0.1

    // For information about how to determine more complex
    // layouts, see:
    // https://learnopengl.com/Advanced-OpenGL/Advanced-GLSL
    // Scroll down until about the middle of the page, to
    // the section titled "Uniform block layout." Or you can
    // look at the official specification:
    // https://www.khronos.org/registry/OpenGL/specs/gl/glspec45.core.pdf#page=159
]), gl.DYNAMIC_DRAW);

// If you're not using the std140 layout, then the layout
// can depend on your system and you need to query
// information. I honestly don't know exactly how to do
// this. I'll figure it out later and I might make another
// webpage showing the correct steps.

// 2. Get the index of the uniform block in each program.
// This is similar to getAttribLocation for attributes.
const limeUniformBlockIndex = gl.getUniformBlockIndex(limeProgram, "UniformBlock");
const pinkUniformBlockIndex = gl.getUniformBlockIndex(pinkProgram, "UniformBlock");

// 3. Bind each block in each program to a binding point.
// Multiple blocks can be bound to the same binding point.
// This is how shaders can share uniform data. This can
// be done once for the entire duration of the program.
gl.uniformBlockBinding(limeProgram, limeUniformBlockIndex, 0);
gl.uniformBlockBinding(pinkProgram, pinkUniformBlockIndex, 0);

// 4. Finally, bind a uniform buffer object to the same
// binding point. Now the data from the buffer can be
// used as uniforms in the different programs. Again,
// this can be done once for the entire duration of the
// program.
gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, uniformBuffer);

gl.clearColor(0.15, 0.15, 0.2, 1.0);
function render(time) {
    if (canvas.clientWidth !== canvas.width || canvas.clientHeight !== canvas.height) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Now, when you want to change the uniforms, you
    // can just change the entire buffer in one swift
    // operation. Everything else is already in place.
    // This makes it much more efficient!
    gl.bindBuffer(gl.UNIFORM_BUFFER, uniformBuffer);
    gl.bufferData(gl.UNIFORM_BUFFER, new Float32Array([
        // float scale
        Math.cos(time * 2) * 0.2 + 0.8,

        0.0,

        // vec2 translate
        Math.cos(time) * 0.1,
        Math.sin(time) * 0.1,
    ]), gl.DYNAMIC_DRAW);

    gl.useProgram(limeProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, limeBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(pinkProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, pinkBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}