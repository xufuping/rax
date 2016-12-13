import cons from 'consolidate';
import path from 'path';
import loaderUtils from 'loader-utils';
import HTMLtoJSX from './HTMLtoJSX';
import { transform } from 'babel-core';
import getPresets from './getPresets';
import getImportPackages from './getImportPackages';
const converter = new HTMLtoJSX();

module.exports = function(source, parseObject) {
  this.cacheable && this.cacheable();
  const callback = this.async();
  const query = loaderUtils.parseQuery(this.query);

  // no engine default: html
  if (!cons[query.engine]) {
    return callback(null, getConvertText(source, parseObject.importLinks, query));
  }

  cons[query.engine].render(source, {
    filename: this.resourcePath
  }, (error, html) => {
    return callback(error, getConvertText(html, parseObject.importLinks, query));
  });
};

const getConvertText = (source, links, query) => {
  const convert = converter.convert(source);
  const { presets, imports } = query;
  const code = `
    ${getImportPackages(imports)}
    ${getElementsImport(links)}

    module.exports = (props, styles) => {
      return ${convert.output};
    };
  `;

  return transform(code, { presets: getPresets(presets) }).code;
};

const getElementsImport = (links) => {
  let result = '';

  links.forEach((link) => {
    const ext = path.extname(link);
    const name = path.basename(link, ext);
    result += `import ${name} from '${link}';\n`;
  });

  return result;
};
