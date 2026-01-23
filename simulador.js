let intervalo;
let t = 0;
let enPausa = false;

const escala = 10; // 1 m = 10 px
const anchoVista = 700;
const margenCamara = 300;

function cambiarMovimiento() {
  const tipo = document.getElementById("tipo").value;
  const grupoAceleracion = document.getElementById("aceleracionGrupo");
  grupoAceleracion.style.display = (tipo === "mru") ? "none" : "block";
}

function cambiarObjeto() {
  const tipo = document.getElementById("objetoTipo").value;

  const objeto = document.getElementById("objeto");
  const car = document.getElementById("car");

  objeto.style.display = "none";
  car.classList.add("hidden");

  if (tipo === "pelota") {
    objeto.className = "pelota";
    objeto.style.display = "block";
  }

  if (tipo === "cubo") {
    objeto.className = "cubo";
    objeto.style.display = "block";
  }

  if (tipo === "carro") {
    car.classList.remove("hidden");
  }
}

function crearPista(xmaxPx) {
  const pista = document.getElementById("pista");
  pista.innerHTML = "";
  pista.style.width = `${xmaxPx}px`;

  const paso = 10 * escala;

  for (let x = 0; x <= xmaxPx; x += paso) {
    const marca = document.createElement("div");
    marca.className = "marca";
    marca.style.left = `${x}px`;

    const texto = document.createElement("span");
    texto.innerText = `${Math.round(x / escala)} m`;

    marca.appendChild(texto);
    pista.appendChild(marca);
  }
}

function iniciar() {
  clearInterval(intervalo);
  enPausa = false;
  cambiarObjeto();

  const tipoMov = document.getElementById("tipo").value;
  const tipoObj = document.getElementById("objetoTipo").value;

  const x0 = parseFloat(document.getElementById("x0").value);
  const v0 = parseFloat(document.getElementById("v0").value);
  const a = parseFloat(document.getElementById("a").value);
  const tiempoTotal = parseFloat(document.getElementById("tiempoTotal").value);

  let elemento = (tipoObj === "carro")
    ? document.getElementById("car")
    : document.getElementById("objeto");

  let xmax;
  if (tipoMov === "mru") {
    xmax = x0 + v0 * tiempoTotal;
  } else {
    xmax = x0 + v0 * tiempoTotal + 0.5 * a * tiempoTotal * tiempoTotal;
  }

  const xmaxPx = Math.max(0, xmax * escala) + 300;
  crearPista(xmaxPx);

  intervalo = setInterval(() => {
    if (enPausa) return;

    let x, v;

    if (tipoMov === "mru") {
      x = x0 + v0 * t;
      v = v0;
    } else {
      x = x0 + v0 * t + 0.5 * a * t * t;
      v = v0 + a * t;
    }

    const xPx = x * escala;
    const pista = document.getElementById("pista");

    if (xPx > margenCamara) {
      pista.style.left = `${-(xPx - margenCamara)}px`;
      elemento.style.left = `${margenCamara}px`;
    } else {
      pista.style.left = "0px";
      elemento.style.left = `${xPx}px`;
    }

    document.getElementById("info").innerText =
      `Tiempo: ${t.toFixed(1)} s   |   Posición: ${x.toFixed(2)} m   |   Velocidad: ${v.toFixed(2)} m/s`;

    t += 0.1;

    if (t > tiempoTotal) {
      clearInterval(intervalo);
    }
  }, 100);
}

function detener() {
  enPausa = true;
}

function reiniciar() {
  clearInterval(intervalo);
  t = 0;
  enPausa = false;

  document.getElementById("objeto").style.left = "0px";
  document.getElementById("car").style.left = "0px";
  document.getElementById("pista").style.left = "0px";
  document.getElementById("pista").innerHTML = "";
  document.getElementById("info").innerText = "";
}

// Inicializar
cambiarMovimiento();
cambiarObjeto();
