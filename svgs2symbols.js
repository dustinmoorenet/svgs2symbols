#!/usr/bin/env node

var program = require('commander');
var cheerio = require('cheerio');
var nodefn = require('when/node');
var sequence = require('when/sequence');
var fs = require('fs');
var readFile = nodefn.lift(fs.readFile);
var path = require('path');

program
    .usage('[options] <files ...>')
    .option('-i, --inline', 'Create a bare svg element to inline in a document', 0)
    .option('-o, --output <fileName>', 'File name to write to')
    .action(start);

program.parse(process.argv);

function start() {
    var files = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
    var options = arguments[arguments.length - 1];

    var resultSvg = '<svg xmlns="http://www.w3.org/2000/svg" ><defs/></svg>';
    if (!options.inline) {
        resultSvg =
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" ' +
            '"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' +
            resultSvg;
    }

    var $ = cheerio.load(resultSvg, { xmlMode: true });

    var context = {
        ids: {},
        $: $,
        $combinedSvg: $('svg'),
        $combinedDefs: $('defs')
    };

    var tasks = files.map(function(fileName) {
        return eachFile.bind(context, fileName);
    });

    sequence(tasks)
        .then(finish.bind(context, options.output));
}

function eachFile(fileName) {
    return readFile(fileName)
        .then(extractTheGoods.bind(this, fileName));
}

function extractTheGoods(fileName, fileContents) {
    var $file = cheerio.load(fileContents, {xmlMode: true});
    var $svg = $file('svg');
    var idAttr = path.basename(fileName, path.extname(fileName));
    var viewBoxAttr = $svg.attr('viewBox');
    var $symbol = this.$('<symbol/>');

    if (idAttr in this.ids) {
        throw 'File name should be unique: ' + idAttr;
    }

    this.ids[idAttr] = true;

    $symbol.attr('id', idAttr);
    if (viewBoxAttr) {
        $symbol.attr('viewBox', viewBoxAttr);
    }

    var $defs = $file('defs');
    if ($defs.length > 0) {
        this.$combinedDefs.append($defs.contents());
        $defs.remove();
    }

    $symbol.append($svg.contents());
    this.$combinedSvg.append($symbol);
}

function finish(output) {
    if (this.$combinedDefs.contents().length === 0) {
        this.$combinedDefs.remove();
    }

    fs.writeFileSync(output, this.$.xml());
}
