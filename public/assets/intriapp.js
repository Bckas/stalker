// Admin page ke URL se token capture karke saare AJAX calls me bhejo
const URL_TOKEN = window.APP_TOKEN || new URLSearchParams(location.search).get('token') || '';
$(document).ajaxSend(function (event, jqXHR, settings) {
  if (!URL_TOKEN) return;
  if (typeof settings.data === 'string' && settings.data) {
    settings.data += '&token=' + encodeURIComponent(URL_TOKEN);
  } else if (settings.data) {
    settings.data.token = URL_TOKEN;
  } else {
    settings.data = 'token=' + encodeURIComponent(URL_TOKEN);
  }
});
