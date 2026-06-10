"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function ReviewReportsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["review-reports", statusFilter],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin-users/review-reports?status=${statusFilter}`,
      );
      if (!response.ok) throw new Error("Failed to fetch reports");
      return response.json();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ report_id, action }) => {
      const response = await fetch("/api/admin-users/review-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id, action }),
      });
      if (!response.ok) throw new Error("Failed to resolve report");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["review-reports"]);
    },
  });

  const handleResolve = (reportId, action) => {
    if (
      window.confirm(
        `Are you sure you want to ${action.replace("_", " ")} this report?`,
      )
    ) {
      resolveMutation.mutate({ report_id: reportId, action });
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1
        style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "24px" }}
      >
        Review Reports
      </h1>

      <div style={{ marginBottom: "24px", display: "flex", gap: "12px" }}>
        <button
          onClick={() => setStatusFilter("pending")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            backgroundColor: statusFilter === "pending" ? "#3B82F6" : "#fff",
            color: statusFilter === "pending" ? "#fff" : "#374151",
            cursor: "pointer",
          }}
        >
          Pending
        </button>
        <button
          onClick={() => setStatusFilter("resolved")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            backgroundColor: statusFilter === "resolved" ? "#3B82F6" : "#fff",
            color: statusFilter === "resolved" ? "#fff" : "#374151",
            cursor: "pointer",
          }}
        >
          Resolved
        </button>
        <button
          onClick={() => setStatusFilter("rejected")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            backgroundColor: statusFilter === "rejected" ? "#3B82F6" : "#fff",
            color: statusFilter === "rejected" ? "#fff" : "#374151",
            cursor: "pointer",
          }}
        >
          Rejected
        </button>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {data?.reports?.length === 0 ? (
            <div
              style={{
                padding: "48px",
                textAlign: "center",
                color: "#6B7280",
              }}
            >
              No {statusFilter} reports
            </div>
          ) : (
            data?.reports?.map((report) => (
              <div
                key={report.id}
                style={{
                  padding: "16px",
                  border: "1px solid #E5E7EB",
                  borderRadius: "12px",
                  backgroundColor: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "600", marginBottom: "4px" }}>
                      Product: {report.product_name}
                    </div>
                    <div style={{ fontSize: "14px", color: "#6B7280" }}>
                      Reported by: {report.reporter_name}
                    </div>
                    <div style={{ fontSize: "14px", color: "#6B7280" }}>
                      Reviewer: {report.reviewer_name} ({report.reviewer_phone})
                    </div>
                  </div>
                  <div style={{ fontSize: "14px", color: "#6B7280" }}>
                    {new Date(report.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#F9FAFB",
                    borderRadius: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ fontSize: "14px", marginBottom: "8px" }}>
                    <strong>Review ({report.rating} stars):</strong>
                  </div>
                  <div style={{ fontSize: "14px", color: "#374151" }}>
                    {report.review_text || "(No text)"}
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#FEF2F2",
                    borderRadius: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ fontSize: "14px" }}>
                    <strong>Reason:</strong> {report.reason}
                  </div>
                </div>

                {statusFilter === "pending" && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => handleResolve(report.id, "reject")}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "1px solid #E5E7EB",
                        backgroundColor: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Reject Report
                    </button>
                    <button
                      onClick={() => handleResolve(report.id, "delete_review")}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "1px solid #DC2626",
                        backgroundColor: "#DC2626",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Delete Review
                    </button>
                    <button
                      onClick={() => handleResolve(report.id, "block_user")}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "1px solid #991B1B",
                        backgroundColor: "#991B1B",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Block User & Delete Review
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
