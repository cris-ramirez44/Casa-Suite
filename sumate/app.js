(() => {
  "use strict";
  // Envío a Casa Suite: lo ven los pastores y administración en Personas → «Se sumaron por el formulario».
  const ENDPOINT = "https://somoscasasuite.app/api/publico/sumate";
  const PENDIENTE = "casanueva.sumate.pendiente.v1";
  const $ = (id) => document.getElementById(id);
  const uuid = () =>
    window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); });
  const leer = () => { try { return JSON.parse(localStorage.getItem(PENDIENTE)); } catch (_) { return null; } };
  const guardar = (v) => { try { v ? localStorage.setItem(PENDIENTE, JSON.stringify(v)) : localStorage.removeItem(PENDIENTE); } catch (_) { /* sin almacenamiento */ } };

  // ---------- Fecha de cumpleaños (día / mes / año) ----------
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const opt = (sel, value, text) => { const o = document.createElement("option"); o.value = value; o.textContent = text; sel.appendChild(o); };
  for (let d = 1; d <= 31; d++) opt($("dia"), String(d).padStart(2, "0"), String(d));
  MESES.forEach((m, i) => opt($("mes"), String(i + 1).padStart(2, "0"), m));
  const hoy = new Date();
  for (let y = hoy.getFullYear(); y >= 1930; y--) opt($("anio"), String(y), String(y));

  // ---------- Bautismo: detalle solo para «otra iglesia» ----------
  document.querySelectorAll('input[name="bautismo"]').forEach((r) =>
    r.addEventListener("change", () => { $("detalle-campo").hidden = r.value !== "OTRA_IGLESIA" || !r.checked; limpiarError("baptism"); }),
  );
  document.querySelectorAll('input[name="compromiso"]').forEach((c) => c.addEventListener("change", () => limpiarError("commitments")));
  ["nombre", "apellido", "celular"].forEach((id) => $(id).addEventListener("input", () => { $(id).classList.remove("invalido"); limpiarError({ nombre: "givenName", apellido: "familyName", celular: "phone" }[id]); }));
  ["dia", "mes", "anio"].forEach((id) => $(id).addEventListener("change", () => limpiarError("birthDate")));

  // ---------- Validación ----------
  const errorEl = (campo) => document.querySelector(`.error[data-para="${campo}"]`);
  function mostrarError(campo, texto) { const el = errorEl(campo); if (el) el.textContent = texto; }
  function limpiarError(campo) { const el = errorEl(campo); if (el) el.textContent = ""; }

  function fechaValida(y, m, d) {
    const f = new Date(Date.UTC(+y, +m - 1, +d));
    return f.getUTCFullYear() === +y && f.getUTCMonth() === +m - 1 && f.getUTCDate() === +d && f <= hoy;
  }

  function datos() {
    const bautismo = document.querySelector('input[name="bautismo"]:checked');
    const compromisos = [...document.querySelectorAll('input[name="compromiso"]')].map((c) => c.checked);
    return {
      givenName: $("nombre").value.trim(),
      familyName: $("apellido").value.trim(),
      phone: $("celular").value.trim(),
      birthDate: $("anio").value && $("mes").value && $("dia").value ? `${$("anio").value}-${$("mes").value}-${$("dia").value}` : "",
      baptism: bautismo ? bautismo.value : "",
      baptismDetail: bautismo && bautismo.value === "OTRA_IGLESIA" ? $("detalle").value.trim() : "",
      commitments: compromisos,
    };
  }

  function validar(d) {
    const errores = {};
    if (!d.givenName) errores.givenName = "Completá tu nombre.";
    if (!d.familyName) errores.familyName = "Completá tu apellido.";
    if (!d.phone) errores.phone = "Completá tu celular.";
    else if (!/^[0-9+()\-.\s]+$/.test(d.phone)) errores.phone = "Usá solo números.";
    else if (d.phone.replace(/\D/g, "").length < 8) errores.phone = "Revisá el celular: parece incompleto.";
    if (!d.birthDate) errores.birthDate = "Elegí día, mes y año.";
    else if (!fechaValida(...d.birthDate.split("-"))) errores.birthDate = "Esa fecha no existe.";
    if (!d.baptism) errores.baptism = "Elegí una opción.";
    if (d.commitments.some((c) => !c)) errores.commitments = "Para sumarte, marcá los cuatro compromisos.";
    return errores;
  }

  // ---------- Envío ----------
  async function enviar(cuerpo) {
    const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "text/plain;charset=UTF-8" }, body: JSON.stringify(cuerpo), mode: "cors", credentials: "omit" });
    let json = {};
    try { json = await res.json(); } catch (_) { /* sin cuerpo */ }
    return { ok: res.ok, status: res.status, json };
  }

  function gracias(nombre) {
    guardar(null);
    if (nombre) $("gracias-titulo").innerHTML = `¡${nombre.replace(/[&<>"']/g, "")}, ya sos parte de <span>Casa Nueva!</span>`;
    $("formulario").hidden = true;
    $("gracias").hidden = false;
    window.scrollTo({ top: 0 });
  }

  function avisoPendiente() {
    const p = leer();
    const aviso = $("pendiente");
    if (!p) { aviso.hidden = true; return; }
    aviso.hidden = false;
    aviso.innerHTML = 'Tu formulario todavía no llegó (no había conexión). Lo guardamos en este teléfono. <button type="button" id="reintentar">Enviarlo ahora</button>';
    $("reintentar").addEventListener("click", () => reintentar(true));
  }

  async function reintentar(manual) {
    const p = leer();
    if (!p) return;
    try {
      const r = await enviar(p);
      if (r.ok) return gracias(p.givenName);
      if (r.status === 422) { guardar(null); avisoPendiente(); return; } // datos que el servidor no acepta: se vuelven a completar
    } catch (_) { /* sigue pendiente */ }
    if (manual) avisoPendiente();
  }

  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    document.querySelectorAll(".error[data-para]").forEach((el) => (el.textContent = ""));
    $("error-general").hidden = true;
    const d = datos();
    const errores = validar(d);
    if (Object.keys(errores).length) {
      Object.entries(errores).forEach(([campo, texto]) => mostrarError(campo, texto));
      const primero = document.querySelector(".error[data-para]:not(:empty)");
      if (primero) primero.closest(".bloque").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const cuerpo = { submissionKey: (leer() && leer().submissionKey) || uuid(), ...d, baptismDetail: d.baptismDetail || undefined, website: $("website").value || undefined };
    const boton = $("enviar");
    boton.disabled = true;
    boton.textContent = "Enviando…";
    try {
      const r = await enviar(cuerpo);
      if (r.ok) return gracias(d.givenName);
      if (r.status === 422 && r.json.fields) {
        Object.entries(r.json.fields).forEach(([campo, texto]) => mostrarError(campo, texto));
      } else if (r.status === 429) {
        $("error-general").textContent = "Recibimos muchos envíos desde esta conexión. Probá de nuevo en un rato.";
        $("error-general").hidden = false;
      } else {
        guardar(cuerpo);
        avisoPendiente();
      }
    } catch (_) {
      // Sin conexión: se guarda en el teléfono y se reintenta al volver a abrir la página.
      guardar(cuerpo);
      avisoPendiente();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      boton.disabled = false;
      boton.textContent = "Quiero ser parte de Casa Nueva";
    }
  });

  // Al abrir: si quedó un envío pendiente, se reintenta solo.
  if (leer()) { avisoPendiente(); reintentar(false); }
})();
