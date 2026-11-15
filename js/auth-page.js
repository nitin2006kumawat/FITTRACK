import {
  isSupabaseConfigured,
  signInWithPassword,
  signUpWithPassword,
} from "./auth.js";

const form = document.querySelector("#auth-form");
const status = document.querySelector("#auth-status");
const configurationWarning = document.querySelector("#auth-config-warning");
const submitButton = form.querySelector("button[type='submit']");

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
  status.hidden = false;
}

if (!isSupabaseConfigured()) {
  configurationWarning.textContent = "Account access is not configured yet. Add your Supabase project URL and publishable key in js/supabase-config.js. Guest mode remains available.";
  configurationWarning.hidden = false;
  submitButton.disabled = true;
} else {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const email = String(formData.get("email")).trim();
    const password = String(formData.get("password"));
    submitButton.disabled = true;
    status.hidden = true;

    try {
      if (form.dataset.authMode === "register") {
        const displayName = String(formData.get("name")).trim();
        if (!displayName) {
          showStatus("Enter your name to create an account.", true);
          form.elements.name.focus();
          return;
        }
        const result = await signUpWithPassword(email, password, displayName);
        if (!result.session) {
          showStatus("Account created. Check your email to confirm your address, then sign in.");
          return;
        }
      } else {
        await signInWithPassword(email, password);
      }
      window.location.replace("index.html#profile");
    } catch (error) {
      showStatus(error.message || "Account access failed. Check your details and try again.", true);
    } finally {
      submitButton.disabled = false;
    }
  });
}
