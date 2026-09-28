/* ============================================================
   AT Towing — interaction layer
   Vanilla JS, no dependencies.
   ============================================================ */
(function () {
  'use strict';

  var doc = document;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = function () { return window.matchMedia('(max-width: 960px)').matches; };

  /* ---------------- footer year ---------------- */
  var yearEl = doc.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------- sticky header shadow ---------------- */
  var header = doc.getElementById('header');
  var onScroll = function () {
    if (!header) return;
    header.classList.toggle('is-stuck', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------- mobile navigation ---------------- */
  var burger = doc.getElementById('burger');
  var nav = doc.getElementById('nav');

  function setNav(open) {
    if (!nav || !burger) return;
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    doc.body.classList.toggle('nav-open', open);
  }

  if (burger && nav) {
    burger.addEventListener('click', function () {
      setNav(burger.getAttribute('aria-expanded') !== 'true');
    });

    // close when a link inside the drawer is used
    nav.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (link && isMobile()) setNav(false);
    });

    // click outside closes the drawer
    doc.addEventListener('click', function (e) {
      if (!isMobile()) return;
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(e.target) || burger.contains(e.target)) return;
      setNav(false);
    });

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        setNav(false);
        closeAllSubmenus();
      }
    });

    window.addEventListener('resize', function () {
      if (!isMobile()) setNav(false);
    });
  }

  /* ---------------- services submenu ---------------- */
  var subToggles = Array.prototype.slice.call(doc.querySelectorAll('.nav__sub-toggle'));

  function closeAllSubmenus(except) {
    subToggles.forEach(function (btn) {
      var parent = btn.parentElement;
      if (parent === except) return;
      parent.setAttribute('aria-open', 'false');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  subToggles.forEach(function (btn) {
    var parent = btn.parentElement;
    parent.setAttribute('aria-open', 'false');

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = parent.getAttribute('aria-open') === 'true';
      closeAllSubmenus(parent);
      parent.setAttribute('aria-open', open ? 'false' : 'true');
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  });

  doc.addEventListener('click', function (e) {
    if (!e.target.closest('.has-sub')) closeAllSubmenus();
  });

  /* ---------------- FAQ accordion (one open at a time) ---------------- */
  var faqItems = Array.prototype.slice.call(doc.querySelectorAll('.faq__list .qa'));
  faqItems.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      faqItems.forEach(function (other) {
        if (other !== item) other.open = false;
      });
    });
  });

  /* ---------------- scroll reveal ---------------- */
  var revealEls = Array.prototype.slice.call(doc.querySelectorAll('.reveal'));
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealEls.forEach(function (el, i) {
      el.style.transitionDelay = (Math.min(i % 4, 3) * 70) + 'ms';
      io.observe(el);
    });
  }

  /* ---------------- active nav highlighting ---------------- */
  var navLinks = Array.prototype.slice.call(doc.querySelectorAll('.nav__link[href^="#"]'));
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute('href').slice(1);
      var el = id ? doc.getElementById(id) : null;
      return el ? { link: link, el: el } : null;
    })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (l) { l.classList.remove('is-active'); });
        var match = sections.filter(function (s) { return s.el === entry.target; })[0];
        if (match) match.link.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { spy.observe(s.el); });
  }

  /* ---------------- contact / quote forms ---------------- */
  /* Submissions are delivered to LeadrVision. The same endpoint is set as
     each form's action attribute, so the forms keep working without JS. */
  var LEAD_ENDPOINT = 'https://vision.leadrai.com/api/forms/5c45f1b219f871ef742e88a010265983';

  var RULES = {
    name: {
      test: function (v) { return v.trim().length >= 2; },
      msg: 'Please enter your full name.'
    },
    email: {
      test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
      msg: 'Please enter a valid email address.'
    },
    phone: {
      test: function (v) { return (v.replace(/\D/g, '').length >= 10); },
      msg: 'Please enter a phone number with at least 10 digits.'
    },
    Message: {
      test: function (v) { return v.trim().length >= 10; },
      msg: 'Please tell us a little more about how we can help.'
    }
  };

  function fieldOf(input) { return input.closest('.field'); }

  function setError(input, message) {
    var wrap = fieldOf(input);
    if (!wrap) return;
    var out = wrap.querySelector('[data-error-for="' + input.id + '"]');
    if (message) {
      wrap.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      if (out) out.textContent = message;
    } else {
      wrap.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
      if (out) out.textContent = '';
    }
  }

  function validateInput(input) {
    var rule = RULES[input.name];
    if (!rule) return true;
    var valid = rule.test(input.value);
    setError(input, valid ? '' : rule.msg);
    return valid;
  }

  // Stamp the current page so visitors are returned to the right place.
  function setPageField(form) {
    var pageField = form.elements['_page'];
    if (pageField) pageField.value = window.location.href;
  }

  // Collect every named field, so the payload mirrors a plain HTML submission.
  function collectPayload(form) {
    var payload = {};
    Array.prototype.slice.call(form.elements).forEach(function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (!el.checked) return;
      }
      if (typeof el.value !== 'string') return;
      payload[el.name] = el.value.trim();
    });
    payload._page = window.location.href;
    return payload;
  }

  function initLeadForm(form) {
    var okBox = form.querySelector('.form__status--ok');
    var errBox = form.querySelector('.form__status--err');
    var submitBtn = form.querySelector('[type="submit"]');
    var submitLabel = submitBtn ? submitBtn.innerHTML : '';
    var inputs = Array.prototype.slice.call(form.querySelectorAll('input, textarea'))
      .filter(function (el) { return el.type !== 'hidden' && el.name !== '_gotcha'; });
    var sending = false;

    setPageField(form);

    inputs.forEach(function (input) {
      input.addEventListener('blur', function () { validateInput(input); });
      input.addEventListener('input', function () {
        var wrap = fieldOf(input);
        if (wrap && wrap.classList.contains('is-invalid')) validateInput(input);
      });
    });

    function setSending(on) {
      sending = on;
      if (!submitBtn) return;
      submitBtn.disabled = on;
      submitBtn.innerHTML = on ? 'Sending&hellip;' : submitLabel;
    }

    function showStatus(box) {
      if (!box) return;
      box.hidden = false;
      box.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    }

    // Show the confirmation after a plain (no-JS) submission round-trip.
    if (/[?&]submitted=1(&|$)/.test(window.location.search) && okBox) {
      okBox.hidden = false;
    }

    form.addEventListener('submit', function (e) {
      if (typeof window.fetch !== 'function') return; // let the browser POST it
      e.preventDefault();
      if (sending) return;
      if (okBox) okBox.hidden = true;
      if (errBox) errBox.hidden = true;

      var firstInvalid = null;
      inputs.forEach(function (input) {
        if (!validateInput(input) && !firstInvalid) firstInvalid = input;
      });

      if (firstInvalid) {
        if (errBox) errBox.hidden = false;
        firstInvalid.focus();
        return;
      }

      var payload = collectPayload(form);

      setSending(true);

      window.fetch(form.getAttribute('action') || LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Request failed with status ' + res.status);
          return res.json().catch(function () { return { ok: true }; });
        })
        .then(function (data) {
          if (data && data.ok === false) throw new Error(data.error || 'Request rejected');
          setSending(false);
          form.reset();
          setPageField(form);
          inputs.forEach(function (input) { setError(input, ''); });
          showStatus(okBox);
        })
        .catch(function (err) {
          if (window.console && console.error) console.error('Lead submission failed:', err);
          setSending(false);
          showStatus(errBox);
        });
    });
  }

  Array.prototype.slice
    .call(doc.querySelectorAll('form[data-lead-form]'))
    .forEach(initLeadForm);
})();
