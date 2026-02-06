// Lightweight error banner for user-visible failures
let hideTimer;

export function showErrorBanner(message, duration = 6000) {
  if (!message) return;
  let banner = document.getElementById('error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'error-banner';
    banner.className = 'error-banner hidden';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'error-banner__close';
    closeBtn.setAttribute('aria-label', 'Dismiss error');
    closeBtn.textContent = '×';
    closeBtn.onclick = () => {
      banner.classList.add('hidden');
      if (hideTimer) clearTimeout(hideTimer);
    };

    const msgSpan = document.createElement('span');
    msgSpan.className = 'error-banner__message';

    banner.appendChild(msgSpan);
    banner.appendChild(closeBtn);
    document.body.prepend(banner);
  }
  const msgSpan = banner.querySelector('.error-banner__message');
  if (msgSpan) {
    msgSpan.textContent = message;
  } else {
    banner.textContent = message;
  }
  banner.classList.remove('hidden');
  banner.classList.add('show');

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    banner.classList.add('hidden');
  }, duration);
}
