// No YouTube requests until the reader clicks. Guard by media time, not elapsed time.
(() => {
  const button = document.querySelector('[data-load-mbc-video]');
  const container = document.querySelector('[data-mbc-player]');
  const status = document.querySelector('[data-mbc-video-status]');
  if (!button || !container) return;
  const START = 732, END = 746, VIDEO = '6MazS9MqY6g';
  let apiPromise, player, poll, bootTimer, active = false, generation = 0;
  const say = text => { if (status) status.textContent = text; };
  function finish(message) {
    if (!active) return;
    active = false;
    generation += 1;
    clearInterval(poll);
    clearTimeout(bootTimer);
    try { player?.pauseVideo(); } catch (_) {}
    try { player?.destroy(); } catch (_) {}
    player = null;
    button.disabled = false;
    button.textContent = 'Load excerpt again · 12:12–12:26';
    container.replaceChildren(button);
    say(message);
  }
  function guard() {
    if (!active || !player) return;
    const time = Number(player.getCurrentTime());
    if (Number.isFinite(time) && time >= END) {
      finish('The 12:12–12:26 excerpt has ended. Load it again to replay.');
    }
  }
  function loadApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { if (typeof previous === 'function') previous(); } finally { resolve(); }
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => { apiPromise = null; script.remove(); reject(new Error('YouTube API unavailable')); };
      document.head.appendChild(script);
    });
    return apiPromise;
  }
  button.addEventListener('click', async () => {
    if (active) return;
    active = true;
    const attempt = ++generation;
    button.disabled = true;
    say('Loading the official player. Automatic playback is off.');
    bootTimer = setTimeout(() => finish('The player could not connect. Try loading again or use the original YouTube link below.'), 20000);
    try {
      await loadApi();
      if (!active || attempt !== generation) return;
      const frame = document.createElement('iframe');
      frame.title = 'MBC official clip: The Manager episode 226, excerpt 12:12–12:26';
      frame.src = `https://www.youtube-nocookie.com/embed/${VIDEO}?start=${START}&end=${END}&autoplay=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
      frame.width = '560'; frame.height = '315';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allow = 'encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      container.replaceChildren(frame);
      player = new window.YT.Player(frame, { events: {
        onReady(event) {
          if (!active || attempt !== generation) return;
          clearTimeout(bootTimer);
          player = event.target;
          // Queue without autoplay; do not seekTo(), which invalidates endSeconds.
          player.cueVideoById({ videoId: VIDEO, startSeconds: START, endSeconds: END });
          poll = setInterval(guard, 100);
          say('Press Play for the 12:12–12:26 excerpt. The player closes when the excerpt ends.');
        },
        onStateChange(event) {
          if (!active || attempt !== generation) return;
          if (event.data === 0) finish('The excerpt has ended. Load it again to replay.');
          else guard();
        },
        onError() { if (active && attempt === generation) finish('Playback is unavailable here. Use the original YouTube link below.'); }
      }});
    } catch (_) {
      if (attempt === generation) finish('The player could not connect. Use the original YouTube link below.');
    }
  });
  document.addEventListener('visibilitychange', guard);
  window.addEventListener('pagehide', () => finish('Load the excerpt to watch again.'));
})();
