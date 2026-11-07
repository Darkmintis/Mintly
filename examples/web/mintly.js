// Mintly — plain web helper (no build step, no dependencies).
//
//   <script src="/mintly.js"></script>
//   <script>
//     Mintly.configure({ url: 'https://mintly.example.workers.dev', key: 'mk_...' });
//     document.querySelector('#red').addEventListener('click', function () {
//       Mintly.click('home.red_button', 'web');
//     });
//   </script>

(function () {
  var config = { url: '', key: '' };
  var queue = [];
  var timer = null;

  function endpoint() { return config.url.replace(/\/+$/, '') + '/v1/event'; }

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    var batch = queue.splice(0, 8);
    if (!config.url || !config.key) return;
    batch.forEach(function (entry) {
      try {
        fetch(endpoint(), {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', 'X-App-Key': config.key },
          body: JSON.stringify(entry)
        }).catch(function () {});
      } catch (e) { /* ignore */ }
    });
  }

  function enqueue(event, dim1, dim2, count) {
    if (!config.url || !config.key) return;
    if (queue.length >= 100) queue.shift();
    queue.push({ event: event, dim1: dim1 || '', dim2: dim2 || '', count: count || 1 });
    if (queue.length >= 8) flush();
    else if (!timer) timer = setTimeout(flush, 4000);
  }

  // Flush what is left when the tab is hidden or closed.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  window.Mintly = {
    configure: function (options) {
      config.url = String(options.url || '');
      config.key = String(options.key || '');
    },
    event: function (name, dim1, dim2, count) { enqueue(name, dim1, dim2, count); },
    click: function (button, platform) { enqueue('ui_click', button, platform || 'web'); },
    appOpen: function (platform) { enqueue('app_open', '', platform || 'web'); },
    flush: flush
  };
})();
