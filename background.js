let originalWindows = new Map();
let embedWindowIds = new Set();

async function getActiveWindow() {
  return await chrome.windows.getCurrent({ populate: true });
}

async function getDisplayForWindow(win) {
  const displays = await chrome.system.display.getInfo();
  const wBounds = {
    left: win.left,
    top: win.top,
    width: win.width,
    height: win.height
  };
  
  let best = displays[0], bestArea = -1;
  for (const d of displays) {
    const a = intersectionArea(wBounds, d.workArea);
    if (a > bestArea) { bestArea = a; best = d; }
  }
  return best;
}

function intersectionArea(a, b) {
  if (!a || !b) return 0;
  const xOverlap = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
  const yOverlap = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
  return xOverlap * yOverlap;
}

async function computeLayout(work) {
  const settings = await new Promise(resolve => {
    chrome.storage.sync.get({splitPercent: 50}, resolve);
  });
  
  const percent = settings.splitPercent / 100;
  const leftW = Math.floor(work.width * percent);
  const rightW = work.width - leftW;
  
  return {
    left: {
      left: work.left,
      top: work.top,
      width: leftW,
      height: work.height
    },
    right: {
      left: work.left + leftW,
      top: work.top,
      width: rightW,
      height: work.height
    }
  };
}

async function restoreWindows() {
  const restorePromises = [];
  
  for (const [windowId, originalState] of originalWindows.entries()) {
    try {
      const existingWindow = await chrome.windows.get(windowId).catch(() => null);
      if (!existingWindow) continue;
      
      if (originalState.state && originalState.state !== "normal") {
        restorePromises.push(chrome.windows.update(windowId, { state: originalState.state }));
      } else {
        restorePromises.push(chrome.windows.update(windowId, {
          left: originalState.left,
          top: originalState.top,
          width: originalState.width,
          height: originalState.height,
          state: "normal"
        }));
      }
    } catch (e) {
      console.log(`Window ${windowId} no longer exists`, e);
    }
  }
  
  for (const windowId of embedWindowIds) {
    try {
      const existingWindow = await chrome.windows.get(windowId).catch(() => null);
      if (existingWindow) {
        restorePromises.push(chrome.windows.remove(windowId));
      }
    } catch (e) {
      console.log(`Embed window ${windowId} no longer exists`, e);
    }
  }
  
  await Promise.all(restorePromises);
  
  originalWindows.clear();
  embedWindowIds.clear();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SPLIT_REQUEST") {
    (async () => {
      try {
        originalWindows.clear();
        embedWindowIds.clear();

        const videoId = msg.videoId;
        const win = await getActiveWindow();
        const display = await getDisplayForWindow(win);
        const layout = await computeLayout(display.workArea);

        originalWindows.set(win.id, {
          left: win.left,
          top: win.top,
          width: win.width,
          height: win.height,
          state: win.state
        });

        await chrome.windows.update(win.id, {
          left: layout.left.left,
          top: layout.left.top,
          width: layout.left.width,
          height: layout.left.height,
          state: "normal"
        });

        const url = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&controls=1&fs=0&rel=0&modestbranding=1`;
        const newWindow = await chrome.windows.create({
          url,
          left: layout.right.left,
          top: layout.right.top,
          width: layout.right.width,
          height: layout.right.height,
          focused: true,
          type: "popup"
        });

        embedWindowIds.add(newWindow.id);

        sendResponse({ ok: true });
      } catch (err) {
        console.error("Split error:", err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
  
  if (msg.type === "RESTORE_REQUEST") {
    (async () => {
      try {
        await restoreWindows();
        sendResponse({ ok: true });
      } catch (err) {
        console.error("Restore error:", err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
});