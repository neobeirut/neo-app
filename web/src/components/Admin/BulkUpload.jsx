import { useState } from "react";
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  FileText,
} from "lucide-react";

export function BulkUpload({ onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [uploadType, setUploadType] = useState("products");

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file type
    if (!file.name.endsWith(".csv")) {
      alert(
        "Please upload a CSV file. If you have an Excel file, please save it as CSV first.",
      );
      return;
    }

    setUploading(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", uploadType);

      const response = await fetch("/api/bulk-upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setResults(result);
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        alert(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed: Network error");
    } finally {
      setUploading(false);
      // Clear the file input
      event.target.value = "";
    }
  };

  const downloadTemplate = () => {
    let csvContent = "";

    if (uploadType === "categories") {
      csvContent = "name,image_url,display_order,is_active,section\n";
      csvContent += "Fresh Breads,https://example.com/bread.jpg,1,true,Store\n";
      csvContent += "Pastries,https://example.com/pastries.jpg,2,true,Store\n";
      csvContent += "Cakes,https://example.com/cakes.jpg,3,true,Cafe\n";
    } else {
      csvContent =
        "name,description,price,original_price,image_url,category,prep_time,rating,ingredients,nutritional_info,is_featured,is_special,status\n";
      csvContent +=
        "Chocolate Croissant,Buttery croissant with rich chocolate,3.99,4.99,https://example.com/croissant.jpg,Pastries,15 min,4.9,Flour\\, Butter\\, Chocolate,250 cal,true,false,Available\n";
      csvContent +=
        "Sourdough Bread,Artisan sourdough with crispy crust,8.99,,https://example.com/sourdough.jpg,Fresh Breads,2 hrs,4.8,Flour\\, Water\\, Salt\\, Starter,180 cal per slice,false,false,Unavailable Today\n";
      csvContent +=
        "Custom Cake,Beautiful custom decorated cake,45.99,,https://example.com/cake.jpg,Cakes,24 hrs,5.0,Flour\\, Sugar\\, Eggs\\, Cream,350 cal per slice,true,true,Available\n";
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${uploadType}_template.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Upload size={24} className="text-blue-500" />
        <h2 className="text-xl font-semibold">Bulk Upload</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Type
            </label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={uploading}
            >
              <option value="products">Products</option>
              <option value="categories">Categories</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <button
            onClick={downloadTemplate}
            className="w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 flex items-center justify-center gap-2 mb-4"
          >
            <Download size={16} />
            Download {uploadType} Template
          </button>

          {uploading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-sm text-gray-600">Uploading...</p>
            </div>
          )}
        </div>

        {/* Instructions Section */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={20} className="text-gray-600" />
            <h3 className="font-medium">Instructions</h3>
          </div>

          <div className="text-sm text-gray-600 space-y-2">
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
              <p className="font-medium text-blue-800 mb-1">📊 Excel Files:</p>
              <p className="text-blue-700">
                If you have an Excel file, please save it as CSV first (File →
                Save As → CSV format)
              </p>
            </div>

            <p>
              <strong>1.</strong> Download the template for {uploadType}
            </p>
            <p>
              <strong>2.</strong> Fill in your data following the template
              format
            </p>
            <p>
              <strong>3.</strong> Save as CSV file
            </p>
            <p>
              <strong>4.</strong> Upload the CSV file
            </p>

            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 font-medium">Important Notes:</p>
              <ul className="text-yellow-700 text-xs mt-1 space-y-1">
                {uploadType === "products" && (
                  <>
                    <li>• Categories must exist before uploading products</li>
                    <li>
                      • Use exact category names from your categories list
                    </li>
                    <li>• Price is required and must be greater than 0</li>
                    <li>• Boolean fields: use "true" or "false"</li>
                    <li>
                      • Valid status values: "Available", "Unavailable Today",
                      "Unavailable Until Further Notice", "Hide from Menu"
                    </li>
                    <li>• Default status is "Available" if not specified</li>
                  </>
                )}
                {uploadType === "categories" && (
                  <>
                    <li>• Category names must be unique</li>
                    <li>• Display order controls sorting (higher = later)</li>
                    <li>• Boolean fields: use "true" or "false"</li>
                    <li>
                      • Valid section values: "Store" or "Cafe" (default:
                      "Store")
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {results && (
        <div className="mt-6 border-t pt-6">
          <h3 className="text-lg font-medium mb-4">Upload Results</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-700">
                {results.success}
              </p>
              <p className="text-sm text-green-600">Successfully Added</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-700">
                {results.errors?.length || 0}
              </p>
              <p className="text-sm text-red-600">Errors</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <FileText className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-700">
                {results.total}
              </p>
              <p className="text-sm text-blue-600">Total Rows</p>
            </div>
          </div>

          {results.errors && results.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {results.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
