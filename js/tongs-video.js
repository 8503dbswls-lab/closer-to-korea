// The official player is created only after the reader chooses to load it.
(() => {
  const button = document.querySelector('[data-load-mbc-video]');
  const container = document.querySelector('[data-mbc-player]');
  const status = document.querySelector('[data-mbc-video-status]');
  if (!button || !container) return;
  button.addEventListener('click', () => {
    if (container.querySelector('iframe')) return;
    const player = document.createElement('iframe');
    player.title = 'MBC official clip: The Manager episode 226, starting at 12:12';
    player.src = 'https://www.youtube-nocookie.com/embed/6MazS9MqY6g?start=732&autoplay=0&playsinline=1';
    player.width = '560';
    player.height = '315';
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    player.allow = 'encrypted-media; picture-in-picture; fullscreen';
    player.allowFullscreen = true;
    container.replaceChildren(player);
    if (status) status.textContent = 'Press Play in the player. If playback is unavailable here, use the official YouTube link below.';
    player.focus();
  }, { once: true });
})();
