import marked from 'marked';
import {decode} from 'he';
import escapeHtml from 'escape-html';

export function codeRenderer(tracker, options) {
  function CodeComponent (props) {
    return options.createElement('pre', null, options.createElement('code', {
      className: `language-${props.language}`,
      dangerouslySetInnerHTML: options.highlight ? {__html: options.highlight(props.language, props.code)} : null
    }, options.highlight ? null : props.code))
  }

  return function(code, language) {
    const elementId = tracker.nextElementId++;

    tracker.elements[elementId] = options.createElement(
      (options.elements && options.elements.code) || CodeComponent,
      {key: elementId, code, language}
    );

    tracker.tree.push(tracker.elements[elementId]);

    return `{{${elementId}}}`;
  }
}

export default function createRenderer (tracker, options, overrides = {}) {
  const renderer = new marked.Renderer();

  function getTocPosition (toc, level) {
    var currentLevel = toc.children;
    while (true) {
      if (!currentLevel.length || currentLevel[currentLevel.length - 1].level === level) {
        return currentLevel;
      } else {
        currentLevel = currentLevel[currentLevel.length - 1].children;
      }
    }
  }

  function populateInlineContent (content = '') {
    const contentArray = content.split(/(\{\{.*?\}\})/);
    const extractedElements = contentArray.map(function (text) {
      const elementIdMatch = text.match(/\{\{(.*)\}\}/);
      if (elementIdMatch) {
        tracker.tree.splice(tracker.tree.indexOf(tracker.elements[elementIdMatch[1]]), 1)
        return tracker.elements[elementIdMatch[1]];
      } else if (text != '') {
        return decode(text);
      }

      return null;
    });

    return extractedElements;
  }

  function addElement (tag, props = {}, children, type = tag) {
    const elementId = tracker.nextElementId++;
    let inlineContent = null;

    const elementType = options.elements && options.elements[type]

    if (children) {
      inlineContent = Array.isArray(children) ? children.map(populateInlineContent) : populateInlineContent(children)
    }

    tracker.elements[elementId] = options.createElement(elementType || tag, Object.assign({
      key: elementId,
    }, props, elementType ? {context: tracker.context} : {}), inlineContent);

    tracker.tree.push(tracker.elements[elementId]);

    return `{{${elementId}}}`;
  }

  renderer.code = overrides.code || codeRenderer(tracker, options);

  renderer.html = overrides.html || function (html) {
    const elementId = tracker.nextElementId++;

    tracker.tree.push(options.createElement('div', {
      key: elementId,
      dangerouslySetInnerHTML: {
        __html: html
      }
    }))
  };

  renderer.paragraph = overrides.paragraph || function (text) {
    return addElement('p', null, text);
  }

  renderer.blockquote = overrides.blockquote || function (text) {
    return addElement('blockquote', null, text);
  }

  renderer.link = overrides.link || function (href, title, text) {
    return addElement('a', {href, title}, text);
  }

  renderer.br = overrides.br || function () {
    return addElement('br');
  }

  renderer.hr = overrides.hr || function () {
    return addElement('hr');
  }

  renderer.strong = overrides.strong || function (text) {
    return addElement('strong', null, text);
  }

  renderer.del = overrides.del || function (text) {
    return addElement('del', null, text);
  }

  renderer.em = overrides.em || function (text) {
    return addElement('em', null, text);
  }

  renderer.heading = overrides.heading || function (text, level) {
    tracker.currentId = tracker.currentId.slice(0, level - 1);
    tracker.currentId.push(text.replace(/\s/g, '-').toLowerCase())

    const id = tracker.currentId.join('-');
    const lastToc = tracker.toc[tracker.toc.length - 1];

    if (!lastToc || lastToc.level > level) {
      tracker.toc.push({
        id: id,
        title: text,
        level: level,
        children: []
      });
    } else {
      const tocPosition = getTocPosition(lastToc, level);

      tocPosition.push({
        id: id,
        title: text,
        level: level,
        children: []
      });
    }

    return addElement(`h${level}`, {
      id
    }, text);
  }

  renderer.list = overrides.list || function (body, ordered) {
    return addElement(ordered ? 'ol' : 'ul', null, body);
  }

  renderer.listitem = overrides.listitem || function (text) {
    return addElement('li', null, text);
  }

  renderer.table = overrides.table || function (header, body) {
    return addElement('table', null, [
      addElement('thead', null, header),
      addElement('tbody', null, body)
    ]);
  }

  renderer.thead = overrides.thead || function (content) {
    return addElement('thead', null, content)
  }

  renderer.tbody = overrides.tbody || function (content) {
    return addElement('tbody', null, content)
  }

  renderer.tablerow = overrides.tablerow || function (content) {
    return addElement('tr', null, content)
  }

  renderer.tablecell = overrides.tablecell || function (content, flag) {
    const tag = flag.header ? 'th' : 'td'
    return addElement(tag, {className: flag.align ? `text-${flag.align}` : undefined}, content)
  }

  renderer.codespan = overrides.codespan || function (text) {
    return addElement('code', null, text, 'codespan')
  }

  renderer.image = overrides.image || function (href, title, text) {
    return addElement('img', {src: href, alt: text})
  }

  return renderer;
}
