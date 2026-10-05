(function () {
  'use strict';

  const storageKey = 'portfolio.language';
  const root = document.documentElement;
  const copy = window.portfolioTranslations;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let language = 'ja';
  let revision = 0;
  let animations = [];
  let frames = [];
  let cleanups = [];
  let initialized = false;

  try {
    if (localStorage.getItem(storageKey) === 'en') language = 'en';
  } catch (_) {
    // Language switching also works when browser storage is unavailable.
  }
  root.lang = language;
  if (language === 'en') {
    root.dataset.i18nPending = '';
    // Always reveal the original HTML if initialization is interrupted.
    window.setTimeout(() => delete root.dataset.i18nPending, 1500);
  }

  function text(key) {
    const entry = copy[key];
    return entry ? entry[language] || entry.ja : '';
  }

  function syncMenuLabel() {
    const menu = document.querySelector('.menu-toggle');
    if (menu) {
      menu.setAttribute('aria-label', text(
        menu.getAttribute('aria-expanded') === 'true' ? 'common.menuClose' : 'common.menuOpen'
      ));
    }
  }

  function applyLanguage() {
    root.lang = language;
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const value = text(element.dataset.i18n);
      if (value && element.textContent !== value) element.textContent = value;
    });
    ['content', 'aria-label', 'alt'].forEach(attribute => {
      document.querySelectorAll('[data-i18n-' + attribute + ']').forEach(element => {
        const value = text(element.getAttribute('data-i18n-' + attribute));
        if (value) element.setAttribute(attribute, value);
      });
    });
    document.querySelectorAll('[data-language]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
    const locale = document.querySelector('meta[property="og:locale"]');
    if (locale) locale.content = language === 'ja' ? 'ja_JP' : 'en_US';
    syncMenuLabel();
  }

  function cancelEffects() {
    animations.forEach(animation => animation.cancel());
    frames.forEach(frame => cancelAnimationFrame(frame));
    cleanups.forEach(cleanup => cleanup());
    animations = [];
    frames = [];
    cleanups = [];
  }

  function animate(element, keyframes, options) {
    const animation = element.animate(keyframes, options);
    animations.push(animation);
    return animation.finished.catch(() => {});
  }

  function visibleBlocks(nextLanguage) {
    const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
    const blocks = new Set();
    document.querySelectorAll('main [data-i18n]').forEach(element => {
      const entry = copy[element.dataset.i18n];
      if (!entry || entry.ja === entry.en || element.textContent === entry[nextLanguage]) return;
      const block = element.closest('h1, h2, h4, p, .keyword-tag') || element;
      const bounds = block.getBoundingClientRect();
      if (bounds.bottom > headerBottom && bounds.top < innerHeight && bounds.height > 0) blocks.add(block);
    });
    return [...blocks].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  }

  // Keep the paragraph the reader was viewing in the same viewport position.
  function withScrollAnchor(block, update) {
    const top = block?.getBoundingClientRect().top;
    const shouldRestore = scrollY > 0 && top !== undefined;
    update();
    if (shouldRestore) window.scrollBy(0, block.getBoundingClientRect().top - top);
  }

  function scramble(element, delay, token) {
    const finalText = element.textContent;
    const glyphs = Array.from(finalText);
    // Layout is measured from the final text. Only the decorative layer changes.
    const accessible = document.createElement('span');
    accessible.className = 'i18n-scramble-final';
    accessible.textContent = finalText;
    const visual = document.createElement('span');
    visual.className = 'i18n-scramble-visual';
    visual.setAttribute('aria-hidden', 'true');
    element.classList.add('i18n-scrambling');
    element.replaceChildren(accessible, visual);
    const cleanup = () => {
      element.classList.remove('i18n-scrambling');
      element.textContent = finalText;
    };
    cleanups.push(cleanup);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let start;
    function tick(now) {
      if (token !== revision) return;
      if (start === undefined) start = now;
      const progress = Math.max(0, (now - start - delay) / 360);
      if (progress >= 1) {
        cleanup();
        return;
      }
      visual.textContent = glyphs.map((glyph, index) => {
        if (/\s/.test(glyph) || index < Math.floor(progress * glyphs.length)) return glyph;
        return alphabet[(Math.floor(now / 55) + index * 7) % alphabet.length];
      }).join('');
      frames.push(requestAnimationFrame(tick));
    }
    tick(performance.now());
  }

  async function setLanguage(nextLanguage) {
    if (!['ja', 'en'].includes(nextLanguage) || language === nextLanguage) return;
    const token = ++revision;
    cancelEffects();
    const blocks = visibleBlocks(nextLanguage);
    language = nextLanguage;
    try { localStorage.setItem(storageKey, language); } catch (_) { /* Optional persistence. */ }
    // The switch responds immediately, while the text finishes its exit motion.
    document.querySelectorAll('[data-language]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
    document.querySelector('.language-switch')?.setAttribute('data-selected', language);

    const useMotion = !motionPreference.matches && typeof Element.prototype.animate === 'function';
    if (useMotion) {
      await Promise.all(blocks.map(block => animate(block, [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-5px)' }
      ], { duration: 100, easing: 'ease-in', fill: 'forwards' })));
    }
    if (token !== revision) return;
    cancelEffects();
    withScrollAnchor(blocks[0], applyLanguage);

    if (useMotion && !motionPreference.matches) {
      blocks.forEach((block, index) => {
        const delay = Math.min(index * 25, 100);
        const heading = block.matches('h1, h2') && block.textContent.length <= 64;
        if (heading) {
          const label = block.querySelector('[data-i18n]');
          if (label) scramble(label, delay, token);
        } else {
          animate(block, [
            { opacity: 0, transform: 'translateY(6px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ], { duration: 240, delay, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
        }
      });
    }
    const status = document.querySelector('.language-status');
    if (status) status.textContent = text('common.switched');
  }

  function init() {
    if (initialized) return;
    initialized = true;
    try {
      applyLanguage();
      document.querySelector('.language-switch')?.setAttribute('data-selected', language);
      document.querySelectorAll('[data-language]').forEach(button => {
        button.addEventListener('click', () => setLanguage(button.dataset.language));
      });
      const status = document.createElement('div');
      status.className = 'language-status visually-hidden';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
      document.body.append(status);
    } finally {
      delete root.dataset.i18nPending;
    }
  }

  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) {
      ++revision;
      cancelEffects();
      applyLanguage();
    }
  });
  window.portfolioI18n = { init, text, syncMenuLabel };
})();
