import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.window = {};
await import('../src/data.js');

const data = globalThis.window.ARCHIVE_DATA;
const errors = [];
const ids = new Set();
const categories = {};
let localFiles = 0;
let externalLinks = 0;

if (!Array.isArray(data) || data.length === 0) {
  errors.push('公开条目数据为空或格式错误。');
}

for (const item of data || []) {
  categories[item.cat] = (categories[item.cat] || 0) + 1;
  if (!item.id || ids.has(item.id)) errors.push(`条目编号缺失或重复：${item.id || '(空)'}`);
  ids.add(item.id);
  if (item.private) errors.push(`公开数据中混入私有标记：${item.id}`);

  for (const file of [...(item.files || []), ...(item.crops || [])]) {
    const value = file.path || '';
    if (/^https?:\/\//.test(value)) {
      externalLinks += 1;
      continue;
    }
    localFiles += 1;
    if (path.isAbsolute(value) || value.includes('..') || value.startsWith('assets-private/')) {
      errors.push(`非法或私有附件路径：${item.id} → ${value}`);
      continue;
    }
    if (!existsSync(path.join(root, 'public', value))) {
      errors.push(`公开附件缺失：${item.id} → ${value}`);
    }
  }
}

const dossier = (data || []).find((item) => item.id === 'tjdag-1911-dossier');
const dossierFiles = dossier?.files || [];
const summary = {
  records: data?.length || 0,
  categories,
  localFiles,
  externalLinks,
  dossier: {
    pdf: dossierFiles.filter((file) => file.kind === 'pdf').length,
    images: dossierFiles.filter((file) => file.kind === 'image').length,
  },
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('公开数据与本地附件检查通过。');
