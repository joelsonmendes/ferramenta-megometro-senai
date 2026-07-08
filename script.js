const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const STORAGE_KEY = "megometro_senai_hub_reports_v1";

const checklistItems = [
  "Usei EPI adequado e organizei a bancada antes do ensaio.",
  "Identifiquei o circuito/equipamento que será medido.",
  "Desenergizei o circuito e apliquei bloqueio/etiquetagem.",
  "Confirmei ausência de tensão com instrumento adequado.",
  "Desconectei CLP, IHM, inversor, sensores, DPS, fontes e cargas eletrônicas.",
  "Descarreguei capacitâncias e aterrei temporariamente os condutores.",
  "Selecionei tensão de ensaio compatível com o objeto testado.",
  "Conectei corretamente LINE e EARTH antes de iniciar a medição.",
  "Após medir, descarreguei o circuito antes de tocar nos terminais.",
  "Registrei menor valor, observações e parecer final."
];

const quizQuestions = [
  {
    q: "Qual é o primeiro cuidado antes de usar o megômetro?",
    options: ["Aplicar 1000 Vcc diretamente", "Desenergizar, bloquear e confirmar ausência de tensão", "Medir corrente com alicate", "Ligar o motor em vazio"],
    answer: 1
  },
  {
    q: "Por que não se deve aplicar megômetro em circuito conectado a CLP, IHM ou inversor?",
    options: ["Porque a leitura sempre será infinita", "Porque a tensão CC de ensaio pode danificar eletrônicos", "Porque o megômetro mede apenas corrente alternada", "Porque o motor não descarrega"],
    answer: 1
  },
  {
    q: "Para um motor de 380 V usando a regra kV + 1, qual é o Rmín didático?",
    options: ["0,38 MΩ", "1,38 MΩ", "3,8 MΩ", "380 MΩ"],
    answer: 1
  },
  {
    q: "O Índice de Polarização é calculado por:",
    options: ["R30s/R10min", "R10min/R1min", "R1min/R10min", "Tensão/Corrente nominal"],
    answer: 1
  },
  {
    q: "Se a resistência medida ficar abaixo do mínimo calculado, a recomendação correta é:",
    options: ["Energizar para secar o isolamento", "Ignorar se o motor girar", "Não energizar e investigar umidade, sujeira ou falha", "Reduzir o valor mínimo até aprovar"],
    answer: 2
  }
];

const fields = [
  "studentName", "className", "teacherName", "testDate", "assetType", "assetId", "ratedVoltage", "testVoltage",
  "cableLength", "temperature", "humidity", "visualState", "r30", "r60", "r10", "extraMin", "phaseA",
  "phaseB", "phaseC", "phasePhase", "notes", "criterion", "cableReference", "customMin", "useTempCorrection"
];

function init() {
  setDefaultDate();
  renderChecklist();
  renderQuiz();
  bindTabs();
  bindEvents();
  updateChecklistProgress();
  calculateAndRender();
  renderHistory();
}

function setDefaultDate() {
  const input = $("#testDate");
  if (!input.value) input.valueAsDate = new Date();
}

function renderChecklist() {
  const box = $("#checklist");
  box.innerHTML = checklistItems.map((text, index) => `
    <label class="check-item">
      <input type="checkbox" data-check-index="${index}" />
      <span>${index + 1}. ${text}</span>
    </label>
  `).join("");
}

function updateChecklistProgress() {
  const checks = $$('[data-check-index]');
  const done = checks.filter((check) => check.checked).length;
  const percent = checks.length ? Math.round((done / checks.length) * 100) : 0;
  $("#checkProgressBar").style.width = `${percent}%`;
  $("#checkProgressText").textContent = `${percent}% concluído (${done}/${checks.length})`;
}

function bindTabs() {
  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".tab").forEach((tab) => tab.classList.remove("active"));
      $$(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      $("#" + button.dataset.tab).classList.add("active");
    });
  });
}

function bindEvents() {
  document.addEventListener("input", (event) => {
    if (event.target.matches("input, select, textarea")) calculateAndRender();
    if (event.target.matches('[data-check-index]')) updateChecklistProgress();
    if (event.target.name?.startsWith("quiz")) updateQuizResult();
  });

  $("#calculateBtn").addEventListener("click", () => {
    calculateAndRender();
    activateTab("calculadora");
  });

  $("#sampleBtn").addEventListener("click", fillSample);
  $("#resetBtn").addEventListener("click", () => setTimeout(() => { setDefaultDate(); calculateAndRender(); }, 0));
  $("#saveReportBtn").addEventListener("click", saveReport);
  $("#printBtn").addEventListener("click", () => window.print());
  $("#exportCsvBtn").addEventListener("click", exportCsv);
  $("#clearHistoryBtn").addEventListener("click", clearHistory);

  const closeNotice = $('[data-close-notice]');
  if (closeNotice) {
    closeNotice.addEventListener("click", () => $("#alertaSeguranca").style.display = "none");
  }
}

function activateTab(id) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === id));
  $$(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === id));
}

function getNumber(id) {
  const value = parseFloat($("#" + id).value.toString().replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function getFormData() {
  const data = {};
  fields.forEach((id) => {
    const el = $("#" + id);
    if (!el) return;
    data[id] = el.type === "checkbox" ? el.checked : el.value;
  });
  return data;
}

function getReadings() {
  const ids = ["r60", "extraMin", "phaseA", "phaseB", "phaseC", "phasePhase"];
  return ids
    .map((id) => ({ id, value: getNumber(id) }))
    .filter((item) => item.value !== null && item.value > 0);
}

function getMeasuredMin() {
  const readings = getReadings();
  if (!readings.length) return null;
  return Math.min(...readings.map((item) => item.value));
}

function calculateRequiredMin() {
  const assetType = $("#assetType").value;
  const criterion = $("#criterion").value;
  const ratedVoltage = getNumber("ratedVoltage") || 0;
  const ratedKv = ratedVoltage / 1000;
  const cableLength = getNumber("cableLength") || 0;
  const cableRef = getNumber("cableReference") || 100;
  const customMin = getNumber("customMin") || 0;

  const kvPlusOne = Math.max(0, ratedKv + 1);
  const cableKm = cableLength > 0 ? cableLength / 1000 : null;
  const cableLengthMin = cableKm ? cableRef / cableKm : cableRef;

  let required;
  let formula;

  if (criterion === "auto") {
    if (assetType === "motor") {
      required = Math.max(kvPlusOne, 5);
      formula = `Automático para motor: maior valor entre kV + 1 (${format(kvPlusOne)} MΩ) e mínimo didático de 5 MΩ.`;
    } else if (assetType === "cabo") {
      required = Math.max(1, cableLengthMin);
      formula = `Automático para cabo: maior valor entre 1 MΩ e MΩ·km ÷ km = ${format(cableRef)} ÷ ${format(cableKm || 1)} = ${format(cableLengthMin)} MΩ.`;
    } else {
      required = 1;
      formula = "Automático para instalação/circuito BT: mínimo didático de 1 MΩ.";
    }
  } else if (criterion === "motor_kv1") {
    required = kvPlusOne;
    formula = `Motor: Rmín = kV + 1 = ${format(ratedKv)} + 1 = ${format(required)} MΩ.`;
  } else if (criterion === "motor_5") {
    required = 5;
    formula = "Motor BT moderno: Rmín didático = 5 MΩ.";
  } else if (criterion === "motor_100") {
    required = 100;
    formula = "Motor com bobina formada: referência didática de 100 MΩ.";
  } else if (criterion === "bt_1") {
    required = 1;
    formula = "Instalação/cabo de baixa tensão: Rmín didático = 1 MΩ.";
  } else if (criterion === "cable_length") {
    required = cableLengthMin;
    formula = `Cabo por comprimento: Rmín = MΩ·km ÷ km = ${format(cableRef)} ÷ ${format(cableKm || 1)} = ${format(required)} MΩ.`;
  } else {
    required = customMin;
    formula = `Mínimo definido pelo professor: Rmín = ${format(required)} MΩ.`;
  }

  return { required, formula };
}

function correctedTo40(measured) {
  const temp = getNumber("temperature");
  if (measured === null || temp === null) return null;
  if (!$("#useTempCorrection").checked) return measured;
  return measured * Math.pow(2, (temp - 40) / 10);
}

function calculatePI() {
  const r10 = getNumber("r10");
  const r60 = getNumber("r60");
  if (!r10 || !r60) return null;
  return r10 / r60;
}

function calculateDAR() {
  const r60 = getNumber("r60");
  const r30 = getNumber("r30");
  if (!r60 || !r30) return null;
  return r60 / r30;
}

function interpretPI(pi) {
  if (pi === null) return "--";
  if (pi < 1) return `${format(pi)} crítico`;
  if (pi < 2) return `${format(pi)} atenção`;
  return `${format(pi)} bom`;
}

function interpretDAR(dar) {
  if (dar === null) return "--";
  if (dar < 1.25) return `${format(dar)} atenção`;
  if (dar < 1.6) return `${format(dar)} regular`;
  return `${format(dar)} bom`;
}

function calculateAndRender() {
  const measured = getMeasuredMin();
  const corrected = correctedTo40(measured);
  const { required, formula } = calculateRequiredMin();
  const pi = calculatePI();
  const dar = calculateDAR();

  $("#measuredMin").textContent = measured === null ? "-- MΩ" : `${format(measured)} MΩ`;
  $("#correctedValue").textContent = corrected === null ? "-- MΩ" : `${format(corrected)} MΩ`;
  $("#requiredMin").textContent = `${format(required)} MΩ`;
  $("#piValue").textContent = interpretPI(pi);
  $("#darValue").textContent = interpretDAR(dar);
  $("#formulaExplanation").textContent = formula;

  const score = $("#scoreBox");
  score.classList.remove("pass", "warn", "fail");

  if (corrected === null) {
    $("#statusText").textContent = "Aguardando dados";
    $("#statusHint").textContent = "Preencha pelo menos uma leitura de resistência em MΩ.";
    $("#marginValue").textContent = "--";
    updateReportPreview(null);
    return null;
  }

  const margin = corrected - required;
  const marginPercent = required > 0 ? (margin / required) * 100 : 0;
  $("#marginValue").textContent = `${format(margin)} MΩ (${format(marginPercent)}%)`;

  let status;
  let hint;
  let cssClass;

  if (corrected < required) {
    status = "Reprovado";
    hint = "Resultado abaixo do mínimo. Não energizar antes de investigar isolamento, umidade, sujeira, conexão incorreta ou dano no equipamento.";
    cssClass = "fail";
  } else if (corrected <= required * 1.2) {
    status = "Atenção";
    hint = "Resultado aprovado por pequena margem. Repetir ensaio, limpar/secar o equipamento e comparar com histórico.";
    cssClass = "warn";
  } else {
    status = "Aprovado";
    hint = "Resultado acima do mínimo calculado para a prática. Registrar e comparar com histórico de manutenção.";
    cssClass = "pass";
  }

  score.classList.add(cssClass);
  $("#statusText").textContent = status;
  $("#statusHint").textContent = hint;

  const result = {
    ...getFormData(),
    measured,
    corrected,
    required,
    margin,
    marginPercent,
    pi,
    dar,
    status,
    hint,
    formula,
    savedAt: new Date().toISOString()
  };
  updateReportPreview(result);
  return result;
}

function updateReportPreview(result) {
  const box = $("#reportPreview");
  if (!result) {
    box.innerHTML = `<p>Preencha as medições e clique em <strong>Salvar relatório</strong>.</p>`;
    return;
  }

  box.innerHTML = `
    <div class="report">
      <div class="report__top">
        <div>
          <h2>Relatório de Ensaio com Megômetro</h2>
          <p>Ferramenta didática — SENAI HUB</p>
        </div>
        <img src="assets/logo_senai_hub.webp" alt="SENAI HUB" />
      </div>
      <dl>
        <dt>Aluno</dt><dd>${safe(result.studentName) || "--"}</dd>
        <dt>Turma</dt><dd>${safe(result.className) || "--"}</dd>
        <dt>Data</dt><dd>${safe(result.testDate) || "--"}</dd>
        <dt>Professor</dt><dd>${safe(result.teacherName) || "--"}</dd>
        <dt>Objeto</dt><dd>${labelAsset(result.assetType)} — ${safe(result.assetId) || "--"}</dd>
        <dt>Tensão nominal</dt><dd>${safe(result.ratedVoltage)} V</dd>
        <dt>Tensão de ensaio</dt><dd>${safe(result.testVoltage)} Vcc</dd>
        <dt>Menor medição</dt><dd>${format(result.measured)} MΩ</dd>
        <dt>Valor usado no parecer</dt><dd>${format(result.corrected)} MΩ</dd>
        <dt>Mínimo calculado</dt><dd>${format(result.required)} MΩ</dd>
        <dt>PI</dt><dd>${interpretPI(result.pi)}</dd>
        <dt>DAR</dt><dd>${interpretDAR(result.dar)}</dd>
        <dt>Parecer</dt><dd><strong>${result.status}</strong></dd>
      </dl>
      <p><strong>Fórmula aplicada:</strong> ${safe(result.formula)}</p>
      <p><strong>Observações:</strong> ${safe(result.notes) || "Sem observações."}</p>
      <p><strong>Recomendação:</strong> ${safe(result.hint)}</p>
      <p><strong>Responsável pela ferramenta:</strong> Joelson M. Mendes — Esp. em Energia e IoT</p>
    </div>
  `;
}

function labelAsset(type) {
  return type === "motor" ? "Motor elétrico" : type === "cabo" ? "Cabo elétrico" : "Instalação / circuito BT";
}

function safe(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function format(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function fillSample() {
  const sample = {
    studentName: "Aluno exemplo",
    className: "Técnico em Eletrotécnica",
    teacherName: "Joelson M. Mendes",
    assetType: "motor",
    assetId: "Motor M1 - bancada didática",
    ratedVoltage: "380",
    testVoltage: "500",
    cableLength: "25",
    temperature: "30",
    humidity: "68",
    visualState: "Limpo e seco",
    r30: "80",
    r60: "120",
    r10: "260",
    extraMin: "118",
    phaseA: "125",
    phaseB: "121",
    phaseC: "118",
    phasePhase: "150",
    notes: "Circuito isolado do inversor e medição realizada entre enrolamentos e carcaça. Leitura estabilizada após 60 segundos.",
    criterion: "auto",
    cableReference: "100",
    customMin: "1"
  };

  Object.entries(sample).forEach(([id, value]) => {
    const el = $("#" + id);
    if (el) el.value = value;
  });
  $("#useTempCorrection").checked = false;
  setDefaultDate();
  calculateAndRender();
}

function saveReport() {
  const result = calculateAndRender();
  if (!result) {
    alert("Preencha pelo menos uma medição de resistência em MΩ antes de salvar.");
    return;
  }
  const reports = getReports();
  reports.unshift(result);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, 60)));
  renderHistory();
  activateTab("relatorio");
}

function getReports() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function renderHistory() {
  const reports = getReports();
  const box = $("#historyList");
  if (!reports.length) {
    box.innerHTML = `<p>Nenhum relatório salvo ainda.</p>`;
    return;
  }
  box.innerHTML = reports.map((item, index) => `
    <div class="history-item">
      <strong>${safe(item.studentName) || "Aluno sem nome"} — ${safe(item.status)}</strong>
      <span>${safe(item.testDate) || "Sem data"} | ${labelAsset(item.assetType)} | ${safe(item.assetId) || "Sem identificação"}</span>
      <span>Menor: ${format(item.measured)} MΩ | Mínimo: ${format(item.required)} MΩ | PI: ${interpretPI(item.pi)}</span>
      <button type="button" class="btn btn--ghost" onclick="loadReport(${index})">Reabrir</button>
    </div>
  `).join("");
}

window.loadReport = function(index) {
  const reports = getReports();
  const item = reports[index];
  if (!item) return;

  fields.forEach((id) => {
    const el = $("#" + id);
    if (!el || item[id] === undefined) return;
    if (el.type === "checkbox") el.checked = Boolean(item[id]);
    else el.value = item[id];
  });

  calculateAndRender();
  activateTab("medicao");
};

function clearHistory() {
  if (!confirm("Deseja apagar todo o histórico salvo neste navegador?")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
}

function exportCsv() {
  const reports = getReports();
  if (!reports.length) {
    alert("Nenhum relatório salvo para exportar.");
    return;
  }

  const headers = ["data", "aluno", "turma", "objeto", "identificacao", "tensao_nominal_v", "tensao_ensaio_vcc", "menor_mohm", "corrigido_mohm", "minimo_mohm", "pi", "dar", "parecer", "observacoes"];
  const rows = reports.map((r) => [
    r.testDate, r.studentName, r.className, labelAsset(r.assetType), r.assetId, r.ratedVoltage, r.testVoltage,
    formatCsv(r.measured), formatCsv(r.corrected), formatCsv(r.required), formatCsv(r.pi), formatCsv(r.dar), r.status, r.notes
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorios_megometro_senai_hub.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function formatCsv(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return String(Number(value).toFixed(2)).replace(".", ",");
}

function renderQuiz() {
  const box = $("#quizBox");
  box.innerHTML = quizQuestions.map((question, qIndex) => `
    <div class="question">
      <strong>${qIndex + 1}. ${question.q}</strong>
      <div class="options">
        ${question.options.map((option, oIndex) => `
          <label class="option">
            <input type="radio" name="quiz${qIndex}" value="${oIndex}" />
            <span>${option}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `).join("") + `<button type="button" class="btn btn--primary" id="finishQuizBtn">Corrigir quiz</button>`;

  $("#finishQuizBtn").addEventListener("click", updateQuizResult);
}

function updateQuizResult() {
  let answered = 0;
  let correct = 0;

  quizQuestions.forEach((question, index) => {
    const selected = $(`input[name="quiz${index}"]:checked`);
    if (selected) {
      answered++;
      if (Number(selected.value) === question.answer) correct++;
    }
  });

  const result = $("#quizResult");
  result.style.display = "block";
  if (answered < quizQuestions.length) {
    result.textContent = `Respondidas: ${answered}/${quizQuestions.length}. Complete todas as questões para concluir.`;
  } else {
    result.textContent = `Resultado: ${correct}/${quizQuestions.length}. ${correct >= 4 ? "Ótimo desempenho." : "Revise o procedimento de segurança e as fórmulas antes da prática."}`;
  }
}

init();
