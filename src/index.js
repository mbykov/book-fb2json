'use strict'

const _ = require('lodash')
const fse = require('fs-extra')
const path = require("path")
const log = console.log
const isGzip = require('is-gzip')
const isZip = require('is-zip');
const util = require("util")
const unzipper = require('unzipper')
// const etl = require('etl')
const iconv = require('iconv-lite');
var iso6393 = require('iso-639-3')
// let decoder = new util.TextDecoder('utf-8')
let insp = (o) => log(util.inspect(o, false, null))

const convert = require('xml-js')

async function parseZip(fbpath) {
  const directory = await unzipper.Open.file(fbpath)
  const file = directory.files[0]
  return await file.buffer()
}

export async function fb2md(fbpath)  {
  let ext = path.extname(fbpath)
  let buffer, errmess
  try {
    buffer = (ext == '.zip') ? await parseZip(fbpath) : (ext == '.fb2') ? await fse.readFile(fbpath) : null
  } catch(err) {
    errmess = 'not .fb2 file'
    return {descr: errmess}
  }

  let fbobj
  try {
    let xml = buffer.toString()
    if (/1251/.test(xml.split('\n')[0])) {
      buffer = iconv.decode(buffer, 'cp1251')
      xml = buffer.toString()
    }
    fbobj = convert.xml2js(xml, {compact: false, trim: true, ignoreDeclaration: true, ignoreComment: true, ignoreCdata: true});
  } catch(err) {
    errmess = 'can not read .fb2 file'
    return {descr: errmess}
  }

  let fictionbook = _.find(fbobj.elements, el=> { return el.name == 'FictionBook' })
  if (!fictionbook) return {descr: 'empty .fb2 file'}

  let fbels = fictionbook.elements
  let description = _.find(fbels, el=> { return el.name == 'description' })
  let descr
  if (fbels) descr = parseInfo(description)
  else descr = {author: 'no author', title: 'no title', lang: 'no lang'}
  let docs = parseDocs(fbels)
  let imgs = []
  return {descr, docs, imgs}
}

function parseInfo(description) {
  let descr = {}
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
  let bodies = fb.filter(el=> { return el.name == 'body' })
  let body = bodies[0]
  if (!body) return []
  let els = body.elements

  let xtitle = _.find(body.elements, el=> { return el.name == 'title'})
  if (xtitle) parseTitle(docs, xtitle, 1)

  let level = 1
  let xsections = body.elements.filter(el=> { return el.name == 'section'})
  xsections = xsections.slice(0,2)
  xsections.forEach(sec=> {
    parseSection(docs, level, sec)
  })

  let notel =  _.find(bodies, body=> body.attributes && body.attributes.name == 'notes')
  let notels = notel ? notel.elements : []
  let noteid, refnote
  notels.forEach(notel=> {
    let note = {footnote: true}
    notel.elements.forEach(el=> {
      if (el.name == 'title') refnote = el.elements[0].elements[0].text
      else if (el.name == 'p') note.md = el.elements[0].text
    })
    if (!refnote) return
    noteid = refnote.replace('[', '').replace(']', '')
    note._id = ['ref', noteid].join('-')
    docs.push(note)
  })
  return docs
}

function parseTitle(docs, xtitle, level) {
  if (!xtitle.elements) return
  xtitle.elements.forEach(titlel=> {
    let titledoc = parseParEls(titlel.elements)
    titledoc.level = level
    docs.push(titledoc)
  })
}

function parseSection(docs, level, sec) {
  if (!sec) return
  let elements = sec.elements
  let xtitle = _.find(elements, el=> { return el.name == 'title'})
  if (xtitle) {
    let titlezero = xtitle.elements[0]
    let titlels = titlezero.elements
    let titledoc = parseParEls(titlels)
    titledoc.level = level
    docs.push(titledoc)
  }

  let xsections = elements.filter(el=> { return el.name == 'section'})
  xsections.forEach(child=> {
    let nextlevel = level+1
    parseSection(docs, nextlevel, child)
  })

  let xpars = elements.filter(el=> { return el.name == 'p'})
  xpars.forEach(xpar=> {
    if (!xpar.elements) return
    let doc = parseParEls(xpar.elements)
    docs.push(doc)
  })
}

function parseParEls(els) {
  let doc = {}
  let texts = []
  els.forEach(el=> {
    if (el.type == 'text') {
      let text = cleanText(el.text)
      texts.push(text)
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
      let ref = el.elements[0].text.replace('[', '').replace(']', '')
      let refnote = ['[', ref, ']'].join('')
      texts.push(refnote)
      if (!doc.refnote) doc.refnote = {}
      doc.refnote[ref] = ref
    } else if (el.type == 'element' && el.name == 'style') {
      return
    } else if (el.type == 'element' && el.name == 'empty-line') {
      return
    } else if (el.type == 'element' && el.name == 'title') {
      return
      // // could be used as note reference:
      // try {
      //   let ref = el.elements[0].elements[0].text.replace('[', '').replace(']', '')
      //   let footnote = ['[', ref, ']: '].join('')
      //   texts.push(footnote)
      //   throw new Error()
      // } catch(err) {
      //   log('FN ERR: some error')
      // }
    } else {
      // todo: ===================== закончить бредовые элементы
      console.log('ERR: FB2 NOT EL:', el)
      throw new Error('NOT PAR TEXT')
    }
  })
  doc.md = texts.join(' ').trim()
  return doc
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

function cleanText(str) {
  if (!str) return ''
  let clean = str.replace(/\s\s+/g, ' ')
  return clean
}
