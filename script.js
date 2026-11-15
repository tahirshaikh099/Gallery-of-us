(() => {
  "use strict";

  /* ====================================
     YOUR MEMORIES

     Set src to a real video path:
     src: "videos/memory-01.mp4"

     Leave src empty to show a placeholder.
     poster is an optional preview image.
     ==================================== */

  const MEMORIES = [
    {
      title: "Where our story began",
      date: "Our first little chapter",
      caption:
        "I didn’t know it then, but this was the beginning " +
        "of my favourite story.",
      src: "",
      poster: ""
    },
    {
      title: "That smile. That day.",
      date: "A day I keep replaying",
      caption:
        "Somewhere between your laughter and this moment, " +
        "the world felt softer.",
      src: "",
      poster: ""
    },
    {
      title: "Our little adventure",
      date: "Just you and me",
      caption:
        "It was never really about the place. " +
        "It was about going there with you.",
      src: "",
      poster: ""
    },
    {
      title: "The ordinary magic",
      date: "One beautifully ordinary day",
      caption:
        "Nothing extraordinary happened. " +
        "You were there. That was everything.",
      src: "",
      poster: ""
    },
    {
      title: "My favourite view",
      date: "Another reason to love you",
      caption:
        "I could have looked anywhere. " +
        "I kept looking at you.",
      src: "",
      poster: ""
    },
    {
      title: "More of this. Forever.",
      date: "To all the days still waiting",
      caption:
        "This isn’t the end of our museum. " +
        "We’re still making the memories.",
      src: "",
      poster: ""
    }
  ];

  /* Room dimensions */
  const ROOM = {
    halfWidth: 520,
    spacing: 850,
    firstExhibitZ: -650,
    floorY: 250,
    ceilingY: -280
  };

  ROOM.length = 1200 + MEMORIES.length * ROOM.spacing;

  const $ = id => document.getElementById(id);

  const camera = $("camera");
  const cinemaVideo = $("cinema-video");

  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  const player = {
    x: 0,
    z: 150,
    yaw: 0
  };

  const keys = new Set();
  const touchControls = new Set();
  const exhibits = [];

  const movementKeys = new Set([
    "w", "a", "s", "d",
    "arrowup", "arrowdown",
    "arrowleft", "arrowright"
  ]);

  let entered = false;
  let soundEnabled = false;
  let activeIndex = -1;
  let journey = null;
  let previousTime = performance.now();
  let focusedBeforeCinema = null;
  let focusedBeforeUpload = null;

  /* ====================================
     BUILD THE THREE-DIMENSIONAL ROOM
     ==================================== */

  function makePlane(
    className,
    width,
    height,
    x,
    y,
    z,
    rotation = ""
  ) {
    const element = document.createElement("div");

    element.className = `plane ${className}`;

    Object.assign(element.style, {
      width: `${width}px`,
      height: `${height}px`,
      marginLeft: `${-width / 2}px`,
      marginTop: `${-height / 2}px`,
      transform:
        `translate3d(${x}px, ${y}px, ${z}px) ${rotation}`
    });

    camera.appendChild(element);

    return element;
  }

  function makeDecoration(...argumentsList) {
    const element = makePlane(...argumentsList);

    element.setAttribute("aria-hidden", "true");
    element.style.pointerEvents = "none";

    return element;
  }

  function buildRoom() {
    const width = ROOM.halfWidth * 2;
    const surfaceLength = ROOM.length + 1000;
    const surfaceCenter = -ROOM.length / 2 + 300;

    makeDecoration(
      "floor",
      width,
      surfaceLength,
      0,
      ROOM.floorY,
      surfaceCenter,
      "rotateX(90deg)"
    );

    makeDecoration(
      "ceiling",
      width,
      surfaceLength,
      0,
      ROOM.ceilingY,
      surfaceCenter,
      "rotateX(-90deg)"
    );

    const segmentLength = 1000;

    for (
      let z = 300;
      z > -ROOM.length;
      z -= segmentLength
    ) {
      makeDecoration(
        "wall",
        segmentLength + 2,
        530,
        -ROOM.halfWidth,
        -15,
        z - segmentLength / 2,
        "rotateY(90deg)"
      );

      makeDecoration(
        "wall",
        segmentLength + 2,
        530,
        ROOM.halfWidth,
        -15,
        z - segmentLength / 2,
        "rotateY(-90deg)"
      );
    }

    // Floor runner, slightly above the floor.
    makeDecoration(
      "runner",
      300,
      ROOM.length + 650,
      0,
      ROOM.floorY - 2,
      -ROOM.length / 2 + 150,
      "rotateX(90deg)"
    );

    // Repeated beams and wall columns.
    for (
      let z = 200;
      z > -ROOM.length;
      z -= ROOM.spacing
    ) {
      makeDecoration(
        "beam",
        width,
        35,
        0,
        -251,
        z
      );

      makeDecoration(
        "beam",
        width,
        60,
        0,
        -233,
        z - 30,
        "rotateX(-90deg)"
      );

      makeDecoration(
        "pilaster",
        42,
        495,
        -ROOM.halfWidth + 12,
        -3,
        z,
        "rotateY(90deg)"
      );

      makeDecoration(
        "pilaster",
        42,
        495,
        ROOM.halfWidth - 12,
        -3,
        z,
        "rotateY(-90deg)"
      );
    }

    const endWall = makePlane(
      "end-wall",
      width,
      530,
      0,
      -15,
      -ROOM.length
    );

    const ending = document.createElement("div");
    const title = document.createElement("h2");
    const caption = document.createElement("p");

    title.textContent = "And we’re only getting started.";
    caption.textContent = "More memories. More us. ♡";

    ending.append(title, caption);
    endWall.appendChild(ending);
  }

  /* ====================================
     CREATE THE VIDEO EXHIBITS
     ==================================== */

  function buildExhibits() {
    MEMORIES.forEach((memory, index) => {
      const left = index % 2 === 0;
      const z = ROOM.firstExhibitZ - index * ROOM.spacing;

      const element = makePlane(
        "exhibit",
        350,
        340,
        left ? -ROOM.halfWidth + 9 : ROOM.halfWidth - 9,
        -5,
        z,
        left ? "rotateY(90deg)" : "rotateY(-90deg)"
      );

      element.tabIndex = 0;
      element.setAttribute("role", "button");
      element.setAttribute(
        "aria-label",
        `Watch memory ${index + 1}: ${memory.title}`
      );

      const number = document.createElement("div");
      number.className = "exhibit-number";
      number.textContent =
        `MEMORY ${String(index + 1).padStart(2, "0")}`;

      const frame = document.createElement("div");
      frame.className = "frame";

      const inner = document.createElement("div");
      inner.className = "frame-inner";

      const video = document.createElement("video");
      video.loop = true;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.tabIndex = -1;
      video.setAttribute("aria-hidden", "true");

      if (memory.poster) {
        video.poster = memory.poster;
      }

      const placeholder = document.createElement("div");
      placeholder.className = "placeholder";

      const placeholderTitle = document.createElement("span");
      placeholderTitle.textContent = `Chapter ${index + 1}`;

      const placeholderNote = document.createElement("small");
      placeholderNote.textContent =
        "A little space for our memory. " +
        "Add a video to bring it to life.";

      placeholder.append(placeholderTitle, placeholderNote);
      inner.append(video, placeholder);
      frame.appendChild(inner);

      const plaque = document.createElement("div");
      plaque.className = "plaque";

      const title = document.createElement("h3");
      title.textContent = memory.title;

      const date = document.createElement("p");
      date.textContent = memory.date;

      plaque.append(title, date);
      element.append(number, frame, plaque);

      makeDecoration(
        "picture-light",
        150,
        9,
        left ? -ROOM.halfWidth + 15 : ROOM.halfWidth - 15,
        -224,
        z,
        left ? "rotateY(90deg)" : "rotateY(-90deg)"
      );

      const exhibit = {
        element,
        video,
        placeholder,
        placeholderNote,
        z,
        left,
        source: "",
        objectUrl: null,
        playPending: false,
        nextPlayAttempt: 0
      };

      exhibits.push(exhibit);

      video.addEventListener("loadeddata", () => {
        placeholder.hidden = true;
      });

      video.addEventListener("error", () => {
        placeholder.hidden = false;
        placeholderNote.textContent =
          "This video couldn’t load. " +
          "Check its filename or choose another file.";
      });

      element.addEventListener("click", () => {
        openCinema(index);
      });

      element.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openCinema(index);
        }
      });

      if (memory.src) {
        setVideoSource(index, memory.src);
      }
    });
  }

  function setVideoSource(index, source, objectUrl = null) {
    const item = exhibits[index];

    item.video.pause();

    if (item.objectUrl) {
      URL.revokeObjectURL(item.objectUrl);
    }

    item.source = source;
    item.objectUrl = objectUrl;
    item.nextPlayAttempt = 0;

    item.placeholder.hidden = false;
    item.placeholderNote.textContent = "Loading our little memory…";

    item.video.src = source;
    item.video.load();
  }

  /* ====================================
     EXHIBIT INFORMATION AND PLAYBACK
     ==================================== */

  function isOverlayOpen() {
    return (
      !$("welcome").hidden ||
      !$("upload-overlay").hidden ||
      !$("cinema").hidden
    );
  }

  function pauseWallVideos() {
    exhibits.forEach(item => item.video.pause());
  }

  function setActiveMemory(index) {
    if (index === activeIndex || index < 0) return;

    activeIndex = index;

    exhibits.forEach((item, itemIndex) => {
      item.element.classList.toggle(
        "active",
        itemIndex === index
      );
    });

    const memory = MEMORIES[index];

    $("info-label").textContent =
      `Memory ${String(index + 1).padStart(2, "0")} · ${memory.date}`;

    $("info-title").textContent = memory.title;
    $("info-caption").textContent = memory.caption;
    $("progress").textContent =
      `${index + 1} / ${MEMORIES.length}`;
  }

  function updateNearbyPlayback() {
    if (!entered || isOverlayOpen() || document.hidden) {
      pauseWallVideos();
      return;
    }

    let nearestIndex = -1;
    let nearestDistance = Infinity;

    exhibits.forEach((item, index) => {
      const distance = Math.abs(player.z - item.z);

      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });

    if (nearestDistance < 750) {
      setActiveMemory(nearestIndex);
    }

    const now = performance.now();

    exhibits.forEach((item, index) => {
      const shouldPlay =
        index === nearestIndex &&
        nearestDistance < 750 &&
        Boolean(item.source);

      item.video.muted = !soundEnabled || !shouldPlay;

      if (!shouldPlay) {
        if (!item.video.paused) item.video.pause();
        return;
      }

      if (
        item.video.paused &&
        !item.playPending &&
        now >= item.nextPlayAttempt
      ) {
        item.playPending = true;
        item.nextPlayAttempt = now + 3000;

        item.video.play()
          .catch(() => {
            // The viewer can still start playback in cinema view.
          })
          .finally(() => {
            item.playPending = false;
          });
      }
    });
  }

  /* ====================================
     CAMERA AND GUIDED MOVEMENT
     ==================================== */

  function normalizeAngle(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  function renderCamera() {
    camera.style.transform =
      `rotateY(${player.yaw}rad) ` +
      `translate3d(${-player.x}px, 0px, ${-player.z}px)`;
  }

  function goToMemory(index) {
    if (!entered || isOverlayOpen()) return;

    index = Math.max(0, Math.min(MEMORIES.length - 1, index));

    const item = exhibits[index];
    const targetYaw = item.left ? -Math.PI / 2 : Math.PI / 2;

    clearMovement();

    journey = {
      start: performance.now(),
      duration: motionPreference.matches ? 0 : 2000,
      fromX: player.x,
      fromZ: player.z,
      fromYaw: player.yaw,
      toX: 0,
      toZ: item.z,
      yawDifference: normalizeAngle(targetYaw - player.yaw)
    };

    setActiveMemory(index);
  }

  function clearMovement() {
    keys.clear();
    touchControls.clear();
  }

  function updateManualMovement(delta) {
    let forward = 0;
    let sideways = 0;
    let turn = 0;

    if (
      keys.has("w") ||
      keys.has("arrowup") ||
      touchControls.has("forward")
    ) {
      forward++;
    }

    if (
      keys.has("s") ||
      keys.has("arrowdown") ||
      touchControls.has("back")
    ) {
      forward--;
    }

    if (keys.has("a")) sideways--;
    if (keys.has("d")) sideways++;

    if (keys.has("arrowleft") || touchControls.has("left")) {
      turn--;
    }

    if (keys.has("arrowright") || touchControls.has("right")) {
      turn++;
    }

    player.yaw += turn * 1.35 * delta;

    const directionLength = Math.hypot(forward, sideways) || 1;
    const speed = 290 * delta;

    forward /= directionLength;
    sideways /= directionLength;

    player.x += (
      Math.sin(player.yaw) * forward +
      Math.cos(player.yaw) * sideways
    ) * speed;

    player.z += (
      -Math.cos(player.yaw) * forward +
      Math.sin(player.yaw) * sideways
    ) * speed;

    player.x = Math.max(-350, Math.min(350, player.x));

    player.z = Math.max(
      -ROOM.length + 300,
      Math.min(250, player.z)
    );
  }

  function animate(timestamp) {
    const delta = Math.min((timestamp - previousTime) / 1000, .04);
    previousTime = timestamp;

    if (entered && !isOverlayOpen()) {
      if (journey) {
        const progress = journey.duration === 0
          ? 1
          : Math.min(
              (timestamp - journey.start) / journey.duration,
              1
            );

        const eased = progress * progress * (3 - 2 * progress);

        player.x =
          journey.fromX + (journey.toX - journey.fromX) * eased;

        player.z =
          journey.fromZ + (journey.toZ - journey.fromZ) * eased;

        player.yaw =
          journey.fromYaw + journey.yawDifference * eased;

        if (progress === 1) journey = null;
      } else {
        updateManualMovement(delta);
      }
    }

    renderCamera();
    requestAnimationFrame(animate);
  }

  /* ====================================
     CINEMA VIEW
     ==================================== */

  function openCinema(index) {
    const item = exhibits[index];

    if (!item.source) {
      openUpload();

      $("file-status").textContent =
        "Choose your videos, then return to this frame.";

      return;
    }

    clearMovement();
    journey = null;
    focusedBeforeCinema = document.activeElement;

    pauseWallVideos();

    $("cinema-title").textContent = MEMORIES[index].title;
    $("cinema-date").textContent = MEMORIES[index].date;
    $("cinema-caption").textContent = MEMORIES[index].caption;

    cinemaVideo.pause();
    cinemaVideo.src = item.source;
    cinemaVideo.muted = !soundEnabled;
    cinemaVideo.volume = .7;

    const resumeTime = Number.isFinite(item.video.currentTime)
      ? item.video.currentTime
      : 0;

    cinemaVideo.onloadedmetadata = () => {
      if (Number.isFinite(cinemaVideo.duration)) {
        cinemaVideo.currentTime = Math.min(
          resumeTime,
          Math.max(0, cinemaVideo.duration - .1)
        );
      }
    };

    $("cinema").hidden = false;
    cinemaVideo.load();

    cinemaVideo.play().catch(() => {
      // Native video controls remain available.
    });

    $("close-cinema").focus();
  }

  function closeCinema() {
    cinemaVideo.pause();
    cinemaVideo.onloadedmetadata = null;
    $("cinema").hidden = true;

    if (
      focusedBeforeCinema &&
      document.contains(focusedBeforeCinema)
    ) {
      focusedBeforeCinema.focus();
    }
  }

  /* ====================================
     LOCAL VIDEO SELECTION
     ==================================== */

  function openUpload() {
    focusedBeforeUpload = document.activeElement;
    clearMovement();
    pauseWallVideos();

    $("upload-overlay").hidden = false;
    $("file-input").focus();
  }

  function closeUpload() {
    $("upload-overlay").hidden = true;

    if (
      focusedBeforeUpload &&
      document.contains(focusedBeforeUpload)
    ) {
      focusedBeforeUpload.focus();
    }
  }

  $("file-input").addEventListener("change", event => {
    const files = Array.from(event.target.files)
      .filter(file =>
        file.type.startsWith("video/") ||
        /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name)
      )
      .sort((a, b) =>
        a.name.localeCompare(
          b.name,
          undefined,
          { numeric: true }
        )
      )
      .slice(0, MEMORIES.length);

    if (!files.length) {
      $("file-status").textContent =
        "Please select at least one video file.";

      return;
    }

    files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      setVideoSource(index, url, url);
    });

    $("file-status").textContent =
      `${files.length} ${
        files.length === 1 ? "memory is" : "memories are"
      } ready. Return to the museum to explore.`;
  });

  /* ====================================
     BUTTONS AND AUDIO
     ==================================== */

  $("enter-button").addEventListener("click", () => {
    entered = true;
    $("welcome").hidden = true;

    $("next-button").focus();
    goToMemory(0);
  });

  $("upload-button").addEventListener("click", openUpload);
  $("welcome-upload").addEventListener("click", openUpload);
  $("close-upload").addEventListener("click", closeUpload);
  $("close-cinema").addEventListener("click", closeCinema);

  $("next-button").addEventListener("click", () => {
    goToMemory(activeIndex < 0 ? 0 : activeIndex + 1);
  });

  $("previous-button").addEventListener("click", () => {
    goToMemory(activeIndex < 0 ? 0 : activeIndex - 1);
  });

  $("watch-button").addEventListener("click", () => {
    openCinema(activeIndex < 0 ? 0 : activeIndex);
  });

  $("sound-button").addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    $("sound-button").textContent =
      soundEnabled ? "Sound on" : "Sound off";

    $("sound-button").setAttribute(
      "aria-pressed",
      String(soundEnabled)
    );

    cinemaVideo.muted = !soundEnabled;

    if (
      activeIndex >= 0 &&
      entered &&
      !isOverlayOpen()
    ) {
      const item = exhibits[activeIndex];

      item.video.muted = !soundEnabled;

      if (item.source) {
        item.nextPlayAttempt = 0;
        item.video.play().catch(() => {});
      }
    }
  });

  /* ====================================
     KEYBOARD AND TOUCH CONTROLS
     ==================================== */

  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if (key === "escape") {
      if (!$("cinema").hidden) {
        closeCinema();
      } else if (!$("upload-overlay").hidden) {
        closeUpload();
      }

      return;
    }

    if (!entered || isOverlayOpen()) return;

    if (movementKeys.has(key)) {
      event.preventDefault();
      journey = null;
      keys.add(key);
    }
  });

  window.addEventListener("keyup", event => {
    keys.delete(event.key.toLowerCase());
  });

  window.addEventListener("blur", clearMovement);

  document.addEventListener("visibilitychange", () => {
    clearMovement();

    if (document.hidden) {
      pauseWallVideos();
      cinemaVideo.pause();
    }
  });

  document.querySelectorAll("[data-control]").forEach(button => {
    const control = button.dataset.control;

    button.addEventListener("pointerdown", event => {
      if (!entered || isOverlayOpen()) return;

      event.preventDefault();
      journey = null;
      touchControls.add(control);
      button.setPointerCapture(event.pointerId);
    });

    const release = () => {
      touchControls.delete(control);
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  /* Keep keyboard focus within the visible overlay. */
  document.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;

    let overlay = null;

    if (!$("cinema").hidden) {
      overlay = $("cinema");
    } else if (!$("upload-overlay").hidden) {
      overlay = $("upload-overlay");
    } else if (!$("welcome").hidden) {
      overlay = $("welcome");
    }

    if (!overlay) return;

    const focusable = Array.from(
      overlay.querySelectorAll(
        'button, input, video[controls], [tabindex="0"]'
      )
    ).filter(element => !element.disabled);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (!overlay.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("beforeunload", () => {
    exhibits.forEach(item => {
      if (item.objectUrl) {
        URL.revokeObjectURL(item.objectUrl);
      }
    });
  });

  /* Start */
  buildRoom();
  buildExhibits();

  $("progress").textContent = `0 / ${MEMORIES.length}`;

  renderCamera();
  $("enter-button").focus();

  setInterval(updateNearbyPlayback, 400);
  requestAnimationFrame(animate);
})();
