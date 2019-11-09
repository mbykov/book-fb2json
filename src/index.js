//

const _ = require('lodash')
const fse = require('fs-extra')
const path = require("path")
const log = console.log
// const dir = console.dir
const util = require("util")
let insp = (o) => log(util.inspect(o, false, null))

let md = []
let style = []
let pos = 0

const convert = require('xml-js')

export default (fbpath) => {
  return new Promise((resolve, reject) => {
    // stream.on('data', chunk => chunks.push(chunk))
    // stream.on('error', reject)
    // stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    fse.readFile(fbpath, function(err, data) {
      let xml = data.toString()
      let tree
      try {
        let json = convert.xml2json(xml, {compact: false, trim: true, ignoreDeclaration: true, ignoreComment: true, ignoreCdata: true});
        let res = JSON.parse(json).elements
        let fb = _.find(res, el=> { return el.name == 'FictionBook' })
        if (!fb) return
        fb = fb.elements
        let bodies = _.filter(fb, el=> { return el.name == 'body' })
        // description !
        let body = bodies[0]
        // notes !
        let els = body.elements

        // log('FB', body)
        // insp(els)

        let xtitle = _.find(body.elements, el=> { return el.name == 'title'})
        let title
        if (xtitle) title = parseTitle(xtitle.elements)
        else title = 'unknown, parse descr'
        // log('BOOK-TITLE', title)
        tree = {text: title}
        let xsections = _.filter(body.elements, el=> { return el.name == 'section'})
        let parent = tree

        xsections.forEach(sec=> {
          parseSec(parent, sec)
        })

      } catch(err) {
        log('ERR:', err)
        reject(err, null)
      }

      // log('TREE', tree)
      resolve(tree)
      // insp(tree)
    })
  })
}

function parseSec(parent, sec) {
  let elements = sec.elements
  let xtitle = _.find(elements, el=> { return el.name == 'title'})
  let title = parseTitle(xtitle.elements)
  // log('sec-TITLE', title)
  let secNode = {text: title}
  let xsections = _.filter(elements, el=> { return el.name == 'section'})
  // log('________________________SECS', xsections.length)
  xsections.forEach(child=> {
    parseSec(secNode, child)
  })
  let xpars = _.filter(elements, el=> { return el.name == 'p'})
  if (xpars.length) secNode.pars = [], secNode.styles = []
  xpars.forEach((xpar, idx)=> {
    if (!xpar.elements) return
    let par = parsePar(xpar.elements, idx)
    if (par.text) secNode.pars.push(par.text)
    if (par.style) secNode.styles.push(par.style)
  })
  if (!parent.sections) parent.sections = []
  parent.sections.push(secNode)
}

function parsePar(els, idx) {
  let texts = []
  let styles = []
  let pos = 0
  els.forEach(el=> {
    // log('_______________PAR ELEM', el)
    if (el.type == 'text') {
      let text = cleanText(el.text)
      texts.push(text)
      pos += text.split(' ').length
    } else if (el.type == 'element' && (el.name == 'emphasis' || el.name == 'strong')) {
      if (!el.elements) throw new Error('__EMPHASIS WO ELEMENTS')
      let emph = el.elements[0]
      let text = cleanText(emph.text)
      if (emph.type == 'text') texts.push(emph.text)
      pos += text.split(' ').length
      let start = pos
      let end = pos + text.split(' ').length - 1
      pos = end + 1
      let style = {name: 'strong', text: text, start: start, end: end}
      styles.push(style)
    } else if (el.type == 'element' && el.name == 'a') {
      return
    } else if (el.type == 'element' && el.name == 'style') {
      return
    } else throw new Error('NOT TEXT'+JSON.stringify(el))
  })
  let text = texts.join('')
  return {text: {idx: idx, text: text}, style: {idx: idx, styles: styles}}
}

function parseTitle(elements) {
  let el = elements[0]
  if (!el) return {text: 'no title'}
  let text = el.elements[0].text
  return cleanText(text)
}


function parseNotes(notes) {
  // log('__notes', notes)
}

function cleanText(str) {
  if (!str) return ''
  let clean = str.replace(/\s\s+/g, ' ')
  return clean
}
