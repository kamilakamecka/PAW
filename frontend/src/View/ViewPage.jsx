import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import API_BASE_URL from "../utils/config";
import { parseUserData, calculateStepsData, calculateAverage } from "../utils/dataUtils";
import './ViewPage.css';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";

// Dane każdej pary: etykieta + co oznacza wynik dla zwykłego człowieka
const CORRELATION_LABELS = {
  "sleep_stress": {
    label: "Sen ↔ Stres",
    positive: "Im więcej śpisz, tym wyższy masz stres — to nieoczekiwany wynik. Może stres powoduje, że śpisz dłużej jako reakcja na zmęczenie?",
    negative: "Im więcej śpisz, tym mniejszy stres odczuwasz — to zdrowy wzorzec. Dobry sen skutecznie obniża napięcie nerwowe.",
    neutral:  "Nie widać wyraźnego związku między snem a stresem — mogą na siebie nie wpływać lub inne czynniki są ważniejsze.",
  },
  "sleep_quality": {
    label: "Sen ↔ Jakość snu",
    positive: "Dłuższy sen idzie w parze z lepszą jego jakością — typowy, zdrowy wzorzec.",
    negative: "Paradoksalnie, im dłużej śpisz, tym gorzej oceniasz jakość snu — być może śpisz za długo lub masz zaburzenia snu.",
    neutral:  "Długość snu nie przekłada się wyraźnie na jego jakość — liczy się raczej głębokość i regularność snu.",
  },
  "sleep_activity": {
    label: "Sen ↔ Aktywność",
    positive: "Więcej ruchu idzie w parze z dłuższym snem — aktywność fizyczna sprzyja lepszemu wypoczynkowi.",
    negative: "Im więcej ćwiczysz, tym krócej śpisz — może ćwiczysz późno wieczorem lub masz napiętą aktywność zawodową?",
    neutral:  "Aktywność fizyczna nie wpływa wyraźnie na długość snu — inne czynniki decydują o tym ile śpisz.",
  },
  "stress_quality": {
    label: "Stres ↔ Jakość snu",
    positive: "Wyższy stres towarzyszy lepszej jakości snu — to nieoczekiwane; sprawdź czy dane są poprawne.",
    negative: "Wyższy stres wyraźnie pogarsza jakość snu — to typowy wzorzec. Redukcja stresu powinna poprawić wypoczynek.",
    neutral:  "Stres nie wpływa wyraźnie na jakość snu w tych danych.",
  },
  "stress_activity": {
    label: "Stres ↔ Aktywność",
    positive: "Więcej aktywności wiąże się z wyższym stresem — możliwy przeciążony plan dnia lub intensywny tryb życia.",
    negative: "Więcej ruchu fizycznego = niższy stres — ćwiczenia skutecznie redukują napięcie nerwowe.",
    neutral:  "Aktywność fizyczna nie ma wyraźnego wpływu na poziom stresu w tych danych.",
  },
  "quality_activity": {
    label: "Jakość snu ↔ Aktywność",
    positive: "Lepsza jakość snu idzie w parze z większą aktywnością — dobrze wypoczęty organizm chętniej się rusza.",
    negative: "Wyższa aktywność wiąże się z gorszą jakością snu — możliwe przemęczenie lub ćwiczenia zbyt późno.",
    neutral:  "Jakość snu i aktywność fizyczna nie wpływają na siebie wyraźnie w tych danych.",
  },
};

// Interpretacja słowna wartości korelacji Pearsona
const interpretCorrelation = (val) => {
  const abs = Math.abs(val);
  if (abs >= 0.8) return { color: val >= 0 ? "#22c55e" : "#ef4444" };
  if (abs >= 0.6) return { color: val >= 0 ? "#4ade80" : "#f87171" };
  if (abs >= 0.4) return { color: val >= 0 ? "#facc15" : "#fb923c" };
  if (abs >= 0.2) return { color: "#94a3b8" };
  return              { color: "#64748b" };
};

// Prosty tooltip — tylko nazwa i wartość
const CustomCorrelationTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const { name, value } = payload[0].payload;
  const meta = CORRELATION_LABELS[name] || { label: name };
  const { color } = interpretCorrelation(value);
  return (
    <div style={{
      background: "rgba(15,10,40,0.95)",
      border: `1px solid ${color}`,
      borderRadius: "10px",
      padding: "10px 14px",
      color: "white",
      fontSize: "13px",
    }}>
      <div style={{ fontWeight: 700, marginBottom: "4px" }}>{meta.label}</div>
      <div>r = <strong style={{ color }}>{value.toFixed(4)}</strong></div>
    </div>
  );
};

// Karty interpretacji pod wykresem
const CorrelationInsights = ({ corrData }) => {
  if (!corrData || corrData.length === 0) return null;
  return (
    <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
      <h4 style={{ color: "rgba(255,255,255,0.9)", margin: "0 0 4px 0", fontSize: "15px" }}>
        💡 Co oznaczają te wyniki dla Ciebie?
      </h4>
      {corrData.map((entry) => {
        const meta = CORRELATION_LABELS[entry.name];
        if (!meta) return null;
        const { color } = interpretCorrelation(entry.value);
        const abs = Math.abs(entry.value);
        let interpretation;
        if (abs < 0.2)       interpretation = meta.neutral;
        else if (entry.value >= 0) interpretation = meta.positive;
        else                 interpretation = meta.negative;
        const sign = entry.value >= 0 ? "+" : "";
        return (
          <div key={entry.name} style={{
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${color}55`,
            borderLeft: `4px solid ${color}`,
            borderRadius: "12px",
            padding: "12px 16px",
            display: "flex",
            gap: "14px",
            alignItems: "flex-start",
          }}>
            <div style={{
              minWidth: "48px",
              textAlign: "center",
              fontWeight: 800,
              fontSize: "18px",
              color,
              paddingTop: "2px",
            }}>
              {sign}{entry.value.toFixed(2)}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "white", marginBottom: "4px", fontSize: "14px" }}>
                {meta.label}
              </div>
              <div style={{ color: "rgba(255,255,255,0.72)", fontSize: "13px", lineHeight: "1.55" }}>
                {interpretation}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ViewPage = () => {
  const { nick } = useParams();
  const [userData, setUserData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [correlations, setCorrelations] = useState(null);

  const [activeTab, setActiveTab] = useState("charts"); // ✅ TABS

  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.name.endsWith('.json')) {
        setSelectedFile(file);
        setErrorMessage('');
      } else {
        setErrorMessage('Dozwolone są tylko pliki z rozszerzeniem .json');
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.json')) {
        setSelectedFile(file);
        setErrorMessage('');
      } else {
        setErrorMessage('Dozwolone są tylko pliki z rozszerzeniem .json');
      }
    }
  };

  const fetchCorrelations = async () => {
    if (!chartData.length) return;

    const payload = {
      sleep: chartData.map(d => d.sleep),
      stress: chartData.map(d => d.stress),
      quality: chartData.map(d => d.quality),
      activity: chartData.map(d => d.activity),
    };

    console.log("payload:", payload);

    try {
      const res = await fetch(`${API_BASE_URL}/api/correlation/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setCorrelations(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUserData = async () => {
    if (!nick) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/get-user-records/${nick}/`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Błąd pobierania");

      setUserData(data);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleUpload = async (nickValue) => {
    if (!nickValue?.trim()) {
      setErrorMessage("Brak nick w adresie URL");
      return;
    }
    if (!selectedFile) {
      setErrorMessage("Wybierz plik do przesłania");
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsUploading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/upload-study/${encodeURIComponent(nickValue.trim())}/`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd przesyłania pliku");

      await fetchUserData();
      setSelectedFile(null);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [nick]);

  const chartData = useMemo(() => parseUserData(userData), [userData]);


  const dateMap = Object.fromEntries(
    chartData.map(d => [d.x, d.date])
  );

  const stepsData = useMemo(() => calculateStepsData(userData), [userData]);

  const avg = (key) => calculateAverage(chartData, key);

  useEffect(() => {
    if (chartData.length > 0) {
      fetchCorrelations();
    }
  }, [chartData]);

  const handleExportCSV = () => {
    if (!chartData || chartData.length === 0) return;

    const headers = ["Data", "Sen (godziny)", "Jakość Snu", "Poziom Stresu", "Poziom Aktywności"];
    const rows = chartData.map(d => [
      d.date,
      d.sleep ?? "",
      d.quality ?? "",
      d.stress ?? "",
      d.activity ?? ""
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(";"),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `dane_eksport_${nick || "uzytkownik"}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="view-page">
      <h1>Witaj w aplikacji HealthMonitoring!</h1>

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <div
        className={`upload-card ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <h3>Zarządzanie Danymi</h3>
        <div className="upload-actions">
          <label className="custom-file-upload">
            <input type="file" onChange={handleFileChange} accept=".json" style={{ display: 'none' }} />
            📂 {selectedFile ? selectedFile.name : "Prześlij plik JSON"}
          </label>
          <button
            className="btn-primary"
            onClick={() => handleUpload(nick)}
            disabled={isUploading || !selectedFile}
          >
            {isUploading ? 'Wysyłanie...' : 'Załaduj dane'}
          </button>
          <button
            className="btn-secondary"
            onClick={handleExportCSV}
            disabled={chartData.length === 0}
          >
            📥 Eksportuj dane
          </button>
        </div>
      </div>

      {/* ✅ TABS */}
      {userData && (
        <>
          <div className="tabs">
            <button
              className={activeTab === "charts" ? "active" : ""}
              onClick={() => setActiveTab("charts")}
            >
              📊 Wykresy
            </button>

            <button
              className={activeTab === "stats" ? "active" : ""}
              onClick={() => setActiveTab("stats")}
            >
              📈 Statystyki
            </button>
          </div>

          {/* ✅ STATYSTYKI */}
          {activeTab === "stats" && (
            <>
              <div className="kpi-grid">
                <div className="kpi-card">😴 Sen: {avg("sleep")}</div>
                <div className="kpi-card">⭐ Jakość: {avg("quality")}</div>
                <div className="kpi-card">🔥 Stres: {avg("stress")}</div>
                <div className="kpi-card">🏃 Aktywność: {avg("activity")}</div>
              </div>

              {correlations && correlations.correlations && (() => {
                const corrData = Object.entries(correlations.correlations).map(([key, value]) => ({
                  name: key,
                  label: CORRELATION_LABELS[key]?.label || key,
                  value,
                }));
                return (
                  <div className="correlations chart-box" style={{ maxWidth: "800px", margin: "20px auto" }}>
                    <h3>📊 Korelacje między zmiennymi</h3>
                    <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", marginBottom: "16px", marginTop: "-4px" }}>
                      Wykres pokazuje jak mocno dwie zmienne są ze sobą powiązane.
                      Słupek w prawo (<strong style={{color:"#22c55e"}}>+</strong>) = rosną razem,
                      w lewo (<strong style={{color:"#ef4444"}}>−</strong>) = gdy jedna rośnie, druga maleje,
                      blisko zera = brak wyraźnego związku.
                    </p>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        layout="vertical"
                        data={corrData}
                        margin={{ top: 10, right: 40, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis
                          type="number"
                          domain={[-1, 1]}
                          tickFormatter={(val) => val.toFixed(1)}
                          tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
                        />
                        <YAxis
                          dataKey="label"
                          type="category"
                          width={160}
                          tick={{ fill: "rgba(255,255,255,0.85)", fontSize: 12 }}
                        />
                        <Tooltip content={<CustomCorrelationTooltip />} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                          {corrData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={interpretCorrelation(entry.value).color}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    <CorrelationInsights corrData={corrData} />
                  </div>
                );
              })()}
            </>
          )}

          {/* ✅ WYKRESY */}
          {activeTab === "charts" && (
            <div className="charts-grid">

              <div className="chart-box">
                <h3>😴 Sen</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="x"
                      tickFormatter={(value) => dateMap[value]?.slice(0, 10) || value}
                    />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="sleep" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-box">
                <h3>⭐ Jakość</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="x"
                      tickFormatter={(value) => dateMap[value]?.slice(0, 10) || value}
                    />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="quality" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-box">
                <h3>🔥 Stres</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="x"
                      tickFormatter={(value) => dateMap[value]?.slice(0, 10) || value}
                    />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="stress" stroke="#ef4444" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-box">
                <h3>🏃 Aktywność</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="x"
                      tickFormatter={(value) => dateMap[value]?.slice(0, 10) || value}
                    />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="activity" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-box">
                <h3>📊 Sen vs Stres</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="x"
                      tickFormatter={(value) => dateMap[value]?.slice(0, 10) || value}
                    />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="sleep" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="stress" stroke="#ef4444" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-box">
                <h3>👣 Kroki</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={stepsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="x"
                      tickFormatter={(value) => {
                        const point = stepsData.find(d => d.x === value);
                        return point?.date ? point.date.slice(0, 10) : value;
                      }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="steps" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ViewPage;