const YT_HOSTS = ["www.youtube.com", "www.youtube-nocookie.com"];
const BUTTON_TEXT = "Split";
const RESTORE_TEXT = "Restore";

const style = document.createElement('style');
style.textContent = `
  .split-btn__wrap {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1000;
    display: flex;
    gap: 8px;
  }
  
  .split-btn, .restore-btn {
    padding: 6px 12px;
    background: rgba(28, 28, 28, 0.8);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: background 0.2s;
  }
  
  .split-btn:hover, .restore-btn:hover {
    background: rgba(255, 0, 0, 0.8);
  }
  
  .global-restore-btn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    padding: 10px 16px;
    background: rgba(40, 40, 40, 0.9);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }
  
  .global-restore-btn:hover {
    background: rgba(255, 0, 0, 0.9);
  }
  
  .global-restore-btn.restoring {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;
document.head.appendChild(style);

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
      alert("Не удалось определить VIDEO_ID из iframe.");
      return;
    }
    try {
      const response = await chrome.runtime.sendMessage({ type: "SPLIT_REQUEST", videoId: vid });
      if (!response || !response.ok) {
        throw new Error(response?.error || "Unknown error");
      }
      ensureGlobalRestoreButton();
    } catch (err) {
      console.error("Split error:", err);
      alert(`Ошибка при разделении экрана: ${err.message}`);
    }
  });
}

function scan() {
  const iframes = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]');
  iframes.forEach((ifr) => addSplitButton(ifr));
}

const mo = new MutationObserver(() => scan());
mo.observe(document.documentElement, { childList: true, subtree: true });
scan();