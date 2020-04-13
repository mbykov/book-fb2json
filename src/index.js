//

const _ = require('lodash')
const fse = require('fs-extra')
const path = require("path")
const log = console.log
const isGzip = require('is-gzip')
const isZip = require('is-zip');
const util = require("util")
// const pako = require('pako')
const unzipper = require('unzipper')
// const miss = require('mississippi')
const etl = require('etl')
// const iso13 = require('./lib/iso13')
const iconv = require('iconv-lite');
var iso6393 = require('iso-639-3')
// let decoder = new util.TextDecoder('cp1251')

let insp = (o) => log(util.inspect(o, false, null))

let md = []
let style = []
let pos = 0

const convert = require('xml-js')

// https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
// function hashCode(s) {
//   return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
// }
let hashCode = s => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)

async function parseZip(fbpath) {
  const directory = await unzipper.Open.file(fbpath)
  const file = directory.files[0]
  const content = await file.buffer()
  return content
}

async function readFBFile(fbpath) {
  const text1251 = await fse.readFile(fbpath)
  // return text1251
  const content = iconv.decode(text1251, 'cp1251') //.toString()
  return content
}

export default (fbpath) => {
  let ext = path.extname(fbpath)
  let method = (ext == '.zip') ? parseZip : (ext == '.fb2') ? readFBFile : null
  if (!method) return {}
  // return parseZip(fbpath)
  // return readFBFile(fbpath)
  return method(fbpath)
    .then(buffer=> {
      let xml = buffer.toString()
      // let tree = parseTree(xml)
      // return tree

      let json = convert.xml2json(xml, {compact: false, trim: true, ignoreDeclaration: true, ignoreComment: true, ignoreCdata: true});
      let res = JSON.parse(json).elements
      let fb = _.find(res, el=> { return el.name == 'FictionBook' })
      if (!fb) return {}
      fb = fb.elements
      let info = parseInfo(fb)
      let docs = parseDocs(fb)
      return {info: info, docs: docs}
    }).catch(err=> {
      log('ERR:', err)
      // throw new Error('ERR: parse XML', +JSON.stringify(err))
    })
}

function parseInfo(fb) {
  let descr = {}
  let description = _.find(fb, el=> { return el.name == 'description' })
  let descrs = description.elements
  let xtitleInfo = _.find(descrs, el=> { return el.name == 'title-info' })
  let xdocInfo = _.find(descrs, el=> { return el.name == 'document-info' })
  let xpubInfo = _.find(descrs, el=> { return el.name == 'publish-info' })
  // log('xTitle:', xtitleInfo)
  let titleInfo = stripElement(xtitleInfo)
  // log('Title:', titleInfo)
  let annotation
  let lang
  if (titleInfo.author) descr.author = parseAuthor(titleInfo.author)
  if (titleInfo.annotation) annotation = parseParagraph(titleInfo.annotation[0], 0)
  if (titleInfo['book-title']) descr.title = getText(titleInfo['book-title'])
  if (titleInfo.lang) lang = getText(titleInfo.lang)
  if (lang) {
    let iso = _.find(iso6393, iso=> iso.iso6391 == lang)
    if (iso) lang = iso.iso6393
    descr.lang = lang
  }
  if (annotation) descr.annotation = annotation.text.text
  return descr
}


function parseDocs(fb) {
  let docs = []
  let bodies = _.filter(fb, el=> { return el.name == 'body' })
  // log('FB', bodies)
  let body = bodies[0]
  if (!body) return []
  let els = body.elements
  // insp(els)

  // let xtitle = _.find(body.elements, el=> { return el.name == 'title'})
  // let title
  // if (xtitle) title = parseTitle(xtitle.elements)
  // else title = ''
  // log('___BOOK-TITLE', title)

  let level = 1
  let xsections = _.filter(body.elements, el=> { return el.name == 'section'})
  xsections.forEach(sec=> {
    parseSec(docs, level, sec)
  })

  docs.forEach((doc, idx)=> doc.idx = idx)

  // let sidx = {}
  // docs.forEach((doc, idx)=> {
  //   doc.idx = idx
  //   if (doc.level) {
  //     if (sidx[level] > -1) sidx[level] += 1
  //     else sidx[level] = 0
  //     doc.levnum = sidx[level]
  //     log('___LEVEL', idx, sidx[level])
  //     // doc.sid = [level, levnum].join('-')
  //   }
  // })

  return docs
}

function parseSec(docs, level, sec) {
  let elements = sec.elements
  let xtitle = _.find(elements, el=> { return el.name == 'title'})
  // let title = parseTitle(xtitle.elements)
  let titlels = xtitle.elements[0].elements
  let titledoc = parseParEls(titlels)
  titledoc.level = level
  docs.push(titledoc)
  // log('sec-TITLE', xtitle.elements)
  let xsections = _.filter(elements, el=> { return el.name == 'section'})
  // log('________________________XSECS', xsections.length)
  xsections.forEach(child=> {
    let nextlevel = level+1
    parseSec(nextlevel, child)
  })
  let xpars = _.filter(elements, el=> { return el.name == 'p'})
  // xpars = xpars.slice(0,2)
  xpars.forEach(xpar=> {
    if (!xpar.elements) return
    let doc = parseParEls(xpar.elements)
    // log('_PAR', doc)
    docs.push(doc)
  })
  // let sidx = {}
  // let levnum = 0
}

function parseParEls(els) {
  let texts = []
  let styles = []
  let pos = 0
  els.forEach(el=> {
    // log('_______________PAR ELEM', el)
    if (el.type == 'text') {
      let text = cleanText(el.text)
      texts.push(text)
      pos += text.split(' ').length
    } else if (el.type == 'element' && el.name == 'emphasis') {
      if (!el.elements) return
      let emph = el.elements[0]
      let text = cleanText(emph.text)
      let md = ['_', text, '_'].join('')
      texts.push(md)
    } else if (el.type == 'element' && el.name == 'strong') {
      if (!el.elements) return
      let emph = el.elements[0]
      let text = cleanText(emph.text)
      let md = ['*', text, '*'].join('')
      texts.push(md)
    } else if (el.type == 'element' && el.name == 'a') {
      console.log('_A-el:', el)
      // todo: notes
      // throw new Error('__A ELEMENT')
      return
    } else if (el.type == 'element' && el.name == 'style') {
      console.log('_el:', el)
      throw new Error('__STYLE ELEMENT')
      return
    } else {
      console.log('ERR: NOT PAR TEXT:', el)
      throw new Error('NOT PAR TEXT')
    }
  })
  let md = texts.join(' ')
  return {md: md}
}



function parseTree(xml) {
  let tree
  let descr = {}
  try {
    let json = convert.xml2json(xml, {compact: false, trim: true, ignoreDeclaration: true, ignoreComment: true, ignoreCdata: true});
    let res = JSON.parse(json).elements
    let fb = _.find(res, el=> { return el.name == 'FictionBook' })
    if (!fb) return
    fb = fb.elements
    let description = _.find(fb, el=> { return el.name == 'description' })
    let descrs = description.elements
    let xtitleInfo = _.find(descrs, el=> { return el.name == 'title-info' })
    let xdocInfo = _.find(descrs, el=> { return el.name == 'document-info' })
    let xpubInfo = _.find(descrs, el=> { return el.name == 'publish-info' })
    // log('xTitle:', xtitleInfo)
    let titleInfo = stripElement(xtitleInfo)
    // log('Title:', titleInfo)
    let annotation
    if (titleInfo.author) descr.author = parseAuthor(titleInfo.author)
    if (titleInfo.annotation) annotation = parseParagraph(titleInfo.annotation[0], 0)
    if (titleInfo['book-title']) descr.title = getText(titleInfo['book-title'])
    if (titleInfo.lang) descr.lang = getText(titleInfo.lang)
    if (annotation) descr.annotation = annotation.text.text
    // log('_DESCR', descr)

    let bodies = _.filter(fb, el=> { return el.name == 'body' })
    let body = bodies[0]
    // notes !
    let els = body.elements
    // log('FB', body)
    // insp(els)

    let xtitle = _.find(body.elements, el=> { return el.name == 'title'})
    let title
    if (xtitle) title = parseTitle(xtitle.elements)
    else title = ''
    // log('BOOK-TITLE', title)
    tree = {text: title}
    let xsections = _.filter(body.elements, el=> { return el.name == 'section'})
    // let parent = tree
    xsections.forEach(sec=> {
      parseSec(tree, sec)
    })

  } catch(err) {
    log('ERR:', err)
    throw new Error('ERR: parse XML', +JSON.stringify(err))
  }

  let id = hashCode([descr.author, descr.title, descr.lang].join('-'))
  descr.id = id
  let res = { tree: tree, descr: descr }
  return res
}


function parseAuthor(els) {
  let fname = _.find(els, el=> { return el.name == 'first-name' })
  let mname = _.find(els, el=> { return el.name == 'middle-name' })
  let lname = _.find(els, el=> { return el.name == 'last-name' })
  let author = [getOnlyEl(fname), getOnlyEl(mname), getOnlyEl(lname)].join(' ')
  return author
}

function stripElement(xdoc) {
  let doc = {}
  if (xdoc.type == 'element') doc = getEls(xdoc)
  else if (xdoc.type == 'text') doc.text = getText(xdoc)
  // else if (xdoc.type == 'p') doc.text = getText(xdoc)
  return doc
}

function getEls(xdoc) {
  let doc = {}
  xdoc.elements.forEach(el=> {
    doc[el.name] = el.elements
  })
  return doc
}

function getOnlyEl(xdoc) {
  if (!xdoc) return ''
  let el = xdoc.elements[0]
  let text = (el.text) ? el.text : ''
  return text
}

function getText(xdoc) {
  let el = xdoc[0]
  let text = (el.text) ? cleanText(el.text) : ''
  return text
}

function parseParagraph(el, idx) {
  if (el.type != 'element' || el.name != 'p') throw new Error('ERR: not a paragraph' + JSON.stringify(el))
  let par = parsePar(el.elements, idx)
  return par
}

function parseSec_(parent, sec) {
  let elements = sec.elements
  let xtitle = _.find(elements, el=> { return el.name == 'title'})
  let title = parseTitle(xtitle.elements)
  // log('sec-TITLE', title)
  let secNode = {text: title}
  let xsections = _.filter(elements, el=> { return el.name == 'section'})
  // log('________________________SECS', xsections.length)
  xsections.forEach(child=> {
    parseSec_(secNode, child)
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
    } else {
      log('ERR: NOT PAR TEXT:', el)
      throw new Error('NOT PAR TEXT')
    }
  })
  let text = texts.join(' ')
  return {text: {idx: idx, text: text}, style: {idx: idx, styles: styles}}
}

function parseTitle(elements) {
  let el = elements[0]
  if (!el) return {text: 'no title'}
  let text = el.elements[0].text
  return cleanText(text)
}


// function parseNotes(notes) {
//   // log('__notes', notes)
// }

function cleanText(str) {
  if (!str) return ''
  let clean = str.replace(/\s\s+/g, ' ')
  return clean
}
