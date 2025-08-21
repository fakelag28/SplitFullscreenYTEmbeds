const YT_HOSTS = ["www.youtube.com", "www.youtube-nocookie.com"];
const translations = {
  ru: {
    split: "Разделить",
    restore: "Восстановить",
    splitError: "Не удалось определить VIDEO_ID из iframe.",
    splitFailed: "Ошибка при разделении экрана:",
    settingsSaved: "Настройки сохранены!"
  },
  en: {
    split: "Split",
    restore: "Restore",
    splitError: "Failed to get VIDEO_ID from iframe.",
    splitFailed: "Split error:",
    settingsSaved: "Settings saved!"
  }
};

let currentLanguage = 'ru';
let BUTTON_TEXT = translations.ru.split;
let RESTORE_TEXT = translations.ru.restore;

let isRestoring = false;

function getGlobalRestoreButton() {
  return document.getElementById('global-restore-btn');
}

function ensureGlobalRestoreButton() {
  let restoreBtn = getGlobalRestoreButton();
  
  if (!restoreBtn) {
    restoreBtn = document.createElement('button');
    restoreBtn.id = 'global-restore-btn';
    restoreBtn.className = 'global-restore-btn';
    document.body.appendChild(restoreBtn);
    
    restoreBtn.addEventListener('click', async () => {
      if (isRestoring) return;
      
      isRestoring = true;
      restoreBtn.classList.add('restoring');
      restoreBtn.textContent = 'Restoring...';
      
      try {
        const response = await chrome.runtime.sendMessage({ type: "RESTORE_REQUEST" });
        if (response && response.ok) {
          setTimeout(() => {
            restoreBtn.classList.remove('restoring');
            restoreBtn.textContent = RESTORE_TEXT;
            restoreBtn.style.display = 'none';
            document.querySelectorAll('.split-btn__wrap').forEach(wrap => {
              wrap.style.display = 'flex';
            });
            isRestoring = false;
          }, 500);
        } else {
          throw new Error(response?.error || "Unknown error");
        }
      } catch (err) {
        console.error("Restore error:", err);
        restoreBtn.classList.remove('restoring');
        restoreBtn.textContent = RESTORE_TEXT;
        isRestoring = false;
      }
    });
  }
  
  restoreBtn.textContent = RESTORE_TEXT;
  restoreBtn.style.display = 'block';
  return restoreBtn;
}

function extractVideoId(iframeSrc) {
  try {
    const url = new URL(iframeSrc);
    if (!YT_HOSTS.includes(url.hostname)) return null;
    if (url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/")[2] || null;
    }
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }
    return null;
  } catch {
    return null;
  }
}

function addSplitButton(iframe) {
  if (iframe.dataset.splitBtnAttached) return;
  iframe.dataset.splitBtnAttached = "1";

  const rectParent = iframe.parentElement || iframe;
  const wrap = document.createElement("div");
  wrap.className = "split-btn__wrap";

  const btn = document.createElement("button");
  btn.className = "split-btn";
  btn.textContent = BUTTON_TEXT;

  wrap.appendChild(btn);
  rectParent.style.position ||= "relative";
  rectParent.appendChild(wrap);

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const vid = extractVideoId(iframe.src);
    if (!vid) {
      alert(translations[currentLanguage].splitError);
      return;
    }
    try {
      const response = await chrome.runtime.sendMessage({ type: "SPLIT_REQUEST", videoId: vid });
      if (!response || !response.ok) {
        throw new Error(response?.error || "Unknown error");
      }
      ensureGlobalRestoreButton();
      document.querySelectorAll('.split-btn__wrap').forEach(wrap => {
        wrap.style.display = 'none';
      });
    } catch (err) {
      console.error("Split error:", err);
      alert(`${translations[currentLanguage].splitFailed} ${err.message}`);
    }
  });
}

function scan() {
  const iframes = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]');
  iframes.forEach((ifr) => addSplitButton(ifr));
  
  const restoreBtn = getGlobalRestoreButton();
  if (restoreBtn && restoreBtn.style.display !== 'none') {
    document.querySelectorAll('.split-btn__wrap').forEach(wrap => {
      wrap.style.display = 'none';
    });
  }
}

const mo = new MutationObserver(() => scan());
mo.observe(document.documentElement, { childList: true, subtree: true });
chrome.storage.sync.get(['language'], (data) => {
  if (data.language) {
    currentLanguage = data.language;
    BUTTON_TEXT = translations[currentLanguage].split;
    RESTORE_TEXT = translations[currentLanguage].restore;
  }
  scan();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "LANGUAGE_CHANGED") {
    currentLanguage = msg.language;
    BUTTON_TEXT = translations[currentLanguage].split;
    RESTORE_TEXT = translations[currentLanguage].restore;
    
    document.querySelectorAll('.split-btn').forEach(btn => {
      btn.textContent = BUTTON_TEXT;
    });
    
    const restoreBtn = getGlobalRestoreButton();
    if (restoreBtn) {
      restoreBtn.textContent = RESTORE_TEXT;
    }
  }
});