/**
 * Returns the JavaScript code string to be injected into the LeetCode web page MAIN world.
 * Intercepts network responses to detect Accepted submissions.
 */
export function injectMainWorldInterceptor(): void {
  const scriptContent = `
    (function() {
      if (window.__gitleet_injected__) return;
      window.__gitleet_injected__ = true;

      const origFetch = window.fetch;
      window.fetch = async function(...args) {
        const response = await origFetch.apply(this, args);
        const clone = response.clone();

        try {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
          
          // Check GraphQL queries or submission polling routes
          if (url.includes('/submissions/detail/') || url.includes('/graphql') || url.includes('/submit/')) {
            clone.json().then(data => {
              if (!data) return;

              let isAccepted = false;
              let lang = '';
              let code = '';
              let probSlug = '';

              // Route 1: Standard REST polling check
              if (data.state === 'SUCCESS' && data.status_msg === 'Accepted') {
                isAccepted = true;
                lang = data.lang || '';
                code = data.code || '';
              }

              // Route 2: GraphQL submission details
              if (data.data && data.data.submissionDetails) {
                const sub = data.data.submissionDetails;
                if (sub.statusDisplay === 'Accepted' || sub.statusCode === 10) {
                  isAccepted = true;
                  lang = sub.lang && sub.lang.name ? sub.lang.name : (sub.lang || '');
                  code = sub.code || '';
                }
              }

              if (isAccepted) {
                window.postMessage({
                  type: 'GITLEET_SUBMISSION_ACCEPTED',
                  payload: {
                    language: lang,
                    code: code,
                    timestamp: Date.now()
                  }
                }, '*');
              }
            }).catch(() => {});
          }
        } catch (err) {}

        return response;
      };

      const origXhrOpen = XMLHttpRequest.prototype.open;
      const origXhrSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._url = url;
        return origXhrOpen.call(this, method, url, ...rest);
      };

      XMLHttpRequest.prototype.send = function(...args) {
        this.addEventListener('load', function() {
          try {
            if (this._url && (this._url.includes('/submissions/detail/') || this._url.includes('/graphql'))) {
              const text = this.responseText;
              if (text && text.includes('Accepted')) {
                const data = JSON.parse(text);
                if ((data.state === 'SUCCESS' && data.status_msg === 'Accepted') ||
                    (data.data && data.data.submissionDetails && data.data.submissionDetails.statusDisplay === 'Accepted')) {
                  window.postMessage({
                    type: 'GITLEET_SUBMISSION_ACCEPTED',
                    payload: { timestamp: Date.now() }
                  }, '*');
                }
              }
            }
          } catch (e) {}
        });
        return origXhrSend.apply(this, args);
      };
    })();
  `;

  const scriptEl = document.createElement('script');
  scriptEl.textContent = scriptContent;
  (document.head || document.documentElement).appendChild(scriptEl);
  scriptEl.remove();
}
