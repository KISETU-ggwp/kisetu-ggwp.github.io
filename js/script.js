document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('nav');
  const profileVideo = document.querySelector('.profile-video');

  if (menuToggle && nav) {
    const setMenuState = function(isOpen) {
      menuToggle.classList.toggle('active', isOpen);
      nav.classList.toggle('active', isOpen);
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      window.portfolioI18n.syncMenuLabel();
    };

    menuToggle.addEventListener('click', function() {
      setMenuState(!menuToggle.classList.contains('active'));
    });

    nav.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        setMenuState(false);
      });
    });

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        setMenuState(false);
      }
    });
  }

  if (profileVideo) {
    const startPlayback = function() {
      profileVideo.classList.remove('is-loading');
      const playPromise = profileVideo.play();

      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function() {
          profileVideo.classList.remove('is-loading');
        });
      }
    };

    if (profileVideo.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      startPlayback();
    } else {
      profileVideo.addEventListener('canplaythrough', startPlayback, { once: true });
      profileVideo.load();
    }
  }
});
