const DRAFT_KEY = "scarlet-portfolio-draft";
const FILE_DB = "scarlet-portfolio-file";

const docInput = document.querySelector("#doc");
const ep1Input = document.querySelector("#ep1");
const ep2Input = document.querySelector("#ep2");
const status = document.querySelector("#status");

function liveContent() {
  const live = window.PORTFOLIO || { documentary: "", episodes: [] };
  return {
    documentary: live.documentary || "",
    episodes: [
      (live.episodes[0] && live.episodes[0].url) || "",
      (live.episodes[1] && live.episodes[1].url) || ""
    ]
  };
}

function readForm() {
  return {
    documentary: docInput.value.trim(),
    episodes: [ep1Input.value.trim(), ep2Input.value.trim()]
  };
}

function fillForm(data) {
  docInput.value = data.documentary;
  ep1Input.value = data.episodes[0] || "";
  ep2Input.value = data.episodes[1] || "";
}

function showLive(data) {
  const rows = [
    ["#live-doc", data.documentary],
    ["#live-ep1", data.episodes[0]],
    ["#live-ep2", data.episodes[1]]
  ];
  rows.forEach(([selector, url]) => {
    const link = document.querySelector(selector);
    link.href = url || "#";
    link.textContent = url || "No link yet";
  });
}

function contentFile(data) {
  return "window.PORTFOLIO = " + JSON.stringify({
    documentary: data.documentary,
    episodes: [
      { label: "Episode one", url: data.episodes[0] },
      { label: "Episode two", url: data.episodes[1] }
    ]
  }, null, 2) + ";\n";
}

function resetSlot(el) {
  el.classList.remove("has-embed");
  el.replaceChildren();
  const label = document.createElement("p");
  label.className = "slot-label";
  label.textContent = el.dataset.title || "Empty";
  el.appendChild(label);
}

async function preview() {
  const data = readForm();
  const film = document.querySelector("#preview-film");
  const filmEmbed = youtubeEmbed(data.documentary);
  if (filmEmbed) placeEmbed(film, filmEmbed);
  else resetSlot(film);
  showPlainLink(document.querySelector("#preview-film-link"), data.documentary, "Watch on YouTube");

  const slots = ["#preview-ep1", "#preview-ep2"];
  for (let i = 0; i < slots.length; i += 1) {
    const slot = document.querySelector(slots[i]);
    const url = data.episodes[i];
    const player = url ? await soundcloudEmbed(url) : "";
    if (player) placeEmbed(slot, player);
    else resetSlot(slot);
    showPlainLink(document.querySelector(slots[i] + "-link"), url, "Listen on SoundCloud");
  }
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(readForm()));
  status.textContent = "Editable version saved in this browser. The live documentary and podcast pages are unchanged until you publish.";
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function openFileDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("handles");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storedHandle() {
  const db = await openFileDb();
  return new Promise((resolve) => {
    const request = db.transaction("handles").objectStore("handles").get("content");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

async function rememberHandle(handle) {
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("handles", "readwrite").objectStore("handles").put(handle, "content");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function writeHandle(handle, text) {
  const permission = await handle.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") throw new Error("permission");
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

function downloadFile(text) {
  const blob = new Blob([text], { type: "text/javascript" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "content.js";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function publish() {
  const data = readForm();
  const text = contentFile(data);
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  try {
    let handle = await storedHandle();
    if (handle) {
      const permission = await handle.queryPermission({ mode: "readwrite" });
      if (permission === "granted" || permission === "prompt") {
        await writeHandle(handle, text);
        window.PORTFOLIO = JSON.parse(text.replace(/^window\.PORTFOLIO = /, "").replace(/;\s*$/, ""));
        showLive(data);
        status.textContent = "Published. Refresh the documentary and podcast pages to see the live version.";
        return;
      }
    }
    if (!window.showSaveFilePicker) throw new Error("unsupported");
    handle = await window.showSaveFilePicker({
      suggestedName: "content.js",
      types: [{ description: "Live links", accept: { "text/javascript": [".js"] } }]
    });
    await rememberHandle(handle);
    await writeHandle(handle, text);
    window.PORTFOLIO = JSON.parse(text.replace(/^window\.PORTFOLIO = /, "").replace(/;\s*$/, ""));
    showLive(data);
    status.textContent = "Published. Choose the existing js/content.js file if the browser asks, so it replaces the live version. Then refresh the documentary and podcast pages.";
  } catch (error) {
    if (error && error.name === "AbortError") {
      status.textContent = "Publish cancelled. The editable version is still saved in this browser.";
      return;
    }
    downloadFile(text);
    status.textContent = "The browser downloaded content.js. Replace the file js/content.js in the portfolio folder with that download, then refresh the documentary and podcast pages.";
  }
}

const published = liveContent();
showLive(published);
const draft = loadDraft();
fillForm(draft || published);
if (draft) {
  status.textContent = "An editable version is saved in this browser. The live links above are still what the site shows.";
}

document.querySelector("#preview").addEventListener("click", () => {
  preview().catch(() => {
    status.textContent = "One of those links could not be opened. Check the address and try the preview again.";
  });
});
document.querySelector("#save-draft").addEventListener("click", saveDraft);
document.querySelector("#publish").addEventListener("click", () => {
  publish().catch(() => {
    status.textContent = "Publish did not finish. The editable version is still saved in this browser.";
  });
});
document.querySelector("#discard").addEventListener("click", () => {
  localStorage.removeItem(DRAFT_KEY);
  fillForm(liveContent());
  status.textContent = "Editable version discarded. The form matches the live site again.";
  preview();
});

preview();
