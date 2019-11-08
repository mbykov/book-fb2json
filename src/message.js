//

const _ = require('lodash')
const fse = require('fs-extra')
const path = require("path")
const log = console.log
// const dir = console.dir
const util = require("util")
let insp = (o) => log(util.inspect(o, false, null))

export default () => "message";

let fbpath = path.resolve(__dirname, '../fbsample.fb2')
log('__________________LOG', fbpath)

let md = []
let style = []

let pos = 0

const convert = require('xml-js')

fse.readFile(fbpath, function(err, data) {
  let xml = data.toString()
  try {
    let json = convert.xml2json(xml, {compact: false, trim: true, ignoreDeclaration: true, ignoreComment: true, ignoreCdata: true});
    let res = JSON.parse(json).elements
    let fb = _.find(res, el=> { return el.name == 'FictionBook' })
    if (!fb) return
    fb = fb.elements
    let bodies = _.filter(fb, el=> { return el.name == 'body' })
    if (!bodies) return
    // insp(bodies[0])
    bodies.forEach(body=> {
      let level = 0
      if (body.attributes && body.attributes.name == 'notes') parseNotes(body.elements)
      else parseSection(body.elements, level)
    })

    log('__________________________________________')
    log('____MD___:', md)
    insp(md)
    // log('____STYLE___:', style)

  } catch(err) {
    log('ERR:', err)
  }
})

function parseTitle(elements, level) {
  let el = elements[0]
  if (!el) return {level: level, text: 'no title'}
  let text = el.elements[0].text
  // log('___________title:', level, text)
  return text
}

function parseSection(elements, level) {
  // log('__sec elements:', elements)
  level += 1
  let sec = {level: level}
  elements.forEach((el, idx)=> {
    if (el.name == 'title') {
      sec.title = parseTitle(el.elements, level)
      md.push(sec)
    }
    else if (el.name == 'section') parseSection(el.elements, level)
    else if (el.name == 'p') {
      // return
      if (!el.elements) return
      if (!sec.pars) sec.pars = []
      let par = parseParagraph(idx, el.elements)
      sec.pars.push(par.text)
      if (par.style.styles.length) {
        if (!sec.styles) sec.styles = []
        sec.styles.push(par.style)
      }
    }
  })
  // log('__sec:', sec)
}

function parseParagraph(idx, elements) {
  // log('__PAR', elements)
  let partexts = []
  let parstyles = []
  // let par = {idx: idx}
  // if (!elements) return {text: {idx: idx}, style: {idx: idx, styles: []}}
  elements.forEach(el=> {
    if (el.name == 'style') {
      // log('__STYLE', el)
      let style = parseStyle(el.elements, el.attributes)
      partexts.push(style.text)
      parstyles.push({idx: idx, attr: style.attr, name: style.name, start: style.start, end: style.end})
    }
    else if (el.type == 'text') partexts.push(parseText(idx, el.text))
    else if (el.name == 'a') {
      let href = parseLink(el.elements, el.attributes)
      partexts.push(href.text)
      parstyles.push({idx: idx, attr: href.attr, name: href.name, start: href.start, end: href.end})
    }
    else throw new Error('ERR-STYLE'+JSON.stringify(el))
  })
  let text = partexts.join(' ')
  return {text: {idx: idx, text: text}, style: {idx: idx, styles: parstyles}}
}

function parseText(idx, text) {
  text = cleanText(text)
  pos += text.split(' ').length
  return text
}

function parseStyle(elements, attributes) {
  // log('__STYLE-att', attributes)
  // log('__STYLE', elements)
  let attr, name
  if (attributes.name == 'foreign lang') attr='lang', name = attributes['xml:lang']
  else if (attributes.name == 'italic') attr = 'name', name = attributes.name
  else throw new Error('ATTR'+attributes)
  // only one element, has attr: type=text
  let el = elements[0]
  // log('____________________EL', el)
  if (el.type != 'text') throw new Error('style element has no type=text attribute')
  let text = cleanText(el.text)
  let start = pos
  let end = pos + text.split(' ').length - 1
  // log('_________________POS', pos, end)
  pos = end + 1
  let res = {attr: attr, name: name, text: text, start: start, end: end}
  // if (lang) res.lang = lang
  return res
}

function parseLink(elements, attributes) {
  log('__Link-att', attributes)
  log('__Link-els', elements)
  let attr, name
  if (attributes.type == 'note') attr = 'href', name = attributes['xlink:href']
  else throw new Error('HREF element has no type=note')
  // only one element, has attr: type=note
  let el = elements[0]
  let text = cleanText(el.text)
  let start = pos
  let end = pos + text.split(' ').length - 1
  pos = end + 1
  let res = {attr: attr, name: name, text: text, start: start, end: end}
  log('_________________XLINK', res)
  return res
}

// '- Еh bien, mon prince. Genes et Lucques ne sont plus que des apanages, des поместья, de la famille Buonaparte. Non, je vous previens, que si vous ne me dites pas, que nous avons la guerre, si vous vous permettez encore de pallier toutes les infamies, toutes les atrocites de cet Antichrist (ma parole, j\'y crois) -- je ne vous connais plus, vous n\'etes plus mon ami, vous n\'etes plus мой верный раб, comme vous dites . Ну, здравствуйте, здравствуйте. Je vois que je vous fais peur , садитесь и рассказывайте.'

function parseNotes(notes) {
  // log('__notes', notes)
}

function cleanText(str) {
  let clean = str.replace(/\s\s+/g, ' ')
  return clean
}
