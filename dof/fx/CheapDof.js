//## Reference

//Dependencies
var FXStage = require('pex-fx/FXStage');
var glslify = require('glslify-sync');

var VERT = glslify(__dirname + '/ScreenImage.vert');
var FRAG = glslify(__dirname + '/CheapDof.frag');

//### Dof(options)
//Depth of Field
//`options` - available options:
//  `blurredTex` -
//  `depthMap` -
//  `focus plane` -

FXStage.prototype.cheapDof = function (options) {
    var ctx = this.ctx;
    options = options || {};
    var blurredTex = options.blurredTex;
    var depthMap = options.depthMap;
    var outputSize = this.getOutputSize(options.width, options.height);
    var rt = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);

    var program = this.getShader(VERT, FRAG);

    ctx.pushState(ctx.FRAMEBUFFER_BIT | ctx.TEXTURE_BIT | ctx.PROGRAM_BIT);
        ctx.bindFramebuffer(rt);
        ctx.setClearColor(0,0,0,0);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);

        ctx.bindTexture(this.getSourceTexture(), 0)
        ctx.bindTexture(this.getSourceTexture(blurredTex), 1)
        ctx.bindTexture(this.getSourceTexture(depthMap), 2)

        ctx.bindProgram(program);
        program.setUniform('colorTex', 0);
        program.setUniform('blurredTex', 1);
        program.setUniform('depthMap', 2);
        program.setUniform('depth', options.depth);
        program.setUniform('depthRange', options.depthRange);
        program.setUniform('near', options.camera.getNear());
        program.setUniform('far', options.camera.getFar());

        this.drawFullScreenQuad(outputSize.width, outputSize.height, null, program);
    ctx.popState(ctx.FRAMEBUFFER_BIT | ctx.TEXTURE_BIT | ctx.PROGRAM_BIT);

    return this.asFXStage(rt, 'dof');
};

module.exports = FXStage;
