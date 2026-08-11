
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

    // Set the hidden anti-bot marker; the server requires it (see app.py).
    // The token comes from the form's data-xrw attribute so there is a single
    // source of truth shared with the backend.
    document.getElementById('xrw').value = document.querySelector('form').dataset.xrw;
    return true;  // Allow form submission -> POST /login -> debrief reveal
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

    // Show the "Something went wrong" banner only when the server rejected a
    // submission (it redirects back with ?error=1). Keeps the page calm otherwise.
    if (new URLSearchParams(window.location.search).has('error')) {
      errorMessage.style.display = 'block'; // Display the message

      // Hide the error message after user clicks anywhere on the page
      document.body.addEventListener('click', function() {
        errorMessage.style.display = 'none';
      });
    }
  };
  