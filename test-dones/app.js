(() => {
  "use strict";
  const T = window.TEST;
  const N = T.afirmaciones.length; // 70
  const CLAVE = "casanueva.testDones.v1";
  // Envío del resultado a Casa Suite (los pastores y administración lo ven en Personas → Test de dones).
  const ENDPOINT = "https://somoscasasuite.app/api/publico/test-dones";
  const VERSION_TEST = 1;
  const uuid = () =>
    (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); });
  const $ = (id) => document.getElementById(id);

  // ---------- Estado ----------
  let estado = cargar() || nuevoEstado();
  let ejemplo = false;
  let avanzando = false;

  function nuevoEstado() {
    return { nombre: "", apellido: "", celular: "", respuestas: Array(N).fill(0), indice: 0, habilidades: [], terminado: false, clave: uuid(), enviado: false };
  }
  function cargar() {
    try {
      const s = JSON.parse(localStorage.getItem(CLAVE));
      if (s && Array.isArray(s.respuestas) && s.respuestas.length === N) {
        if (!s.clave) s.clave = uuid();
        return { apellido: "", celular: "", enviado: false, ...s };
      }
    } catch (_) { /* sin almacenamiento */ }
    return null;
  }
  function guardar() {
    if (ejemplo) return;
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (_) { /* sin almacenamiento */ }
  }
  const respondidas = () => estado.respuestas.filter(Boolean).length;
  const usadas3 = () => estado.respuestas.filter((r) => r === 3).length;

  // ---------- Navegación entre vistas ----------
  function mostrar(id) {
    document.querySelectorAll(".vista").forEach((v) => (v.hidden = v.id !== id));
    window.scrollTo({ top: 0 });
    if (id !== "resultados" && location.hash) history.replaceState(null, "", location.pathname);
  }

  // ---------- Inicio ----------
  function iniciarVistaInicio() {
    $("nombre").value = estado.nombre || "";
    $("apellido").value = estado.apellido || "";
    $("celular").value = estado.celular || "";
    const n = respondidas();
    const hayAvance = n > 0;
    $("reanudar").hidden = !hayAvance;
    $("btn-empezar").hidden = hayAvance;
    $("reanudar-progreso").textContent = estado.terminado ? "ya terminado" : `${n} de ${N} respondidas`;
    $("btn-continuar").textContent = estado.terminado ? "Ver mi resultado" : "Continuar";
    mostrar("inicio");
  }
  [["nombre", "nombre"], ["apellido", "apellido"], ["celular", "celular"]].forEach(([id, campo]) => {
    $(id).addEventListener("input", (e) => { estado[campo] = e.target.value.trim(); guardar(); });
  });
  const datosPersonales = () => ({ nombre: $("nombre").value.trim(), apellido: $("apellido").value.trim(), celular: $("celular").value.trim() });
  $("btn-empezar").addEventListener("click", () => { ejemplo = false; estado.indice = 0; guardar(); irATest(); });
  $("btn-continuar").addEventListener("click", () => {
    ejemplo = false;
    if (estado.terminado) return verResultados();
    const pend = estado.respuestas.findIndex((r) => !r);
    estado.indice = pend === -1 ? N - 1 : pend;
    irATest();
  });
  $("btn-reiniciar").addEventListener("click", () => {
    estado = { ...nuevoEstado(), ...datosPersonales() }; guardar(); irATest();
  });
  $("btn-ejemplo").addEventListener("click", verEjemplo);

  // ---------- Preguntas ----------
  const opcionesEl = $("opciones");
  const botones = T.escala.map((op) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opcion";
    b.setAttribute("role", "radio");
    b.dataset.valor = op.valor;
    b.innerHTML = `<span class="n">${op.valor}</span><span class="t">${op.texto}</span><span class="dots">${
      [1, 2, 3, 4, 5].map((i) => `<i class="${i <= op.valor ? "on" : ""}"></i>`).join("")
    }</span>`;
    b.addEventListener("click", () => responder(op.valor));
    opcionesEl.appendChild(b);
    return b;
  });

  function irATest() { mostrar("test"); pintarPregunta(true); }

  function pintarPregunta(animar) {
    const i = estado.indice;
    const actual = estado.respuestas[i];
    $("num").textContent = `Afirmación ${i + 1} de ${N}`;
    $("afirmacion").textContent = T.afirmaciones[i];
    const card = $("pregunta");
    if (animar) { card.classList.remove("entra"); void card.offsetWidth; card.classList.add("entra"); }

    const u = usadas3();
    const lleno3 = u >= T.maxAlgunasVeces && actual !== 3;
    botones.forEach((b) => {
      const v = Number(b.dataset.valor);
      b.setAttribute("aria-checked", String(v === actual));
      const bloquear = v === 3 && lleno3;
      b.disabled = bloquear;
      b.querySelector(".dots").hidden = bloquear;
      let lim = b.querySelector(".lim");
      if (bloquear && !lim) { lim = document.createElement("span"); lim.className = "lim"; lim.textContent = "Límite alcanzado"; b.appendChild(lim); }
      if (!bloquear && lim) lim.remove();
    });

    // Contador del límite de «Algunas veces».
    const c = $("contador-3");
    $("contador-3-texto").textContent = `${u}/${T.maxAlgunasVeces}`;
    c.classList.toggle("cerca", u >= T.maxAlgunasVeces - 3 && u < T.maxAlgunasVeces);
    c.classList.toggle("lleno", u >= T.maxAlgunasVeces);
    const aviso = $("aviso-3");
    if (lleno3) {
      aviso.hidden = false;
      aviso.textContent = "Ya usaste las 15 «Algunas veces». Elegí la opción que más se acerque a lo que ves en vos.";
    } else if (u === T.maxAlgunasVeces - 3 || u === T.maxAlgunasVeces - 1) {
      aviso.hidden = false;
      aviso.textContent = `Te ${T.maxAlgunasVeces - u === 1 ? "queda 1 «Algunas veces»" : `quedan ${T.maxAlgunasVeces - u} «Algunas veces»`}. Usalas solo cuando de verdad estés en el medio.`;
    } else aviso.hidden = true;

    $("btn-ir-final").hidden = respondidas() < N;
    const n = respondidas();
    $("progreso-barra").style.width = `${(n / N) * 100}%`;
    $("progreso").setAttribute("aria-valuenow", n);
  }

  function responder(valor) {
    if (avanzando) return;
    if (valor === 3 && usadas3() >= T.maxAlgunasVeces && estado.respuestas[estado.indice] !== 3) return;
    estado.respuestas[estado.indice] = valor;
    estado.terminado = false;
    guardar();
    pintarPregunta(false);
    avanzando = true;
    setTimeout(() => {
      avanzando = false;
      const i = estado.indice;
      const siguientePend = estado.respuestas.findIndex((r, k) => !r && k > i);
      const primeraPend = estado.respuestas.findIndex((r) => !r);
      if (siguientePend !== -1) estado.indice = siguientePend;
      else if (primeraPend !== -1) estado.indice = primeraPend; // vuelve a la primera que quedó sin responder
      else if (i < N - 1) estado.indice = i + 1; // todo respondido: está revisando
      else { guardar(); return irAFinal(); }
      guardar();
      pintarPregunta(true);
    }, 220);
  }

  function atras() {
    if (avanzando) return;
    if (estado.indice === 0) return iniciarVistaInicio();
    estado.indice--;
    guardar();
    pintarPregunta(true);
  }
  $("btn-atras").addEventListener("click", atras);
  $("btn-ir-final").addEventListener("click", irAFinal);

  document.addEventListener("keydown", (e) => {
    if ($("test").hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key >= "1" && e.key <= "5") { e.preventDefault(); responder(Number(e.key)); }
    else if (e.key === "ArrowLeft" || e.key === "Backspace") { e.preventDefault(); atras(); }
    else if (e.key === "ArrowRight" && estado.respuestas[estado.indice] && estado.indice < N - 1) { estado.indice++; pintarPregunta(true); }
  });

  // ---------- Paso final (habilidades) ----------
  const chipsEl = $("habilidades");
  T.habilidades.forEach((h) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = h.texto; b.dataset.id = h.id;
    b.addEventListener("click", () => {
      const set = new Set(estado.habilidades);
      set.has(h.id) ? set.delete(h.id) : set.add(h.id);
      estado.habilidades = [...set];
      b.setAttribute("aria-pressed", String(set.has(h.id)));
      guardar();
    });
    chipsEl.appendChild(b);
  });
  function irAFinal() {
    chipsEl.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(estado.habilidades.includes(b.dataset.id))));
    mostrar("final");
  }
  $("btn-resultados").addEventListener("click", () => { estado.terminado = true; guardar(); verResultados(); enviar(); });
  $("btn-revisar").addEventListener("click", () => { estado.indice = 0; irATest(); });

  // ---------- Cálculo ----------
  function calcular(respuestas, habilidades) {
    const dones = T.dones.map((d, orden) => {
      const valores = d.preguntas.map((q) => respuestas[q - 1] || 0);
      return { ...d, orden, valores, total: valores.reduce((a, b) => a + b, 0) };
    });
    const ordenados = [...dones].sort((a, b) => b.total - a.total || a.orden - b.orden);
    // Puesto con empates (1, 2, 2, 4…)
    ordenados.forEach((d, i) => { d.puesto = i > 0 && d.total === ordenados[i - 1].total ? ordenados[i - 1].puesto : i + 1; });

    // Top 3 incluyendo todos los empatados con el tercer lugar.
    const corte = ordenados[2].total;
    const top = ordenados.filter((d) => d.total >= corte);
    const empateTercero = top.length > 3;

    // Áreas: afinidad = promedio ponderado de (don normalizado)², para premiar los dones fuertes.
    const porId = Object.fromEntries(dones.map((d) => [d.id, d]));
    const norm = (t) => Math.max(0, (t - 5) / 20);
    const hab = new Set(habilidades || []);
    const areas = T.areas.map((a, orden) => {
      let suma = 0, pesos = 0;
      const aportes = [];
      for (const [id, w] of Object.entries(a.dones)) {
        const n = norm(porId[id].total);
        suma += w * n * n; pesos += w;
        aportes.push({ don: porId[id], valor: w * n * n, w });
      }
      let afinidad = suma / pesos;
      const habilidadesArea = T.habilidades.filter((h) => hab.has(h.id) && h.areas.includes(a.id));
      if (habilidadesArea.length) afinidad += 0.18;
      else if (a.habilidad) afinidad *= 0.8; // Alabanza y Multimedia dependen también de un talento concreto.
      const porque = aportes
        .filter((x) => x.don.total >= corte || (x.w >= 2 && x.don.puesto <= 6))
        .sort((x, y) => y.valor - x.valor)
        .slice(0, 3)
        .map((x) => x.don);
      return { ...a, orden, afinidad, porque, habilidadesArea };
    }).sort((x, y) => y.afinidad - x.afinidad || x.orden - y.orden);

    return { dones, ordenados, top, empateTercero, areas: areas.slice(0, 3) };
  }

  // ---------- Resultados ----------
  function verResultados() {
    const r = calcular(estado.respuestas, estado.habilidades);
    pintarResultados(r);
    mostrar("resultados");
    if (!ejemplo) history.replaceState(null, "", "#resultado");
    requestAnimationFrame(() => setTimeout(() => {
      document.querySelectorAll(".fila-rank .fill").forEach((f) => (f.style.width = f.dataset.w));
    }, 60));
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function pintarResultados(r) {
    const nombre = estado.nombre;
    $("res-titulo").innerHTML = nombre ? `${esc(nombre)}, <b>estos son tus dones</b>` : `Estos son <b>tus dones</b>`;
    $("res-fecha").textContent = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
    $("banner-ejemplo").hidden = !ejemplo;
    $("envio").hidden = !(estado.enviado && !ejemplo && (estado.nombre || estado.celular));
    $("envio").textContent = "✓ Tu resultado le llegó al equipo de Casa Nueva.";

    // Top
    const nota = $("nota-empate");
    nota.hidden = !r.empateTercero;
    if (r.empateTercero) {
      const emp = r.top.filter((d) => d.total === r.top[r.top.length - 1].total);
      const enTercero = emp[0].puesto === 3;
      nota.textContent = `${enTercero ? "Hay un empate en el tercer lugar" : "Hay un empate"} entre ${lista(emp.map((d) => d.nombre))}, con ${emp[0].total} puntos cada uno. Por eso te mostramos ${r.top.length} dones.`;
    }
    const corte = r.top[r.top.length - 1].total;
    $("top-dones").innerHTML = r.top.map((d, i) => `
      <article class="card don ${i === 0 ? "primero" : ""}">
        <div class="don-cab">
          <span class="puesto">${d.puesto}</span>
          <div>
            <h3>${esc(d.nombre)}</h3>
            ${d.subtitulo ? `<p class="sub">${esc(d.subtitulo)}</p>` : ""}
            ${r.empateTercero && d.total === corte ? `<span class="empate-tag">Empate</span>` : ""}
          </div>
          <div class="puntaje"><b>${d.total}</b><small>de 25</small></div>
        </div>
        <p class="def">${esc(d.definicion)}</p>
        <p class="practica">${esc(d.practica)}</p>
        <p class="cita">${esc(d.cita)}</p>
      </article>`).join("");

    // Áreas
    $("areas").innerHTML = r.areas.map((a, i) => `
      <article class="card area">
        <div class="ico"><img src="assets/isologo-blanco.png" alt="" width="30" height="30" /></div>
        <h3>${esc(a.nombre)} ${i === 0 ? "<small>Mayor afinidad</small>" : ""}</h3>
        <p>${esc(a.descripcion)}</p>
        <div class="porque">
          ${a.porque.map((d) => `<span>${esc(d.nombre)}</span>`).join("")}
          ${a.habilidadesArea.map((h) => `<span class="hab">${esc(h.texto)}</span>`).join("")}
        </div>
      </article>`).join("");

    // Ranking
    $("ranking").innerHTML = r.ordenados.map((d) => `
      <div class="fila-rank ${d.total >= corte ? "top" : ""}">
        <span class="pos">${d.puesto}</span>
        <span class="nom">${esc(d.nombre)}</span>
        <span class="val">${d.total}</span>
        <div class="track"><div class="fill" data-w="${(d.total / 25) * 100}%"></div></div>
      </div>`).join("");

    // Cuadro 2 (mismo orden que el papel)
    $("tabla").innerHTML = `
      <thead><tr><th>Don</th><th colspan="5">Afirmaciones</th><th>Total</th></tr></thead>
      <tbody>${r.dones.map((d) => `
        <tr><td>${esc(d.nombre)}</td>${d.valores.map((v, k) => `<td>${v}<small>#${d.preguntas[k]}</small></td>`).join("")}<td class="total">${d.total}</td></tr>`).join("")}
      </tbody>`;

    resultadoActual = r;
  }
  let resultadoActual = null;

  function lista(arr) {
    return arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}`;
  }

  // ---------- Acciones ----------
  function textoCompartir() {
    const r = resultadoActual;
    const quien = estado.nombre ? ` de ${estado.nombre}` : "";
    return [
      `Test de Dones${quien} · Casa Nueva`,
      "",
      "Dones principales:",
      ...r.top.map((d) => `${d.puesto}. ${d.nombre} (${d.total}/25)`),
      "",
      `Áreas sugeridas: ${lista(r.areas.map((a) => a.nombre))}`,
      "",
      `Todos: ${r.ordenados.map((d) => `${d.nombre} ${d.total}`).join(" · ")}`,
    ].join("\n");
  }
  $("btn-compartir").addEventListener("click", async () => {
    const texto = textoCompartir();
    if (navigator.share) {
      try { await navigator.share({ title: "Mi Test de Dones · Casa Nueva", text: texto }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  });
  $("btn-imprimir").addEventListener("click", () => window.print());
  window.addEventListener("beforeprint", () => document.querySelectorAll("details.detalle").forEach((d) => (d.open = true)));
  $("btn-otra-vez").addEventListener("click", () => {
    if (ejemplo) { ejemplo = false; estado = cargar() || nuevoEstado(); return iniciarVistaInicio(); }
    if (!confirm("¿Querés borrar tus respuestas y hacer el test de nuevo?")) return;
    estado = { ...nuevoEstado(), nombre: estado.nombre, apellido: estado.apellido, celular: estado.celular }; guardar();
    iniciarVistaInicio();
  });

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2400);
  }

  // ---------- Ejemplo (para mostrar el resultado sin responder las 70) ----------
  function verEjemplo() {
    ejemplo = true;
    const fuertes = new Set(["misericordia", "exhortacion", "ensenanza", "servicio"]);
    const qFuertes = new Set(T.dones.filter((d) => fuertes.has(d.id)).flatMap((d) => d.preguntas));
    let tres = 0;
    const respuestas = Array.from({ length: N }, (_, i) => {
      const base = qFuertes.has(i + 1) ? [4, 5, 5, 4, 5] : [1, 2, 2, 3, 4, 2, 3, 1];
      let v = base[Math.floor(Math.random() * base.length)];
      if (v === 3 && ++tres > T.maxAlgunasVeces) v = 2;
      return v;
    });
    estado = { nombre: "Ejemplo", apellido: "", celular: "", respuestas, indice: N - 1, habilidades: ["chicos"], terminado: true, clave: "", enviado: true };
    verResultados();
    toast("Este es un resultado de ejemplo");
  }

  // ---------- Envío a Casa Suite ----------
  // Silencioso: si falla (sin conexión, servidor caído) el resultado igual se muestra y se reintenta al volver a abrir.
  let enviando = false;
  async function enviar() {
    if (ejemplo || estado.enviado || enviando || estado.respuestas.some((r) => !r)) return;
    enviando = true;
    const cuerpo = {
      submissionKey: estado.clave,
      givenName: estado.nombre || undefined,
      familyName: estado.apellido || undefined,
      phone: estado.celular || undefined,
      answers: estado.respuestas,
      skills: estado.habilidades,
      definitionVersion: VERSION_TEST,
      website: $("website").value || undefined,
    };
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "text/plain;charset=UTF-8" }, body: JSON.stringify(cuerpo), mode: "cors", credentials: "omit", keepalive: true });
      if (res.ok) {
        estado.enviado = true;
        guardar();
        const aviso = $("envio");
        if (!$("resultados").hidden && (estado.nombre || estado.celular)) {
          aviso.textContent = "✓ Tu resultado le llegó al equipo de Casa Nueva.";
          aviso.hidden = false;
        }
      } else if (res.status === 422) {
        estado.enviado = true; // datos que el servidor no acepta: no se reintenta para siempre
        guardar();
      }
    } catch (_) { /* sin conexión: se reintenta en la próxima visita */ }
    enviando = false;
  }

  // ---------- Arranque ----------
  if (new URLSearchParams(location.search).has("ejemplo")) verEjemplo();
  else if (estado.terminado && location.hash === "#resultado") verResultados();
  else iniciarVistaInicio();
  if (!ejemplo && estado.terminado && !estado.enviado) enviar();
})();
