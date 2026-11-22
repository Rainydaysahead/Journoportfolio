function paintImages() {
  document.querySelectorAll("[data-image]").forEach((el) => {
    const src = el.dataset.image;
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url("${src}")`;
      el.classList.add("has-image");
    };
    img.src = src;
  });
}

function mountEmbeds() {
  document.querySelectorAll("[data-embed]").forEach((el) => {
    placeEmbed(el, el.dataset.embed);
  });
}

function placeEmbed(el, url) {
  const embed = (url || "").trim();
  if (!embed) return;
  const frame = document.createElement("iframe");
  frame.src = embed;
  frame.title = el.dataset.title || "Embedded media";
  frame.loading = "lazy";
  frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
  frame.setAttribute("allowfullscreen", "");
  el.replaceChildren(frame);
  el.classList.add("has-embed");
}

function youtubeEmbed(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = parsed.pathname.slice(1);
    else if (parsed.pathname.startsWith("/embed/")) id = parsed.pathname.split("/")[2];
    else if (parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.split("/")[2];
    else id = parsed.searchParams.get("v") || "";
    id = id.split(/[?&/]/)[0];
    return id ? "https://www.youtube.com/embed/" + id : "";
  } catch (error) {
    return "";
  }
}

async function soundcloudEmbed(url) {
  const endpoint = "https://soundcloud.com/oembed?format=json&url=" + encodeURIComponent(url);
  const response = await fetch(endpoint);
  if (!response.ok) return "";
  const data = await response.json();
  const match = String(data.html || "").match(/src="([^"]+)"/);
  if (!match) return "";
  const player = new URL(match[1].replace(/&amp;/g, "&"));
  player.searchParams.set("visual", "true");
  player.searchParams.set("color", "c4271b");
  player.searchParams.set("hide_related", "true");
  player.searchParams.set("show_comments", "false");
  player.searchParams.set("show_user", "true");
  player.searchParams.set("show_reposts", "false");
  player.searchParams.set("show_teaser", "false");
  return player.toString();
}

function showPlainLink(el, url, label) {
  if (!el) return;
  el.replaceChildren();
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  el.appendChild(link);
}

async function mountPortfolio() {
  const live = window.PORTFOLIO;
  if (!live) return;
  const film = document.querySelector("#film");
  if (film && live.documentary) {
    placeEmbed(film, youtubeEmbed(live.documentary));
    showPlainLink(document.querySelector("#film-link"), live.documentary, "Watch on YouTube");
  }
  const episodes = document.querySelectorAll("[data-episode]");
  for (const slot of episodes) {
    const item = (live.episodes || [])[Number(slot.dataset.episode)];
    if (!item || !item.url) continue;
    const player = await soundcloudEmbed(item.url);
    placeEmbed(slot, player);
    const link = slot.nextElementSibling;
    if (link && link.classList.contains("media-link")) {
      showPlainLink(link, item.url, "Listen on SoundCloud");
    }
  }
}

function prepareSubstackLink() {
  const link = document.querySelector("[data-substack]");
  if (!link) return;
  const href = (link.getAttribute("href") || "").trim();
  if (!/^https?:\/\//i.test(href)) {
    link.removeAttribute("href");
    link.classList.add("is-empty");
  }
}

function mountCardVideos() {
  document.querySelectorAll("[data-video]").forEach((card) => {
    const raw = (card.dataset.video || "").trim();
    if (!raw) return;
    const sources = /\.(mp4|webm|mov)$/i.test(raw)
      ? [raw]
      : [raw + ".mp4", raw + ".webm", raw + ".mov"];

    const video = document.createElement("video");
    video.className = "card-video";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.preload = "metadata";

    const trySource = (index) => {
      if (index >= sources.length) return;
      video.addEventListener("loadeddata", () => {
        if (!video.isConnected) card.prepend(video);
        card.classList.add("has-video");
      }, { once: true });
      video.addEventListener("error", () => trySource(index + 1), { once: true });
      video.src = sources[index];
    };
    trySource(0);

    const play = () => {
      const clip = card.querySelector(".card-video");
      if (!clip) return;
      clip.currentTime = 0;
      clip.play().catch(() => {});
    };
    const stop = () => {
      const clip = card.querySelector(".card-video");
      if (!clip) return;
      clip.pause();
    };
    card.addEventListener("mouseenter", play);
    card.addEventListener("mouseleave", stop);
    card.addEventListener("focus", play);
    card.addEventListener("blur", stop);
  });
}

function mountPhotoShutter() {
  const card = document.querySelector("[data-frames]");
  if (!card) return;
  const frames = card.dataset.frames.split(",").map((src) => src.trim()).filter(Boolean);
  if (!frames.length) return;
  frames.forEach((src) => {
    const preload = new Image();
    preload.src = src;
  });

  const shutter = document.createElement("div");
  shutter.className = "shutter";
  shutter.setAttribute("aria-hidden", "true");
  shutter.innerHTML = "<span></span><span></span>";
  card.appendChild(shutter);

  const still = card.dataset.image;
  let index = -1;
  let timer = null;
  let closeTimer = null;
  const beat = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1600 : 1200;

  const advance = () => {
    card.classList.add("is-shut");
    closeTimer = window.setTimeout(() => {
      index = (index + 1) % frames.length;
      card.style.backgroundImage = `url("${frames[index]}")`;
      card.classList.add("has-image");
      card.classList.remove("is-shut");
    }, 55);
  };

  const start = () => {
    if (timer) return;
    advance();
    timer = window.setInterval(advance, beat);
  };

  const stop = () => {
    window.clearInterval(timer);
    window.clearTimeout(closeTimer);
    timer = null;
    card.classList.remove("is-shut");
    if (still) card.style.backgroundImage = `url("${still}")`;
  };

  card.addEventListener("mouseenter", start);
  card.addEventListener("mouseleave", stop);
  card.addEventListener("focus", start);
  card.addEventListener("blur", stop);
}

function mountMagazine() {
  const book = document.querySelector("[data-magazine]");
  if (!book) return;
  const count = Number(book.dataset.magazine);
  const base = book.dataset.base;
  const pages = Array.from({ length: count }, (_, i) => `${base}${String(i + 1).padStart(2, "0")}.png`);
  const under = book.querySelector(".leaf-under");
  const leaf = book.querySelector(".leaf");
  const front = book.querySelector(".leaf-front");
  const back = book.querySelector(".leaf-back");
  const folio = document.querySelector("[data-folio]");
  const prev = document.querySelector("[data-page='prev']");
  const next = document.querySelector("[data-page='next']");
  let index = 0;
  let turning = false;

  const paint = () => {
    front.src = pages[index];
    front.alt = `Photo story, page ${index + 1} of ${pages.length}`;
    under.src = pages[index];
    under.alt = "";
    if (folio) folio.textContent = `${index + 1} / ${pages.length}`;
    prev.disabled = index === 0;
    next.disabled = index === pages.length - 1;
  };

  const finish = (target) => {
    leaf.classList.remove("is-animated");
    leaf.style.transform = "";
    index = target;
    paint();
    turning = false;
  };

  const turn = (direction) => {
    const target = index + direction;
    if (turning || target < 0 || target >= pages.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      index = target;
      paint();
      return;
    }
    turning = true;
    if (direction > 0) {
      back.src = pages[target];
      back.alt = "";
      under.src = pages[target];
      leaf.classList.add("is-animated");
      requestAnimationFrame(() => {
        leaf.style.transform = "rotateY(-180deg)";
      });
      leaf.addEventListener("transitionend", () => finish(target), { once: true });
      return;
    }
    back.src = pages[index];
    front.src = pages[target];
    front.alt = `Photo story, page ${target + 1} of ${pages.length}`;
    under.src = pages[index];
    leaf.style.transform = "rotateY(-180deg)";
    requestAnimationFrame(() => {
      leaf.classList.add("is-animated");
      requestAnimationFrame(() => {
        leaf.style.transform = "rotateY(0deg)";
      });
    });
    leaf.addEventListener("transitionend", () => finish(target), { once: true });
  };

  prev.addEventListener("click", () => turn(-1));
  next.addEventListener("click", () => turn(1));
  book.addEventListener("click", (event) => {
    const rect = book.getBoundingClientRect();
    turn(event.clientX > rect.left + rect.width / 2 ? 1 : -1);
  });
  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea")) return;
    if (event.key === "ArrowRight") turn(1);
    if (event.key === "ArrowLeft") turn(-1);
  });
  pages.forEach((src) => {
    const preload = new Image();
    preload.src = src;
  });
  paint();
}

paintImages();
mountEmbeds();
prepareSubstackLink();
mountCardVideos();
mountPhotoShutter();
mountMagazine();
mountPortfolio();
