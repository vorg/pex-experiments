var wordwrap = require('word-wrapper');

function SpriteTextBox(ctx, text, opts) {
    this.ctx = ctx;
    this.text = text;
    this.opts = opts;
    this.opts.lineHeight = this.opts.lineHeight || 1;
    if (this.opts.fontSize) {
        this.opts.scale = this.opts.fontSize / this.opts.font.info.size;
    }

    if (!opts.font) {
        throw 'BMFont required in opts = { font: {} }';
    }

    this.vertices = [[0,0,0]];
    this.texCoords = [[0,0]];
    this.faces = [[0,0,0]];
    this.edges = [[0,0]];
    //this.geometry = new Geometry({ vertices: true, texCoords: true, faces: true });
    //this.geometry.computeEdges();
    //this.mesh = new Mesh(this.geometry, this.material, { triangles: true });
    //
    this.mesh = ctx.createMesh([
        { data: this.vertices, location: ctx.ATTRIB_POSITION, size: 3 },
        { data: this.texCoords, location: ctx.ATTRIB_TEX_COORD_0, size: 2 }
    ], { data: this.faces })

    this.debugMesh = ctx.createMesh([
        { data: this.vertices, location: ctx.ATTRIB_POSITION, size: 3 }
    ], { data: this.edges }, ctx.LINES)

    this.rebuild(this.text);
}

SpriteTextBox.prototype.getCharInfo = function(c) {
    var charCode = c.charCodeAt(0);
    var chars = this.opts.font.chars;
    for(var i=0; i<chars.length; i++) {
        if (chars[i].id == charCode) {
            return chars[i];
        }
    }
}

SpriteTextBox.prototype.getKerning = function(firstChar, secondChar) {
    var firstCharCode = firstChar.charCodeAt(0);
    var secondCharCode = secondChar.charCodeAt(0);
    var kernings = this.opts.font.kernings;
    var kerning = null;
    for(var i=0; i<kernings.length; i++) {
        if (kernings[i].first == firstCharCode &&  kernings[i].second == secondCharCode) {
            kerning = kernings[i];
            break;
        }
    }
    if (kerning) {
        return kerning.amount;
    }
    else {
        return 0;
    }
}

SpriteTextBox.prototype.setFontSize = function(fontSize) {
    if (fontSize != this.opts.fontSize) {
        this.opts.fontSize = fontSize;
        this.opts.scale = this.opts.fontSize / this.opts.font.info.size;
        this.rebuild(this.text);
    }
}

SpriteTextBox.prototype.rebuild = function(text) {
    var vertices = this.vertices;
    var texCoords = this.texCoords;
    var faces = this.faces;
    var edges = this.edges;

    //TODO: we could reuse the existing data
    vertices.length = 0;
    texCoords.length = 0;
    faces.length = 0;
    edges.length = 0;

    var dx = 0;
    var dy = 0;
    var textureWidth = this.opts.font.common.scaleW;
    var textureHeight = this.opts.font.common.scaleH;
    var fontBaseHeight = this.opts.font.common.base;
    var lineHeight = this.opts.font.common.lineHeight;
    var fontSize = this.opts.font.info.size;
    var kernings = this.opts.font.info.kernings;
    var index = 0;

    function measure(text, start, end, width) {
        var dx = 0;
        var i = start;
        for(; i<end; i++) {
            var charInfo = this.getCharInfo(text[i]);
            var kerning = 0;
            if (i > start) {
                kerning = this.getKerning(text[i], text[i-1]);
            }

            dx += charInfo.xadvance + kerning;
            if (dx > width) break;
        }

        return {
            start: start,
            end: i
        }
    }

    var lines = this.text;

    if (this.opts.wrap) {
        lines = wordwrap(this.text, { width: this.opts.wrap / this.opts.scale, measure: measure.bind(this) }).split('\n');
    }

    lines.forEach(function(line) {
        dx = 0;
        for(var i=0; i<line.length; i++) {
            var charInfo = this.getCharInfo(line[i]);
            if (!charInfo) {
                charInfo = this.getCharInfo('?');
            }
            if (!charInfo) {
                continue;
            }


            //texture coords
            var tx = charInfo.x / textureWidth;
            var ty = charInfo.y / textureHeight;
            var tw = charInfo.width / textureWidth;
            var th = charInfo.height / textureHeight;

            var w = charInfo.width;
            var h = charInfo.height;

            var kerning = 0;

            if (i > 0) {
                kerning = this.getKerning(line[i], line[i-1]);
            }

            //
            //     3--------2
            //     |         _/ |
            //     |    __/     |
            //     | /            |
            //     0--------1
            //

            //https://www.mapbox.com/blog/text-signed-distance-fields/
            //https://github.com/libgdx/libgdx/wiki/Distance-field-fonts
            //http://www.angelcode.com/products/bmfont/doc/render_text.html

            vertices.push([dx         + charInfo.xoffset + kerning, dy + h + charInfo.yoffset, 0]);
            vertices.push([dx + w + charInfo.xoffset + kerning, dy + h + charInfo.yoffset, 0]);
            vertices.push([dx + w + charInfo.xoffset + kerning, dy         + charInfo.yoffset, 0]);
            vertices.push([dx         + charInfo.xoffset + kerning, dy         + charInfo.yoffset, 0]);
            texCoords.push([tx         , 1.0 - ty - th]);
            texCoords.push([tx + tw, 1.0 - ty - th]);
            texCoords.push([tx + tw, 1.0 - ty         ]);
            texCoords.push([tx         , 1.0 - ty         ]);
            faces.push([index, index + 1, index + 2]);
            faces.push([index, index + 2, index + 3]);
            edges.push([index, index + 1]);
            edges.push([index + 1, index + 2]);
            edges.push([index + 2, index + 3]);
            edges.push([index + 3, index]);
            index += 4;
            dx += charInfo.xadvance + kerning;
        }
        dy += lineHeight * this.opts.lineHeight;
    }.bind(this));

    var ctx = this.ctx;
    this.mesh.updateAttribute(ctx.ATTRIB_POSITION, vertices);
    this.mesh.updateAttribute(ctx.ATTRIB_TEX_COORD_0, texCoords);
    this.mesh.updateIndices(faces);

    this.debugMesh.updateAttribute(ctx.ATTRIB_POSITION, vertices);
    this.debugMesh.updateIndices(edges);

    ctx.getGL().finish()
}

SpriteTextBox.prototype.dispose = function() {
    //this.mesh.dispose();
    //this.debugMesh.dispose();
}


module.exports = SpriteTextBox;
