const Mat4 = require('pex-math/Mat4')

module.exports = function createDrawSolidColor (regl) {
  return regl({
    attributes: {
      aPosition: (_, props) => props.points
    },
    count: (_, props) => props.points.length,
    vert: `
    attribute vec3 aPosition;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    void main () {
      mat4 modelViewMatrix = uViewMatrix * uModelMatrix;
      gl_Position = uProjectionMatrix * modelViewMatrix * vec4(aPosition, 1.0);
      gl_PointSize = 1.0;
    }
    `,
      frag: `
      #ifdef GL_ES
      precision highp float;
      #endif

      uniform vec4 uColor;

      void main () {
        gl_FragColor = uColor;
      }
    `,
    primitive: (_, props) => props.primitive,
    uniforms: {
      uColor: (_, props) => props.color,
      uProjectionMatrix: (_, props) => props.camera.projectionMatrix,
      uViewMatrix: (_, props) => props.camera.viewMatrix,
      uModelMatrix: Mat4.create()
    }
  })
}
