// ============================
// Helpers
// ============================
const $ = (id) => document.getElementById(id);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const isFiniteNumber = (n) => typeof n === "number" && Number.isFinite(n);

// ============================
// Physics
// ============================
function positionAt(params, t) {
  if (params.type === "mru") return params.x0 + params.v0 * t;
  return params.x0 + params.v0 * t + 0.5 * params.a * t * t;
}

function velocityAt(params, t) {
  if (params.type === "mru") return params.v0;
  return params.v0 + params.a * t;
}

function computeWorld(params, tMax, viewW, paddingPx = 140) {
  const candidates = [0, tMax];

  if (params.type === "mrv" && params.a !== 0) {
    const tv = -params.v0 / params.a; // vértice
    if (tv > 0 && tv < tMax) candidates.push(tv);
  }

  let xMin = Infinity;
  let xMax = -Infinity;

  for (const tt of candidates) {
    const x = positionAt(params, tt);
    xMin = Math.min(xMin, x);
    xMax = Math.max(xMax, x);
  }

  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin === xMax) {
    xMin = params.x0 - 1;
    xMax = params.x0 + 1;
  }

  const span = Math.max(0.0001, xMax - xMin);

  const targetTrackW = 2200;
  let scale = targetTrackW / span; // px por metro
  scale = clamp(scale, 4, 40);

  const trackWidth = Math.max(viewW + 300, Math.round(span * scale + 2 * paddingPx));
  return { xMin, xMax, span, scalePxPerM: scale, trackWidth, paddingPx };
}

function worldToPx(world, xWorld) {
  return world.paddingPx + (xWorld - world.xMin) * world.scalePxPerM;
}

// ============================
// Track
// ============================
function chooseNiceStepMeters(pxPerM, targetPx = 78) {
  const candidates = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  for (const stepM of candidates) {
    if (stepM * pxPerM >= targetPx) return stepM;
  }
  return 5000;
}

function buildTrack(pistaEl, world) {
  pistaEl.innerHTML = "";
  pistaEl.style.width = `${world.trackWidth}px`;

  const stepM = chooseNiceStepMeters(world.scalePxPerM, 80);
  const start = Math.floor(world.xMin / stepM) * stepM;
  const end = Math.ceil(world.xMax / stepM) * stepM;

  for (let x = start; x <= end + 1e-9; x += stepM) {
    const left = world.paddingPx + (x - world.xMin) * world.scalePxPerM;

    const mark = document.createElement("div");
    mark.className = "marca";
    mark.style.left = `${Math.round(left)}px`;

    const pill = document.createElement("span");
    const label = Math.abs(stepM) < 1 ? x.toFixed(1) : x.toFixed(0);
    pill.textContent = `${label} m`;

    mark.appendChild(pill);
    pistaEl.appendChild(mark);
  }
}

// ============================
// Alerts UI
// ============================
function clearAlerts(container) {
  container.innerHTML = "";
}

function pushAlert(container, msg, kind = "info") {
  const div = document.createElement("div");
  div.className = `alerta ${kind}`;
  div.textContent = msg;
  container.appendChild(div);
}

// ============================
// Tour
// ============================
class Tour {
  constructor(opts) {
    this.steps = opts.steps;
    this.overlay = opts.overlay;
    this.highlight = opts.highlight;
    this.tooltip = opts.tooltip;
    this.onFinish = opts.onFinish;
    this.index = 0;
    this._handleResize = () => this.position();
  }

  start() {
    this.index = 0;
    this.show();
    window.addEventListener("resize", this._handleResize);
    window.addEventListener("scroll", this._handleResize, true);
  }

  stop() {
    this.hideAll();
    window.removeEventListener("resize", this._handleResize);
    window.removeEventListener("scroll", this._handleResize, true);
    this.onFinish?.();
  }

  next() {
    if (this.index < this.steps.length - 1) {
      this.index++;
      this.show();
    } else {
      this.stop();
    }
  }

  prev() {
    if (this.index > 0) {
      this.index--;
      this.show();
    }
  }

  hideAll() {
    this.overlay.classList.add("hidden");
    this.highlight.classList.add("hidden");
    this.tooltip.classList.add("hidden");
    this.tooltip.innerHTML = "";
  }

  show() {
    const step = this.steps[this.index];
    this.overlay.classList.remove("hidden");
    this.tooltip.classList.remove("hidden");

    if (!step.target) {
      this.highlight.classList.add("hidden");
      this.renderCentered(step);
      return;
    }

    const targetEl = document.querySelector(step.target);
    if (!targetEl) { this.next(); return; }

    targetEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    this.highlight.classList.remove("hidden");
    this.renderAnchored(step, targetEl);
    setTimeout(() => this.position(), 240);
  }

  renderCentered(step) {
    const isFirst = this.index === 0;
    const isLast = this.index === this.steps.length - 1;

    this.tooltip.innerHTML = `
      <div class="tt-title">${step.title ?? "Bienvenido"}</div>
      <div class="tt-text">${step.text ?? ""}</div>
      <div class="tt-actions">
        <button class="link" data-action="skip">Omitir</button>
        <div class="left">
          ${!isFirst ? `<button class="btnSmall ghost" data-action="prev">Atrás</button>` : ``}
          <button class="btnSmall primary" data-action="next">${isLast ? "Finalizar" : (step.primaryLabel ?? "Comenzar recorrido")}</button>
        </div>
      </div>
    `;
    this.bindActions();

    const W = window.innerWidth;
    const H = window.innerHeight;
    const rect = this.tooltip.getBoundingClientRect();
    this.tooltip.style.left = `${Math.max(16, (W - rect.width) / 2)}px`;
    this.tooltip.style.top = `${Math.max(16, (H - rect.height) / 2)}px`;
  }

  renderAnchored(step, targetEl) {
    const isFirst = this.index === 0;
    const isLast = this.index === this.steps.length - 1;

    this.tooltip.innerHTML = `
      <div class="tt-title">${step.title}</div>
      <div class="tt-text">${step.text}</div>
      <div class="tt-actions">
        <button class="link" data-action="skip">Omitir</button>
        <div class="left">
          ${!isFirst ? `<button class="btnSmall ghost" data-action="prev">Atrás</button>` : ``}
          <button class="btnSmall primary" data-action="next">${isLast ? "Finalizar" : "Siguiente"}</button>
        </div>
      </div>
    `;
    this.bindActions();
    this.position(step, targetEl);
  }

  bindActions() {
    this.tooltip.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = btn.getAttribute("data-action");
        if (action === "next") this.next();
        if (action === "prev") this.prev();
        if (action === "skip") this.stop();
      });
    });
  }

  position(step = this.steps[this.index], targetEl = document.querySelector(step.target)) {
    if (!step?.target || !targetEl) return;

    const r = targetEl.getBoundingClientRect();
    const pad = 10;

    this.highlight.style.left = `${Math.max(8, r.left - pad)}px`;
    this.highlight.style.top = `${Math.max(8, r.top - pad)}px`;
    this.highlight.style.width = `${Math.max(20, r.width + pad * 2)}px`;
    this.highlight.style.height = `${Math.max(20, r.height + pad * 2)}px`;

    const placement = step.placement ?? "right";
    const tipRect = this.tooltip.getBoundingClientRect();
    const gap = 14;

    let left = 0, top = 0;
    if (placement === "right") {
      left = r.right + gap;
      top = r.top + (r.height - tipRect.height) / 2;
    } else if (placement === "left") {
      left = r.left - tipRect.width - gap;
      top = r.top + (r.height - tipRect.height) / 2;
    } else if (placement === "top") {
      left = r.left + (r.width - tipRect.width) / 2;
      top = r.top - tipRect.height - gap;
    } else {
      left = r.left + (r.width - tipRect.width) / 2;
      top = r.bottom + gap;
    }

    left = Math.min(window.innerWidth - tipRect.width - 16, Math.max(16, left));
    top = Math.min(window.innerHeight - tipRect.height - 16, Math.max(16, top));

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }
}

// ============================
// Chart
// ============================
class Chart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.series = { t: [], x: [], v: [] };
  }

  reset() {
    this.series = { t: [], x: [], v: [] };
    this.draw(10);
  }

  addPoint(t, x, v) {
    this.series.t.push(t);
    this.series.x.push(x);
    this.series.v.push(v);
  }

  resizeToDisplaySize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(300, Math.round(rect.width));
    const h = Math.max(220, Math.round(rect.height));
    const need = this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr);
    if (need) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  draw(tMax) {
    this.resizeToDisplaySize();

    const { ctx } = this;
    const W = this.canvas.getBoundingClientRect().width;
    const H = this.canvas.getBoundingClientRect().height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const padL = 52, padR = 12, padT = 12, padB = 28;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const t0 = 0;
    const t1 = Math.max(0.0001, tMax);

    const all = [...this.series.x, ...this.series.v];
    let yMin = 0, yMax = 1;
    if (all.length) {
      yMin = Math.min(...all);
      yMax = Math.max(...all);
      if (yMin === yMax) { yMin -= 1; yMax += 1; }
      const pad = (yMax - yMin) * 0.12;
      yMin -= pad;
      yMax += pad;
    }

    const xToPx = (t) => padL + ((t - t0) / (t1 - t0)) * plotW;
    const yToPx = (y) => padT + (1 - (y - yMin) / (yMax - yMin)) * plotH;

    // grilla
    ctx.strokeStyle = "rgba(2,6,23,.08)";
    ctx.lineWidth = 1;
    const gridN = 6;
    for (let i = 0; i <= gridN; i++) {
      const gx = padL + (plotW * i) / gridN;
      ctx.beginPath();
      ctx.moveTo(gx, padT);
      ctx.lineTo(gx, padT + plotH);
      ctx.stroke();
    }
    for (let i = 0; i <= gridN; i++) {
      const gy = padT + (plotH * i) / gridN;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(padL + plotW, gy);
      ctx.stroke();
    }

    // ejes
    ctx.strokeStyle = "rgba(2,6,23,.25)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // labels
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px Arial";
    ctx.fillText("t (s)", padL + plotW - 28, padT + plotH + 22);
    ctx.fillText("valor", 10, padT + 12);

    // ticks
    ctx.fillStyle = "rgba(2,6,23,.75)";
    for (let i = 0; i <= 4; i++) {
      const yy = yMin + ((yMax - yMin) * i) / 4;
      const py = yToPx(yy);
      ctx.fillText(yy.toFixed(1), 8, py + 4);
    }
    for (let i = 0; i <= 5; i++) {
      const tt = t0 + ((t1 - t0) * i) / 5;
      const px = xToPx(tt);
      ctx.fillText(tt.toFixed(1), px - 10, padT + plotH + 18);
    }

    // colores desde CSS
    const root = getComputedStyle(document.documentElement);
    const xColor = (root.getPropertyValue("--xLine") || "#6FA12E").trim();
    const vColor = (root.getPropertyValue("--vLine") || "#C77A2A").trim();

    this.#drawLine(this.series.t, this.series.x, xToPx, yToPx, xColor, 2.2);
    this.#drawLine(this.series.t, this.series.v, xToPx, yToPx, vColor, 2.2);
  }

  #drawLine(tArr, yArr, xToPx, yToPx, color, width) {
    if (tArr.length < 2) return;
    const { ctx } = this;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();

    for (let i = 0; i < tArr.length; i++) {
      const x = xToPx(tArr[i]);
      const y = yToPx(yArr[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ============================
// Simulation Engine
// ============================
const STATE = { IDLE:"IDLE", RUNNING:"RUNNING", PAUSED:"PAUSED", FINISHED:"FINISHED" };

class SimulationEngine {
  constructor(opts) {
    this.dom = opts.dom;
    this.chart = opts.chart;

    this.onWorldNotice = opts.onWorldNotice;
    this.onStateChange = opts.onStateChange;
    this.onStats = opts.onStats; //  nuevo

    this.viewW = opts.viewW ?? 860;
    this.cameraMargin = opts.cameraMargin ?? 320;

    this.dtSim = opts.dtSim ?? 0.05;
    this.maxStepsPerFrame = opts.maxStepsPerFrame ?? 12;

    this.state = STATE.IDLE;
    this.params = { type: "mru", x0: 0, v0: 0, a: 0 };
    this.t = 0;
    this.tMax = 10;
    this.world = null;

    this.timeScale = 1; // speed-up
    this.rafId = null;
    this.lastTs = 0;
    this.acc = 0;
  }

  setState(newState) {
    this.state = newState;
    this.onStateChange?.(newState);
  }

  stopLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.lastTs = 0;
  }

  resetScene() {
    this.stopLoop();
    this.t = 0;
    this.acc = 0;
    this.timeScale = 1;
    this.setState(STATE.IDLE);

    this.dom.objeto.style.left = "0px";
    this.dom.car.style.left = "0px";
    this.dom.pista.style.left = "0px";
    this.dom.pista.innerHTML = "";

    this.chart.reset();
    this.onStats?.({ t: null, x: null, v: null, a: null, type: this.params.type, speed: 1 });
  }

  startNew(params, tMax) {
    this.stopLoop();

    this.params = params;
    this.tMax = tMax;
    this.t = 0;
    this.acc = 0;

    // Speed-up si pasa de 60s (para que no demore más de 1 minuto real)
    const TARGET_REAL_SECONDS = 60;
    if (tMax > 60) {
      const raw = tMax / TARGET_REAL_SECONDS;
      this.timeScale = clamp(raw, 1, 8); // máximo 8x para que no sea “teleport”
    } else {
      this.timeScale = 1;
    }

    this.world = computeWorld(this.params, this.tMax, this.viewW, 160);

    if (this.world.scalePxPerM <= 5) {
      this.onWorldNotice?.("Aviso: el recorrido es grande; se ajustó la escala para que sea visible.");
    }

    buildTrack(this.dom.pista, this.world);

    const x0 = positionAt(this.params, 0);
    const v0 = velocityAt(this.params, 0);
    this.updateScene(x0);

    this.chart.reset();
    this.chart.addPoint(0, x0, v0);
    this.chart.draw(this.tMax);

    this.onStats?.({
      t: 0, x: x0, v: v0, a: this.params.type === "mrv" ? this.params.a : null,
      type: this.params.type, speed: this.timeScale
    });

    this.setState(STATE.RUNNING);
    this.rafId = requestAnimationFrame((ts) => this.loop(ts));
  }

  resume() {
    if (this.state !== STATE.PAUSED) return;
    this.setState(STATE.RUNNING);
    this.rafId = requestAnimationFrame((ts) => this.loop(ts));
  }

  pause() {
    if (this.state !== STATE.RUNNING) return;
    this.setState(STATE.PAUSED);
    this.stopLoop();
  }

  loop(ts) {
    if (this.state !== STATE.RUNNING) return;

    if (!this.lastTs) this.lastTs = ts;

    let dtReal = (ts - this.lastTs) / 1000;
    this.lastTs = ts;

    dtReal = Math.min(dtReal, 0.12); // evita saltos grandes

    this.acc += dtReal * this.timeScale;

    let steps = 0;
    while (this.acc >= this.dtSim && steps < this.maxStepsPerFrame && this.state === STATE.RUNNING) {
      const nextT = this.t + this.dtSim;
      this.t = nextT > this.tMax ? this.tMax : +nextT.toFixed(10);

      const x = positionAt(this.params, this.t);
      const v = velocityAt(this.params, this.t);

      this.chart.addPoint(this.t, x, v);
      this.acc -= this.dtSim;
      steps++;

      if (this.t >= this.tMax - 1e-9) {
        this.setState(STATE.FINISHED);
        this.stopLoop();
        this.updateScene(x);
        this.chart.draw(this.tMax);

        this.onStats?.({
          t: this.t, x, v, a: this.params.type === "mrv" ? this.params.a : null,
          type: this.params.type, speed: this.timeScale
        });
        return;
      }
    }

    const xNow = positionAt(this.params, this.t);
    const vNow = velocityAt(this.params, this.t);

    this.updateScene(xNow);
    this.chart.draw(this.tMax);

    this.onStats?.({
      t: this.t, x: xNow, v: vNow, a: this.params.type === "mrv" ? this.params.a : null,
      type: this.params.type, speed: this.timeScale
    });

    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  getActiveElement() {
    return (this.dom.objetoTipo.value === "carro") ? this.dom.car : this.dom.objeto;
  }

  updateScene(xWorld) {
    if (!this.world) return;

    const el = this.getActiveElement();
    const xPx = worldToPx(this.world, xWorld);

    const minLeft = -(this.world.trackWidth - this.viewW);
    let pistaLeft = 0;
    let objLeft = xPx;

    if (xPx > this.cameraMargin) {
      pistaLeft = -(xPx - this.cameraMargin);
      pistaLeft = clamp(pistaLeft, minLeft, 0);
      objLeft = xPx + pistaLeft;
    }

    this.dom.pista.style.left = `${Math.round(pistaLeft)}px`;
    el.style.left = `${Math.round(objLeft)}px`;
  }

  setViewWidth(px) {
    this.viewW = px;
    if (this.world) {
      this.world = computeWorld(this.params, this.tMax, this.viewW, 160);
      buildTrack(this.dom.pista, this.world);
    }
  }
}

// ============================
// App Wiring
// ============================
const LIMITS = {
  x0Min: -1000, x0Max: 1000,
  v0Min: -500,  v0Max: 500,
  aMin: -200,   aMax: 200,
  tMin: 0.1,    tMax: 120,
  maxPoints: 900,
};

const dom = {
  tipo: $("tipo"),
  objetoTipo: $("objetoTipo"),
  x0: $("x0"),
  v0: $("v0"),
  a: $("a"),
  tiempoTotal: $("tiempoTotal"),
  aceleracionGrupo: $("aceleracionGrupo"),
  speedNote: $("speedNote"),

  pista: $("pista"),
  objeto: $("objeto"),
  car: $("car"),

  alertas: $("alertas"),

  btnStart: $("btnStart"),
  btnPause: $("btnPause"),
  btnReset: $("btnReset"),
  btnStartTour: $("btnStartTour"),

  tourOverlay: $("tourOverlay"),
  tourHighlight: $("tourHighlight"),
  tourTooltip: $("tourTooltip"),

  simViewport: $("simViewport"),
  chart: $("chart"),

  // Stats
  statTime: $("statTime"),
  statPos: $("statPos"),
  statVel: $("statVel"),
  statAccWrap: $("statAccWrap"),
  statAcc: $("statAcc"),

  badgeMode: $("badgeMode"),
  badgeSpeed: $("badgeSpeed"),
};

function decorateInputs() {
  // tooltip con límites en el propio input
  dom.x0.title = `Límite: ${LIMITS.x0Min} a ${LIMITS.x0Max}`;
  dom.v0.title = `Límite: ${LIMITS.v0Min} a ${LIMITS.v0Max}`;
  dom.a.title  = `Límite: ${LIMITS.aMin} a ${LIMITS.aMax}`;
  dom.tiempoTotal.title = `Límite: ${LIMITS.tMin} a ${LIMITS.tMax}`;
}

function applyMovementUI() {
  const isMRU = dom.tipo.value === "mru";
  dom.aceleracionGrupo.style.display = isMRU ? "none" : "block";
  dom.statAccWrap.style.display = isMRU ? "none" : "block";
  dom.badgeMode.textContent = isMRU ? "MRU" : "MRV";
}

function applyObjectUI() {
  dom.objeto.style.display = "none";
  dom.car.classList.add("hidden");

  const tipo = dom.objetoTipo.value;
  if (tipo === "pelota") {
    dom.objeto.className = "pelota";
    dom.objeto.style.display = "block";
  } else if (tipo === "cubo") {
    dom.objeto.className = "cubo";
    dom.objeto.style.display = "block";
  } else {
    dom.car.classList.remove("hidden");
  }
}

function setButtons(state) {
  if (state === STATE.IDLE) {
    dom.btnStart.disabled = false;
    dom.btnPause.disabled = true;
    dom.btnReset.disabled = false;
    dom.btnStart.textContent = "Iniciar";
  } else if (state === STATE.RUNNING) {
    dom.btnStart.disabled = true;
    dom.btnPause.disabled = false;
    dom.btnReset.disabled = false;
    dom.btnStart.textContent = "Iniciar";
  } else if (state === STATE.PAUSED) {
    dom.btnStart.disabled = false;
    dom.btnPause.disabled = true;
    dom.btnReset.disabled = false;
    dom.btnStart.textContent = "Reanudar";
  } else if (state === STATE.FINISHED) {
    dom.btnStart.disabled = false;
    dom.btnPause.disabled = true;
    dom.btnReset.disabled = false;
    dom.btnStart.textContent = "Iniciar";
  }
}

function readInputs() {
  const type = dom.tipo.value;
  const x0 = parseFloat(dom.x0.value);
  const v0 = parseFloat(dom.v0.value);
  const a = parseFloat(dom.a.value);
  const tiempoTotal = parseFloat(dom.tiempoTotal.value);
  return { type, x0, v0, a, tiempoTotal };
}

function validateInputs(raw) {
  clearAlerts(dom.alertas);

  const problems = [];

  if (!isFiniteNumber(raw.x0)) problems.push("Posición inicial (x₀) inválida.");
  if (!isFiniteNumber(raw.v0)) problems.push("Velocidad inicial (v₀) inválida.");
  if (raw.type === "mrv" && !isFiniteNumber(raw.a)) problems.push("Aceleración (a) inválida.");
  if (!isFiniteNumber(raw.tiempoTotal) || raw.tiempoTotal <= 0) problems.push("Tiempo total debe ser mayor que 0.");

  if (isFiniteNumber(raw.x0) && (raw.x0 < LIMITS.x0Min || raw.x0 > LIMITS.x0Max)) problems.push(`x₀ fuera de rango (${LIMITS.x0Min} a ${LIMITS.x0Max}).`);
  if (isFiniteNumber(raw.v0) && (raw.v0 < LIMITS.v0Min || raw.v0 > LIMITS.v0Max)) problems.push(`v₀ fuera de rango (${LIMITS.v0Min} a ${LIMITS.v0Max}).`);
  if (raw.type === "mrv" && isFiniteNumber(raw.a) && (raw.a < LIMITS.aMin || raw.a > LIMITS.aMax)) problems.push(`a fuera de rango (${LIMITS.aMin} a ${LIMITS.aMax}).`);
  if (isFiniteNumber(raw.tiempoTotal) && (raw.tiempoTotal < LIMITS.tMin || raw.tiempoTotal > LIMITS.tMax)) problems.push(`Tiempo fuera de rango (${LIMITS.tMin} a ${LIMITS.tMax}).`);

  if (problems.length) {
    problems.forEach(p => pushAlert(dom.alertas, p, "err"));
    return false;
  }
  return true;
}

function computeDtSim(tMax) {
  const dt = tMax / LIMITS.maxPoints;
  return Math.max(0.02, dt);
}

function fmt(n, digits = 2) {
  if (n == null) return "—";
  return Number(n).toFixed(digits);
}

function renderStats({ t, x, v, a, type, speed }) {
  dom.statTime.textContent = t == null ? "—" : fmt(t, 1);
  dom.statPos.textContent  = x == null ? "—" : fmt(x, 2);
  dom.statVel.textContent  = v == null ? "—" : fmt(v, 2);

  if (type === "mrv") {
    dom.statAccWrap.style.display = "block";
    dom.statAcc.textContent = a == null ? "—" : fmt(a, 2);
  } else {
    dom.statAccWrap.style.display = "none";
  }

  dom.badgeSpeed.textContent = `${(speed ?? 1).toFixed(1)}×`;
}

function updateSpeedNote(tMax) {
  if (!isFiniteNumber(tMax)) return;
  if (tMax > 60) {
    const s = clamp(tMax / 60, 1, 8).toFixed(1);
    dom.speedNote.textContent = `Aceleración activada: ${s}× (para que no dure más de 1 minuto real).`;
  } else {
    dom.speedNote.textContent = `Tip: si pasas de 60s, el simulador acelera para no tardar más de 1 minuto real.`;
  }
}

// Chart + Engine
const chart = new Chart(dom.chart);
const getViewW = () => Math.round(dom.simViewport.getBoundingClientRect().width);

const engine = new SimulationEngine({
  dom,
  chart,
  viewW: getViewW(),
  cameraMargin: 320,
  dtSim: 0.05,
  maxStepsPerFrame: 18, // un poquito más para que “fluya” con speed-up
  onWorldNotice: (msg) => pushAlert(dom.alertas, msg, "info"),
  onStateChange: (st) => {
    setButtons(st);
    if (st === STATE.FINISHED) {
      pushAlert(dom.alertas, "Simulación finalizada. Puedes reiniciar o cambiar parámetros.", "info");
    }
  },
  onStats: (data) => renderStats(data),
});

// Tour
const tour = new Tour({
  overlay: dom.tourOverlay,
  highlight: dom.tourHighlight,
  tooltip: dom.tourTooltip,
  steps: [
    { title: "Bienvenido", text: "Te mostraremos un recorrido por las secciones principales del simulador.", target: null, primaryLabel: "Comenzar recorrido" },
    { title: "Tipo de movimiento", text: "Elige MRU (v constante) o MRV (con aceleración).", target: "#tipo", placement: "right" },
    { title: "Objeto", text: "Selecciona el objeto que se moverá en la pista.", target: "#objetoTipo", placement: "right" },
    { title: "Parámetros", text: "Configura x₀ y v₀. Los límites están visibles para evitar errores.", target: "#x0", placement: "right" },
    { title: "Aceleración", text: "Aparece solo en MRV.", target: "#aceleracionGrupo", placement: "right" },
    { title: "Tiempo total", text: "Si es mayor que 60s, la simulación acelera para no tardar más de 1 minuto real.", target: "#tiempoTotal", placement: "right" },
    { title: "Simulación", text: "Objeto + pista con cámara.", target: "#simViewport", placement: "left" },
    { title: "Estadística", text: "Tiempo, posición, velocidad (y aceleración si aplica).", target: "#info", placement: "left" },
    { title: "Gráfica", text: "Se dibujan x(t) y v(t).", target: "#chartCard", placement: "left" },
  ],
});

// Eventos UI
dom.tipo.addEventListener("change", () => {
  applyMovementUI();
  if (engine.state === STATE.RUNNING) pushAlert(dom.alertas, "Reinicia para aplicar el cambio de tipo de movimiento.", "info");
});

dom.objetoTipo.addEventListener("change", () => {
  applyObjectUI();
  if (engine.state === STATE.RUNNING) pushAlert(dom.alertas, "Reinicia para aplicar el cambio de objeto.", "info");
});

dom.tiempoTotal.addEventListener("input", () => {
  const tMax = parseFloat(dom.tiempoTotal.value);
  updateSpeedNote(tMax);
});

dom.btnStart.addEventListener("click", () => {
  if (engine.state === STATE.PAUSED) {
    clearAlerts(dom.alertas);
    engine.resume();
    return;
  }

  if (engine.state === STATE.RUNNING) {
    pushAlert(dom.alertas, "La simulación ya está en ejecución.", "info");
    return;
  }

  applyMovementUI();
  applyObjectUI();

  const raw = readInputs();
  if (!validateInputs(raw)) return;

  const params = {
    type: raw.type,
    x0: raw.x0,
    v0: raw.v0,
    a: raw.type === "mrv" ? raw.a : 0,
  };

  clearAlerts(dom.alertas);

  engine.dtSim = computeDtSim(raw.tiempoTotal);
  updateSpeedNote(raw.tiempoTotal);
  engine.startNew(params, raw.tiempoTotal);
});

dom.btnPause.addEventListener("click", () => {
  if (engine.state !== STATE.RUNNING) {
    pushAlert(dom.alertas, "No puedes detener: la simulación no está corriendo.", "info");
    return;
  }
  engine.pause();
  setButtons(engine.state);
  pushAlert(dom.alertas, "⏸️ Simulación en pausa. Presiona Reanudar para continuar.", "info");
});

dom.btnReset.addEventListener("click", () => {
  clearAlerts(dom.alertas);
  engine.resetScene();
  setButtons(engine.state);
  applyMovementUI();
  applyObjectUI();
  updateSpeedNote(parseFloat(dom.tiempoTotal.value));
  chart.draw(10);
});

dom.btnStartTour.addEventListener("click", () => tour.start());

window.addEventListener("resize", () => {
  engine.setViewWidth(getViewW());
  chart.draw(engine.tMax ?? 10);
});

// Init
function init() {
  decorateInputs();
  applyMovementUI();
  applyObjectUI();
  engine.resetScene();
  setButtons(engine.state);
  updateSpeedNote(parseFloat(dom.tiempoTotal.value));
  chart.draw(10);
  tour.start();
}
init();
