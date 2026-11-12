import React from 'react';

const MAX_CHARS = 6000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TEXT_EXT = ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'html', 'css', 'xml', 'yml', 'yaml', 'sql', 'log', 'sh'];
const MARK = '\n\n---\nAttached file: ';

function tidy(text, keepIndent) {
  let t = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n');
  if (!keepIndent) t = t.replace(/[ \t]{2,}/g, ' ');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

function readAsBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function compressImage(file, maxSide = 1280, quality = 0.7) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return { data: await readAsBase64(blob), mime: 'image/jpeg' };
}

async function imageToMarkdown(file, token) {
  const { data, mime } = await compressImage(file);
  const res = await fetch('/api/attachments/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data, mime })
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.success) throw new Error(out.error || 'Could not read the image.');
  return out.text;
}

async function pdfToText(file) {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it) => it.str).join(' ') + '\n\n';
  }
  return tidy(out, false);
}

async function docxToText(file) {
  const mammoth = await import('mammoth/mammoth.browser');
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return tidy(value, false);
}

// Turns one picked file into a small piece of Markdown text.
export async function fileToAttachment(file, token) {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  let body;

  if (file.type.startsWith('image/')) {
    body = await imageToMarkdown(file, token);
  } else if (ext === 'pdf') {
    body = await pdfToText(file);
  } else if (ext === 'docx') {
    body = await docxToText(file);
  } else if (TEXT_EXT.includes(ext) || file.type.startsWith('text/')) {
    const raw = tidy(await file.text(), true);
    body = ext === 'md' || ext === 'markdown' || ext === 'txt' ? raw : '````' + ext + '\n' + raw + '\n````';
  } else {
    throw new Error(`${file.name}: this file type is not supported yet.`);
  }

  if (!body) throw new Error(`Could not find any text in ${file.name}.`);
  const cut = body.length > MAX_CHARS;
  if (cut) body = body.slice(0, MAX_CHARS);
  return {
    name: file.name,
    cut,
    markdown: `${MARK}${file.name}\n\n${body}${cut ? '\n\n[Trimmed to fit]' : ''}`
  };
}

export function buildMessage(text, attachments) {
  const main = text.trim() || (attachments.length ? 'Please read the attached file.' : '');
  return main + attachments.map((a) => a.markdown).join('');
}

// Shows attached files as collapsed rows inside a user message.
export function UserMessage({ text }) {
  const parts = text.split(MARK);
  const main = parts[0];
  const files = parts.slice(1).map((p) => {
    const i = p.indexOf('\n\n');
    return { name: i === -1 ? p : p.slice(0, i), body: i === -1 ? '' : p.slice(i + 2) };
  });
  return (
    <>
      {main && <div>{main}</div>}
      {files.map((f, i) => (
        <details key={i} className="mt-2 text-sm">
          <summary className="cursor-pointer">Attached: {f.name}</summary>
          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap text-xs">{f.body}</pre>
        </details>
      ))}
    </>
  );
}