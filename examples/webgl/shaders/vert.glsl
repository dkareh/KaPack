#version 300 es

// This is a uniform block. Its name is UniformBlock, but within
// the shader it's referred to as Transform.
layout(std140) uniform UniformBlock {
    float scale;
    vec2 translate;
} Transform;

layout(location = 0) in vec2 a_position;

void main() {
    gl_Position = vec4(a_position * Transform.scale + Transform.translate, 0.0, 1.0);
}