var Window          = require('pex-sys/Window')
var PerspCamera     = require('pex-cam/PerspCamera')
var Arcball         = require('pex-cam/Arcball')
var createCube      = require('primitive-cube')
var glslify         = require('glslify-promise')
var isBrowser       = require('is-browser')
var fs              = require('fs')
var debug           = require('debug')
var isBrowser       = require('is-browser')
var R               = require('ramda')
//debug.enable('event-log')
var eventLog        = debug('event-log')

var NodesFile = __dirname + '/nodes.json'

function SaveNodes() {
    var str = JSON.stringify(Nodes, null, 2)
    if (isBrowser) {
        localStorage.graph = str
    }
    else {
        fs.writeFileSync(NodesFile, str)
    }
}

function LoadNodes() {
    var str = '[]';
    if (isBrowser) {
        if (localStorage.graph) {
            str = localStorage.graph;
        }
    }
    else {
        if (fs.existsSync(NodesFile)) {
            str = fs.readFileSync(NodesFile, 'utf8')
        }
    }

    return JSON.parse(str)
}

var NodeWidth = 80
var NodeHeight = 30

var Nodes = LoadNodes()

function HitTestNodes(x, y) {
    return Nodes.filter(function(node) {
        return (node.x < x && node.x + node.width > x && node.y < y && node.y + node.height > y)
    })
}

function DeselectNodes() {
    Nodes.forEach(function(node) {
        node.selected = false;
    })

    SaveNodes()
}

function SelectNodes(nodes) {
    nodes.forEach(function(node) {
        node.selected = true;
    })
}

function DeselectDropTargetNodes() {
    Nodes.forEach(function(node) {
        node.dropTarget = false;
    })
}

function SelectDropTargetNodes(nodes) {
    nodes.forEach(function(node) {
        node.dropTarget = true;
    })
}

function AddNode(node) {
    Nodes.push(node)
    SaveNodes()
}

function MoveNode(node, x, y) {
    node.x = x;
    node.y = y;

    SaveNodes()
}

function RemoveNodes(nodes) {
    nodes.forEach(function(node) {
        var idx = R.findIndex(R.propEq('id', node.id), Nodes);
        Nodes.splice(idx, 1);
    })
    SaveNodes();
}

function cmpNumber(a, b) {
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
}

var NextNodeId = (R.pluck('id', Nodes).sort(cmpNumber).reverse()[0] || 0) + 1

var GraphEvents = {
    cancelClick: false,
    isDown: false,
    lastClick: 0,
    selectedNodes: [],
    dropTargetNodes: [],
    dragOffsetX: 0,
    dragOffsetY: 0,
    onMouseDown: function(e) {
        eventLog('down')

        var hits = HitTestNodes(e.x, e.y)
        this.selectedNodes = hits;

        DeselectNodes()

        if (hits.length > 0) {
            this.cancelClick = true
            this.dragOffsetX = hits[0].x - e.x;
            this.dragOffsetY = hits[0].y - e.y;
            SelectNodes(hits)
        }
        else {
        }
    },
    onMouseUp: function(e) {
        eventLog('up')
        if (!this.cancelClick) {
            this.onClick(e)
        }
        else {
            if (this.selectedNodes.length > 0 && this.dropTargetNodes.length > 0) {
                if (!this.selectedNodes[0].outs) {
                    this.selectedNodes[0].outs = [];
                }
                this.selectedNodes[0].outs.push(this.dropTargetNodes[0].id);
            }

            DeselectDropTargetNodes()
            this.dropTargetNodes = []
            this.connectionTargetX = 0
            this.connectionTargetY = 0
        }
        this.cancelClick = false
    },
    onMouseMove: function(e) {
        //eventLog('move')
    },
    onMouseDrag: function(e) {
        this.cancelClick = true
        eventLog('drag')
        if (this.selectedNodes.length == 1) {
            if (e.shiftKey) {
                this.connectionTargetX = e.x;
                this.connectionTargetY = e.y;
                this.dropTargetNodes = []
                DeselectDropTargetNodes()
                this.dropTargetNodes = HitTestNodes(e.x, e.y).filter(function(node) {
                    return R.findIndex(R.propEq('id', node.id), this.selectedNodes) == -1
                }.bind(this))
                if (this.dropTargetNodes.length > 0) {
                    SelectDropTargetNodes(this.dropTargetNodes)
                }
            }
            else {
                MoveNode(this.selectedNodes[0], e.x + this.dragOffsetX, e.y + this.dragOffsetY);
            }
        }
    },
    onClick: function(e) {
        var now = Date.now()
        var delta = now - this.lastClick
        this.lastClick = now
        if (delta < 200) {
            this.onDoubleClick(e)
            return
        }
        eventLog('click')
    },
    onDoubleClick: function(e) {
        eventLog('dblclick')

        AddNode({
            id: NextNodeId++,
            x: Math.floor(e.x - NodeWidth/2),
            y: Math.floor(e.y - NodeHeight/2),
            width: NodeWidth,
            height: NodeHeight,
            selected: false
        })
    },
    onKeyDown: function(e) {
        if (e.keyCode == 117) { //DEL
            RemoveNodes(this.selectedNodes);
        }
    }
}

Window.create({
    settings: {
        width:  1280,
        height: 720,
        type: '2d',
        fullScreen: true
    },
    init: function() {
        var ctx = this.getContext()
        this.addEventListener(GraphEvents)
    },
    draw: function() {
        var ctx = this.getContext()

        ctx.clearRect(0, 0, this.getWidth(), this.getHeight())
        ctx.fillStyle = '#444444'
        ctx.fillRect(0, 0, this.getWidth(), this.getHeight())

        Nodes.forEach(function(node) {
            ctx.fillStyle = '#00BB77'
            if (node.selected) {
                ctx.fillStyle = '#007777'
            }
            ctx.fillRect(node.x, node.y, node.width, node.height)
            if (node.selected || node.dropTarget) {
                ctx.strokeStyle = '#FFFF00'
                ctx.strokeRect(node.x-1.5, node.y-1.5, node.width+3, node.height+3)
            }

            if (node.outs) {
                node.outs.forEach(function(targetId) {
                    var source = node;
                    var target = R.find(R.propEq('id', targetId), Nodes);
                    if (target) {
                        ctx.strokeStyle = '#FFFF00'
                        ctx.beginPath()
                        ctx.moveTo(source.x + source.width, source.y + source.height/2)
                        ctx.lineTo(source.x + source.width + 20, source.y + source.height/2)
                        ctx.lineTo(target.x - 20, target.y + target.height/2)
                        ctx.lineTo(target.x, target.y + target.height/2)
                        ctx.stroke()

                        ctx.fillStyle = '#FFFF00'
                        ctx.beginPath()
                        ctx.moveTo(target.x-10, target.y + target.height/2 - 5)
                        ctx.lineTo(target.x, target.y + target.height/2)
                        ctx.lineTo(target.x-10, target.y + target.height/2 + 5)
                        ctx.fill()
                    }
                    else {
                        console.log('Invalid connection', node.id, '->',targetId);
                    }
                })
            }
        })

        if (GraphEvents.connectionTargetX) {
            var source = GraphEvents.selectedNodes[0]
            ctx.strokeStyle = '#FFF'
            ctx.beginPath()
            ctx.moveTo(source.x + source.width/2, source.y + source.height/2)
            ctx.lineTo(GraphEvents.connectionTargetX, GraphEvents.connectionTargetY)
            ctx.stroke()
        }
    }
})
