function OITRenderer() {
    /** A low resolution version of m_oitFramebuffer. */
    this.m_oitLowResFramebuffer = null; //Framebuffer

    /** Used for resampling normals during computeLowResDepthAndNormals. Has a single
        RG8_SNORM texture that is camera-space octahedrally encoded normals. */
    this.m_csOctLowResNormalFramebuffer = null; //Framebuffer

    /** Captured image of the background used for blurs */
    this.m_backgroundFramebuffer = null; //Framebuffer

    this.m_blurredBackgroundFramebuffer = null; //Framebuffer

    this.m_lowResDownsampleFactor = 2;
    this.m_upsampleFilterRadius = 2;
    this.m_highPrecision = false;

    this.textures = [];

    this.reloadWriteDeclaration();
}

OITRenderer.prototype.reloadWriteDeclaration = function() {
    //TODO: reloadWriteDeclaration
    //const String& originalDeclaration = readWholeFile(System::findDataFile("shader/OITRenderer/OITRenderer_writePixel.glsl"));
    //const String& declarationWithCarriageReturns = stringJoin(stringSplit(originalDeclaration, '\n'), "");
    //m_oitWriteDeclaration = stringJoin(stringSplit(declarationWithCarriageReturns, '\r'), "");
}

OITRenderer.prototype.allocateOITFramebuffer = function(ctx, w, h, highPrecision, depthTex, name, suffix) {
    var color0 = ctx.createTexture2D(null, w, h, { format: ctx.RGBA, type: highPrecision ? ctx.FLOAT : ctx.HALF_FLOAT });
    color0.name = "OIT RT0 (A)" + suffix; //FIXME: attaching props to a class instance
    color0.clearValue = [0,0,0,0];
    this.textures.push(color0);

    var color1 = ctx.createTexture2D(null, w, h, { format: ctx.RGBA, type: highPrecision ? ctx.FLOAT : ctx.UNSIGNED_BYTE });
    color1.name = "OIT RT1 (Brgb, D)" + suffix;
    color1.clearValue = [1,1,1,0];
    this.textures.push(color1);

    var color2 = ctx.createTexture2D(null, w, h, { format: ctx.RGBA, type: highPrecision ? ctx.FLOAT : ctx.UNSIGNED_BYTE }); //RG32F
    color2.name = "OIT RT2 (delta)" + suffix;
    this.textures.push(color2);

    if (!depthTex) {
        //assuming main depth buffer is the same format
        depthTex = ctx.createTexture2D(null, w, h, { magFilter: ctx.NEAREST, minFilter: ctx.NEAREST, format: ctx.DEPTH_COMPONENT, type: ctx.UNSIGNED_SHORT });
        depthTex.name = "OIT Depth" + suffix;
        this.textures.push(depthTex);
    }

    var fbo = ctx.createFramebuffer([
        { texture: color0 },
        { texture: color1 },
        { texture: color2 }
    ], { texture: depthTex });

    fbo.name = name;
    return fbo;
}

OITRenderer.prototype.allocateAllOITBuffers = function(ctx, width, height, highPrecision, screenDepthBuf) {
    var lowResWidth  = width / this.m_lowResDownsampleFactor;
    var lowResHeight = height / this.m_lowResDownsampleFactor;

    this.m_oitFramebuffer = this.allocateOITFramebuffer(ctx, width, height, highPrecision, screenDepthBuf, "OITRenderer::m_oitFramebuffer", "");
    this.m_oitLowResFramebuffer = this.allocateOITFramebuffer(ctx, lowResWidth, lowResHeight, null, highPrecision, "OITRenderer::m_oitLowResFramebuffer", " [Low-Res]");

    var backgroundTexture = ctx.createTexture2D(null, width, height, { format: ctx.RGBA, type: ctx.FLOAT });
    backgroundTexture.name = "OITRenderer::backgroundTexture";
    this.textures.push(backgroundTexture);
    this.m_backgroundFramebuffer = ctx.createFramebuffer([ { texture: backgroundTexture } ]);

    var backgroundBlurredTexture = ctx.createTexture2D(null, width, height, { format: ctx.RGBA, type: ctx.FLOAT });
    backgroundBlurredTexture.name = "OITRenderer::backgroundBlurredTexture";
    this.textures.push(backgroundBlurredTexture);
    var radiusBlurredTexture = ctx.createTexture2D(null, width, height, { format: ctx.RGBA, type: ctx.FLOAT }); //R32F
    radiusBlurredTexture.name = "OITRenderer::radiusBlurredTexture";
    this.textures.push(radiusBlurredTexture);
    this.m_blurredBackgroundFramebuffer = ctx.createFramebuffer([
        { texture: backgroundBlurredTexture },
        { texture: radiusBlurredTexture }
    ]);
    this.m_blurredBackgroundFramebuffer.name = "OITRenderer::blurredBackgroundFramebuffer";

    var csOctLowResNormalFramebufferTexture = ctx.createTexture2D(null, width, height, { format: ctx.RGBA, type: ctx.UNSIGNED_BYTE }); //RG8_SNORM
    csOctLowResNormalFramebufferTexture.name = "OITRenderer::csOctLowResNormalFramebufferTexture";
    this.textures.push(csOctLowResNormalFramebufferTexture);
    this.m_csOctLowResNormalFramebuffer = ctx.createFramebuffer([
        { texture: csOctLowResNormalFramebufferTexture }
    ]);
    this.m_csOctLowResNormalFramebuffer.name = "OITRenderer::csOctLowResNormalFramebuffer";
}

OITRenderer.prototype.renderOrderIndependentBlendedSamples = function(ctx, width, height, surfaces, screenColorBuf, screenDepthBuf, gbuffer, env) {
    if (!surfaces.length) {
        return;
    }

    // Categorize the surfaces by desired resolution

    var hiResSurfaces = surfaces;
    var loResSurfaces = []; // FIXME: not used by now

    var lowResWidth  = width / this.m_lowResDownsampleFactor;
    var lowResHeight = height / this.m_lowResDownsampleFactor;

    //allocate OIT buffers on the first use
    if (!this.m_oitFramebuffer) {
        //screenDepthBuf will be reused in m_oitFramebuffer
        this.allocateAllOITBuffers(ctx, width, height, this.m_highPrecision, screenDepthBuf);
    }

    //TODO: resizeBuffersIfNeeded(rd->width(), rd->height(), lowResWidth, lowResHeight);

    // Re-use the depth from the main framebuffer (for depth testing only)

    // Copy the current color buffer to the background buffer, since we'll be compositing into
    // the color buffer at the end of the OIT process
    /*
    rd->drawFramebuffer()->blitTo(rd, m_backgroundFramebuffer, false, false, false, false, true);


    ////////////////////////////////////////////////////////////////////////////////////
    //
    // Accumulation pass over (3D) transparent surfaces
    //
    const shared_ptr<Framebuffer> oldBuffer = rd->drawFramebuffer();

    clearAndRenderToOITFramebuffer(m_oitFramebuffer, rd, hiResSurfaces, gbuffer, environment);

    if (loResSurfaces.size() > 0) {
        // Create a low-res copy of the depth (and normal) buffers for depth testing and then
        // for use as the key for bilateral upsampling.
        computeLowResDepthAndNormals(rd, gbuffer->texture(GBuffer::Field::CS_NORMAL));

        clearAndRenderToOITFramebuffer(m_oitLowResFramebuffer, rd, loResSurfaces, gbuffer, environment);
        rd->push2D(m_oitFramebuffer); {
            // Set blending modes
            // Accum (A)
            rd->setBlendFunc(RenderDevice::BLEND_ONE, RenderDevice::BLEND_ONE, RenderDevice::BLENDEQ_ADD, RenderDevice::BLENDEQ_SAME_AS_RGB, Framebuffer::COLOR0);

            // Background modulation (beta) and diffusion (D)
            rd->setBlendFunc(Framebuffer::COLOR1,
                RenderDevice::BLEND_ZERO, RenderDevice::BLEND_ONE_MINUS_SRC_COLOR, RenderDevice::BLENDEQ_ADD,
                RenderDevice::BLEND_ONE, RenderDevice::BLEND_ONE, RenderDevice::BLENDEQ_ADD);

            // Delta (refraction)
            rd->setBlendFunc(RenderDevice::BLEND_ONE, RenderDevice::BLEND_ONE, RenderDevice::BLENDEQ_ADD, RenderDevice::BLENDEQ_SAME_AS_RGB, Framebuffer::COLOR2);

            Args args;
            args.setMacro("FILTER_RADIUS",                              m_upsampleFilterRadius);

            args.setUniform("sourceDepth",                              m_oitLowResFramebuffer->texture(Framebuffer::DEPTH), Sampler::buffer());
            args.setUniform("destDepth",                                m_oitFramebuffer->texture(Framebuffer::DEPTH), Sampler::buffer());
            args.setUniform("sourceSize",                               Vector2(float(m_oitLowResFramebuffer->width()), float(m_oitLowResFramebuffer->height())));
            args.setUniform("accumTexture",                             m_oitLowResFramebuffer->texture(0), Sampler::buffer());
            args.setUniform("backgroundModulationAndDiffusionTexture",  m_oitLowResFramebuffer->texture(1), Sampler::buffer());
            args.setUniform("deltaTexture",                             m_oitLowResFramebuffer->texture(2), Sampler::buffer());
            args.setUniform("downsampleFactor",                         m_lowResDownsampleFactor);

            const shared_ptr<Texture>& destNormal = gbuffer->texture(GBuffer::Field::CS_NORMAL);
            if (notNull(destNormal)) {
                args.setMacro("HAS_NORMALS", true);
                destNormal->setShaderArgs(args, "destNormal.", Sampler::buffer());
                args.setUniform("sourceOctNormal", m_csOctLowResNormalFramebuffer->texture(0), Sampler::buffer());
            } else {
                args.setMacro("HAS_NORMALS", false);
            }

            args.setRect(rd->viewport());
            LAUNCH_SHADER("OITRenderer_upsample.pix", args);
        } rd->pop2D();
    }

    // Remove the color buffer binding which is shared with the main framebuffer, so that we don't
    // clear it on the next pass through this function. Not done for colored OIT
    // m_oitFramebuffer->set(Framebuffer::COLOR2, shared_ptr<Texture>());
    rd->setFramebuffer(oldBuffer);

    ////////////////////////////////////////////////////////////////////////////////////
    //
    // 2D compositing pass
    //

    rd->push2D(); {
        rd->setDepthTest(RenderDevice::DEPTH_ALWAYS_PASS);
        Args args;
        m_backgroundFramebuffer->texture(0)->setShaderArgs(args, "backgroundTexture.", Sampler(WrapMode::CLAMP, InterpolateMode::BILINEAR_NO_MIPMAP));

        const Projection& projection = gbuffer->camera()->projection();
        const float ppd = 0.05f * rd->viewport().height() / tan(projection.fieldOfViewAngles(rd->viewport()).y);
        args.setUniform("pixelsPerDiffusion2", square(ppd));

        m_oitFramebuffer->texture(0)->setShaderArgs(args, "accumTexture.", Sampler::buffer());
        m_oitFramebuffer->texture(1)->setShaderArgs(args, "backgroundModulationAndDiffusionTexture.", Sampler::buffer());
        m_oitFramebuffer->texture(2)->setShaderArgs(args, "deltaTexture.", Sampler::buffer());
        args.setRect(rd->viewport());
        LAUNCH_SHADER("OITRenderer_compositeWeightedBlendedOIT.pix", args);
    } rd->pop2D();

    hiResSurfaces.fastClear();
    loResSurfaces.fastClear();
    */
}

module.exports = OITRenderer;
