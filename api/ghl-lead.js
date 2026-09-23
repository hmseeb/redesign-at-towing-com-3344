'use strict';

/* ============================================================
   GoHighLevel lead intake
   Receives submissions from the site forms and creates/updates
   a contact in the AT Towing sub-account.

   Auth: set GHL_API_KEY (Private Integration token / v2 access
   token) in the deployment environment. GHL_LOCATION_ID may be
   set to override the default sub-account.
   ============================================================ */

var API_BASE = 'https://services.leadconnectorhq.com';
var API_VERSION = '2021-07-28';
var DEFAULT_LOCATION_ID = 'K1fuM6V0oHLnUHKCRJdt';
var LEAD_TAG = 'website-lead';
var LEAD_SOURCE = 'Website';

function getToken() {
  return (
    process.env.GHL_API_KEY ||
    process.env.GHL_PRIVATE_INTEGRATION_TOKEN ||
    process.env.GHL_ACCESS_TOKEN ||
    process.env.HIGHLEVEL_API_KEY ||
    ''
  ).trim();
}

function getLocationId() {
  return (process.env.GHL_LOCATION_ID || DEFAULT_LOCATION_ID).trim();
}

/* ---------------- helpers ---------------- */

function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string' && req.body.length) {
      try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve({}); }
    }
    var raw = '';
    req.on('data', function (chunk) { raw += chunk; });
    req.on('end', function () {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitName(fullName) {
  var parts = str(fullName).split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// GoHighLevel prefers E.164; assume US/CA when no country code is given.
function normalizePhone(input) {
  var value = str(input);
  if (!value) return '';
  if (value.charAt(0) === '+') return '+' + value.slice(1).replace(/\D/g, '');
  var digits = value.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.charAt(0) === '1') return '+' + digits;
  return digits ? '+' + digits : '';
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function ghlFetch(path, options) {
  var opts = options || {};
  return fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers: {
      Authorization: 'Bearer ' + getToken(),
      Version: API_VERSION,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  }).then(function (res) {
    return res.text().then(function (text) {
      var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
      return { ok: res.ok, status: res.status, data: data };
    });
  });
}

/* ---------------- custom fields ---------------- */
/* Resolve "Lead Source" / "Website Form" to their field ids so the
   values land on the right custom fields in the sub-account. */

var fieldCache = { at: 0, map: null };
var FIELD_CACHE_MS = 10 * 60 * 1000;

function getCustomFieldMap(locationId) {
  var now = Date.now();
  if (fieldCache.map && now - fieldCache.at < FIELD_CACHE_MS) {
    return Promise.resolve(fieldCache.map);
  }
  return ghlFetch('/locations/' + encodeURIComponent(locationId) + '/customFields')
    .then(function (res) {
      var map = {};
      var list = (res.data && (res.data.customFields || res.data.customField)) || [];
      if (Array.isArray(list)) {
        list.forEach(function (field) {
          if (!field || !field.id) return;
          if (field.name) map[normalizeKey(field.name)] = field.id;
          if (field.fieldKey) {
            map[normalizeKey(String(field.fieldKey).replace(/^contact\./, ''))] = field.id;
          }
        });
      }
      fieldCache = { at: now, map: map };
      return map;
    })
    .catch(function () { return {}; });
}

// The two fields the site relies on must exist; create them once if the
// sub-account does not have them yet.
function ensureCustomField(locationId, map, name) {
  var key = normalizeKey(name);
  if (map[key]) return Promise.resolve(map[key]);
  return ghlFetch('/locations/' + encodeURIComponent(locationId) + '/customFields', {
    method: 'POST',
    body: { name: name, dataType: 'TEXT', model: 'contact' }
  })
    .then(function (res) {
      var created = (res.data && (res.data.customField || res.data.customfield)) || {};
      if (res.ok && created.id) {
        map[key] = created.id;
        return created.id;
      }
      console.error('[ghl-lead] could not create custom field "' + name + '"', res.status, res.data);
      return '';
    })
    .catch(function () { return ''; });
}

function buildCustomFields(map, entries) {
  var out = [];
  entries.forEach(function (entry) {
    var id = map[normalizeKey(entry[0])];
    if (id && entry[1]) out.push({ id: id, field_value: entry[1] });
  });
  return out;
}

/* ---------------- handler ---------------- */

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  var token = getToken();
  if (!token) {
    console.error('[ghl-lead] Missing GHL_API_KEY environment variable.');
    res.status(500).json({ ok: false, error: 'Lead delivery is not configured.' });
    return;
  }

  var locationId = getLocationId();

  readBody(req)
    .then(function (body) {
      var email = str(body.email);
      var phone = normalizePhone(body.phone);
      var message = str(body.message);
      var formName = str(body.formName) || 'Website Form';

      var first = str(body.firstName);
      var last = str(body.lastName);
      if (!first && !last) {
        var split = splitName(body.name);
        first = split.firstName;
        last = split.lastName;
      }

      if (!email && !phone) {
        res.status(400).json({ ok: false, error: 'An email address or phone number is required.' });
        return null;
      }

      return getCustomFieldMap(locationId).then(function (map) {
        return Promise.all([
          ensureCustomField(locationId, map, 'Lead Source'),
          ensureCustomField(locationId, map, 'Website Form')
        ]).then(function () { return map; });
      }).then(function (map) {
        var payload = {
          locationId: locationId,
          firstName: first,
          lastName: last,
          name: [first, last].filter(Boolean).join(' '),
          source: LEAD_SOURCE,
          tags: [LEAD_TAG],
          customFields: buildCustomFields(map, [
            ['Lead Source', LEAD_SOURCE],
            ['Website Form', formName],
            ['Message', message]
          ])
        };
        if (email) payload.email = email;
        if (phone) payload.phone = phone;

        return ghlFetch('/contacts/upsert', { method: 'POST', body: payload })
          .then(function (result) {
            if (!result.ok) {
              console.error('[ghl-lead] upsert failed', result.status, result.data);
              res.status(502).json({ ok: false, error: 'Could not deliver the lead.' });
              return null;
            }

            var contact = (result.data && (result.data.contact || result.data)) || {};
            var contactId = contact.id || contact._id || '';
            var tags = Array.isArray(contact.tags) ? contact.tags.map(normalizeKey) : [];
            var follow = [];

            // Make sure the tag stuck even on an update of an existing contact.
            if (contactId && tags.indexOf(normalizeKey(LEAD_TAG)) === -1) {
              follow.push(
                ghlFetch('/contacts/' + encodeURIComponent(contactId) + '/tags', {
                  method: 'POST',
                  body: { tags: [LEAD_TAG] }
                }).catch(function () { return null; })
              );
            }

            // Keep the full message on the contact timeline as a note.
            if (contactId && message) {
              follow.push(
                ghlFetch('/contacts/' + encodeURIComponent(contactId) + '/notes', {
                  method: 'POST',
                  body: { body: formName + ' submission:\n\n' + message }
                }).catch(function () { return null; })
              );
            }

            return Promise.all(follow).then(function () {
              res.status(200).json({ ok: true, contactId: contactId });
              return null;
            });
          });
      });
    })
    .catch(function (err) {
      console.error('[ghl-lead] unexpected error', err);
      if (!res.headersSent) {
        res.status(502).json({ ok: false, error: 'Could not deliver the lead.' });
      }
    });
};
