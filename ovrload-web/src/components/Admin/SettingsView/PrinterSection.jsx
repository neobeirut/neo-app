"use client";

import { useState, useEffect } from "react";

export function PrinterSection() {
  const [serverIP,   setServerIP]   = useState("");
  const [serverPort, setServerPort] = useState("9191");
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [message,    setMessage]    = useState("");
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/admin/settings");
        const data = await res.json();
        if (data.print_server_ip)   setServerIP(String(data.print_server_ip));
        if (data.print_server_port) setServerPort(String(data.print_server_port));
      } catch (err) {
        console.error("Error loading printer settings:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res  = await fetch("/api/admin/settings", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          print_server_ip:   serverIP.trim(),
          print_server_port: serverPort.trim() || "9191",
        }),
      });
      const data = await res.json();
      setMessage(data.success ? "Saved!" : "Failed: " + (data.error || "Unknown error"));
    } catch (err) {
      setMessage("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!serverIP) {
      setTestResult("fail");
      setMessage("Enter the Print Server IP first.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    setMessage("");
    try {
      const ip   = serverIP.trim();
      const port = serverPort.trim() || "9191";
      const res  = await fetch("http://" + ip + ":" + port + "/status", {
        signal: AbortSignal.timeout(4000),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult("ok");
        setMessage("Connected! Printer: " + data.printer);
      } else {
        setTestResult("fail");
        setMessage("Server responded but returned unexpected data.");
      }
    } catch (err) {
      setTestResult("fail");
      setMessage("Could not reach print server. Make sure it is running and on the same WiFi network.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">Printer Settings</h3>
        <p className="text-xs text-gray-500 mt-1">
          Configure the local print server that connects to the XPrinter POS-80 (192.168.10.110).
          Run node print-server.js on a Windows PC on the same network, then enter that PC local IP below.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-800">
        <strong>How to find your PC IP:</strong> Open Command Prompt on the PC,
        type ipconfig, look for IPv4 Address (e.g. 192.168.10.5)
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Print Server IP (PC running print-server.js)
            </label>
            <input
              type="text"
              value={serverIP}
              onChange={(e) => { setServerIP(e.target.value); setTestResult(null); }}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="e.g. 192.168.10.5"
            />
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Port (default 9191)
            </label>
            <input
              type="number"
              value={serverPort}
              onChange={(e) => setServerPort(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="9191"
            />
          </div>
        </div>

        {message && (
          <div className={"text-xs font-semibold px-3 py-2 rounded-lg border " + (
            testResult === "ok"   ? "bg-green-50 text-green-800 border-green-200" :
            testResult === "fail" ? "bg-red-50 text-red-800 border-red-200" :
                                    "bg-gray-50 text-gray-800 border-gray-200"
          )}>
            {message}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="px-5 py-2.5 bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-all shadow"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-[#eb660c] hover:bg-[#d55909] disabled:opacity-50 text-white font-extrabold rounded-lg text-xs transition-all shadow"
          >
            {saving ? "Saving..." : "Save Printer Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
