"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { CheckCircle, XCircle, Clock, Eye, Calendar, Users, FileQuestion, Code, ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import "./VerifyContests.css";

export default function VerifyContestsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContest, setSelectedContest] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [contestDetails, setContestDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Admin-only guard — redirect organisers
  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      toast.error("Admin access required");
      router.push("/");
    }
  }, [user]);

  const fetchPendingContests = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/contests/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setContests(data.contests || []);
    } catch {
      toast.error("Failed to fetch pending contests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingContests();
  }, []);

  const handleViewDetails = async (contest: any) => {
    setSelectedContest(contest._id);
    setDetailsLoading(true);
    setShowDetailsModal(true);

    try {
      // Fetch MCQs, Coding problems, and Forms for this contest
      const [mcqRes, codingRes, formsRes] = await Promise.all([
        fetch(`/api/mcqs/contest/${contest._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`/api/coding/contest/${contest._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`/api/forms/contest/${contest._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .catch(() => ({ forms: [] })),
      ]);

      setContestDetails({
        contest,
        mcqs: mcqRes.mcqs || [],
        codingProblems: codingRes.problems || [],
        forms: formsRes.forms || [],
      });
    } catch {
      toast.error("Failed to load contest details");
      setShowDetailsModal(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleApprove = async (contestId: string | null) => {
    if (!contestId) return;
    try {
      const res = await fetch(`/api/admin/contests/${contestId}/verify`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "APPROVED" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Contest approved!");
        setShowDetailsModal(false);
        fetchPendingContests();
      } else {
        toast.error(data.message || "Failed to approve contest");
      }
    } catch {
      toast.error("Failed to approve contest");
    }
  };

  const handleReject = async () => {
    if (!selectedContest) return;

    try {
      const res = await fetch(`/api/admin/contests/${selectedContest}/verify`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "REJECTED",
          rejectionReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Contest rejected");
        setShowRejectModal(false);
        setShowDetailsModal(false);
        setRejectionReason("");
        setSelectedContest(null);
        fetchPendingContests();
      } else {
        toast.error(data.message || "Failed to reject contest");
      }
    } catch {
      toast.error("Failed to reject contest");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="verify-contests">
      <div className="page-header">
        <h1>
          <Clock size={28} /> Pending Contest Approvals
        </h1>
        <p>Review and approve contests submitted by organisers</p>
      </div>

      {loading ? (
        <div className="loading">Loading pending contests...</div>
      ) : contests.length === 0 ? (
        <div className="no-contests">
          <CheckCircle size={48} />
          <h3>All caught up!</h3>
          <p>No contests pending approval</p>
        </div>
      ) : (
        <div className="contests-grid">
          {contests.map((contest) => (
            <div key={contest._id} className="contest-card">
              <div className="contest-header">
                <h3>{contest.title}</h3>
                <span className="pending-badge">Pending</span>
              </div>

              <p className="description">{contest.description}</p>

              <div className="contest-meta">
                <div className="meta-item">
                  <Calendar size={16} />
                  <span>{formatDate(contest.startTime)}</span>
                </div>
                <div className="meta-item">
                  <Clock size={16} />
                  <span>{contest.duration} mins</span>
                </div>
                <div className="meta-item">
                  <Users size={16} />
                  <span>By: {contest.createdBy?.name}</span>
                </div>
              </div>

              <div className="sections-info">
                {contest.sections?.mcq?.enabled && (
                  <span className="section-badge">MCQ</span>
                )}
                {contest.sections?.coding?.enabled && (
                  <span className="section-badge">Coding</span>
                )}
              </div>

              <div className="action-buttons">
                <button className="view-btn" onClick={() => handleViewDetails(contest)}>
                  <Eye size={18} /> View Details
                </button>
                <button className="approve-btn" onClick={() => handleApprove(contest._id)}>
                  <CheckCircle size={18} /> Approve
                </button>
                <button
                  className="reject-btn"
                  onClick={() => {
                    setSelectedContest(contest._id);
                    setShowRejectModal(true);
                  }}
                >
                  <XCircle size={18} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal details-modal" onClick={(e) => e.stopPropagation()}>
            {detailsLoading ? (
              <div className="loading">Loading contest details...</div>
            ) : (
              contestDetails && (
                <>
                  <h2>{contestDetails.contest.title}</h2>
                  <p className="organiser-info">By: {contestDetails.contest.createdBy?.name}</p>

                  <div className="questions-summary">
                    <div className="summary-card">
                      <FileQuestion size={24} />
                      <div>
                        <h4>MCQ Questions</h4>
                        <p>{contestDetails.mcqs.length} questions</p>
                      </div>
                    </div>
                    <div className="summary-card">
                      <Code size={24} />
                      <div>
                        <h4>Coding Problems</h4>
                        <p>{contestDetails.codingProblems.length} problems</p>
                      </div>
                    </div>
                    <div className="summary-card">
                      <ClipboardList size={24} />
                      <div>
                        <h4>Forms</h4>
                        <p>{contestDetails.forms?.length || 0} forms</p>
                      </div>
                    </div>
                  </div>

                  {contestDetails.mcqs.length > 0 && (
                    <div className="questions-section">
                      <h4>MCQ Questions Preview</h4>
                      <ul className="questions-list">
                        {contestDetails.mcqs.map((mcq: any, idx: number) => (
                          <li key={mcq._id}>
                            <span className="q-num">Q{idx + 1}.</span> {mcq.question}
                            <span className="q-meta">{mcq.marks} marks</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {contestDetails.codingProblems.length > 0 && (
                    <div className="questions-section">
                      <h4>Coding Problems Preview</h4>
                      <ul className="questions-list">
                        {contestDetails.codingProblems.map((prob: any, idx: number) => (
                          <li key={prob._id}>
                            <span className="q-num">P{idx + 1}.</span> {prob.title}
                            <span className="q-meta">
                              {prob.score} pts | {prob.difficulty}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {contestDetails.forms?.length > 0 && (
                    <div className="questions-section">
                      <h4>Forms Preview</h4>
                      <ul className="questions-list">
                        {contestDetails.forms.map((form: any, idx: number) => (
                          <li key={form._id}>
                            <span className="q-num">F{idx + 1}.</span> {form.title}
                            <span className="q-meta">
                              {form.fields?.length || 0} fields | {form.totalMarks || 0} marks
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {contestDetails.mcqs.length === 0 &&
                    contestDetails.codingProblems.length === 0 &&
                    (contestDetails.forms?.length || 0) === 0 && (
                      <div className="no-questions-warning">
                        ⚠️ No questions or forms added yet! Consider rejecting until content is added.
                      </div>
                    )}

                  <div className="modal-actions">
                    <button className="cancel-btn" onClick={() => setShowDetailsModal(false)}>
                      Close
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => {
                        setShowRejectModal(true);
                      }}
                    >
                      <XCircle size={18} /> Reject
                    </button>
                    <button className="approve-btn" onClick={() => handleApprove(selectedContest)}>
                      <CheckCircle size={18} /> Approve
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Contest</h3>
            <p>Please provide a reason for rejection:</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
            />
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button className="confirm-reject-btn" onClick={handleReject}>
                Reject Contest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
