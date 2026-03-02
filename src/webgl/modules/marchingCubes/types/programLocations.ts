export type ProgramLocations = {
    attributes: {
        position: number;
    };
    uniforms: {
        chunkOffset: WebGLUniformLocation;
        modelMatrix: WebGLUniformLocation;
        viewMatrix: WebGLUniformLocation;
        projectionMatrix: WebGLUniformLocation;
        lightDirection: WebGLUniformLocation;
    };
}