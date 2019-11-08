"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

//
var _ = require('lodash');

var fse = require('fs-extra');

var path = require("path");

var log = console.log; // const dir = console.dir
// const util = require("util")
// let insp = (o) => log(util.inspect(o, false, null))

var _default = function _default() {
  return "message";
};

exports["default"] = _default;
var fbpath = path.resolve(__dirname, '../fb.fb2');
log('__________________LOG', fbpath);
var md = [];
var style = [];
var pos = 0;

var convert = require('xml-js');

fse.readFile(fbpath, function (err, data) {
  var xml = data.toString();

  try {
    var json = convert.xml2json(xml, {
      compact: false,
      trim: true,
      ignoreDeclaration: true,
      ignoreComment: true,
      ignoreCdata: true
    });
    var res = JSON.parse(json).elements;

    var fb = _.find(res, function (el) {
      return el.name == 'FictionBook';
    });

    if (!fb) return;
    fb = fb.elements;

    var bodies = _.filter(fb, function (el) {
      return el.name == 'body';
    });

    if (!bodies) return;
    bodies.forEach(function (body) {
      var level = 0;
      if (body.attributes && body.attributes.name == 'notes') parseNotes(body.elements);else parseSection(body.elements, level);
    });
    log('__________________________________________');
    log('____MD___:', md);
    log('____STYLE___:', style);
  } catch (err) {
    log('ERR:', err);
  }
});

function parseTitle(elements, level) {
  var el = elements[0];
  if (!el) return {
    level: level,
    text: 'no title'
  };
  var text = el.elements[0].text; // log('___________title:', level, text)
  // let header = ["#".repeat(level), text] .join(' ')
  // let title = {level: level, text: text}
  // // md.push(header)
  // return title

  return text;
}

function parseSection(elements, level) {
  level += 1; // log('__sec elements:', elements)

  var sec = {
    level: level
  };
  elements.forEach(function (el, idx) {
    if (el.name == 'title') sec.title = parseTitle(el.elements, level);else if (el.name == 'section') parseSection(el.elements, level);else if (el.name == 'p') {
      if (!sec.pars) sec.pars = [];
      if (!sec.styles) sec.styles = [];
      var par = parseParagraph(idx, el.elements);
      sec.pars.push(par.text);
      if (par.style.styles.length) sec.styles.push(par.style);
    }
  });
  log('__sec:', sec);
  md.push(sec);
}

function parseParagraph(idx, elements) {
  // log('__PAR', elements)
  var partexts = [];
  var parstyles = [];
  var par = {
    idx: idx
  };
  elements.forEach(function (el) {
    if (el.name == 'style') {
      // log('__STYLE', el)
      var _style = parseStyle(el.elements, el.attributes);

      partexts.push(_style.text);
      parstyles.push({
        idx: idx,
        start: _style.start,
        end: _style.end
      });
    } else if (el.type == 'text') partexts.push(parseText(idx, el.text)); // else if (el.name == 'a') parseLink(el.elements, el.attributes)

  });
  var text = partexts.join(' ');
  return {
    text: {
      idx: idx,
      text: text
    },
    style: {
      idx: idx,
      styles: parstyles
    }
  };
}

function parseText(idx, text) {
  text = cleanText(text);
  pos += text.split(' ').length;
  return text;
}

function parseStyle(elements, attributes) {
  // log('__STYLE-att', attributes)
  // log('__STYLE', elements)
  var lang;
  if (attributes.name == 'foreign lang') lang = attributes['xml:lang']; // only one element, has attr: type=text

  var el = elements[0]; // log('____________________EL', el)

  if (el.type != 'text') throw new Error('style element has no type=text attribute');
  var text = cleanText(el.text);
  var start = pos;
  var end = pos + text.split(' ').length - 1; // log('_________________POS', pos, end)

  pos = end + 1;
  var res = {
    text: text,
    start: start,
    end: end
  };
  if (lang) res.lang = lang;
  return res;
} // '- Еh bien, mon prince. Genes et Lucques ne sont plus que des apanages, des поместья, de la famille Buonaparte. Non, je vous previens, que si vous ne me dites pas, que nous avons la guerre, si vous vous permettez encore de pallier toutes les infamies, toutes les atrocites de cet Antichrist (ma parole, j\'y crois) -- je ne vous connais plus, vous n\'etes plus mon ami, vous n\'etes plus мой верный раб, comme vous dites . Ну, здравствуйте, здравствуйте. Je vois que je vous fais peur , садитесь и рассказывайте.'


function parseLink(elements, attributes) {
  log('__Link-att', attributes);
  log('__Link-els', elements);
  var lang;
  var span = '<span>';
  if (attributes.name == 'foreign lang') lang = attributes['xml:lang'];
  if (lang) span = ['<span lang="', lang, '">'].join(''); // elements.forEach(el=> {
  //   if (el.type == 'text') {
  //     let text = cleanText(el.text)
  //     span = [span, text, '</span>'].join('')
  //     md.push(span)
  //   }
  // })
}

function parseNotes(notes) {// log('__notes', notes)
}

function cleanText(str) {
  var clean = str.replace(/\s\s+/g, ' ');
  return clean;
}