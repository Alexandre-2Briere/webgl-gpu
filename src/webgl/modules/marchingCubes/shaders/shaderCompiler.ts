import { ProgramLocations } from "../types/programLocations";

function compileShader(
    gl: WebGL2RenderingContext,
    source: string,
    type: number
): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
        throw new Error('Failed to create shader object');
    }

    gl.shaderSource(shader, source.trim());
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compilation failed:\n${log}`);
    }

    return shader;
}

function createProgram(
    gl: WebGL2RenderingContext,
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader
): WebGLProgram {
    const program = gl.createProgram();
    if (!program) {
        throw new Error('Failed to create shader program');
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Program linking failed:\n${log}`);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
}

export function compileShaderCustom(context: WebGL2RenderingContext, vertexShaderSource: string, fragmentShaderSource: string): WebGLProgram {
    const vertexShader = compileShader(context, vertexShaderSource, context.VERTEX_SHADER);
    const fragmentShader = compileShader(context, fragmentShaderSource, context.FRAGMENT_SHADER);
    return createProgram(context, vertexShader, fragmentShader);
}

export function getProgramLocations(
    gl: WebGL2RenderingContext,
    program: WebGLProgram
): ProgramLocations {
    const position = gl.getAttribLocation(program, 'aPosition');
    if (position === -1) {
        throw new Error('Could not find attribute aPosition');
    }

    const modelMatrix = gl.getUniformLocation(program, 'uModelMatrix');
    const viewMatrix = gl.getUniformLocation(program, 'uViewMatrix');
    const projectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');
    const lightDirection = gl.getUniformLocation(program, 'uLightDirection');
    const chunkOffset = gl.getUniformLocation(program, 'uChunkOffset');

    if (!modelMatrix || !viewMatrix || !projectionMatrix || !lightDirection || !chunkOffset) {
        throw new Error('Could not find one or more uniform locations');
    }

    return {
        attributes: { position },
        uniforms: { modelMatrix, viewMatrix, projectionMatrix, lightDirection, chunkOffset },
    };
}