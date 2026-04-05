// netlify/functions/proxy.js
// ProjectDesk v9 — Netlify Proxy for Google Apps Script
// Forwards all requests from the HTML app to the Apps Script Web App,
// bypassing browser CORS restrictions.

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6Dp_ULdcUHhFEvfjmd2rFynm-B-df7wBG-Uw86Q5_x-qIkSGgkYLZmmgUfcjFEoDW/exec';

exports.handler = async function(event) {
  try {
    // Build the forwarding URL with all query parameters
    const params = event.queryStringParameters || {};
    const queryString = Object.keys(params)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
      .join('&');
    const url = APPS_SCRIPT_URL + (queryString ? '?' + queryString : '');

    // Forward the request to Apps Script
    const response = await fetch(url, { redirect: 'follow' });
    const text = await response.text();

    // Attempt to parse as JSON, return as-is if not valid
    let body;
    try {
      JSON.parse(text); // validate
      body = text;
    } catch(e) {
      body = JSON.stringify({ success: false, error: 'Invalid response from Apps Script: ' + text.substring(0, 200) });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: body
    };

  } catch(err) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, error: 'Proxy error: ' + err.message })
    };
  }
};
