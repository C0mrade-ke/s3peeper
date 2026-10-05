(function() {
  const rx = {
    vhost: /([a-z0-9][a-z0-9.\-]{1,61}[a-z0-9])\.s3(?:[.\-]([a-z0-9\-]+))?\.amazonaws\.com/gi,
    vhostAlt: /s3(?:[.\-]([a-z0-9\-]+))?\.amazonaws\.com\/([a-z0-9][a-z0-9.\-]{1,61}[a-z0-9])/gi,
    website: /([a-z0-9][a-z0-9.\-]{1,61}[a-z0-9])\.s3\-website([.\-][a-z0-9\-]+)?\.amazonaws\.com/gi,
    cloudfront: /([a-z0-9]{10,16}\.cloudfront\.net)/gi,
    region: /([a-z]{2}-gov-[a-z]+-\d|[a-z]{2}-[a-z]+-\d)/gi,
    akid: /((?:AKIA|ASIA|ABIA|ACCA|ANPA|ANVA|AROA)[A-Z0-9]{16})/g,
    signed: /[?&](X-Amz-(?:Algorithm|Credential|Signature|Date|Expires))=[^&'"\s]+/gi,
    awsConf: /aws(_access_key_id|_secret_access_key|_session_token)?\s*[:=]\s*['"][^'"]{8,}['"]/gi
  };
  const B = {},
    R = {},
    CF = {},
    K = {},
    S = [],
    ST = {},
    hits = [];

  function scan(txt, src) {
    if (!txt || typeof txt !== 'string') return;
    let m;
    const run = (r, store, cb) => {
      r.lastIndex = 0;
      while ((m = r.exec(txt)) !== null) {
        const v = cb(m);
        if (v) {
          if (!store[v]) store[v] = new Set();
          store[v].add(src);
        }
      }
    };
    run(rx.vhost, B, m2 => m2[1].toLowerCase());
    run(rx.vhostAlt, B, m2 => m2[2].toLowerCase());
    run(rx.website, B, m2 => m2[1].toLowerCase());
    run(rx.region, R, m2 => m2[1].toLowerCase());
    run(rx.cloudfront, CF, m2 => m2[1]);
    run(rx.akid, K, m2 => m2[1]);
    run(rx.signed, {}, m2 => {
      S.push(m2[1] + ' in ' + src);
      return null;
    });
    rx.awsConf.lastIndex = 0;
    while ((m = rx.awsConf.exec(txt)) !== null) hits.push({
      src: src,
      snip: m[0].slice(0, 120)
    });
  }
  const perfUrls = performance.getEntriesByType('resource').map(r => r.name);
  scan(document.documentElement.outerHTML, 'DOM');
  scan(location.href, 'URL');
  perfUrls.forEach(u => scan(u, 'perf:' + u));
  document.querySelectorAll('script,link,img,source,video,iframe,a,object,embed,[data-src],[data-background]').forEach(el => {
    ['src', 'href', 'data-src', 'srcset', 'poster', 'data-background'].forEach(a => {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) scan(v, 'attr');
    });
  });
  (async () => {
    const targets = [...new Set(perfUrls.concat([...document.querySelectorAll('script[src],link[href]')].map(e => e.src || e.href)))].filter(u => u && (u.startsWith(location.origin) || u.includes('amazonaws') || u.includes('cloudfront'))).slice(0, 40);
    await Promise.all(targets.map(async u => {
      try {
        const t = await (await fetch(u, {
          credentials: 'omit'
        })).text();
        scan(t, 'body:' + u);
      } catch (e) {}
    }));
    await probe();
  })();
  async function probe() {
    const regions = Object.keys(R).length ? Object.keys(R) : ['us-east-1'];
    for (const b of Object.keys(B)) {
      const urls = ['https://' + b + '.s3.amazonaws.com/'].concat(regions.map(r => 'https://' + b + '.s3.' + r + '.amazonaws.com/'));
      const st = {
        alive: false,
        listable: false,
        urls: urls,
        sample: []
      };
      ST[b] = st;
      for (const u of urls) {
        try {
          await fetch(u, {
            mode: 'no-cors',
            credentials: 'omit'
          });
          st.alive = true;
          break;
        } catch (e) {}
      }
      try {
        const r = await fetch(urls[0] + '?list-type=2&max-keys=10', {
          credentials: 'omit'
        });
        if (r.ok) {
          const t = await r.text();
          if (t.indexOf('<Key>') > -1) {
            st.listable = true;
            st.sample = (t.match(/<Key>([^<]+)<\/Key>/g) || []).slice(0, 5).map(x => x.replace(/<\/?Key>/g, ''));
          }
        }
      } catch (e) {}
    }
    render();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function render() {
    const w = window.open('', '_blank');
    if (!w) {
      alert('Popup blocked. Allow popups for this site.');
      return;
    }
    const d = w.document;
    d.title = 'AWS Recon - ' + location.host;
    d.body.innerHTML = '';
    const st = d.createElement('style');
    st.textContent = 'body{background:#0d1117;color:#c9d1d9;font:13px/1.5%20monospace;padding:16px}h2{color:#58a6ff;margin:14px%200%206px}table{border-collapse:collapse}td,th{border:1px%20solid%20#30363d;padding:3px%208px}a{color:#58a6ff}.alive{color:#3fb950}.dead{color:#f85149}.hit{color:#f0883c}button{background:#238636;color:#fff;border:0;padding:6px%2012px;cursor:pointer;border-radius:6px}pre{white-space:pre-wrap}'; % 20 d.head.appendChild(st); % 20
    const % 20 btn = d.createElement('button');
    btn.textContent = 'Copy%20JSON%20report'; % 20
    const % 20 data = {
      host: location.host,
      time: new % 20 Date().toISOString(),
      % 20 buckets: Object.keys(B).map(b => ({
        name: b,
        alive: ST[b].alive,
        listable: ST[b].listable,
        urls: ST[b].urls,
        sample_keys: ST[b].sample
      })),
      % 20 regions: Object.keys(R),
      cloudfront: Object.keys(CF),
      aws_access_key_ids: Object.keys(K),
      signed_urls: S,
      config_leaks: hits.slice(0, 50)
    }; % 20 btn.onclick = () => navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => btn.textContent = 'Copied!'); % 20 d.body.appendChild(btn); % 20
    const % 20 put = t => {
      const % 20 h = d.createElement('h2');
      h.textContent = t;
      d.body.appendChild(h);
    }; % 20
    const % 20 tbl = rows => {
      const % 20 t = d.createElement('table');
      t.innerHTML = rows;
      d.body.appendChild(t);
    }; % 20 put('Buckets%20(' + Object.keys(B).length + ')'); % 20 tbl('<tr><th>Bucket</th><th>Status</th><th>Listable</th><th>Probe%20URLs</th><th>Sample%20keys</th></tr>' + % 20 Object.keys(B).map(b => '<tr><td>' + esc(b) + '</td><td%20class="' + (ST[b].alive ? 'alive">EXISTS' : 'dead">DNS-miss') + '</td><td>' + (ST[b].listable ? '<span%20class="alive">YES</span>' : 'no') + '</td><td>' + ST[b].urls.map(u => '<a%20href="' + esc(u) + '"%20target="_blank">' + esc(u.replace('https://', '')) + '</a>').join('<br>') + '</td><td>' + ((ST[b].sample || []).map(esc).join('<br>') || '-') + '</td></tr>').join('')); % 20 put('AWS%20Access%20Key%20IDs%20(' + Object.keys(K).length + ')'); % 20 d.body.insertAdjacentHTML('beforeend', '<pre%20class="hit">' + (Object.keys(K).map(esc).join('\n') || 'none') + '</pre>'); % 20 put('Signed%20URLs%20/%20params'); % 20 d.body.insertAdjacentHTML('beforeend', '<pre%20class="hit">' + esc(S.join('\n') || 'none') + '</pre>'); % 20 put('AWS%20config%20leaks'); % 20 d.body.insertAdjacentHTML('beforeend', '<pre%20class="hit">' + esc(hits.map(h => h.src + ':%20' + h.snip).join('\n') || 'none') + '</pre>'); % 20 put('Regions%20/%20CloudFront'); % 20 d.body.insertAdjacentHTML('beforeend', '<pre>' + esc(Object.keys(R).join(',%20') + '\n' + Object.keys(CF).join('\n')) + '</pre>'); % 20
  }
})();
