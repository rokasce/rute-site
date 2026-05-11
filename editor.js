// Editor-only script. Not loaded in production.
// Makes text content editable in-browser and adds a floating button to download the edited HTML.

(function () {
  const EDITABLE_SELECTORS = [
    '.nav-brand',
    '.nav-links a',
    '.blob-main',
    '.blob-sub',
    '.bio p',
    '.section-label',
    '.section-intro',
    '.card h3',
    '.card p',
    '.card .meta',
    '.contact-info h2',
    '.contact-info > p',
    '.detail span',
    'footer'
  ].join(', ');

  document.querySelectorAll(EDITABLE_SELECTORS).forEach(el => {
    el.contentEditable = 'true';
    el.spellcheck = false;
  });

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'editor-download';
  btn.textContent = 'Download HTML';
  document.body.appendChild(btn);

  btn.addEventListener('click', () => {
    const clone = document.documentElement.cloneNode(true);

    // Strip the download button itself.
    clone.querySelectorAll('.editor-download').forEach(n => n.remove());

    // Strip contenteditable + spellcheck attrs added at runtime.
    clone.querySelectorAll('[contenteditable]').forEach(n => {
      n.removeAttribute('contenteditable');
      n.removeAttribute('spellcheck');
    });

    // Strip the editor link/script tags so the deployed file doesn't try to load them.
    clone.querySelectorAll('link[href*="editor.css"], script[src*="editor.js"]').forEach(n => n.remove());

    // Reset year span so deployed page recomputes it on load.
    const yearEl = clone.querySelector('#year');
    if (yearEl) yearEl.textContent = '';

    const html = '<!DOCTYPE html>\n' + clone.outerHTML;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
})();
