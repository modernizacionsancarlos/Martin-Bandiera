// Apply the saved light/dark mode before React renders, to avoid a flash.
// Kept as an external file because the CSP blocks inline scripts.
(function () {
  var dark = false;
  try {
    var saved = localStorage.getItem('job_martin_bandiera_dark_mode');
    dark = saved !== null
      ? saved === 'true'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    // ignore
  }
  document.documentElement.classList.toggle('dark', dark);
})();
