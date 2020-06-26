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
// let decoder = new util.TextDecoder('utf-8')

let insp = (o) => log(util.inspect(o, false, null))

// let md = []
// let style = []
// let pos = 0

const convert = require('xml-js')

function fix1251(text1251) {
  return iconv.decode(text1251, 'cp1251') //.toString()
}

// async function readFBFile(fbpath) {
//   const text1251 = await fse.readFile(fbpath)
//   const content = iconv.decode(text1251, 'cp1251') //.toString()
//   return content
// }

async function parseZip(fbpath) {
  const directory = await unzipper.Open.file(fbpath)
  const file = directory.files[0]
  const content = await file.buffer()
  return content
}

export async function fb2json(fbpath)  {
  let ext = path.extname(fbpath)
  let buffer, error
  try {
    buffer = (ext == '.zip') ? await parseZip(fbpath) : (ext == '.fb2') ? await fse.readFile(fbpath) : error = 'not .fb2 file'
  } catch(err) {
    error = 'not .fb2 file'
  }
  if (error) return error

  let xml = buffer.toString()
  if (/1251/.test(xml.split('\n')[0])) {
    buffer = iconv.decode(buffer, 'cp1251')
    xml = buffer.toString()
  }

  let json = convert.xml2json(xml, {compact: false, trim: true, ignoreDeclaration: true, ignoreComment: true, ignoreCdata: true});
  let res = JSON.parse(json).elements
  let fb = _.find(res, el=> { return el.name == 'FictionBook' })
  if (!fb) return {}
  fb = fb.elements
  let info = parseInfo(fb)
  let docs = parseDocs(fb)
  // return {info: info, docs: docs}
  return {info: {}, docs: []}
}

function parseInfo(fb) {
  let descr = {}
  let description = _.find(fb, el=> { return el.name == 'description' })
  let descrs = description.elements
  let xtitleInfo = _.find(descrs, el=> { return el.name == 'title-info' })
  let xdocInfo = _.find(descrs, el=> { return el.name == 'document-info' })
  let xpubInfo = _.find(descrs, el=> { return el.name == 'publish-info' })
  let titleInfo = stripElement(xtitleInfo)
  let annotation
  let lang
  if (titleInfo.author) descr.author = parseAuthor(titleInfo.author)
  if (titleInfo.annotation) annotation = parseParEls(titleInfo.annotation)
  if (titleInfo['book-title']) descr.title = getText(titleInfo['book-title'])
  if (titleInfo.lang) lang = getText(titleInfo.lang)
  if (lang) {
    let iso = _.find(iso6393, iso=> iso.iso6391 == lang)
    if (iso) lang = iso.iso6393
    descr.lang = lang
  }
  if (annotation) descr.annotation = annotation
  return descr
}


function parseDocs(fb) {
  let docs = []
  let bodies = _.filter(fb, el=> { return el.name == 'body' })
  let body = bodies[0]
  if (!body) return []
  let els = body.elements

  let xtitle = _.find(body.elements, el=> { return el.name == 'title'})
  // let title = ''
  if (xtitle) {
    let title = parseTitle(xtitle.elements)
    log('___BOOK-TITLE', xtitle, title)
  }

  let level = 1
  let xsections = _.filter(body.elements, el=> { return el.name == 'section'})
  xsections.forEach(sec=> {
    parseSection(docs, level, sec)
  })

  // docs.forEach((doc, idx)=> doc.idx = idx)
  return docs
}

function parseSection(docs, level, sec) {
  if (!sec) return
  let elements = sec.elements
  let xtitle = _.find(elements, el=> { return el.name == 'title'})
  // let title = parseTitle(xtitle.elements)
  if (xtitle) {
    let titlezero = xtitle.elements[0]
    let titlels = titlezero.elements
    let titledoc = parseParEls(titlels)
    titledoc.level = level
    docs.push(titledoc)
  }
  let xsections = _.filter(elements, el=> { return el.name == 'section'})
  xsections.forEach(child=> {
    let nextlevel = level+1
    parseSection(docs, nextlevel, child)
  })
  let xpars = _.filter(elements, el=> { return el.name == 'p'})
  // xpars = xpars.slice(0,2)
  xpars.forEach(xpar=> {
    if (!xpar.elements) return
    let doc = parseParEls(xpar.elements)
    docs.push(doc)
  })
}

function parseParEls(els) {
  let texts = []
  // let styles = []
  // let pos = 0
  els.forEach(el=> {
    if (el.type == 'text') {
      let text = cleanText(el.text)
      texts.push(text)
      // pos += text.split(' ').length
    } else if (el.type == 'element' && el.name == 'p') {
      let par = parseParEls(el.elements)
      texts.push(par.md)
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
    } else if (el.type == 'element' && el.name == 'sup') {
      let sup = el.elements[0]
      let text = sup.elements[0].text
      let md = text
      texts.push(md)
    } else if (el.type == 'element' && el.name == 'a') {
      // console.log('_A-el:', el)
      // TODO: NOTES
      // throw new Error('__A ELEMENT')
      return
    } else if (el.type == 'element' && el.name == 'style') {
      // console.log('_el:', el)
      throw new Error('__STYLE ELEMENT')
      return
    } else {
      console.log('ERR: NOT PAR TEXT:', el)
      log('___SUP', el.elements[0])
      throw new Error('NOT PAR TEXT')
    }
  })
  let md = texts.join(' ')
  return {md: md}
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

function parseTitle(elements) {
  let el = elements[0]
  if (!el) return {text: 'no title'}
  let elzero = el.elements[0]
  if (!elzero) return {text: 'no title'}
  let text = elzero.text
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
